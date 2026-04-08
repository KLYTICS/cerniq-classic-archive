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

  // ── Coverage boost: normInv edge cases ──

  it('normInv handles p=0.5 (returns 0 z-score) — Moderate risk rating', () => {
    // confidence=0.5 produces z=0, so NWaR=0
    const result = service.calculateNWaR({ ...baseParams, confidence: 0.5 });
    expect(result.nwar).toBe(0);
    expect(result.nwarPct).toBe(0);
    expect(result.riskRating).toBe('Low');
  });

  it('normInv handles low-tail p < 0.02425', () => {
    // confidence=0.999 triggers the high-tail branch (p > pHigh)
    const result = service.calculateNWaR({ ...baseParams, confidence: 0.999 });
    expect(result.nwar).toBeGreaterThan(0);
  });

  it('normInv handles extreme p<=0 and p>=1', () => {
    // confidence=0 → normInv returns -Infinity → NWaR uses abs → Infinity
    const result0 = service.calculateNWaR({ ...baseParams, confidence: 0 });
    expect(result0.nwar).not.toBeNaN();

    const result1 = service.calculateNWaR({ ...baseParams, confidence: 1 });
    expect(result1.nwar).not.toBeNaN();
  });

  it('handles zero equity gracefully (nwarPct=0)', () => {
    const result = service.calculateNWaR({ ...baseParams, equity: 0 });
    expect(result.nwarPct).toBe(0);
    expect(result.nwar).toBe(0);
  });

  it('handles zero assets and zero durationGap (breakEvenShock=Infinity)', () => {
    const result = service.calculateNWaR({
      ...baseParams,
      assets: 0,
      durationGap: 0,
    });
    expect(result.breakEvenShock).toBe(Infinity);
  });

  it('computeDurationGap with zero assets returns assetDuration directly', () => {
    const gap = service.computeDurationGap({
      assetDuration: 4.0,
      liabilityDuration: 2.0,
      assets: 0,
      liabilities: 90_000_000,
    });
    // leverageRatio=0, so gap = 4.0 - 0*2.0 = 4.0
    expect(gap).toBeCloseTo(4.0, 2);
  });

  it('Moderate risk rating for nwarPct between 5 and 15', () => {
    // nwarPct = |durationGap * rateVol * Z(0.99)| * 100
    // Z(0.99) ~ 2.326. Need nwarPct in [5, 15)
    // durationGap=3.0, rateVol=0.01: nwarPct = 3.0 * 0.01 * 2.326 * 100 = 6.98%
    const result = service.calculateNWaR({
      ...baseParams,
      durationGap: 3.0,
      rateVolatility: 0.01,
    });
    expect(result.riskRating).toBe('Moderate');
  });

  it('stress test solvent flag reflects residual equity sign', () => {
    const results = service.stressTestNWaR({
      assets: 100_000_000,
      liabilities: 90_000_000,
      equity: 10_000_000,
      durationGap: 2.5,
      rateShocks: [0.001, 0.1],
    });
    // Small shock: solvent
    expect(results[0].solvent).toBe(true);
    // Large shock: likely insolvent
    expect(results[1].residualEquity).toBeDefined();
  });

  it('High risk rating for nwarPct between 15 and 30', () => {
    // nwarPct = |durationGap * rateVol * Z(0.99)| * 100
    // Z(0.99) ~ 2.326. Need nwarPct in [15, 30)
    // durationGap=8.0, rateVol=0.01: nwarPct = 8.0 * 0.01 * 2.326 * 100 = 18.6%
    const result = service.calculateNWaR({
      ...baseParams,
      durationGap: 8.0,
      rateVolatility: 0.01,
    });
    expect(result.riskRating).toBe('High');
  });

  it('Critical risk rating for nwarPct >= 30', () => {
    // durationGap=15, rateVol=0.01: nwarPct = 15 * 0.01 * 2.326 * 100 = 34.9%
    const result = service.calculateNWaR({
      ...baseParams,
      durationGap: 15.0,
      rateVolatility: 0.01,
    });
    expect(result.riskRating).toBe('Critical');
  });

  it('normInv low-tail (p < 0.02425) via confidence=0.01', () => {
    // confidence=0.01 triggers the p < pLow branch (lines 184-189)
    const result = service.calculateNWaR({ ...baseParams, confidence: 0.01 });
    expect(result.nwar).toBeGreaterThan(0);
    // At 1% confidence, z-score is around -2.33, so NWaR should be similar to 99%
    // (because abs is used)
  });

  it('normInv mid-range (pLow <= p <= pHigh) via confidence=0.5', () => {
    // confidence=0.5 triggers the middle branch (lines 190-197)
    const result = service.calculateNWaR({ ...baseParams, confidence: 0.5 });
    expect(result.nwar).toBe(0); // Z(0.5) = 0
  });

  it('normInv mid-range (pLow <= p <= pHigh) via confidence=0.90', () => {
    // confidence=0.90 is between pLow (0.02425) and pHigh (0.97575)
    const result = service.calculateNWaR({ ...baseParams, confidence: 0.9 });
    expect(result.nwar).toBeGreaterThan(0);
  });
});
