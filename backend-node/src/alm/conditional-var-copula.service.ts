import { Injectable, Logger } from '@nestjs/common';

/**
 * Conditional Value-at-Risk (Copula-Aware) Service
 *
 * Computes portfolio VaR conditional on the market being in a
 * stress state (returns below a user-defined threshold), capturing
 * tail dependence that normal VaR ignores.
 *
 * Key outputs:
 * - Conditional VaR (VaR during market stress)
 * - Unconditional VaR (full-sample)
 * - Stress multiplier (how much worse VaR gets in a crisis)
 * - Tail dependence coefficient (empirical lower-tail)
 */

// ─── Types ──────────────────────────────────────────────────────

export interface ConditionalVaRParams {
  portfolioReturns: number[];
  marketReturns: number[];
  confidence: number;
  conditionThreshold: number;
}

export interface ConditionalVaRResult {
  conditionalVaR: number;
  unconditionalVaR: number;
  stressMultiplier: number;
  tailDependence: number;
}

// ─── Service ────────────────────────────────────────────────────

@Injectable()
export class ConditionalVaRCopulaService {
  private readonly logger = new Logger(ConditionalVaRCopulaService.name);

  /**
   * Calculate VaR of a portfolio conditional on the market being
   * below `conditionThreshold` (i.e. in a stress regime).
   *
   * @param params.confidence  Confidence level, e.g. 0.95 for 95 %
   * @param params.conditionThreshold  Market return below which we
   *        consider the market to be stressed (e.g. -0.02)
   */
  calculateConditionalVaR(params: ConditionalVaRParams): ConditionalVaRResult {
    const { portfolioReturns, marketReturns, confidence, conditionThreshold } =
      params;
    this.logger.log(
      `Calculating conditional VaR at ${(confidence * 100).toFixed(0)}% confidence`,
    );

    if (portfolioReturns.length !== marketReturns.length) {
      throw new Error(
        'portfolioReturns and marketReturns must have the same length',
      );
    }

    // ── Unconditional VaR ──
    const unconditionalVaR = historicalVaR(portfolioReturns, confidence);

    // ── Filter to stress days ──
    const stressPortfolioReturns: number[] = [];
    for (let i = 0; i < marketReturns.length; i++) {
      if (marketReturns[i] <= conditionThreshold) {
        stressPortfolioReturns.push(portfolioReturns[i]);
      }
    }

    let conditionalVaR: number;
    if (stressPortfolioReturns.length < 2) {
      // Not enough stress observations — fall back to unconditional
      conditionalVaR = unconditionalVaR;
    } else {
      conditionalVaR = historicalVaR(stressPortfolioReturns, confidence);
    }

    // ── Stress multiplier ──
    const stressMultiplier =
      unconditionalVaR !== 0
        ? round4(conditionalVaR / unconditionalVaR)
        : 1;

    // ── Empirical tail dependence ──
    const tailDependence = computeTailDependence(
      portfolioReturns,
      marketReturns,
      conditionThreshold,
    );

    return {
      conditionalVaR: round6(conditionalVaR),
      unconditionalVaR: round6(unconditionalVaR),
      stressMultiplier,
      tailDependence: round4(tailDependence),
    };
  }
}

// ─── Helpers ────────────────────────────────────────────────────

/**
 * Historical simulation VaR.
 * Returns the loss at the given confidence level (as a positive number).
 */
function historicalVaR(returns: number[], confidence: number): number {
  const sorted = [...returns].sort((a, b) => a - b);
  const index = Math.floor(sorted.length * (1 - confidence));
  const varReturn = sorted[Math.max(index, 0)];
  return -varReturn; // flip sign so VaR is positive
}

/**
 * Empirical lower-tail dependence: P(portfolio in its own lower tail | market in stress).
 */
function computeTailDependence(
  portfolioReturns: number[],
  marketReturns: number[],
  threshold: number,
): number {
  const portSorted = [...portfolioReturns].sort((a, b) => a - b);
  const portThresholdIdx = Math.floor(portSorted.length * 0.1); // bottom 10 %
  const portThreshold = portSorted[portThresholdIdx] ?? threshold;

  let bothStressed = 0;
  let marketStressed = 0;

  for (let i = 0; i < marketReturns.length; i++) {
    if (marketReturns[i] <= threshold) {
      marketStressed++;
      if (portfolioReturns[i] <= portThreshold) {
        bothStressed++;
      }
    }
  }

  return marketStressed > 0 ? bothStressed / marketStressed : 0;
}

function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}

function round6(n: number): number {
  return Math.round(n * 1_000_000) / 1_000_000;
}
