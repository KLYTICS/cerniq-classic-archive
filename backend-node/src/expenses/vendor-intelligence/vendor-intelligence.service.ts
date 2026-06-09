import { Injectable, Logger } from '@nestjs/common';
import { PR_VENDOR_PROFILES, VendorProfile } from './vendor-profiles';

// ── Types ──────────────────────────────────────────────────────────────────

export interface VendorMatch {
  profile: VendorProfile;
  institutionQuarterlyTotal: number;
  benchmarkMedian: number;
  /** Percentile rank within p25–p75 range. <0 means below p25, >100 means above p75 */
  percentileRank: number;
  assessment: 'BELOW_BENCHMARK' | 'WITHIN_BENCHMARK' | 'ABOVE_BENCHMARK';
  assessmentEs: 'POR DEBAJO' | 'DENTRO DEL RANGO' | 'POR ENCIMA';
}

export interface VendorReport {
  vendorName: string;
  transactionCount: number;
  quarterlyTotal: number;
  percentOfTotalSpend: number;
  match: VendorMatch | null;
  latestTransactionDate: Date;
}

/** Input expense shape — intentionally loose to accept different sources */
export interface VendorExpenseInput {
  merchantName: string;
  amount: number;
  transactionDate: Date;
}

// ── Service ────────────────────────────────────────────────────────────────

@Injectable()
export class VendorIntelligenceService {
  private readonly logger = new Logger(VendorIntelligenceService.name);

  /**
   * Fuzzy-match a vendor name against PR_VENDOR_PROFILES.
   * Returns null if no profile matches.
   */
  matchVendorProfile(
    vendorName: string,
    quarterlyTotal: number,
  ): VendorMatch | null {
    const nameLower = vendorName.trim().toLowerCase();

    for (const profile of PR_VENDOR_PROFILES) {
      const matched = profile.matchKeywords.some((kw) =>
        nameLower.includes(kw.toLowerCase()),
      );
      if (!matched) continue;

      const { p25, median, p75 } = profile.typicalQuarterlyRange;

      // Calculate percentile rank within the p25–p75 interquartile range
      let percentileRank: number;
      if (quarterlyTotal <= p25) {
        percentileRank =
          p75 !== p25 ? ((quarterlyTotal - p25) / (median - p25)) * 25 : 0;
      } else if (quarterlyTotal <= median) {
        percentileRank = 25 + ((quarterlyTotal - p25) / (median - p25)) * 25;
      } else if (quarterlyTotal <= p75) {
        percentileRank = 50 + ((quarterlyTotal - median) / (p75 - median)) * 25;
      } else {
        percentileRank =
          75 + ((quarterlyTotal - p75) / (p75 - median || 1)) * 25;
      }

      percentileRank = Math.round(percentileRank * 10) / 10;

      let assessment: VendorMatch['assessment'];
      let assessmentEs: VendorMatch['assessmentEs'];

      if (quarterlyTotal < p25) {
        assessment = 'BELOW_BENCHMARK';
        assessmentEs = 'POR DEBAJO';
      } else if (quarterlyTotal > p75) {
        assessment = 'ABOVE_BENCHMARK';
        assessmentEs = 'POR ENCIMA';
      } else {
        assessment = 'WITHIN_BENCHMARK';
        assessmentEs = 'DENTRO DEL RANGO';
      }

      return {
        profile,
        institutionQuarterlyTotal: quarterlyTotal,
        benchmarkMedian: median,
        percentileRank,
        assessment,
        assessmentEs,
      };
    }

    return null;
  }

  /**
   * Group expenses by vendor, calculate totals, match profiles,
   * and return sorted by spend (highest first).
   */
  generateVendorReport(expenses: VendorExpenseInput[]): VendorReport[] {
    if (expenses.length === 0) return [];

    // Group by normalized vendor name
    const vendorMap = new Map<
      string,
      {
        originalName: string;
        items: VendorExpenseInput[];
      }
    >();

    for (const e of expenses) {
      const key = e.merchantName.trim().toLowerCase();
      const existing = vendorMap.get(key);
      if (existing) {
        existing.items.push(e);
      } else {
        vendorMap.set(key, { originalName: e.merchantName, items: [e] });
      }
    }

    const totalSpend = expenses.reduce((s, e) => s + Number(e.amount), 0);

    const reports: VendorReport[] = [];

    for (const [, { originalName, items }] of vendorMap) {
      const quarterlyTotal = items.reduce((s, e) => s + Number(e.amount), 0);
      const latestTransactionDate = items.reduce(
        (latest, e) =>
          e.transactionDate > latest ? e.transactionDate : latest,
        items[0].transactionDate,
      );

      const match = this.matchVendorProfile(originalName, quarterlyTotal);

      reports.push({
        vendorName: originalName,
        transactionCount: items.length,
        quarterlyTotal: Math.round(quarterlyTotal * 100) / 100,
        percentOfTotalSpend:
          totalSpend > 0
            ? Math.round((quarterlyTotal / totalSpend) * 10000) / 100
            : 0,
        match,
        latestTransactionDate,
      });
    }

    // Sort by spend descending
    reports.sort((a, b) => b.quarterlyTotal - a.quarterlyTotal);

    this.logger.log(
      `Generated vendor report: ${reports.length} vendors, ` +
        `${reports.filter((r) => r.match).length} matched to profiles`,
    );

    return reports;
  }
}
