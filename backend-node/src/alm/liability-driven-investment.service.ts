import { Injectable, Logger } from '@nestjs/common';

/**
 * Liability-Driven Investment (LDI) Service
 *
 * Constructs an asset portfolio that matches the duration and
 * cash flows of a liability stream, minimising surplus volatility
 * and immunising the balance sheet against interest rate moves.
 *
 * Key outputs:
 * - Optimal asset allocation with weights and dollar amounts
 * - Surplus risk (duration mismatch × portfolio size)
 * - Funding ratio (PV assets / PV liabilities)
 * - Duration match quality
 * - Cash-flow match score
 */

// ─── Types ──────────────────────────────────────────────────────

export interface Liability {
  amount: number;
  maturityYears: number;
  rate: number;
}

export interface AvailableAsset {
  name: string;
  duration: number;
  yield: number;
  convexity: number;
}

export interface LDIParams {
  liabilities: Liability[];
  availableAssets: AvailableAsset[];
}

export interface AssetAllocation {
  asset: string;
  weight: number;
  amount: number;
}

export interface LDIResult {
  allocation: AssetAllocation[];
  surplusRisk: number;
  fundingRatio: number;
  durationMatch: number;
  cashFlowMatch: number;
}

// ─── Service ────────────────────────────────────────────────────

@Injectable()
export class LiabilityDrivenInvestmentService {
  private readonly logger = new Logger(LiabilityDrivenInvestmentService.name);

  /**
   * Construct an LDI portfolio that matches liability cash flows.
   *
   * Uses a duration-matching heuristic: allocate more weight to
   * assets whose duration is closest to the liability-weighted
   * average duration.
   */
  constructLDIPortfolio(params: LDIParams): LDIResult {
    const { liabilities, availableAssets } = params;
    this.logger.log(
      `Constructing LDI portfolio: ${liabilities.length} liabilities, ${availableAssets.length} assets`,
    );

    // ── PV of liabilities ──
    const pvLiabilities = liabilities.reduce(
      (sum, l) => sum + pvLiability(l),
      0,
    );

    // ── Liability-weighted average duration ──
    const targetDuration = liabilities.reduce(
      (sum, l) => sum + l.maturityYears * (pvLiability(l) / pvLiabilities),
      0,
    );

    // ── Score each asset by inverse distance to target duration ──
    const scores: { asset: AvailableAsset; score: number }[] = [];
    for (const a of availableAssets) {
      const distancePenalty = Math.abs(a.duration - targetDuration) + 0.1;
      // Favour higher yield and convexity
      const score =
        (1 / distancePenalty) * (1 + a.yield) * (1 + a.convexity * 0.01);
      scores.push({ asset: a, score });
    }

    const totalScore = scores.reduce((s, v) => s + v.score, 0);
    const allocation: AssetAllocation[] = scores.map((s) => {
      const weight = round4(s.score / totalScore);
      return {
        asset: s.asset.name,
        weight,
        amount: round2(weight * pvLiabilities),
      };
    });

    // ── Portfolio duration ──
    const portfolioDuration = allocation.reduce((sum, a, i) => {
      return sum + a.weight * availableAssets[i].duration;
    }, 0);

    const durationMatch = round4(
      1 - Math.abs(portfolioDuration - targetDuration) / (targetDuration || 1),
    );

    // ── Surplus risk ──
    const durationGap = Math.abs(portfolioDuration - targetDuration);
    const surplusRisk = round2(durationGap * pvLiabilities * 0.01);

    // ── Funding ratio ──
    const pvAssets = allocation.reduce((s, a) => s + a.amount, 0);
    const fundingRatio = round4(pvAssets / (pvLiabilities || 1));

    // ── Cash-flow match (simplified: score based on maturity coverage) ──
    const liabMaturities = liabilities.map((l) => l.maturityYears);
    const assetDurations = availableAssets.map((a) => a.duration);
    const cashFlowMatch = computeCashFlowMatch(liabMaturities, assetDurations);

    return {
      allocation,
      surplusRisk,
      fundingRatio,
      durationMatch,
      cashFlowMatch,
    };
  }
}

// ─── Helpers ────────────────────────────────────────────────────

function pvLiability(l: Liability): number {
  if (l.rate === 0) return l.amount;
  return l.amount / Math.pow(1 + l.rate, l.maturityYears);
}

/**
 * Simple cash-flow match score: average closeness of each liability
 * maturity to the nearest asset duration (0 = no match, 1 = perfect).
 */
function computeCashFlowMatch(
  liabMaturities: number[],
  assetDurations: number[],
): number {
  if (liabMaturities.length === 0 || assetDurations.length === 0) return 0;

  let totalMatch = 0;
  for (const m of liabMaturities) {
    const closest = assetDurations.reduce(
      (best, d) => (Math.abs(d - m) < Math.abs(best - m) ? d : best),
      assetDurations[0],
    );
    const gap = Math.abs(closest - m);
    totalMatch += Math.max(0, 1 - gap / (m || 1));
  }

  return round4(totalMatch / liabMaturities.length);
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}
