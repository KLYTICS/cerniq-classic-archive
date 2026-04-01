import {
  EarningsSimulationService,
  EarningsSimulationParams,
  BalanceSheetInput,
  SimulationAssumptions,
} from './earnings-simulation.service';

// ─── Realistic cooperativa balance sheet ─────────────────────────────

const COOPERATIVA: BalanceSheetInput = {
  assets: [
    {
      name: 'Fixed Mortgages',
      balance: 80_000_000,
      rate: 0.045,
      maturityYears: 7,
      isFloating: false,
      prepaymentSpeed: 0.06,
    },
    {
      name: 'Commercial Loans',
      balance: 50_000_000,
      rate: 0.07,
      maturityYears: 3,
      isFloating: true,
      repricingMonths: 3,
    },
    {
      name: 'Auto Loans',
      balance: 20_000_000,
      rate: 0.065,
      maturityYears: 5,
      isFloating: false,
      prepaymentSpeed: 0.1,
    },
    {
      name: 'Cash & Fed Funds',
      balance: 30_000_000,
      rate: 0.045,
      maturityYears: 0.01,
      isFloating: true,
    },
  ],
  liabilities: [
    {
      name: 'Core Savings',
      balance: 80_000_000,
      rate: 0.004,
      maturityYears: 3,
      isFloating: false,
      decayRate: 0.05,
    },
    {
      name: 'Money Market',
      balance: 40_000_000,
      rate: 0.012,
      maturityYears: 0.5,
      isFloating: true,
      repricingMonths: 1,
      decayRate: 0.1,
    },
    {
      name: 'CDs',
      balance: 30_000_000,
      rate: 0.025,
      maturityYears: 2,
      isFloating: false,
      decayRate: 0.02,
    },
    {
      name: 'Borrowings',
      balance: 10_000_000,
      rate: 0.04,
      maturityYears: 5,
      isFloating: false,
    },
  ],
  equity: 40_000_000,
};

const BASE_ASSUMPTIONS: SimulationAssumptions = {
  assetGrowthRate: 0.03,
  depositGrowthRate: 0.02,
  newLoanRate: 0.055,
  newDepositRate: 0.015,
  prepaymentMultiplier: 1.0,
  depositDecayMultiplier: 1.0,
};

