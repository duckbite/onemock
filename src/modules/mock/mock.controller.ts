import {
  Controller,
  All,
  Req,
  Res,
  Param,
  UseGuards,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { MockService } from './mock.service';
import { ApiKeyGuard } from '../auth/guards/api-key.guard';

@ApiTags('Mock API')
@Controller()
@UseGuards(ApiKeyGuard)
@ApiBearerAuth()
export class MockController {
  private readonly logger = new Logger(MockController.name);

  constructor(private readonly mockService: MockService) {}

  @All(':service/*')
  @ApiOperation({ summary: 'Mock any service endpoint' })
  @ApiResponse({ status: 200, description: 'Mock response generated' })
  @ApiResponse({ status: 404, description: 'Service not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async handleMockRequest(
    @Param('service') service: string,
    @Req() req: Request,
    @Res() res: Response
  ) {
    try {
      this.logger.log(
        `Mocking request for service: ${service}, path: ${req.path}`
      );

      const result = await this.mockService.handleRequest(
        service,
        req.path.replace(`/${service}`, ''),
        req.method,
        req.body,
        req.query,
        req.headers as Record<string, string>,
        req.user as any
      );

      // Set response headers
      if (result.headers) {
        Object.entries(result.headers).forEach(([key, value]) => {
          res.setHeader(key, value as string);
        });
      }

      // Set status code
      res.status(result.statusCode || 200);

      // Send response
      res.json(result.data);
    } catch (error) {
      this.logger.error(`Error mocking service ${service}:`, error);

      if (error instanceof HttpException) {
        res.status(error.getStatus()).json({
          error: error.message,
          statusCode: error.getStatus(),
        });
      } else {
        res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
          error: 'Internal server error',
          statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        });
      }
    }
  }

  @All(':service')
  @ApiOperation({ summary: 'Mock service root endpoint' })
  @ApiResponse({ status: 200, description: 'Mock response generated' })
  async mockServiceRoot(
    @Param('service') service: string,
    @Req() req: Request,
    @Res() res: Response
  ) {
    return this.handleMockRequest(service, req, res);
  }
}
