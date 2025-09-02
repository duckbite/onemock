import { Controller, Post, Body, Get, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { AuthService, User } from './auth.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

export class CreateUserDto {
  email: string;
  planType?: 'free' | 'pro' | 'enterprise';
}

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @ApiOperation({ summary: 'Register a new user' })
  @ApiResponse({ status: 201, description: 'User created successfully' })
  async register(@Body() createUserDto: CreateUserDto) {
    const { user, token } = await this.authService.createUser(
      createUserDto.email,
      createUserDto.planType || 'free',
    );

    return {
      user: {
        userId: user.userId,
        email: user.email,
        planType: user.planType,
        usageQuota: user.usageQuota,
        currentUsage: user.currentUsage,
        createdAt: user.createdAt,
      },
      token,
      apiKey: user.apiKey,
    };
  }

  @Get('profile')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get user profile' })
  @ApiResponse({ status: 200, description: 'User profile retrieved successfully' })
  async getProfile(@Request() req) {
    const user = await this.authService.getUserById(req.user.userId);
    
    return {
      userId: user.userId,
      email: user.email,
      planType: user.planType,
      usageQuota: user.usageQuota,
      currentUsage: user.currentUsage,
      createdAt: user.createdAt,
    };
  }

  @Post('reset-usage')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Reset usage counter' })
  @ApiResponse({ status: 200, description: 'Usage reset successfully' })
  async resetUsage(@Request() req) {
    await this.authService.resetUsage(req.user.userId);
    return { message: 'Usage reset successfully' };
  }
}
