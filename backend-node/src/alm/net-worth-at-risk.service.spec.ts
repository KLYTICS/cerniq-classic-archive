import { NetWorthAtRiskService } from './net-worth-at-risk.service';

describe('NetWorthAtRiskService', () => {
  let service: NetWorthAtRiskService;

  const baseParams = {
    assets: 100_000_000,
    liabilities: 90_000_000,
    equity: 10_000_000,
    durationGap: 2.5,
    rateVolatility: 0.01,
  };

  beforeEach(() => {
    service = new NetWorthAtRiskService();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('NWaR should be positive for non-zero duration gap', () => {
    const result = service.calculateNWaR(baseParams);
    expect(result.nwar).toBeGreaterThan(0);
    expect(result.nwarPct).toBeGreaterThan(0);
  });

  it('equity at risk should be less than equity', () => {
    const result = service.calculateNWaR(baseParams);
    expect(result.equityAtRisk).toBeLessThan(baseParams.equity);
  });

  it('higher rate volatility should produce higher NWaR', () => {
    const lowVol = service.calculateNWaR({
      ...baseParams,
      rateVolatility: 0.005,
    });
    const highVol = service.calculateNWaR({
      ...baseParams,
      rateVolatility: 0.02,
    });
    expect(highVol.nwar).toBeGreaterThan(lowVol.nwar);
  });

  it('higher duration gap should produce higher NWaR', () => {
    const shortGap = service.calculateNWaR({ ...baseParams, durationGap: 1.0 });
    const longGap = service.calculateNWaR({ ...baseParams, durationGap: 5.0 });
    expect(longGap.nwar).toBeGreaterThan(shortGap.nwar);
  });

  it('break-even shock should be positive', () => {
    const result = service.calculateNWaR(baseParams);
    expect(result.breakEvenShock).toBeGreaterThan(0);
    expect(result.breakEvenShock).toBeLessThan(1);
  });

  it('should assign correct risk rating', () => {
    // Low risk: small duration gap
    const low = service.calculateNWaR({
      ...baseParams,
      durationGap: 0.1,
      rateVolatility: 0.005,
    });
    expect(low.riskRating).toBe('Low');

    // High risk: large duration gap
    const high = service.calculateNWaR({
      ...baseParams,
      durationGap: 5.0,
      rateVolatility: 0.03,
    });
    expect(['High', 'Critical']).toContain(high.riskRating);
  });

  it('duration gap computation should be correct', () => {
    const gap = service.computeDurationGap({
      assetDuration: 4.0,
      liabilityDuration: 2.0,
      assets: 100_000_000,
      liabilities: 90_000_000,
    });
    // Gap = 4.0 - (90/100) * 2.0 = 4.0 - 1.8 = 2.2
    expect(gap).toBeCloseTo(2.2, 2);
  });

  it('stress test should return results for each shock', () => {
    const results = service.stressTestNWaR({
      ...baseParams,
      rateShocks: [0.01, 0.02, 0.03, -0.01],
    });
    expect(results).toHaveLength(4);
    // Positive shock with positive duration gap should reduce equity
    expect(results[0].equityImpact).toBeLessThan(0);
    // Negative shock with positive duration gap should increase equity
    expect(results[3].equityImpact).toBeGreaterThan(0);
  });
});
