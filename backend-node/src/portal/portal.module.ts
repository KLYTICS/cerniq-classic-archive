import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PortalController } from './portal.controller';
import { AlmModule } from '../alm/alm.module';
import { EmailModule } from '../email/email.module';
import { BillingModule } from '../billing/billing.module';
import { PipelineModule } from '../pipeline/pipeline.module';

@Module({
  imports: [
    JwtModule.register({
      secret: process.env.JWT_SECRET,
      signOptions: { expiresIn: '24h' },
    }),
    AlmModule,
    EmailModule,
    BillingModule,
    PipelineModule,
  ],
  controllers: [PortalController],
})
export class PortalModule {}
