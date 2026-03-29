import { TermPremiumService, TermPremiumParams } from './term-premium.service';

// ─── Test fixtures ──────────────────────────────────────────────────

const NORMAL_CURVE: TermPremiumParams = {
  yields: [
    { maturity: 0.25, rate: 0.03 },
    { maturity: 1, rate: 0.035 },
    { maturity: 2, rate: 0.038 },
    { maturity: 5, rate: 0.042 },
    { maturity: 10, rate: 0.045 },
  ],
};

const INVERTED_CURVE: TermPremiumParams = {
  yields: [
    { maturity: 0.25, rate: 0.05 },
    { maturity: 1, rate: 0.048 },
    { maturity: 2, rate: 0.045 },
    { maturity: 5, rate: 0.04 },
    { maturity: 10, rate: 0.038 },
  ],
};

const FLAT_CURVE: TermPremiumParams = {
  yields: [
    { maturity: 1, rate: 0.04 },
    { maturity: 5, rate: 0.04 },
    { maturity: 10, rate: 0.04 },
  ],
};

describe('TermPremiumService', () => {
  let svc: TermPremiumService;

  beforeEach(() => {
    svc = new TermPremiumService();
  });

  // ─── Test 1: Returns term premium for each maturity ──────────────

  it('should return a term premium point for each yield maturity', () => {
    const result = svc.estimateTermPremium(NORMAL_CURVE);
    expect(result.termPremiums).toHaveLength(5);
    expect(result.expectedRateComponent).toHaveLength(5);
  });

  // ─── Test 2: Curve slope is positive for normal curve ────────────

  it('should compute positive slope for a normal yield curve', () => {
    const result = svc.estimateTermPremium(NORMAL_CURVE);
    expect(result.curveSlope).toBeGreaterThan(0);
    expect(result.curveSlope).toBeCloseTo(0.015, 3);
  });

  // ─── Test 3: Curve slope is negative for inverted curve ──────────

  it('should compute negative slope for an inverted yield curve', () => {
    const result = svc.estimateTermPremium(INVERTED_CURVE);
    expect(result.curveSlope).toBeLessThan(0);
  });

  // ─── Test 4: Flat curve has zero slope ───────────────────────────

  it('should compute zero slope for a flat yield curve', () => {
    const result = svc.estimateTermPremium(FLAT_CURVE);
    expect(result.curveSlope).toBe(0);
  });

  // ─── Test 5: Average premium is computed ─────────────────────────

  it('should compute average term premium across all maturities', () => {
    const result = svc.estimateTermPremium(NORMAL_CURVE);
    const manualAvg =
      result.termPremiums.reduce((s, tp) => s + tp.premium, 0) /
      result.termPremiums.length;
    expect(result.averagePremium).toBeCloseTo(manualAvg, 5);
  });

  // ─── Test 6: Shortest maturity has zero/small premium ────────────

  it('should assign near-zero term premium to the shortest maturity', () => {
    const result = svc.estimateTermPremium(NORMAL_CURVE);
    // The first point's expected rate = itself, so premium = 0
    expect(result.termPremiums[0].premium).toBe(0);
  });

  // ─── Test 7: Expected rate component is reasonable ───────────────

  it('should compute expected rate component within reasonable bounds', () => {
    const result = svc.estimateTermPremium(NORMAL_CURVE);
    for (const erc of result.expectedRateComponent) {
      expect(erc.expectedRate).toBeGreaterThan(0);
      expect(erc.expectedRate).toBeLessThan(0.1);
    }
  });

  // ─── Test 8: Throws on insufficient data ─────────────────────────

  it('should throw when fewer than 2 yield points are provided', () => {
    expect(() =>
      svc.estimateTermPremium({ yields: [{ maturity: 1, rate: 0.03 }] }),
    ).toThrow('At least two yield points');
  });

  // ─── Test 9: Inversion risk detected ─────────────────────────────

  it('should detect inversion in an inverted curve', () => {
    const result = svc.assessInversionRisk(INVERTED_CURVE);
    expect(result.inverted).toBe(true);
    expect(result.inversionPoints.length).toBeGreaterThan(0);
  });

  // ─── Test 10: No inversion in normal curve ──────────────────────

  it('should not detect inversion in a normal curve', () => {
    const result = svc.assessInversionRisk(NORMAL_CURVE);
    expect(result.inverted).toBe(false);
    expect(result.inversionPoints).toHaveLength(0);
  });
});
