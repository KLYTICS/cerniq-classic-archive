import {
  RealRateInflationService,
  RealRateParams,
} from './real-rate-inflation.service';

// ─── Helpers ────────────────────────────────────────────────────

function baseParams(): RealRateParams {
  return {
    nominalRate: 0.05,
    inflationExpectation: 0.025,
    inflationRiskPremium: 0.005,
  };
}

// ─── Tests ──────────────────────────────────────────────────────

describe('RealRateInflationService', () => {
  let service: RealRateInflationService;

  beforeEach(() => {
    service = new RealRateInflationService();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // 1. Fisher decomposition: real = nominal - inflation - risk premium
  it('decomposes real rate via Fisher equation', () => {
    const result = service.decomposeRealRate(baseParams());
    // 0.05 - 0.025 - 0.005 = 0.02
    expect(result.realRate).toBeCloseTo(0.02, 6);
  });

  // 2. Breakeven = nominal - real
  it('breakeven equals nominal minus real rate', () => {
    const result = service.decomposeRealRate(baseParams());
    expect(result.breakeven).toBeCloseTo(
      baseParams().nominalRate - result.realRate,
      6,
    );
  });

  // 3. Breakeven equals inflation expectation + risk premium
  it('breakeven equals inflation expectation plus risk premium', () => {
    const result = service.decomposeRealRate(baseParams());
    expect(result.breakeven).toBeCloseTo(0.03, 6);
  });

  // 4. Zero inflation risk premium
  it('handles zero inflation risk premium', () => {
    const params: RealRateParams = {
      nominalRate: 0.04,
      inflationExpectation: 0.02,
      inflationRiskPremium: 0,
    };
    const result = service.decomposeRealRate(params);
    expect(result.realRate).toBeCloseTo(0.02, 6);
    expect(result.breakeven).toBeCloseTo(0.02, 6);
  });

  // 5. TIPS suggestion when breakeven is high
  it('suggests increasing TIPS when breakeven exceeds expectations', () => {
    const params: RealRateParams = {
      nominalRate: 0.06,
      inflationExpectation: 0.02,
      inflationRiskPremium: 0.03, // pushes breakeven to 0.05 vs expectation 0.02
    };
    const result = service.decomposeRealRate(params);
    expect(result.tipsSuggestion).toMatch(/TIPS appear cheap|increasing/i);
  });

  // 6. TIPS suggestion when breakeven is low
  it('suggests nominal bonds when breakeven is below expectations', () => {
    const params: RealRateParams = {
      nominalRate: 0.03,
      inflationExpectation: 0.04,
      inflationRiskPremium: -0.02, // breakeven = 0.01 vs expectation 0.04
    };
    const result = service.decomposeRealRate(params);
    expect(result.tipsSuggestion).toMatch(/nominal bonds|rich/i);
  });

  // 7. Batch decompose returns correct count
  it('batch decompose handles multiple scenarios', () => {
    const scenarios = [baseParams(), { ...baseParams(), nominalRate: 0.06 }];
    const results = service.batchDecompose(scenarios);
    expect(results).toHaveLength(2);
    expect(results[1].realRate).toBeGreaterThan(results[0].realRate);
  });
});
