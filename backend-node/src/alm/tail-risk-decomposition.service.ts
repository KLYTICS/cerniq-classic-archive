import { Injectable, Logger } from '@nestjs/common';

/**
 * Tail Risk Decomposition — Quant Model
 *
 * Decomposes portfolio return distribution tail risk into systematic
 * vs idiosyncratic components. Computes higher-order moments and tail
 * statistics for risk assessment.
 *
 * Key metrics:
 *   Kurtosis     = E[(X - μ)⁴] / σ⁴ - 3  (excess kurtosis, 0 = normal)
 *   Skewness     = E[(X - μ)³] / σ³
 *   Tail Index   = Hill estimator: (1/k) × Σ ln(X_(n-i+1) / X_(n-k))
 *   Fat-Tail P   = P(|X| > 3σ) vs normal expectation (0.27%)
 *
 * Systematic tail risk: proportion of tail events correlated with market.
 * Idiosyncratic tail risk: residual tail risk after removing systematic component.
 */

export interface TailRiskResult {
  kurtosis: number;
  skewness: number;
  tailIndex: number;
  fatTailProbability: number;
  systematicTailRisk: number;
  idiosyncraticTailRisk: number;
  leftTailVaR: number;
  rightTailVaR: number;
}

@Injectable()
export class TailRiskDecompositionService {
  private readonly logger = new Logger(TailRiskDecompositionService.name);

  /**
   * Decompose tail risk from a return series.
   *
   * @param params.returns - Array of periodic returns (e.g. daily log returns)
   * @param params.confidence - Confidence level for tail analysis (default 0.95)
   * @param params.marketReturns - Optional market returns for systematic/idio decomposition
   * @returns Tail risk metrics including kurtosis, skewness, tail index
   */
  decomposeTailRisk(params: {
    returns: number[];
    confidence?: number;
    marketReturns?: number[];
  }): TailRiskResult {
    const { returns, confidence = 0.95, marketReturns } = params;

    this.logger.log(
      `Decomposing tail risk for ${returns.length} return observations`,
    );

    const n = returns.length;
    const mean = returns.reduce((s, r) => s + r, 0) / n;
    const demeaned = returns.map((r) => r - mean);

    // Variance and standard deviation
    const variance = demeaned.reduce((s, d) => s + d * d, 0) / n;
    const sigma = Math.sqrt(variance);

    // Skewness: E[(X-mu)^3] / sigma^3
    const m3 = demeaned.reduce((s, d) => s + d * d * d, 0) / n;
    const skewness = sigma > 0 ? m3 / Math.pow(sigma, 3) : 0;

    // Excess Kurtosis: E[(X-mu)^4] / sigma^4 - 3
    const m4 = demeaned.reduce((s, d) => s + d * d * d * d, 0) / n;
    const kurtosis = sigma > 0 ? m4 / Math.pow(sigma, 4) - 3 : 0;

    // Hill estimator for tail index
    const tailIndex = this.hillEstimator(returns, confidence);

    // Fat tail probability: P(|X| > 3*sigma)
    const threshold = 3 * sigma;
    const fatTailCount = returns.filter(
      (r) => Math.abs(r - mean) > threshold,
    ).length;
    const fatTailProbability = fatTailCount / n;

    // Systematic vs idiosyncratic tail risk decomposition
    let systematicTailRisk = 0.5;
    let idiosyncraticTailRisk = 0.5;

    if (marketReturns && marketReturns.length === n) {
      const decomp = this.decomposeSysIdio(returns, marketReturns, confidence);
      systematicTailRisk = decomp.systematic;
      idiosyncraticTailRisk = decomp.idiosyncratic;
    } else {
      // Heuristic: use kurtosis to estimate tail decomposition
      // Higher kurtosis => more idiosyncratic tail events
      const kurtRatio = Math.abs(kurtosis) / (Math.abs(kurtosis) + 3);
      idiosyncraticTailRisk = +Math.min(0.9, Math.max(0.1, kurtRatio)).toFixed(
        4,
      );
      systematicTailRisk = +(1 - idiosyncraticTailRisk).toFixed(4);
    }

    // VaR from empirical distribution
    const sorted = [...returns].sort((a, b) => a - b);
    const leftIdx = Math.floor((1 - confidence) * n);
    const rightIdx = Math.floor(confidence * n);

    return {
      kurtosis: +kurtosis.toFixed(4),
      skewness: +skewness.toFixed(4),
      tailIndex: +tailIndex.toFixed(4),
      fatTailProbability: +fatTailProbability.toFixed(6),
      systematicTailRisk,
      idiosyncraticTailRisk,
      leftTailVaR: +Math.abs(sorted[leftIdx] || 0).toFixed(6),
      rightTailVaR: +(sorted[rightIdx] || 0).toFixed(6),
    };
  }

