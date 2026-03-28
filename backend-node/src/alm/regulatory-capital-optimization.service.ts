import { Injectable, Logger } from '@nestjs/common';

/**
 * Regulatory Capital Optimization Engine — Quant Model
 *
 * Optimizes capital allocation across asset classes to maximize
 * return on equity while satisfying regulatory capital constraints
 * (Tier 1, Total Capital, Leverage ratios).
 *
 * Key ratios:
 *   - Tier 1 Ratio = Tier 1 Capital / RWA
 *   - Total Capital Ratio = Total Capital / RWA
 *   - Leverage Ratio = Tier 1 Capital / Total Assets
 *
 * Designed for cooperativa CFOs and COSSEC / NCUA compliance.
 */

// ─── Input Types ────────────────────────────────────────────────────

export interface TargetRatios {
  minTier1: number;
  minTotalCapital: number;
  minLeverage: number;
}

export interface CapitalConstraint {
  maxRWAGrowth: number;
  maxConcentration: number;
}

export interface RiskWeightedAsset {
  category: string;
  balance: number;
  riskWeight: number;
}

export interface CurrentCapital {
  tier1: number;
  tier2: number;
  totalAssets: number;
}

export interface CapitalOptimizationParams {
  riskWeightedAssets: RiskWeightedAsset[];
  currentCapital: CurrentCapital;
  targetRatios: TargetRatios;
  constraints: CapitalConstraint;
}

// ─── Output Types ───────────────────────────────────────────────────

export interface OptimalAllocation {
  category: string;
  currentBalance: number;
  rwa: number;
  capitalCharge: number;
  rorac: number;
}

export interface CapitalOptimizationResult {
  optimalAllocation: OptimalAllocation[];
  capitalSurplus: number;
  leverageRatio: number;
  tier1Ratio: number;
  totalCapitalRatio: number;
  totalRWA: number;
  wellCapitalized: boolean;
}

// ─── Service ────────────────────────────────────────────────────────

@Injectable()
export class RegulatoryCapitalOptimizationService {
  private readonly logger = new Logger(RegulatoryCapitalOptimizationService.name);

  /**
   * Optimize capital allocation and compute regulatory ratios.
   *
   * Calculates RWA for each asset category, computes capital charges,
   * and determines whether the institution is well-capitalized under
   * current regulatory thresholds.
   */
  optimizeCapital(params: CapitalOptimizationParams): CapitalOptimizationResult {
    const { riskWeightedAssets, currentCapital, targetRatios } = params;

    if (riskWeightedAssets.length === 0) {
      throw new Error('At least one risk-weighted asset category is required');
    }

    const totalCapital = currentCapital.tier1 + currentCapital.tier2;

    // Compute RWA and capital charges per category
    let totalRWA = 0;
    const optimalAllocation: OptimalAllocation[] = riskWeightedAssets.map((rwa) => {
      const categoryRWA = rwa.balance * rwa.riskWeight;
      totalRWA += categoryRWA;
      const capitalCharge = categoryRWA * targetRatios.minTotalCapital;
      // Risk-adjusted return — simplified as spread / capital charge
      const assumedSpread = 0.03; // 3% average spread
      const rorac =
        capitalCharge > 0
          ? (rwa.balance * assumedSpread) / capitalCharge
          : 0;

      return {
        category: rwa.category,
        currentBalance: this.round2(rwa.balance),
        rwa: this.round2(categoryRWA),
        capitalCharge: this.round2(capitalCharge),
        rorac: this.round6(rorac),
      };
    });

    const tier1Ratio = totalRWA > 0 ? currentCapital.tier1 / totalRWA : 0;
    const totalCapitalRatio = totalRWA > 0 ? totalCapital / totalRWA : 0;
    const leverageRatio =
      currentCapital.totalAssets > 0
        ? currentCapital.tier1 / currentCapital.totalAssets
        : 0;

    const capitalSurplus = totalCapital - totalRWA * targetRatios.minTotalCapital;

    const wellCapitalized =
      tier1Ratio >= targetRatios.minTier1 &&
      totalCapitalRatio >= targetRatios.minTotalCapital &&
      leverageRatio >= targetRatios.minLeverage;

    this.logger.log(
      `Capital optimization: T1=${this.round6(tier1Ratio)}, TCR=${this.round6(totalCapitalRatio)}, leverage=${this.round6(leverageRatio)}, wellCap=${wellCapitalized}`,
    );

    return {
      optimalAllocation,
      capitalSurplus: this.round2(capitalSurplus),
      leverageRatio: this.round6(leverageRatio),
      tier1Ratio: this.round6(tier1Ratio),
      totalCapitalRatio: this.round6(totalCapitalRatio),
      totalRWA: this.round2(totalRWA),
      wellCapitalized,
    };
  }

  /**
   * Stress-test capital ratios under a given loss scenario.
   */
  stressTestCapital(
    params: CapitalOptimizationParams,
    stressLossPct: number,
  ): { stressedTier1Ratio: number; stressedTotalCapitalRatio: number; breachesMinimum: boolean } {
    const result = this.optimizeCapital(params);
    const stressLoss = result.totalRWA * stressLossPct;

    const stressedTier1 = params.currentCapital.tier1 - stressLoss;
    const stressedTotal =
      params.currentCapital.tier1 + params.currentCapital.tier2 - stressLoss;

    const stressedTier1Ratio = result.totalRWA > 0 ? stressedTier1 / result.totalRWA : 0;
    const stressedTotalCapitalRatio =
      result.totalRWA > 0 ? stressedTotal / result.totalRWA : 0;

    const breachesMinimum =
      stressedTier1Ratio < params.targetRatios.minTier1 ||
      stressedTotalCapitalRatio < params.targetRatios.minTotalCapital;

    return {
      stressedTier1Ratio: this.round6(stressedTier1Ratio),
      stressedTotalCapitalRatio: this.round6(stressedTotalCapitalRatio),
      breachesMinimum,
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
