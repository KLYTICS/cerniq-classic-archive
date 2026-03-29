import { TailRiskDecompositionService } from './tail-risk-decomposition.service';

describe('TailRiskDecompositionService', () => {
  let service: TailRiskDecompositionService;

  // Generate pseudo-random returns with known properties
  const normalReturns = [
    -0.02, 0.01, 0.005, -0.01, 0.015, 0.003, -0.005, 0.008, -0.012, 0.007,
    -0.003, 0.011, 0.002, -0.008, 0.006, -0.004, 0.009, -0.007, 0.004, -0.001,
    0.01, -0.006, 0.003, -0.002, 0.005, -0.009, 0.012, -0.011, 0.008, -0.015,
    0.002, -0.003, 0.007, -0.004, 0.006, -0.01, 0.004, -0.008, 0.011, -0.005,
    0.009, -0.002, 0.003, -0.006, 0.001, -0.007, 0.005, -0.003, 0.008, -0.004,
  ];

  // Fat-tailed returns (includes extreme observations)
  const fatTailReturns = [
    ...normalReturns,
    -0.15,
    0.12,
    -0.1,
    0.08,
    -0.18,
    0.14,
  ];

  beforeEach(() => {
    service = new TailRiskDecompositionService();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('normal-like returns should have near-zero kurtosis and skewness', () => {
    const result = service.decomposeTailRisk({
      returns: normalReturns,
    });
    // Normal distribution has excess kurtosis ~0 and skewness ~0
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
    const result = service.decomposeTailRisk({
      returns: fatTailReturns,
    });
    expect(
      result.systematicTailRisk + result.idiosyncraticTailRisk,
    ).toBeCloseTo(1.0, 4);
  });

  it('tail index should be non-negative for absolute returns', () => {
    const result = service.decomposeTailRisk({
      returns: fatTailReturns,
    });
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
});
