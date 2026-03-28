import { PCAYieldCurveService } from './pca-yield-curve.service';

describe('PCAYieldCurveService', () => {
  let service: PCAYieldCurveService;

  beforeEach(() => {
    service = new PCAYieldCurveService();
  });

  it('should return demo result for insufficient data', () => {
    const result = service.computePCAFactors([]);
    expect(result.factors).toHaveLength(3);
    expect(result.factors[0].name).toBe('Level');
    expect(result.factors[1].name).toBe('Slope');
    expect(result.factors[2].name).toBe('Curvature');
  });

  it('total explained variance should be close to 100% for demo', () => {
    const result = service.computePCAFactors([]);
    expect(result.totalExplainedPct).toBeCloseTo(99.1, 1);
  });

  it('should compute PCA from synthetic yield changes', () => {
    const baseRates = [
      0.048, 0.046, 0.044, 0.042, 0.041, 0.04, 0.041, 0.042, 0.045, 0.046,
    ];
    const changes = service.generateSyntheticChanges(baseRates, 100);
    const result = service.computePCAFactors(changes);
    expect(result.factors).toHaveLength(3);
    expect(result.factors[0].explainedVariancePct).toBeGreaterThan(50);
  });

  it('Level factor should explain most variance', () => {
    const baseRates = [
      0.048, 0.046, 0.044, 0.042, 0.041, 0.04, 0.041, 0.042, 0.045, 0.046,
    ];
    const changes = service.generateSyntheticChanges(baseRates, 100);
    const result = service.computePCAFactors(changes);
    expect(result.factors[0].explainedVariancePct).toBeGreaterThan(
      result.factors[1].explainedVariancePct,
    );
  });

  it('attributeDV01 should return level, slope, curvature', () => {
    const result = service.computePCAFactors([]);
    const dv01 = [1, 1, 1, 1, 1, 1, 1, 1, 1, 1];
    const attr = service.attributeDV01(dv01, result.factors);
    expect(attr).toHaveProperty('level');
    expect(attr).toHaveProperty('slope');
    expect(attr).toHaveProperty('curvature');
  });

  it('generateSyntheticChanges should return correct shape', () => {
    const baseRates = [0.04, 0.042, 0.044];
    const changes = service.generateSyntheticChanges(baseRates, 52);
    expect(changes).toHaveLength(52);
    expect(changes[0]).toHaveLength(3);
  });
});
