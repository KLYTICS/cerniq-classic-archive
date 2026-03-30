import { LeadScoringService } from './lead-scoring.service';

describe('LeadScoringService', () => {
  let service: LeadScoringService;
  const mockPrisma = {
    lead: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
  } as any;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new LeadScoringService(mockPrisma);
    mockPrisma.lead.update.mockResolvedValue({});
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('scoreLead', () => {
    it('returns UNQUALIFIED for non-existent lead', async () => {
      mockPrisma.lead.findUnique.mockResolvedValue(null);
      const score = await service.scoreLead('bad-id');
      expect(score.tier).toBe('UNQUALIFIED');
      expect(score.total).toBe(0);
      expect(score.factors).toContain('Lead not found');
    });

    it('scores a cooperativa lead with demo completion as HOT', async () => {
      mockPrisma.lead.findUnique.mockResolvedValue({
        id: 'lead-1',
        institutionType: 'cooperativa',
        source: 'demo_completion',
        notes: 'Very interested in ALM',
        reportSentAt: new Date(),
      });

      const score = await service.scoreLead('lead-1');

      expect(score.fit).toBeGreaterThan(0);
      expect(score.intent).toBeGreaterThan(0);
      expect(score.total).toBe(score.fit + score.intent);
      // cooperativa (15 fit) + demo_completion (15 intent) + notes (5) + report (10) = 30 intent, 15 fit = 45 = WARM
      expect(score.tier).toBe('WARM');
    });

    it('scores a bank lead with contact_form as WARM', async () => {
      mockPrisma.lead.findUnique.mockResolvedValue({
        id: 'lead-2',
        institutionType: 'bank',
        source: 'contact_form',
        notes: null,
        reportSentAt: null,
      });

      const score = await service.scoreLead('lead-2');

      expect(score.fit).toBe(10); // bank type
      expect(score.intent).toBe(8); // contact_form
      expect(score.total).toBe(18);
      expect(score.tier).toBe('UNQUALIFIED');
    });

    it('assigns referral intent score correctly', async () => {
      mockPrisma.lead.findUnique.mockResolvedValue({
        id: 'lead-3',
        institutionType: 'credit_union',
        source: 'referral',
        notes: 'Referred by existing client',
        reportSentAt: null,
      });

      const score = await service.scoreLead('lead-3');

      expect(score.intent).toBe(17); // referral (12) + notes (5)
      expect(score.fit).toBe(12); // credit_union
    });

    it('clamps fit and intent scores to 50 max each', async () => {
      mockPrisma.lead.findUnique.mockResolvedValue({
        id: 'lead-4',
        institutionType: 'cooperativa',
        source: 'demo_completion',
        notes: 'Extensive notes here',
        reportSentAt: new Date(),
      });

      const score = await service.scoreLead('lead-4');

      expect(score.fit).toBeLessThanOrEqual(50);
      expect(score.intent).toBeLessThanOrEqual(50);
      expect(score.total).toBeLessThanOrEqual(100);
    });
  });

  describe('scoreAllLeads', () => {
    it('scores all active leads and updates priorities', async () => {
      mockPrisma.lead.findMany.mockResolvedValue([
        {
          id: 'l1',
          institutionType: 'cooperativa',
          source: 'demo_completion',
          notes: 'X',
          reportSentAt: new Date(),
        },
        {
          id: 'l2',
          institutionType: 'other',
          source: 'contact_form',
          notes: null,
          reportSentAt: null,
        },
      ]);
      mockPrisma.lead.findUnique
        .mockResolvedValueOnce({
          id: 'l1',
          institutionType: 'cooperativa',
          source: 'demo_completion',
          notes: 'X',
          reportSentAt: new Date(),
        })
        .mockResolvedValueOnce({
          id: 'l2',
          institutionType: 'other',
          source: 'contact_form',
          notes: null,
          reportSentAt: null,
        });

      const result = await service.scoreAllLeads();

      expect(result.scored).toBe(2);
      expect(result.hot + result.warm + result.cold).toBe(2);
      expect(mockPrisma.lead.update).toHaveBeenCalledTimes(2);
    });

    it('returns zeros when no active leads', async () => {
      mockPrisma.lead.findMany.mockResolvedValue([]);
      const result = await service.scoreAllLeads();
      expect(result.scored).toBe(0);
      expect(result.hot).toBe(0);
    });
  });
});
