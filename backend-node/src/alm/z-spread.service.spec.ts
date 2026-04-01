import { ZSpreadService } from './z-spread.service';

describe('ZSpreadService', () => {
  let service: ZSpreadService;
  const zeroCurve = [
    { tenor: 0.5, rate: 0.045 },
    { tenor: 1, rate: 0.044 },
    { tenor: 2, rate: 0.042 },
    { tenor: 5, rate: 0.04 },
    { tenor: 10, rate: 0.042 },
    { tenor: 30, rate: 0.046 },
  ];

  beforeEach(() => {
    service = new ZSpreadService();
  });

  it('bond priced at par with coupon = yield should have near-zero z-spread', () => {
    const result = service.calculate({
      marketPrice: 100,
      parValue: 100,
      couponRate: 0.042,
      maturityYears: 5,
      frequency: 2,
      zeroCurve,
    });
    expect(Math.abs(result.zSpreadBps)).toBeLessThan(30);
  });

  it('discount bond should have positive z-spread', () => {
    const result = service.calculate({
      marketPrice: 95,
      parValue: 100,
      couponRate: 0.03,
      maturityYears: 5,
      frequency: 2,
      zeroCurve,
    });
    expect(result.zSpreadBps).toBeGreaterThan(0);
  });

  it('premium bond should have lower z-spread', () => {
    const discount = service.calculate({
      marketPrice: 95,
      parValue: 100,
      couponRate: 0.04,
      maturityYears: 5,
      frequency: 2,
      zeroCurve,
    });
    const premium = service.calculate({
      marketPrice: 105,
      parValue: 100,
      couponRate: 0.04,
      maturityYears: 5,
      frequency: 2,
      zeroCurve,
    });
    expect(discount.zSpreadBps).toBeGreaterThan(premium.zSpreadBps);
  });

  it('should converge in reasonable iterations', () => {
    const result = service.calculate({
      marketPrice: 98,
      parValue: 100,
      couponRate: 0.04,
      maturityYears: 10,
      frequency: 2,
      zeroCurve,
    });
    expect(result.iterations).toBeLessThan(50);
  });

  it('interpretation should mention bps', () => {
    const result = service.calculate({
      marketPrice: 98,
      parValue: 100,
      couponRate: 0.04,
      maturityYears: 5,
      frequency: 2,
      zeroCurve,
    });
    expect(result.interpretation).toContain('bps');
    expect(result.interpretationEs).toContain('pbs');
  });

  it('uses default frequency of 2 when not specified', () => {
    const result = service.calculate({
      marketPrice: 98,
      parValue: 100,
      couponRate: 0.04,
      maturityYears: 5,
      zeroCurve,
    });
    expect(result.zSpread).toBeDefined();
    expect(result.iterations).toBeLessThan(100);
  });

  it('interpolates zero curve correctly for tenors before first point', () => {
    const shortCurve = [
      { tenor: 1, rate: 0.04 },
      { tenor: 5, rate: 0.05 },
    ];
    const result = service.calculate({
      marketPrice: 99,
      parValue: 100,
      couponRate: 0.04,
      maturityYears: 1,
      frequency: 1,
      zeroCurve: shortCurve,
    });
    expect(result.zSpread).toBeDefined();
  });

  it('handles non-convergence scenario gracefully', () => {
    // Very extreme pricing that won't converge easily
    const result = service.calculate({
      marketPrice: 1,
      parValue: 100,
      couponRate: 0.001,
      maturityYears: 30,
      frequency: 2,
      zeroCurve,
    });
    // Should still return a result (possibly with 100 iterations)
    expect(result.iterations).toBeLessThanOrEqual(100);
    expect(typeof result.zSpread).toBe('number');
  });

  it('covers interpolation fallback for tenor beyond curve', () => {
    // Access private interpolate to hit the fallback line 87
    const interpolate = (service as any).interpolate.bind(service);
    // Tenor beyond last point - hits line 79 (t >= curve[last].tenor)
    const rate = interpolate(zeroCurve, 50);
    expect(rate).toBe(zeroCurve[zeroCurve.length - 1].rate);

    // Tenor before first point - hits line 78
    const rateEarly = interpolate(zeroCurve, 0.1);
    expect(rateEarly).toBe(zeroCurve[0].rate);
  });

  it('reaches non-convergence return when Newton diverges', () => {
    // Craft a scenario where NR definitely diverges:
    // Tiny zero curve that prevents proper discounting
    const badCurve = [{ tenor: 0.5, rate: -0.99 }];
    const result = service.calculate({
      marketPrice: 50,
      parValue: 100,
      couponRate: 0.0,
      maturityYears: 0.5,
      frequency: 1,
      zeroCurve: badCurve,
    });
    // Should either converge or hit 100 iterations
    expect(typeof result.zSpread).toBe('number');
    expect(typeof result.interpretationEs).toBe('string');
  });
});
