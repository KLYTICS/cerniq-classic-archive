import { BasisRiskService } from './basis-risk.service';

describe('BasisRiskService', () => {
  let service: BasisRiskService;

  beforeEach(() => {
    service = new BasisRiskService();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('returns low risk when current spread is near historical mean', () => {
    const result = service.analyze({
      assetIndex: 'SOFR',
      liabilityIndex: 'Fed Funds',
      historicalSpread: [0.001, 0.0012, 0.0008, 0.0011, 0.0009],
      currentSpread: 0.001,
    });

    expect(result.risk).toBe('low');
    expect(result.meanSpread).toBeCloseTo(0.001, 3);
    expect(result.spreadVol).toBeGreaterThan(0);
    expect(result.currentVsHistorical).toBeLessThan(1);
    expect(result.interpretation).toContain('SOFR');
    expect(result.interpretationEs).toContain('Riesgo base');
  });

  it('returns high risk when spread deviates > 2 sigma', () => {
    const result = service.analyze({
      assetIndex: 'Prime',
      liabilityIndex: 'SOFR',
      historicalSpread: [0.01, 0.01, 0.01, 0.01, 0.01],
      currentSpread: 0.05, // far from mean
    });

    expect(result.risk).toBe('high');
    expect(result.currentVsHistorical).toBeGreaterThanOrEqual(2);
  });

  it('computes correct z-score for known data', () => {
    // All same values => vol ~0, zScore handled by vol||1 guard
    const result = service.analyze({
      assetIndex: 'A',
      liabilityIndex: 'B',
      historicalSpread: [0.005, 0.005, 0.005],
      currentSpread: 0.006,
    });

    expect(result.meanSpread).toBeCloseTo(0.005, 3);
    expect(result.currentVsHistorical).toBeGreaterThan(0);
  });

  it('moderate risk when z-score between 1 and 2', () => {
    // Create data with known std dev
    const spreads = [0.01, 0.02, 0.03, 0.02, 0.01];
    const mean = 0.018;
    const result = service.analyze({
      assetIndex: 'X',
      liabilityIndex: 'Y',
      historicalSpread: spreads,
      currentSpread: mean + 0.012, // about 1.5 sigma
    });

    expect(result.risk).toBe('moderate');
  });

  it('output shape has all required fields', () => {
    const result = service.analyze({
      assetIndex: 'A',
      liabilityIndex: 'B',
      historicalSpread: [0.001, 0.002, 0.003],
      currentSpread: 0.002,
    });

    expect(typeof result.meanSpread).toBe('number');
    expect(typeof result.spreadVol).toBe('number');
    expect(typeof result.currentVsHistorical).toBe('number');
    expect(['low', 'moderate', 'high']).toContain(result.risk);
    expect(typeof result.interpretation).toBe('string');
    expect(typeof result.interpretationEs).toBe('string');
  });
});
