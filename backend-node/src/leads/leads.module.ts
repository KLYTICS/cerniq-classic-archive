import { Module } from '@nestjs/common';
import { LeadsController } from './leads.controller';
import { LeadsService } from './leads.service';
import { LeadQualificationService } from './lead-qualification.service';
import { LeadScoringService } from './lead-scoring.service';
import { OutreachExecutionService } from './outreach-execution.service';
import { EmailModule } from '../email/email.module';

@Module({
  imports: [EmailModule],
  controllers: [LeadsController],
  providers: [LeadsService, LeadQualificationService, LeadScoringService, OutreachExecutionService],
  exports: [LeadsService, LeadQualificationService, LeadScoringService, OutreachExecutionService],
})
export class LeadsModule {}
