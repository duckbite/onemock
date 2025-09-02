import { Controller, Get, Post, Put, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { ServicesService, ServiceConfig } from './services.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

export class CreateServiceDto {
  serviceName: string;
  version: string;
  schema: any;
  configuration: any;
  status?: 'active' | 'inactive' | 'maintenance';
}

export class UpdateServiceDto {
  version?: string;
  schema?: any;
  configuration?: any;
  status?: 'active' | 'inactive' | 'maintenance';
}

@ApiTags('Services')
@Controller('services')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ServicesController {
  constructor(private readonly servicesService: ServicesService) {}

  @Get()
  @ApiOperation({ summary: 'Get all available services' })
  @ApiResponse({ status: 200, description: 'List of services retrieved successfully' })
  async getAllServices(): Promise<ServiceConfig[]> {
    return this.servicesService.getAllServices();
  }

  @Get(':serviceName')
  @ApiOperation({ summary: 'Get service configuration' })
  @ApiResponse({ status: 200, description: 'Service configuration retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Service not found' })
  async getService(@Param('serviceName') serviceName: string): Promise<ServiceConfig | null> {
    return this.servicesService.getService(serviceName);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new service' })
  @ApiResponse({ status: 201, description: 'Service created successfully' })
  async createService(@Body() createServiceDto: CreateServiceDto): Promise<ServiceConfig> {
    return this.servicesService.createService({
      ...createServiceDto,
      status: createServiceDto.status || 'active',
    });
  }

  @Put(':serviceId')
  @ApiOperation({ summary: 'Update service configuration' })
  @ApiResponse({ status: 200, description: 'Service updated successfully' })
  @ApiResponse({ status: 404, description: 'Service not found' })
  async updateService(
    @Param('serviceId') serviceId: string,
    @Body() updateServiceDto: UpdateServiceDto,
  ): Promise<ServiceConfig | null> {
    return this.servicesService.updateService(serviceId, updateServiceDto);
  }
}
