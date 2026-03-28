import { Injectable, Logger } from '@nestjs/common';

/**
 * Real-Rate / Inflation Decomposition Service
 *
 * Decomposes a nominal interest rate into its real-rate and
 * inflation components using the Fisher equation:
 *
 *   nominal ≈ realRate + expectedInflation + inflationRiskPremium
 *
 * Key outputs:
 * - Real rate (Fisher decomposition)
 * - Breakeven inflation rate (nominal − real)
 * - Inflation risk premium pass-through
 * - TIPS allocation suggestion based on breakeven level
 */

// ─── Types ──────────────────────────────────────────────────────

export interface RealRateParams {
  nominalRate: number;
  inflationExpectation: number;
  inflationRiskPremium: number;
}

export interface RealRateResult {
  realRate: number;
  breakeven: number;
  inflationRiskPremium: number;
  tipsSuggestion: string;
}

// ─── Service ────────────────────────────────────────────────────

@Injectable()
export class RealRateInflationService {
  private readonly logger = new Logger(RealRateInflationService.name);

  /**
   * Decompose a nominal rate into real rate and inflation components.
   *
   * Uses the Fisher identity:
   *   realRate = nominalRate − inflationExpectation − inflationRiskPremium
   *   breakeven = nominalRate − realRate
   *
   * Rates are expressed as decimals (e.g. 0.05 = 5 %).
   */
  decomposeRealRate(params: RealRateParams): RealRateResult {
    const { nominalRate, inflationExpectation, inflationRiskPremium } = params;
    this.logger.log(
      `Decomposing nominal rate ${(nominalRate * 100).toFixed(2)}%`,
    );

    const realRate = round6(
      nominalRate - inflationExpectation - inflationRiskPremium,
    );
    const breakeven = round6(nominalRate - realRate);
    const tipsSuggestion = buildTipsSuggestion(breakeven, inflationExpectation);

    return {
      realRate,
      breakeven,
      inflationRiskPremium,
      tipsSuggestion,
    };
  }

  /**
   * Batch-decompose an array of rate scenarios for sensitivity analysis.
   */
  batchDecompose(scenarios: RealRateParams[]): RealRateResult[] {
    this.logger.log(`Batch decomposition of ${scenarios.length} scenarios`);
    return scenarios.map((s) => this.decomposeRealRate(s));
  }
}

// ─── Helpers ────────────────────────────────────────────────────

function round6(n: number): number {
  return Math.round(n * 1_000_000) / 1_000_000;
}

function buildTipsSuggestion(
  breakeven: number,
  inflationExpectation: number,
): string {
  if (breakeven > inflationExpectation + 0.005) {
    return 'Breakeven exceeds inflation expectations — TIPS appear cheap. Consider increasing TIPS allocation.';
  }
  if (breakeven < inflationExpectation - 0.005) {
    return 'Breakeven is below inflation expectations — TIPS appear rich. Favor nominal bonds.';
  }
  return 'Breakeven is in line with inflation expectations — TIPS are fairly valued. Maintain current allocation.';
}
