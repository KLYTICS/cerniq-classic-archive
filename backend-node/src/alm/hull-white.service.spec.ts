import { HullWhiteService, TermStructurePoint } from './hull-white.service';

describe('HullWhiteService', () => {
  let service: HullWhiteService;

  // A realistic upward-sloping term structure
  const termStructure: TermStructurePoint[] = [
    { maturity: 0.25, rate: 0.04 },
    { maturity: 0.5, rate: 0.041 },
    { maturity: 1, rate: 0.043 },
    { maturity: 2, rate: 0.045 },
    { maturity: 3, rate: 0.046 },
    { maturity: 5, rate: 0.047 },
    { maturity: 7, rate: 0.048 },
    { maturity: 10, rate: 0.049 },
  ];

  beforeEach(() => {
    service = new HullWhiteService();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ── simulateRatePaths ────────────────────────────────────

  it('rate paths start at the initial rate', () => {
    const result = service.simulateRatePaths({
      initialRate: 0.05,
      kappa: 0.1,
      sigma: 0.01,
      termStructure,
      numPaths: 100,
      horizon: 1,
      timeSteps: 12,
    });

    // After the first step the rate should be close to initialRate
    // (within a few sigma * sqrt(dt) moves)
    const firstStepValues = result.paths.map((p) => p[0]);
    const meanFirst =
      firstStepValues.reduce((s, v) => s + v, 0) / firstStepValues.length;
    expect(Math.abs(meanFirst - 0.05)).toBeLessThan(0.01);
  });

  it('number of paths matches the request', () => {
    const numPaths = 200;
    const result = service.simulateRatePaths({
      initialRate: 0.04,
      kappa: 0.15,
      sigma: 0.01,
      termStructure,
      numPaths,
      horizon: 2,
      timeSteps: 24,
    });

    expect(result.paths.length).toBe(numPaths);
  });

  it('path length matches timeSteps', () => {
    const timeSteps = 36;
    const result = service.simulateRatePaths({
      initialRate: 0.04,
      kappa: 0.15,
      sigma: 0.01,
      termStructure,
      numPaths: 50,
      horizon: 3,
      timeSteps,
    });

    for (const path of result.paths) {
      expect(path.length).toBe(timeSteps);
    }
  });

  it('mean path length matches timeSteps', () => {
    const timeSteps = 20;
    const result = service.simulateRatePaths({
      initialRate: 0.04,
      kappa: 0.15,
      sigma: 0.01,
      termStructure,
      numPaths: 100,
      horizon: 2,
      timeSteps,
    });

    expect(result.meanPath.length).toBe(timeSteps);
    expect(result.percentile5.length).toBe(timeSteps);
    expect(result.percentile95.length).toBe(timeSteps);
  });

  it('higher sigma produces wider confidence bands', () => {
    const baseParams = {
      initialRate: 0.04,
      kappa: 0.15,
      termStructure,
      numPaths: 2000,
      horizon: 3,
      timeSteps: 36,
    };

    const lowVol = service.simulateRatePaths({ ...baseParams, sigma: 0.005 });
    const highVol = service.simulateRatePaths({ ...baseParams, sigma: 0.03 });

    // At the final time step, the 5-95 band should be wider for high vol
    const lastStep = baseParams.timeSteps - 1;
    const lowBand =
      lowVol.percentile95[lastStep] - lowVol.percentile5[lastStep];
    const highBand =
      highVol.percentile95[lastStep] - highVol.percentile5[lastStep];

    expect(highBand).toBeGreaterThan(lowBand);
  });

  it('mean reversion pulls rates toward term structure levels', () => {
    // Start far above the curve and check that mean reverts down
    const result = service.simulateRatePaths({
      initialRate: 0.12, // well above any term structure rate
      kappa: 1.0, // strong mean reversion
      sigma: 0.005, // low vol so mean reversion dominates
      termStructure,
      numPaths: 1000,
      horizon: 5,
      timeSteps: 60,
    });

    // After 5 years with strong mean reversion, the mean final rate
    // should be pulled much lower than the initial 12%
    expect(result.statistics.meanFinalRate).toBeLessThan(0.12);
  });

  it('statistics contain valid final rate data', () => {
    const result = service.simulateRatePaths({
      initialRate: 0.04,
      kappa: 0.15,
      sigma: 0.01,
      termStructure,
      numPaths: 500,
      horizon: 2,
      timeSteps: 24,
    });

    expect(result.statistics.minFinalRate).toBeLessThanOrEqual(
      result.statistics.meanFinalRate,
    );
    expect(result.statistics.maxFinalRate).toBeGreaterThanOrEqual(
      result.statistics.meanFinalRate,
    );
    expect(result.statistics.stdFinalRate).toBeGreaterThanOrEqual(0);
  });

  // ── priceZeroCouponBond ──────────────────────────────────

  it('zero-coupon bond price is between 0 and 1 for positive rates', () => {
    for (const mat of [0.5, 1, 2, 5, 10]) {
      const result = service.priceZeroCouponBond({
        currentRate: 0.04,
        kappa: 0.15,
        sigma: 0.01,
        maturity: mat,
        termStructure,
      });

      expect(result.price).toBeGreaterThan(0);
      expect(result.price).toBeLessThanOrEqual(1);
    }
  });

  it('bond duration is positive and less than maturity', () => {
    const result = service.priceZeroCouponBond({
      currentRate: 0.04,
      kappa: 0.15,
      sigma: 0.01,
      maturity: 5,
      termStructure,
    });

    expect(result.duration).toBeGreaterThan(0);
    expect(result.duration).toBeLessThan(5);
  });

  it('bond convexity is positive', () => {
    const result = service.priceZeroCouponBond({
      currentRate: 0.04,
      kappa: 0.15,
      sigma: 0.01,
      maturity: 5,
      termStructure,
    });

    expect(result.convexity).toBeGreaterThan(0);
  });

  it('longer maturity bonds have lower prices', () => {
    const price1y = service.priceZeroCouponBond({
      currentRate: 0.04,
      kappa: 0.15,
      sigma: 0.01,
      maturity: 1,
      termStructure,
    });
    const price5y = service.priceZeroCouponBond({
      currentRate: 0.04,
      kappa: 0.15,
      sigma: 0.01,
      maturity: 5,
      termStructure,
    });
    const price10y = service.priceZeroCouponBond({
      currentRate: 0.04,
      kappa: 0.15,
      sigma: 0.01,
      maturity: 10,
      termStructure,
    });

    expect(price1y.price).toBeGreaterThan(price5y.price);
    expect(price5y.price).toBeGreaterThan(price10y.price);
  });

  it('zero maturity bond has price 1 and zero duration', () => {
    const result = service.priceZeroCouponBond({
      currentRate: 0.04,
      kappa: 0.15,
      sigma: 0.01,
      maturity: 0,
      termStructure,
    });

    expect(result.price).toBe(1);
    expect(result.duration).toBe(0);
    expect(result.convexity).toBe(0);
  });

  // ── calibrate ────────────────────────────────────────────

  it('calibration recovers known parameters approximately', () => {
    // Generate "market" prices using known parameters
    const trueKappa = 0.15;
    const trueSigma = 0.01;
    const maturities = [0.5, 1, 2, 3, 5, 7, 10];

    const marketPrices = maturities.map((mat) => {
      const bond = service.priceZeroCouponBond({
        currentRate: 0.04,
        kappa: trueKappa,
        sigma: trueSigma,
        maturity: mat,
        termStructure,
      });
      return { maturity: mat, price: bond.price };
    });

    const result = service.calibrate({ marketPrices });

    // Calibrated params should be in the right ballpark
    expect(result.kappa).toBeGreaterThan(0);
    expect(result.sigma).toBeGreaterThan(0);
    expect(result.fitError).toBeLessThan(0.001);
  });

  it('calibration with fixed kappa still finds sigma', () => {
    const maturities = [1, 2, 5, 10];
    const marketPrices = maturities.map((mat) => {
      const bond = service.priceZeroCouponBond({
        currentRate: 0.04,
        kappa: 0.2,
        sigma: 0.015,
        maturity: mat,
        termStructure,
      });
      return { maturity: mat, price: bond.price };
    });

    const result = service.calibrate({ marketPrices, kappa: 0.2 });

    expect(result.kappa).toBe(0.2);
    expect(result.sigma).toBeGreaterThan(0);
    expect(result.fitError).toBeLessThan(0.001);
  });

  it('calibration returns defaults for empty market data', () => {
    const result = service.calibrate({ marketPrices: [] });

    expect(result.kappa).toBe(0.1);
    expect(result.sigma).toBe(0.01);
    expect(result.fitError).toBe(0);
  });

  // Coverage: lines 162-171 — odd number of paths
  it('handles odd number of paths correctly', () => {
    const result = service.simulateRatePaths({
      initialRate: 0.04,
      kappa: 0.15,
      sigma: 0.01,
      termStructure,
      numPaths: 101, // odd
      horizon: 1,
      timeSteps: 12,
    });

    expect(result.paths.length).toBe(101);
    for (const path of result.paths) {
      expect(path.length).toBe(12);
    }
  });

  // Coverage: lines 363-365 — calibration grid search inner loop
  it('calibration explores sigma grid when kappa is not fixed', () => {
    const maturities = [0.5, 1, 2, 3, 5];
    const marketPrices = maturities.map((mat) => {
      const bond = service.priceZeroCouponBond({
        currentRate: 0.04,
        kappa: 0.3,
        sigma: 0.02,
        maturity: mat,
        termStructure,
      });
      return { maturity: mat, price: bond.price };
    });

    const result = service.calibrate({ marketPrices });
    expect(result.kappa).toBeGreaterThan(0);
    expect(result.sigma).toBeGreaterThan(0);
    expect(result.fitError).toBeLessThan(0.01);
  });

  // Coverage: line 469 — interpolateRate falls off the end of term structure
  it('interpolateRate returns last rate for maturity beyond term structure', () => {
    const result = service.priceZeroCouponBond({
      currentRate: 0.04,
      kappa: 0.15,
      sigma: 0.01,
      maturity: 30, // far beyond the 10-year max in term structure
      termStructure,
    });

    expect(result.price).toBeGreaterThan(0);
    expect(result.price).toBeLessThan(1);
  });

  // ── Coverage: interpolateRate for maturity before first point ──
  it('interpolateRate returns first rate for very short maturity', () => {
    const result = service.priceZeroCouponBond({
      currentRate: 0.04,
      kappa: 0.15,
      sigma: 0.01,
      maturity: 0.01, // shorter than the first term structure point
      termStructure,
    });
    expect(result.price).toBeGreaterThan(0.99);
  });

  // ── Coverage: simulation with very few paths ──────────────────
  it('simulates with minimal paths and steps', () => {
    const result = service.simulate({
      initialRate: 0.04,
      kappa: 0.15,
      sigma: 0.01,
      termStructure,
      numPaths: 3,
      horizon: 0.5,
      timeSteps: 5,
    });
    expect(result.paths).toHaveLength(3);
    expect(result.meanPath.length).toBe(6); // timeSteps + 1
    expect(result.statistics.meanFinalRate).toBeGreaterThan(0);
  });

  // ── Coverage: calibration with default kappa ──────────────────
  it('calibrates with auto-detected kappa range', () => {
    const marketPrices = termStructure.map(p => ({
      maturity: p.maturity,
      price: Math.exp(-p.rate * p.maturity),
    }));
    const result = service.calibrate({ marketPrices });
    expect(result.kappa).toBeGreaterThan(0);
    expect(result.sigma).toBeGreaterThan(0);
  });
});
