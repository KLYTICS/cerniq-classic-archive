import { Module } from '@nestjs/common';
import { IntelligenceModule } from '../intelligence/intelligence.module';
import { JobsModule } from '../jobs/jobs.module';
import { PortalModule } from '../portal/portal.module';
import { AuditModule } from '../audit/audit.module';
import { ControlTowerController } from './control-tower.controller';
import { ControlTowerService } from './control-tower.service';
import { SessionContinuityService } from './session-continuity.service';
import { SentrySmokeController } from './sentry-smoke.controller';

@Module({
  imports: [IntelligenceModule, JobsModule, PortalModule, AuditModule],
  controllers: [ControlTowerController, SentrySmokeController],
  providers: [ControlTowerService, SessionContinuityService],
  exports: [ControlTowerService],
})
export class AdminModule {}
