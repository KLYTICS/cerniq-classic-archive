import { Injectable, Logger } from '@nestjs/common';

/**
 * Yield Spread Decomposition Engine — Quant Model
 *
 * Decomposes the total yield spread into its constituent components:
 *   - Credit spread (default risk premium)
 *   - Liquidity premium (market liquidity risk)
 *   - Option cost (embedded optionality, e.g., call/put features)
 *   - Residual (unexplained component)
 *
 * Decomposition:
 *   Total Spread = Bond Yield - Treasury Yield
 *   Swap Spread  = Swap Rate - Treasury Yield
 *   Credit       = Total Spread - Swap Spread (simplified)
 *   Liquidity    = Swap Spread × liquidity factor
 *   Option Cost  = provided or estimated
 *   Residual     = Total - Credit - Liquidity - Option Cost
 */

// ─── Input Types ────────────────────────────────────────────────────

export interface SpreadDecompositionParams {
  bondYield: number;
  treasuryYield: number;
  swapRate: number;
  optionCost?: number;
  liquidityFactor?: number;
}

// ─── Output Types ───────────────────────────────────────────────────

export interface SpreadDecompositionResult {
  totalSpread: number;
  creditSpread: number;
  liquidityPremium: number;
  optionCost: number;
  residual: number;
  swapSpread: number;
}

// ─── Service ────────────────────────────────────────────────────────

@Injectable()
export class YieldSpreadDecompositionService {
  private readonly logger = new Logger(YieldSpreadDecompositionService.name);

  /**
   * Decompose the yield spread into credit, liquidity, option, and residual components.
   *
   * The credit spread is approximated as the portion of the total spread
   * exceeding the swap spread.  Liquidity premium is derived from the swap
   * spread scaled by a liquidity factor (default 0.4).
   */
  decomposeSpread(
    params: SpreadDecompositionParams,
  ): SpreadDecompositionResult {
    const {
      bondYield,
      treasuryYield,
      swapRate,
      optionCost = 0,
      liquidityFactor = 0.4,
    } = params;

    const totalSpread = bondYield - treasuryYield;
    const swapSpread = swapRate - treasuryYield;

    // Credit spread — portion above the swap spread
    const creditSpread = Math.max(0, totalSpread - swapSpread);

    // Liquidity premium — fraction of the swap spread
    const liquidityPremium = swapSpread * liquidityFactor;

    // Residual — everything not explained by the three components
    const residual = totalSpread - creditSpread - liquidityPremium - optionCost;

    this.logger.log(
      `Spread decomposition: total=${this.round6(totalSpread)}, credit=${this.round6(creditSpread)}, liquidity=${this.round6(liquidityPremium)}`,
    );

    return {
      totalSpread: this.round6(totalSpread),
      creditSpread: this.round6(creditSpread),
      liquidityPremium: this.round6(liquidityPremium),
      optionCost: this.round6(optionCost),
      residual: this.round6(residual),
      swapSpread: this.round6(swapSpread),
    };
  }

  /**
   * Decompose spreads for multiple bonds and return a summary.
   */
  decomposeMultiple(bonds: SpreadDecompositionParams[]): {
    decompositions: SpreadDecompositionResult[];
    averageCreditSpread: number;
    averageTotalSpread: number;
  } {
    if (bonds.length === 0) {
      throw new Error('At least one bond is required');
    }

    const decompositions = bonds.map((b) => this.decomposeSpread(b));

    const averageCreditSpread =
      decompositions.reduce((s, d) => s + d.creditSpread, 0) /
      decompositions.length;
    const averageTotalSpread =
      decompositions.reduce((s, d) => s + d.totalSpread, 0) /
      decompositions.length;

    return {
      decompositions,
      averageCreditSpread: this.round6(averageCreditSpread),
      averageTotalSpread: this.round6(averageTotalSpread),
    };
  }

  // ─── Private helpers ──────────────────────────────────────────────

  private round6(n: number): number {
    return Math.round(n * 1_000_000) / 1_000_000;
  }
}
