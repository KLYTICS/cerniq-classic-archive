import { SABRVolatilityService } from './sabr-volatility.service';

describe('SABRVolatilityService', () => {
  let service: SABRVolatilityService;

  beforeEach(() => {
    service = new SABRVolatilityService();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('produces vol smile with correct number of strikes', () => {
    const result = service.calibrateAndPrice({
      forward: 0.05,
      expiry: 1.0,
      numStrikes: 10,
    });

    expect(result.volSmile).toHaveLength(10);
    expect(result.params.forward).toBe(0.05);
    expect(result.params.beta).toBe(0.5);
    expect(result.params.rho).toBe(-0.2);
    expect(result.interpretation).toContain('SABR');
    expect(result.interpretationEs).toContain('SABR');
  });

  it('ATM vol is positive and reasonable', () => {
    const result = service.calibrateAndPrice({
      forward: 0.04,
      expiry: 1.0,
      sigma0: 0.2,
    });

    expect(result.skewMetrics.atmVol).toBeGreaterThan(0);
    expect(result.skewMetrics.atmVol).toBeLessThan(500); // percent
  });

  it('negative rho produces negative risk reversal (negative skew)', () => {
    const result = service.calibrateAndPrice({
      forward: 0.05,
      expiry: 1.0,
      rho: -0.4,
    });

    // Negative rho => OTM puts more expensive => negative RR (or near zero)
    expect(result.params.rho).toBe(-0.4);
    expect(result.interpretation).toContain('negative skew');
    expect(result.interpretationEs).toContain('sesgo negativo');
  });

  it('positive rho produces positive skew label', () => {
    const result = service.calibrateAndPrice({
      forward: 0.05,
      expiry: 1.0,
      rho: 0.3,
    });

    expect(result.interpretation).toContain('positive skew');
    expect(result.interpretationEs).toContain('sesgo positivo');
  });

  it('vol smile has monotonic moneyness', () => {
    const result = service.calibrateAndPrice({
      forward: 0.05,
      expiry: 1.0,
      numStrikes: 15,
    });

    for (let i = 1; i < result.volSmile.length; i++) {
      expect(result.volSmile[i].strike).toBeGreaterThan(
        result.volSmile[i - 1].strike,
      );
      expect(result.volSmile[i].moneyness).toBeGreaterThan(
        result.volSmile[i - 1].moneyness,
      );
    }
  });
});
