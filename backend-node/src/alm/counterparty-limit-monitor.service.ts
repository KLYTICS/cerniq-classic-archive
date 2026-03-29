import { Injectable, Logger } from '@nestjs/common';

/**
 * Counterparty Limit Monitor Service
 *
 * Checks each counterparty's current exposure against its approved
 * limit, flagging breaches (> 100 %) and warnings (> 80 %).
 *
 * Key outputs:
 * - List of limit breaches with utilisation percentage
 * - Warning-level exposures approaching the limit
 * - Overall compliance flag
 * - Aggregate total exposure across all counterparties
 */

// ─── Types ──────────────────────────────────────────────────────

export interface CounterpartyExposure {
  counterparty: string;
  amount: number;
  limit: number;
  rating: string;
}

export interface CounterpartyLimitParams {
  exposures: CounterpartyExposure[];
}

export interface LimitBreach {
  counterparty: string;
  exposure: number;
  limit: number;
  utilization: number;
}

export interface CounterpartyLimitResult {
  breaches: LimitBreach[];
  warnings: LimitBreach[];
  compliant: boolean;
  totalExposure: number;
}

// ─── Constants ──────────────────────────────────────────────────

const BREACH_THRESHOLD = 1.0; // 100 % utilisation
const WARNING_THRESHOLD = 0.8; // 80 % utilisation

// ─── Service ────────────────────────────────────────────────────

@Injectable()
export class CounterpartyLimitMonitorService {
  private readonly logger = new Logger(CounterpartyLimitMonitorService.name);

  /**
   * Check counterparty exposures against approved limits.
   *
   * Utilisation = exposure / limit.
   * Breach when utilisation > 100 %. Warning when > 80 %.
   */
  checkLimits(params: CounterpartyLimitParams): CounterpartyLimitResult {
    const { exposures } = params;
    this.logger.log(`Checking limits for ${exposures.length} counterparties`);

    const breaches: LimitBreach[] = [];
    const warnings: LimitBreach[] = [];
    let totalExposure = 0;

    for (const cp of exposures) {
      totalExposure += cp.amount;
      const utilization =
        cp.limit > 0
          ? round4(cp.amount / cp.limit)
          : cp.amount > 0
            ? Infinity
            : 0;

      const entry: LimitBreach = {
        counterparty: cp.counterparty,
        exposure: cp.amount,
        limit: cp.limit,
        utilization,
      };

      if (utilization > BREACH_THRESHOLD) {
        breaches.push(entry);
      } else if (utilization > WARNING_THRESHOLD) {
        warnings.push(entry);
      }
    }

    // Sort breaches and warnings by utilisation descending
    breaches.sort((a, b) => b.utilization - a.utilization);
    warnings.sort((a, b) => b.utilization - a.utilization);

    return {
      breaches,
      warnings,
      compliant: breaches.length === 0,
      totalExposure: round2(totalExposure),
    };
  }

  /**
   * Compute the aggregate utilisation across all counterparties.
   */
  aggregateUtilization(params: CounterpartyLimitParams): number {
    const totalExposure = params.exposures.reduce((s, e) => s + e.amount, 0);
    const totalLimit = params.exposures.reduce((s, e) => s + e.limit, 0);
    return totalLimit > 0 ? round4(totalExposure / totalLimit) : 0;
  }
}

// ─── Helpers ────────────────────────────────────────────────────

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}
