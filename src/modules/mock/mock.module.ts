import { Module } from '@nestjs/common';
import { MockController } from './mock.controller';
import { MockService } from './mock.service';
import { ServicesModule } from '../services/services.module';
import { AuthModule } from '../auth/auth.module';
import { AnalyticsModule } from '../analytics/analytics.module';
import { SwaggerModule } from '../../common/swagger/swagger.module';
import { MockDataModule } from '../../common/mock-data/mock-data.module';
import { CacheModule } from '../../common/cache/cache.module';

@Module({
  imports: [ServicesModule, AuthModule, AnalyticsModule, SwaggerModule, MockDataModule, CacheModule],
  controllers: [MockController],
  providers: [MockService],
  exports: [MockService],
})
export class MockModule {}