  /**
   * Compute the Hill tail index estimator.
   *
   * The Hill estimator uses the k largest order statistics:
   *   ξ = (1/k) × Σ_{i=1}^{k} ln(X_(n-i+1) / X_(n-k))
   *
   * @param returns - Return series
   * @param confidence - Used to determine k (number of tail observations)
   * @returns Hill tail index estimate
   */
  computeHillEstimator(returns: number[], confidence: number = 0.95): number {
    return this.hillEstimator(returns, confidence);
  }

  // ─── Private Helpers ──────────────────────────────────────

  private hillEstimator(returns: number[], confidence: number): number {
    const absReturns = returns.map((r) => Math.abs(r)).sort((a, b) => b - a);
    const k = Math.max(2, Math.floor(returns.length * (1 - confidence)));

    if (k >= absReturns.length || absReturns[k] === 0) {
      return 0;
    }

    let sum = 0;
    for (let i = 0; i < k; i++) {
      if (absReturns[i] > 0 && absReturns[k] > 0) {
        sum += Math.log(absReturns[i] / absReturns[k]);
      }
    }

    return sum / k;
  }

  private decomposeSysIdio(
    returns: number[],
    marketReturns: number[],
    confidence: number,
  ): { systematic: number; idiosyncratic: number } {
    const n = returns.length;
    const meanR = returns.reduce((s, r) => s + r, 0) / n;
    const meanM = marketReturns.reduce((s, r) => s + r, 0) / n;

    // Compute beta via OLS
    let covRM = 0;
    let varM = 0;
    for (let i = 0; i < n; i++) {
      const dr = returns[i] - meanR;
      const dm = marketReturns[i] - meanM;
      covRM += dr * dm;
      varM += dm * dm;
    }
    const beta = varM > 0 ? covRM / varM : 0;

    // Residuals
    const residuals = returns.map(
      (r, i) => r - (meanR + beta * (marketReturns[i] - meanM)),
    );

    // Tail events (beyond confidence quantile)
    const threshold = 1 - confidence;
    const tailSize = Math.max(1, Math.floor(n * threshold));
    const sortedReturns = [...returns].sort((a, b) => a - b);
    const tailThreshold = sortedReturns[tailSize];

    // Count tail events
    let totalTailEvents = 0;
    let systematicTailEvents = 0;

    for (let i = 0; i < n; i++) {
      if (returns[i] <= tailThreshold) {
        totalTailEvents++;
        // If market also in tail, it's systematic
        const sortedMarket = [...marketReturns].sort((a, b) => a - b);
        const mktThreshold = sortedMarket[tailSize];
        if (marketReturns[i] <= mktThreshold) {
          systematicTailEvents++;
        }
      }
    }

    const systematic =
      totalTailEvents > 0
        ? +(systematicTailEvents / totalTailEvents).toFixed(4)
        : 0.5;
    const idiosyncratic = +(1 - systematic).toFixed(4);

    return { systematic, idiosyncratic };
  }
}
