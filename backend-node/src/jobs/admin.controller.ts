import { Controller, Post, Logger, UseGuards } from '@nestjs/common';
import { DailyPipelineService } from './daily-pipeline.service';
import { AdminKeyGuard } from '../auth/admin-key.guard';

// Pilot migration of the 6× duplicated inline `verifyAdmin(headerKey)`
// helper → canonical `AdminKeyGuard` class. Pre-refactor: every handler
// had to remember to call `this.verifyAdmin(adminKey)` as its first
// statement; a guard runs BEFORE the method body so forgetting is
// impossible. Same observable behavior — 401 on missing/mismatched
// `x-admin-key`, constant-time compare against `process.env.ADMIN_KEY`.
// Closes AUTH_COVERAGE_AUDIT recommendation #1 for this controller.
// Five remaining controllers (app.controller, audit, compliance,
// cossec-ingest, sample-report) follow as their own focused commits.
@Controller('api/admin')
@UseGuards(AdminKeyGuard)
export class AdminController {
  private readonly logger = new Logger(AdminController.name);

  constructor(private readonly pipelineService: DailyPipelineService) {}

  /**
   * POST /api/admin/run-pipeline
   * Manual trigger for the daily data pipeline.
   * Requires `x-admin-key` header matching `process.env.ADMIN_KEY`
   * (enforced by `AdminKeyGuard` at class level).
   */
  @Post('run-pipeline')
  async runPipeline() {
    this.logger.log('Manual pipeline trigger requested');

    const result = await this.pipelineService.runPipeline();

    return {
      message: 'Pipeline execution completed',
      ...result,
    };
  }
}
