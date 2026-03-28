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
});
