import { Injectable, Logger } from '@nestjs/common';

/**
 * Nelson-Siegel / Svensson Yield Curve Fitting Service
 *
 * Parametric models for yield curve construction widely used by
 * central banks (ECB, Bundesbank, BIS) and fixed-income desks.
 *
 * Nelson-Siegel (1987):
 *   y(t) = b0 + b1*[(1-exp(-lt))/(lt)]
 *             + b2*[(1-exp(-lt))/(lt) - exp(-lt)]
 *
 * Svensson (1994) extension adds a second hump:
 *   y(t) = NS(t) + b3*[(1-exp(-l2*t))/(l2*t) - exp(-l2*t)]
 */

// ─── Types ─────────────────────────────────────────────────────

export interface NelsonSiegelParams {
  beta0: number;
  beta1: number;
  beta2: number;
  lambda: number;
}

export interface SvenssonParams {
  beta0: number;
  beta1: number;
  beta2: number;
  beta3: number;
  lambda1: number;
  lambda2: number;
}

export interface FitResult {
  beta0: number;
  beta1: number;
  beta2: number;
  lambda: number;
  rmse: number;
  r2: number;
  fitted: Array<{ maturity: number; actual: number; fitted: number; residual: number }>;
}

export interface SvenssonFitResult {
  beta0: number;
  beta1: number;
  beta2: number;
  beta3: number;
  lambda1: number;
  lambda2: number;
  rmse: number;
  r2: number;
  fitted: Array<{ maturity: number; actual: number; fitted: number; residual: number }>;
}

export interface InterpolationResult {
  curve: Array<{ maturity: number; yield: number }>;
}

export interface DecompositionResult {
  maturities: number[];
  level: number[];
  slope: number[];
  curvature: number[];
  total: number[];
}

// ─── Standard maturities for decomposition ─────────────────────

const STANDARD_MATURITIES = [0.25, 0.5, 1, 2, 3, 5, 7, 10, 20, 30];

@Injectable()
export class NelsonSiegelService {
  private readonly logger = new Logger(NelsonSiegelService.name);

  // ─── Nelson-Siegel Factor Functions ──────────────────────────

  /**
   * Compute the three NS basis functions at maturity t for decay lambda.
   * f0(t) = 1                               (level)
   * f1(t) = (1 - exp(-lt)) / (lt)           (slope)
   * f2(t) = (1 - exp(-lt)) / (lt) - exp(-lt) (curvature)
   */
  private nsBasis(t: number, lambda: number): [number, number, number] {
    const lt = lambda * t;
    if (lt < 1e-10) {
      // Taylor expansion: f1 -> 1 - lt/2 + ..., f2 -> lt/2 - ...
      return [1, 1, 0];
    }
    const expNeg = Math.exp(-lt);
    const f1 = (1 - expNeg) / lt;
    const f2 = f1 - expNeg;
    return [1, f1, f2];
  }

  /**
   * Evaluate the NS model at maturity t.
   */
  private nsYield(params: NelsonSiegelParams, t: number): number {
    const [f0, f1, f2] = this.nsBasis(t, params.lambda);
    return params.beta0 * f0 + params.beta1 * f1 + params.beta2 * f2;
  }

  /**
   * Svensson basis: NS basis plus a fourth factor.
   * f3(t) = (1 - exp(-l2*t)) / (l2*t) - exp(-l2*t)
   */
  private svBasis(t: number, lambda1: number, lambda2: number): [number, number, number, number] {
    const [f0, f1, f2] = this.nsBasis(t, lambda1);
    const l2t = lambda2 * t;
    let f3: number;
    if (l2t < 1e-10) {
      f3 = 0;
    } else {
      const expNeg2 = Math.exp(-l2t);
      f3 = (1 - expNeg2) / l2t - expNeg2;
    }
    return [f0, f1, f2, f3];
  }

  /**
   * Evaluate the Svensson model at maturity t.
   */
  private svYield(params: SvenssonParams, t: number): number {
    const [f0, f1, f2, f3] = this.svBasis(t, params.lambda1, params.lambda2);
    return params.beta0 * f0 + params.beta1 * f1 + params.beta2 * f2 + params.beta3 * f3;
  }

  // ─── Linear Algebra (Normal Equations) ───────────────────────

