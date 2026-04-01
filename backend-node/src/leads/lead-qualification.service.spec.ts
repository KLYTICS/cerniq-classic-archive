import { LeadQualificationService } from './lead-qualification.service';

describe('LeadQualificationService', () => {
  let service: LeadQualificationService;
  const mockPrisma = {
    prospectInstitution: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
  } as any;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new LeadQualificationService(mockPrisma);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('qualifyProspect', () => {
    it('returns empty result for non-existent prospect', async () => {
      mockPrisma.prospectInstitution.findUnique.mockResolvedValue(null);
      const result = await service.qualifyProspect('bad-id');
      expect(result.totalScore).toBe(0);
      expect(result.signals).toEqual([]);
      expect(result.recommendation).toContain('not found');
    });

    it('scores a large PR cooperativa with CFO contact as grade A', async () => {
      mockPrisma.prospectInstitution.findUnique.mockResolvedValue({
        id: 'p1',
        name: 'Gran Cooperativa PR',
        institutionType: 'cooperativa',
        estimatedAssets: 600_000_000,
        contactRole: 'CFO',
        publicDataSource: 'cossec',
        outreachSentAt: new Date(Date.now() - 86_400_000), // 1 day ago
        location: 'San Juan, Puerto Rico',
      });

      const result = await service.qualifyProspect('p1');

      expect(result.grade).toBe('A');
      expect(result.priority).toBe('CRITICAL');
      expect(result.totalScore).toBeGreaterThan(0);
      expect(result.signals.length).toBeGreaterThan(0);
    });

    it('scores a small non-PR institution as grade C or D', async () => {
      mockPrisma.prospectInstitution.findUnique.mockResolvedValue({
        id: 'p2',
        name: 'Small Bank',
        institutionType: 'bank',
        estimatedAssets: 10_000_000,
        contactRole: 'Analyst',
        publicDataSource: '',
        outreachSentAt: null,
        location: 'New York',
      });

      const result = await service.qualifyProspect('p2');

      expect(['C', 'D']).toContain(result.grade);
      expect(['MEDIUM', 'LOW']).toContain(result.priority);
    });

    it('assigns higher score for credit_union type', async () => {
      mockPrisma.prospectInstitution.findUnique.mockResolvedValue({
        id: 'p3',
        name: 'CU Test',
        institutionType: 'credit_union',
        estimatedAssets: 200_000_000,
        contactRole: 'Manager General',
        publicDataSource: '',
        outreachSentAt: null,
        location: 'USVI',
      });

      const result = await service.qualifyProspect('p3');

      const instSignal = result.signals.find(
        (s) => s.name === 'institution_type',
      );
      expect(instSignal?.score).toBe(15);
    });

    it('assigns location score for Puerto Rico', async () => {
      mockPrisma.prospectInstitution.findUnique.mockResolvedValue({
        id: 'p4',
        name: 'PR Coop',
        institutionType: 'cooperativa',
        estimatedAssets: 100_000_000,
        contactRole: 'CFO',
        publicDataSource: 'cossec',
        outreachSentAt: null,
        location: 'Ponce, PR',
      });

      const result = await service.qualifyProspect('p4');

      const locSignal = result.signals.find((s) => s.name === 'location');
      expect(locSignal?.score).toBe(15);
    });

    it('provides both English and Spanish recommendations', async () => {
      mockPrisma.prospectInstitution.findUnique.mockResolvedValue({
        id: 'p5',
        name: 'Test',
        institutionType: 'cooperativa',
        estimatedAssets: 500_000_000,
        contactRole: 'CFO',
        publicDataSource: 'cossec',
        outreachSentAt: new Date(),
        location: 'Puerto Rico',
      });

      const result = await service.qualifyProspect('p5');

      expect(result.recommendation.length).toBeGreaterThan(0);
      expect(result.recommendationEs.length).toBeGreaterThan(0);
      expect(result.nextAction.length).toBeGreaterThan(0);
      expect(result.nextActionEs.length).toBeGreaterThan(0);
    });
  });

  describe('qualifyAllProspects', () => {
    it('qualifies and sorts all prospects by score', async () => {
      mockPrisma.prospectInstitution.findMany.mockResolvedValue([
        { id: 'p1', name: 'Big', estimatedAssets: 500_000_000 },
        { id: 'p2', name: 'Small', estimatedAssets: 10_000_000 },
      ]);
      mockPrisma.prospectInstitution.findUnique
        .mockResolvedValueOnce({
          id: 'p1',
          name: 'Big',
          institutionType: 'cooperativa',
          estimatedAssets: 500_000_000,
          contactRole: 'CFO',
          publicDataSource: 'cossec',
          outreachSentAt: new Date(),
          location: 'PR',
        })
        .mockResolvedValueOnce({
          id: 'p2',
          name: 'Small',
          institutionType: 'other',
          estimatedAssets: 10_000_000,
          contactRole: 'Analyst',
          publicDataSource: '',
          outreachSentAt: null,
          location: 'CA',
        });

      const results = await service.qualifyAllProspects();

      expect(results).toHaveLength(2);
      // Should be sorted by score descending
      expect(results[0].qualification.totalScore).toBeGreaterThanOrEqual(
        results[1].qualification.totalScore,
      );
    });
  });

  describe('qualifyProspect — outreach timing edge cases', () => {
    it('assigns lower score for outreach sent 14+ days ago', async () => {
      mockPrisma.prospectInstitution.findUnique.mockResolvedValue({
        id: 'p6',
        name: 'Old Lead',
        institutionType: 'cooperativa',
        estimatedAssets: 200_000_000,
        contactRole: 'gerente general',
        publicDataSource: '',
        outreachSentAt: new Date(Date.now() - 20 * 86_400_000), // 20 days ago
        location: 'PR',
      });

      const result = await service.qualifyProspect('p6');
      const outreachSignal = result.signals.find((s) => s.name === 'outreach_recency');
      expect(outreachSignal?.score).toBe(5);
      expect(outreachSignal?.reason).toContain('re-engage');
    });

    it('assigns medium score for outreach sent within 2 weeks', async () => {
      mockPrisma.prospectInstitution.findUnique.mockResolvedValue({
        id: 'p7',
        name: 'Recent Lead',
        institutionType: 'cooperativa',
        estimatedAssets: 300_000_000,
        contactRole: 'vp finanzas',
        publicDataSource: 'cossec',
        outreachSentAt: new Date(Date.now() - 7 * 86_400_000), // 7 days ago
        location: 'USVI territory',
      });

      const result = await service.qualifyProspect('p7');
      const outreachSignal = result.signals.find((s) => s.name === 'outreach_recency');
      expect(outreachSignal?.score).toBe(10);
    });
  });

  describe('qualifyProspect — grade B classification', () => {
    it('assigns grade B for medium-fit prospect', async () => {
      mockPrisma.prospectInstitution.findUnique.mockResolvedValue({
        id: 'p8',
        name: 'B-grade',
        institutionType: 'credit_union',
        estimatedAssets: 250_000_000,
        contactRole: 'manager financiero',
        publicDataSource: 'cossec',
        outreachSentAt: new Date(Date.now() - 10 * 86_400_000),
        location: 'Puerto Rico',
      });

      const result = await service.qualifyProspect('p8');
      expect(['A', 'B']).toContain(result.grade);
    });
  });
});
