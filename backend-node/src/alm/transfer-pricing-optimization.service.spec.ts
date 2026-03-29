import {
  TransferPricingOptimizationService,
  TransferPricingParams,
} from './transfer-pricing-optimization.service';

// ─── Test fixtures ──────────────────────────────────────────────────

const BASE_PARAMS: TransferPricingParams = {
  fundingCurve: [
    { tenor: 0.25, rate: 0.03 },
    { tenor: 1, rate: 0.035 },
    { tenor: 2, rate: 0.038 },
    { tenor: 5, rate: 0.042 },
    { tenor: 10, rate: 0.045 },
  ],
  assets: [
    { name: 'Auto Loans', balance: 20_000_000, yield: 0.065, maturityYears: 3 },
    {
      name: 'Fixed Mortgages',
      balance: 50_000_000,
      yield: 0.045,
      maturityYears: 7,
    },
    {
      name: 'Commercial Lines',
      balance: 30_000_000,
      yield: 0.07,
      maturityYears: 1,
    },
  ],
  liabilities: [
    {
      name: 'Core Savings',
      balance: 40_000_000,
      cost: 0.004,
      maturityYears: 2,
    },
    {
      name: 'Money Market',
      balance: 20_000_000,
      cost: 0.012,
      maturityYears: 0.5,
    },
    { name: 'CDs', balance: 25_000_000, cost: 0.025, maturityYears: 1 },
  ],
  targetNIM: 0.035,
};

describe('TransferPricingOptimizationService', () => {
  let svc: TransferPricingOptimizationService;

  beforeEach(() => {
    svc = new TransferPricingOptimizationService();
  });

  // ─── Test 1: Returns FTP rates for all instruments ───────────────

  it('should return FTP rates for all assets and liabilities', () => {
    const result = svc.optimizeTransferPricing(BASE_PARAMS);
    // 3 assets + 3 liabilities = 6
    expect(result.optimalFTPRates).toHaveLength(6);
  });

  // ─── Test 2: FTP rates are interpolated from curve ───────────────

  it('should interpolate FTP rates from the funding curve at maturity', () => {
    const result = svc.optimizeTransferPricing(BASE_PARAMS);
    const autoLoans = result.optimalFTPRates.find(
      (r) => r.instrument === 'Auto Loans',
    )!;
    // 3-year maturity: between 2y (0.038) and 5y (0.042) → interpolated
    expect(autoLoans.ftpRate).toBeGreaterThan(0.038);
    expect(autoLoans.ftpRate).toBeLessThan(0.042);
  });

  // ─── Test 3: Asset spreads are yield minus FTP ───────────────────

  it('should compute asset spread as yield minus FTP rate', () => {
    const result = svc.optimizeTransferPricing(BASE_PARAMS);
    const autoLoans = result.optimalFTPRates.find(
      (r) => r.instrument === 'Auto Loans',
    )!;
    expect(autoLoans.spread).toBeCloseTo(0.065 - autoLoans.ftpRate, 4);
  });

  // ─── Test 4: Projected NIM is computed ───────────────────────────

  it('should compute projected NIM as net interest income / total assets', () => {
    const result = svc.optimizeTransferPricing(BASE_PARAMS);
    const totalAssets = 20_000_000 + 50_000_000 + 30_000_000;
    const expectedNIM =
      (result.totalInterestIncome - result.totalInterestExpense) / totalAssets;
    expect(result.projectedNIM).toBeCloseTo(expectedNIM, 4);
  });

  // ─── Test 5: NIM impact relative to target ──────────────────────

  it('should compute NIM impact as projected minus target', () => {
    const result = svc.optimizeTransferPricing(BASE_PARAMS);
    expect(result.nimImpact).toBeCloseTo(result.projectedNIM - 0.035, 4);
  });

  // ─── Test 6: Boundary — maturity below curve start ───────────────

  it('should use the shortest curve rate for maturities below curve start', () => {
    const rate = svc.interpolateRate(
      [
        { tenor: 1, rate: 0.03 },
        { tenor: 5, rate: 0.04 },
      ],
      0.25,
    );
    expect(rate).toBe(0.03);
  });

  // ─── Test 7: Boundary — maturity above curve end ─────────────────

  it('should use the longest curve rate for maturities above curve end', () => {
    const rate = svc.interpolateRate(
      [
        { tenor: 1, rate: 0.03 },
        { tenor: 5, rate: 0.04 },
      ],
      20,
    );
    expect(rate).toBe(0.04);
  });

  // ─── Test 8: Throws on empty funding curve ──────────────────────

  it('should throw when funding curve is empty', () => {
    const params: TransferPricingParams = {
      ...BASE_PARAMS,
      fundingCurve: [],
    };
    expect(() => svc.optimizeTransferPricing(params)).toThrow(
      'Funding curve must have at least one point',
    );
  });

  // ─── Test 9: Interest income and expense are positive ────────────

  it('should produce positive interest income and expense', () => {
    const result = svc.optimizeTransferPricing(BASE_PARAMS);
    expect(result.totalInterestIncome).toBeGreaterThan(0);
    expect(result.totalInterestExpense).toBeGreaterThan(0);
  });

  // ─── Test 10: Single-point curve returns that rate ───────────────

  it('should return the single curve rate when only one point exists', () => {
    const rate = svc.interpolateRate([{ tenor: 2, rate: 0.05 }], 5);
    expect(rate).toBe(0.05);
  });
});
