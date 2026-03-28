import { Injectable, Logger } from '@nestjs/common';

/**
 * Regime-Switching VaR Service
 *
 * Detects two volatility regimes (calm vs. volatile) in a return
 * series by finding the variance breakpoint that maximises the
 * log-likelihood ratio, then computes VaR separately under each
 * regime and blends them by estimated probability.
 *
 * Key outputs:
 * - Current regime classification
 * - Per-regime volatility and VaR
 * - Probability-weighted blended VaR
 */

// ─── Types ──────────────────────────────────────────────────────

export interface RegimeVaRParams {
  returns: number[];
  confidence: number;
}

export interface RegimeDetail {
  name: string;
  probability: number;
  volatility: number;
  var: number;
}

export interface RegimeVaRResult {
  currentRegime: string;
  regimes: RegimeDetail[];
  blendedVaR: number;
}

// ─── Service ────────────────────────────────────────────────────

@Injectable()
export class RegimeSwitchingVaRService {
  private readonly logger = new Logger(RegimeSwitchingVaRService.name);

  /**
   * Compute regime-switching VaR.
   *
   * Splits the return series into two regimes based on a variance
   * breakpoint search, then estimates VaR per regime and blends.
   */
  calculateRegimeVaR(params: RegimeVaRParams): RegimeVaRResult {
    const { returns, confidence } = params;
    this.logger.log(
      `Computing regime-switching VaR (${returns.length} observations, ${(confidence * 100).toFixed(0)}% confidence)`,
    );

    if (returns.length < 10) {
      throw new Error('At least 10 return observations are required');
    }

    // ── Sort to find breakpoint via variance split ──
    const sorted = [...returns].sort((a, b) => a - b);
    const bestSplit = findVarianceBreakpoint(sorted);

    const calmReturns = sorted.slice(bestSplit);
    const volatileReturns = sorted.slice(0, bestSplit);

    const calmVol = stddev(calmReturns);
    const volVol = stddev(volatileReturns);

    const calmProb = calmReturns.length / returns.length;
    const volProb = volatileReturns.length / returns.length;

    // Parametric VaR assuming normal within each regime
    const zScore = normalQuantile(confidence);
    const calmVaR = round6(zScore * calmVol);
    const volVaR = round6(zScore * volVol);

    // Blended VaR
    const blendedVaR = round6(calmProb * calmVaR + volProb * volVaR);

    // Determine current regime from recent volatility (last 20 observations)
    const recentWindow = Math.min(20, Math.floor(returns.length / 2));
    const recentVol = stddev(returns.slice(-recentWindow));
    const midVol = (calmVol + volVol) / 2;
    const currentRegime = recentVol <= midVol ? 'CALM' : 'VOLATILE';

    return {
      currentRegime,
      regimes: [
        {
          name: 'CALM',
          probability: round4(calmProb),
          volatility: round6(calmVol),
          var: calmVaR,
        },
        {
          name: 'VOLATILE',
          probability: round4(volProb),
          volatility: round6(volVol),
          var: volVaR,
        },
      ],
      blendedVaR,
    };
  }
}

// ─── Helpers ────────────────────────────────────────────────────

/** Find the index that maximises within-group variance reduction */
function findVarianceBreakpoint(sorted: number[]): number {
  const n = sorted.length;
  const minGroup = Math.max(3, Math.floor(n * 0.15));
  let bestIndex = Math.floor(n / 2);
  let bestRatio = 0;

  for (let i = minGroup; i <= n - minGroup; i++) {
    const left = sorted.slice(0, i);
    const right = sorted.slice(i);
    const leftVar = variance(left);
    const rightVar = variance(right);
    const totalVar = variance(sorted);
    // Maximise the ratio of between-group variance to total
    const withinVar =
      (left.length / n) * leftVar + (right.length / n) * rightVar;
    const ratio = totalVar > 0 ? 1 - withinVar / totalVar : 0;
    if (ratio > bestRatio) {
      bestRatio = ratio;
      bestIndex = i;
    }
  }
  return bestIndex;
}

function mean(arr: number[]): number {
  return arr.reduce((s, v) => s + v, 0) / arr.length;
}

function variance(arr: number[]): number {
  const m = mean(arr);
  return arr.reduce((s, v) => s + (v - m) ** 2, 0) / arr.length;
}

function stddev(arr: number[]): number {
  return Math.sqrt(variance(arr));
}

/**
 * Approximate normal quantile using Beasley-Springer-Moro algorithm.
 */
function normalQuantile(p: number): number {
  // For VaR we need the positive z corresponding to confidence
  const t = p > 0.5 ? p : 1 - p;
  const c0 = 2.515517;
  const c1 = 0.802853;
  const c2 = 0.010328;
  const d1 = 1.432788;
  const d2 = 0.189269;
  const d3 = 0.001308;
  const x = Math.sqrt(-2 * Math.log(1 - t));
  const z = x - (c0 + c1 * x + c2 * x * x) / (1 + d1 * x + d2 * x * x + d3 * x * x * x);
  return z;
}

function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}

function round6(n: number): number {
  return Math.round(n * 1_000_000) / 1_000_000;
}
