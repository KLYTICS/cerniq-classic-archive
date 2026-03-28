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
    expect(result.portfolioEffDuration).toBeLessThanOrEqual(result.portfolioModDuration);
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
});
