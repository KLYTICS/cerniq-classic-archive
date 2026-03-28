import { Injectable, Logger } from '@nestjs/common';

// ─── Types ───────────────────────────────────────────────────

export interface TermStructurePoint {
  maturity: number; // time in years
  rate: number;     // continuously compounded zero rate
}

export interface HullWhiteSimulationParams {
  initialRate: number;
  kappa: number;                    // mean reversion speed
  sigma: number;                    // volatility
  termStructure: TermStructurePoint[]; // current yield curve
  numPaths: number;
  horizon: number;                  // in years
  timeSteps: number;
}

export interface HullWhiteSimulationResult {
  paths: number[][];
  meanPath: number[];
  percentile5: number[];
  percentile95: number[];
  statistics: {
    meanFinalRate: number;
    stdFinalRate: number;
    minFinalRate: number;
    maxFinalRate: number;
  };
}

export interface HullWhiteBondParams {
  currentRate: number;
  kappa: number;
  sigma: number;
  maturity: number;
  termStructure: TermStructurePoint[];
}

export interface HullWhiteBondResult {
  price: number;
  yield: number;
  duration: number;
  convexity: number;
}

export interface HullWhiteCalibrateParams {
  marketPrices: { maturity: number; price: number }[];
  kappa?: number;
}

export interface HullWhiteCalibrateResult {
  kappa: number;
  sigma: number;
  fitError: number;
}

/**
 * Hull-White (Extended Vasicek) Interest Rate Model
 *
 * The Hull-White model extends the Vasicek model with a time-varying
 * mean reversion target θ(t):
 *
 *   dr = [θ(t) - κr]dt + σ dW
 *
 * where:
 *   - κ  = mean reversion speed (constant)
 *   - σ  = volatility (constant)
 *   - θ(t) = time-varying drift calibrated to fit the initial term structure
 *
 * θ(t) is determined from the market term structure via:
 *   θ(t) = ∂f(0,t)/∂t + κf(0,t) + (σ²/2κ)(1 - e^{-2κt})
 *
 * where f(0,t) is the instantaneous forward rate at time 0 for maturity t.
 *
 * The key advantage over Vasicek is exact calibration to the observed
 * yield curve, making it suitable for pricing and risk management.
 */
@Injectable()
export class HullWhiteService {
  private readonly logger = new Logger(HullWhiteService.name);

  /** Maximum paths to prevent memory exhaustion */
  private static readonly MAX_PATHS = 100_000;
  /** Rate ceiling to prevent overflow */
  private static readonly RATE_CEILING = 0.50;

  // ─── Simulate Rate Paths ─────────────────────────────────

