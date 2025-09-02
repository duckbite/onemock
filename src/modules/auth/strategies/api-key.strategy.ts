import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-local';
import { Request } from 'express';
import { AuthService } from '../auth.service';

@Injectable()
export class ApiKeyStrategy extends PassportStrategy(Strategy, 'api-key') {
  constructor(private readonly authService: AuthService) {
    super();
  }

  async validate(
    req: Request,
    username?: string,
    password?: string
  ): Promise<any> {
    const apiKey = req.headers['x-api-key'] as string;

    if (!apiKey) {
      throw new UnauthorizedException('API key is required');
    }

    const user = await this.authService.validateApiKey(apiKey);
    if (!user) {
      throw new UnauthorizedException('Invalid API key');
    }

    // Check usage limits
    const withinLimit = await this.authService.checkUsageLimit(user);
    if (!withinLimit) {
      throw new UnauthorizedException('Usage limit exceeded');
    }

    // Update usage
    await this.authService.updateUsage(user.userId);

    return user;
  }
}
