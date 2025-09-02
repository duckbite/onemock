import { Injectable, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { ServicesService } from '../services/services.service';
import { AnalyticsService } from '../analytics/analytics.service';
import { SwaggerService } from '../../common/swagger/swagger.service';
import { MockDataService } from '../../common/mock-data/mock-data.service';
import { CacheService } from '../../common/cache/cache.service';
import { User } from '../auth/auth.service';

export interface MockRequest {
  service: string;
  path: string;
  method: string;
  body: any;
  query: any;
  headers: Record<string, string>;
  user: User;
}

export interface MockResponse {
  data: any;
  statusCode: number;
  headers?: Record<string, string>;
}

@Injectable()
export class MockService {
  private readonly logger = new Logger(MockService.name);

  constructor(
    private readonly servicesService: ServicesService,
    private readonly analyticsService: AnalyticsService,
    private readonly swaggerService: SwaggerService,
    private readonly mockDataService: MockDataService,
    private readonly cacheService: CacheService
  ) {}

  async handleRequest(
    service: string,
    path: string,
    method: string,
    body: any,
    query: any,
    headers: Record<string, string>,
    user: User
  ): Promise<MockResponse> {
    const startTime = Date.now();

    try {
      // Check if service exists
      const serviceConfig = await this.servicesService.getService(service);
      if (!serviceConfig) {
        throw new HttpException(
          `Service '${service}' not found`,
          HttpStatus.NOT_FOUND
        );
      }

      // Check cache first
      const cacheKey = this.generateCacheKey(
        service,
        path,
        method,
        query,
        body
      );
      const cachedResponse =
        await this.cacheService.getJson<MockResponse>(cacheKey);

      if (cachedResponse) {
        this.logger.log(`Cache hit for ${service}:${path}`);
        await this.analyticsService.logRequest({
          userId: user.userId,
          serviceName: service,
          endpoint: path,
          method,
          responseTime: Date.now() - startTime,
          status: cachedResponse.statusCode,
          cached: true,
        });
        return cachedResponse;
      }

      // Generate mock response
      const response = await this.generateIntelligentMockResponse(
        service,
        path,
        method,
        body,
        query,
        headers
      );

      // Cache the response
      await this.cacheService.setJson(cacheKey, response, 300); // 5 minutes cache

      // Log analytics
      await this.analyticsService.logRequest({
        userId: user.userId,
        serviceName: service,
        endpoint: path,
        method,
        responseTime: Date.now() - startTime,
        status: response.statusCode,
        cached: false,
      });

      return response;
    } catch (error) {
      this.logger.error(
        `Error handling request for ${service}:${path}:`,
        error
      );

      // Log error analytics
      await this.analyticsService.logRequest({
        userId: user.userId,
        serviceName: service,
        endpoint: path,
        method,
        responseTime: Date.now() - startTime,
        status: error.status || HttpStatus.INTERNAL_SERVER_ERROR,
        cached: false,
        error: error.message,
      });

      throw error;
    }
  }

  private async generateIntelligentMockResponse(
    service: string,
    path: string,
    method: string,
    body: any,
    query: any,
    headers: Record<string, string>
  ): Promise<MockResponse> {
    // Try to find a specific handler for this endpoint
    const handler = await this.servicesService.getHandler(
      service,
      path,
      method
    );

    if (handler) {
      return await handler.handle({ path, method, body, query, headers });
    }

    // Load service specification if not already loaded
    let spec = this.swaggerService.getServiceSpec(service);
    if (!spec) {
      spec = await this.swaggerService.loadServiceSpec(service);
    }

    if (spec) {
      // Parse the endpoint from the OpenAPI spec
      const endpoint = this.swaggerService.parseEndpoint(service, path, method);

      if (endpoint) {
        return await this.generateResponseFromSpec(
          endpoint,
          service,
          path,
          method,
          body,
          query
        );
      }
    }

    // Fallback to basic response
    return this.generateFallbackResponse(service, path, method);
  }

  private async generateResponseFromSpec(
    endpoint: any,
    service: string,
    path: string,
    method: string,
    body: any,
    query: any
  ): Promise<MockResponse> {
    // Determine the appropriate response status code
    const statusCode = this.getStatusCodeForMethod(method);

    // Get the response schema for this status code
    const responseSchema =
      endpoint.responses[statusCode.toString()]?.schema ||
      endpoint.responses['200']?.schema ||
      endpoint.responses['default']?.schema;

    if (responseSchema) {
      // Generate response data based on the schema
      const responseData = this.mockDataService.generateResponse(
        responseSchema,
        service,
        path
      );

      return {
        data: responseData,
        statusCode,
        headers: {
          'Content-Type': 'application/json',
          'X-OneMock-Service': service,
          'X-OneMock-Generated': 'swagger',
        },
      };
    }

    // Fallback if no schema found
    return this.generateFallbackResponse(service, path, method);
  }

  private generateFallbackResponse(
    service: string,
    path: string,
    method: string
  ): MockResponse {
    return {
      data: {
        id: this.mockDataService.generateId(),
        object: 'mock_object',
        created: this.mockDataService.generateTimestamp(),
        message: `Mock response for ${service} ${method} ${path}`,
      },
      statusCode: this.getStatusCodeForMethod(method),
      headers: {
        'Content-Type': 'application/json',
        'X-OneMock-Service': service,
        'X-OneMock-Generated': 'fallback',
      },
    };
  }

  private getStatusCodeForMethod(method: string): number {
    switch (method.toUpperCase()) {
      case 'GET':
        return 200;
      case 'POST':
        return 201;
      case 'PUT':
      case 'PATCH':
        return 200;
      case 'DELETE':
        return 200; // Stripe returns 200 for successful deletions
      default:
        return 200;
    }
  }

  private generateCacheKey(
    service: string,
    path: string,
    method: string,
    query: any,
    body: any
  ): string {
    const queryString =
      Object.keys(query).length > 0 ? JSON.stringify(query) : '';
    const bodyString = body ? JSON.stringify(body) : '';
    return `mock:${service}:${method}:${path}:${queryString}:${bodyString}`;
  }
}
