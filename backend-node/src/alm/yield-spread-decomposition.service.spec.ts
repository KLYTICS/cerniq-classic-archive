import {
  YieldSpreadDecompositionService,
  SpreadDecompositionParams,
} from './yield-spread-decomposition.service';

// ─── Test fixtures ──────────────────────────────────────────────────

const CORPORATE_BOND: SpreadDecompositionParams = {
  bondYield: 0.055,
  treasuryYield: 0.04,
  swapRate: 0.042,
};

const HIGH_YIELD: SpreadDecompositionParams = {
  bondYield: 0.09,
  treasuryYield: 0.04,
  swapRate: 0.043,
  optionCost: 0.002,
  liquidityFactor: 0.5,
};

describe('YieldSpreadDecompositionService', () => {
  let svc: YieldSpreadDecompositionService;

  beforeEach(() => {
    svc = new YieldSpreadDecompositionService();
  });

  // ─── Test 1: Total spread = bond yield - treasury yield ──────────

  it('should compute total spread as bond yield minus treasury yield', () => {
    const result = svc.decomposeSpread(CORPORATE_BOND);
    expect(result.totalSpread).toBeCloseTo(0.015, 6);
  });

  // ─── Test 2: Swap spread computed correctly ──────────────────────

  it('should compute swap spread as swap rate minus treasury yield', () => {
    const result = svc.decomposeSpread(CORPORATE_BOND);
    expect(result.swapSpread).toBeCloseTo(0.002, 6);
  });

  // ─── Test 3: Credit spread = total - swap spread ─────────────────

  it('should compute credit spread as total spread minus swap spread', () => {
    const result = svc.decomposeSpread(CORPORATE_BOND);
    // 0.015 - 0.002 = 0.013
    expect(result.creditSpread).toBeCloseTo(0.013, 6);
  });

  // ─── Test 4: Components sum to total ─────────────────────────────

  it('should have components that sum to the total spread', () => {
    const result = svc.decomposeSpread(CORPORATE_BOND);
    const sum =
      result.creditSpread +
      result.liquidityPremium +
      result.optionCost +
      result.residual;
    expect(sum).toBeCloseTo(result.totalSpread, 6);
  });

  // ─── Test 5: Liquidity premium uses factor ───────────────────────

  it('should compute liquidity premium as swap spread times liquidity factor', () => {
    const result = svc.decomposeSpread(CORPORATE_BOND);
    // Default factor 0.4, swap spread 0.002 → liquidity = 0.0008
    expect(result.liquidityPremium).toBeCloseTo(0.0008, 6);
  });

  // ─── Test 6: Option cost flows through ───────────────────────────

  it('should include user-provided option cost', () => {
    const result = svc.decomposeSpread(HIGH_YIELD);
    expect(result.optionCost).toBeCloseTo(0.002, 6);
  });

  // ─── Test 7: High-yield bond has larger credit spread ────────────

  it('should produce a larger credit spread for high-yield bonds', () => {
    const ig = svc.decomposeSpread(CORPORATE_BOND);
    const hy = svc.decomposeSpread(HIGH_YIELD);
    expect(hy.creditSpread).toBeGreaterThan(ig.creditSpread);
  });

  // ─── Test 8: Multiple decompositions compute averages ────────────

  it('should compute average credit spread across multiple bonds', () => {
    const result = svc.decomposeMultiple([CORPORATE_BOND, HIGH_YIELD]);
    expect(result.decompositions).toHaveLength(2);
    expect(result.averageCreditSpread).toBeGreaterThan(0);
    expect(result.averageTotalSpread).toBeGreaterThan(0);
  });

  // ─── Test 9: Throws on empty bonds array ─────────────────────────

  it('should throw when no bonds are provided to decomposeMultiple', () => {
    expect(() => svc.decomposeMultiple([])).toThrow('At least one bond');
  });

  // ─── Test 10: Zero spread when yields are equal ──────────────────

  it('should produce zero total spread when bond yield equals treasury yield', () => {
    const result = svc.decomposeSpread({
      bondYield: 0.04,
      treasuryYield: 0.04,
      swapRate: 0.04,
    });
    expect(result.totalSpread).toBe(0);
    expect(result.creditSpread).toBe(0);
  });
});
