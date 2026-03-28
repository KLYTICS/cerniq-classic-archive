import { Injectable, Logger } from '@nestjs/common';

/**
 * Stress Correlation Analysis Service
 *
 * Compares asset-pair correlations in normal market conditions
 * vs. stressed periods (market drawdowns), quantifying the
 * well-known phenomenon of "correlations go to 1 in a crisis."
 *
 * Key outputs:
 * - Average correlation in normal periods
 * - Average correlation during stress
 * - Magnitude of the correlation increase
 * - Diversification breakdown flag
 */

// ─── Types ──────────────────────────────────────────────────────

export interface StressCorrelationParams {
  /** Map of asset name to array of returns (same length per asset) */
  returns: Record<string, number[]>;
  /** Market return threshold below which is considered "stress" */
  stressThreshold: number;
}

export interface StressCorrelationResult {
  normalCorrelation: number;
  stressCorrelation: number;
  correlationIncrease: number;
  diversificationBreakdown: boolean;
}

// ─── Service ────────────────────────────────────────────────────

@Injectable()
export class StressCorrelationService {
  private readonly logger = new Logger(StressCorrelationService.name);

  /**
   * Analyse how correlations change under market stress.
   *
   * The first key in `returns` is treated as the market benchmark
   * for stress detection.  All pairwise correlations among the
   * remaining assets are computed for normal and stress periods.
   */
  analyzeStressCorrelation(
    params: StressCorrelationParams,
  ): StressCorrelationResult {
    const { returns, stressThreshold } = params;
    const assets = Object.keys(returns);
    this.logger.log(
      `Analyzing stress correlations for ${assets.length} assets (threshold: ${stressThreshold})`,
    );

    if (assets.length < 2) {
      throw new Error('At least 2 assets are required for correlation analysis');
    }

    const marketKey = assets[0];
    const marketReturns = returns[marketKey];
    const n = marketReturns.length;

    // Split indices into normal and stress
    const normalIdx: number[] = [];
    const stressIdx: number[] = [];
    for (let i = 0; i < n; i++) {
      if (marketReturns[i] <= stressThreshold) {
        stressIdx.push(i);
      } else {
        normalIdx.push(i);
      }
    }

    // Compute average pairwise correlation for each regime
    const assetKeys = assets.slice(1);
    const normalCorrelation = averagePairwiseCorrelation(
      returns,
      assetKeys,
      normalIdx,
    );
    const stressCorrelation = averagePairwiseCorrelation(
      returns,
      assetKeys,
      stressIdx,
    );

    const correlationIncrease = round4(stressCorrelation - normalCorrelation);

    // Diversification breakdown if stress correlation > 0.8 and increase > 0.2
    const diversificationBreakdown =
      stressCorrelation > 0.8 && correlationIncrease > 0.2;

    return {
      normalCorrelation: round4(normalCorrelation),
      stressCorrelation: round4(stressCorrelation),
      correlationIncrease,
      diversificationBreakdown,
    };
  }
}

// ─── Helpers ────────────────────────────────────────────────────

function averagePairwiseCorrelation(
  returns: Record<string, number[]>,
  keys: string[],
  indices: number[],
): number {
  if (keys.length < 2 || indices.length < 3) return 0;

  let totalCorr = 0;
  let pairs = 0;

  for (let i = 0; i < keys.length; i++) {
    for (let j = i + 1; j < keys.length; j++) {
      const x = indices.map((idx) => returns[keys[i]][idx]);
      const y = indices.map((idx) => returns[keys[j]][idx]);
      totalCorr += pearsonCorrelation(x, y);
      pairs++;
    }
  }

  return pairs > 0 ? totalCorr / pairs : 0;
}

function pearsonCorrelation(x: number[], y: number[]): number {
  const n = x.length;
  if (n < 2) return 0;

  const mx = x.reduce((s, v) => s + v, 0) / n;
  const my = y.reduce((s, v) => s + v, 0) / n;

  let num = 0;
  let dx2 = 0;
  let dy2 = 0;

  for (let i = 0; i < n; i++) {
    const dx = x[i] - mx;
    const dy = y[i] - my;
    num += dx * dy;
    dx2 += dx * dx;
    dy2 += dy * dy;
  }

  const denom = Math.sqrt(dx2 * dy2);
  return denom > 0 ? num / denom : 0;
}

function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}
