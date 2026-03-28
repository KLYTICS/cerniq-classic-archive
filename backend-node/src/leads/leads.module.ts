import { Module } from '@nestjs/common';
import { LeadsController } from './leads.controller';
import { LeadsService } from './leads.service';
import { LeadQualificationService } from './lead-qualification.service';
import { EmailModule } from '../email/email.module';

@Module({
  imports: [EmailModule],
  controllers: [LeadsController],
  providers: [LeadsService, LeadQualificationService],
  exports: [LeadsService, LeadQualificationService],
})
export class LeadsModule {}
