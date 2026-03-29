import { NIMForecastService } from './net-interest-margin-forecast.service';

describe('NIMForecastService', () => {
  let service: NIMForecastService;

  const baseParams = {
    currentNIM: 0.035, // 3.5%
    earningAssets: 400_000_000,
    interestIncome: 18_000_000,
    interestExpense: 4_000_000,
    assetBeta: 0.6,
    liabilityBeta: 0.4,
    rateScenarios: [
      { name: 'Base', nameEs: 'Base', shockBps: 0 },
      { name: '+100bps', nameEs: '+100pbs', shockBps: 100 },
      { name: '-100bps', nameEs: '-100pbs', shockBps: -100 },
    ],
    quarters: 4,
  };

  beforeEach(() => {
    service = new NIMForecastService();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should return correct output shape with projections', () => {
    const result = service.forecast(baseParams);
    expect(result).toHaveProperty('projections');
    expect(result).toHaveProperty('baseNIM');
    expect(result).toHaveProperty('interpretation');
    expect(result).toHaveProperty('interpretationEs');
    expect(result.projections).toHaveLength(3);
    expect(result.baseNIM).toBe(0.035);
  });

  it('should keep NIM unchanged in base (0bps) scenario', () => {
    const result = service.forecast(baseParams);
    const base = result.projections.find((p) => p.scenario === 'Base')!;
    expect(base.endingNIM).toBeCloseTo(0.035, 4);
    expect(base.nimChangeBps).toBe(0);
    expect(base.quarterlyNIM).toHaveLength(4);
  });

  it('should increase NIM when asset beta > liability beta and rates rise', () => {
    const result = service.forecast(baseParams);
    const up = result.projections.find((p) => p.shockBps === 100)!;
    // assetBeta(0.6) > liabilityBeta(0.4) -> positive NIM change on rate up
    expect(up.endingNIM).toBeGreaterThan(0.035);
    expect(up.nimChangeBps).toBeGreaterThan(0);
    expect(up.annualizedNIIChange).toBeGreaterThan(0);
  });

  it('should decrease NIM when asset beta > liability beta and rates fall', () => {
    const result = service.forecast(baseParams);
    const down = result.projections.find((p) => p.shockBps === -100)!;
    expect(down.endingNIM).toBeLessThan(0.035);
    expect(down.nimChangeBps).toBeLessThan(0);
  });

  it('should floor NIM at 0.5% (0.005) even with extreme negative shock', () => {
    const extremeParams = {
      ...baseParams,
      currentNIM: 0.01, // already low
      rateScenarios: [{ name: 'Extreme', nameEs: 'Extremo', shockBps: -500 }],
      quarters: 8,
    };
    const result = service.forecast(extremeParams);
    const projection = result.projections[0];
    for (const nim of projection.quarterlyNIM) {
      expect(nim).toBeGreaterThanOrEqual(0.005);
    }
  });
});
