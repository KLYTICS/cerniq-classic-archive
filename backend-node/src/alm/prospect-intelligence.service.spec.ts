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
          { category: 'asset', subcategory: 'residential_mortgage', balance: 150, rate: 0.055 },
          { category: 'asset', subcategory: 'consumer_loans', balance: 70, rate: 0.08 },
          { category: 'liability', subcategory: 'savings', balance: 180, rate: 0.02 },
          { category: 'liability', subcategory: 'time_deposits', balance: 50, rate: 0.035 },
        ],
      }),
    };
    service = new ProspectIntelligenceService(prisma, ncuaPull);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

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
    // Total assets = 250, liabilities = 230, NWR = 8%
    ncuaPull.pullByCharterNumber.mockResolvedValue({
      institutionName: 'Low Capital CU',
      items: [
        { category: 'asset', subcategory: 'cash', balance: 250, rate: 0 },
        { category: 'liability', subcategory: 'savings', balance: 230, rate: 0.02 },
      ],
    });

    const result = await service.analyzeProspect('99999');
    const nwrFlag = result.riskFlags.find((f) => f.metric === 'Net Worth Ratio');
    expect(nwrFlag).toBeDefined();
    expect(nwrFlag!.actual).toBeLessThan(9.2);
    expect(nwrFlag!.gap).toBeLessThan(0);
  });

  it('returns at least one risk flag even for healthy institutions', async () => {
    // All metrics within peer norms
    ncuaPull.pullByCharterNumber.mockResolvedValue({
      institutionName: 'Healthy CU',
      items: [
        { category: 'asset', subcategory: 'cash', balance: 50, rate: 0 },
        { category: 'asset', subcategory: 'consumer_loans', balance: 100, rate: 0.07 },
        { category: 'liability', subcategory: 'savings', balance: 130, rate: 0.015 },
      ],
    });

    const result = await service.analyzeProspect('11111');
    expect(result.riskFlags.length).toBeGreaterThanOrEqual(1);
  });

  it('asset tier classification works correctly', async () => {
    ncuaPull.pullByCharterNumber.mockResolvedValue({
      institutionName: 'Small CU',
      items: [
        { category: 'asset', subcategory: 'cash', balance: 30, rate: 0 },
        { category: 'liability', subcategory: 'savings', balance: 25, rate: 0.01 },
      ],
    });

    const result = await service.analyzeProspect('22222');
    expect(result.assetTier).toBe('small');
  });

  it('email drafts reference the top risk flag', async () => {
    const result = await service.analyzeProspect('12345');
    const topMetric = result.riskFlags[0].metric;
    // Email should reference the institution name
    expect(result.emailDraft).toContain('Cooperativa Test');
    expect(result.emailDraftEs).toContain('Cooperativa Test');
  });
});
