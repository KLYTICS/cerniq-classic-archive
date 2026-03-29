import { Injectable, Logger } from '@nestjs/common';

/**
 * Encumbered Assets Analysis Engine — Quant Model
 *
 * Analyzes the encumbrance profile of the institution's asset base to
 * determine available collateral, concentration by pledgee, and overall
 * encumbrance ratios.
 *
 * Key metrics:
 *   - Encumbrance Ratio = Encumbered Assets / Total Assets
 *   - Available Collateral = Unencumbered Assets
 *   - Concentration by Pledgee
 *
 * Critical for liquidity risk management and regulatory reporting
 * (EBA encumbered assets template, NCUA collateral requirements).
 */

// ─── Input Types ────────────────────────────────────────────────────

export interface AssetEntry {
  name: string;
  balance: number;
  encumbered: number;
  pledgedTo: string;
}

export interface EncumberedAssetsParams {
  assets: AssetEntry[];
}

// ─── Output Types ───────────────────────────────────────────────────

export interface PledgeeBreakdown {
  pledgee: string;
  encumberedAmount: number;
  percentage: number;
}

export interface EncumberedAssetsResult {
  totalAssets: number;
  encumberedAssets: number;
  unencumberedAssets: number;
  encumbranceRatio: number;
  byPledgee: PledgeeBreakdown[];
  availableCollateral: number;
}

// ─── Service ────────────────────────────────────────────────────────

@Injectable()
export class EncumberedAssetsService {
  private readonly logger = new Logger(EncumberedAssetsService.name);

  /**
   * Analyze the encumbrance profile of the institution's assets.
   *
   * Computes total encumbered vs. unencumbered assets, breaks down
   * encumbrance by pledgee, and determines available collateral.
   */
  analyzeEncumbrance(params: EncumberedAssetsParams): EncumberedAssetsResult {
    const { assets } = params;

    if (assets.length === 0) {
      throw new Error('At least one asset entry is required');
    }

    const totalAssets = assets.reduce((s, a) => s + a.balance, 0);
    const encumberedAssets = assets.reduce((s, a) => s + a.encumbered, 0);
    const unencumberedAssets = totalAssets - encumberedAssets;
    const encumbranceRatio =
      totalAssets > 0 ? encumberedAssets / totalAssets : 0;

    // Group by pledgee
    const pledgeeMap = new Map<string, number>();
    for (const asset of assets) {
      if (asset.encumbered > 0) {
        const current = pledgeeMap.get(asset.pledgedTo) ?? 0;
        pledgeeMap.set(asset.pledgedTo, current + asset.encumbered);
      }
    }

    const byPledgee: PledgeeBreakdown[] = Array.from(pledgeeMap.entries())
      .map(([pledgee, amount]) => ({
        pledgee,
        encumberedAmount: this.round2(amount),
        percentage: this.round6(
          encumberedAssets > 0 ? amount / encumberedAssets : 0,
        ),
      }))
      .sort((a, b) => b.encumberedAmount - a.encumberedAmount);

    this.logger.log(
      `Encumbrance analysis: ratio=${this.round6(encumbranceRatio)}, pledgees=${byPledgee.length}, available=${this.round2(unencumberedAssets)}`,
    );

    return {
      totalAssets: this.round2(totalAssets),
      encumberedAssets: this.round2(encumberedAssets),
      unencumberedAssets: this.round2(unencumberedAssets),
      encumbranceRatio: this.round6(encumbranceRatio),
      byPledgee,
      availableCollateral: this.round2(unencumberedAssets),
    };
  }

  /**
   * Validate that encumbered amounts do not exceed asset balances
   * and flag any inconsistencies.
   */
  validateEncumbrance(params: EncumberedAssetsParams): {
    valid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    for (const asset of params.assets) {
      if (asset.encumbered > asset.balance) {
        errors.push(
          `${asset.name}: encumbered (${asset.encumbered}) exceeds balance (${asset.balance})`,
        );
      }
      if (asset.encumbered < 0) {
        errors.push(`${asset.name}: encumbered amount cannot be negative`);
      }
      if (asset.encumbered > 0 && !asset.pledgedTo) {
        errors.push(`${asset.name}: encumbered but no pledgee specified`);
      }
    }

    return { valid: errors.length === 0, errors };
  }

  // ─── Private helpers ──────────────────────────────────────────────

  private round2(n: number): number {
    return Math.round(n * 100) / 100;
  }

  private round6(n: number): number {
    return Math.round(n * 1_000_000) / 1_000_000;
  }
}
