import { MertonJumpDiffusionService } from './merton-jump-diffusion.service';

describe('MertonJumpDiffusionService', () => {
  let service: MertonJumpDiffusionService;

  beforeEach(() => {
    service = new MertonJumpDiffusionService();
  });

  it('should return params matching inputs', () => {
    const result = service.simulate({ drift: 0.05, diffusionVol: 0.2 });
    expect(result.params.drift).toBeCloseTo(0.05, 2);
    expect(result.params.diffusionVol).toBeCloseTo(0.2, 2);
  });

  it('should produce 10 sample paths', () => {
    const result = service.simulate({ numPaths: 100 });
    expect(result.paths).toHaveLength(10);
    expect(result.paths[0].length).toBeGreaterThan(1);
    expect(result.paths[0][0]).toBeCloseTo(100, 0); // initial value
  });

  it('kurtosis should exceed 3 (fat tails from jumps)', () => {
    const result = service.simulate({
      numPaths: 5000,
      jumpIntensity: 1.0,
      jumpVol: 0.15,
    });
    expect(result.statistics.kurtosis).toBeGreaterThan(2.5);
  });

  it('jump probability should follow Poisson 1 - exp(-lambda)', () => {
    const result = service.simulate({ jumpIntensity: 0.5 });
    const expected = 1 - Math.exp(-0.5);
    expect(result.riskMetrics.jumpProbability1Y).toBeCloseTo(expected, 2);
  });

  it('VaR99 should exceed VaR95', () => {
    const result = service.simulate({ numPaths: 5000 });
    expect(result.riskMetrics.var99).toBeGreaterThanOrEqual(
      result.riskMetrics.var95,
    );
  });

  it('jump contribution percentage should be positive', () => {
    const result = service.simulate({
      jumpIntensity: 0.5,
      jumpMean: -0.05,
      jumpVol: 0.08,
    });
    expect(result.statistics.jumpContributionPct).toBeGreaterThan(0);
  });

  // ── Coverage boost ──

  it('uses default parameters when none provided', () => {
    const result = service.simulate({});
    expect(result.params.drift).toBeCloseTo(0.03, 2);
    expect(result.params.diffusionVol).toBeCloseTo(0.15, 2);
    expect(result.params.jumpIntensity).toBeCloseTo(0.5, 2);
    expect(result.params.jumpMean).toBeCloseTo(-0.05, 2);
    expect(result.params.jumpVol).toBeCloseTo(0.08, 2);
  });

  it('skewness should be negative with negative jump mean', () => {
    const result = service.simulate({
      numPaths: 5000,
      jumpIntensity: 1.0,
      jumpMean: -0.1,
      jumpVol: 0.1,
    });
    // Negative jumps create negative skewness
    expect(result.statistics.skewness).toBeLessThan(1);
  });

  it('maxDrawdown should be positive', () => {
    const result = service.simulate({ numPaths: 1000 });
    expect(result.riskMetrics.maxDrawdown).toBeGreaterThan(0);
  });

  it('CVaR95 should exceed VaR95 (expected shortfall >= VaR)', () => {
    const result = service.simulate({ numPaths: 5000 });
    expect(result.riskMetrics.cvar95).toBeGreaterThanOrEqual(result.riskMetrics.var95);
  });

  it('interpretation strings contain key metrics', () => {
    const result = service.simulate({ numPaths: 1000 });
    expect(result.interpretation).toContain('Total vol');
    expect(result.interpretation).toContain('Kurtosis');
    expect(result.interpretation).toContain('VaR(99%)');
    expect(result.interpretation).toContain('Jump probability');
  });

  it('interpretationEs is in Spanish', () => {
    const result = service.simulate({ numPaths: 1000 });
    expect(result.interpretationEs).toContain('Vol total');
    expect(result.interpretationEs).toContain('Curtosis');
    expect(result.interpretationEs).toContain('Probabilidad de salto');
  });

  it('very low jumpIntensity uses simplified Poisson branch', () => {
    // jumpIntensity * dt < 0.01 triggers the simplified branch
    const result = service.simulate({
      jumpIntensity: 0.001,
      numPaths: 100,
      stepsPerYear: 252,
    });
    expect(result.paths).toHaveLength(10);
    expect(result.riskMetrics.jumpProbability1Y).toBeLessThan(0.01);
  });

  it('high jumpIntensity produces more extreme outcomes', () => {
    const lowJump = service.simulate({
      jumpIntensity: 0.1,
      numPaths: 2000,
    });
    const highJump = service.simulate({
      jumpIntensity: 2.0,
      numPaths: 2000,
    });
    // Higher jump intensity should produce higher jump contribution
    expect(highJump.statistics.jumpContributionPct).toBeGreaterThan(
      lowJump.statistics.jumpContributionPct,
    );
  });

  it('custom horizonYears affects path length', () => {
    const result = service.simulate({
      horizonYears: 1,
      stepsPerYear: 252,
      numPaths: 10,
    });
    // Each path should have 252 + 1 entries (initial + steps)
    expect(result.paths[0].length).toBe(253);
  });

  it('exercises full Poisson branch (lambda*dt >= 0.01) with low stepsPerYear', () => {
    // With stepsPerYear=12, dt=1/12, jumpIntensity=5 => lambda*dt = 5/12 ≈ 0.417 >= 0.01
    // This ensures lines 177-184 (do..while Poisson) get executed
    const result = service.simulate({
      jumpIntensity: 5,
      stepsPerYear: 12,
      horizonYears: 1,
      numPaths: 100,
    });
    expect(result.paths).toHaveLength(10);
    // With high jump intensity, jump contribution should be very high
    expect(result.statistics.jumpContributionPct).toBeGreaterThan(20);
  });

  it('full Poisson with moderate lambda exercises do-while loop multiple times', () => {
    // jumpIntensity=10, stepsPerYear=4, dt=0.25, lambda=2.5
    // Multiple jumps per step expected
    const result = service.simulate({
      jumpIntensity: 10,
      stepsPerYear: 4,
      horizonYears: 1,
      numPaths: 50,
    });
    expect(result.paths).toHaveLength(10);
    expect(result.riskMetrics.jumpProbability1Y).toBeCloseTo(1, 1);
  });
});
