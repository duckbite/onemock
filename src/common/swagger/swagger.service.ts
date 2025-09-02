import { Injectable, Logger } from '@nestjs/common';
import { CacheService } from '../cache/cache.service';
import * as fs from 'fs';
import * as path from 'path';

export interface OpenAPISpec {
  openapi: string;
  info: {
    title: string;
    version: string;
    description?: string;
  };
  servers?: Array<{
    url: string;
    description?: string;
  }>;
  paths: Record<
    string,
    {
      [method: string]: {
        summary?: string;
        description?: string;
        parameters?: Array<{
          name: string;
          in: 'query' | 'header' | 'path' | 'cookie';
          required?: boolean;
          schema?: any;
        }>;
        requestBody?: {
          content: Record<
            string,
            {
              schema: any;
            }
          >;
        };
        responses: Record<
          string,
          {
            description: string;
            content?: Record<
              string,
              {
                schema: any;
              }
            >;
          }
        >;
      };
    }
  >;
  components?: {
    schemas?: Record<string, any>;
  };
}

export interface ParsedEndpoint {
  path: string;
  method: string;
  summary?: string;
  description?: string;
  parameters: Array<{
    name: string;
    in: 'query' | 'header' | 'path' | 'cookie';
    required: boolean;
    schema: any;
  }>;
  requestBody?: {
    schema: any;
    required: boolean;
  };
  responses: Record<
    string,
    {
      description: string;
      schema?: any;
    }
  >;
}

@Injectable()
export class SwaggerService {
  private readonly logger = new Logger(SwaggerService.name);
  private specs: Map<string, OpenAPISpec> = new Map();

  constructor(private readonly cacheService: CacheService) {}

  async loadServiceSpec(
    serviceName: string,
    specPath?: string
  ): Promise<OpenAPISpec | null> {
    try {
      // Check cache first
      const cacheKey = `swagger:${serviceName}`;
      const cached = await this.cacheService.getJson<OpenAPISpec>(cacheKey);
      if (cached) {
        this.specs.set(serviceName, cached);
        return cached;
      }

      let spec: OpenAPISpec;

      if (specPath) {
        // Load from file
        const fullPath = path.resolve(specPath);
        if (fs.existsSync(fullPath)) {
          const specContent = fs.readFileSync(fullPath, 'utf8');
          spec = JSON.parse(specContent);
        } else {
          this.logger.error(`Swagger spec file not found: ${fullPath}`);
          return null;
        }
      } else {
        // Try to load from default location
        const defaultPath = path.join(
          process.cwd(),
          'schemas',
          `${serviceName}.json`
        );
        if (fs.existsSync(defaultPath)) {
          const specContent = fs.readFileSync(defaultPath, 'utf8');
          spec = JSON.parse(specContent);
        } else {
          this.logger.warn(`No swagger spec found for service: ${serviceName}`);
          return null;
        }
      }

      this.specs.set(serviceName, spec);

      // Cache the spec
      await this.cacheService.setJson(cacheKey, spec, 3600); // 1 hour cache

      this.logger.log(`Loaded swagger spec for service: ${serviceName}`);
      return spec;
    } catch (error) {
      this.logger.error(
        `Error loading swagger spec for ${serviceName}:`,
        error
      );
      return null;
    }
  }

  getServiceSpec(serviceName: string): OpenAPISpec | null {
    return this.specs.get(serviceName) || null;
  }

  parseEndpoint(
    serviceName: string,
    path: string,
    method: string
  ): ParsedEndpoint | null {
    const spec = this.getServiceSpec(serviceName);
    if (!spec) {
      return null;
    }

    const normalizedPath = this.normalizePath(path);
    const pathSpec = spec.paths[normalizedPath];

    if (!pathSpec || !pathSpec[method.toLowerCase()]) {
      return null;
    }

    const endpointSpec = pathSpec[method.toLowerCase()];

    return {
      path: normalizedPath,
      method: method.toLowerCase(),
      summary: endpointSpec.summary,
      description: endpointSpec.description,
      parameters:
        endpointSpec.parameters?.map((param) => ({
          name: param.name,
          in: param.in,
          required: param.required || false,
          schema: param.schema || {},
        })) || [],
      requestBody: endpointSpec.requestBody
        ? {
            schema: this.getRequestBodySchema(endpointSpec.requestBody),
            required: false,
          }
        : undefined,
      responses: this.parseResponses(
        endpointSpec.responses,
        spec.components?.schemas
      ),
    };
  }

  private normalizePath(path: string): string {
    // Remove query parameters and normalize path
    const cleanPath = path.split('?')[0];

    // Replace path parameters with OpenAPI format
    return cleanPath.replace(/\/[^\/]+/g, (match) => {
      // If it looks like an ID, replace with parameter format
      if (match.match(/^\/[a-zA-Z0-9_-]+$/)) {
        return '/{id}';
      }
      return match;
    });
  }

  private getRequestBodySchema(requestBody: any): any {
    const content = requestBody.content;
    if (content && content['application/json']) {
      return content['application/json'].schema;
    }
    if (content && content['application/x-www-form-urlencoded']) {
      return content['application/x-www-form-urlencoded'].schema;
    }
    return {};
  }

  private parseResponses(
    responses: any,
    schemas?: Record<string, any>
  ): Record<string, any> {
    const parsed: Record<string, any> = {};

    for (const [statusCode, response] of Object.entries(responses)) {
      const responseSpec = response as any;
      parsed[statusCode] = {
        description: responseSpec.description,
        schema: this.resolveSchema(
          responseSpec.content?.['application/json']?.schema,
          schemas
        ),
      };
    }

    return parsed;
  }

  private resolveSchema(schema: any, schemas?: Record<string, any>): any {
    if (!schema) return {};

    // Handle $ref references
    if (schema.$ref) {
      const refPath = schema.$ref.replace('#/', '').split('/');
      let refSchema = schemas;

      for (const part of refPath) {
        refSchema = refSchema?.[part];
      }

      return refSchema || schema;
    }

    return schema;
  }

  async downloadSpecFromUrl(
    serviceName: string,
    url: string
  ): Promise<OpenAPISpec | null> {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to fetch spec: ${response.statusText}`);
      }

      const spec: OpenAPISpec = await response.json();
      this.specs.set(serviceName, spec);

      // Cache the spec
      await this.cacheService.setJson(`swagger:${serviceName}`, spec, 3600);

      this.logger.log(`Downloaded swagger spec for service: ${serviceName}`);
      return spec;
    } catch (error) {
      this.logger.error(
        `Error downloading swagger spec for ${serviceName}:`,
        error
      );
      return null;
    }
  }

  getAvailableEndpoints(serviceName: string): ParsedEndpoint[] {
    const spec = this.getServiceSpec(serviceName);
    if (!spec) return [];

    const endpoints: ParsedEndpoint[] = [];

    for (const [path, pathSpec] of Object.entries(spec.paths)) {
      for (const [method, endpointSpec] of Object.entries(pathSpec)) {
        if (typeof endpointSpec === 'object' && endpointSpec !== null) {
          const parsed = this.parseEndpoint(serviceName, path, method);
          if (parsed) {
            endpoints.push(parsed);
          }
        }
      }
    }

    return endpoints;
  }
}
