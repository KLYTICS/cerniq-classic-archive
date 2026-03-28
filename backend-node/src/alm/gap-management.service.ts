import { Injectable, Logger } from '@nestjs/common';

/**
 * Gap Management Engine — Quant Model
 *
 * Performs repricing gap analysis across user-defined time buckets to
 * quantify interest-rate risk from maturity / repricing mismatches.
 *
 * For each bucket the engine computes:
 *   - Asset repricing volume
 *   - Liability repricing volume
 *   - Period gap = Asset repricing - Liability repricing
 *   - Cumulative gap (running total)
 *   - NII sensitivity = Gap × rate shock (default 100bps)
 *
 * Standard regulatory buckets: 0-30d, 31-90d, 91-180d, 181d-1y, 1-3y, 3-5y, 5y+
 */

// ─── Input Types ────────────────────────────────────────────────────

export interface RepricingAsset {
  name: string;
  balance: number;
  repricingBucket: string;
}

export interface RepricingLiability {
  name: string;
  balance: number;
  repricingBucket: string;
}

export interface GapManagementParams {
  assets: RepricingAsset[];
  liabilities: RepricingLiability[];
  repricingBuckets: string[];
  shockBps?: number;
}

// ─── Output Types ───────────────────────────────────────────────────

export interface BucketResult {
  period: string;
  assetRepricing: number;
  liabilityRepricing: number;
  gap: number;
  cumulativeGap: number;
  sensitivity: number;
}

export interface GapManagementResult {
  buckets: BucketResult[];
  totalAssets: number;
  totalLiabilities: number;
  totalGap: number;
  largestGapBucket: string;
}

// ─── Service ────────────────────────────────────────────────────────

@Injectable()
export class GapManagementService {
  private readonly logger = new Logger(GapManagementService.name);

  /**
   * Analyze repricing gap across time buckets.
   *
   * Groups assets and liabilities by their repricing bucket, computes
   * period and cumulative gaps, and estimates NII sensitivity under a
   * parallel rate shock (default 100 bps).
   */
  analyzeGap(params: GapManagementParams): GapManagementResult {
    const { assets, liabilities, repricingBuckets, shockBps = 100 } = params;

    if (repricingBuckets.length === 0) {
      throw new Error('At least one repricing bucket is required');
    }

    const shockDecimal = shockBps / 10_000;
    let cumulativeGap = 0;
    let largestGap = 0;
    let largestGapBucket = repricingBuckets[0];

    const buckets: BucketResult[] = repricingBuckets.map((period) => {
      const assetRepricing = assets
        .filter((a) => a.repricingBucket === period)
        .reduce((s, a) => s + a.balance, 0);

      const liabilityRepricing = liabilities
        .filter((l) => l.repricingBucket === period)
        .reduce((s, l) => s + l.balance, 0);

      const gap = assetRepricing - liabilityRepricing;
      cumulativeGap += gap;
      const sensitivity = gap * shockDecimal;

      if (Math.abs(gap) > Math.abs(largestGap)) {
        largestGap = gap;
        largestGapBucket = period;
      }

      return {
        period,
        assetRepricing: this.round2(assetRepricing),
        liabilityRepricing: this.round2(liabilityRepricing),
        gap: this.round2(gap),
        cumulativeGap: this.round2(cumulativeGap),
        sensitivity: this.round2(sensitivity),
      };
    });

    const totalAssets = assets.reduce((s, a) => s + a.balance, 0);
    const totalLiabilities = liabilities.reduce((s, l) => s + l.balance, 0);

    this.logger.log(
      `Gap analysis complete: ${buckets.length} buckets, totalGap=${this.round2(totalAssets - totalLiabilities)}`,
    );

    return {
      buckets,
      totalAssets: this.round2(totalAssets),
      totalLiabilities: this.round2(totalLiabilities),
      totalGap: this.round2(totalAssets - totalLiabilities),
      largestGapBucket,
    };
  }

  /**
   * Generate the standard regulatory repricing buckets used by
   * COSSEC / NCUA / FDIC for interest-rate risk reporting.
   */
  standardBuckets(): string[] {
    return ['0-30d', '31-90d', '91-180d', '181d-1y', '1-3y', '3-5y', '5y+'];
  }

  // ─── Private helpers ──────────────────────────────────────────────

  private round2(n: number): number {
    return Math.round(n * 100) / 100;
  }
}
