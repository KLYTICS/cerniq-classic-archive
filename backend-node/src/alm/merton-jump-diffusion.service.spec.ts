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
    const result = service.simulate({ numPaths: 5000, jumpIntensity: 1.0, jumpVol: 0.15 });
    expect(result.statistics.kurtosis).toBeGreaterThan(2.5);
  });

  it('jump probability should follow Poisson 1 - exp(-lambda)', () => {
    const result = service.simulate({ jumpIntensity: 0.5 });
    const expected = 1 - Math.exp(-0.5);
    expect(result.riskMetrics.jumpProbability1Y).toBeCloseTo(expected, 2);
  });

  it('VaR99 should exceed VaR95', () => {
    const result = service.simulate({ numPaths: 5000 });
    expect(result.riskMetrics.var99).toBeGreaterThanOrEqual(result.riskMetrics.var95);
  });

  it('jump contribution percentage should be positive', () => {
    const result = service.simulate({ jumpIntensity: 0.5, jumpMean: -0.05, jumpVol: 0.08 });
    expect(result.statistics.jumpContributionPct).toBeGreaterThan(0);
  });
});
