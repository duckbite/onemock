import { Controller, Get, Query, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { AnalyticsService, AnalyticsSummary } from './analytics.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('Analytics')
@Controller('analytics')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('summary')
  @ApiOperation({ summary: 'Get analytics summary' })
  @ApiResponse({ status: 200, description: 'Analytics summary retrieved successfully' })
  async getAnalyticsSummary(
    @Query('start') start?: string,
    @Query('end') end?: string,
  ): Promise<AnalyticsSummary> {
    const timeRange = start && end ? { start, end } : undefined;
    return this.analyticsService.getAnalyticsSummary(undefined, timeRange);
  }

  @Get('user/summary')
  @ApiOperation({ summary: 'Get user analytics summary' })
  @ApiResponse({ status: 200, description: 'User analytics summary retrieved successfully' })
  async getUserAnalyticsSummary(
    @Request() req,
    @Query('start') start?: string,
    @Query('end') end?: string,
  ): Promise<AnalyticsSummary> {
    const timeRange = start && end ? { start, end } : undefined;
    return this.analyticsService.getAnalyticsSummary(req.user.userId, timeRange);
  }

  @Get('user/history')
  @ApiOperation({ summary: 'Get user request history' })
  @ApiResponse({ status: 200, description: 'Request history retrieved successfully' })
  async getUserRequestHistory(
    @Request() req,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    const limitNum = limit ? parseInt(limit, 10) : 100;
    const offsetNum = offset ? parseInt(offset, 10) : 0;
    
    return this.analyticsService.getRequestHistory(
      req.user.userId,
      limitNum,
      offsetNum,
    );
  }

  @Get('services/:serviceName')
  @ApiOperation({ summary: 'Get service-specific analytics' })
  @ApiResponse({ status: 200, description: 'Service analytics retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Service not found' })
  async getServiceAnalytics(@Request() req, @Query('serviceName') serviceName: string) {
    return this.analyticsService.getServiceAnalytics(serviceName);
  }
}
