import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AlmService } from './alm.service';
import { AlmEnterpriseService } from './alm-enterprise.service';
import { StressTestingService } from './stress-testing/stress-testing.service';
import { ReportsService } from './reports/reports.service';
import { WorkspaceOnboardingService } from './workspace-onboarding.service';
import { CSVIngestionService } from './csv-ingestion.service';
import { AlmController } from './alm.controller';
import { AuthGuard } from '../auth/auth.guard';

@Module({
  imports: [
    JwtModule.register({
      secret: process.env.JWT_SECRET,
      signOptions: { expiresIn: '24h' },
    }),
  ],
  controllers: [AlmController],
  providers: [
    AlmService,
    AlmEnterpriseService,
    StressTestingService,
    ReportsService,
    WorkspaceOnboardingService,
    CSVIngestionService,
    AuthGuard,
  ],
  exports: [AlmService, AlmEnterpriseService, StressTestingService, WorkspaceOnboardingService, CSVIngestionService],
})
export class AlmModule {}
