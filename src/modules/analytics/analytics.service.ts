import { Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from '../../common/database/database.service';
import { CacheService } from '../../common/cache/cache.service';
import { v4 as uuidv4 } from 'uuid';

export interface RequestLog {
  requestId: string;
  userId: string;
  serviceName: string;
  endpoint: string;
  method: string;
  responseTime: number;
  status: number;
  cached: boolean;
  error?: string;
  timestamp: string;
}

export interface AnalyticsSummary {
  totalRequests: number;
  averageResponseTime: number;
  successRate: number;
  topServices: Array<{ serviceName: string; count: number }>;
  topEndpoints: Array<{ endpoint: string; count: number }>;
  cacheHitRate: number;
}

@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);

  constructor(
    private readonly databaseService: DatabaseService,
    private readonly cacheService: CacheService,
  ) {}

  async logRequest(requestData: {
    userId: string;
    serviceName: string;
    endpoint: string;
    method: string;
    responseTime: number;
    status: number;
    cached: boolean;
    error?: string;
  }): Promise<void> {
    try {
      const requestLog: RequestLog = {
        requestId: uuidv4(),
        ...requestData,
        timestamp: new Date().toISOString(),
      };

      // Store in database
      await this.databaseService.put('Requests', requestLog);

      // Update real-time counters in cache
      await this.updateRealTimeCounters(requestData);

      this.logger.debug(`Logged request: ${requestLog.requestId}`);
    } catch (error) {
      this.logger.error('Error logging request:', error);
    }
  }

  async getRequestHistory(
    userId: string,
    limit: number = 100,
    offset: number = 0,
  ): Promise<RequestLog[]> {
    try {
      const requests = await this.databaseService.query(
        'Requests',
        'userId = :userId',
        { ':userId': userId },
        'userId-timestamp-index', // Assuming GSI exists
      );

      return requests
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        .slice(offset, offset + limit);
    } catch (error) {
      this.logger.error('Error getting request history:', error);
      return [];
    }
  }

  async getAnalyticsSummary(
    userId?: string,
    timeRange?: { start: string; end: string },
  ): Promise<AnalyticsSummary> {
    try {
      let requests: RequestLog[];

      if (userId) {
        requests = await this.databaseService.query(
          'Requests',
          'userId = :userId',
          { ':userId': userId },
        );
      } else {
        requests = await this.databaseService.scan('Requests');
      }

      // Filter by time range if provided
      if (timeRange) {
        requests = requests.filter(
          req => req.timestamp >= timeRange.start && req.timestamp <= timeRange.end,
        );
      }

      const totalRequests = requests.length;
      const successfulRequests = requests.filter(req => req.status < 400).length;
      const cachedRequests = requests.filter(req => req.cached).length;

      const averageResponseTime = totalRequests > 0
        ? requests.reduce((sum, req) => sum + req.responseTime, 0) / totalRequests
        : 0;

      const successRate = totalRequests > 0 ? (successfulRequests / totalRequests) * 100 : 0;
      const cacheHitRate = totalRequests > 0 ? (cachedRequests / totalRequests) * 100 : 0;

      // Calculate top services
      const serviceCounts = requests.reduce((acc, req) => {
        acc[req.serviceName] = (acc[req.serviceName] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      const topServices = Object.entries(serviceCounts)
        .map(([serviceName, count]) => ({ serviceName, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

      // Calculate top endpoints
      const endpointCounts = requests.reduce((acc, req) => {
        const key = `${req.serviceName}:${req.endpoint}`;
        acc[key] = (acc[key] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      const topEndpoints = Object.entries(endpointCounts)
        .map(([endpoint, count]) => ({ endpoint, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

      return {
        totalRequests,
        averageResponseTime: Math.round(averageResponseTime * 100) / 100,
        successRate: Math.round(successRate * 100) / 100,
        topServices,
        topEndpoints,
        cacheHitRate: Math.round(cacheHitRate * 100) / 100,
      };
    } catch (error) {
      this.logger.error('Error getting analytics summary:', error);
      return {
        totalRequests: 0,
        averageResponseTime: 0,
        successRate: 0,
        topServices: [],
        topEndpoints: [],
        cacheHitRate: 0,
      };
    }
  }

  async getServiceAnalytics(serviceName: string): Promise<any> {
    try {
      const requests = await this.databaseService.query(
        'Requests',
        'serviceName = :serviceName',
        { ':serviceName': serviceName },
      );

      const totalRequests = requests.length;
      const averageResponseTime = totalRequests > 0
        ? requests.reduce((sum, req) => sum + req.responseTime, 0) / totalRequests
        : 0;

      const statusCounts = requests.reduce((acc, req) => {
        const statusGroup = Math.floor(req.status / 100) * 100;
        acc[statusGroup] = (acc[statusGroup] || 0) + 1;
        return acc;
      }, {} as Record<number, number>);

      return {
        serviceName,
        totalRequests,
        averageResponseTime: Math.round(averageResponseTime * 100) / 100,
        statusDistribution: statusCounts,
        requests: requests.slice(0, 50), // Last 50 requests
      };
    } catch (error) {
      this.logger.error(`Error getting analytics for service ${serviceName}:`, error);
      return null;
    }
  }

  private async updateRealTimeCounters(requestData: {
    userId: string;
    serviceName: string;
    endpoint: string;
    status: number;
    cached: boolean;
  }): Promise<void> {
    try {
      const today = new Date().toISOString().split('T')[0];
      
      // Update daily counters
      await this.cacheService.increment(`stats:daily:${today}:total`);
      await this.cacheService.increment(`stats:daily:${today}:${requestData.serviceName}`);
      
      if (requestData.cached) {
        await this.cacheService.increment(`stats:daily:${today}:cached`);
      }
      
      if (requestData.status < 400) {
        await this.cacheService.increment(`stats:daily:${today}:success`);
      }

      // Update user-specific counters
      await this.cacheService.increment(`stats:user:${requestData.userId}:${today}:total`);
    } catch (error) {
      this.logger.error('Error updating real-time counters:', error);
    }
  }
}
