import {
  RegulatoryCapitalOptimizationService,
  CapitalOptimizationParams,
} from './regulatory-capital-optimization.service';

// ─── Test fixtures ──────────────────────────────────────────────────

const WELL_CAPITALIZED: CapitalOptimizationParams = {
  riskWeightedAssets: [
    { category: 'Residential Mortgages', balance: 80_000_000, riskWeight: 0.50 },
    { category: 'Commercial Loans', balance: 50_000_000, riskWeight: 1.00 },
    { category: 'Government Securities', balance: 30_000_000, riskWeight: 0.00 },
    { category: 'Consumer Loans', balance: 20_000_000, riskWeight: 0.75 },
  ],
  currentCapital: {
    tier1: 18_000_000,
    tier2: 4_000_000,
    totalAssets: 200_000_000,
  },
  targetRatios: {
    minTier1: 0.06,
    minTotalCapital: 0.08,
    minLeverage: 0.04,
  },
  constraints: {
    maxRWAGrowth: 0.10,
    maxConcentration: 0.25,
  },
};

describe('RegulatoryCapitalOptimizationService', () => {
  let svc: RegulatoryCapitalOptimizationService;

  beforeEach(() => {
    svc = new RegulatoryCapitalOptimizationService();
  });

  // ─── Test 1: Computes RWA correctly ──────────────────────────────

  it('should compute total RWA as sum of balance × riskWeight', () => {
    const result = svc.optimizeCapital(WELL_CAPITALIZED);
    // 80M*0.5 + 50M*1.0 + 30M*0.0 + 20M*0.75 = 40M + 50M + 0 + 15M = 105M
    expect(result.totalRWA).toBe(105_000_000);
  });

  // ─── Test 2: Tier 1 ratio computed correctly ─────────────────────

  it('should compute tier 1 ratio as tier1 capital / RWA', () => {
    const result = svc.optimizeCapital(WELL_CAPITALIZED);
    const expected = 18_000_000 / 105_000_000;
    expect(result.tier1Ratio).toBeCloseTo(expected, 4);
  });

  // ─── Test 3: Total capital ratio computed correctly ───────────────

  it('should compute total capital ratio as (tier1+tier2) / RWA', () => {
    const result = svc.optimizeCapital(WELL_CAPITALIZED);
    const expected = 22_000_000 / 105_000_000;
    expect(result.totalCapitalRatio).toBeCloseTo(expected, 4);
  });

  // ─── Test 4: Leverage ratio computed correctly ───────────────────

  it('should compute leverage ratio as tier1 / total assets', () => {
    const result = svc.optimizeCapital(WELL_CAPITALIZED);
    const expected = 18_000_000 / 200_000_000;
    expect(result.leverageRatio).toBeCloseTo(expected, 4);
  });

  // ─── Test 5: Well-capitalized flag set correctly ─────────────────

  it('should flag as well-capitalized when all ratios exceed minimums', () => {
    const result = svc.optimizeCapital(WELL_CAPITALIZED);
    expect(result.wellCapitalized).toBe(true);
  });

  // ─── Test 6: Undercapitalized detection ──────────────────────────

  it('should flag as not well-capitalized when tier1 is insufficient', () => {
    const params: CapitalOptimizationParams = {
      ...WELL_CAPITALIZED,
      currentCapital: { tier1: 3_000_000, tier2: 1_000_000, totalAssets: 200_000_000 },
    };
    const result = svc.optimizeCapital(params);
    expect(result.wellCapitalized).toBe(false);
  });

  // ─── Test 7: Optimal allocation has all categories ───────────────

  it('should return an allocation entry for each asset category', () => {
    const result = svc.optimizeCapital(WELL_CAPITALIZED);
    expect(result.optimalAllocation).toHaveLength(4);
    expect(result.optimalAllocation.map((a) => a.category)).toContain('Residential Mortgages');
    expect(result.optimalAllocation.map((a) => a.category)).toContain('Government Securities');
  });

  // ─── Test 8: Zero risk-weight assets have zero RWA ───────────────

  it('should assign zero RWA to government securities (0% risk weight)', () => {
    const result = svc.optimizeCapital(WELL_CAPITALIZED);
    const govtAlloc = result.optimalAllocation.find((a) => a.category === 'Government Securities')!;
    expect(govtAlloc.rwa).toBe(0);
    expect(govtAlloc.capitalCharge).toBe(0);
  });

  // ─── Test 9: Capital surplus computed correctly ──────────────────

  it('should compute capital surplus as total capital minus required capital', () => {
    const result = svc.optimizeCapital(WELL_CAPITALIZED);
    // Required = 105M × 0.08 = 8.4M, Total capital = 22M, Surplus = 13.6M
    expect(result.capitalSurplus).toBeCloseTo(13_600_000, 0);
  });

  // ─── Test 10: Stress test detects breach ─────────────────────────

  it('should detect capital ratio breach under stress', () => {
    const result = svc.stressTestCapital(WELL_CAPITALIZED, 0.15);
    // Loss = 105M × 0.15 = 15.75M, stressed T1 = 18M - 15.75M = 2.25M
    // Stressed T1 ratio = 2.25M / 105M ≈ 0.0214 < 0.06
    expect(result.breachesMinimum).toBe(true);
    expect(result.stressedTier1Ratio).toBeLessThan(WELL_CAPITALIZED.targetRatios.minTier1);
  });

  // ─── Test 11: Throws on empty RWA ───────────────────────────────

  it('should throw when no risk-weighted asset categories are provided', () => {
    const params: CapitalOptimizationParams = {
      ...WELL_CAPITALIZED,
      riskWeightedAssets: [],
    };
    expect(() => svc.optimizeCapital(params)).toThrow('At least one risk-weighted asset');
  });
});
