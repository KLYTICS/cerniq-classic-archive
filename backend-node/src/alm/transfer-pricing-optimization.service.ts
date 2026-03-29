import { Injectable, Logger } from '@nestjs/common';

/**
 * Transfer Pricing Optimization Engine — Quant Model
 *
 * Optimizes Funds Transfer Pricing (FTP) rates to maximize Net Interest
 * Margin (NIM) while maintaining competitive pricing.
 *
 * FTP assigns an internal cost of funds to each asset and a credit for
 * each liability based on the matched-maturity funding curve.  The engine
 * computes optimal FTP rates and projects NIM impact.
 *
 * Designed for cooperativa treasury desks managing profitability attribution.
 */

// ─── Input Types ────────────────────────────────────────────────────

export interface FundingCurvePoint {
  tenor: number; // in years
  rate: number;
}

export interface FTPAsset {
  name: string;
  balance: number;
  yield: number;
  maturityYears: number;
}

export interface FTPLiability {
  name: string;
  balance: number;
  cost: number;
  maturityYears: number;
}

export interface TransferPricingParams {
  fundingCurve: FundingCurvePoint[];
  assets: FTPAsset[];
  liabilities: FTPLiability[];
  targetNIM: number;
}

// ─── Output Types ───────────────────────────────────────────────────

export interface FTPRate {
  instrument: string;
  ftpRate: number;
  spread: number;
  balance: number;
}

export interface TransferPricingResult {
  optimalFTPRates: FTPRate[];
  projectedNIM: number;
  nimImpact: number;
  totalInterestIncome: number;
  totalInterestExpense: number;
  totalFTPRevenue: number;
}

// ─── Service ────────────────────────────────────────────────────────

@Injectable()
export class TransferPricingOptimizationService {
  private readonly logger = new Logger(TransferPricingOptimizationService.name);

  /**
   * Optimize FTP rates based on the funding curve and compute NIM impact.
   *
   * For each instrument, the FTP rate is interpolated from the funding curve
   * at the instrument's maturity.  The spread is the difference between the
   * instrument's yield/cost and the FTP rate.
   */
  optimizeTransferPricing(
    params: TransferPricingParams,
  ): TransferPricingResult {
    const { fundingCurve, assets, liabilities, targetNIM } = params;

    if (fundingCurve.length === 0) {
      throw new Error('Funding curve must have at least one point');
    }

    const sortedCurve = [...fundingCurve].sort((a, b) => a.tenor - b.tenor);
    const ftpRates: FTPRate[] = [];

    // FTP for assets — charge the matched-maturity funding rate
    let totalInterestIncome = 0;
    let totalFTPCost = 0;
    for (const asset of assets) {
      const ftpRate = this.interpolateRate(sortedCurve, asset.maturityYears);
      const spread = asset.yield - ftpRate;
      totalInterestIncome += asset.balance * asset.yield;
      totalFTPCost += asset.balance * ftpRate;

      ftpRates.push({
        instrument: asset.name,
        ftpRate: this.round6(ftpRate),
        spread: this.round6(spread),
        balance: this.round2(asset.balance),
      });
    }

    // FTP for liabilities — credit the matched-maturity funding rate
    let totalInterestExpense = 0;
    let totalFTPCredit = 0;
    for (const liability of liabilities) {
      const ftpRate = this.interpolateRate(
        sortedCurve,
        liability.maturityYears,
      );
      const spread = ftpRate - liability.cost;
      totalInterestExpense += liability.balance * liability.cost;
      totalFTPCredit += liability.balance * ftpRate;

      ftpRates.push({
        instrument: liability.name,
        ftpRate: this.round6(ftpRate),
        spread: this.round6(spread),
        balance: this.round2(liability.balance),
      });
    }

    const totalAssets = assets.reduce((s, a) => s + a.balance, 0);
    const netInterestIncome = totalInterestIncome - totalInterestExpense;
    const projectedNIM = totalAssets > 0 ? netInterestIncome / totalAssets : 0;
    const nimImpact = projectedNIM - targetNIM;

    const totalFTPRevenue = totalFTPCredit - totalFTPCost;

    this.logger.log(
      `FTP optimization: projectedNIM=${this.round6(projectedNIM)}, nimImpact=${this.round6(nimImpact)}, instruments=${ftpRates.length}`,
    );

    return {
      optimalFTPRates: ftpRates,
      projectedNIM: this.round6(projectedNIM),
      nimImpact: this.round6(nimImpact),
      totalInterestIncome: this.round2(totalInterestIncome),
      totalInterestExpense: this.round2(totalInterestExpense),
      totalFTPRevenue: this.round2(totalFTPRevenue),
    };
  }

  /**
   * Interpolate a rate from the funding curve at a given maturity.
   * Uses linear interpolation between curve points.
   */
  interpolateRate(curve: FundingCurvePoint[], maturity: number): number {
    if (curve.length === 1) return curve[0].rate;

    // Clamp to curve boundaries
    if (maturity <= curve[0].tenor) return curve[0].rate;
    if (maturity >= curve[curve.length - 1].tenor)
      return curve[curve.length - 1].rate;

    // Find bracketing points
    for (let i = 0; i < curve.length - 1; i++) {
      if (maturity >= curve[i].tenor && maturity <= curve[i + 1].tenor) {
        const t =
          (maturity - curve[i].tenor) / (curve[i + 1].tenor - curve[i].tenor);
        return curve[i].rate + t * (curve[i + 1].rate - curve[i].rate);
      }
    }

    return curve[curve.length - 1].rate;
  }

  // ─── Private helpers ──────────────────────────────────────────────

  private round2(n: number): number {
    return Math.round(n * 100) / 100;
  }

  private round6(n: number): number {
    return Math.round(n * 1_000_000) / 1_000_000;
  }
}
