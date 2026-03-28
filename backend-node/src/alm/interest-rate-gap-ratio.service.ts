import { Injectable } from '@nestjs/common';
/** Interest Rate Gap Ratio — Quant Model #81. Gap/Assets ratio by time bucket. */
@Injectable()
export class InterestRateGapRatioService {
  calculate(params: {
    repricingAssets: number[];
    repricingLiabilities: number[];
    totalAssets: number;
    bucketLabels: string[];
  }): {
    buckets: Array<{
      label: string;
      gap: number;
      gapRatio: number;
      cumGapRatio: number;
    }>;
    maxGapRatio: number;
    interpretation: string;
    interpretationEs: string;
  } {
    let cumGap = 0;
    const buckets = params.bucketLabels.map((label, i) => {
      const gap =
        (params.repricingAssets[i] || 0) -
        (params.repricingLiabilities[i] || 0);
      cumGap += gap;
      return {
        label,
        gap,
        gapRatio: +((gap / params.totalAssets) * 100).toFixed(2),
        cumGapRatio: +((cumGap / params.totalAssets) * 100).toFixed(2),
      };
    });
    const maxGap = buckets.reduce(
      (m, b) => (Math.abs(b.cumGapRatio) > Math.abs(m) ? b.cumGapRatio : m),
      0,
    );
    return {
      buckets,
      maxGapRatio: maxGap,
      interpretation: `Max cumulative gap ratio: ${maxGap}% of assets. ${Math.abs(maxGap) < 5 ? 'Well managed.' : 'Significant repricing mismatch.'}`,
      interpretationEs: `Ratio gap acumulado max: ${maxGap}% de activos. ${Math.abs(maxGap) < 5 ? 'Bien gestionado.' : 'Descalce de repricing significativo.'}`,
    };
  }
}
