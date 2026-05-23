import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { IntelligenceService } from './intelligence.service';
import { areBackgroundJobsDisabled } from '../common/scheduler/background-job-gate.util';

@Injectable()
export class IntelligenceSchedulerService {
  private readonly logger = new Logger(IntelligenceSchedulerService.name);

  constructor(private readonly intelligence: IntelligenceService) {}

  @Cron('0 12 * * *')
  async refreshStaleAccounts() {
    if (areBackgroundJobsDisabled()) return;

    try {
      await this.intelligence.refreshAccounts({
        staleOnly: true,
        trigger: 'scheduled_daily_refresh',
      });
    } catch (error: any) {
      this.logger.warn(
        `Scheduled intelligence refresh failed: ${error.message}`,
      );
    }
  }
}
