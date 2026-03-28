import { NelsonSiegelService } from './nelson-siegel.service';

// Sample US Treasury curve (approximate, March 2026)
const US_TREASURY = {
  maturities: [0.25, 0.5, 1, 2, 3, 5, 7, 10, 20, 30],
  yields: [0.0450, 0.0442, 0.0420, 0.0395, 0.0380, 0.0370, 0.0365, 0.0370, 0.0390, 0.0395],
};

describe('NelsonSiegelService', () => {
  let service: NelsonSiegelService;

  beforeEach(() => {
    service = new NelsonSiegelService();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ── 1. Flat curve: beta1 and beta2 should be near zero ────────

  it('fits a flat curve with beta1 ~ 0 and beta2 ~ 0', () => {
    const maturities = [0.5, 1, 2, 5, 10, 30];
    const yields = [0.04, 0.04, 0.04, 0.04, 0.04, 0.04];

    const result = service.fitNelsonSiegel({ maturities, yields });

    expect(result.beta0).toBeCloseTo(0.04, 3);
    expect(Math.abs(result.beta1)).toBeLessThan(0.001);
    expect(Math.abs(result.beta2)).toBeLessThan(0.001);
    expect(result.rmse).toBeLessThan(0.0001);
  });

  // ── 2. Curve with short-end inversion (typical recent Treasury) ─

  it('fits the sample Treasury curve (short end above long end)', () => {
    const result = service.fitNelsonSiegel(US_TREASURY);

    // Short rates (4.5%) > long rates (3.95%): beta1 > 0
    // because y(0) = beta0 + beta1 is the short rate
    expect(result.beta1).toBeGreaterThan(0);
    // Should produce a reasonable fit
    expect(result.rmse).toBeLessThan(0.001);
    expect(result.r2).toBeGreaterThan(0.9);
  });

  // ── 3. beta0 represents long-term level ───────────────────────

  it('beta0 approximates the long-term yield (~30Y)', () => {
    const result = service.fitNelsonSiegel(US_TREASURY);

    // beta0 is the asymptotic level; should be close to the 30Y yield
    expect(Math.abs(result.beta0 - 0.0395)).toBeLessThan(0.005);
  });

  // ── 4. beta0 + beta1 approximates the instantaneous rate ─────

  it('beta0 + beta1 approximates the short end (overnight)', () => {
    const result = service.fitNelsonSiegel(US_TREASURY);

    // As t -> 0: y(0) = beta0 + beta1
    // Should be near the short end (~4.5%)
    const instantRate = result.beta0 + result.beta1;
    expect(Math.abs(instantRate - 0.045)).toBeLessThan(0.005);
  });

  // ── 5. RMSE < 10 bps for well-behaved curves ─────────────────

  it('achieves RMSE < 10 bps for US Treasury curve', () => {
    const result = service.fitNelsonSiegel(US_TREASURY);

    // 10 bps = 0.001
    expect(result.rmse).toBeLessThan(0.001);
  });

  // ── 6. R-squared > 0.99 for standard Treasury curves ─────────

  it('achieves R-squared > 0.99 for standard Treasury curves', () => {
    const result = service.fitNelsonSiegel(US_TREASURY);

    expect(result.r2).toBeGreaterThan(0.99);
  });

  // ── 7. Svensson fits better than Nelson-Siegel ────────────────

  it('Svensson produces lower or equal RMSE vs. Nelson-Siegel', () => {
    const ns = service.fitNelsonSiegel(US_TREASURY);
    const sv = service.fitSvensson(US_TREASURY);

    expect(sv.rmse).toBeLessThanOrEqual(ns.rmse + 1e-10);
  });

  // ── 8. Svensson achieves high R-squared ───────────────────────

  it('Svensson achieves R-squared > 0.99', () => {
    const result = service.fitSvensson(US_TREASURY);

    expect(result.r2).toBeGreaterThan(0.99);
    expect(result.fitted).toHaveLength(US_TREASURY.maturities.length);
  });

  // ── 9. Interpolation matches at observed maturities (NS) ─────

  it('interpolation reproduces fitted values at observed maturities', () => {
    const fit = service.fitNelsonSiegel(US_TREASURY);
    const model = { beta0: fit.beta0, beta1: fit.beta1, beta2: fit.beta2, lambda: fit.lambda };

    const interp = service.interpolate({
      model,
      maturities: US_TREASURY.maturities,
    });

    for (let i = 0; i < fit.fitted.length; i++) {
      expect(interp.curve[i].yield).toBeCloseTo(fit.fitted[i].fitted, 10);
    }
  });

  // ── 10. Interpolation works with Svensson model ──────────────

  it('interpolation works with Svensson model', () => {
    const fit = service.fitSvensson(US_TREASURY);
    const model = {
      beta0: fit.beta0, beta1: fit.beta1, beta2: fit.beta2, beta3: fit.beta3,
      lambda1: fit.lambda1, lambda2: fit.lambda2,
    };

    const interp = service.interpolate({
      model,
      maturities: [0.1, 0.5, 1, 5, 15, 25],
    });

    expect(interp.curve).toHaveLength(6);
    // Yields should be in a reasonable range
    for (const pt of interp.curve) {
      expect(pt.yield).toBeGreaterThan(0.02);
      expect(pt.yield).toBeLessThan(0.06);
    }
  });

  // ── 11. Decomposition components sum to total ─────────────────

  it('decomposition level + slope + curvature = total', () => {
    const fit = service.fitNelsonSiegel(US_TREASURY);
    const model = { beta0: fit.beta0, beta1: fit.beta1, beta2: fit.beta2, lambda: fit.lambda };

    const decomp = service.decompose({ model });

    expect(decomp.maturities).toHaveLength(10);
    expect(decomp.level).toHaveLength(10);
    expect(decomp.slope).toHaveLength(10);
    expect(decomp.curvature).toHaveLength(10);
    expect(decomp.total).toHaveLength(10);

    for (let i = 0; i < decomp.maturities.length; i++) {
      const sum = decomp.level[i] + decomp.slope[i] + decomp.curvature[i];
      expect(sum).toBeCloseTo(decomp.total[i], 10);
    }
  });

  // ── 12. Edge case: 2 data points ──────────────────────────────

  it('handles 2 data points gracefully', () => {
    const result = service.fitNelsonSiegel({
      maturities: [1, 10],
      yields: [0.04, 0.05],
    });

    expect(result.fitted).toHaveLength(2);
    // With only 2 points the solver has 3 free betas but they are
    // constrained by the grid-searched lambda — fit is reasonable
    expect(result.rmse).toBeLessThan(0.01);
    // The interpolation/decomposition should still work
    const interp = service.interpolate({
      model: { beta0: result.beta0, beta1: result.beta1, beta2: result.beta2, lambda: result.lambda },
      maturities: [5],
    });
    expect(interp.curve).toHaveLength(1);
  });

  // ── 13. Edge case: single data point ──────────────────────────

  it('handles single data point', () => {
    const result = service.fitNelsonSiegel({
      maturities: [5],
      yields: [0.04],
    });

    expect(result.beta0).toBe(0.04);
    expect(result.rmse).toBe(0);
    expect(result.r2).toBe(1);
    expect(result.fitted).toHaveLength(1);
    expect(result.fitted[0].residual).toBe(0);
  });

  // ── 14. Edge case: inverted curve ─────────────────────────────

  it('fits an inverted curve correctly', () => {
    const maturities = [0.25, 0.5, 1, 2, 5, 10, 30];
    const yields = [0.055, 0.054, 0.052, 0.048, 0.042, 0.038, 0.035];

    const result = service.fitNelsonSiegel({ maturities, yields });

    // beta1 should be positive (short rate > long rate via contribution)
    expect(result.beta1).toBeGreaterThan(0);
    expect(result.rmse).toBeLessThan(0.002);
    expect(result.r2).toBeGreaterThan(0.95);
  });

  // ── 15. Provided lambda is used when given ────────────────────

  it('uses provided lambda when specified', () => {
    const result = service.fitNelsonSiegel({
      maturities: US_TREASURY.maturities,
      yields: US_TREASURY.yields,
      lambda: 2.0,
    });

    expect(result.lambda).toBe(2.0);
    expect(result.fitted).toHaveLength(US_TREASURY.maturities.length);
  });

  // ── 16. Empty input returns safe defaults ─────────────────────

  it('returns safe defaults for empty input', () => {
    const nsResult = service.fitNelsonSiegel({ maturities: [], yields: [] });
    expect(nsResult.fitted).toHaveLength(0);
    expect(nsResult.rmse).toBe(0);

    const svResult = service.fitSvensson({ maturities: [], yields: [] });
    expect(svResult.fitted).toHaveLength(0);
    expect(svResult.rmse).toBe(0);
  });
});
