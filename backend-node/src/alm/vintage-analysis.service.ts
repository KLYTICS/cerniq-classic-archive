import { Injectable } from '@nestjs/common';

/** Loan Vintage Analysis — Quant Model #77. Tracks loss performance by origination cohort for CECL. */
@Injectable()
export class VintageAnalysisService {
  analyze(
    vintages: Array<{
      year: number;
      originalBalance: number;
      currentBalance: number;
      cumulativeLoss: number;
      delinquent: number;
    }>,
  ): {
    vintages: Array<{
      year: number;
      originalBalance: number;
      currentBalance: number;
      lossRate: number;
      delinquencyRate: number;
      seasoning: number;
    }>;
    worstVintage: number;
    bestVintage: number;
    avgLossRate: number;
    interpretation: string;
    interpretationEs: string;
  } {
    const currentYear = new Date().getFullYear();
    const enriched = vintages.map((v) => ({
      ...v,
      lossRate: +((v.cumulativeLoss / v.originalBalance) * 100).toFixed(2),
      delinquencyRate: +((v.delinquent / v.currentBalance) * 100).toFixed(2),
      seasoning: currentYear - v.year,
    }));
    const worst = enriched.reduce((w, v) => (v.lossRate > w.lossRate ? v : w));
    const best = enriched.reduce((b, v) => (v.lossRate < b.lossRate ? v : b));
    const avg = +(
      enriched.reduce((s, v) => s + v.lossRate, 0) / enriched.length
    ).toFixed(2);

    return {
      vintages: enriched,
      worstVintage: worst.year,
      bestVintage: best.year,
      avgLossRate: avg,
      interpretation: `Worst vintage: ${worst.year} (${worst.lossRate}% loss). Best: ${best.year} (${best.lossRate}%). Avg: ${avg}%.`,
      interpretationEs: `Peor cosecha: ${worst.year} (${worst.lossRate}% perdida). Mejor: ${best.year} (${best.lossRate}%). Promedio: ${avg}%.`,
    };
  }
}
