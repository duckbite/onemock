import { Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from '../../common/database/database.service';
import { CacheService } from '../../common/cache/cache.service';
import { SwaggerService } from '../../common/swagger/swagger.service';
import { StripeHandler } from '../../services/stripe/stripe.handler';

export interface ServiceConfig {
  serviceId: string;
  serviceName: string;
  version: string;
  schema: any;
  configuration: any;
  status: 'active' | 'inactive' | 'maintenance';
  createdAt: string;
  updatedAt: string;
}

export interface MockHandler {
  handle(request: {
    path: string;
    method: string;
    body: any;
    query: any;
    headers: Record<string, string>;
  }): Promise<{
    data: any;
    statusCode: number;
    headers?: Record<string, string>;
  }>;
}

@Injectable()
export class ServicesService {
  private readonly logger = new Logger(ServicesService.name);
  private handlers: Map<string, MockHandler> = new Map();

  constructor(
    private readonly databaseService: DatabaseService,
    private readonly cacheService: CacheService,
    private readonly swaggerService: SwaggerService,
    private readonly stripeHandler: StripeHandler,
  ) {
    this.initializeDefaultServices();
  }

  async getService(serviceName: string): Promise<ServiceConfig | null> {
    try {
      // Check cache first
      const cacheKey = `service:${serviceName}`;
      const cached = await this.cacheService.getJson<ServiceConfig>(cacheKey);
      if (cached) {
        return cached;
      }

      // Query database
      const services = await this.databaseService.query(
        'Services',
        'serviceName = :serviceName',
        { ':serviceName': serviceName },
      );

      if (services.length === 0) {
        return null;
      }

      const service = services[0];
      
      // Cache the result
      await this.cacheService.setJson(cacheKey, service, 3600); // 1 hour cache

      return service;
    } catch (error) {
      this.logger.error(`Error getting service ${serviceName}:`, error);
      return null;
    }
  }

  async getAllServices(): Promise<ServiceConfig[]> {
    try {
      const services = await this.databaseService.scan('Services');
      return services.filter(service => service.status === 'active');
    } catch (error) {
      this.logger.error('Error getting all services:', error);
      return [];
    }
  }

  async createService(serviceConfig: Omit<ServiceConfig, 'serviceId' | 'createdAt' | 'updatedAt'>): Promise<ServiceConfig> {
    const serviceId = `srv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date().toISOString();

    const service: ServiceConfig = {
      ...serviceConfig,
      serviceId,
      createdAt: now,
      updatedAt: now,
    };

    await this.databaseService.put('Services', service);
    
    // Clear cache
    await this.cacheService.del(`service:${serviceConfig.serviceName}`);

    return service;
  }

  async updateService(serviceId: string, updates: Partial<ServiceConfig>): Promise<ServiceConfig | null> {
    try {
      const service = await this.databaseService.get('Services', { serviceId });
      if (!service) {
        return null;
      }

      const updatedService = {
        ...service,
        ...updates,
        updatedAt: new Date().toISOString(),
      };

      await this.databaseService.put('Services', updatedService);
      
      // Clear cache
      await this.cacheService.del(`service:${service.serviceName}`);

      return updatedService;
    } catch (error) {
      this.logger.error(`Error updating service ${serviceId}:`, error);
      return null;
    }
  }

  async getHandler(serviceName: string, path: string, method: string): Promise<MockHandler | null> {
    const handlerKey = `${serviceName}:${method}:${path}`;
    return this.handlers.get(handlerKey) || null;
  }

  registerHandler(serviceName: string, path: string, method: string, handler: MockHandler): void {
    const handlerKey = `${serviceName}:${method}:${path}`;
    this.handlers.set(handlerKey, handler);
    this.logger.log(`Registered handler for ${handlerKey}`);
  }

  private async initializeDefaultServices(): Promise<void> {
    // Initialize Stripe service
    await this.initializeStripeService();
    
    // Register service handlers
    this.registerServiceHandlers();
    
    // Load Swagger specifications for all services
    await this.loadServiceSpecifications();
    
    // Initialize other services as needed
    this.logger.log('Default services initialized');
  }

  private registerServiceHandlers(): void {
    // Register Stripe handlers
    this.registerHandler('stripe', '/charges', 'GET', this.stripeHandler);
    this.registerHandler('stripe', '/charges', 'POST', this.stripeHandler);
    this.registerHandler('stripe', '/charges/{id}', 'GET', this.stripeHandler);
    this.registerHandler('stripe', '/charges/{id}', 'POST', this.stripeHandler);
    this.registerHandler('stripe', '/customers', 'GET', this.stripeHandler);
    this.registerHandler('stripe', '/customers', 'POST', this.stripeHandler);
    this.registerHandler('stripe', '/customers/{id}', 'GET', this.stripeHandler);
    this.registerHandler('stripe', '/customers/{id}', 'POST', this.stripeHandler);
    this.registerHandler('stripe', '/customers/{id}', 'DELETE', this.stripeHandler);
    this.registerHandler('stripe', '/products', 'GET', this.stripeHandler);
    this.registerHandler('stripe', '/products', 'POST', this.stripeHandler);
    this.registerHandler('stripe', '/products/{id}', 'GET', this.stripeHandler);
    this.registerHandler('stripe', '/products/{id}', 'POST', this.stripeHandler);
  }

  private async loadServiceSpecifications(): Promise<void> {
    try {
      // Load Stripe specification
      await this.swaggerService.loadServiceSpec('stripe');
      this.logger.log('Loaded Stripe OpenAPI specification');
      
      // Add more services as they become available
      // await this.swaggerService.loadServiceSpec('shopify');
      // await this.swaggerService.loadServiceSpec('github');
    } catch (error) {
      this.logger.error('Error loading service specifications:', error);
    }
  }

  private async initializeStripeService(): Promise<void> {
    const existingService = await this.getService('stripe');
    if (existingService) {
      return;
    }

    const stripeService: Omit<ServiceConfig, 'serviceId' | 'createdAt' | 'updatedAt'> = {
      serviceName: 'stripe',
      version: '2020-08-27',
      schema: {
        baseUrl: 'https://api.stripe.com/v1',
        endpoints: {
          '/charges': {
            methods: ['GET', 'POST'],
            description: 'List or create charges',
          },
          '/charges/{id}': {
            methods: ['GET', 'POST'],
            description: 'Retrieve or update a charge',
          },
          '/customers': {
            methods: ['GET', 'POST'],
            description: 'List or create customers',
          },
          '/customers/{id}': {
            methods: ['GET', 'POST', 'DELETE'],
            description: 'Retrieve, update, or delete a customer',
          },
        },
      },
      configuration: {
        apiVersion: '2020-08-27',
        supportedMethods: ['GET', 'POST', 'PUT', 'DELETE'],
        rateLimit: 100,
      },
      status: 'active',
    };

    await this.createService(stripeService);
    this.logger.log('Stripe service initialized');
  }
}
