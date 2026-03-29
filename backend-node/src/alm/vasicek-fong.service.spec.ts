import { VasicekFongService } from './vasicek-fong.service';

describe('VasicekFongService', () => {
  let service: VasicekFongService;

  beforeEach(() => {
    service = new VasicekFongService();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should fit curve with observed rates', () => {
    const result = service.fitCurve([
      { tenor: 0.25, rate: 0.048 },
      { tenor: 1, rate: 0.044 },
      { tenor: 5, rate: 0.041 },
      { tenor: 10, rate: 0.042 },
      { tenor: 30, rate: 0.047 },
    ]);

    expect(result.knots.length).toBe(5);
    expect(result.interpolatedCurve.length).toBeGreaterThan(0);
    expect(result.maxError).toBeDefined();
  });

  it('should return demo result for insufficient data', () => {
    const result = service.fitCurve([
      { tenor: 1, rate: 0.04 },
      { tenor: 5, rate: 0.045 },
    ]);

    // Falls back to demo with 10 knot points
    expect(result.knots.length).toBe(10);
  });

  it('should compute discount factors from rates', () => {
    const result = service.fitCurve([
      { tenor: 1, rate: 0.04 },
      { tenor: 2, rate: 0.042 },
      { tenor: 5, rate: 0.045 },
      { tenor: 10, rate: 0.048 },
    ]);

    for (const knot of result.knots) {
      expect(knot.discountFactor).toBeGreaterThan(0);
      expect(knot.discountFactor).toBeLessThanOrEqual(1);
    }
  });

  it('should include forward rates in interpolated curve', () => {
    const result = service.fitCurve([
      { tenor: 1, rate: 0.04 },
      { tenor: 3, rate: 0.042 },
      { tenor: 5, rate: 0.044 },
      { tenor: 10, rate: 0.046 },
    ]);

    for (const point of result.interpolatedCurve) {
      expect(typeof point.forwardRate).toBe('number');
    }
  });

  it('should provide bilingual interpretations', () => {
    const result = service.fitCurve([
      { tenor: 1, rate: 0.04 },
      { tenor: 5, rate: 0.044 },
      { tenor: 10, rate: 0.046 },
      { tenor: 30, rate: 0.048 },
    ]);

    expect(result.interpretation).toContain('Vasicek-Fong');
    expect(result.interpretationEs).toContain('Vasicek-Fong');
  });
});
