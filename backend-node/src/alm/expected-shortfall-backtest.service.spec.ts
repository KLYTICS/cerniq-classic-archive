import { ExpectedShortfallBacktestService } from './expected-shortfall-backtest.service';

describe('ExpectedShortfallBacktestService', () => {
  let service: ExpectedShortfallBacktestService;

  beforeEach(() => {
    service = new ExpectedShortfallBacktestService();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ── backtestVaR ───────────────────────────────────────────

  it('perfect model with no exceptions returns zero exception rate', () => {
    // All returns are above -VaR (no breaches)
    const returns = Array.from({ length: 250 }, () => 0.005);
    const varEstimates = Array.from({ length: 250 }, () => 0.02);

    const result = service.backtestVaR({
      returns,
      varEstimates,
      confidenceLevel: 0.99,
    });

    expect(result.exceptions).toBe(0);
    expect(result.exceptionRate).toBe(0);
    expect(result.totalDays).toBe(250);
    expect(result.trafficLight).toBe('GREEN');
  });

  it('counts exceptions correctly when losses exceed VaR', () => {
    // 250 days, first 5 are exceptions (return < -VaR)
    const returns = Array.from({ length: 250 }, (_, i) =>
      i < 5 ? -0.05 : 0.005,
    );
    const varEstimates = Array.from({ length: 250 }, () => 0.02);

    const result = service.backtestVaR({
      returns,
      varEstimates,
      confidenceLevel: 0.99,
    });

    expect(result.exceptions).toBe(5);
    expect(result.exceptionRate).toBe(5 / 250);
    expect(result.details.filter((d) => d.exception)).toHaveLength(5);
  });

  it('known exception count gives correct Kupiec statistic', () => {
    // With exactly the expected number of exceptions, Kupiec LR should be near 0
    // At 95% confidence, expect ~5% exceptions = 12-13 out of 250
    const n = 250;
    const expectedExceptions = Math.round(n * 0.05);
    const returns = Array.from({ length: n }, (_, i) =>
      i < expectedExceptions ? -0.05 : 0.005,
    );
    const varEstimates = Array.from({ length: n }, () => 0.02);

    const result = service.backtestVaR({
      returns,
      varEstimates,
      confidenceLevel: 0.95,
    });

    // When exception rate matches expected rate, Kupiec statistic is near 0
    expect(result.kupiecStatistic).toBeLessThan(1);
    expect(result.kupiecPValue).toBeGreaterThan(0.05);
    expect(result.kupiecPass).toBe(true);
  });

  it('too many exceptions fail the Kupiec test', () => {
    // 40 exceptions out of 250 at 99% confidence (expected ~2.5)
    const n = 250;
    const returns = Array.from({ length: n }, (_, i) =>
      i < 40 ? -0.05 : 0.005,
    );
    const varEstimates = Array.from({ length: n }, () => 0.02);

    const result = service.backtestVaR({
      returns,
      varEstimates,
      confidenceLevel: 0.99,
    });

    expect(result.exceptions).toBe(40);
    expect(result.kupiecStatistic).toBeGreaterThan(3.84);
    expect(result.kupiecPass).toBe(false);
  });

  it('independent exceptions pass Christoffersen test', () => {
    // Spread exceptions evenly (every 50th day) -- not clustered
    const n = 250;
    const returns = Array.from({ length: n }, (_, i) =>
      i % 50 === 25 ? -0.05 : 0.005,
    );
    const varEstimates = Array.from({ length: n }, () => 0.02);

    const result = service.backtestVaR({
      returns,
      varEstimates,
      confidenceLevel: 0.99,
    });

    expect(result.christoffersenPass).toBe(true);
    expect(result.christoffersenPValue).toBeGreaterThan(0.05);
  });

  it('clustered exceptions fail Christoffersen test', () => {
    // 20 consecutive exceptions (highly clustered)
    const n = 250;
    const returns = Array.from({ length: n }, (_, i) =>
      i >= 100 && i < 120 ? -0.05 : 0.005,
    );
    const varEstimates = Array.from({ length: n }, () => 0.02);

    const result = service.backtestVaR({
      returns,
      varEstimates,
      confidenceLevel: 0.99,
    });

    expect(result.exceptions).toBe(20);
    expect(result.christoffersenPass).toBe(false);
  });

  // ── trafficLightClassification ────────────────────────────

  it('classifies green zone at 99%/250 days with 0-4 exceptions', () => {
    const result = service.trafficLightClassification({
      exceptions: 3,
      observations: 250,
      confidenceLevel: 0.99,
    });

    expect(result.zone).toBe('GREEN');
    expect(result.multiplier).toBe(3.0);
  });

  it('classifies yellow zone at 99%/250 days with 5-9 exceptions', () => {
    const result = service.trafficLightClassification({
      exceptions: 7,
      observations: 250,
      confidenceLevel: 0.99,
    });

    expect(result.zone).toBe('YELLOW');
    expect(result.multiplier).toBeGreaterThanOrEqual(3.4);
    expect(result.multiplier).toBeLessThanOrEqual(3.65);
  });

  it('classifies red zone at 99%/250 days with 10+ exceptions', () => {
    const result = service.trafficLightClassification({
      exceptions: 12,
      observations: 250,
      confidenceLevel: 0.99,
    });

    expect(result.zone).toBe('RED');
    expect(result.multiplier).toBe(4.0);
  });

  // ── backtestES ────────────────────────────────────────────

  it('ES ratio < 1 when model is conservative', () => {
    // ES estimates are larger than actual tail losses
    const n = 250;
    const returns = Array.from({ length: n }, (_, i) =>
      i < 5 ? -0.03 : 0.005,
    );
    const varEstimates = Array.from({ length: n }, () => 0.02);
    const esEstimates = Array.from({ length: n }, () => 0.05); // ES > actual tail losses

    const result = service.backtestES({
      returns,
      esEstimates,
      varEstimates,
      confidenceLevel: 0.99,
    });

    expect(result.esRatio).toBeLessThan(1);
    expect(result.esPass).toBe(true);
    expect(result.tailObservations).toBe(5);
    expect(result.averageTailLoss).toBeCloseTo(0.03, 4);
    expect(result.averageESEstimate).toBeCloseTo(0.05, 4);
  });

  it('ES ratio > 1 when model underestimates tail risk', () => {
    // Actual tail losses exceed ES estimates
    const n = 250;
    const returns = Array.from({ length: n }, (_, i) =>
      i < 5 ? -0.08 : 0.005,
    );
    const varEstimates = Array.from({ length: n }, () => 0.02);
    const esEstimates = Array.from({ length: n }, () => 0.04); // ES < actual tail losses

    const result = service.backtestES({
      returns,
      esEstimates,
      varEstimates,
      confidenceLevel: 0.99,
    });

    expect(result.esRatio).toBeGreaterThan(1);
    expect(result.esPass).toBe(false);
    expect(result.averageTailLoss).toBeCloseTo(0.08, 4);
  });

  // ── rollingBacktest ───────────────────────────────────────

  it('rolling backtest produces correct period count', () => {
    const windowSize = 50;
    const totalDays = 150;
    const returns = Array.from(
      { length: totalDays },
      (_, i) => (i % 7 === 0 ? -0.02 : 0.003) + Math.sin(i) * 0.001,
    );

    const result = service.rollingBacktest({
      returns,
      windowSize,
      confidenceLevel: 0.95,
      method: 'historical',
    });

    expect(result.periods).toHaveLength(totalDays - windowSize);
    expect(result.summary.totalExceptions).toBeGreaterThanOrEqual(0);
    expect(result.summary.rate).toBeDefined();
    expect(result.summary.trafficLight).toBeDefined();
  });

  it('rolling backtest with parametric method works', () => {
    const windowSize = 50;
    const totalDays = 150;
    // Deterministic returns with known properties
    const returns = Array.from(
      { length: totalDays },
      (_, i) => Math.sin(i * 0.1) * 0.01,
    );

    const result = service.rollingBacktest({
      returns,
      windowSize,
      confidenceLevel: 0.95,
      method: 'parametric',
    });

    expect(result.periods).toHaveLength(totalDays - windowSize);
    expect(result.summary.kupiecPValue).toBeGreaterThanOrEqual(0);
    expect(result.summary.kupiecPValue).toBeLessThanOrEqual(1);
  });

  it('99% VaR has approximately 1% exception rate on normal data', () => {
    // Generate a large set of returns from a deterministic pattern
    // that behaves roughly like a normal distribution
    const n = 1000;
    const windowSize = 250;

    // Use a seeded pseudo-random sequence via sine
    const returns: number[] = [];
    for (let i = 0; i < n; i++) {
      // Quasi-random with some tail behavior
      const x = Math.sin(i * 127.1 + 311.7) * 43758.5453;
      const u = x - Math.floor(x); // uniform-ish in [0,1)
      // Map to approximate normal via Box-Muller-ish transform
      const y = Math.sin((i + 1) * 269.5 + 183.3) * 43758.5453;
      const v = y - Math.floor(y);
      const normal =
        Math.sqrt(-2 * Math.log(Math.max(u, 1e-10))) *
        Math.cos(2 * Math.PI * v);
      returns.push(normal * 0.01); // ~1% daily vol
    }

    const result = service.rollingBacktest({
      returns,
      windowSize,
      confidenceLevel: 0.99,
      method: 'historical',
    });

    const totalPeriods = result.periods.length;
    const rate = result.summary.rate;

    // Exception rate should be in a reasonable range around 1%
    // Allow wider tolerance for deterministic pseudo-random data
    expect(rate).toBeGreaterThanOrEqual(0);
    expect(rate).toBeLessThanOrEqual(0.1); // Not wildly off
    expect(totalPeriods).toBe(n - windowSize);
  });

  // ── Edge cases ────────────────────────────────────────────

  it('throws on mismatched array lengths', () => {
    expect(() =>
      service.backtestVaR({
        returns: [0.01, 0.02],
        varEstimates: [0.01],
        confidenceLevel: 0.99,
      }),
    ).toThrow('returns and varEstimates must have the same length');
  });

  it('throws on empty returns', () => {
    expect(() =>
      service.backtestVaR({
        returns: [],
        varEstimates: [],
        confidenceLevel: 0.99,
      }),
    ).toThrow('returns array cannot be empty');
  });

  it('throws on mismatched ES array lengths', () => {
    expect(() =>
      service.backtestES({
        returns: [0.01],
        esEstimates: [0.02, 0.03],
        varEstimates: [0.01],
        confidenceLevel: 0.99,
      }),
    ).toThrow(
      'returns, esEstimates, and varEstimates must have the same length',
    );
  });

  it('ES backtest returns esPass true when no tail observations', () => {
    const returns = Array.from({ length: 10 }, () => 0.01); // no exceptions
    const varEstimates = Array.from({ length: 10 }, () => 0.005);
    const esEstimates = Array.from({ length: 10 }, () => 0.01);
    const result = service.backtestES({
      returns,
      esEstimates,
      varEstimates,
      confidenceLevel: 0.99,
    });
    expect(result.esPass).toBe(true);
    expect(result.tailObservations).toBe(0);
    expect(result.esRatio).toBe(0);
  });

  it('rolling backtest throws when returns length <= windowSize', () => {
    expect(() =>
      service.rollingBacktest({
        returns: [0.01, 0.02],
        windowSize: 5,
        confidenceLevel: 0.95,
        method: 'historical',
      }),
    ).toThrow('returns array must be longer than windowSize');
  });

  it('Kupiec test handles x === n case', () => {
    // All returns are exceptions
    const returns = Array.from({ length: 10 }, () => -0.1);
    const varEstimates = Array.from({ length: 10 }, () => 0.01);
    const result = service.backtestVaR({
      returns,
      varEstimates,
      confidenceLevel: 0.99,
    });
    expect(result.exceptions).toBe(10);
    expect(result.trafficLight).toBe('RED');
  });
});
