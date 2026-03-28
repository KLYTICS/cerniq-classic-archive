import {
  Controller,
  Get,
  Headers,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ComplianceReportService } from './compliance-report.service';

@Controller('api/admin/compliance')
export class ComplianceController {
  private readonly logger = new Logger(ComplianceController.name);

  constructor(private readonly reportService: ComplianceReportService) {}

  private verifyAdmin(key: string) {
    const adminKey = process.env.ADMIN_KEY;
    if (!adminKey || key !== adminKey) {
      throw new UnauthorizedException('Invalid admin key');
    }
  }

  /**
   * GET /api/admin/compliance/soc2-evidence
   *
   * Returns a comprehensive SOC 2 Type II evidence package.
   * Protected by ADMIN_KEY header — only internal tooling and
   * auditors with the key can access this endpoint.
   */
  @Get('soc2-evidence')
  async getSOC2Evidence(@Headers('x-admin-key') adminKey: string) {
    this.verifyAdmin(adminKey);

    this.logger.log('SOC 2 evidence report requested');

    const report = await this.reportService.generateSOC2Evidence();

    return {
      ok: true,
      data: report,
    };
  }
}
