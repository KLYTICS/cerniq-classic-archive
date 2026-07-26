import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { GtmPipelineService } from './gtm-pipeline.service';
import { isGtmSchedulerDisabled } from './gtm-scheduler-flag.util';

const TZ = 'America/Puerto_Rico';

/**
 * GTM heartbeat — keeps the cooperativa outbound graph fresh without manual runs.
 *
 * Cadence (AST):
 *   Mon 07:00 — full pipeline (seed + COSSEC enrich + intelligence sync + playbook)
 *   Thu 07:00 — prospect-only refresh (lighter; catches new inbound leads mid-week)
 */
@Injectable()
export class GtmSchedulerService implements OnModuleInit {
  private readonly logger = new Logger(GtmSchedulerService.name);
  private enabled = true;

  constructor(private readonly pipeline: GtmPipelineService) {}

  onModuleInit() {
    if (isGtmSchedulerDisabled()) {
      this.enabled = false;
      this.logger.warn('GTM scheduler DISABLED by GTM_SCHEDULER_DISABLED env');
    }
  }

  @Cron('0 0 7 * * 1', { name: 'gtm-weekly-full-pipeline', timeZone: TZ })
  async runWeeklyFullPipeline() {
    if (!this.enabled) return;
    try {
      await this.pipeline.executeFullPipeline({
        triggerSource: 'cron',
        persistArtifacts: true,
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Weekly GTM pipeline failed: ${message}`);
    }
  }

  @Cron('0 0 7 * * 4', { name: 'gtm-midweek-refresh', timeZone: TZ })
  async runMidweekRefresh() {
    if (!this.enabled) return;
    try {
      await this.pipeline.executeFullPipeline({
        triggerSource: 'cron',
        persistArtifacts: true,
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Midweek GTM refresh failed: ${message}`);
    }
  }
}
