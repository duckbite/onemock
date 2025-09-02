import { Module } from '@nestjs/common';
import { StripeHandler } from './stripe.handler';
import { MockDataModule } from '../../common/mock-data/mock-data.module';

@Module({
  imports: [MockDataModule],
  providers: [StripeHandler],
  exports: [StripeHandler],
})
export class StripeModule {}