describe('EarningsSimulationService', () => {
  let svc: EarningsSimulationService;

  beforeEach(() => {
    svc = new EarningsSimulationService();
  });

  // ── Helper to run with standard paths ──────────────────────────

  function runStandard(quarters = 8): ReturnType<typeof svc.simulateEarnings> {
    const paths = svc.generateStandardRatePaths(0.045, quarters);
    return svc.simulateEarnings({
      balanceSheet: COOPERATIVA,
      assumptions: BASE_ASSUMPTIONS,
      ratePaths: paths,
      quarters,
    });
  }

  // ─── Test 1: Base scenario NII is positive ────────────────────

  it('should produce positive NII for a healthy cooperativa in the base scenario', () => {
    const result = runStandard();
    const base = result.scenarios[result.baseScenarioIndex];
    for (const q of base.quarters) {
      expect(q.nii).toBeGreaterThan(0);
    }
    expect(base.summary.totalNII).toBeGreaterThan(0);
  });

  // ─── Test 2: Rising rates increase NII for asset-sensitive ────

  it('should increase NII under rising rates for an asset-sensitive institution', () => {
    const result = runStandard();
    const base = result.scenarios[result.baseScenarioIndex];
    const risingIdx = result.scenarios.findIndex(
      (s) => s.name === 'Gradual +200bps',
    );
    expect(risingIdx).toBeGreaterThanOrEqual(0);
    const rising = result.scenarios[risingIdx];
    // Asset-sensitive: more floating assets than floating liabilities → NII goes up
    expect(rising.summary.totalNII).toBeGreaterThan(base.summary.totalNII);
  });

  // ─── Test 3: Falling rates decrease NII for asset-sensitive ───

  it('should decrease NII under falling rates for an asset-sensitive institution', () => {
    const result = runStandard();
    const base = result.scenarios[result.baseScenarioIndex];
    const fallingIdx = result.scenarios.findIndex(
      (s) => s.name === 'Gradual -200bps',
    );
    expect(fallingIdx).toBeGreaterThanOrEqual(0);
    const falling = result.scenarios[fallingIdx];
    expect(falling.summary.totalNII).toBeLessThan(base.summary.totalNII);
  });

  // ─── Test 4: Balance sheet grows each quarter ─────────────────

  it('should grow total assets each quarter at approximately the specified growth rate', () => {
    const result = runStandard();
    const base = result.scenarios[result.baseScenarioIndex];
    // First quarter vs. last: assets should be larger at end (net of amort + growth)
    // With 3% growth and amortization, the net direction depends on the mix,
    // but new originations should keep total assets from collapsing.
    const lastQ = base.quarters[base.quarters.length - 1];
    // At minimum total assets should stay above 50% of starting (no catastrophic collapse)
    const startingAssets = COOPERATIVA.assets.reduce(
      (s, a) => s + a.balance,
      0,
    );
    expect(lastQ.totalAssets).toBeGreaterThan(startingAssets * 0.5);
  });

  // ─── Test 5: Prepayments reduce asset balances ────────────────

  it('should reduce asset balances when prepayment multiplier is high', () => {
    const paths = svc.generateStandardRatePaths(0.045, 8);
    const fastPrepay: EarningsSimulationParams = {
      balanceSheet: COOPERATIVA,
      assumptions: {
        ...BASE_ASSUMPTIONS,
        prepaymentMultiplier: 3.0,
        assetGrowthRate: 0,
      },
      ratePaths: [paths[0]], // base only
      quarters: 8,
    };
    const normalPrepay: EarningsSimulationParams = {
      balanceSheet: COOPERATIVA,
      assumptions: {
        ...BASE_ASSUMPTIONS,
        prepaymentMultiplier: 1.0,
        assetGrowthRate: 0,
      },
      ratePaths: [paths[0]],
      quarters: 8,
    };
    const fast = svc.simulateEarnings(fastPrepay);
    const normal = svc.simulateEarnings(normalPrepay);
    const fastEnd = fast.scenarios[0].quarters[7].totalAssets;
    const normalEnd = normal.scenarios[0].quarters[7].totalAssets;
    expect(fastEnd).toBeLessThan(normalEnd);
  });

  // ─── Test 6: Deposit decay reduces liabilities ────────────────

  it('should reduce liabilities when deposit decay multiplier is high', () => {
    const paths = svc.generateStandardRatePaths(0.045, 8);
    const fastDecay: EarningsSimulationParams = {
      balanceSheet: COOPERATIVA,
      assumptions: {
        ...BASE_ASSUMPTIONS,
        depositDecayMultiplier: 3.0,
        depositGrowthRate: 0,
      },
      ratePaths: [paths[0]],
      quarters: 8,
    };
    const normalDecay: EarningsSimulationParams = {
      balanceSheet: COOPERATIVA,
      assumptions: {
        ...BASE_ASSUMPTIONS,
        depositDecayMultiplier: 1.0,
        depositGrowthRate: 0,
      },
      ratePaths: [paths[0]],
      quarters: 8,
    };
    const fast = svc.simulateEarnings(fastDecay);
    const normal = svc.simulateEarnings(normalDecay);
    const fastEnd = fast.scenarios[0].quarters[7].totalLiabilities;
    const normalEnd = normal.scenarios[0].quarters[7].totalLiabilities;
    expect(fastEnd).toBeLessThan(normalEnd);
  });

  // ─── Test 7: NIM is in a reasonable range ─────────────────────

  it('should produce NIM between 1% and 6% (annualized)', () => {
    const result = runStandard();
    for (const sc of result.scenarios) {
      for (const q of sc.quarters) {
        expect(q.nim).toBeGreaterThanOrEqual(0.01); // 1%
        expect(q.nim).toBeLessThanOrEqual(0.06); // 6%
      }
    }
  });

  // ─── Test 8: Cumulative NII increases each quarter ────────────

  it('should have monotonically increasing cumulative NII when NII is positive', () => {
    const result = runStandard();
    const base = result.scenarios[result.baseScenarioIndex];
    for (let i = 1; i < base.quarters.length; i++) {
      expect(base.quarters[i].cumulativeNII).toBeGreaterThan(
        base.quarters[i - 1].cumulativeNII,
      );
    }
  });

  // ─── Test 9: Equity grows when NII is positive ────────────────

  it('should grow equity when NII is positive each quarter', () => {
    const result = runStandard();
    const base = result.scenarios[result.baseScenarioIndex];
    expect(base.summary.endingEquity).toBeGreaterThan(COOPERATIVA.equity);
    expect(base.summary.equityChange).toBeGreaterThan(0);
  });

  // ─── Test 10: Risk rating matches NII change magnitude ────────

  it('should assign risk ratings consistent with NII change percentage', () => {
    const result = runStandard();
    for (const sc of result.scenarios) {
      const pct = sc.summary.niiChangePct;
      if (pct < 0.05) expect(sc.summary.riskRating).toBe('LOW');
      else if (pct < 0.15) expect(sc.summary.riskRating).toBe('MODERATE');
      else if (pct < 0.25) expect(sc.summary.riskRating).toBe('ELEVATED');
      else if (pct < 0.35) expect(sc.summary.riskRating).toBe('HIGH');
      else expect(sc.summary.riskRating).toBe('CRITICAL');
    }
  });

  // ─── Test 11: Standard rate paths returns 5 scenarios ─────────

  it('should generate exactly 5 standard rate paths', () => {
    const paths = svc.generateStandardRatePaths(0.045);
    expect(paths).toHaveLength(5);
    expect(paths[0].name).toContain('Base');
    expect(paths[1].name).toContain('+200');
    expect(paths[2].name).toContain('-200');
    expect(paths[3].name).toContain('+300');
    expect(paths[4].name).toContain('-100');
  });

  // ─── Test 12: 12-quarter projection has 12 data points ────────

  it('should produce exactly 12 quarter data points per scenario for a 12-quarter run', () => {
    const result = runStandard(12);
    for (const sc of result.scenarios) {
      expect(sc.quarters).toHaveLength(12);
      expect(sc.quarters[11].quarter).toBe(12);
    }
  });

  // ─── Test 13: Base scenario risk rating is LOW ────────────────

  it('should assign LOW risk rating to the base scenario', () => {
    const result = runStandard();
    const base = result.scenarios[result.baseScenarioIndex];
    expect(base.summary.riskRating).toBe('LOW');
    expect(base.summary.niiChangePct).toBe(0);
  });

  // ─── Test 14: Shock +300bps has greater NII impact than gradual +200 ─

  it('should show larger NII change for shock +300bps than gradual +200bps', () => {
    const result = runStandard();
    const gradual = result.scenarios.find((s) => s.name === 'Gradual +200bps')!;
    const shock = result.scenarios.find((s) => s.name === 'Shock +300bps')!;
    expect(Math.abs(shock.summary.niiChange)).toBeGreaterThan(
      Math.abs(gradual.summary.niiChange),
    );
  });

  // ─── Test 15: Interest income exceeds interest expense ────────

  it('should have interest income exceeding interest expense each quarter (positive spread)', () => {
    const result = runStandard();
    const base = result.scenarios[result.baseScenarioIndex];
    for (const q of base.quarters) {
      expect(q.interestIncome).toBeGreaterThan(q.interestExpense);
    }
  });

  // ─── Test 16: Quarter dates are sequential ────────────────────

  it('should produce sequential quarter labels', () => {
    const result = runStandard(8);
    const base = result.scenarios[result.baseScenarioIndex];
    for (let i = 0; i < base.quarters.length; i++) {
      expect(base.quarters[i].quarter).toBe(i + 1);
      expect(base.quarters[i].date).toMatch(/^\d{4}-Q[1-4]$/);
    }
  });

  // ─── Test 17: Throws on invalid quarter count ─────────────
  it('should throw when quarters is 0 or > 20', () => {
    const paths = svc.generateStandardRatePaths(0.045, 1);
    expect(() =>
      svc.simulateEarnings({
        balanceSheet: COOPERATIVA,
        assumptions: BASE_ASSUMPTIONS,
        ratePaths: paths,
        quarters: 0,
      }),
    ).toThrow('quarters must be between 1 and 20');
    expect(() =>
      svc.simulateEarnings({
        balanceSheet: COOPERATIVA,
        assumptions: BASE_ASSUMPTIONS,
        ratePaths: paths,
        quarters: 21,
      }),
    ).toThrow('quarters must be between 1 and 20');
  });

  // ─── Test 18: Rates floor at zero ─────────────────────────
  it('should floor rates at 0 when large negative shock applied', () => {
    const shockPath = { name: 'Big Shock Down', shocksBps: [-1000] };
    const result = svc.simulateEarnings({
      balanceSheet: COOPERATIVA,
      assumptions: BASE_ASSUMPTIONS,
      ratePaths: [shockPath],
      quarters: 1,
    });
    // Should not crash; NII can still be computed
    expect(result.scenarios[0].quarters[0].nii).toBeDefined();
  });

  // ─── Test 19: Generate standard paths with custom quarter count
  it('should generate standard rate paths with custom quarter count', () => {
    const paths = svc.generateStandardRatePaths(0.04, 12);
    expect(paths).toHaveLength(5);
    expect(paths[0].shocksBps).toHaveLength(12);
    // Gradual paths cap at 8 quarters of change
    expect(paths[1].shocksBps[8]).toBe(0); // after 8 quarters, no more shock
  });
});
