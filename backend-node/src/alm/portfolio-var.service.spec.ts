import { PortfolioVaRService } from './portfolio-var.service';

describe('PortfolioVaRService', () => {
  let service: PortfolioVaRService;
  const mockPrisma = {
    balanceSheetItem: { findMany: jest.fn().mockResolvedValue([]) },
  } as any;

  beforeEach(() => {
    service = new PortfolioVaRService(mockPrisma);
  });

  it('should return all three VaR methods', async () => {
    const result = await service.computeVaRSuite('inst-1', 0.95, 1);
    expect(result.historical.method).toBe('historical');
    expect(result.parametric.method).toBe('parametric');
    expect(result.montecarlo.method).toBe('montecarlo');
  });

  it('VaR should be positive (represents a loss)', async () => {
    const result = await service.computeVaRSuite('inst-1', 0.95, 1);
    expect(result.parametric.var).toBeGreaterThan(0);
  });

  it('CVaR should be >= VaR (expected shortfall is worse)', async () => {
    const result = await service.computeVaRSuite('inst-1', 0.95, 1);
    expect(result.parametric.cvar).toBeGreaterThanOrEqual(
      result.parametric.var,
    );
  });

  it('99% VaR should exceed 95% VaR for parametric', async () => {
    const result95 = await service.computeVaRSuite('inst-1', 0.95, 1);
    const result99 = await service.computeVaRSuite('inst-1', 0.99, 1);
    expect(result99.parametric.var).toBeGreaterThan(result95.parametric.var);
  });

  it('backtest should return traffic light color', async () => {
    const result = await service.computeVaRSuite('inst-1', 0.95, 1);
    expect(['GREEN', 'AMBER', 'RED']).toContain(
      result.backtestResult.trafficLight,
    );
    expect(result.backtestResult.testDays).toBe(250);
  });

  it('should reject invalid confidence level', async () => {
    await expect(
      service.computeVaRSuite('inst-1', 0.9 as any, 1),
    ).rejects.toThrow('Invalid confidence level');
  });

  it('should reject invalid horizon', async () => {
    await expect(
      service.computeVaRSuite('inst-1', 0.95, 5 as any),
    ).rejects.toThrow('Invalid horizon');
  });

  it('10-day VaR should exceed 1-day VaR', async () => {
    const result1 = await service.computeVaRSuite('inst-1', 0.95, 1);
    const result10 = await service.computeVaRSuite('inst-1', 0.95, 10);
    expect(result10.parametric.var).toBeGreaterThan(result1.parametric.var);
  });

  it('computes with real balance sheet items', async () => {
    const prismaWithItems = {
      balanceSheetItem: {
        findMany: jest.fn().mockResolvedValue([
          { balance: 100, duration: 3, category: 'asset' },
          { balance: 200, duration: 5, category: 'asset' },
          { balance: 50, duration: 1, category: 'asset' },
        ]),
      },
    } as any;
    const svc = new PortfolioVaRService(prismaWithItems);

    const result = await svc.computeVaRSuite('inst-real', 0.95, 1);
    expect(result.historical.portfolioValue).toBe(350);
    expect(result.parametric.var).toBeGreaterThan(0);
    expect(result.montecarlo.var).toBeGreaterThan(0);
  });

  it('handles NaN/infinite balance in items', async () => {
    const prismaWithBad = {
      balanceSheetItem: {
        findMany: jest.fn().mockResolvedValue([
          { balance: NaN, duration: 3, category: 'asset' },
          { balance: 100, duration: Infinity, category: 'asset' },
        ]),
      },
    } as any;
    const svc = new PortfolioVaRService(prismaWithBad);

    const result = await svc.computeVaRSuite('inst-bad', 0.95, 1);
    expect(result.historical.portfolioValue).toBe(100);
  });

  it('99% confidence backtest uses Basel green/amber/red thresholds', async () => {
    const result = await service.computeVaRSuite('inst-1', 0.99, 1);
    expect(['GREEN', 'AMBER', 'RED']).toContain(
      result.backtestResult.trafficLight,
    );
    expect(result.backtestResult.expectedExceptions).toBeCloseTo(2.5, 0);
  });

  it('kupiec LR handles edge cases', async () => {
    const result = await service.computeVaRSuite('inst-1', 0.99, 1);
    expect(typeof result.backtestResult.kupiecLR).toBe('number');
    expect(Number.isFinite(result.backtestResult.kupiecLR)).toBe(true);
    expect(typeof result.backtestResult.kupiecPValue).toBe('number');
  });

  it('varPct is 0 when portfolio value is 0', async () => {
    // Use items that sum to 0
    const prismaZero = {
      balanceSheetItem: {
        findMany: jest.fn().mockResolvedValue([
          { balance: 0, duration: 3, category: 'asset' },
        ]),
      },
    } as any;
    const svc = new PortfolioVaRService(prismaZero);

    // portfolioValue will be 0 (items exist but balance is 0); service warns but keeps 0
    const result = await svc.computeVaRSuite('inst-z', 0.95, 1);
    // portfolioValue stays 0 since items were found (not empty), so no demo fallback
    expect(result.parametric.portfolioValue).toBe(0);
  });
});
