import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AlmService } from './alm.service';
import { AlmEnterpriseService } from './alm-enterprise.service';
import { AlmAdvisorService } from './alm-advisor.service';
import { StressTestingService } from './stress-testing/stress-testing.service';
import { ReportsService } from './reports/reports.service';
import { WorkspaceOnboardingService } from './workspace-onboarding.service';
import { CSVIngestionService } from './csv-ingestion.service';
import { AnalysisRunsService } from './analysis-runs.service';
import { IngestionLogsService } from './ingestion-logs.service';
import { ComplianceCalendarService } from './compliance-calendar.service';
import { DurationService } from './duration.service';
import { AlmController } from './alm.controller';
import { AlmAdvisorController } from './alm-advisor.controller';
import { AuthGuard } from '../auth/auth.guard';

@Module({
  imports: [
    JwtModule.register({
      secret: process.env.JWT_SECRET,
      signOptions: { expiresIn: '24h' },
    }),
  ],
  controllers: [AlmController, AlmAdvisorController],
  providers: [
    AlmService,
    AlmEnterpriseService,
    AlmAdvisorService,
    StressTestingService,
    ReportsService,
    WorkspaceOnboardingService,
    CSVIngestionService,
    AnalysisRunsService,
    IngestionLogsService,
    ComplianceCalendarService,
    DurationService,
    AuthGuard,
  ],
  exports: [AlmService, AlmEnterpriseService, AlmAdvisorService, StressTestingService, WorkspaceOnboardingService, CSVIngestionService, AnalysisRunsService, IngestionLogsService, ComplianceCalendarService, DurationService],
})
export class AlmModule {}
