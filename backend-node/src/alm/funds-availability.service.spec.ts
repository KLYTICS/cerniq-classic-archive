import {
  FundsAvailabilityService,
  FundsAvailabilityParams,
} from './funds-availability.service';

// ─── Helpers ────────────────────────────────────────────────────

function strongParams(): FundsAvailabilityParams {
  return {
    reserves: 50_000_000,
    committedLines: 30_000_000,
    uncommittedLines: 20_000_000,
    liquidSecurities: 80_000_000,
    expectedInflows30d: 30_000_000,
  };
}

function weakParams(): FundsAvailabilityParams {
  return {
    reserves: 2_000_000,
    committedLines: 1_000_000,
    uncommittedLines: 0,
    liquidSecurities: 0,
    expectedInflows30d: 0,
  };
}

// ─── Tests ──────────────────────────────────────────────────────

describe('FundsAvailabilityService', () => {
  let service: FundsAvailabilityService;

  beforeEach(() => {
    service = new FundsAvailabilityService();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // 1. Total available equals sum of all tiers
  it('total available equals sum of all three tiers', () => {
    const result = service.analyzeFundsAvailability(strongParams());
    expect(result.totalAvailable).toBeCloseTo(
      result.tier1Available + result.tier2Available + result.tier3Available,
      2,
    );
  });

  // 2. Tier 1 = reserves + committed lines
  it('tier 1 equals reserves plus committed lines', () => {
    const params = strongParams();
    const result = service.analyzeFundsAvailability(params);
    expect(result.tier1Available).toBeCloseTo(
      params.reserves + params.committedLines,
      2,
    );
  });

  // 3. Securities receive a haircut
  it('tier 2 applies a haircut to liquid securities', () => {
    const params = strongParams();
    const result = service.analyzeFundsAvailability(params);
    expect(result.tier2Available).toBeLessThan(params.liquidSecurities);
    expect(result.tier2Available).toBeCloseTo(
      params.liquidSecurities * 0.95,
      2,
    );
  });

  // 4. Uncommitted lines receive a larger haircut
  it('tier 3 applies a 50% haircut to uncommitted lines', () => {
    const params = strongParams();
    const result = service.analyzeFundsAvailability(params);
    const expected =
      params.uncommittedLines * 0.5 + params.expectedInflows30d;
    expect(result.tier3Available).toBeCloseTo(expected, 2);
  });

  // 5. Strong liquidity classified as STRONG
  it('classifies strong liquidity as STRONG', () => {
    const result = service.analyzeFundsAvailability(strongParams());
    expect(result.adequacy).toBe('STRONG');
  });

  // 6. Weak liquidity classified as CRITICAL or THIN
  it('classifies weak liquidity appropriately', () => {
    const result = service.analyzeFundsAvailability(weakParams());
    expect(['CRITICAL', 'THIN']).toContain(result.adequacy);
  });

  // 7. Days of coverage is positive
  it('days of coverage is a positive integer', () => {
    const result = service.analyzeFundsAvailability(strongParams());
    expect(result.daysOfCoverage).toBeGreaterThan(0);
    expect(Number.isInteger(result.daysOfCoverage)).toBe(true);
  });
});
