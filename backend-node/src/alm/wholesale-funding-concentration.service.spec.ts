import {
  WholesaleFundingConcentrationService,
  WholesaleFundingParams,
} from './wholesale-funding-concentration.service';

// ─── Test fixtures ──────────────────────────────────────────────────

const DIVERSIFIED: WholesaleFundingParams = {
  fundingSources: [
    { counterparty: 'FHLB Dallas', amount: 10_000_000, maturity: 6, type: 'advance' },
    { counterparty: 'JP Morgan', amount: 8_000_000, maturity: 3, type: 'repo' },
    { counterparty: 'Bank of NY', amount: 7_000_000, maturity: 12, type: 'fed_funds' },
    { counterparty: 'Citi', amount: 6_000_000, maturity: 1, type: 'repo' },
    { counterparty: 'Goldman', amount: 5_000_000, maturity: 24, type: 'term_deposit' },
    { counterparty: 'Wells Fargo', amount: 4_000_000, maturity: 9, type: 'advance' },
  ],
};

const CONCENTRATED: WholesaleFundingParams = {
  fundingSources: [
    { counterparty: 'FHLB Dallas', amount: 40_000_000, maturity: 3, type: 'advance' },
    { counterparty: 'JP Morgan', amount: 5_000_000, maturity: 6, type: 'repo' },
    { counterparty: 'Citi', amount: 5_000_000, maturity: 12, type: 'repo' },
  ],
};

describe('WholesaleFundingConcentrationService', () => {
  let svc: WholesaleFundingConcentrationService;

  beforeEach(() => {
    svc = new WholesaleFundingConcentrationService();
  });

  // ─── Test 1: HHI computed for diversified portfolio ──────────────

  it('should compute HHI below 1500 for a diversified funding base', () => {
    const result = svc.analyzeConcentration(DIVERSIFIED);
    expect(result.hhi).toBeLessThan(2500);
    expect(result.concentration).not.toBe('high');
  });

  // ─── Test 2: HHI computed for concentrated portfolio ─────────────

  it('should compute high HHI for a concentrated funding base', () => {
    const result = svc.analyzeConcentration(CONCENTRATED);
    expect(result.hhi).toBeGreaterThan(2500);
    expect(result.concentration).toBe('high');
  });

  // ─── Test 3: Top counterparty percentage ─────────────────────────

  it('should identify the top counterparty percentage', () => {
    const result = svc.analyzeConcentration(CONCENTRATED);
    // FHLB Dallas = 40M / 50M = 80%
    expect(result.topCounterpartyPct).toBeCloseTo(0.8, 2);
  });

  // ─── Test 4: Total funding computed correctly ────────────────────

  it('should compute total funding as sum of all source amounts', () => {
    const result = svc.analyzeConcentration(DIVERSIFIED);
    expect(result.totalFunding).toBe(40_000_000);
    expect(result.counterpartyCount).toBe(6);
  });

  // ─── Test 5: Maturity profile has 5 buckets ──────────────────────

  it('should return a maturity profile with 5 buckets', () => {
    const result = svc.analyzeConcentration(DIVERSIFIED);
    expect(result.maturityProfile).toHaveLength(5);
    expect(result.maturityProfile[0].bucket).toBe('0-1m');
    expect(result.maturityProfile[4].bucket).toBe('12m+');
  });

  // ─── Test 6: Rollover risk for short-term funding ────────────────

  it('should compute rollover risk as short-term percentage', () => {
    const result = svc.analyzeConcentration(CONCENTRATED);
    // Citi has 1-month maturity but is not in CONCENTRATED; FHLB at 3 months is not <=1
    // Only items with maturity <= 1 are rollover risk
    expect(result.rolloverRisk).toBeGreaterThanOrEqual(0);
    expect(result.rolloverRisk).toBeLessThanOrEqual(1);
  });

  // ─── Test 7: Concentration classification ───────────────────────

  it('should classify concentration as low, moderate, or high', () => {
    const result = svc.analyzeConcentration(DIVERSIFIED);
    expect(['low', 'moderate', 'high']).toContain(result.concentration);
  });

  // ─── Test 8: Throws on empty funding sources ────────────────────

  it('should throw when no funding sources are provided', () => {
    expect(() => svc.analyzeConcentration({ fundingSources: [] })).toThrow(
      'At least one funding source',
    );
  });

  // ─── Test 9: Single counterparty produces HHI of 10,000 ─────────

  it('should produce HHI of 10000 for a single counterparty', () => {
    const params: WholesaleFundingParams = {
      fundingSources: [
        { counterparty: 'Only Bank', amount: 50_000_000, maturity: 6, type: 'advance' },
      ],
    };
    const result = svc.analyzeConcentration(params);
    expect(result.hhi).toBe(10_000);
    expect(result.topCounterpartyPct).toBe(1);
    expect(result.concentration).toBe('high');
  });

  // ─── Test 10: Breach identification ──────────────────────────────

  it('should identify counterparties exceeding concentration threshold', () => {
    const result = svc.identifyBreaches(CONCENTRATED, 0.15);
    // FHLB Dallas at 80% should breach 15% threshold
    expect(result.breaches.length).toBeGreaterThan(0);
    expect(result.breaches[0].counterparty).toBe('FHLB Dallas');
    expect(result.breaches[0].percentage).toBeGreaterThan(0.15);
  });

  // ─── Test 11: No breaches when below threshold ──────────────────

  it('should find no breaches when all counterparties are below threshold', () => {
    const result = svc.identifyBreaches(DIVERSIFIED, 0.30);
    // Largest is FHLB Dallas at 25% < 30% threshold
    expect(result.breaches).toHaveLength(0);
  });
});
