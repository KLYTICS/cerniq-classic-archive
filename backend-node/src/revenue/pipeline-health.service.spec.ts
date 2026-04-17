import { Test, TestingModule } from '@nestjs/testing';
import { Prisma } from '@prisma/client';
import { PipelineHealthService } from './pipeline-health.service';
import { PrismaService } from '../prisma.service';

jest.mock('../prisma.service', () => ({
  PrismaService: jest.fn().mockImplementation(() => ({})),
}));

describe('PipelineHealthService', () => {
  let service: PipelineHealthService;
  let prisma: Record<string, any>;

  beforeEach(async () => {
    prisma = {
      lead: {
        findMany: jest.fn(),
        groupBy: jest.fn(),
        count: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PipelineHealthService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<PipelineHealthService>(PipelineHealthService);
  });

  // ── Pipeline Snapshot ─────────────────────────────────────

  describe('getPipelineSnapshot', () => {
    it('should group leads by status with counts and values', async () => {
      prisma.lead.findMany.mockResolvedValue([
        { status: 'NEW', revenueAmount: null },
        { status: 'NEW', revenueAmount: new Prisma.Decimal(500) },
        { status: 'NEGOTIATING', revenueAmount: new Prisma.Decimal(2000) },
        { status: 'CLOSED_WON', revenueAmount: new Prisma.Decimal(750) },
      ]);

      const result = await service.getPipelineSnapshot();

      expect(result.totalLeads).toBe(4);
      const newStage = result.stages.find((s) => s.status === 'NEW');
      expect(newStage?.count).toBe(2);
      expect(newStage?.totalValue.toString()).toBe('500');
    });

    it('should exclude CLOSED_LOST and UNQUALIFIED from pipeline value', async () => {
      prisma.lead.findMany.mockResolvedValue([
        { status: 'NEW', revenueAmount: new Prisma.Decimal(1000) },
        { status: 'CLOSED_LOST', revenueAmount: new Prisma.Decimal(5000) },
        { status: 'UNQUALIFIED', revenueAmount: new Prisma.Decimal(3000) },
      ]);

      const result = await service.getPipelineSnapshot();

      expect(result.totalPipelineValue.toString()).toBe('1000');
      expect(result.totalLeads).toBe(3);
    });

    it('should return Decimal zero when no leads exist', async () => {
      prisma.lead.findMany.mockResolvedValue([]);

      const result = await service.getPipelineSnapshot();

      expect(result.totalLeads).toBe(0);
      expect(result.totalPipelineValue.toString()).toBe('0');
      expect(result.stages).toEqual([]);
    });

    it('should handle leads with null revenueAmount', async () => {
      prisma.lead.findMany.mockResolvedValue([
        { status: 'CONTACTED', revenueAmount: null },
        { status: 'CONTACTED', revenueAmount: null },
      ]);

      const result = await service.getPipelineSnapshot();

      const contacted = result.stages.find((s) => s.status === 'CONTACTED');
      expect(contacted?.count).toBe(2);
      expect(contacted?.totalValue.toString()).toBe('0');
    });
  });

  // ── Conversion Funnel ─────────────────────────────────────

  describe('getConversionFunnel', () => {
    it('should return stage-to-stage conversion rates', async () => {
      prisma.lead.groupBy.mockResolvedValue([
        { status: 'NEW', _count: { status: 50 } },
        { status: 'CONTACTED', _count: { status: 30 } },
        { status: 'DEMO_SCHEDULED', _count: { status: 20 } },
        { status: 'DEMO_COMPLETED', _count: { status: 15 } },
        { status: 'PROPOSAL_SENT', _count: { status: 10 } },
        { status: 'NEGOTIATING', _count: { status: 5 } },
        { status: 'CLOSED_WON', _count: { status: 3 } },
      ]);

      const result = await service.getConversionFunnel();

      expect(result).toHaveLength(6); // 7 stages → 6 transitions
      expect(result[0].from).toBe('NEW');
      expect(result[0].to).toBe('CONTACTED');
      // All conversion rates should be Prisma.Decimal
      for (const stage of result) {
        expect(stage.conversionRate).toBeInstanceOf(Prisma.Decimal);
      }
    });

    it('should handle empty pipeline gracefully', async () => {
      prisma.lead.groupBy.mockResolvedValue([]);

      const result = await service.getConversionFunnel();

      expect(result).toHaveLength(6);
      for (const stage of result) {
        expect(stage.fromCount).toBe(0);
        expect(stage.toCount).toBe(0);
        expect(stage.conversionRate.toString()).toBe('0');
      }
    });
  });

  // ── Stale Deals ───────────────────────────────────────────

  describe('getStaleDealFlags', () => {
    it('should detect leads with no activity past threshold', async () => {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      prisma.lead.findMany.mockResolvedValue([
        {
          id: 'lead-1',
          name: 'Maria',
          email: 'maria@coop.pr',
          institutionName: 'Cooperativa Test',
          status: 'PROPOSAL_SENT',
          updatedAt: thirtyDaysAgo,
        },
      ]);

      const result = await service.getStaleDealFlags(14);

      expect(result).toHaveLength(1);
      expect(result[0].daysSinceActivity).toBeGreaterThanOrEqual(29);
      expect(result[0].id).toBe('lead-1');
    });

    it('should return empty array when no stale deals exist', async () => {
      prisma.lead.findMany.mockResolvedValue([]);

      const result = await service.getStaleDealFlags(14);

      expect(result).toEqual([]);
    });

    it('should only query active pipeline stages (not CLOSED_WON/LOST)', async () => {
      prisma.lead.findMany.mockResolvedValue([]);

      await service.getStaleDealFlags(7);

      expect(prisma.lead.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: {
              in: [
                'NEW',
                'CONTACTED',
                'DEMO_SCHEDULED',
                'DEMO_COMPLETED',
                'PROPOSAL_SENT',
                'NEGOTIATING',
              ],
            },
          }),
        }),
      );
    });
  });

  // ── Demo Conversion ───────────────────────────────────────

  describe('getDemoConversionRate', () => {
    it('should calculate demo-to-close conversion rate', async () => {
      prisma.lead.count
        .mockResolvedValueOnce(20) // demosScheduled
        .mockResolvedValueOnce(15) // demosCompleted
        .mockResolvedValueOnce(5); // conversions

      const result = await service.getDemoConversionRate(30);

      expect(result.demosScheduled).toBe(20);
      expect(result.demosCompleted).toBe(15);
      expect(result.conversions).toBe(5);
      expect(result.conversionRate.toString()).toBe('25');
    });

    it('should return 0 conversion rate when no demos exist', async () => {
      prisma.lead.count
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0);

      const result = await service.getDemoConversionRate(30);

      expect(result.conversionRate.toString()).toBe('0');
      expect(result.conversionRate).toBeInstanceOf(Prisma.Decimal);
    });
  });
});
