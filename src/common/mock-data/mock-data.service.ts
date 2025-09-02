import { Injectable } from '@nestjs/common';
import { faker } from '@faker-js/faker';

@Injectable()
export class MockDataService {
  private readonly generators: Map<string, (schema: any, context?: any) => any> = new Map();

  constructor() {
    this.initializeGenerators();
  }

  private initializeGenerators(): void {
    // String generators
    this.generators.set('string', (schema: any) => {
      if (schema.format === 'email') return faker.internet.email();
      if (schema.format === 'uri') return faker.internet.url();
      if (schema.format === 'date') return faker.date.past().toISOString().split('T')[0];
      if (schema.format === 'date-time') return faker.date.past().toISOString();
      if (schema.format === 'uuid') return faker.string.uuid();
      if (schema.enum) return faker.helpers.arrayElement(schema.enum);
      if (schema.pattern === '^[a-zA-Z0-9_]+$') return faker.string.alphanumeric(10);
      return faker.lorem.words(3);
    });

    // Number generators
    this.generators.set('number', (schema: any) => {
      const min = schema.minimum || 0;
      const max = schema.maximum || 1000;
      return faker.number.int({ min, max });
    });

    this.generators.set('integer', (schema: any) => {
      const min = schema.minimum || 0;
      const max = schema.maximum || 1000;
      return faker.number.int({ min, max });
    });

    // Boolean generator
    this.generators.set('boolean', () => faker.datatype.boolean());

    // Array generator
    this.generators.set('array', (schema: any) => {
      const minItems = schema.minItems || 1;
      const maxItems = schema.maxItems || 5;
      const count = faker.number.int({ min: minItems, max: maxItems });
      
      const items = [];
      for (let i = 0; i < count; i++) {
        items.push(this.generateValue(schema.items));
      }
      return items;
    });

    // Object generator
    this.generators.set('object', (schema: any) => {
      const obj: any = {};
      
      if (schema.properties) {
        for (const [key, propSchema] of Object.entries(schema.properties)) {
          const prop = propSchema as any;
          const required = schema.required?.includes(key) || false;
          
          if (required || faker.datatype.boolean()) {
            obj[key] = this.generateValue(prop);
          }
        }
      }
      
      return obj;
    });
  }

  generateValue(schema: any, context?: any): any {
    if (!schema) return null;

    // Handle null values
    if (schema.nullable && faker.datatype.boolean()) {
      return null;
    }

    // Handle oneOf/anyOf
    if (schema.oneOf) {
      const selectedSchema = faker.helpers.arrayElement(schema.oneOf);
      return this.generateValue(selectedSchema, context);
    }

    if (schema.anyOf) {
      const selectedSchema = faker.helpers.arrayElement(schema.anyOf);
      return this.generateValue(selectedSchema, context);
    }

    // Handle allOf (merge schemas)
    if (schema.allOf) {
      const mergedSchema = schema.allOf.reduce((acc: any, s: any) => ({
        ...acc,
        ...s,
        properties: { ...acc.properties, ...s.properties },
      }), {});
      return this.generateValue(mergedSchema, context);
    }

    // Handle specific service patterns
    if (context?.service) {
      const serviceGenerator = this.getServiceSpecificGenerator(context.service, schema);
      if (serviceGenerator) {
        return serviceGenerator(schema, context);
      }
    }

    // Use type-based generator
    const generator = this.generators.get(schema.type);
    if (generator) {
      return generator(schema, context);
    }

    // Fallback
    return this.getFallbackValue(schema);
  }

  private getServiceSpecificGenerator(service: string, schema: any): ((schema: any, context?: any) => any) | null {
    switch (service) {
      case 'stripe':
        return this.getStripeGenerator(schema);
      case 'shopify':
        return this.getShopifyGenerator(schema);
      case 'github':
        return this.getGitHubGenerator(schema);
      default:
        return null;
    }
  }

  private getStripeGenerator(schema: any): ((schema: any, context?: any) => any) | null {
    // Stripe-specific ID patterns
    if (schema.pattern === '^ch_[a-zA-Z0-9]+$') {
      return () => `ch_${faker.string.alphanumeric(24)}`;
    }
    if (schema.pattern === '^cus_[a-zA-Z0-9]+$') {
      return () => `cus_${faker.string.alphanumeric(24)}`;
    }
    if (schema.pattern === '^prod_[a-zA-Z0-9]+$') {
      return () => `prod_${faker.string.alphanumeric(24)}`;
    }
    if (schema.pattern === '^pi_[a-zA-Z0-9]+$') {
      return () => `pi_${faker.string.alphanumeric(24)}`;
    }
    if (schema.pattern === '^pm_[a-zA-Z0-9]+$') {
      return () => `pm_${faker.string.alphanumeric(24)}`;
    }

    // Stripe-specific enums
    if (schema.enum?.includes('succeeded')) {
      return () => faker.helpers.arrayElement(['succeeded', 'pending', 'failed']);
    }
    if (schema.enum?.includes('usd')) {
      return () => faker.helpers.arrayElement(['usd', 'eur', 'gbp', 'jpy']);
    }

    return null;
  }

  private getShopifyGenerator(schema: any): ((schema: any, context?: any) => any) | null {
    // Shopify-specific patterns
    if (schema.pattern === '^[0-9]+$' && schema.description?.includes('product')) {
      return () => faker.number.int({ min: 1000000, max: 9999999 });
    }

    return null;
  }

  private getGitHubGenerator(schema: any): ((schema: any, context?: any) => any) | null {
    // GitHub-specific patterns
    if (schema.pattern === '^[a-zA-Z0-9._-]+$' && schema.description?.includes('username')) {
      return () => faker.internet.userName();
    }

    return null;
  }

  private getFallbackValue(schema: any): any {
    switch (schema.type) {
      case 'string':
        return faker.lorem.word();
      case 'number':
      case 'integer':
        return faker.number.int({ min: 0, max: 100 });
      case 'boolean':
        return faker.datatype.boolean();
      case 'array':
        return [];
      case 'object':
        return {};
      default:
        return null;
    }
  }

  generateResponse(schema: any, service: string, endpoint: string): any {
    const context = { service, endpoint };
    return this.generateValue(schema, context);
  }

  // Helper method to generate realistic timestamps
  generateTimestamp(): number {
    return Math.floor(Date.now() / 1000);
  }

  // Helper method to generate realistic IDs
  generateId(prefix?: string): string {
    if (prefix) {
      return `${prefix}_${faker.string.alphanumeric(24)}`;
    }
    return faker.string.alphanumeric(24);
  }
}
