import { Injectable, Logger } from '@nestjs/common';

/**
 * Wholesale Funding Concentration Analysis Engine — Quant Model
 *
 * Analyzes the concentration risk in wholesale funding sources using
 * the Herfindahl-Hirschman Index (HHI) and counterparty concentration
 * metrics.
 *
 * Key metrics:
 *   - HHI = sum of squared market shares (0 to 10,000)
 *   - Top counterparty percentage
 *   - Rollover risk (short-term maturity concentration)
 *   - Maturity profile distribution
 *   - Concentration classification: low | moderate | high
 *
 * HHI thresholds:
 *   - < 1,500: low concentration
 *   - 1,500–2,500: moderate concentration
 *   - > 2,500: high concentration
 */

// ─── Input Types ────────────────────────────────────────────────────

export interface FundingSource {
  counterparty: string;
  amount: number;
  maturity: number; // in months
  type: string;
}

export interface WholesaleFundingParams {
  fundingSources: FundingSource[];
}

// ─── Output Types ───────────────────────────────────────────────────

export interface MaturityBucket {
  bucket: string;
  amount: number;
  percentage: number;
  sourceCount: number;
}

export type ConcentrationLevel = 'low' | 'moderate' | 'high';

export interface WholesaleFundingResult {
  hhi: number;
  topCounterpartyPct: number;
  rolloverRisk: number;
  maturityProfile: MaturityBucket[];
  concentration: ConcentrationLevel;
  totalFunding: number;
  counterpartyCount: number;
}

// ─── Service ────────────────────────────────────────────────────────

@Injectable()
export class WholesaleFundingConcentrationService {
  private readonly logger = new Logger(
    WholesaleFundingConcentrationService.name,
  );

  /**
   * Analyze concentration risk in wholesale funding sources.
   *
   * Computes HHI across counterparties, identifies top counterparty
   * exposure, builds a maturity profile, and classifies overall
   * concentration risk.
   */
  analyzeConcentration(params: WholesaleFundingParams): WholesaleFundingResult {
    const { fundingSources } = params;

    if (fundingSources.length === 0) {
      throw new Error('At least one funding source is required');
    }

    const totalFunding = fundingSources.reduce((s, f) => s + f.amount, 0);

    // Aggregate by counterparty
    const counterpartyTotals = new Map<string, number>();
    for (const source of fundingSources) {
      const current = counterpartyTotals.get(source.counterparty) ?? 0;
      counterpartyTotals.set(source.counterparty, current + source.amount);
    }

    // HHI = sum of (market share in %)^2
    let hhi = 0;
    let maxCounterpartyAmount = 0;
    for (const [, amount] of counterpartyTotals) {
      const share = (amount / totalFunding) * 100;
      hhi += share * share;
      if (amount > maxCounterpartyAmount) {
        maxCounterpartyAmount = amount;
      }
    }

    const topCounterpartyPct =
      totalFunding > 0 ? maxCounterpartyAmount / totalFunding : 0;

    // Rollover risk — percentage of funding maturing within 30 days
    const shortTermFunding = fundingSources
      .filter((f) => f.maturity <= 1)
      .reduce((s, f) => s + f.amount, 0);
    const rolloverRisk = totalFunding > 0 ? shortTermFunding / totalFunding : 0;

    // Maturity profile
    const maturityBuckets = [
      { bucket: '0-1m', minMonths: 0, maxMonths: 1 },
      { bucket: '1-3m', minMonths: 1, maxMonths: 3 },
      { bucket: '3-6m', minMonths: 3, maxMonths: 6 },
      { bucket: '6-12m', minMonths: 6, maxMonths: 12 },
      { bucket: '12m+', minMonths: 12, maxMonths: Infinity },
    ];

    const maturityProfile: MaturityBucket[] = maturityBuckets.map((mb) => {
      const sources = fundingSources.filter(
        (f) => f.maturity > mb.minMonths && f.maturity <= mb.maxMonths,
      );
      // Special case for 0-1m bucket
      const bucketSources =
        mb.minMonths === 0
          ? fundingSources.filter(
              (f) => f.maturity >= 0 && f.maturity <= mb.maxMonths,
            )
          : sources;
      const amount = bucketSources.reduce((s, f) => s + f.amount, 0);

      return {
        bucket: mb.bucket,
        amount: this.round2(amount),
        percentage: this.round6(totalFunding > 0 ? amount / totalFunding : 0),
        sourceCount: bucketSources.length,
      };
    });

    const concentration = this.classifyConcentration(hhi);

    this.logger.log(
      `Funding concentration: HHI=${this.round2(hhi)}, topCP=${this.round6(topCounterpartyPct)}, concentration=${concentration}`,
    );

    return {
      hhi: this.round2(hhi),
      topCounterpartyPct: this.round6(topCounterpartyPct),
      rolloverRisk: this.round6(rolloverRisk),
      maturityProfile,
      concentration,
      totalFunding: this.round2(totalFunding),
      counterpartyCount: counterpartyTotals.size,
    };
  }

  /**
   * Identify single-name concentration breaches above a threshold.
   */
  identifyBreaches(
    params: WholesaleFundingParams,
    thresholdPct: number,
  ): {
    breaches: { counterparty: string; amount: number; percentage: number }[];
  } {
    const totalFunding = params.fundingSources.reduce(
      (s, f) => s + f.amount,
      0,
    );

    const counterpartyTotals = new Map<string, number>();
    for (const source of params.fundingSources) {
      const current = counterpartyTotals.get(source.counterparty) ?? 0;
      counterpartyTotals.set(source.counterparty, current + source.amount);
    }

    const breaches: {
      counterparty: string;
      amount: number;
      percentage: number;
    }[] = [];
    for (const [counterparty, amount] of counterpartyTotals) {
      const pct = totalFunding > 0 ? amount / totalFunding : 0;
      if (pct > thresholdPct) {
        breaches.push({
          counterparty,
          amount: this.round2(amount),
          percentage: this.round6(pct),
        });
      }
    }

    return { breaches: breaches.sort((a, b) => b.percentage - a.percentage) };
  }

  // ─── Private helpers ──────────────────────────────────────────────

  private classifyConcentration(hhi: number): ConcentrationLevel {
    if (hhi < 1_500) return 'low';
    if (hhi <= 2_500) return 'moderate';
    return 'high';
  }

  private round2(n: number): number {
    return Math.round(n * 100) / 100;
  }

  private round6(n: number): number {
    return Math.round(n * 1_000_000) / 1_000_000;
  }
}
