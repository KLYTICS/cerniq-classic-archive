import { Test, TestingModule } from '@nestjs/testing';
import { Prisma } from '@prisma/client';
import { RevenueService } from './revenue.service';
import { PrismaService } from '../prisma.service';

jest.mock('../prisma.service', () => ({
  PrismaService: jest.fn().mockImplementation(() => ({})),
}));

describe('RevenueService', () => {
  let service: RevenueService;
  let prisma: Record<string, any>;

  beforeEach(async () => {
    prisma = {
      subscription: {
        findMany: jest.fn(),
        count: jest.fn(),
        groupBy: jest.fn(),
        aggregate: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RevenueService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<RevenueService>(RevenueService);
  });

  // ── MRR ───────────────────────────────────────────────────

  describe('getMrrSnapshot', () => {
    it('should calculate MRR from active recurring subscriptions', async () => {
      prisma.subscription.findMany.mockResolvedValue([
        { tier: 'monthly' },
        { tier: 'monthly' },
        { tier: 'annual' },
        { tier: 'partner' },
      ]);

      const result = await service.getMrrSnapshot();

      // 299 + 299 + 200 + 499 = 1297
      expect(result.mrr).toBeInstanceOf(Prisma.Decimal);
      expect(result.mrr.toString()).toBe('1297');
      expect(result.activeSubscriptionCount).toBe(4);
    });

    it('should return Decimal(0) when no active subscriptions exist', async () => {
      prisma.subscription.findMany.mockResolvedValue([]);

      const result = await service.getMrrSnapshot();

      expect(result.mrr.toString()).toBe('0');
      expect(result.activeSubscriptionCount).toBe(0);
    });

    it('should only include monthly, annual, and partner tiers', async () => {
      prisma.subscription.findMany.mockResolvedValue([
        { tier: 'monthly' },
      ]);

      const result = await service.getMrrSnapshot();

      // The findMany call should filter by tier
      expect(prisma.subscription.findMany).toHaveBeenCalledWith({
        where: {
          status: 'active',
          tier: { in: ['monthly', 'annual', 'partner'] },
        },
        select: { tier: true },
      });
      expect(result.mrr.toString()).toBe('299');
    });

    it('should return Prisma.Decimal type, never a float', async () => {
      prisma.subscription.findMany.mockResolvedValue([
        { tier: 'partner' },
      ]);

      const result = await service.getMrrSnapshot();

      expect(result.mrr).toBeInstanceOf(Prisma.Decimal);
      expect(typeof result.mrr).not.toBe('number');
    });
  });

  // ── ARR ───────────────────────────────────────────────────

  describe('getArrSnapshot', () => {
    it('should return ARR as MRR x 12', async () => {
      prisma.subscription.findMany.mockResolvedValue([
        { tier: 'monthly' }, // 299
      ]);

      const result = await service.getArrSnapshot();

      expect(result.mrr.toString()).toBe('299');
      expect(result.arr.toString()).toBe('3588');
      expect(result.arr).toBeInstanceOf(Prisma.Decimal);
    });

    it('should return ARR of 0 when MRR is 0', async () => {
      prisma.subscription.findMany.mockResolvedValue([]);

      const result = await service.getArrSnapshot();

      expect(result.arr.toString()).toBe('0');
    });
  });

  // ── Churn ─────────────────────────────────────────────────

  describe('getChurnMetrics', () => {
    const period = {
      from: new Date('2026-01-01'),
      to: new Date('2026-01-31'),
    };

    it('should count cancelled subscriptions in the date range', async () => {
      prisma.subscription.count
        .mockResolvedValueOnce(3) // cancelled
        .mockResolvedValueOnce(1) // past_due
        .mockResolvedValueOnce(50); // totalAtStart

      const result = await service.getChurnMetrics(period);

      expect(result.cancelledCount).toBe(3);
      expect(result.pastDueCount).toBe(1);
      expect(result.totalAtStart).toBe(50);
    });

    it('should calculate churn rate as percentage', async () => {
      prisma.subscription.count
        .mockResolvedValueOnce(5) // cancelled
        .mockResolvedValueOnce(0) // past_due
        .mockResolvedValueOnce(100); // totalAtStart

      const result = await service.getChurnMetrics(period);

      expect(result.churnRate.toString()).toBe('5');
      expect(result.churnRate).toBeInstanceOf(Prisma.Decimal);
    });

    it('should return 0 churn rate when totalAtStart is 0', async () => {
      prisma.subscription.count
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0);

      const result = await service.getChurnMetrics(period);

      expect(result.churnRate.toString()).toBe('0');
    });

    it('should pass correct date filters to subscription.count', async () => {
      prisma.subscription.count
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0);

      await service.getChurnMetrics(period);

      expect(prisma.subscription.count).toHaveBeenCalledWith({
        where: {
          status: 'cancelled',
          cancelledAt: { gte: period.from, lte: period.to },
        },
      });
    });
  });

  // ── Revenue Timeline ──────────────────────────────────────

  describe('getRevenueTimeline', () => {
    it('should return array with correct number of months', async () => {
      prisma.subscription.findMany.mockResolvedValue([]);

      const result = await service.getRevenueTimeline(3);

      expect(result).toHaveLength(3);
      expect(result[0]).toHaveProperty('month');
      expect(result[0]).toHaveProperty('mrr');
      expect(result[0]).toHaveProperty('activeCount');
    });

    it('should return Decimal MRR for each month', async () => {
      prisma.subscription.findMany.mockResolvedValue([
        { tier: 'monthly' },
      ]);

      const result = await service.getRevenueTimeline(1);

      expect(result[0].mrr).toBeInstanceOf(Prisma.Decimal);
      expect(result[0].mrr.toString()).toBe('299');
    });
  });

  // ── Cohort Retention ──────────────────────────────────────

  describe('getCohortRetention', () => {
    it('should group subscriptions by signup month', async () => {
      prisma.subscription.findMany.mockResolvedValue([
        { createdAt: new Date('2026-01-15'), status: 'active' },
        { createdAt: new Date('2026-01-20'), status: 'cancelled' },
        { createdAt: new Date('2026-02-10'), status: 'active' },
      ]);

      const result = await service.getCohortRetention();

      expect(result).toHaveLength(2);
      expect(result[0].cohort).toBe('2026-01');
      expect(result[0].total).toBe(2);
      expect(result[0].retained).toBe(1);
      expect(result[0].retentionRate.toString()).toBe('50');
    });

    it('should return 100% retention when all are active', async () => {
      prisma.subscription.findMany.mockResolvedValue([
        { createdAt: new Date('2026-03-01'), status: 'active' },
        { createdAt: new Date('2026-03-15'), status: 'active' },
      ]);

      const result = await service.getCohortRetention();

      expect(result[0].retentionRate.toString()).toBe('100');
    });

    it('should return empty array when no recurring subs exist', async () => {
      prisma.subscription.findMany.mockResolvedValue([]);

      const result = await service.getCohortRetention();

      expect(result).toEqual([]);
    });

    it('should sort cohorts chronologically', async () => {
      prisma.subscription.findMany.mockResolvedValue([
        { createdAt: new Date(2026, 2, 15), status: 'active' }, // March
        { createdAt: new Date(2026, 0, 15), status: 'active' }, // January
        { createdAt: new Date(2026, 1, 15), status: 'active' }, // February
      ]);

      const result = await service.getCohortRetention();

      expect(result.map((c) => c.cohort)).toEqual(['2026-01', '2026-02', '2026-03']);
    });
  });
});