  /**
   * Solve 3x3 linear system Ax = b using Cramer's rule.
   */
  private solve3x3(A: number[][], b: number[]): number[] {
    const det3 = (m: number[][]) =>
      m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1]) -
      m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0]) +
      m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0]);

    const D = det3(A);
    if (Math.abs(D) < 1e-15) return [0, 0, 0];

    const D0 = det3([
      [b[0], A[0][1], A[0][2]],
      [b[1], A[1][1], A[1][2]],
      [b[2], A[2][1], A[2][2]],
    ]);
    const D1 = det3([
      [A[0][0], b[0], A[0][2]],
      [A[1][0], b[1], A[1][2]],
      [A[2][0], b[2], A[2][2]],
    ]);
    const D2 = det3([
      [A[0][0], A[0][1], b[0]],
      [A[1][0], A[1][1], b[1]],
      [A[2][0], A[2][1], b[2]],
    ]);

    return [D0 / D, D1 / D, D2 / D];
  }

  /**
   * Solve 4x4 linear system Ax = b via Gaussian elimination with partial pivoting.
   */
  private solve4x4(A: number[][], b: number[]): number[] {
    const n = 4;
    // Augmented matrix
    const aug = A.map((row, i) => [...row, b[i]]);

    for (let col = 0; col < n; col++) {
      // Partial pivot
      let maxRow = col;
      let maxVal = Math.abs(aug[col][col]);
      for (let row = col + 1; row < n; row++) {
        if (Math.abs(aug[row][col]) > maxVal) {
          maxVal = Math.abs(aug[row][col]);
          maxRow = row;
        }
      }
      if (maxVal < 1e-15) return [0, 0, 0, 0];
      if (maxRow !== col) {
        [aug[col], aug[maxRow]] = [aug[maxRow], aug[col]];
      }

      // Eliminate below
      for (let row = col + 1; row < n; row++) {
        const factor = aug[row][col] / aug[col][col];
        for (let j = col; j <= n; j++) {
          aug[row][j] -= factor * aug[col][j];
        }
      }
    }

    // Back-substitute
    const x = new Array(n).fill(0);
    for (let i = n - 1; i >= 0; i--) {
      let sum = aug[i][n];
      for (let j = i + 1; j < n; j++) {
        sum -= aug[i][j] * x[j];
      }
      x[i] = sum / aug[i][i];
    }
    return x;
  }

  // ─── Fitting Helpers ─────────────────────────────────────────

  /**
   * Given lambda, solve for beta0, beta1, beta2 via OLS normal equations.
   * Returns betas and sum of squared residuals.
   */
  private solveNSForLambda(
    maturities: number[],
    yields: number[],
    lambda: number,
  ): { beta0: number; beta1: number; beta2: number; sse: number } {
    const n = maturities.length;

    // Build X'X and X'y for the normal equation: beta = (X'X)^-1 X'y
    const XtX = [
      [0, 0, 0],
      [0, 0, 0],
      [0, 0, 0],
    ];
    const Xty = [0, 0, 0];

    for (let i = 0; i < n; i++) {
      const [f0, f1, f2] = this.nsBasis(maturities[i], lambda);
      const y = yields[i];
      const row = [f0, f1, f2];
      for (let r = 0; r < 3; r++) {
        Xty[r] += row[r] * y;
        for (let c = 0; c < 3; c++) {
          XtX[r][c] += row[r] * row[c];
        }
      }
    }

    const betas = this.solve3x3(XtX, Xty);
    const beta0 = betas[0];
    const beta1 = betas[1];
    const beta2 = betas[2];

    // Compute SSE
    let sse = 0;
    for (let i = 0; i < n; i++) {
      const fitted = this.nsYield({ beta0, beta1, beta2, lambda }, maturities[i]);
      sse += (yields[i] - fitted) ** 2;
    }

    return { beta0, beta1, beta2, sse };
  }

  /**
   * Given lambda1 and lambda2, solve for beta0-beta3 via OLS.
   */
  private solveSVForLambdas(
    maturities: number[],
    yields: number[],
    lambda1: number,
    lambda2: number,
  ): { beta0: number; beta1: number; beta2: number; beta3: number; sse: number } {
    const n = maturities.length;

    const XtX = Array.from({ length: 4 }, () => new Array(4).fill(0));
    const Xty = [0, 0, 0, 0];

    for (let i = 0; i < n; i++) {
      const [f0, f1, f2, f3] = this.svBasis(maturities[i], lambda1, lambda2);
      const y = yields[i];
      const row = [f0, f1, f2, f3];
      for (let r = 0; r < 4; r++) {
        Xty[r] += row[r] * y;
        for (let c = 0; c < 4; c++) {
          XtX[r][c] += row[r] * row[c];
        }
      }
    }

    const betas = this.solve4x4(XtX, Xty);

    let sse = 0;
    const params: SvenssonParams = {
      beta0: betas[0],
      beta1: betas[1],
      beta2: betas[2],
      beta3: betas[3],
      lambda1,
      lambda2,
    };
    for (let i = 0; i < n; i++) {
      const fitted = this.svYield(params, maturities[i]);
      sse += (yields[i] - fitted) ** 2;
    }

    return { beta0: betas[0], beta1: betas[1], beta2: betas[2], beta3: betas[3], sse };
  }

  /**
   * Compute RMSE and R-squared from SSE.
   */
  private computeStats(
    yields: number[],
    sse: number,
  ): { rmse: number; r2: number } {
    const n = yields.length;
    const rmse = Math.sqrt(sse / n);

    const mean = yields.reduce((s, y) => s + y, 0) / n;
    const sst = yields.reduce((s, y) => s + (y - mean) ** 2, 0);
    const r2 = sst > 0 ? 1 - sse / sst : 1;

    return { rmse, r2 };
  }

  // ─── Public API ──────────────────────────────────────────────

  /**
   * Fit a Nelson-Siegel model to observed yield curve data.
   *
   * If lambda is not provided, performs a grid search over [0.01, 5.0]
   * to minimize SSE, then solves for betas via OLS.
   */
  fitNelsonSiegel(params: {
    maturities: number[];
    yields: number[];
    lambda?: number;
  }): FitResult {
    const { maturities, yields } = params;

    if (maturities.length === 0 || yields.length === 0) {
      this.logger.warn('Empty input to fitNelsonSiegel');
      return { beta0: 0, beta1: 0, beta2: 0, lambda: 1, rmse: 0, r2: 1, fitted: [] };
    }

    const n = Math.min(maturities.length, yields.length);
    const mats = maturities.slice(0, n);
    const ylds = yields.slice(0, n);

    // Single data point: fit passes through it exactly
    if (n === 1) {
      return {
        beta0: ylds[0],
        beta1: 0,
        beta2: 0,
        lambda: 1,
        rmse: 0,
        r2: 1,
        fitted: [{ maturity: mats[0], actual: ylds[0], fitted: ylds[0], residual: 0 }],
      };
    }

    let bestLambda: number;
    let bestSSE = Infinity;

    if (params.lambda !== undefined) {
      bestLambda = params.lambda;
      const result = this.solveNSForLambda(mats, ylds, bestLambda);
      bestSSE = result.sse;
    } else {
      // Coarse grid search
      bestLambda = 1.0;
      for (let lambda = 0.01; lambda <= 5.0; lambda += 0.05) {
        const { sse } = this.solveNSForLambda(mats, ylds, lambda);
        if (sse < bestSSE) {
          bestSSE = sse;
          bestLambda = lambda;
        }
      }

      // Fine grid search around best
      const lo = Math.max(0.01, bestLambda - 0.1);
      const hi = bestLambda + 0.1;
      for (let lambda = lo; lambda <= hi; lambda += 0.005) {
        const { sse } = this.solveNSForLambda(mats, ylds, lambda);
        if (sse < bestSSE) {
          bestSSE = sse;
          bestLambda = lambda;
        }
      }
    }

    const { beta0, beta1, beta2 } = this.solveNSForLambda(mats, ylds, bestLambda);
    const nsParams: NelsonSiegelParams = { beta0, beta1, beta2, lambda: bestLambda };

    // Build fitted array
    const fitted = mats.map((m, i) => {
      const f = this.nsYield(nsParams, m);
      return { maturity: m, actual: ylds[i], fitted: f, residual: ylds[i] - f };
    });

    const { rmse, r2 } = this.computeStats(ylds, bestSSE);

    this.logger.log(
      `NS fit: b0=${beta0.toFixed(5)}, b1=${beta1.toFixed(5)}, b2=${beta2.toFixed(5)}, ` +
        `lam=${bestLambda.toFixed(4)}, RMSE=${(rmse * 10000).toFixed(2)}bps, R2=${r2.toFixed(6)}`,
    );

    return { beta0, beta1, beta2, lambda: bestLambda, rmse, r2, fitted };
  }

  /**
   * Fit a Svensson (extended Nelson-Siegel) model.
   *
   * Grid search over lambda1 x lambda2 then OLS for betas.
   */
  fitSvensson(params: {
    maturities: number[];
    yields: number[];
  }): SvenssonFitResult {
    const { maturities, yields } = params;

    if (maturities.length === 0 || yields.length === 0) {
      this.logger.warn('Empty input to fitSvensson');
      return {
        beta0: 0, beta1: 0, beta2: 0, beta3: 0,
        lambda1: 1, lambda2: 1, rmse: 0, r2: 1, fitted: [],
      };
    }

    const n = Math.min(maturities.length, yields.length);
    const mats = maturities.slice(0, n);
    const ylds = yields.slice(0, n);

    if (n <= 2) {
      // Degenerate: fall back to NS
      const ns = this.fitNelsonSiegel({ maturities: mats, yields: ylds });
      return {
        beta0: ns.beta0, beta1: ns.beta1, beta2: ns.beta2, beta3: 0,
        lambda1: ns.lambda, lambda2: 1, rmse: ns.rmse, r2: ns.r2, fitted: ns.fitted,
      };
    }

    let bestLambda1 = 1.0;
    let bestLambda2 = 1.0;
    let bestSSE = Infinity;

    // Coarse 2D grid search
    for (let l1 = 0.1; l1 <= 5.0; l1 += 0.3) {
      for (let l2 = 0.1; l2 <= 5.0; l2 += 0.3) {
        // Skip when lambdas are too close (collinear basis)
        if (Math.abs(l1 - l2) < 0.15) continue;
        const { sse } = this.solveSVForLambdas(mats, ylds, l1, l2);
        if (sse < bestSSE) {
          bestSSE = sse;
          bestLambda1 = l1;
          bestLambda2 = l2;
        }
      }
    }

    // Fine grid around best
    const l1Lo = Math.max(0.05, bestLambda1 - 0.3);
    const l1Hi = bestLambda1 + 0.3;
    const l2Lo = Math.max(0.05, bestLambda2 - 0.3);
    const l2Hi = bestLambda2 + 0.3;

    for (let l1 = l1Lo; l1 <= l1Hi; l1 += 0.05) {
      for (let l2 = l2Lo; l2 <= l2Hi; l2 += 0.05) {
        if (Math.abs(l1 - l2) < 0.1) continue;
        const { sse } = this.solveSVForLambdas(mats, ylds, l1, l2);
        if (sse < bestSSE) {
          bestSSE = sse;
          bestLambda1 = l1;
          bestLambda2 = l2;
        }
      }
    }

    const { beta0, beta1, beta2, beta3 } = this.solveSVForLambdas(
      mats, ylds, bestLambda1, bestLambda2,
    );

    const svParams: SvenssonParams = {
      beta0, beta1, beta2, beta3,
      lambda1: bestLambda1, lambda2: bestLambda2,
    };

    const fitted = mats.map((m, i) => {
      const f = this.svYield(svParams, m);
      return { maturity: m, actual: ylds[i], fitted: f, residual: ylds[i] - f };
    });

    const { rmse, r2 } = this.computeStats(ylds, bestSSE);

    this.logger.log(
      `Svensson fit: b0=${beta0.toFixed(5)}, b1=${beta1.toFixed(5)}, b2=${beta2.toFixed(5)}, ` +
        `b3=${beta3.toFixed(5)}, l1=${bestLambda1.toFixed(3)}, l2=${bestLambda2.toFixed(3)}, ` +
        `RMSE=${(rmse * 10000).toFixed(2)}bps, R2=${r2.toFixed(6)}`,
    );

    return {
      beta0, beta1, beta2, beta3,
      lambda1: bestLambda1, lambda2: bestLambda2,
      rmse, r2, fitted,
    };
  }

  /**
   * Interpolate yields at arbitrary maturities using a fitted model.
   * Accepts either Nelson-Siegel or Svensson parameters.
   */
  interpolate(params: {
    model: NelsonSiegelParams | SvenssonParams;
    maturities: number[];
  }): InterpolationResult {
    const { model, maturities } = params;

    const isSvensson = 'lambda1' in model;

    const curve = maturities.map((m) => {
      const t = Math.max(m, 1e-6); // avoid division by zero
      let y: number;
      if (isSvensson) {
        y = this.svYield(model as SvenssonParams, t);
      } else {
        y = this.nsYield(model as NelsonSiegelParams, t);
      }
      return { maturity: m, yield: y };
    });

    return { curve };
  }

  /**
   * Decompose a Nelson-Siegel curve into level, slope, and curvature
   * components at standard maturities.
   */
  decompose(params: {
    model: NelsonSiegelParams;
  }): DecompositionResult {
    const { model } = params;

    const maturities = STANDARD_MATURITIES;
    const level: number[] = [];
    const slope: number[] = [];
    const curvature: number[] = [];
    const total: number[] = [];

    for (const t of maturities) {
      const [f0, f1, f2] = this.nsBasis(t, model.lambda);
      const lev = model.beta0 * f0;
      const slo = model.beta1 * f1;
      const cur = model.beta2 * f2;

      level.push(lev);
      slope.push(slo);
      curvature.push(cur);
      total.push(lev + slo + cur);
    }

    return { maturities, level, slope, curvature, total };
  }
}
