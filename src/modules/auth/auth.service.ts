import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { DatabaseService } from '../../common/database/database.service';
import { v4 as uuidv4 } from 'uuid';

export interface User {
  userId: string;
  email: string;
  apiKey: string;
  planType: 'free' | 'pro' | 'enterprise';
  usageQuota: number;
  currentUsage: number;
  createdAt: string;
}

export interface AuthResult {
  user: User;
  token: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly databaseService: DatabaseService,
  ) {}

  async validateApiKey(apiKey: string): Promise<User | null> {
    try {
      const user = await this.databaseService.get('Users', { apiKey });
      return user;
    } catch (error) {
      return null;
    }
  }

  async createUser(email: string, planType: 'free' | 'pro' | 'enterprise' = 'free'): Promise<AuthResult> {
    const userId = uuidv4();
    const apiKey = this.generateApiKey();
    
    const user: User = {
      userId,
      email,
      apiKey,
      planType,
      usageQuota: this.getUsageQuota(planType),
      currentUsage: 0,
      createdAt: new Date().toISOString(),
    };

    await this.databaseService.put('Users', user);

    const token = this.jwtService.sign({ userId, email });

    return { user, token };
  }

  async getUserById(userId: string): Promise<User | null> {
    try {
      const user = await this.databaseService.get('Users', { userId });
      return user;
    } catch (error) {
      return null;
    }
  }

  async updateUsage(userId: string, increment: number = 1): Promise<void> {
    try {
      await this.databaseService.update(
        'Users',
        { userId },
        'SET currentUsage = currentUsage + :increment',
        { ':increment': increment },
      );
    } catch (error) {
      // Log error but don't throw to avoid breaking the main flow
      console.error('Error updating usage:', error);
    }
  }

  async checkUsageLimit(user: User): Promise<boolean> {
    return user.currentUsage < user.usageQuota;
  }

  async resetUsage(userId: string): Promise<void> {
    try {
      await this.databaseService.update(
        'Users',
        { userId },
        'SET currentUsage = :zero',
        { ':zero': 0 },
      );
    } catch (error) {
      console.error('Error resetting usage:', error);
    }
  }

  private generateApiKey(): string {
    const prefix = 'mk_';
    const randomPart = uuidv4().replace(/-/g, '');
    return prefix + randomPart;
  }

  private getUsageQuota(planType: string): number {
    const quotas = {
      free: 1000,
      pro: 10000,
      enterprise: 100000,
    };
    return quotas[planType] || quotas.free;
  }

  async validateUser(payload: any): Promise<User> {
    const user = await this.getUserById(payload.userId);
    if (!user) {
      throw new UnauthorizedException('User not found');
    }
    return user;
  }
}
