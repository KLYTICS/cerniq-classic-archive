import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma.service';

/** Canonical lead pipeline order for conversion funnel. */
const PIPELINE_ORDER = [
  'NEW',
  'CONTACTED',
  'DEMO_SCHEDULED',
  'DEMO_COMPLETED',
  'PROPOSAL_SENT',
  'NEGOTIATING',
  'CLOSED_WON',
] as const;

@Injectable()
export class PipelineHealthService {
  private readonly logger = new Logger(PipelineHealthService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ── Pipeline Snapshot ───────────────────────────────────────────────

  /**
   * Leads grouped by status with count and total revenueAmount (Decimal).
   * Excludes CLOSED_LOST and UNQUALIFIED from value totals.
   */
  async getPipelineSnapshot(): Promise<{
    stages: Array<{ status: string; count: number; totalValue: Prisma.Decimal }>;
    totalLeads: number;
    totalPipelineValue: Prisma.Decimal;
  }> {
    const leads: Array<{ status: string; revenueAmount: Prisma.Decimal | null }> =
      await this.prisma.lead.findMany({
        select: { status: true, revenueAmount: true },
      });

    const stageMap = new Map<string, { count: number; totalValue: Prisma.Decimal }>();
    for (const lead of leads) {
      const entry = stageMap.get(lead.status) ?? {
        count: 0,
        totalValue: new Prisma.Decimal(0),
      };
      entry.count++;
      if (lead.revenueAmount) {
        entry.totalValue = entry.totalValue.add(lead.revenueAmount);
      }
      stageMap.set(lead.status, entry);
    }

    const stages = Array.from(stageMap.entries()).map(([status, data]) => ({
      status,
      count: data.count,
      totalValue: data.totalValue,
    }));

    let totalPipelineValue = new Prisma.Decimal(0);
    for (const stage of stages) {
      if (stage.status !== 'CLOSED_LOST' && stage.status !== 'UNQUALIFIED') {
        totalPipelineValue = totalPipelineValue.add(stage.totalValue);
      }
    }

    return {
      stages,
      totalLeads: leads.length,
      totalPipelineValue,
    };
  }

  // ── Conversion Funnel ───────────────────────────────────────────────

  /**
   * Stage-to-stage conversion rates through the pipeline.
   * Returns each pair of adjacent stages with counts and conversion rate.
   */
  async getConversionFunnel(): Promise<
    Array<{
      from: string;
      to: string;
      fromCount: number;
      toCount: number;
      conversionRate: Prisma.Decimal;
    }>
  > {
    const statusCounts: Array<{ status: string; _count: { status: number } }> =
      await this.prisma.lead.groupBy({
        by: ['status'],
        _count: { status: true },
      });

    const countMap = new Map<string, number>();
    for (const row of statusCounts) {
      countMap.set(row.status, row._count.status);
    }

    // Accumulate: each stage count includes all leads that reached at least that stage.
    // We compute cumulative counts from the end of the funnel backwards.
    const cumulativeCounts = new Map<string, number>();
    let cumulative = 0;
    for (let i = PIPELINE_ORDER.length - 1; i >= 0; i--) {
      cumulative += countMap.get(PIPELINE_ORDER[i]) ?? 0;
      cumulativeCounts.set(PIPELINE_ORDER[i], cumulative);
    }

    const funnel: Array<{
      from: string;
      to: string;
      fromCount: number;
      toCount: number;
      conversionRate: Prisma.Decimal;
    }> = [];

    for (let i = 0; i < PIPELINE_ORDER.length - 1; i++) {
      const fromStatus = PIPELINE_ORDER[i];
      const toStatus = PIPELINE_ORDER[i + 1];
      const fromCount = cumulativeCounts.get(fromStatus) ?? 0;
      const toCount = cumulativeCounts.get(toStatus) ?? 0;
      const conversionRate =
        fromCount > 0
          ? new Prisma.Decimal(toCount).div(fromCount).mul(100)
          : new Prisma.Decimal(0);

      funnel.push({ from: fromStatus, to: toStatus, fromCount, toCount, conversionRate });
    }

    return funnel;
  }

  // ── Stale Deals ─────────────────────────────────────────────────────

  /**
   * Leads in active pipeline stages with no activity (updatedAt) past threshold.
   */
  async getStaleDealFlags(
    daysThreshold: number,
  ): Promise<
    Array<{
      id: string;
      name: string;
      email: string;
      institutionName: string;
      status: string;
      daysSinceActivity: number;
      updatedAt: Date;
    }>
  > {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - daysThreshold);

    const staleLeads: Array<{
      id: string;
      name: string;
      email: string;
      institutionName: string;
      status: string;
      updatedAt: Date;
    }> = await this.prisma.lead.findMany({
      where: {
        status: {
          in: ['NEW', 'CONTACTED', 'DEMO_SCHEDULED', 'DEMO_COMPLETED', 'PROPOSAL_SENT', 'NEGOTIATING'],
        },
        updatedAt: { lt: cutoff },
      },
      select: {
        id: true,
        name: true,
        email: true,
        institutionName: true,
        status: true,
        updatedAt: true,
      },
      orderBy: { updatedAt: 'asc' },
    });

    const now = new Date();
    return staleLeads.map((lead) => ({
      ...lead,
      daysSinceActivity: Math.floor(
        (now.getTime() - lead.updatedAt.getTime()) / (1000 * 60 * 60 * 24),
      ),
    }));
  }

  // ── Demo Conversion Rate ────────────────────────────────────────────

  /**
   * Conversion rate from demo-scheduled to closed-won within a lookback period.
   */
  async getDemoConversionRate(days: number): Promise<{
    demosScheduled: number;
    demosCompleted: number;
    conversions: number;
    conversionRate: Prisma.Decimal;
  }> {
    const since = new Date();
    since.setDate(since.getDate() - days);

    const [demosScheduled, demosCompleted, conversions] = await Promise.all([
      this.prisma.lead.count({
        where: {
          status: { in: ['DEMO_SCHEDULED', 'DEMO_COMPLETED', 'PROPOSAL_SENT', 'NEGOTIATING', 'CLOSED_WON', 'CLOSED_LOST'] },
          createdAt: { gte: since },
        },
      }),
      this.prisma.lead.count({
        where: {
          status: { in: ['DEMO_COMPLETED', 'PROPOSAL_SENT', 'NEGOTIATING', 'CLOSED_WON', 'CLOSED_LOST'] },
          createdAt: { gte: since },
        },
      }),
      this.prisma.lead.count({
        where: {
          status: 'CLOSED_WON',
          createdAt: { gte: since },
          source: { in: ['demo', 'landing_page'] },
        },
      }),
    ]);

    const conversionRate =
      demosScheduled > 0
        ? new Prisma.Decimal(conversions).div(demosScheduled).mul(100)
        : new Prisma.Decimal(0);

    return { demosScheduled, demosCompleted, conversions, conversionRate };
  }
}
