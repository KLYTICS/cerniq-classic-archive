import {
  ImmunizationStrategyService,
  ImmunizationParams,
} from './immunization-strategy.service';

// ─── Test fixtures ──────────────────────────────────────────────────

const MATCHED_PARAMS: ImmunizationParams = {
  assets: [
    {
      name: 'Fixed Mortgages',
      marketValue: 50_000_000,
      duration: 5.0,
      convexity: 30,
      yield: 0.045,
    },
    {
      name: 'Commercial Loans',
      marketValue: 30_000_000,
      duration: 3.0,
      convexity: 12,
      yield: 0.06,
    },
  ],
  liabilities: [
    {
      name: 'Core Deposits',
      marketValue: 40_000_000,
      duration: 2.0,
      convexity: 5,
      yield: 0.01,
    },
    {
      name: 'Term CDs',
      marketValue: 25_000_000,
      duration: 3.0,
      convexity: 10,
      yield: 0.025,
    },
  ],
  targetHorizon: 4.0,
};

const MISMATCHED_PARAMS: ImmunizationParams = {
  assets: [
    {
      name: 'Long Bonds',
      marketValue: 60_000_000,
      duration: 8.0,
      convexity: 80,
      yield: 0.05,
    },
    {
      name: 'Short Bills',
      marketValue: 20_000_000,
      duration: 0.5,
      convexity: 0.5,
      yield: 0.03,
    },
  ],
  liabilities: [
    {
      name: 'Demand Deposits',
      marketValue: 50_000_000,
      duration: 1.5,
      convexity: 3,
      yield: 0.005,
    },
    {
      name: 'Borrowings',
      marketValue: 15_000_000,
      duration: 2.0,
      convexity: 5,
      yield: 0.04,
    },
  ],
  targetHorizon: 5.0,
};

describe('ImmunizationStrategyService', () => {
  let svc: ImmunizationStrategyService;

  beforeEach(() => {
    svc = new ImmunizationStrategyService();
  });

  // ─── Test 1: Computes duration for both sides ────────────────────

  it('should compute market-value-weighted duration for assets and liabilities', () => {
    const result = svc.immunize(MATCHED_PARAMS);
    // Expected: (50M*5 + 30M*3) / 80M = 4.25
    expect(result.assetDuration).toBeCloseTo(4.25, 2);
    // Expected: (40M*2 + 25M*3) / 65M ≈ 2.384
    expect(result.liabilityDuration).toBeCloseTo(2.384, 1);
  });

  // ─── Test 2: Gap is computed correctly ───────────────────────────

  it('should compute the duration gap as asset - liability duration', () => {
    const result = svc.immunize(MATCHED_PARAMS);
    expect(result.currentGap).toBeCloseTo(
      result.assetDuration - result.liabilityDuration,
      4,
    );
  });

  // ─── Test 3: Large gap triggers rebalancing ──────────────────────

  it('should recommend rebalancing when duration gap exceeds 0.1 years', () => {
    const result = svc.immunize(MISMATCHED_PARAMS);
    expect(Math.abs(result.currentGap)).toBeGreaterThan(0.1);
    expect(result.rebalancing.length).toBeGreaterThan(0);
  });

  // ─── Test 4: Convexity match computed correctly ──────────────────

  it('should report convexity match status', () => {
    const result = svc.immunize(MATCHED_PARAMS);
    expect(typeof result.convexityMatch).toBe('boolean');
    // Asset convexity: (50M*30 + 30M*12)/80M = 23.25 > liability convexity
    expect(result.convexityMatch).toBe(true);
  });

  // ─── Test 5: Convexity mismatch triggers buy ─────────────────────

  it('should recommend buying when asset convexity is below liability convexity', () => {
    const params: ImmunizationParams = {
      assets: [
        {
          name: 'Low Convexity Bond',
          marketValue: 50_000_000,
          duration: 3.0,
          convexity: 2,
          yield: 0.04,
        },
      ],
      liabilities: [
        {
          name: 'High Convexity Liability',
          marketValue: 40_000_000,
          duration: 3.0,
          convexity: 20,
          yield: 0.02,
        },
      ],
      targetHorizon: 3.0,
    };
    const result = svc.immunize(params);
    expect(result.convexityMatch).toBe(false);
    const buyActions = result.rebalancing.filter((r) => r.action === 'buy');
    expect(buyActions.length).toBeGreaterThan(0);
  });

  // ─── Test 6: Throws on empty assets ──────────────────────────────

  it('should throw when no assets are provided', () => {
    const params: ImmunizationParams = {
      assets: [],
      liabilities: MATCHED_PARAMS.liabilities,
      targetHorizon: 4.0,
    };
    expect(() => svc.immunize(params)).toThrow('At least one asset');
  });

  // ─── Test 7: Throws on empty liabilities ─────────────────────────

  it('should throw when no liabilities are provided', () => {
    const params: ImmunizationParams = {
      assets: MATCHED_PARAMS.assets,
      liabilities: [],
      targetHorizon: 4.0,
    };
    expect(() => svc.immunize(params)).toThrow('At least one liability');
  });

  // ─── Test 8: Surplus at risk computation ─────────────────────────

  it('should compute surplus at risk under a rate shock', () => {
    const result = svc.surplusAtRisk(MATCHED_PARAMS, 200);
    expect(result.currentSurplus).toBe(15_000_000); // 80M - 65M
    expect(typeof result.surplusAfterShock).toBe('number');
    expect(typeof result.surplusAtRisk).toBe('number');
  });

  // ─── Test 9: No rebalancing when perfectly matched ───────────────

  it('should not recommend rebalancing when duration gap is negligible', () => {
    const params: ImmunizationParams = {
      assets: [
        {
          name: 'Bond A',
          marketValue: 50_000_000,
          duration: 3.0,
          convexity: 15,
          yield: 0.04,
        },
      ],
      liabilities: [
        {
          name: 'Liability A',
          marketValue: 40_000_000,
          duration: 3.0,
          convexity: 10,
          yield: 0.02,
        },
      ],
      targetHorizon: 3.0,
    };
    const result = svc.immunize(params);
    expect(Math.abs(result.currentGap)).toBeLessThanOrEqual(0.1);
    const durationActions = result.rebalancing.filter((r) =>
      r.rationale.includes('duration'),
    );
    expect(durationActions.length).toBe(0);
  });

  it('should recommend buying when asset duration is shorter than liability duration', () => {
    const params: ImmunizationParams = {
      assets: [
        { name: 'Short Bond', marketValue: 50_000_000, duration: 1.0, convexity: 5, yield: 0.03 },
      ],
      liabilities: [
        { name: 'Long Liability', marketValue: 40_000_000, duration: 5.0, convexity: 3, yield: 0.02 },
      ],
      targetHorizon: 3.0,
    };
    const result = svc.immunize(params);
    expect(result.currentGap).toBeLessThan(-0.1);
    const buyActions = result.rebalancing.filter((r) => r.action === 'buy');
    expect(buyActions.length).toBeGreaterThan(0);
    expect(buyActions[0].rationale).toContain('Extend');
  });

  it('should set immunizedDuration to targetHorizon when rebalancing is needed', () => {
    const result = svc.immunize(MISMATCHED_PARAMS);
    expect(result.rebalancing.length).toBeGreaterThan(0);
    expect(result.immunizedDuration).toBe(MISMATCHED_PARAMS.targetHorizon);
  });
});
