import { DurationConvexityService } from './duration-convexity.service';

describe('DurationConvexityService', () => {
  const svc = new DurationConvexityService();

  const baseInstruments = [
    {
      name: '5Y Treasury',
      marketValue: 1_000_000,
      couponRate: 0.04,
      ytm: 0.04,
      maturityYears: 5,
      frequency: 2,
    },
    {
      name: '10Y Bond',
      marketValue: 2_000_000,
      couponRate: 0.05,
      ytm: 0.05,
      maturityYears: 10,
      frequency: 2,
    },
  ];

  it('should return correct output shape', () => {
    const result = svc.analyze({ instruments: baseInstruments });
    expect(result).toHaveProperty('portfolio');
    expect(result).toHaveProperty('instruments');
    expect(result).toHaveProperty('scenarioAnalysis');
    expect(result).toHaveProperty('interpretation');
    expect(result).toHaveProperty('interpretationEs');
    expect(result.portfolio).toHaveProperty('macaulayDuration');
    expect(result.portfolio).toHaveProperty('modifiedDuration');
    expect(result.portfolio).toHaveProperty('convexity');
    expect(result.portfolio).toHaveProperty('pvbp');
  });

  it('should compute Macaulay duration approximately correct for par bond', () => {
    // A 5-year semiannual 4% coupon bond at par should have Macaulay ~4.5 years
    const result = svc.analyze({
      instruments: [
        {
          name: '5Y Par',
          marketValue: 1_000_000,
          couponRate: 0.04,
          ytm: 0.04,
          maturityYears: 5,
          frequency: 2,
        },
      ],
    });
    expect(result.portfolio.macaulayDuration).toBeCloseTo(4.56, 0);
  });

  it('should have modified duration < Macaulay duration', () => {
    const result = svc.analyze({ instruments: baseInstruments });
    expect(result.portfolio.modifiedDuration).toBeLessThan(
      result.portfolio.macaulayDuration,
    );
  });

  it('should have positive convexity for plain bonds', () => {
    const result = svc.analyze({ instruments: baseInstruments });
    expect(result.portfolio.convexity).toBeGreaterThan(0);
  });

  it('should show convexity benefit is always non-negative', () => {
    const result = svc.analyze({ instruments: baseInstruments });
    for (const scenario of result.scenarioAnalysis) {
      expect(scenario.convexityBenefit).toBeGreaterThanOrEqual(0);
    }
  });

  it('should have instrument weights summing to 1', () => {
    const result = svc.analyze({ instruments: baseInstruments });
    const wSum = result.instruments.reduce((s, i) => s + i.weight, 0);
    expect(wSum).toBeCloseTo(1.0, 2);
  });
});
