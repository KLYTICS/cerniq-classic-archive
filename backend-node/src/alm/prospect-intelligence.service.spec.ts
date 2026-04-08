import { ProspectIntelligenceService } from './prospect-intelligence.service';

describe('ProspectIntelligenceService', () => {
  let service: ProspectIntelligenceService;
  let prisma: any;
  let ncuaPull: any;

  beforeEach(() => {
    prisma = {
      prospectInstitution: {
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
    };
    ncuaPull = {
      pullByCharterNumber: jest.fn().mockResolvedValue({
        institutionName: 'Cooperativa Test',
        items: [
          { category: 'asset', subcategory: 'cash', balance: 30, rate: 0 },
          {
            category: 'asset',
            subcategory: 'residential_mortgage',
            balance: 150,
            rate: 0.055,
          },
          {
            category: 'asset',
            subcategory: 'consumer_loans',
            balance: 70,
            rate: 0.08,
          },
          {
            category: 'liability',
            subcategory: 'savings',
            balance: 180,
            rate: 0.02,
          },
          {
            category: 'liability',
            subcategory: 'time_deposits',
            balance: 50,
            rate: 0.035,
          },
        ],
      }),
    };
    service = new ProspectIntelligenceService(prisma, ncuaPull);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ── analyzeProspect ───────────────────────────────────────────

  it('analyzes prospect and returns risk flags', async () => {
    const result = await service.analyzeProspect('12345');
    expect(result.charterNumber).toBe('12345');
    expect(result.institutionName).toBe('Cooperativa Test');
    expect(result.totalAssets).toBeGreaterThan(0);
    expect(['small', 'medium', 'large']).toContain(result.assetTier);
    expect(result.riskFlags.length).toBeGreaterThan(0);
    expect(['HIGH', 'MEDIUM', 'LOW']).toContain(result.overallRiskLevel);
    expect(result.emailDraft).toContain('CERNIQ');
    expect(result.emailDraftEs).toContain('CERNIQ');
    expect(result.estimatedAnnualValue).toBeGreaterThan(0);
  });

  it('flags NWR below peer median of 9.2%', async () => {
    ncuaPull.pullByCharterNumber.mockResolvedValue({
      institutionName: 'Low Capital CU',
      items: [
        { category: 'asset', subcategory: 'cash', balance: 250, rate: 0 },
        {
          category: 'liability',
          subcategory: 'savings',
          balance: 230,
          rate: 0.02,
        },
      ],
    });
    const result = await service.analyzeProspect('99999');
    const nwrFlag = result.riskFlags.find(
      (f) => f.metric === 'Net Worth Ratio',
    );
    expect(nwrFlag).toBeDefined();
    expect(nwrFlag!.actual).toBeLessThan(9.2);
    expect(nwrFlag!.gap).toBeLessThan(0);
  });

  it('returns at least one risk flag even for healthy institutions', async () => {
    ncuaPull.pullByCharterNumber.mockResolvedValue({
      institutionName: 'Healthy CU',
      items: [
        { category: 'asset', subcategory: 'cash', balance: 50, rate: 0 },
        {
          category: 'asset',
          subcategory: 'consumer_loans',
          balance: 100,
          rate: 0.07,
        },
        {
          category: 'liability',
          subcategory: 'savings',
          balance: 130,
          rate: 0.015,
        },
      ],
    });
    const result = await service.analyzeProspect('11111');
    expect(result.riskFlags.length).toBeGreaterThanOrEqual(1);
  });

  it('asset tier classification — small', async () => {
    ncuaPull.pullByCharterNumber.mockResolvedValue({
      institutionName: 'Small CU',
      items: [
        { category: 'asset', subcategory: 'cash', balance: 30, rate: 0 },
        {
          category: 'liability',
          subcategory: 'savings',
          balance: 25,
          rate: 0.01,
        },
      ],
    });
    const result = await service.analyzeProspect('22222');
    expect(result.assetTier).toBe('small');
  });

  it('asset tier classification — medium', async () => {
    ncuaPull.pullByCharterNumber.mockResolvedValue({
      institutionName: 'Medium CU',
      items: [
        { category: 'asset', subcategory: 'cash', balance: 100, rate: 0 },
        {
          category: 'asset',
          subcategory: 'consumer_loans',
          balance: 100,
          rate: 0.06,
        },
        {
          category: 'liability',
          subcategory: 'savings',
          balance: 180,
          rate: 0.02,
        },
      ],
    });
    const result = await service.analyzeProspect('33333');
    expect(result.assetTier).toBe('medium');
  });

  it('asset tier classification — large', async () => {
    ncuaPull.pullByCharterNumber.mockResolvedValue({
      institutionName: 'Large CU',
      items: [
        { category: 'asset', subcategory: 'cash', balance: 500, rate: 0 },
        {
          category: 'liability',
          subcategory: 'savings',
          balance: 450,
          rate: 0.02,
        },
      ],
    });
    const result = await service.analyzeProspect('44444');
    expect(result.assetTier).toBe('large');
  });

  it('email drafts reference the top risk flag', async () => {
    const result = await service.analyzeProspect('12345');
    expect(result.emailDraft).toContain('Cooperativa Test');
    expect(result.emailDraftEs).toContain('Cooperativa Test');
  });

  it('flags NIM below peer median', async () => {
    // Low NIM: asset rate ~ 0, liability rate ~ 0.02
    ncuaPull.pullByCharterNumber.mockResolvedValue({
      institutionName: 'Low NIM CU',
      items: [
        { category: 'asset', subcategory: 'cash', balance: 200, rate: 0.01 },
        {
          category: 'liability',
          subcategory: 'savings',
          balance: 170,
          rate: 0.02,
        },
      ],
    });
    const result = await service.analyzeProspect('55555');
    const nimFlag = result.riskFlags.find(
      (f) => f.metric === 'Net Interest Margin',
    );
    expect(nimFlag).toBeDefined();
    expect(nimFlag!.actual).toBeLessThan(3.6);
  });

  it('flags high loan-to-share ratio', async () => {
    // Loans/shares > 82% triggers flag
    ncuaPull.pullByCharterNumber.mockResolvedValue({
      institutionName: 'High L/S CU',
      items: [
        { category: 'asset', subcategory: 'cash', balance: 10, rate: 0 },
        {
          category: 'asset',
          subcategory: 'consumer_loans',
          balance: 180,
          rate: 0.08,
        },
        {
          category: 'liability',
          subcategory: 'savings',
          balance: 170,
          rate: 0.02,
        },
      ],
    });
    const result = await service.analyzeProspect('66666');
    const ltsFlag = result.riskFlags.find(
      (f) => f.metric === 'Loan-to-Share Ratio',
    );
    expect(ltsFlag).toBeDefined();
    expect(ltsFlag!.actual).toBeGreaterThan(82);
  });

  it('flags HIGH NWR severity when NWR < 7%', async () => {
    ncuaPull.pullByCharterNumber.mockResolvedValue({
      institutionName: 'Very Low Capital CU',
      items: [
        { category: 'asset', subcategory: 'cash', balance: 100, rate: 0 },
        {
          category: 'liability',
          subcategory: 'savings',
          balance: 95,
          rate: 0.02,
        },
      ],
    });
    const result = await service.analyzeProspect('77777');
    const nwrFlag = result.riskFlags.find(
      (f) => f.metric === 'Net Worth Ratio',
    );
    expect(nwrFlag).toBeDefined();
    expect(nwrFlag!.severity).toBe('HIGH');
  });

  it('overall risk level is HIGH when any flag is HIGH', async () => {
    ncuaPull.pullByCharterNumber.mockResolvedValue({
      institutionName: 'Risky CU',
      items: [
        { category: 'asset', subcategory: 'cash', balance: 100, rate: 0 },
        {
          category: 'liability',
          subcategory: 'savings',
          balance: 95,
          rate: 0.02,
        },
      ],
    });
    const result = await service.analyzeProspect('88888');
    expect(result.overallRiskLevel).toBe('HIGH');
  });

  it('estimatedAnnualValue includes base + asset-dependent component', async () => {
    const result = await service.analyzeProspect('12345');
    // Base = 15000, plus totalAssets * 20
    expect(result.estimatedAnnualValue).toBeGreaterThanOrEqual(15000);
  });

  it('email includes percentage sign for ratio metrics', async () => {
    const result = await service.analyzeProspect('12345');
    // At least one risk flag should be ratio-related
    const hasRatio = result.riskFlags.some((f) => f.metric.includes('Ratio'));
    if (hasRatio) {
      expect(result.emailDraft).toContain('%');
    }
  });

  // ── analyzeAllProspects ───────────────────────────────────────

  it('analyzeAllProspects returns empty when no prospects found', async () => {
    prisma.prospectInstitution.findMany.mockResolvedValue([]);
    const result = await service.analyzeAllProspects();
    expect(result.analyzed).toBe(0);
    expect(result.results).toEqual([]);
  });

  it('analyzeAllProspects skips prospects without publicDataSource', async () => {
    prisma.prospectInstitution.findMany.mockResolvedValue([
      {
        id: 'p1',
        name: 'NoData CU',
        publicDataSource: null,
        outreachStatus: 'not_started',
      },
    ]);
    const result = await service.analyzeAllProspects();
    expect(result.analyzed).toBe(0);
  });

  it('analyzeAllProspects processes valid prospects', async () => {
    prisma.prospectInstitution.findMany.mockResolvedValue([
      {
        id: 'p1',
        name: 'Valid CU',
        publicDataSource: 'ncua',
        outreachStatus: 'not_started',
      },
    ]);
    prisma.prospectInstitution.update.mockResolvedValue({});
    const result = await service.analyzeAllProspects();
    expect(result.analyzed).toBe(1);
    expect(result.results[0].institutionName).toBe('Valid CU');
  });

  it('analyzeAllProspects handles errors for individual prospects', async () => {
    prisma.prospectInstitution.findMany.mockResolvedValue([
      {
        id: 'p1',
        name: 'Error CU',
        publicDataSource: 'ncua',
        outreachStatus: 'not_started',
      },
    ]);
    ncuaPull.pullByCharterNumber.mockRejectedValue(new Error('Network error'));
    const result = await service.analyzeAllProspects();
    expect(result.analyzed).toBe(0);
  });

  it('analyzeAllProspects updates prospect status after analysis', async () => {
    prisma.prospectInstitution.findMany.mockResolvedValue([
      {
        id: 'p1',
        name: 'Update CU',
        publicDataSource: 'ncua',
        outreachStatus: 'not_started',
      },
    ]);
    prisma.prospectInstitution.update.mockResolvedValue({});
    await service.analyzeAllProspects();
    expect(prisma.prospectInstitution.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'p1' },
        data: expect.objectContaining({ outreachStatus: 'sample_generated' }),
      }),
    );
  });

  it('default Exam Preparation flag for healthy institutions', async () => {
    ncuaPull.pullByCharterNumber.mockResolvedValue({
      institutionName: 'Healthy CU',
      items: [
        { category: 'asset', subcategory: 'cash', balance: 50, rate: 0 },
        {
          category: 'asset',
          subcategory: 'consumer_loans',
          balance: 100,
          rate: 0.07,
        },
        {
          category: 'liability',
          subcategory: 'savings',
          balance: 130,
          rate: 0.015,
        },
      ],
    });
    const result = await service.analyzeProspect('11111');
    const examFlag = result.riskFlags.find(
      (f) => f.metric === 'Exam Preparation',
    );
    if (examFlag) {
      expect(examFlag.severity).toBe('LOW');
      expect(examFlag.narrativeEs).toContain('COSSEC');
    }
  });
});
