import { Injectable, Logger } from '@nestjs/common';

/**
 * Funds Availability Analysis Service
 *
 * Assesses total available liquidity across three tiers of
 * immediacy — from cash and committed credit lines (Tier 1)
 * through liquid securities (Tier 2) to uncommitted and
 * expected inflows (Tier 3).
 *
 * Key outputs:
 * - Total available funds across all tiers
 * - Tier-level breakdown (1: immediate, 2: within days, 3: uncertain)
 * - Days of operating coverage at current burn rate
 * - Adequacy classification
 */

// ─── Types ──────────────────────────────────────────────────────

export interface FundsAvailabilityParams {
  reserves: number;
  committedLines: number;
  uncommittedLines: number;
  liquidSecurities: number;
  expectedInflows30d: number;
}

export type FundsAdequacy = 'STRONG' | 'ADEQUATE' | 'THIN' | 'CRITICAL';

export interface FundsAvailabilityResult {
  totalAvailable: number;
  tier1Available: number;
  tier2Available: number;
  tier3Available: number;
  daysOfCoverage: number;
  adequacy: FundsAdequacy;
}

// ─── Constants ──────────────────────────────────────────────────

/** Haircut on liquid securities when estimating availability */
const SECURITIES_HAIRCUT = 0.95;

/** Haircut on uncommitted lines (may not be honoured under stress) */
const UNCOMMITTED_HAIRCUT = 0.50;

/** Assumed daily operating burn as fraction of Tier 1 for coverage calc */
const DAILY_BURN_FRACTION = 0.01;

// ─── Service ────────────────────────────────────────────────────

@Injectable()
export class FundsAvailabilityService {
  private readonly logger = new Logger(FundsAvailabilityService.name);

  /**
   * Analyse funds availability across liquidity tiers.
   *
   * Tier 1 — immediately available: cash reserves + committed lines
   * Tier 2 — available within days: liquid securities (after haircut)
   * Tier 3 — uncertain / slower: uncommitted lines (hair-cut) + expected inflows
   */
  analyzeFundsAvailability(
    params: FundsAvailabilityParams,
  ): FundsAvailabilityResult {
    const {
      reserves,
      committedLines,
      uncommittedLines,
      liquidSecurities,
      expectedInflows30d,
    } = params;
    this.logger.log('Analyzing funds availability across liquidity tiers');

    const tier1Available = round2(reserves + committedLines);
    const tier2Available = round2(liquidSecurities * SECURITIES_HAIRCUT);
    const tier3Available = round2(
      uncommittedLines * UNCOMMITTED_HAIRCUT + expectedInflows30d,
    );
    const totalAvailable = round2(
      tier1Available + tier2Available + tier3Available,
    );

    // Days of coverage based on assumed daily burn
    const dailyBurn = tier1Available * DAILY_BURN_FRACTION || 1;
    const daysOfCoverage = Math.floor(totalAvailable / dailyBurn);

    const adequacy = classifyAdequacy(daysOfCoverage);

    return {
      totalAvailable,
      tier1Available,
      tier2Available,
      tier3Available,
      daysOfCoverage,
      adequacy,
    };
  }
}

// ─── Helpers ────────────────────────────────────────────────────

function classifyAdequacy(days: number): FundsAdequacy {
  if (days >= 180) return 'STRONG';
  if (days >= 90) return 'ADEQUATE';
  if (days >= 30) return 'THIN';
  return 'CRITICAL';
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
