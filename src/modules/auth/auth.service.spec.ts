import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import { DatabaseService } from '../../common/database/database.service';

describe('AuthService', () => {
  let service: AuthService;
  let databaseService: DatabaseService;

  const mockDatabaseService = {
    get: jest.fn(),
    put: jest.fn(),
    update: jest.fn(),
  };

  const mockJwtService = {
    sign: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: DatabaseService,
          useValue: mockDatabaseService,
        },
        {
          provide: JwtService,
          useValue: mockJwtService,
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    databaseService = module.get<DatabaseService>(DatabaseService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createUser', () => {
    it('should create a new user with free plan', async () => {
      const email = 'test@example.com';
      const planType = 'free';
      
      mockJwtService.sign.mockReturnValue('mock-jwt-token');
      mockDatabaseService.put.mockResolvedValue(undefined);

      const result = await service.createUser(email, planType);

      expect(result.user.email).toBe(email);
      expect(result.user.planType).toBe(planType);
      expect(result.user.usageQuota).toBe(1000); // Free plan quota
      expect(result.user.apiKey).toMatch(/^mk_/);
      expect(result.token).toBe('mock-jwt-token');
      expect(mockDatabaseService.put).toHaveBeenCalled();
    });

    it('should create a user with pro plan', async () => {
      const email = 'test@example.com';
      const planType = 'pro';
      
      mockJwtService.sign.mockReturnValue('mock-jwt-token');
      mockDatabaseService.put.mockResolvedValue(undefined);

      const result = await service.createUser(email, planType);

      expect(result.user.planType).toBe(planType);
      expect(result.user.usageQuota).toBe(10000); // Pro plan quota
    });
  });

  describe('validateApiKey', () => {
    it('should return user for valid API key', async () => {
      const apiKey = 'mk_valid_key';
      const mockUser = {
        userId: 'user123',
        email: 'test@example.com',
        apiKey,
        planType: 'free',
        usageQuota: 1000,
        currentUsage: 0,
        createdAt: new Date().toISOString(),
      };

      mockDatabaseService.get.mockResolvedValue(mockUser);

      const result = await service.validateApiKey(apiKey);

      expect(result).toEqual(mockUser);
      expect(mockDatabaseService.get).toHaveBeenCalledWith('Users', { apiKey });
    });

    it('should return null for invalid API key', async () => {
      const apiKey = 'mk_invalid_key';
      
      mockDatabaseService.get.mockResolvedValue(null);

      const result = await service.validateApiKey(apiKey);

      expect(result).toBeNull();
    });
  });

  describe('checkUsageLimit', () => {
    it('should return true when usage is within limit', () => {
      const user = {
        userId: 'user123',
        email: 'test@example.com',
        apiKey: 'mk_test',
        planType: 'free',
        usageQuota: 1000,
        currentUsage: 500,
        createdAt: new Date().toISOString(),
      };

      const result = service.checkUsageLimit(user);
      expect(result).toBe(true);
    });

    it('should return false when usage exceeds limit', () => {
      const user = {
        userId: 'user123',
        email: 'test@example.com',
        apiKey: 'mk_test',
        planType: 'free',
        usageQuota: 1000,
        currentUsage: 1000,
        createdAt: new Date().toISOString(),
      };

      const result = service.checkUsageLimit(user);
      expect(result).toBe(false);
    });
  });
});
