import {
  DataQualityMonitorService,
  BalanceSheetInput,
  BalanceSheetInstrument,
} from './data-quality-monitor.service';

describe('DataQualityMonitorService', () => {
  let service: DataQualityMonitorService;

  // Fresh date for timeliness checks (today minus 5 days)
  const recentDate = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000)
    .toISOString()
    .split('T')[0];

  const makeAsset = (
    overrides: Partial<BalanceSheetInstrument> = {},
  ): BalanceSheetInstrument => ({
    name: 'Auto Loans',
    balance: 50_000_000,
    rate: 0.055,
    maturityYears: 5,
    category: 'loans',
    isFloating: false,
    ...overrides,
  });

  const makeLiability = (
    overrides: Partial<BalanceSheetInstrument> = {},
  ): BalanceSheetInstrument => ({
    name: 'Share Certificates',
    balance: 40_000_000,
    rate: 0.025,
    maturityYears: 2,
    category: 'deposits',
    isFloating: false,
    ...overrides,
  });

  const perfectBS = (): BalanceSheetInput => ({
    assets: [
      makeAsset({
        name: 'Auto Loans',
        balance: 30_000_000,
        rate: 0.055,
        maturityYears: 5,
      }),
      makeAsset({
        name: 'Mortgages',
        balance: 40_000_000,
        rate: 0.045,
        maturityYears: 15,
      }),
      makeAsset({
        name: 'Treasury Securities',
        balance: 20_000_000,
        rate: 0.035,
        maturityYears: 3,
      }),
      makeAsset({
        name: 'Cash',
        balance: 10_000_000,
        rate: 0.0,
        maturityYears: 0,
      }),
    ],
    liabilities: [
      makeLiability({
        name: 'Regular Shares',
        balance: 25_000_000,
        rate: 0.005,
        maturityYears: 0,
      }),
      makeLiability({
        name: 'Share Certificates',
        balance: 35_000_000,
        rate: 0.03,
        maturityYears: 1.5,
      }),
      makeLiability({
        name: 'Borrowings',
        balance: 25_000_000,
        rate: 0.04,
        maturityYears: 3,
      }),
    ],
    equity: 15_000_000,
    asOfDate: recentDate,
    institutionName: 'Cooperativa Test',
  });

  beforeEach(() => {
    service = new DataQualityMonitorService();
  });

  // ── 1. Perfect balance sheet scores A (90+) ───────────────────────

  it('scores a well-formed balance sheet as A (90+)', () => {
    const result = service.validateBalanceSheet(perfectBS());
    expect(result.overallScore).toBeGreaterThanOrEqual(90);
    expect(result.grade).toBe('A');
    expect(result.passesMinimumQuality).toBe(true);
    expect(result.critical).toHaveLength(0);
  });

  // ── 2. Missing assets → critical, low score ───────────────────────

  it('flags missing assets as critical and lowers score', () => {
    const bs = perfectBS();
    bs.assets = [];
    const result = service.validateBalanceSheet(bs);
    expect(result.critical.length).toBeGreaterThanOrEqual(1);
    expect(result.critical.some((c) => c.rule === 'MIN_ASSETS')).toBe(true);
    expect(result.overallScore).toBeLessThan(80);
    // Score stays above 60 since liabilities/equity/timeliness are valid,
    // but the critical flag itself blocks report generation.
    expect(result.grade).not.toBe('A');
  });

  // ── 3. Negative balance → critical ────────────────────────────────

  it('flags negative balance as critical', () => {
    const bs = perfectBS();
    bs.assets[0] = makeAsset({ name: 'Bad Loan', balance: -5_000_000 });
    const result = service.validateBalanceSheet(bs);
    expect(result.critical.some((c) => c.rule === 'NEGATIVE_BALANCE')).toBe(
      true,
    );
  });

  // ── 4. Rate > 20% → warning ──────────────────────────────────────

  it('flags asset rate above 20% as warning', () => {
    const bs = perfectBS();
    bs.assets.push(
      makeAsset({ name: 'Suspicious Loan', rate: 0.25, balance: 1_000_000 }),
    );
    const result = service.validateBalanceSheet(bs);
    expect(result.warnings.some((w) => w.rule === 'HIGH_ASSET_RATE')).toBe(
      true,
    );
  });

  // ── 5. Maturity > 40 years → warning ─────────────────────────────

  it('flags maturity exceeding 40 years as warning', () => {
    const bs = perfectBS();
    bs.assets.push(
      makeAsset({
        name: 'Century Bond',
        maturityYears: 50,
        balance: 1_000_000,
      }),
    );
    const result = service.validateBalanceSheet(bs);
    expect(result.warnings.some((w) => w.rule === 'EXTREME_MATURITY')).toBe(
      true,
    );
  });

  // ── 6. Assets ≠ liabilities + equity → consistency warning ───────

  it('flags balance sheet imbalance when assets != liabilities + equity', () => {
    const bs = perfectBS();
    // Make assets much larger than liabilities + equity
    bs.assets = [makeAsset({ balance: 200_000_000 })];
    bs.liabilities = [makeLiability({ balance: 50_000_000 })];
    bs.equity = 10_000_000;
    const result = service.validateBalanceSheet(bs);
    expect(result.warnings.some((w) => w.rule === 'BS_IMBALANCE')).toBe(true);
  });

  // ── 7. Stale date (>90 days) → timeliness critical ────────────────

  it('flags data older than 90 days as critical', () => {
    const bs = perfectBS();
    const staleDate = new Date(Date.now() - 120 * 24 * 60 * 60 * 1000);
    bs.asOfDate = staleDate.toISOString().split('T')[0];
    const result = service.validateBalanceSheet(bs);
    expect(result.critical.some((c) => c.rule === 'STALE_DATA_CRITICAL')).toBe(
      true,
    );
  });

  // ── 8. Future date → critical ────────────────────────────────────

  it('flags future asOfDate as critical', () => {
    const bs = perfectBS();
    const futureDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    bs.asOfDate = futureDate.toISOString().split('T')[0];
    const result = service.validateBalanceSheet(bs);
    expect(result.critical.some((c) => c.rule === 'FUTURE_DATE')).toBe(true);
  });

  // ── 9. Score components sum correctly ─────────────────────────────

  it('computes overall score as weighted average of four components', () => {
    const bs = perfectBS();
    const result = service.validateBalanceSheet(bs);
    const expected = Math.round(
      result.checks.completeness.score * 0.25 +
        result.checks.consistency.score * 0.25 +
        result.checks.plausibility.score * 0.25 +
        result.checks.timeliness.score * 0.25,
    );
    expect(result.overallScore).toBe(expected);
  });

  // ── 10. Grade boundaries ─────────────────────────────────────────

  it('maps scores to correct grade boundaries', () => {
    // We test the grade mapping via the service's public method
    // by constructing scenarios that hit each boundary

    // A >= 90: perfect BS
    const aResult = service.validateBalanceSheet(perfectBS());
    expect(aResult.grade).toBe('A');

    // F < 60: empty assets + empty liabilities + no equity
    const failBS = perfectBS();
    failBS.assets = [];
    failBS.liabilities = [];
    failBS.equity = 0;
    const fResult = service.validateBalanceSheet(failBS);
    expect(fResult.grade).toBe('F');
    expect(fResult.passesMinimumQuality).toBe(false);
  });

  // ── 11. Quick check returns false for critical issues ─────────────

  it('quickCheck returns false when critical issues exist', () => {
    const bs = perfectBS();
    bs.assets = []; // triggers critical
    const result = service.quickCheck(bs);
    expect(result.pass).toBe(false);
    expect(result.criticalIssues.length).toBeGreaterThan(0);
  });

  it('quickCheck returns true for a clean balance sheet', () => {
    const result = service.quickCheck(perfectBS());
    expect(result.pass).toBe(true);
    expect(result.criticalIssues).toHaveLength(0);
  });

  // ── 12. Bilingual messages present ────────────────────────────────

  it('includes Spanish translations (messageEs) in all issues', () => {
    const bs = perfectBS();
    bs.assets = []; // will generate issues
    bs.equity = 0;
    const result = service.validateBalanceSheet(bs);
    const allIssues = [...result.critical, ...result.warnings, ...result.info];
    expect(allIssues.length).toBeGreaterThan(0);
    for (const issue of allIssues) {
      expect(issue.messageEs).toBeDefined();
      expect(issue.messageEs.length).toBeGreaterThan(0);
      expect(issue.message).toBeDefined();
      expect(issue.message.length).toBeGreaterThan(0);
      expect(issue.suggestion).toBeDefined();
      expect(issue.suggestion.length).toBeGreaterThan(0);
    }
  });

  // ── 13. Empty balance sheet fails ─────────────────────────────────

  it('empty balance sheet fails with F grade and multiple criticals', () => {
    const empty: BalanceSheetInput = {
      assets: [],
      liabilities: [],
      equity: 0,
      asOfDate: '',
      institutionName: '',
    };
    const result = service.validateBalanceSheet(empty);
    expect(result.grade).toBe('F');
    expect(result.passesMinimumQuality).toBe(false);
    expect(result.critical.length).toBeGreaterThanOrEqual(3); // no assets, no liabilities, no equity, no date
  });

  // ── 14. Negative maturity → critical ──────────────────────────────

  it('flags negative maturity as critical', () => {
    const bs = perfectBS();
    bs.assets[0] = makeAsset({ name: 'Expired?', maturityYears: -2 });
    const result = service.validateBalanceSheet(bs);
    expect(result.critical.some((c) => c.rule === 'NEGATIVE_MATURITY')).toBe(
      true,
    );
  });

  // ── 15. Floating repricing out of range → warning ─────────────────

  it('flags floating instrument with repricing out of 0-60 months', () => {
    const bs = perfectBS();
    bs.assets.push(
      makeAsset({
        name: 'ARM',
        isFloating: true,
        repricingMonths: 120,
        balance: 5_000_000,
      }),
    );
    const result = service.validateBalanceSheet(bs);
    expect(
      result.warnings.some((w) => w.rule === 'REPRICING_OUT_OF_RANGE'),
    ).toBe(true);
  });

  // ── 16. Negative asset rate → critical ─────────────────────────
  it('flags negative asset rate as critical', () => {
    const bs = perfectBS();
    bs.assets[0] = makeAsset({ name: 'Bad Rate', rate: -0.02 });
    const result = service.validateBalanceSheet(bs);
    expect(result.critical.some((c) => c.rule === 'NEGATIVE_ASSET_RATE')).toBe(true);
  });

  // ── 17. Extremely negative liability rate → warning ────────────
  it('flags extremely negative liability rate as warning', () => {
    const bs = perfectBS();
    bs.liabilities[0] = makeLiability({ name: 'Negative Liab', rate: -0.05 });
    const result = service.validateBalanceSheet(bs);
    expect(result.warnings.some((w) => w.rule === 'EXTREME_NEGATIVE_RATE')).toBe(true);
  });

  // ── 18. High liability rate → warning ──────────────────────────
  it('flags liability rate above 15% as warning', () => {
    const bs = perfectBS();
    bs.liabilities.push(makeLiability({ name: 'Expensive Deposit', rate: 0.20, balance: 1_000_000 }));
    const result = service.validateBalanceSheet(bs);
    expect(result.warnings.some((w) => w.rule === 'HIGH_LIABILITY_RATE')).toBe(true);
  });

  // ── 19. Long maturity 30-40 years → info ──────────────────────
  it('flags maturity between 30-40 years as info', () => {
    const bs = perfectBS();
    bs.assets.push(makeAsset({ name: 'Long Bond', maturityYears: 35, balance: 1_000_000 }));
    const result = service.validateBalanceSheet(bs);
    expect(result.info.some((i) => i.rule === 'LONG_MATURITY')).toBe(true);
  });

  // ── 20. Low total assets → warning ────────────────────────────
  it('flags total assets below $1M as warning', () => {
    const bs = perfectBS();
    bs.assets = [makeAsset({ balance: 500_000 })];
    bs.liabilities = [makeLiability({ balance: 400_000 })];
    bs.equity = 100_000;
    const result = service.validateBalanceSheet(bs);
    expect(result.warnings.some((w) => w.rule === 'LOW_TOTAL_ASSETS')).toBe(true);
  });

  // ── 21. Invalid asOfDate → critical ───────────────────────────
  it('flags invalid asOfDate string as critical', () => {
    const bs = perfectBS();
    bs.asOfDate = 'not-a-date';
    const result = service.validateBalanceSheet(bs);
    expect(result.critical.some((c) => c.rule === 'INVALID_DATE')).toBe(true);
  });

  // ── 22. Stale data 60-90 days → warning ──────────────────────
  it('flags data 60-90 days old as warning', () => {
    const bs = perfectBS();
    const staleDate = new Date(Date.now() - 75 * 24 * 60 * 60 * 1000);
    bs.asOfDate = staleDate.toISOString().split('T')[0];
    const result = service.validateBalanceSheet(bs);
    expect(result.warnings.some((w) => w.rule === 'STALE_DATA_WARNING')).toBe(true);
  });

  // ── 23. Low NIM → warning ─────────────────────────────────────
  it('flags implied NIM below 0.5% as warning', () => {
    const bs = perfectBS();
    // Set asset rates very close to liability rates
    bs.assets = [makeAsset({ rate: 0.026, balance: 50_000_000 })];
    bs.liabilities = [makeLiability({ rate: 0.025, balance: 40_000_000 })];
    bs.equity = 10_000_000;
    const result = service.validateBalanceSheet(bs);
    expect(result.warnings.some((w) => w.rule === 'LOW_NIM')).toBe(true);
  });

  // ── 24. High leverage → warning ───────────────────────────────
  it('flags leverage above 98% as warning', () => {
    const bs = perfectBS();
    bs.assets = [makeAsset({ balance: 100_000_000 })];
    bs.liabilities = [makeLiability({ balance: 99_000_000 })];
    bs.equity = 1_000_000;
    const result = service.validateBalanceSheet(bs);
    expect(result.warnings.some((w) => w.rule === 'HIGH_LEVERAGE')).toBe(true);
  });

  // ── 25. Low leverage → warning ──────────────────────────────
  it('flags leverage below 50% as warning', () => {
    const bs = perfectBS();
    bs.assets = [makeAsset({ balance: 100_000_000 })];
    bs.liabilities = [makeLiability({ balance: 30_000_000 })];
    bs.equity = 70_000_000;
    const result = service.validateBalanceSheet(bs);
    expect(result.warnings.some((w) => w.rule === 'LOW_LEVERAGE')).toBe(true);
  });

  // ── 26. High NIM → warning ─────────────────────────────────
  it('flags implied NIM above 8% as warning', () => {
    const bs = perfectBS();
    bs.assets = [makeAsset({ rate: 0.12, balance: 50_000_000 })];
    bs.liabilities = [makeLiability({ rate: 0.005, balance: 40_000_000 })];
    bs.equity = 10_000_000;
    const result = service.validateBalanceSheet(bs);
    expect(result.warnings.some((w) => w.rule === 'HIGH_NIM')).toBe(true);
  });

  // ── 27. High total assets → warning ────────────────────────
  it('flags total assets above $100B as warning', () => {
    const bs = perfectBS();
    bs.assets = [makeAsset({ balance: 200_000_000_000 })];
    bs.liabilities = [makeLiability({ balance: 180_000_000_000 })];
    bs.equity = 20_000_000_000;
    const result = service.validateBalanceSheet(bs);
    expect(result.warnings.some((w) => w.rule === 'HIGH_TOTAL_ASSETS')).toBe(true);
  });

  // ── 28. Missing equity → critical ──────────────────────────
  it('flags null equity as critical', () => {
    const bs = perfectBS();
    bs.equity = undefined as any;
    const result = service.validateBalanceSheet(bs);
    expect(result.critical.some((c) => c.rule === 'MISSING_EQUITY')).toBe(true);
  });

  // ── 29. Missing instrument name → warning ──────────────────
  it('flags instrument with empty name as warning', () => {
    const bs = perfectBS();
    bs.assets.push(makeAsset({ name: '', balance: 1_000_000 }));
    const result = service.validateBalanceSheet(bs);
    expect(result.warnings.some((w) => w.rule === 'MISSING_NAME')).toBe(true);
  });

  // ── 30. Missing instrument balance → critical ─────────────
  it('flags instrument with null balance as critical', () => {
    const bs = perfectBS();
    bs.assets.push(makeAsset({ name: 'NullBal', balance: null as any }));
    const result = service.validateBalanceSheet(bs);
    expect(result.critical.some((c) => c.rule === 'MISSING_BALANCE')).toBe(true);
  });

  // ── 31. Missing instrument rate → warning ─────────────────
  it('flags instrument with null rate as warning', () => {
    const bs = perfectBS();
    bs.assets.push(makeAsset({ name: 'NullRate', rate: null as any }));
    const result = service.validateBalanceSheet(bs);
    expect(result.warnings.some((w) => w.rule === 'MISSING_RATE')).toBe(true);
  });

  // ── 32. Missing instrument maturity → warning ─────────────
  it('flags instrument with null maturity as warning', () => {
    const bs = perfectBS();
    bs.assets.push(makeAsset({ name: 'NullMat', maturityYears: null as any }));
    const result = service.validateBalanceSheet(bs);
    expect(result.warnings.some((w) => w.rule === 'MISSING_MATURITY')).toBe(true);
  });

  // ── 33. Missing liabilities → critical ────────────────────
  it('flags missing liabilities as critical', () => {
    const bs = perfectBS();
    bs.liabilities = [];
    const result = service.validateBalanceSheet(bs);
    expect(result.critical.some((c) => c.rule === 'MIN_LIABILITIES')).toBe(true);
  });

  // ── 34. Extreme duration gap → warning ────────────────────
  it('flags duration gap exceeding 10 years as warning', () => {
    const bs = perfectBS();
    bs.assets = [makeAsset({ balance: 50_000_000, maturityYears: 25 })];
    bs.liabilities = [makeLiability({ balance: 40_000_000, maturityYears: 1 })];
    bs.equity = 10_000_000;
    const result = service.validateBalanceSheet(bs);
    expect(result.warnings.some((w) => w.rule === 'EXTREME_DURATION_GAP')).toBe(true);
  });

  // ── 35. Zero total assets with instruments → critical ─────
  it('flags zero total asset balance as critical', () => {
    const bs = perfectBS();
    bs.assets = [makeAsset({ balance: 0 })];
    const result = service.validateBalanceSheet(bs);
    expect(result.critical.some((c) => c.rule === 'ZERO_TOTAL_ASSETS')).toBe(true);
  });

  // ── 36. Zero total liabilities with instruments → critical ─
  it('flags zero total liability balance as critical', () => {
    const bs = perfectBS();
    bs.liabilities = [makeLiability({ balance: 0 })];
    const result = service.validateBalanceSheet(bs);
    expect(result.critical.some((c) => c.rule === 'ZERO_TOTAL_LIABILITIES')).toBe(true);
  });

  // ── 37. Negative repricing months → warning ───────────────
  it('flags negative repricing months as warning', () => {
    const bs = perfectBS();
    bs.assets.push(makeAsset({ name: 'ARM', isFloating: true, repricingMonths: -5, balance: 5_000_000 }));
    const result = service.validateBalanceSheet(bs);
    expect(result.warnings.some((w) => w.rule === 'REPRICING_OUT_OF_RANGE')).toBe(true);
  });

  // ── 38. Missing asOfDate → critical ───────────────────────
  it('flags missing asOfDate as critical', () => {
    const bs = perfectBS();
    bs.asOfDate = '';
    const result = service.validateBalanceSheet(bs);
    expect(result.critical.some((c) => c.rule === 'MISSING_DATE')).toBe(true);
  });

  // ── 39. Critical penalty reduces score ────────────────────
  it('critical issues impose an additional 10-point penalty each', () => {
    const cleanResult = service.validateBalanceSheet(perfectBS());

    const bs = perfectBS();
    bs.assets[0] = makeAsset({ name: 'Bad', balance: -5_000_000 });
    const badResult = service.validateBalanceSheet(bs);

    expect(badResult.overallScore).toBeLessThan(cleanResult.overallScore);
  });
});