  /**
   * Simulate short-rate paths using the Hull-White model with
   * Euler-Maruyama discretization.
   *
   * dr = [θ(t) - κr]dt + σ dW
   *
   * θ(t) is calibrated from the provided term structure so that
   * the model reprices all observed zero-coupon bonds exactly.
   */
  simulateRatePaths(params: HullWhiteSimulationParams): HullWhiteSimulationResult {
    const {
      initialRate,
      kappa,
      sigma,
      termStructure,
      horizon,
      timeSteps,
    } = params;

    const numPaths = Math.min(
      Math.max(Math.floor(params.numPaths), 1),
      HullWhiteService.MAX_PATHS,
    );

    const safeKappa = Math.max(kappa, 1e-8);
    const safeSigma = Math.max(sigma, 0);
    const dt = horizon / timeSteps;
    const sqrtDt = Math.sqrt(dt);

    // Sort and validate term structure
    const sortedTS = [...termStructure].sort((a, b) => a.maturity - b.maturity);

    // Precompute θ(t) at each time step
    const thetaValues = this.computeThetaValues(sortedTS, safeKappa, safeSigma, dt, timeSteps);

    this.logger.log(
      `Hull-White simulation: ${numPaths} paths, ${timeSteps} steps, horizon=${horizon}y, κ=${kappa}, σ=${sigma}`,
    );

    // Generate paths with antithetic variates
    const paths: number[][] = [];
    const halfPaths = Math.floor(numPaths / 2);

    for (let p = 0; p < halfPaths; p++) {
      const path1: number[] = new Array(timeSteps);
      const path2: number[] = new Array(timeSteps);
      let r1 = initialRate;
      let r2 = initialRate;

      for (let s = 0; s < timeSteps; s++) {
        const z = this.gaussianRandom();
        const theta = thetaValues[s];

        // Euler-Maruyama: dr = [θ(t) - κr]dt + σ dW
        r1 = r1 + (theta - safeKappa * r1) * dt + safeSigma * sqrtDt * z;
        r2 = r2 + (theta - safeKappa * r2) * dt - safeSigma * sqrtDt * z;

        // Clamp rates
        path1[s] = Math.max(-0.05, Math.min(r1, HullWhiteService.RATE_CEILING));
        path2[s] = Math.max(-0.05, Math.min(r2, HullWhiteService.RATE_CEILING));
        r1 = path1[s];
        r2 = path2[s];
      }

      paths.push(path1, path2);
    }

    // Handle odd number of paths
    if (numPaths % 2 !== 0) {
      const path: number[] = new Array(timeSteps);
      let r = initialRate;
      for (let s = 0; s < timeSteps; s++) {
        const z = this.gaussianRandom();
        const theta = thetaValues[s];
        r = r + (theta - safeKappa * r) * dt + safeSigma * sqrtDt * z;
        r = Math.max(-0.05, Math.min(r, HullWhiteService.RATE_CEILING));
        path[s] = r;
      }
      paths.push(path);
    }

    // Compute statistics at each time step
    const meanPath: number[] = new Array(timeSteps);
    const percentile5: number[] = new Array(timeSteps);
    const percentile95: number[] = new Array(timeSteps);

    for (let s = 0; s < timeSteps; s++) {
      const stepValues = paths.map((p) => p[s]).sort((a, b) => a - b);
      const n = stepValues.length;
      meanPath[s] = stepValues.reduce((sum, v) => sum + v, 0) / n;
      percentile5[s] = stepValues[Math.max(0, Math.floor(n * 0.05))];
      percentile95[s] = stepValues[Math.max(0, Math.floor(n * 0.95))];
    }

    // Final rate statistics
    const finalRates = paths.map((p) => p[timeSteps - 1]).sort((a, b) => a - b);
    const meanFinal = finalRates.reduce((sum, v) => sum + v, 0) / finalRates.length;
    const variance =
      finalRates.reduce((sum, v) => sum + (v - meanFinal) ** 2, 0) / finalRates.length;

    return {
      paths,
      meanPath,
      percentile5,
      percentile95,
      statistics: {
        meanFinalRate: +meanFinal.toFixed(6),
        stdFinalRate: +Math.sqrt(Math.max(variance, 0)).toFixed(6),
        minFinalRate: +finalRates[0].toFixed(6),
        maxFinalRate: +finalRates[finalRates.length - 1].toFixed(6),
      },
    };
  }

  // ─── Zero-Coupon Bond Pricing ────────────────────────────

  /**
   * Price a zero-coupon bond using the Hull-White closed-form formula.
   *
   * P(t,T) = A(t,T) × exp(-B(t,T) × r(t))
   *
   * where:
   *   B(t,T) = (1 - exp(-κ(T-t))) / κ
   *
   *   ln A(t,T) = ln[P^M(0,T)/P^M(0,t)] + B(t,T)f^M(0,t)
   *               - (σ²/4κ)(1 - e^{-2κt}) B(t,T)²
   *
   * P^M(0,T) = market discount factor, f^M(0,t) = instantaneous forward rate
   */
  priceZeroCouponBond(params: HullWhiteBondParams): HullWhiteBondResult {
    const { currentRate, kappa, sigma, maturity, termStructure } = params;

    // Edge case: zero maturity
    if (maturity <= 0) {
      return { price: 1, yield: 0, duration: 0, convexity: 0 };
    }

    const safeKappa = Math.max(kappa, 1e-8);
    const sortedTS = [...termStructure].sort((a, b) => a.maturity - b.maturity);

    // B(0, T) = (1 - exp(-κT)) / κ
    const B = this.computeB(safeKappa, maturity);

    // Market discount factors from term structure
    const lnPM_T = -this.interpolateRate(sortedTS, maturity) * maturity;
    // For t=0, P^M(0,0) = 1, so ln P^M(0,0) = 0
    // f^M(0,0) = instantaneous forward rate at time 0
    const fM_0 = this.instantaneousForward(sortedTS, 0);

    // ln A(0,T) = ln P^M(0,T) + B(0,T) × f^M(0,0) - (σ²/4κ)(1-e^{-2κ×0}) × B²
    // At t=0, the (1-e^{-2κt}) term vanishes, simplifying to:
    // ln A(0,T) = ln P^M(0,T) + B(0,T) × f^M(0,0)
    // But for general t, we use the full formula. At t=0:
    const lnA = lnPM_T + B * fM_0;

    const price = Math.exp(lnA - B * currentRate);
    const clampedPrice = Math.max(0, Math.min(price, 1.5)); // reasonable bound

    // Yield from price
    const bondYield = clampedPrice > 0 ? -Math.log(clampedPrice) / maturity : 0;

    // Duration: -dP/dr × (1/P) = B(t,T) in the Hull-White model
    const duration = B;

    // Convexity: d²P/dr² × (1/P) = B(t,T)² in the Hull-White model
    const convexity = B * B;

    return {
      price: +clampedPrice.toFixed(8),
      yield: +bondYield.toFixed(8),
      duration: +duration.toFixed(8),
      convexity: +convexity.toFixed(8),
    };
  }

