import { Module } from '@nestjs/common';
import { BillingController } from './billing.controller';
import { BillingService } from './billing.service';
import { PrismaService } from '../prisma.service';
import { EmailModule } from '../email/email.module';

@Module({
  imports: [EmailModule],
  controllers: [BillingController],
  providers: [BillingService, PrismaService],
  exports: [BillingService],
})
export class BillingModule {}
