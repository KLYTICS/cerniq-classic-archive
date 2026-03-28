import { Injectable, Logger } from '@nestjs/common';

/**
 * Incremental Value-at-Risk (Incremental VaR) — Quant Model
 *
 * Measures each position's contribution to total portfolio VaR by computing
 * the difference between portfolio VaR with and without each position.
 *
 * IVAR_i = VaR(full portfolio) - VaR(portfolio excluding position i)
 *
 * Portfolio VaR (parametric, normal):
 *   VaR_p = Z_α × σ_p
 *   σ_p = √(w' × Σ × w)
 *
 * Where:
 *   w  = vector of position weights × volatilities
 *   Σ  = correlation matrix
 *   Z_α = normal quantile at confidence α
 */

export interface IncrementalVaRPosition {
  name: string;
  weight: number;
  volatility: number;
}

export interface IncrementalVaRResult {
  portfolioVaR: number;
  positions: Array<{
    name: string;
    incrementalVaR: number;
    pctContribution: number;
  }>;
}

@Injectable()
export class IncrementalVarService {
  private readonly logger = new Logger(IncrementalVarService.name);

  /**
   * Calculate Incremental VaR for each position in the portfolio.
   *
   * @param params.positions - Array of positions with name, weight, and volatility
   * @param params.correlationMatrix - NxN correlation matrix between positions
   * @param params.confidence - Confidence level (default 0.95)
   * @returns Portfolio VaR and incremental VaR per position
   */
  calculateIncrementalVaR(params: {
    positions: IncrementalVaRPosition[];
    correlationMatrix: number[][];
    confidence?: number;
  }): IncrementalVaRResult {
    const { positions, correlationMatrix, confidence = 0.95 } = params;
    const n = positions.length;

    this.logger.log(`Computing Incremental VaR for ${n} positions at ${(confidence * 100).toFixed(1)}% confidence`);

    const zAlpha = this.normInv(confidence);

    // Full portfolio VaR
    const fullVaR = this.computePortfolioVaR(positions, correlationMatrix, zAlpha);

    // Compute VaR without each position
    const results = positions.map((pos, i) => {
      const subPositions = positions.filter((_, idx) => idx !== i);
      const subCorrelation = this.removeIndex(correlationMatrix, i);
      const subVaR = subPositions.length > 0
        ? this.computePortfolioVaR(subPositions, subCorrelation, zAlpha)
        : 0;

      const incrementalVaR = fullVaR - subVaR;

      return {
        name: pos.name,
        incrementalVaR: +incrementalVaR.toFixed(6),
        pctContribution: fullVaR > 0 ? +((incrementalVaR / fullVaR) * 100).toFixed(2) : 0,
      };
    });

    return {
      portfolioVaR: +fullVaR.toFixed(6),
      positions: results,
    };
  }

  /**
   * Compute marginal VaR (sensitivity of portfolio VaR to a small increase in weight).
   *
   * MVaR_i = Z_α × (Σ × w)_i / σ_p
   */
  calculateMarginalVaR(params: {
    positions: IncrementalVaRPosition[];
    correlationMatrix: number[][];
    confidence?: number;
  }): Array<{ name: string; marginalVaR: number }> {
    const { positions, correlationMatrix, confidence = 0.95 } = params;
    const n = positions.length;
    const zAlpha = this.normInv(confidence);

    // Build weighted volatility vector: w_i * vol_i
    const wVol = positions.map((p) => p.weight * p.volatility);

    // Portfolio variance = wVol' * corr * wVol
    let portfolioVariance = 0;
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        portfolioVariance += wVol[i] * wVol[j] * correlationMatrix[i][j];
      }
    }
    const portfolioSigma = Math.sqrt(Math.max(0, portfolioVariance));

    if (portfolioSigma === 0) {
      return positions.map((p) => ({ name: p.name, marginalVaR: 0 }));
    }

    // (Σ_cov × w)_i  where Σ_cov[i][j] = corr[i][j] * vol_i * vol_j
    return positions.map((pos, i) => {
      let covContrib = 0;
      for (let j = 0; j < n; j++) {
        covContrib += correlationMatrix[i][j] * pos.volatility * positions[j].volatility * positions[j].weight;
      }
      const marginalVaR = zAlpha * covContrib / portfolioSigma;
      return {
        name: pos.name,
        marginalVaR: +marginalVaR.toFixed(6),
      };
    });
  }

  // ─── Private Helpers ──────────────────────────────────────

  private computePortfolioVaR(
    positions: IncrementalVaRPosition[],
    correlationMatrix: number[][],
    zAlpha: number,
  ): number {
    const n = positions.length;
    const wVol = positions.map((p) => p.weight * p.volatility);

    let variance = 0;
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        variance += wVol[i] * wVol[j] * correlationMatrix[i][j];
      }
    }

    return zAlpha * Math.sqrt(Math.max(0, variance));
  }

  /** Remove row i and column i from an NxN matrix */
  private removeIndex(matrix: number[][], idx: number): number[][] {
    return matrix
      .filter((_, i) => i !== idx)
      .map((row) => row.filter((_, j) => j !== idx));
  }

  /** Inverse standard normal CDF (Beasley-Springer-Moro) */
  private normInv(p: number): number {
    if (p <= 0) return -Infinity;
    if (p >= 1) return Infinity;
    if (p === 0.5) return 0;

    const a = [
      -3.969683028665376e1, 2.209460984245205e2,
      -2.759285104469687e2, 1.383577518672690e2,
      -3.066479806614716e1, 2.506628277459239e0,
    ];
    const b = [
      -5.447609879822406e1, 1.615858368580409e2,
      -1.556989798598866e2, 6.680131188771972e1,
      -1.328068155288572e1,
    ];
    const c = [
      -7.784894002430293e-3, -3.223964580411365e-1,
      -2.400758277161838e0, -2.549732539343734e0,
      4.374664141464968e0, 2.938163982698783e0,
    ];
    const d = [
      7.784695709041462e-3, 3.224671290700398e-1,
      2.445134137142996e0, 3.754408661907416e0,
    ];

    const pLow = 0.02425;
    const pHigh = 1 - pLow;
    let q: number, r: number;

    if (p < pLow) {
      q = Math.sqrt(-2 * Math.log(p));
      return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
        ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
    } else if (p <= pHigh) {
      q = p - 0.5;
      r = q * q;
      return (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q /
        (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
    } else {
      q = Math.sqrt(-2 * Math.log(1 - p));
      return -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
        ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1));
    }
  }
}
