import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from './../src/app.module';

describe('AppController (e2e)', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  it('/ (GET)', () => {
    return request(app.getHttpServer())
      .get('/')
      .expect(200)
      .expect((res) => {
        expect(res.body.status).toBe('healthy');
        expect(res.body.timestamp).toBeDefined();
        expect(res.body.version).toBeDefined();
      });
  });

  it('/health (GET)', () => {
    return request(app.getHttpServer())
      .get('/health')
      .expect(200)
      .expect((res) => {
        expect(res.body.status).toBe('healthy');
        expect(res.body.services).toBeDefined();
        expect(res.body.services.database).toBe('connected');
        expect(res.body.services.cache).toBe('connected');
        expect(res.body.services.ai).toBe('available');
      });
  });

  afterAll(async () => {
    await app.close();
  });
});
