import {
  DailyPnLAttributionService,
  DailyPnLAttributionParams,
} from './daily-pnl-attribution.service';

describe('DailyPnLAttributionService', () => {
  let service: DailyPnLAttributionService;

  beforeEach(() => {
    service = new DailyPnLAttributionService();
  });

  // ── Helpers ──────────────────────────────────────────────

  const baseAsset = (
    overrides: Partial<{
      name: string;
      balance: number;
      rate: number;
      category: string;
    }> = {},
  ) => ({
    name: 'Commercial Loans',
    balance: 10_000_000,
    rate: 0.065,
    category: 'loans',
    ...overrides,
  });

  const baseLiab = (
    overrides: Partial<{
      name: string;
      balance: number;
      rate: number;
      category: string;
    }> = {},
  ) => ({
    name: 'Savings Deposits',
    balance: 8_000_000,
    rate: 0.02,
    category: 'deposits',
    ...overrides,
  });

  // ─────────────────────────────────────────────────────────
  // 1. No change → zero attribution components
  // ─────────────────────────────────────────────────────────

  it('returns zero attribution when prior and current are identical', () => {
    const snapshot = {
      assets: [baseAsset()],
      liabilities: [baseLiab()],
      benchmarkRate: 0.05,
    };
    const params: DailyPnLAttributionParams = {
      prior: snapshot,
      current: snapshot,
      period: 'daily',
    };

    const result = service.attributePnL(params);

    expect(result.totalNIIChange).toBe(0);
    expect(result.attribution.rateEffect).toBe(0);
    expect(result.attribution.volumeEffect).toBe(0);
    expect(result.attribution.mixEffect).toBe(0);
    expect(result.attribution.spreadEffect).toBe(0);
    expect(result.priorNII).toBe(result.currentNII);
  });

  // ─────────────────────────────────────────────────────────
  // 2. Rate increase on assets → positive rate effect
  // ─────────────────────────────────────────────────────────

  it('produces positive rate effect when asset rates increase', () => {
    const params: DailyPnLAttributionParams = {
      prior: {
        assets: [baseAsset({ rate: 0.06 })],
        liabilities: [baseLiab()],
        benchmarkRate: 0.05,
      },
      current: {
        assets: [baseAsset({ rate: 0.07 })],
        liabilities: [baseLiab()],
        benchmarkRate: 0.05,
      },
      period: 'daily',
    };

    const result = service.attributePnL(params);

    expect(result.attribution.rateEffect).toBeGreaterThan(0);
    // Rate effect = B0 * (R1 - R0) * (1/365) = 10M * 0.01 * (1/365) ≈ 273.97
    const expectedRateEffect = 10_000_000 * 0.01 * (1 / 365);
    expect(result.attribution.rateEffect).toBeCloseTo(expectedRateEffect, 0);
  });

  // ─────────────────────────────────────────────────────────
  // 3. Balance growth → positive volume effect
  // ─────────────────────────────────────────────────────────

  it('produces positive volume effect when asset balance grows', () => {
    const params: DailyPnLAttributionParams = {
      prior: {
        assets: [baseAsset({ balance: 10_000_000 })],
        liabilities: [baseLiab()],
        benchmarkRate: 0.05,
      },
      current: {
        assets: [baseAsset({ balance: 12_000_000 })],
        liabilities: [baseLiab()],
        benchmarkRate: 0.05,
      },
      period: 'daily',
    };

    const result = service.attributePnL(params);

    expect(result.attribution.volumeEffect).toBeGreaterThan(0);
    // Volume effect = R0 * (B1 - B0) * (1/365) = 0.065 * 2M * (1/365) ≈ 356.16
    const expectedVolEff = 0.065 * 2_000_000 * (1 / 365);
    expect(result.attribution.volumeEffect).toBeCloseTo(expectedVolEff, 0);
  });

  // ─────────────────────────────────────────────────────────
  // 4. Attribution components sum to total NII change
  // ─────────────────────────────────────────────────────────

  it('rate + volume + mix effects sum to total NII change (annualized)', () => {
    const params: DailyPnLAttributionParams = {
      prior: {
        assets: [
          baseAsset({ name: 'CRE Loans', balance: 5_000_000, rate: 0.055 }),
          baseAsset({ name: 'Auto Loans', balance: 3_000_000, rate: 0.045 }),
        ],
        liabilities: [
          baseLiab({ name: 'Checking', balance: 4_000_000, rate: 0.005 }),
          baseLiab({ name: 'CDs', balance: 3_000_000, rate: 0.035 }),
        ],
        benchmarkRate: 0.05,
      },
      current: {
        assets: [
          baseAsset({ name: 'CRE Loans', balance: 5_500_000, rate: 0.06 }),
          baseAsset({ name: 'Auto Loans', balance: 2_800_000, rate: 0.05 }),
        ],
        liabilities: [
          baseLiab({ name: 'Checking', balance: 4_200_000, rate: 0.008 }),
          baseLiab({ name: 'CDs', balance: 3_200_000, rate: 0.04 }),
        ],
        benchmarkRate: 0.052,
      },
      period: 'daily',
    };

    const result = service.attributePnL(params);
    const { rateEffect, volumeEffect, mixEffect } = result.attribution;

    // The three non-spread effects must exactly decompose the period-scaled NII change
    const pf = 1 / 365;
    const priorNII =
      5_000_000 * 0.055 +
      3_000_000 * 0.045 -
      (4_000_000 * 0.005 + 3_000_000 * 0.035);
    const currentNII =
      5_500_000 * 0.06 +
      2_800_000 * 0.05 -
      (4_200_000 * 0.008 + 3_200_000 * 0.04);
    const scaledChange = (currentNII - priorNII) * pf;

    expect(rateEffect + volumeEffect + mixEffect).toBeCloseTo(scaledChange, 1);
  });

  // ─────────────────────────────────────────────────────────
  // 5. Top drivers sorted by absolute impact
  // ─────────────────────────────────────────────────────────

  it('returns top drivers sorted by absolute impact descending', () => {
    const params: DailyPnLAttributionParams = {
      prior: {
        assets: [
          baseAsset({ name: 'Big Mover', balance: 50_000_000, rate: 0.04 }),
          baseAsset({ name: 'Small Mover', balance: 1_000_000, rate: 0.06 }),
        ],
        liabilities: [baseLiab()],
        benchmarkRate: 0.04,
      },
      current: {
        assets: [
          baseAsset({ name: 'Big Mover', balance: 50_000_000, rate: 0.05 }),
          baseAsset({ name: 'Small Mover', balance: 1_100_000, rate: 0.062 }),
        ],
        liabilities: [baseLiab()],
        benchmarkRate: 0.04,
      },
      period: 'daily',
    };

    const result = service.attributePnL(params);

    expect(result.topDrivers.length).toBeGreaterThan(0);

    for (let i = 1; i < result.topDrivers.length; i++) {
      expect(Math.abs(result.topDrivers[i - 1].impact)).toBeGreaterThanOrEqual(
        Math.abs(result.topDrivers[i].impact),
      );
    }

    // The biggest driver should be Big Mover rate effect
    expect(result.topDrivers[0].name).toBe('Big Mover');
    expect(result.topDrivers[0].driver).toBe('rate');
  });

  // ─────────────────────────────────────────────────────────
  // 6. Category breakdown matches instrument grouping
  // ─────────────────────────────────────────────────────────

  it('groups instruments into categories correctly', () => {
    const params: DailyPnLAttributionParams = {
      prior: {
        assets: [
          baseAsset({
            name: 'Loan A',
            category: 'loans',
            balance: 5_000_000,
            rate: 0.06,
          }),
          baseAsset({
            name: 'Loan B',
            category: 'loans',
            balance: 3_000_000,
            rate: 0.055,
          }),
          baseAsset({
            name: 'Bond Portfolio',
            category: 'securities',
            balance: 2_000_000,
            rate: 0.04,
          }),
        ],
        liabilities: [
          baseLiab({
            name: 'DDA',
            category: 'deposits',
            balance: 6_000_000,
            rate: 0.01,
          }),
        ],
        benchmarkRate: 0.05,
      },
      current: {
        assets: [
          baseAsset({
            name: 'Loan A',
            category: 'loans',
            balance: 5_200_000,
            rate: 0.062,
          }),
          baseAsset({
            name: 'Loan B',
            category: 'loans',
            balance: 3_100_000,
            rate: 0.057,
          }),
          baseAsset({
            name: 'Bond Portfolio',
            category: 'securities',
            balance: 1_800_000,
            rate: 0.042,
          }),
        ],
        liabilities: [
          baseLiab({
            name: 'DDA',
            category: 'deposits',
            balance: 6_200_000,
            rate: 0.012,
          }),
        ],
        benchmarkRate: 0.052,
      },
      period: 'daily',
    };

    const result = service.attributePnL(params);
    const categories = result.byCategory.map((c) => c.category);

    expect(categories).toContain('loans');
    expect(categories).toContain('securities');
    expect(categories).toContain('deposits');

    const loansCat = result.byCategory.find((c) => c.category === 'loans')!;
    expect(loansCat.priorBalance).toBe(8_000_000);
    expect(loansCat.currentBalance).toBe(8_300_000);
  });

  // ─────────────────────────────────────────────────────────
  // 7. Spread effect captures benchmark-relative changes
  // ─────────────────────────────────────────────────────────

  it('computes spread effect when benchmark rate changes', () => {
    const params: DailyPnLAttributionParams = {
      prior: {
        assets: [baseAsset({ rate: 0.065 })],
        liabilities: [baseLiab({ rate: 0.02 })],
        benchmarkRate: 0.05,
      },
      current: {
        assets: [baseAsset({ rate: 0.065 })],
        liabilities: [baseLiab({ rate: 0.02 })],
        benchmarkRate: 0.04, // benchmark dropped but rates stayed constant
      },
      period: 'daily',
    };

    const result = service.attributePnL(params);

    // Rates unchanged => no rate effect
    expect(result.attribution.rateEffect).toBe(0);
    // Spread widened (asset spread went from 1.5% to 2.5%, liab spread went from -3% to -2%)
    // so spread effect should be non-zero
    expect(result.attribution.spreadEffect).not.toBe(0);
  });

  // ─────────────────────────────────────────────────────────
  // 8. Daily vs quarterly period scaling
  // ─────────────────────────────────────────────────────────

  it('scales effects correctly for daily vs quarterly periods', () => {
    const makeParams = (
      period: 'daily' | 'quarterly',
    ): DailyPnLAttributionParams => ({
      prior: {
        assets: [baseAsset({ rate: 0.06 })],
        liabilities: [baseLiab()],
        benchmarkRate: 0.05,
      },
      current: {
        assets: [baseAsset({ rate: 0.07 })],
        liabilities: [baseLiab()],
        benchmarkRate: 0.05,
      },
      period,
    });

    const dailyResult = service.attributePnL(makeParams('daily'));
    const quarterlyResult = service.attributePnL(makeParams('quarterly'));

    // Quarterly rate effect should be ~91.25x larger than daily (365/4 = 91.25)
    const ratio =
      quarterlyResult.attribution.rateEffect /
      dailyResult.attribution.rateEffect;
    expect(ratio).toBeCloseTo(365 / 4, 0);
  });

  // ─────────────────────────────────────────────────────────
  // 9. Bilingual summary contains EN and ES
  // ─────────────────────────────────────────────────────────

  it('generateDailySummary returns bilingual EN and ES summaries', () => {
    const params: DailyPnLAttributionParams = {
      prior: {
        assets: [baseAsset({ rate: 0.06 })],
        liabilities: [baseLiab()],
        benchmarkRate: 0.05,
      },
      current: {
        assets: [baseAsset({ rate: 0.07 })],
        liabilities: [baseLiab()],
        benchmarkRate: 0.05,
      },
      period: 'daily',
    };

    const summary = service.generateDailySummary(params);

    // English
    expect(summary.en).toBeDefined();
    expect(summary.en).toContain('P&L');
    expect(summary.en).toContain('NII');

    // Spanish
    expect(summary.es).toBeDefined();
    expect(summary.es).toContain('P&L');
    expect(summary.es).toContain('ingreso neto por intereses');
  });

  // ─────────────────────────────────────────────────────────
  // 10. Material changes flagged correctly (>10% income change)
  // ─────────────────────────────────────────────────────────

  it('flags categories with >10% income change as material', () => {
    const params: DailyPnLAttributionParams = {
      prior: {
        assets: [
          baseAsset({
            name: 'Stable Asset',
            category: 'stable',
            balance: 10_000_000,
            rate: 0.05,
          }),
          baseAsset({
            name: 'Volatile Asset',
            category: 'volatile',
            balance: 1_000_000,
            rate: 0.04,
          }),
        ],
        liabilities: [baseLiab()],
        benchmarkRate: 0.05,
      },
      current: {
        assets: [
          baseAsset({
            name: 'Stable Asset',
            category: 'stable',
            balance: 10_000_000,
            rate: 0.051,
          }),
          baseAsset({
            name: 'Volatile Asset',
            category: 'volatile',
            balance: 1_000_000,
            rate: 0.08,
          }),
        ],
        liabilities: [baseLiab()],
        benchmarkRate: 0.05,
      },
      period: 'daily',
    };

    const summary = service.generateDailySummary(params);

    // Volatile asset went from 4% to 8% — that's a 100% income change, definitely material
    const volatileMaterial = summary.materialChanges.find(
      (m) => m.category === 'volatile',
    );
    expect(volatileMaterial).toBeDefined();
    expect(volatileMaterial!.pctChange).toBeGreaterThan(10);

    // Stable only moved 2% (from 5% to 5.1%) — should NOT be flagged
    const stableMaterial = summary.materialChanges.find(
      (m) => m.category === 'stable',
    );
    expect(stableMaterial).toBeUndefined();
  });

  // ─────────────────────────────────────────────────────────
  // 11. Rate increase on liabilities → negative rate effect
  // ─────────────────────────────────────────────────────────

  it('produces negative rate effect when liability rates increase', () => {
    const params: DailyPnLAttributionParams = {
      prior: {
        assets: [baseAsset()],
        liabilities: [baseLiab({ rate: 0.02 })],
        benchmarkRate: 0.05,
      },
      current: {
        assets: [baseAsset()],
        liabilities: [baseLiab({ rate: 0.04 })],
        benchmarkRate: 0.05,
      },
      period: 'daily',
    };

    const result = service.attributePnL(params);

    // Liability rate increase → higher cost → negative rate effect
    expect(result.attribution.rateEffect).toBeLessThan(0);
  });

  // ─────────────────────────────────────────────────────────
  // 12. Summary narrative reads properly
  // ─────────────────────────────────────────────────────────

  it('produces a readable summary narrative', () => {
    const params: DailyPnLAttributionParams = {
      prior: {
        assets: [
          baseAsset({ name: 'Floating CRE', rate: 0.055, balance: 20_000_000 }),
        ],
        liabilities: [
          baseLiab({ name: 'MMDA', rate: 0.015, balance: 15_000_000 }),
        ],
        benchmarkRate: 0.05,
      },
      current: {
        assets: [
          baseAsset({ name: 'Floating CRE', rate: 0.065, balance: 22_000_000 }),
        ],
        liabilities: [
          baseLiab({ name: 'MMDA', rate: 0.018, balance: 15_500_000 }),
        ],
        benchmarkRate: 0.052,
      },
      period: 'daily',
    };

    const result = service.attributePnL(params);

    expect(result.summary).toContain('NII');
    expect(result.summary.length).toBeGreaterThan(20);
    // Should mention dollar amounts
    expect(result.summary).toMatch(/\$/);
  });

  // ─────────────────────────────────────────────────────────
  // 13. Monthly period fraction
  // ─────────────────────────────────────────────────────────

  it('uses 1/12 period fraction for monthly', () => {
    const params: DailyPnLAttributionParams = {
      prior: {
        assets: [baseAsset({ rate: 0.06 })],
        liabilities: [baseLiab()],
        benchmarkRate: 0.05,
      },
      current: {
        assets: [baseAsset({ rate: 0.07 })],
        liabilities: [baseLiab()],
        benchmarkRate: 0.05,
      },
      period: 'monthly',
    };

    const result = service.attributePnL(params);

    // Rate effect = 10M * 0.01 * (1/12) ≈ 8333.33
    const expected = 10_000_000 * 0.01 * (1 / 12);
    expect(result.attribution.rateEffect).toBeCloseTo(expected, 0);
  });
});
