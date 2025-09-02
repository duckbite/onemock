import { Module } from '@nestjs/common';
import { ServicesService } from './services.service';
import { ServicesController } from './services.controller';
import { DatabaseModule } from '../../common/database/database.module';
import { CacheModule } from '../../common/cache/cache.module';
import { SwaggerModule } from '../../common/swagger/swagger.module';
import { StripeModule } from '../../services/stripe/stripe.module';

@Module({
  imports: [DatabaseModule, CacheModule, SwaggerModule, StripeModule],
  controllers: [ServicesController],
  providers: [ServicesService],
  exports: [ServicesService],
})
export class ServicesModule {}
