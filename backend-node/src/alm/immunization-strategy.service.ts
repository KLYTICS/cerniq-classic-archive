import { Injectable, Logger } from '@nestjs/common';

/**
 * Immunization Strategy Engine — Quant Model
 *
 * Matches asset and liability duration + convexity to immunize the
 * portfolio against parallel and non-parallel yield-curve shifts.
 *
 * Classical immunization conditions:
 *   1. PV(Assets) >= PV(Liabilities)
 *   2. Duration(Assets) = Duration(Liabilities)  (first-order hedge)
 *   3. Convexity(Assets) >= Convexity(Liabilities)  (second-order hedge)
 *
 * The engine identifies the current gap and recommends rebalancing trades.
 */

// ─── Input Types ────────────────────────────────────────────────────

export interface ImmunizationPosition {
  name: string;
  marketValue: number;
  duration: number;
  convexity: number;
  yield: number;
}

export interface ImmunizationParams {
  assets: ImmunizationPosition[];
  liabilities: ImmunizationPosition[];
  targetHorizon: number;
}

// ─── Output Types ───────────────────────────────────────────────────

export interface RebalancingAction {
  action: 'buy' | 'sell';
  instrument: string;
  amount: number;
  rationale: string;
}

export interface ImmunizationResult {
  currentGap: number;
  assetDuration: number;
  liabilityDuration: number;
  assetConvexity: number;
  liabilityConvexity: number;
  rebalancing: RebalancingAction[];
  immunizedDuration: number;
  convexityMatch: boolean;
}

// ─── Service ────────────────────────────────────────────────────────

@Injectable()
export class ImmunizationStrategyService {
  private readonly logger = new Logger(ImmunizationStrategyService.name);

  /**
   * Analyze the asset-liability portfolio and recommend immunization trades.
   *
   * Computes market-value-weighted duration and convexity for both sides,
   * then generates buy/sell recommendations to close the gap.
   */
  immunize(params: ImmunizationParams): ImmunizationResult {
    const { assets, liabilities, targetHorizon } = params;

    if (assets.length === 0) {
      throw new Error('At least one asset position is required');
    }
    if (liabilities.length === 0) {
      throw new Error('At least one liability position is required');
    }

    const totalAssetMV = assets.reduce((s, a) => s + a.marketValue, 0);
    const totalLiabilityMV = liabilities.reduce((s, l) => s + l.marketValue, 0);

    // Market-value-weighted duration
    const assetDuration = assets.reduce(
      (s, a) => s + a.duration * (a.marketValue / totalAssetMV),
      0,
    );
    const liabilityDuration = liabilities.reduce(
      (s, l) => s + l.duration * (l.marketValue / totalLiabilityMV),
      0,
    );

    // Market-value-weighted convexity
    const assetConvexity = assets.reduce(
      (s, a) => s + a.convexity * (a.marketValue / totalAssetMV),
      0,
    );
    const liabilityConvexity = liabilities.reduce(
      (s, l) => s + l.convexity * (l.marketValue / totalLiabilityMV),
      0,
    );

    const currentGap = assetDuration - liabilityDuration;
    const convexityMatch = assetConvexity >= liabilityConvexity;

    // Generate rebalancing recommendations
    const rebalancing: RebalancingAction[] = [];

    if (Math.abs(currentGap) > 0.1) {
      if (currentGap > 0) {
        // Asset duration too long — sell long-duration assets or buy short liabilities
        const longestAsset = [...assets].sort(
          (a, b) => b.duration - a.duration,
        )[0];
        const reductionNeeded = currentGap * totalAssetMV;
        const amount = Math.abs(reductionNeeded / longestAsset.duration);
        rebalancing.push({
          action: 'sell',
          instrument: longestAsset.name,
          amount: this.round2(amount),
          rationale: `Reduce asset duration by ${this.round2(currentGap)} years`,
        });
      } else {
        // Asset duration too short — buy longer-duration assets
        const shortestDurAsset = [...assets].sort(
          (a, b) => a.duration - b.duration,
        )[0];
        const extensionNeeded = Math.abs(currentGap) * totalAssetMV;
        const longestAvailable = [...assets].sort(
          (a, b) => b.duration - a.duration,
        )[0];
        const amount = extensionNeeded / longestAvailable.duration;
        rebalancing.push({
          action: 'buy',
          instrument: longestAvailable.name,
          amount: this.round2(amount),
          rationale: `Extend asset duration by ${this.round2(Math.abs(currentGap))} years`,
        });
      }
    }

    if (!convexityMatch) {
      const convexityGap = liabilityConvexity - assetConvexity;
      const highestConvexityAsset = [...assets].sort(
        (a, b) => b.convexity - a.convexity,
      )[0];
      const amount =
        (convexityGap * totalAssetMV) / highestConvexityAsset.convexity;
      rebalancing.push({
        action: 'buy',
        instrument: highestConvexityAsset.name,
        amount: this.round2(Math.abs(amount)),
        rationale: `Increase asset convexity by ${this.round2(convexityGap)} to match liabilities`,
      });
    }

    const immunizedDuration =
      rebalancing.length === 0 ? assetDuration : targetHorizon;

    this.logger.log(
      `Immunization analysis: durationGap=${this.round6(currentGap)}, convexityMatch=${convexityMatch}, actions=${rebalancing.length}`,
    );

    return {
      currentGap: this.round6(currentGap),
      assetDuration: this.round6(assetDuration),
      liabilityDuration: this.round6(liabilityDuration),
      assetConvexity: this.round6(assetConvexity),
      liabilityConvexity: this.round6(liabilityConvexity),
      rebalancing,
      immunizedDuration: this.round6(immunizedDuration),
      convexityMatch,
    };
  }

  /**
   * Compute the surplus at risk — the worst-case loss to the
   * asset-liability surplus under a given rate shock.
   */
  surplusAtRisk(
    params: ImmunizationParams,
    shockBps: number,
  ): {
    currentSurplus: number;
    surplusAfterShock: number;
    surplusAtRisk: number;
  } {
    const totalAssetMV = params.assets.reduce((s, a) => s + a.marketValue, 0);
    const totalLiabilityMV = params.liabilities.reduce(
      (s, l) => s + l.marketValue,
      0,
    );
    const currentSurplus = totalAssetMV - totalLiabilityMV;

    const shockDecimal = shockBps / 10_000;

    // Approximate MV change via duration + convexity
    const assetDuration = params.assets.reduce(
      (s, a) => s + a.duration * (a.marketValue / totalAssetMV),
      0,
    );
    const liabilityDuration = params.liabilities.reduce(
      (s, l) => s + l.duration * (l.marketValue / totalLiabilityMV),
      0,
    );

    const assetPnL = -assetDuration * totalAssetMV * shockDecimal;
    const liabilityPnL = -liabilityDuration * totalLiabilityMV * shockDecimal;

    const surplusAfterShock = currentSurplus + assetPnL - liabilityPnL;
    const surplusAtRiskValue = currentSurplus - surplusAfterShock;

    return {
      currentSurplus: this.round2(currentSurplus),
      surplusAfterShock: this.round2(surplusAfterShock),
      surplusAtRisk: this.round2(surplusAtRiskValue),
    };
  }

  // ─── Private helpers ──────────────────────────────────────────────

  private round2(n: number): number {
    return Math.round(n * 100) / 100;
  }

  private round6(n: number): number {
    return Math.round(n * 1_000_000) / 1_000_000;
  }
}
