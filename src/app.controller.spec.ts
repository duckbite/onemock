import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';

describe('AppController', () => {
  let appController: AppController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [AppService],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('root', () => {
    it('should return health status', () => {
      const result = appController.getHealth();
      expect(result.status).toBe('healthy');
      expect(result.timestamp).toBeDefined();
      expect(result.version).toBeDefined();
    });

    it('should return detailed health status', () => {
      const result = appController.getDetailedHealth();
      expect(result.status).toBe('healthy');
      expect(result.services).toBeDefined();
      expect(result.services.database).toBe('connected');
      expect(result.services.cache).toBe('connected');
      expect(result.services.ai).toBe('available');
    });
  });
});
