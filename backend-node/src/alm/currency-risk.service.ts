import { Injectable, Logger } from '@nestjs/common';

/**
 * Currency Risk Assessment Service
 *
 * Quantifies FX exposure across a multi-currency portfolio by
 * measuring total and net unhedged exposure, then estimating
 * potential loss under a 1 % adverse move in every cross rate.
 *
 * Key outputs:
 * - Total notional exposure across all non-base currencies
 * - Net unhedged exposure after accounting for hedge ratios
 * - Per-currency breakdown with individual risk contribution
 * - Potential loss assuming a 1 % uniform adverse FX shift
 * - Board-ready recommendation with hedging guidance
 */

// ─── Types ──────────────────────────────────────────────────────

export interface CurrencyPosition {
  currency: string;
  balance: number;
  hedgedPct: number;
}

export interface CurrencyRiskParams {
  positions: CurrencyPosition[];
  baseCurrency: string;
  exchangeRates: Record<string, number>;
}

export interface CurrencyExposureDetail {
  currency: string;
  balanceLocal: number;
  balanceBase: number;
  hedgedPct: number;
  unhedgedBase: number;
  riskContribution: number;
}

export interface CurrencyRiskResult {
  totalExposure: number;
  netUnhedgedExposure: number;
  byCurrency: CurrencyExposureDetail[];
  potentialLoss1Pct: number;
  recommendation: string;
}

// ─── Service ────────────────────────────────────────────────────

@Injectable()
export class CurrencyRiskService {
  private readonly logger = new Logger(CurrencyRiskService.name);

  /**
   * Assess currency risk across a portfolio of multi-currency positions.
   *
   * Exchange rates are expressed as units of foreign currency per one
   * unit of base currency (e.g. { EUR: 0.92 } means 1 USD = 0.92 EUR).
   */
  assessCurrencyRisk(params: CurrencyRiskParams): CurrencyRiskResult {
    const { positions, baseCurrency, exchangeRates } = params;
    this.logger.log(
      `Assessing currency risk for ${positions.length} positions (base: ${baseCurrency})`,
    );

    let totalExposure = 0;
    let netUnhedgedExposure = 0;
    const byCurrency: CurrencyExposureDetail[] = [];

    for (const pos of positions) {
      // Base-currency positions carry no FX risk
      if (pos.currency === baseCurrency) continue;

      const rate = exchangeRates[pos.currency];
      if (rate === undefined || rate === 0) {
        this.logger.warn(`No exchange rate for ${pos.currency} — skipping`);
        continue;
      }

      // Convert to base currency: balance_base = balance_local / rate
      const balanceBase = round2(pos.balance / rate);
      const hedgedPct = clamp(pos.hedgedPct, 0, 1);
      const unhedgedBase = round2(balanceBase * (1 - hedgedPct));

      totalExposure += balanceBase;
      netUnhedgedExposure += unhedgedBase;

      byCurrency.push({
        currency: pos.currency,
        balanceLocal: pos.balance,
        balanceBase,
        hedgedPct,
        unhedgedBase,
        riskContribution: 0, // filled below once totals are known
      });
    }

    totalExposure = round2(totalExposure);
    netUnhedgedExposure = round2(netUnhedgedExposure);

    // Risk contribution = share of unhedged exposure
    for (const detail of byCurrency) {
      detail.riskContribution =
        netUnhedgedExposure > 0
          ? round4(detail.unhedgedBase / netUnhedgedExposure)
          : 0;
    }

    // Potential loss assuming 1 % adverse move across all FX rates
    const potentialLoss1Pct = round2(netUnhedgedExposure * 0.01);

    const recommendation = buildRecommendation(
      netUnhedgedExposure,
      totalExposure,
      byCurrency,
    );

    return {
      totalExposure,
      netUnhedgedExposure,
      byCurrency,
      potentialLoss1Pct,
      recommendation,
    };
  }
}

// ─── Helpers ────────────────────────────────────────────────────

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}

function buildRecommendation(
  netUnhedged: number,
  totalExposure: number,
  byCurrency: CurrencyExposureDetail[],
): string {
  const ratio = totalExposure > 0 ? netUnhedged / totalExposure : 0;
  const topCurrency = [...byCurrency].sort(
    (a, b) => b.unhedgedBase - a.unhedgedBase,
  )[0];

  if (ratio < 0.1) {
    return 'Currency risk is well-hedged. Maintain current hedge ratios and monitor for drift.';
  }
  if (ratio < 0.3) {
    return `Moderate FX exposure (${(ratio * 100).toFixed(0)}% unhedged). Consider increasing hedge on ${topCurrency?.currency ?? 'largest position'}.`;
  }
  return `Elevated FX risk — ${(ratio * 100).toFixed(0)}% of exposure is unhedged. Immediate hedging action recommended, starting with ${topCurrency?.currency ?? 'largest position'}.`;
}
