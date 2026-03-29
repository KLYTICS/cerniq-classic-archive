import { ScenarioPnLService } from './scenario-pnl.service';

describe('ScenarioPnLService', () => {
  let service: ScenarioPnLService;

  beforeEach(() => {
    service = new ScenarioPnLService();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('decomposes PnL into risk factor contributions', () => {
    const result = service.attribute({
      totalPnL: 10_000_000,
      rateContribution: 6_000_000,
      spreadContribution: 2_000_000,
      creditContribution: 1_500_000,
      fxContribution: 200_000,
    });

    expect(result.factors).toHaveLength(5); // rate, spread, credit, fx, residual
    expect(result.residual).toBeCloseTo(300_000, 0);
    expect(result.dominantFactor).toBe('Interest Rate');
    expect(result.interpretation).toContain('P&L');
    expect(result.interpretationEs).toContain('P&L');
  });

  it('residual captures unexplained PnL', () => {
    const result = service.attribute({
      totalPnL: 5_000_000,
      rateContribution: 2_000_000,
      spreadContribution: 1_000_000,
      creditContribution: 500_000,
    });

    // No FX, so explained = 3.5M, residual = 1.5M
    expect(result.residual).toBeCloseTo(1_500_000, 0);
    const residualFactor = result.factors.find((f) => f.name === 'Residual');
    expect(residualFactor).toBeDefined();
    expect(residualFactor!.pct).toBeCloseTo(30, 0);
  });

  it('identifies dominant factor by absolute amount', () => {
    const result = service.attribute({
      totalPnL: -8_000_000,
      rateContribution: -2_000_000,
      spreadContribution: -1_000_000,
      creditContribution: -6_000_000,
    });

    expect(result.dominantFactor).toBe('Credit Events');
  });

  it('handles zero FX contribution by default', () => {
    const result = service.attribute({
      totalPnL: 1_000_000,
      rateContribution: 500_000,
      spreadContribution: 300_000,
      creditContribution: 200_000,
    });

    const fx = result.factors.find((f) => f.name === 'FX');
    expect(fx!.amount).toBe(0);
    expect(result.residual).toBeCloseTo(0, 0);
  });

  it('all factors have bilingual names', () => {
    const result = service.attribute({
      totalPnL: 1_000_000,
      rateContribution: 500_000,
      spreadContribution: 300_000,
      creditContribution: 200_000,
    });

    for (const factor of result.factors) {
      expect(typeof factor.name).toBe('string');
      expect(typeof factor.nameEs).toBe('string');
      expect(factor.name.length).toBeGreaterThan(0);
      expect(factor.nameEs.length).toBeGreaterThan(0);
    }
  });
});
