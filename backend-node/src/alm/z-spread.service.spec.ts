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
});
