import { OptionalitySuiteService } from './optionality-suite.service';

describe('OptionalitySuiteService', () => {
  let service: OptionalitySuiteService;

  beforeEach(() => {
    const mockPrisma = {
      balanceSheetItem: { findMany: jest.fn().mockResolvedValue([]) },
    } as any;
    const mockKRD = {} as any;
    service = new OptionalitySuiteService(mockPrisma, mockKRD);
  });

  it('should return demo result when no items', async () => {
    const result = await service.analyzePortfolio('inst-1');
    expect(result.portfolioModDuration).toBeCloseTo(4.2, 1);
    expect(result.portfolioEffDuration).toBeCloseTo(3.6, 1);
  });

  it('effective duration should be less than modified duration', async () => {
    const result = await service.analyzePortfolio('inst-1');
    expect(result.portfolioEffDuration).toBeLessThanOrEqual(
      result.portfolioModDuration,
    );
  });

  it('should report negative convexity balance', async () => {
    const result = await service.analyzePortfolio('inst-1');
    expect(result.negConvexityBalance).toBeGreaterThan(0);
    expect(result.negConvexityPct).toBeGreaterThan(0);
  });

  it('duration gap should be defined', async () => {
    const result = await service.analyzePortfolio('inst-1');
    expect(result.durationGap).toBeCloseTo(1.8, 1);
  });

  it('convexity contributors should have negative contributions', async () => {
    const result = await service.analyzePortfolio('inst-1');
    expect(result.convexityContributors.length).toBeGreaterThan(0);
    for (const c of result.convexityContributors) {
      expect(c.contribution).toBeLessThan(0);
      expect(c.balance).toBeGreaterThan(0);
    }
  });

  // ── Coverage boost: real balance sheet items ────────────────
  describe('analyzePortfolio with real items', () => {
    let serviceWithItems: OptionalitySuiteService;

    beforeEach(() => {
      const items = [
        {
          id: '1',
          name: 'Residential Mortgages',
          category: 'asset',
          subcategory: 'residential_mortgage',
          balance: 100,
          duration: 5,
          rate: 0.05,
          rateType: 'fixed',
        },
        {
          id: '2',
          name: 'MBS Pool',
          category: 'asset',
          subcategory: 'mbs',
          balance: 50,
          duration: 7,
          rate: 0.04,
          rateType: 'fixed',
        },
        {
          id: '3',
          name: 'Commercial Loan',
          category: 'asset',
          subcategory: 'commercial',
          balance: 80,
          duration: 3,
          rate: 0.06,
          rateType: 'fixed',
        },
        {
          id: '4',
          name: 'Variable Rate CD',
          category: 'liability',
          subcategory: 'deposits',
          balance: 120,
          duration: 2,
          rate: 0.02,
          rateType: 'variable',
        },
        {
          id: '5',
          name: 'Fixed Deposits',
          category: 'liability',
          subcategory: 'deposits',
          balance: 60,
          duration: 1,
          rate: 0.015,
          rateType: 'fixed',
        },
      ];
      const mockPrisma = {
        balanceSheetItem: { findMany: jest.fn().mockResolvedValue(items) },
      } as any;
      const mockKRD = {} as any;
      serviceWithItems = new OptionalitySuiteService(mockPrisma, mockKRD);
    });

    it('classifies prepayable and callable instruments correctly', async () => {
      const result = await serviceWithItems.analyzePortfolio('inst-1');
      const mortgage = result.instruments.find(
        (i) => i.instrumentName === 'Residential Mortgages',
      );
      const mbs = result.instruments.find(
        (i) => i.instrumentName === 'MBS Pool',
      );
      const commercial = result.instruments.find(
        (i) => i.instrumentName === 'Commercial Loan',
      );

      expect(mortgage!.optionType).toBe('prepayable');
      expect(mbs!.optionType).toBe('callable');
      expect(commercial!.optionType).toBe('none');
    });

    it('prepayable/callable instruments have negative convexity', async () => {
      const result = await serviceWithItems.analyzePortfolio('inst-1');
      const mortgage = result.instruments.find(
        (i) => i.instrumentName === 'Residential Mortgages',
      );
      const mbs = result.instruments.find(
        (i) => i.instrumentName === 'MBS Pool',
      );

      expect(mortgage!.isNegativelyConvex).toBe(true);
      expect(mortgage!.effectiveConvexity).toBeLessThan(0);
      expect(mbs!.isNegativelyConvex).toBe(true);
    });

    it('effective duration is less than modified duration for optioned instruments', async () => {
      const result = await serviceWithItems.analyzePortfolio('inst-1');
      const mortgage = result.instruments.find(
        (i) => i.instrumentName === 'Residential Mortgages',
      );
      expect(mortgage!.effectiveDuration).toBeLessThan(
        mortgage!.modifiedDuration,
      );
    });

    it('duration mismatch heatmap has entries for all 5 maturity buckets', async () => {
      const result = await serviceWithItems.analyzePortfolio('inst-1');
      expect(result.durationMismatchHeatmap).toHaveLength(5);
      const buckets = result.durationMismatchHeatmap.map((h) => h.bucket);
      expect(buckets).toEqual(['0-1Y', '1-3Y', '3-5Y', '5-10Y', '10Y+']);
    });

    it('negConvexityPct is the pct of negatively convex assets vs total assets', async () => {
      const result = await serviceWithItems.analyzePortfolio('inst-1');
      // mortgage(100) + mbs(50) are neg convex; total assets = 100+50+80 = 230
      expect(result.negConvexityBalance).toBeCloseTo(150, 0);
      expect(result.negConvexityPct).toBeCloseTo((150 / 230) * 100, 0);
    });
  });

  describe('classifyOptionType via variable rateType', () => {
    it('classifies variable-rate instruments as indexed', async () => {
      const items = [
        {
          id: '1',
          name: 'SOFR Loan',
          category: 'asset',
          subcategory: 'commercial',
          balance: 50,
          duration: 3,
          rate: 0.04,
          rateType: 'variable',
        },
      ];
      const mockPrisma = {
        balanceSheetItem: { findMany: jest.fn().mockResolvedValue(items) },
      } as any;
      const svc = new OptionalitySuiteService(mockPrisma, {} as any);
      const result = await svc.analyzePortfolio('inst-1');
      expect(result.instruments[0].optionType).toBe('indexed');
    });
  });
});
