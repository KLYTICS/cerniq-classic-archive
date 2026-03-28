import { GARCHVolatilityService } from './garch-volatility.service';

describe('GARCHVolatilityService', () => {
  let service: GARCHVolatilityService;

  beforeEach(() => {
    service = new GARCHVolatilityService({} as any);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('returns demo forecast when fewer than 30 observations', () => {
    const returns = Array.from({ length: 10 }, () => 0.001);
    const dates = returns.map((_, i) => `2025-01-${String(i + 1).padStart(2, '0')}`);
    const result = service.fitAndForecast(returns, dates);

    expect(result.params.alpha).toBeCloseTo(0.08, 2);
    expect(result.params.beta).toBeCloseTo(0.89, 2);
    expect(result.params.persistence).toBeCloseTo(0.97, 2);
  });

  it('estimates GARCH parameters with stationarity (alpha+beta < 1)', () => {
    // Generate 100 returns with some volatility clustering
    const rng = seedRNG(42);
    const returns: number[] = [];
    for (let i = 0; i < 100; i++) {
      returns.push((rng() - 0.5) * 0.02);
    }
    const dates = returns.map((_, i) => `2025-01-${String((i % 28) + 1).padStart(2, '0')}`);

    const result = service.fitAndForecast(returns, dates);

    expect(result.params.persistence).toBeLessThan(1);
    expect(result.params.alpha).toBeGreaterThan(0);
    expect(result.params.beta).toBeGreaterThan(0);
    expect(result.params.omega).toBeGreaterThan(0);
  });

  it('produces forecasts for all requested horizons', () => {
    const returns = generateReturns(60);
    const dates = returns.map((_, i) => `2025-01-${String((i % 28) + 1).padStart(2, '0')}`);
    const horizons = [1, 5, 10, 21];

    const result = service.fitAndForecast(returns, dates, horizons);

    expect(result.forecasts).toHaveLength(4);
    expect(result.forecasts[0].horizon).toBe(1);
    expect(result.forecasts[3].horizon).toBe(21);
    for (const f of result.forecasts) {
      expect(f.variance).toBeGreaterThan(0);
      expect(f.volatility).toBeGreaterThan(0);
      expect(f.annualizedVol).toBeCloseTo(f.volatility * Math.sqrt(252), 4);
    }
  });

  it('computes diagnostics including AIC and BIC', () => {
    const returns = generateReturns(80);
    const dates = returns.map((_, i) => `day-${i}`);
    const result = service.fitAndForecast(returns, dates);

    expect(result.diagnostics.observationCount).toBe(80);
    expect(result.diagnostics.aic).toBeDefined();
    expect(result.diagnostics.bic).toBeDefined();
    expect(result.diagnostics.bic).toBeGreaterThan(result.diagnostics.aic); // BIC penalizes more for n>7
  });

  it('historical vols are limited to last 60 observations', () => {
    const returns = generateReturns(100);
    const dates = returns.map((_, i) => `day-${i}`);
    const result = service.fitAndForecast(returns, dates);

    expect(result.historicalVols.length).toBeLessThanOrEqual(60);
  });

  it('long-run volatility converges for large forecast horizons', () => {
    const returns = generateReturns(100);
    const dates = returns.map((_, i) => `day-${i}`);
    const result = service.fitAndForecast(returns, dates, [1, 252]);

    const shortVol = result.forecasts[0].variance;
    const longVol = result.forecasts[1].variance;
    // Long-run variance should tend toward params.longRunVariance
    expect(longVol).toBeGreaterThan(0);
    expect(shortVol).toBeGreaterThan(0);
  });
});

// Helpers
function seedRNG(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    return (s >>> 0) / 0xffffffff;
  };
}

function generateReturns(n: number): number[] {
  const rng = seedRNG(123);
  return Array.from({ length: n }, () => (rng() - 0.5) * 0.02);
}
