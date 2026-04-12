import { Module, forwardRef } from '@nestjs/common';
import { LeadsController } from './leads.controller';
import { LeadsService } from './leads.service';
import { LeadQualificationService } from './lead-qualification.service';
import { LeadScoringService } from './lead-scoring.service';
import { OutreachExecutionService } from './outreach-execution.service';
import { EmailModule } from '../email/email.module';
import { AlmModule } from '../alm/alm.module';
import { PortalModule } from '../portal/portal.module';
import { InstitutionIntelligenceService } from './institution-intelligence.service';
import { FreeReportService } from './free-report.service';
import { FreeReportPdfService } from './free-report-pdf.service';
import { FreeReportEmailService } from './free-report-email.service';
import { FreeReportController } from './free-report.controller';

@Module({
  imports: [EmailModule, AlmModule, forwardRef(() => PortalModule)],
  controllers: [LeadsController, FreeReportController],
  providers: [
    LeadsService,
    LeadQualificationService,
    LeadScoringService,
    OutreachExecutionService,
    InstitutionIntelligenceService,
    FreeReportService,
    FreeReportPdfService,
    FreeReportEmailService,
  ],
  exports: [
    LeadsService,
    LeadQualificationService,
    LeadScoringService,
    OutreachExecutionService,
    InstitutionIntelligenceService,
    FreeReportService,
    FreeReportPdfService,
    FreeReportEmailService,
  ],
})
export class LeadsModule {}
