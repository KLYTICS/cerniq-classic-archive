import { JarrowTurnbullService } from './jarrow-turnbull.service';

describe('JarrowTurnbullService', () => {
  let service: JarrowTurnbullService;

  beforeEach(() => {
    service = new JarrowTurnbullService();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should bootstrap hazard rates from credit spreads', () => {
    const result = service.analyze({
      creditSpreads: [
        { tenor: 1, spread: 0.005 },
        { tenor: 3, spread: 0.008 },
        { tenor: 5, spread: 0.01 },
      ],
      riskFreeRates: [
        { tenor: 1, rate: 0.04 },
        { tenor: 3, rate: 0.042 },
        { tenor: 5, rate: 0.045 },
      ],
    });

    expect(result.hazardRates.length).toBe(3);
    for (const hr of result.hazardRates) {
      expect(hr.hazardRate).toBeGreaterThan(0);
      expect(hr.survivalProb).toBeLessThanOrEqual(1);
      expect(hr.defaultProb).toBeGreaterThanOrEqual(0);
    }
  });

  it('should price risky bond below risk-free bond', () => {
    const result = service.analyze({
      creditSpreads: [
        { tenor: 1, spread: 0.01 },
        { tenor: 5, spread: 0.015 },
      ],
      riskFreeRates: [
        { tenor: 1, rate: 0.04 },
        { tenor: 5, rate: 0.045 },
      ],
      notional: 1_000_000,
      couponRate: 0.05,
      maturity: 5,
    });

    expect(result.riskyBondPrice).toBeLessThan(result.riskFreeBondPrice);
    expect(result.cva).toBeGreaterThan(0);
  });

  it('should compute positive credit spread', () => {
    const result = service.analyze({
      creditSpreads: [
        { tenor: 1, spread: 0.008 },
        { tenor: 5, spread: 0.012 },
      ],
      riskFreeRates: [
        { tenor: 1, rate: 0.04 },
        { tenor: 5, rate: 0.045 },
      ],
    });

    expect(result.creditSpread).toBeGreaterThan(0);
  });

  it('should use default recovery of 0.4', () => {
    const result = service.analyze({
      creditSpreads: [{ tenor: 5, spread: 0.01 }],
      riskFreeRates: [{ tenor: 5, rate: 0.04 }],
    });

    expect(result.recovery).toBe(0.4);
  });

  it('should provide bilingual interpretations', () => {
    const result = service.analyze({
      creditSpreads: [{ tenor: 5, spread: 0.01 }],
      riskFreeRates: [{ tenor: 5, rate: 0.04 }],
    });

    expect(result.interpretation).toContain('Implied');
    expect(result.interpretationEs).toContain('PD implicita');
  });
});