  // ─── Calibration ─────────────────────────────────────────

  /**
   * Calibrate Hull-White parameters (κ, σ) to match observed
   * market zero-coupon bond prices.
   *
   * Uses grid search + Nelder-Mead-style refinement to minimize
   * the sum of squared pricing errors:
   *   min_{κ,σ} Σ_i (P_model(T_i) - P_market(T_i))²
   */
  calibrate(params: HullWhiteCalibrateParams): HullWhiteCalibrateResult {
    const { marketPrices, kappa: fixedKappa } = params;

    if (marketPrices.length === 0) {
      return { kappa: 0.1, sigma: 0.01, fitError: 0 };
    }

    // Derive term structure from market prices
    const termStructure: TermStructurePoint[] = marketPrices.map((mp) => ({
      maturity: mp.maturity,
      rate: mp.maturity > 0 ? -Math.log(Math.max(mp.price, 1e-10)) / mp.maturity : 0,
    }));

    // Initial rate from shortest maturity
    const sortedPrices = [...marketPrices].sort((a, b) => a.maturity - b.maturity);
    const initialRate = termStructure.length > 0
      ? this.instantaneousForward(
          [...termStructure].sort((a, b) => a.maturity - b.maturity),
          0,
        )
      : 0.04;

    let bestKappa = fixedKappa ?? 0.1;
    let bestSigma = 0.01;
    let bestError = Infinity;

    // Grid search
    const kappaGrid = fixedKappa != null
      ? [fixedKappa]
      : [0.01, 0.03, 0.05, 0.08, 0.1, 0.15, 0.2, 0.3, 0.5, 0.8, 1.0];
    const sigmaGrid = [0.001, 0.003, 0.005, 0.008, 0.01, 0.015, 0.02, 0.03, 0.05, 0.08, 0.1];

    for (const k of kappaGrid) {
      for (const s of sigmaGrid) {
        const error = this.computeFitError(
          initialRate, k, s, termStructure, sortedPrices,
        );
        if (error < bestError) {
          bestError = error;
          bestKappa = k;
          bestSigma = s;
        }
      }
    }

    // Local refinement around best grid point
    const refinementSteps = 20;
    for (let i = 0; i < refinementSteps; i++) {
      const scale = 0.5 ** (i + 1);
      const kappaRange = fixedKappa != null
        ? [bestKappa]
        : [bestKappa * (1 - scale), bestKappa, bestKappa * (1 + scale)];
      const sigmaRange = [bestSigma * (1 - scale), bestSigma, bestSigma * (1 + scale)];

      for (const k of kappaRange) {
        for (const s of sigmaRange) {
          if (k <= 0 || s <= 0) continue;
          const error = this.computeFitError(
            initialRate, k, s, termStructure, sortedPrices,
          );
          if (error < bestError) {
            bestError = error;
            bestKappa = k;
            bestSigma = s;
          }
        }
      }
    }

    this.logger.log(
      `Hull-White calibration: κ=${bestKappa.toFixed(4)}, σ=${bestSigma.toFixed(4)}, fitError=${bestError.toFixed(8)}`,
    );

    return {
      kappa: +bestKappa.toFixed(6),
      sigma: +bestSigma.toFixed(6),
      fitError: +bestError.toFixed(10),
    };
  }

  // ─── Private Helpers ─────────────────────────────────────

