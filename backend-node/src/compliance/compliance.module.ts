import { Module } from '@nestjs/common';
import { SOC2EvidenceService } from './soc2-evidence.service.js';
import { ComplianceReportService } from './compliance-report.service.js';
import { ComplianceController } from './compliance.controller.js';

@Module({
  controllers: [ComplianceController],
  providers: [SOC2EvidenceService, ComplianceReportService],
  exports: [SOC2EvidenceService, ComplianceReportService],
})
export class ComplianceModule {}
