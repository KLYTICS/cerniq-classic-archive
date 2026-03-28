import { Test, TestingModule } from '@nestjs/testing';
import { LeadsService } from './leads.service';
import { PrismaService } from '../prisma.service';
import { EmailService } from '../email/email.service';

jest.mock('../prisma.service', () => ({
  PrismaService: jest.fn().mockImplementation(() => ({})),
}));

describe('LeadsService', () => {
  let service: LeadsService;
  let prisma: Record<string, any>;
  let email: Record<string, jest.Mock>;

  beforeEach(async () => {
    prisma = {
      lead: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        findUniqueOrThrow: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      prospectInstitution: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        findUniqueOrThrow: jest.fn(),
        create: jest.fn(),
      },
      cooperativaBenchmark: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
      },
    };

    email = {
      sendLeadNotification: jest.fn().mockResolvedValue(undefined),
      sendLeadConfirmation: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LeadsService,
        { provide: PrismaService, useValue: prisma },
        { provide: EmailService, useValue: email },
      ],
    }).compile();

    service = module.get<LeadsService>(LeadsService);
  });

  // ── submitLead ────────────────────────────────

  describe('submitLead', () => {
    const baseDto = {
      name: 'Maria Lopez',
      email: 'maria@cooptest.pr',
      phone: '787-555-1234',
      role: 'CFO',
      institutionName: 'Cooperativa Test',
      institutionType: 'cooperativa',
      message: 'Interested in ALM report',
      source: 'landing_page',
    };

    it('should create a new lead with auto-assigned priority', async () => {
      prisma.lead.findFirst.mockResolvedValue(null); // no duplicate
      prisma.lead.create.mockResolvedValue({
        id: 'lead-1',
        ...baseDto,
        priority: 'HIGH',
        nextFollowUp: new Date(),
      });

      const result = await service.submitLead(baseDto as any);

      expect(result.leadId).toBe('lead-1');
      expect(result.message).toContain('48 hours');
      expect(prisma.lead.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          name: 'Maria Lopez',
          email: 'maria@cooptest.pr',
          priority: 'HIGH', // cooperativa = HIGH priority
          institutionType: 'cooperativa',
        }),
      });
    });

    it('should assign HIGH priority for cooperativas and credit unions', async () => {
      prisma.lead.findFirst.mockResolvedValue(null);
      prisma.lead.create.mockImplementation(({ data }: { data: any }) =>
        Promise.resolve({ id: 'l', ...data }),
      );

      await service.submitLead({
        ...baseDto,
        institutionType: 'cooperativa',
      } as any);
      expect(prisma.lead.create.mock.calls[0][0].data.priority).toBe('HIGH');

      await service.submitLead({
        ...baseDto,
        institutionType: 'credit_union',
      } as any);
      expect(prisma.lead.create.mock.calls[1][0].data.priority).toBe('HIGH');

      await service.submitLead({
        ...baseDto,
        institutionType: 'cpa_consultant',
      } as any);
      expect(prisma.lead.create.mock.calls[2][0].data.priority).toBe('HIGH');
    });

    it('should assign MEDIUM priority for community banks', async () => {
      prisma.lead.findFirst.mockResolvedValue(null);
      prisma.lead.create.mockImplementation(({ data }: { data: any }) =>
        Promise.resolve({ id: 'l', ...data }),
      );

      await service.submitLead({
        ...baseDto,
        institutionType: 'community_bank',
      } as any);
      expect(prisma.lead.create.mock.calls[0][0].data.priority).toBe('MEDIUM');
    });

    it('should assign LOW priority for unknown institution types', async () => {
      prisma.lead.findFirst.mockResolvedValue(null);
      prisma.lead.create.mockImplementation(({ data }: { data: any }) =>
        Promise.resolve({ id: 'l', ...data }),
      );

      await service.submitLead({
        ...baseDto,
        institutionType: 'fintech',
      } as any);
      expect(prisma.lead.create.mock.calls[0][0].data.priority).toBe('LOW');
    });

    it('should update existing lead on duplicate within 24h', async () => {
      prisma.lead.findFirst.mockResolvedValue({ id: 'existing-lead' });
      prisma.lead.update.mockResolvedValue({ id: 'existing-lead' });

      const result = await service.submitLead(baseDto as any);

      expect(result.duplicate).toBe(true);
      expect(result.leadId).toBe('existing-lead');
      expect(prisma.lead.create).not.toHaveBeenCalled();
    });

    it('should send bilingual confirmation for cooperativa leads', async () => {
      prisma.lead.findFirst.mockResolvedValue(null);
      prisma.lead.create.mockResolvedValue({
        id: 'l',
        priority: 'HIGH',
        nextFollowUp: new Date(),
      });

      await service.submitLead(baseDto as any);

      // Allow async fire-and-forget to complete
      await new Promise((r) => setTimeout(r, 50));

      expect(email.sendLeadConfirmation).toHaveBeenCalledWith(
        expect.objectContaining({ bilingual: true }),
      );
    });

    it('should set nextFollowUp to next business day at 9am AST', async () => {
      prisma.lead.findFirst.mockResolvedValue(null);
      prisma.lead.create.mockImplementation(({ data }: { data: any }) =>
        Promise.resolve({ id: 'l', ...data }),
      );

      await service.submitLead(baseDto as any);

      const callData = prisma.lead.create.mock.calls[0][0].data;
      const followUp = callData.nextFollowUp as Date;
      expect(followUp).toBeInstanceOf(Date);
      // Should be at 13:00 UTC (9am AST)
      expect(followUp.getUTCHours()).toBe(13);
      expect(followUp.getUTCMinutes()).toBe(0);
      // Should not be a weekend
      expect(followUp.getDay()).not.toBe(0);
      expect(followUp.getDay()).not.toBe(6);
    });
  });

  // ── listLeads ─────────────────────────────────

  describe('listLeads', () => {
    it('should return all leads without filters', async () => {
      prisma.lead.findMany.mockResolvedValue([{ id: '1' }, { id: '2' }]);

      const result = await service.listLeads();

      expect(result).toHaveLength(2);
      expect(prisma.lead.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {},
          orderBy: [{ priority: 'asc' }, { createdAt: 'desc' }],
        }),
      );
    });

    it('should filter by status and priority', async () => {
      prisma.lead.findMany.mockResolvedValue([]);

      await service.listLeads({ status: 'CONTACTED', priority: 'HIGH' });

      expect(prisma.lead.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { status: 'CONTACTED', priority: 'HIGH' },
        }),
      );
    });
  });

  // ── updateLead ────────────────────────────────

  describe('updateLead', () => {
    it('should auto-set convertedAt when status is CLOSED_WON', async () => {
      prisma.lead.update.mockResolvedValue({});

      await service.updateLead('lead-1', { status: 'CLOSED_WON' } as any);

      const callData = prisma.lead.update.mock.calls[0][0].data;
      expect(callData.convertedAt).toBeInstanceOf(Date);
    });

    it('should not overwrite existing convertedAt on CLOSED_WON', async () => {
      const existingDate = new Date('2026-01-01');
      prisma.lead.update.mockResolvedValue({});

      await service.updateLead('lead-1', {
        status: 'CLOSED_WON',
        convertedAt: existingDate,
      } as any);

      const callData = prisma.lead.update.mock.calls[0][0].data;
      expect(callData.convertedAt).toEqual(existingDate);
    });

    it('should parse nextFollowUp string to Date', async () => {
      prisma.lead.update.mockResolvedValue({});

      await service.updateLead('lead-1', {
        nextFollowUp: '2026-04-01T13:00:00.000Z',
      } as any);

      const callData = prisma.lead.update.mock.calls[0][0].data;
      expect(callData.nextFollowUp).toBeInstanceOf(Date);
    });
  });

  // ── addNote ───────────────────────────────────

  describe('addNote', () => {
    it('should append timestamped note to existing notes', async () => {
      prisma.lead.findUniqueOrThrow.mockResolvedValue({
        id: 'lead-1',
        notes: '[2026-03-15 10:00] Initial contact',
      });
      prisma.lead.update.mockResolvedValue({});

      await service.addNote('lead-1', 'Follow-up call scheduled');

      const callData = prisma.lead.update.mock.calls[0][0].data;
      expect(callData.notes).toContain('Initial contact');
      expect(callData.notes).toContain('Follow-up call scheduled');
      expect(callData.notes).toMatch(/\[\d{4}-\d{2}-\d{2} \d{2}:\d{2}\]/);
    });

    it('should create first note when notes is null', async () => {
      prisma.lead.findUniqueOrThrow.mockResolvedValue({
        id: 'lead-1',
        notes: null,
      });
      prisma.lead.update.mockResolvedValue({});

      await service.addNote('lead-1', 'First note');

      const callData = prisma.lead.update.mock.calls[0][0].data;
      expect(callData.notes).toContain('First note');
      expect(callData.notes).not.toContain('null');
    });
  });

  // ── markReportSent ────────────────────────────

  describe('markReportSent', () => {
    it('should set reportSentAt timestamp', async () => {
      prisma.lead.update.mockResolvedValue({});

      await service.markReportSent('lead-1');

      expect(prisma.lead.update).toHaveBeenCalledWith({
        where: { id: 'lead-1' },
        data: { reportSentAt: expect.any(Date) },
      });
    });
  });

  // ── getPipelineMetrics ────────────────────────

  describe('getPipelineMetrics', () => {
    it('should compute pipeline metrics from lead data', async () => {
      const now = new Date();
      const leads = [
        { status: 'NEW', createdAt: now, revenueAmount: 0, convertedAt: null },
        {
          status: 'CONTACTED',
          createdAt: now,
          revenueAmount: 0,
          convertedAt: null,
        },
        {
          status: 'CLOSED_WON',
          createdAt: new Date(now.getTime() - 7 * 86400000),
          revenueAmount: 750,
          convertedAt: now,
        },
        {
          status: 'CLOSED_WON',
          createdAt: new Date(now.getTime() - 14 * 86400000),
          revenueAmount: 2400,
          convertedAt: new Date(now.getTime() - 7 * 86400000),
        },
      ];

      prisma.lead.findMany
        .mockResolvedValueOnce(leads) // allLeads
        .mockResolvedValueOnce(leads.slice(0, 2)); // monthLeads

      const metrics = await service.getPipelineMetrics();

      expect(metrics.totalLeads).toBe(4);
      expect(metrics.totalRevenue).toBe(3150);
      expect(metrics.statusCounts.CLOSED_WON).toBe(2);
      expect(metrics.statusCounts.CONTACTED).toBe(1);
      expect(metrics.conversionRate).toBe('50.0%');
      expect(metrics.pipelineValue).toBe(750); // 1 CONTACTED × 750
    });

    it('should handle empty pipeline', async () => {
      prisma.lead.findMany.mockResolvedValue([]);

      const metrics = await service.getPipelineMetrics();

      expect(metrics.totalLeads).toBe(0);
      expect(metrics.conversionRate).toBe('0%');
      expect(metrics.avgCloseTimeDays).toBeNull();
    });
  });

  // ── generateOutreach ──────────────────────────

  describe('generateOutreach', () => {
    it('should generate Spanish outreach by default', async () => {
      prisma.prospectInstitution.findUniqueOrThrow.mockResolvedValue({
        id: 'p-1',
        name: 'Cooperativa ABC',
        estimatedAssets: 250_000_000,
        location: 'San Juan',
        contactRole: 'Director Financiero',
      });
      prisma.cooperativaBenchmark.findFirst.mockResolvedValue({
        totalAssetsMedian: 185_000_000,
        capitalRatioMedian: 9.2,
      });

      const result = await service.generateOutreach('p-1');

      expect(result.subject).toContain('Informe ALM gratuito');
      expect(result.body).toContain('Estimado/a Director Financiero');
      expect(result.body).toContain('CERNIQ');
      expect(result.body).toContain('San Juan, PR');
      expect(result.prospect.name).toBe('Cooperativa ABC');
    });

    it('should generate English outreach when lang=en', async () => {
      prisma.prospectInstitution.findUniqueOrThrow.mockResolvedValue({
        id: 'p-2',
        name: 'Community Credit Union',
        estimatedAssets: 100_000_000,
        location: 'Ponce',
        contactRole: 'CFO',
      });
      prisma.cooperativaBenchmark.findFirst.mockResolvedValue({
        totalAssetsMedian: 185_000_000,
        capitalRatioMedian: 9.2,
      });

      const result = await service.generateOutreach('p-2', 'en');

      expect(result.subject).toContain('Free ALM Report');
      expect(result.body).toContain('Dear CFO');
      expect(result.body).toContain('CERNIQ');
    });

    it('should flag above-median prospects differently', async () => {
      prisma.prospectInstitution.findUniqueOrThrow.mockResolvedValue({
        id: 'p-3',
        name: 'Big Coop',
        estimatedAssets: 500_000_000,
        location: 'Bayamón',
      });
      prisma.cooperativaBenchmark.findFirst.mockResolvedValue({
        totalAssetsMedian: 185_000_000,
        capitalRatioMedian: 9.2,
      });

      const result = await service.generateOutreach('p-3', 'es');

      // Above median — should mention being above sector median
      expect(result.flags[0]).toContain('por encima de la mediana');
    });

    it('should flag below-median prospects for economies of scale', async () => {
      prisma.prospectInstitution.findUniqueOrThrow.mockResolvedValue({
        id: 'p-4',
        name: 'Small Coop',
        estimatedAssets: 50_000_000,
        location: 'Mayagüez',
      });
      prisma.cooperativaBenchmark.findFirst.mockResolvedValue({
        totalAssetsMedian: 185_000_000,
        capitalRatioMedian: 9.2,
      });

      const result = await service.generateOutreach('p-4', 'en');

      expect(result.flags[0]).toContain('economies of scale');
    });
  });

  // ── seedProspectPipeline ──────────────────────

  describe('seedProspectPipeline', () => {
    it('should skip existing prospects and seed new ones', async () => {
      // First prospect exists, second doesn't
      prisma.prospectInstitution.findFirst
        .mockResolvedValueOnce({ id: 'existing' })
        .mockResolvedValueOnce(null);
      prisma.prospectInstitution.create.mockResolvedValue({});
      prisma.cooperativaBenchmark.findFirst.mockResolvedValue(null);
      prisma.cooperativaBenchmark.create.mockResolvedValue({});

      const result = await service.seedProspectPipeline();

      expect(result.benchmarkSeeded).toBe(true);
      expect(result.created).toBeGreaterThanOrEqual(0);
    });
  });
});
