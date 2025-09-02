import { Module } from '@nestjs/common';
import { SwaggerService } from './swagger.service';
import { CacheModule } from '../cache/cache.module';

@Module({
  imports: [CacheModule],
  providers: [SwaggerService],
  exports: [SwaggerService],
})
export class SwaggerModule {}
