import { Controller, Get } from '@nestjs/common';
import { DailyPipelineService } from './daily-pipeline.service';

@Controller('api/health')
export class PipelineHealthController {
  constructor(private readonly pipelineService: DailyPipelineService) {}

  /**
   * GET /api/health/pipeline
   * Public health check — no auth required.
   */
  @Get('pipeline')
  async getPipelineHealth() {
    const lastSuccess = await this.pipelineService.getLastSuccessfulRun();
    const tickersTracked = await this.pipelineService.getTrackedTickerCount();

    // Next scheduled: 6:30 PM EST on next weekday
    const now = new Date();
    const nextRun = new Date(now);
    nextRun.setUTCHours(23, 30, 0, 0); // 6:30 PM EST = 23:30 UTC

    if (nextRun <= now) {
      nextRun.setDate(nextRun.getDate() + 1);
    }
    // Skip weekends
    while (nextRun.getDay() === 0 || nextRun.getDay() === 6) {
      nextRun.setDate(nextRun.getDate() + 1);
    }

    return {
      lastSuccess: lastSuccess?.completedAt ?? null,
      lastRunStatus: lastSuccess?.status ?? 'NEVER_RUN',
      lastRunDurationMs: lastSuccess?.durationMs ?? null,
      lastRunTickersProcessed: lastSuccess?.tickersProcessed ?? 0,
      nextScheduled: nextRun.toISOString(),
      status: lastSuccess ? 'operational' : 'awaiting_first_run',
      tickersTracked,
    };
  }
}