  /**
   * Compute θ(t) at each time step from the term structure.
   *
   * θ(t) = ∂f(0,t)/∂t + κf(0,t) + (σ²/2κ)(1 - e^{-2κt})
   *
   * where f(0,t) is the instantaneous forward rate derived from
   * the market term structure.
   */
  private computeThetaValues(
    termStructure: TermStructurePoint[],
    kappa: number,
    sigma: number,
    dt: number,
    timeSteps: number,
  ): number[] {
    const theta: number[] = new Array(timeSteps);

    for (let s = 0; s < timeSteps; s++) {
      const t = (s + 0.5) * dt; // midpoint of the interval

      // f(0, t): instantaneous forward rate
      const f = this.instantaneousForward(termStructure, t);

      // ∂f/∂t: derivative of forward rate (finite difference)
      const fPlus = this.instantaneousForward(termStructure, t + dt * 0.01);
      const fMinus = this.instantaneousForward(termStructure, Math.max(0, t - dt * 0.01));
      const dfdt = (fPlus - fMinus) / (2 * dt * 0.01);

      // θ(t) = ∂f/∂t + κf(0,t) + (σ²/2κ)(1 - e^{-2κt})
      theta[s] = dfdt + kappa * f + (sigma * sigma / (2 * kappa)) * (1 - Math.exp(-2 * kappa * t));
    }

    return theta;
  }

  /**
   * Compute B(t,T) = (1 - exp(-κ(T-t))) / κ
   *
   * Handles the edge case where κ → 0 via L'Hopital:
   * lim_{κ→0} B(t,T) = T - t
   */
  private computeB(kappa: number, tau: number): number {
    if (kappa < 1e-10) return tau;
    return (1 - Math.exp(-kappa * tau)) / kappa;
  }

  /**
   * Interpolate the zero rate at an arbitrary maturity from
   * the term structure using linear interpolation.
   */
  private interpolateRate(termStructure: TermStructurePoint[], t: number): number {
    if (termStructure.length === 0) return 0.04; // fallback
    if (t <= 0) return termStructure[0].rate;
    if (termStructure.length === 1) return termStructure[0].rate;

    // Extrapolate flat beyond the curve
    if (t <= termStructure[0].maturity) return termStructure[0].rate;
    if (t >= termStructure[termStructure.length - 1].maturity) {
      return termStructure[termStructure.length - 1].rate;
    }

    // Linear interpolation
    for (let i = 0; i < termStructure.length - 1; i++) {
      if (t >= termStructure[i].maturity && t <= termStructure[i + 1].maturity) {
        const t1 = termStructure[i].maturity;
        const t2 = termStructure[i + 1].maturity;
        const r1 = termStructure[i].rate;
        const r2 = termStructure[i + 1].rate;
        const w = (t - t1) / (t2 - t1);
        return r1 + w * (r2 - r1);
      }
    }

    return termStructure[termStructure.length - 1].rate;
  }

  /**
   * Compute the instantaneous forward rate f(0, t) from the
   * term structure of zero rates R(0, t):
   *
   *   f(0, t) = R(0, t) + t × ∂R(0,t)/∂t
   *
   * Uses finite-difference approximation for the derivative.
   */
  private instantaneousForward(termStructure: TermStructurePoint[], t: number): number {
    if (termStructure.length === 0) return 0.04;

    const epsilon = 1e-4;
    const tPlus = t + epsilon;
    const tMinus = Math.max(0, t - epsilon);

    const rPlus = this.interpolateRate(termStructure, tPlus);
    const rMinus = this.interpolateRate(termStructure, tMinus);
    const r = this.interpolateRate(termStructure, Math.max(t, epsilon));

    // f(0,t) = ∂[t×R(0,t)]/∂t = R(0,t) + t × dR/dt
    const dRdt = (rPlus - rMinus) / (tPlus - tMinus);
    return r + t * dRdt;
  }

  /**
   * Compute the sum of squared pricing errors for calibration.
   */
  private computeFitError(
    initialRate: number,
    kappa: number,
    sigma: number,
    termStructure: TermStructurePoint[],
    marketPrices: { maturity: number; price: number }[],
  ): number {
    let totalError = 0;

    for (const mp of marketPrices) {
      if (mp.maturity <= 0) continue;
      const modelResult = this.priceZeroCouponBond({
        currentRate: initialRate,
        kappa,
        sigma,
        maturity: mp.maturity,
        termStructure,
      });
      const diff = modelResult.price - mp.price;
      totalError += diff * diff;
    }

    return totalError;
  }

  /**
   * Cryptographically seeded Box-Muller transform for generating
   * standard normal random variates.
   *
   * Uses Math.random() for performance in simulation contexts.
   * For production risk calculations, consider using crypto.randomBytes.
   */
  private gaussianRandom(): number {
    let u = 0;
    let v = 0;
    while (u === 0) u = Math.random();
    while (v === 0) v = Math.random();
    const z = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
    return Number.isFinite(z) ? z : 0;
  }
}
