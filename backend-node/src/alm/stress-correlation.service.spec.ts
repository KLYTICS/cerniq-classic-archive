import {
  StressCorrelationService,
  StressCorrelationParams,
} from './stress-correlation.service';

// ─── Helpers ────────────────────────────────────────────────────

function generateCorrelatedReturns(n: number): Record<string, number[]> {
  const market: number[] = [];
  const assetA: number[] = [];
  const assetB: number[] = [];

  for (let i = 0; i < n; i++) {
    const mkt = Math.sin(i * 0.5) * 0.02;
    market.push(mkt);
    // In normal times, assets are moderately correlated
    // In stress (market < 0), correlation increases
    if (mkt < -0.005) {
      assetA.push(mkt * 0.9 + Math.sin(i * 3) * 0.002);
      assetB.push(mkt * 0.85 + Math.sin(i * 7) * 0.002);
    } else {
      assetA.push(mkt * 0.3 + Math.sin(i * 3) * 0.01);
      assetB.push(mkt * -0.2 + Math.sin(i * 7) * 0.01);
    }
  }

  return { Market: market, AssetA: assetA, AssetB: assetB };
}

function baseParams(): StressCorrelationParams {
  return {
    returns: generateCorrelatedReturns(300),
    stressThreshold: -0.005,
  };
}

// ─── Tests ──────────────────────────────────────────────────────

describe('StressCorrelationService', () => {
  let service: StressCorrelationService;

  beforeEach(() => {
    service = new StressCorrelationService();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // 1. Stress correlation is higher than normal
  it('stress correlation exceeds normal correlation', () => {
    const result = service.analyzeStressCorrelation(baseParams());
    expect(result.stressCorrelation).toBeGreaterThan(
      result.normalCorrelation,
    );
  });

  // 2. Correlation increase is positive
  it('correlation increase is positive when stress correlation rises', () => {
    const result = service.analyzeStressCorrelation(baseParams());
    expect(result.correlationIncrease).toBeGreaterThan(0);
  });

  // 3. Correlations are bounded between -1 and 1
  it('correlations are within [-1, 1]', () => {
    const result = service.analyzeStressCorrelation(baseParams());
    expect(result.normalCorrelation).toBeGreaterThanOrEqual(-1);
    expect(result.normalCorrelation).toBeLessThanOrEqual(1);
    expect(result.stressCorrelation).toBeGreaterThanOrEqual(-1);
    expect(result.stressCorrelation).toBeLessThanOrEqual(1);
  });

  // 4. Throws with fewer than 2 assets
  it('throws if fewer than 2 assets provided', () => {
    expect(() =>
      service.analyzeStressCorrelation({
        returns: { Market: [0.01, -0.01, 0.005] },
        stressThreshold: -0.005,
      }),
    ).toThrow(/at least 2/i);
  });

  // 5. Diversification breakdown is a boolean
  it('diversification breakdown is a boolean', () => {
    const result = service.analyzeStressCorrelation(baseParams());
    expect(typeof result.diversificationBreakdown).toBe('boolean');
  });

  // 6. Works with more than 2 non-market assets
  it('handles multiple non-market assets', () => {
    const params = baseParams();
    const n = params.returns['Market'].length;
    params.returns['AssetC'] = Array.from(
      { length: n },
      (_, i) => Math.sin(i * 11) * 0.01,
    );
    const result = service.analyzeStressCorrelation(params);
    expect(result.normalCorrelation).toBeDefined();
    expect(result.stressCorrelation).toBeDefined();
  });
});
