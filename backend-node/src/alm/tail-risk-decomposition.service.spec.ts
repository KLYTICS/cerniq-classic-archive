import { TailRiskDecompositionService } from './tail-risk-decomposition.service';

describe('TailRiskDecompositionService', () => {
  let service: TailRiskDecompositionService;

  const normalReturns = [
    -0.02, 0.01, 0.005, -0.01, 0.015, 0.003, -0.005, 0.008, -0.012, 0.007,
    -0.003, 0.011, 0.002, -0.008, 0.006, -0.004, 0.009, -0.007, 0.004, -0.001,
    0.01, -0.006, 0.003, -0.002, 0.005, -0.009, 0.012, -0.011, 0.008, -0.015,
    0.002, -0.003, 0.007, -0.004, 0.006, -0.01, 0.004, -0.008, 0.011, -0.005,
    0.009, -0.002, 0.003, -0.006, 0.001, -0.007, 0.005, -0.003, 0.008, -0.004,
  ];

  const fatTailReturns = [
    ...normalReturns,
    -0.15, 0.12, -0.1, 0.08, -0.18, 0.14,
  ];

  beforeEach(() => {
    service = new TailRiskDecompositionService();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('normal-like returns should have near-zero kurtosis and skewness', () => {
    const result = service.decomposeTailRisk({ returns: normalReturns });
    expect(Math.abs(result.kurtosis)).toBeLessThan(3);
    expect(Math.abs(result.skewness)).toBeLessThan(2);
  });

  it('fat-tailed returns should have higher kurtosis than normal', () => {
    const normalResult = service.decomposeTailRisk({ returns: normalReturns });
    const fatResult = service.decomposeTailRisk({ returns: fatTailReturns });
    expect(fatResult.kurtosis).toBeGreaterThan(normalResult.kurtosis);
  });

  it('fat-tailed returns should have higher fat-tail probability', () => {
    const normalResult = service.decomposeTailRisk({ returns: normalReturns });
    const fatResult = service.decomposeTailRisk({ returns: fatTailReturns });
    expect(fatResult.fatTailProbability).toBeGreaterThanOrEqual(
      normalResult.fatTailProbability,
    );
  });

  it('systematic + idiosyncratic tail risk should sum to 1', () => {
    const result = service.decomposeTailRisk({ returns: fatTailReturns });
    expect(
      result.systematicTailRisk + result.idiosyncraticTailRisk,
    ).toBeCloseTo(1.0, 4);
  });

  it('tail index should be non-negative for absolute returns', () => {
    const result = service.decomposeTailRisk({ returns: fatTailReturns });
    expect(result.tailIndex).toBeGreaterThanOrEqual(0);
  });

  it('left tail VaR should be positive (absolute value of loss)', () => {
    const result = service.decomposeTailRisk({
      returns: fatTailReturns,
      confidence: 0.95,
    });
    expect(result.leftTailVaR).toBeGreaterThanOrEqual(0);
  });

  it('Hill estimator should be computable separately', () => {
    const hill = service.computeHillEstimator(fatTailReturns, 0.95);
    expect(typeof hill).toBe('number');
    expect(hill).toBeGreaterThanOrEqual(0);
  });

  // ── Additional coverage ───────────────────────────────────────

  it('returns all expected fields', () => {
    const result = service.decomposeTailRisk({ returns: normalReturns });
    expect(result).toHaveProperty('kurtosis');
    expect(result).toHaveProperty('skewness');
    expect(result).toHaveProperty('tailIndex');
    expect(result).toHaveProperty('fatTailProbability');
    expect(result).toHaveProperty('systematicTailRisk');
    expect(result).toHaveProperty('idiosyncraticTailRisk');
    expect(result).toHaveProperty('leftTailVaR');
    expect(result).toHaveProperty('rightTailVaR');
  });

  it('computes negative skewness for left-skewed distribution', () => {
    const returns = [
      0.01, 0.02, 0.015, 0.01, 0.005, 0.02, 0.01, 0.015,
      -0.1, -0.08, 0.01, 0.02, 0.01, 0.015, 0.01, 0.005,
      0.01, 0.02, 0.01, 0.015,
    ];
    const result = service.decomposeTailRisk({ returns });
    expect(result.skewness).toBeLessThan(0);
  });

  it('computes positive skewness for right-skewed distribution', () => {
    const returns = [
      -0.01, -0.02, -0.015, -0.01, -0.005, -0.02, -0.01, -0.015,
      0.1, 0.08, -0.01, -0.02, -0.01, -0.015, -0.01, -0.005,
      -0.01, -0.02, -0.01, -0.015,
    ];
    const result = service.decomposeTailRisk({ returns });
    expect(result.skewness).toBeGreaterThan(0);
  });

  it('respects custom confidence level', () => {
    const returns = Array.from({ length: 100 }, (_, i) => Math.sin(i) * 0.03);
    const r95 = service.decomposeTailRisk({ returns, confidence: 0.95 });
    const r99 = service.decomposeTailRisk({ returns, confidence: 0.99 });
    expect(r95.tailIndex).not.toBe(r99.tailIndex);
  });

  it('decomposes with marketReturns of matching length', () => {
    const returns = Array.from({ length: 50 }, (_, i) => Math.sin(i * 0.5) * 0.02);
    const marketReturns = Array.from({ length: 50 }, (_, i) => Math.sin(i * 0.5) * 0.015);
    const result = service.decomposeTailRisk({ returns, marketReturns });
    expect(result.systematicTailRisk).toBeGreaterThanOrEqual(0);
    expect(result.systematicTailRisk).toBeLessThanOrEqual(1);
    expect(result.systematicTailRisk + result.idiosyncraticTailRisk).toBeCloseTo(1, 3);
  });

  it('uses heuristic when marketReturns length does not match', () => {
    const returns = normalReturns;
    const marketReturns = [0.005, -0.01];
    const result = service.decomposeTailRisk({ returns, marketReturns });
    expect(result.systematicTailRisk + result.idiosyncraticTailRisk).toBeCloseTo(1, 3);
  });

  it('handles near-zero variance (all identical returns)', () => {
    const returns = Array(20).fill(0.01);
    const result = service.decomposeTailRisk({ returns });
    // With identical returns, kurtosis and skewness should be near 0 or exactly 0
    expect(Math.abs(result.kurtosis)).toBeLessThanOrEqual(3);
    expect(Math.abs(result.skewness)).toBeLessThanOrEqual(1);
  });

  it('fatTailProbability is in [0,1]', () => {
    const returns = Array.from({ length: 200 }, (_, i) => Math.sin(i * 0.1) * 0.01);
    const result = service.decomposeTailRisk({ returns });
    expect(result.fatTailProbability).toBeGreaterThanOrEqual(0);
    expect(result.fatTailProbability).toBeLessThanOrEqual(1);
  });

  it('computeHillEstimator uses default confidence', () => {
    const hill = service.computeHillEstimator(fatTailReturns);
    expect(typeof hill).toBe('number');
  });

  it('heuristic bounds idiosyncratic risk to [0.1, 0.9]', () => {
    const result = service.decomposeTailRisk({ returns: normalReturns });
    expect(result.idiosyncraticTailRisk).toBeGreaterThanOrEqual(0.1);
    expect(result.idiosyncraticTailRisk).toBeLessThanOrEqual(0.9);
  });

  it('assigns high systematic risk when correlated with market', () => {
    const marketReturns = Array.from({ length: 100 }, (_, i) => Math.sin(i * 0.2) * 0.02);
    const returns = marketReturns.map((m) => m * 1.5);
    const result = service.decomposeTailRisk({ returns, marketReturns });
    expect(result.systematicTailRisk).toBeGreaterThan(0);
  });

  it('handles very few returns where hillEstimator returns 0', () => {
    // With only 3 returns, k = max(2, floor(3*0.05)) = 2 which = absReturns.length => returns 0
    const returns = [0, 0, 0];
    const marketReturns = [0, 0, 0];
    const result = service.decomposeTailRisk({ returns, marketReturns });
    expect(result.tailIndex).toBeDefined();
  });
});
