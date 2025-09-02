import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { CacheService } from './cache.service';

@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: CacheService,
      useFactory: (configService: ConfigService) => {
        return new CacheService(configService);
      },
      inject: [ConfigService],
    },
  ],
  exports: [CacheService],
})
export class CacheModule {}
