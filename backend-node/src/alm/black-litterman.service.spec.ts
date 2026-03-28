import { BlackLittermanService } from './black-litterman.service';

describe('BlackLittermanService', () => {
  let svc: BlackLittermanService;

  beforeEach(() => {
    const mockPrisma = {
      balanceSheetItem: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    } as any;
    svc = new BlackLittermanService(mockPrisma);
  });

  it('should return demo result when no balance sheet items exist', async () => {
    const result = await svc.computeBLPortfolio('inst-1');
    expect(result).toHaveProperty('equilibriumReturns');
    expect(result).toHaveProperty('posteriorReturns');
    expect(result).toHaveProperty('optimalWeights');
    expect(result).toHaveProperty('assetNames');
    expect(result).toHaveProperty('sharpeRatio');
    expect(result.assetNames.length).toBeGreaterThan(0);
  });

  it('should have weights summing to approximately 1 in demo', async () => {
    const result = await svc.computeBLPortfolio('inst-1');
    const wSum = result.optimalWeights.reduce((s, w) => s + w, 0);
    expect(wSum).toBeCloseTo(1.0, 1);
  });

  it('should return non-negative Sharpe ratio', async () => {
    const result = await svc.computeBLPortfolio('inst-1');
    expect(result.sharpeRatio).toBeGreaterThanOrEqual(0);
  });

  it('should compute equilibrium returns from balance sheet data', async () => {
    const mockPrisma = {
      balanceSheetItem: {
        findMany: jest.fn().mockResolvedValue([
          { subcategory: 'cash', balance: 50, rate: 0.02, category: 'asset' },
          { subcategory: 'securities', balance: 100, rate: 0.04, category: 'asset' },
          { subcategory: 'consumer_loans', balance: 150, rate: 0.07, category: 'asset' },
        ]),
      },
    } as any;
    svc = new BlackLittermanService(mockPrisma);
    const result = await svc.computeBLPortfolio('inst-1');
    expect(result.assetNames).toEqual(['cash', 'securities', 'consumer_loans']);
    expect(result.equilibriumReturns.length).toBe(3);
    expect(result.optimalWeights.length).toBe(3);
  });

  it('should have posteriorReturns equal equilibriumReturns when no views', async () => {
    const result = await svc.computeBLPortfolio('inst-1', []);
    expect(result.posteriorReturns).toEqual(result.equilibriumReturns);
    expect(result.viewContributions).toEqual([]);
  });
});
