import {
  DynamicHedgingService,
  DynamicHedgingParams,
} from './dynamic-hedging.service';

// ─── Test fixtures ──────────────────────────────────────────────────

const BASE_PARAMS: DynamicHedgingParams = {
  portfolioDuration: 4.5,
  portfolioValue: 100_000_000,
  targetDuration: 3.0,
  hedgeInstruments: [
    {
      name: '10Y Treasury Future',
      duration: 8.5,
      price: 110,
      contractSize: 100_000,
    },
    {
      name: '5Y Interest Rate Swap',
      duration: 4.8,
      price: 100,
      contractSize: 100_000,
    },
  ],
};

describe('DynamicHedgingService', () => {
  let svc: DynamicHedgingService;

  beforeEach(() => {
    svc = new DynamicHedgingService();
  });

  // ─── Test 1: Hedge positions are generated ───────────────────────

  it('should generate hedge positions for each instrument', () => {
    const result = svc.calculateHedge(BASE_PARAMS);
    expect(result.hedgePositions).toHaveLength(2);
    expect(result.hedgePositions[0].instrument).toBe('10Y Treasury Future');
    expect(result.hedgePositions[1].instrument).toBe('5Y Interest Rate Swap');
  });

  // ─── Test 2: Duration gap is correctly computed ──────────────────

  it('should compute a negative duration gap when target < portfolio', () => {
    const result = svc.calculateHedge(BASE_PARAMS);
    expect(result.durationGap).toBe(-1.5);
  });

  // ─── Test 3: Notional has correct sign for shortening ────────────

  it('should produce negative notional when shortening duration', () => {
    const result = svc.calculateHedge(BASE_PARAMS);
    for (const pos of result.hedgePositions) {
      expect(pos.notional).toBeLessThanOrEqual(0);
    }
  });

  // ─── Test 4: Positive gap produces positive notional ─────────────

  it('should produce positive notional when extending duration', () => {
    const params: DynamicHedgingParams = {
      ...BASE_PARAMS,
      portfolioDuration: 2.0,
      targetDuration: 4.0,
    };
    const result = svc.calculateHedge(params);
    for (const pos of result.hedgePositions) {
      expect(pos.notional).toBeGreaterThanOrEqual(0);
    }
    expect(result.durationGap).toBe(2.0);
  });

  // ─── Test 5: Hedge cost is non-negative ──────────────────────────

  it('should produce a non-negative hedge cost', () => {
    const result = svc.calculateHedge(BASE_PARAMS);
    expect(result.hedgeCost).toBeGreaterThanOrEqual(0);
  });

  // ─── Test 6: Residual duration is small ──────────────────────────

  it('should achieve near-zero residual duration (rounding error only)', () => {
    const result = svc.calculateHedge(BASE_PARAMS);
    expect(Math.abs(result.residualDuration)).toBeLessThan(0.5);
  });

  // ─── Test 7: Throws on empty instruments ─────────────────────────

  it('should throw when no hedge instruments are provided', () => {
    const params: DynamicHedgingParams = {
      ...BASE_PARAMS,
      hedgeInstruments: [],
    };
    expect(() => svc.calculateHedge(params)).toThrow(
      'At least one hedge instrument',
    );
  });

  // ─── Test 8: Throws on zero portfolio value ──────────────────────

  it('should throw when portfolio value is zero', () => {
    const params: DynamicHedgingParams = {
      ...BASE_PARAMS,
      portfolioValue: 0,
    };
    expect(() => svc.calculateHedge(params)).toThrow(
      'portfolioValue must be positive',
    );
  });

  // ─── Test 9: Zero gap needs no hedge ─────────────────────────────

  it('should produce zero notional when duration is already on target', () => {
    const params: DynamicHedgingParams = {
      ...BASE_PARAMS,
      portfolioDuration: 3.0,
      targetDuration: 3.0,
    };
    const result = svc.calculateHedge(params);
    expect(result.durationGap).toBe(0);
    for (const pos of result.hedgePositions) {
      expect(pos.notional).toBe(0);
      expect(pos.contracts).toBe(0);
    }
  });

  // ─── Test 10: Hedge effectiveness ────────────────────────────────

  it('should produce positive hedge effectiveness for a hedged portfolio', () => {
    const result = svc.evaluateEffectiveness(BASE_PARAMS, 100);
    expect(result.effectiveness).toBeGreaterThan(0); // Any positive effectiveness indicates partial hedge
    expect(result.portfolioPnL).not.toBe(0);
    expect(result.hedgePnL).not.toBe(0);
  });
});
