import { CIRModelService } from './cir-model.service';

describe('CIRModelService', () => {
  const svc = new CIRModelService();

  it('should return correct output shape', () => {
    const result = svc.simulate({ numPaths: 100, horizonYears: 1 });
    expect(result).toHaveProperty('params');
    expect(result).toHaveProperty('simulation');
    expect(result).toHaveProperty('bondPrices');
    expect(result).toHaveProperty('interpretation');
    expect(result).toHaveProperty('interpretationEs');
    expect(result.simulation).toHaveProperty('meanPath');
    expect(result.simulation).toHaveProperty('percentiles');
    expect(result.simulation).toHaveProperty('samplePaths');
  });

  it('should satisfy Feller condition with default params', () => {
    const result = svc.simulate({});
    // default: a=0.15, b=0.04, sigma=0.06
    // 2ab = 2*0.15*0.04 = 0.012 > sigma^2 = 0.0036
    expect(result.params.fellerSatisfied).toBe(true);
  });

  it('should detect violated Feller condition', () => {
    const result = svc.simulate({ a: 0.01, b: 0.01, sigma: 0.5, numPaths: 10 });
    // 2ab = 2*0.01*0.01 = 0.0002 < sigma^2 = 0.25
    expect(result.params.fellerSatisfied).toBe(false);
  });

  it('should produce mean path converging to long-run rate', () => {
    const result = svc.simulate({
      r0: 0.08,
      b: 0.04,
      a: 0.5,
      horizonYears: 10,
      numPaths: 50,
    });
    const meanPath = result.simulation.meanPath;
    const lastValue = meanPath[meanPath.length - 1];
    // Should converge toward b = 0.04
    expect(lastValue).toBeCloseTo(0.04, 1);
  });

  it('should produce 7 bond prices for standard maturities', () => {
    const result = svc.simulate({ numPaths: 10 });
    expect(result.bondPrices.length).toBe(7);
    for (const bp of result.bondPrices) {
      expect(bp.price).toBeGreaterThan(0);
      expect(bp.price).toBeLessThanOrEqual(1);
      expect(bp.yield_).toBeGreaterThan(0);
    }
  });

  it('should start mean path at r0', () => {
    const result = svc.simulate({ r0: 0.06, numPaths: 10 });
    expect(result.simulation.meanPath[0]).toBeCloseTo(0.06, 4);
  });

  // ── Coverage: sample paths are capped at 5 ──────────────────
  it('should produce at most 5 sample paths', () => {
    const result = svc.simulate({ numPaths: 100, horizonYears: 2 });
    expect(result.simulation.samplePaths.length).toBeLessThanOrEqual(5);
    for (const path of result.simulation.samplePaths) {
      expect(path.length).toBeGreaterThan(1);
      expect(path[0]).toBeCloseTo(0.045, 3); // default r0
    }
  });

  // ── Coverage: percentile bands ──────────────────────────────
  it('should produce 5 percentile bands (p5, p25, p50, p75, p95)', () => {
    const result = svc.simulate({ numPaths: 50, horizonYears: 1 });
    expect(Object.keys(result.simulation.percentiles)).toEqual(
      expect.arrayContaining(['p5', 'p25', 'p50', 'p75', 'p95']),
    );
    // p5 should be lower than p95 at each time step
    const p5 = result.simulation.percentiles['p5'];
    const p95 = result.simulation.percentiles['p95'];
    expect(p5.length).toBe(p95.length);
  });

  // ── Coverage: interpretation text ───────────────────────────
  it('includes interpretation in English and Spanish', () => {
    const result = svc.simulate({ numPaths: 10 });
    expect(result.interpretation.length).toBeGreaterThan(0);
    expect(result.interpretationEs.length).toBeGreaterThan(0);
    expect(result.interpretation).toContain('CIR');
    expect(result.interpretationEs).toContain('CIR');
  });

  // ── Coverage: very short horizon ────────────────────────────
  it('handles very short horizon', () => {
    const result = svc.simulate({ horizonYears: 0.25, numPaths: 10 });
    expect(result.simulation.meanPath.length).toBeGreaterThanOrEqual(2);
    expect(result.bondPrices.length).toBe(7);
  });
});
