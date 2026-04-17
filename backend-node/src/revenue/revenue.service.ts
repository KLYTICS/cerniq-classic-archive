import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma.service';

/**
 * Tier → monthly price in cents. Derived from STRIPE_PRODUCTS in billing/stripe.config.ts.
 * free and demo tiers contribute $0 MRR; one_time is non-recurring.
 */
const TIER_MONTHLY_CENTS: Record<string, number> = {
  free: 0,
  demo: 0,
  one_time: 0,
  monthly: 29_900, // $299/mo
  annual: 20_000, // $2,400/yr → $200/mo
  partner: 49_900, // $499/mo
};

export interface DateRange {
  from: Date;
  to: Date;
}

@Injectable()
export class RevenueService {
  private readonly logger = new Logger(RevenueService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ── MRR / ARR ───────────────────────────────────────────────────────

  /**
   * Calculate current Monthly Recurring Revenue by summing tier-based pricing
   * for all active recurring subscriptions.
   *
   * Returns Prisma Decimal — never a float.
   */
  async getMrrSnapshot(): Promise<{
    mrr: Prisma.Decimal;
    activeSubscriptionCount: number;
  }> {
    const activeSubs: Array<{ tier: string }> =
      await this.prisma.subscription.findMany({
        where: {
          status: 'active',
          tier: { in: ['monthly', 'annual', 'partner'] },
        },
        select: { tier: true },
      });

    let mrrCents = 0;
    for (const sub of activeSubs) {
      mrrCents += TIER_MONTHLY_CENTS[sub.tier] ?? 0;
    }

    const mrr = new Prisma.Decimal(mrrCents).div(100);

    this.logger.log({
      event: 'revenue.mrr_snapshot',
      mrr: mrr.toString(),
      activeCount: activeSubs.length,
    });

    return { mrr, activeSubscriptionCount: activeSubs.length };
  }

  /**
   * ARR = MRR × 12. Returns Prisma Decimal.
   */
  async getArrSnapshot(): Promise<{
    mrr: Prisma.Decimal;
    arr: Prisma.Decimal;
    activeSubscriptionCount: number;
  }> {
    const { mrr, activeSubscriptionCount } = await this.getMrrSnapshot();
    const arr = mrr.mul(12);
    return { mrr, arr, activeSubscriptionCount };
  }

  // ── Churn ───────────────────────────────────────────────────────────

  /**
   * Count cancelled and past_due subscriptions within a date range.
   * Churn rate = cancelled / total-at-start × 100.
   */
  async getChurnMetrics(period: DateRange): Promise<{
    cancelledCount: number;
    pastDueCount: number;
    totalAtStart: number;
    churnRate: Prisma.Decimal;
  }> {
    const [cancelled, pastDue, totalAtStart] = await Promise.all([
      this.prisma.subscription.count({
        where: {
          status: 'cancelled',
          cancelledAt: { gte: period.from, lte: period.to },
        },
      }),
      this.prisma.subscription.count({
        where: {
          status: 'past_due',
          updatedAt: { gte: period.from, lte: period.to },
        },
      }),
      this.prisma.subscription.count({
        where: {
          createdAt: { lt: period.from },
          tier: { in: ['monthly', 'annual', 'partner'] },
        },
      }),
    ]);

    const churnRate =
      totalAtStart > 0
        ? new Prisma.Decimal(cancelled).div(totalAtStart).mul(100)
        : new Prisma.Decimal(0);

    return {
      cancelledCount: cancelled,
      pastDueCount: pastDue,
      totalAtStart,
      churnRate,
    };
  }

  // ── Revenue Timeline ────────────────────────────────────────────────

  /**
   * Monthly MRR history for the last N months.
   *
   * For each month, counts active recurring subs at the end of that month
   * and derives MRR from tier pricing.
   */
  async getRevenueTimeline(
    months: number,
  ): Promise<
    Array<{ month: string; mrr: Prisma.Decimal; activeCount: number }>
  > {
    const timeline: Array<{
      month: string;
      mrr: Prisma.Decimal;
      activeCount: number;
    }> = [];
    const now = new Date();

    for (let i = months - 1; i >= 0; i--) {
      const endOfMonth = new Date(
        now.getFullYear(),
        now.getMonth() - i + 1,
        0,
        23,
        59,
        59,
        999,
      );
      const label = `${endOfMonth.getFullYear()}-${String(endOfMonth.getMonth() + 1).padStart(2, '0')}`;

      const activeSubs: Array<{ tier: string }> =
        await this.prisma.subscription.findMany({
          where: {
            status: 'active',
            tier: { in: ['monthly', 'annual', 'partner'] },
            createdAt: { lte: endOfMonth },
            OR: [{ cancelledAt: null }, { cancelledAt: { gt: endOfMonth } }],
          },
          select: { tier: true },
        });

      let mrrCents = 0;
      for (const sub of activeSubs) {
        mrrCents += TIER_MONTHLY_CENTS[sub.tier] ?? 0;
      }

      timeline.push({
        month: label,
        mrr: new Prisma.Decimal(mrrCents).div(100),
        activeCount: activeSubs.length,
      });
    }

    return timeline;
  }

  // ── Cohort Retention ────────────────────────────────────────────────

  /**
   * Retention by signup-month cohort.
   * Groups subscriptions by creation month, counts how many are still active.
   */
  async getCohortRetention(): Promise<
    Array<{
      cohort: string;
      total: number;
      retained: number;
      retentionRate: Prisma.Decimal;
    }>
  > {
    const subs: Array<{ createdAt: Date; status: string }> =
      await this.prisma.subscription.findMany({
        where: { tier: { in: ['monthly', 'annual', 'partner'] } },
        select: { createdAt: true, status: true },
      });

    const cohortMap = new Map<string, { total: number; retained: number }>();
    for (const sub of subs) {
      const key = `${sub.createdAt.getFullYear()}-${String(sub.createdAt.getMonth() + 1).padStart(2, '0')}`;
      const entry = cohortMap.get(key) ?? { total: 0, retained: 0 };
      entry.total++;
      if (sub.status === 'active') {
        entry.retained++;
      }
      cohortMap.set(key, entry);
    }

    const result = Array.from(cohortMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([cohort, { total, retained }]) => ({
        cohort,
        total,
        retained,
        retentionRate:
          total > 0
            ? new Prisma.Decimal(retained).div(total).mul(100)
            : new Prisma.Decimal(0),
      }));

    return result;
  }
}
