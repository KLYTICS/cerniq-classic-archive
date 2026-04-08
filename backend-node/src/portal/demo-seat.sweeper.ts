import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { DemoSeatService } from './demo-seat.service';

/**
 * Hourly sweep that expires demo-seat subscriptions past their TTL.
 *
 * Scheduling note: we run at minute 5 of every hour to avoid colliding
 * with the pipeline worker's every-2-minute processQueue tick. This keeps
 * DB load evenly distributed and makes the sweep observable in logs.
 *
 * Idempotence: `DemoSeatService.sweepExpired()` is safe to run multiple
 * times concurrently; it's a narrow findMany + conditional update per
 * seat. Paid subscriptions are invisible to the query.
 *
 * Failure behavior: if the sweep throws (DB down, Prisma error, etc.),
 * the scheduler logs the error and retries on the next tick. Demo seats
 * that SHOULD have expired remain in the 'active' status until the next
 * successful sweep — the platform access service still rejects them at
 * request time because it re-checks currentPeriodEnd on every call.
 */
@Injectable()
export class DemoSeatSweeper {
  private readonly logger = new Logger(DemoSeatSweeper.name);

  constructor(private readonly demoSeats: DemoSeatService) {}

  @Cron('5 * * * *') // Every hour at minute 5
  async runHourly() {
    try {
      const result = await this.demoSeats.sweepExpired();
      if (result.expired > 0) {
        this.logger.log({
          event: 'portal.demo_seat_sweep',
          scanned: result.scanned,
          expired: result.expired,
          expiredIds: result.expiredIds,
        });
      }
    } catch (err: any) {
      this.logger.error(
        `Demo seat sweep failed: ${err?.message || err}`,
        err?.stack,
      );
    }
  }
}
