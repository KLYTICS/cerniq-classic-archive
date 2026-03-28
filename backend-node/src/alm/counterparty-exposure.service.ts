import { Injectable } from '@nestjs/common';
/** Counterparty Exposure — Quant Model #79. Single-name and sector exposure limits. */
@Injectable()
export class CounterpartyExposureService {
  analyze(
    counterparties: Array<{
      name: string;
      exposure: number;
      sector: string;
      rating?: string;
    }>,
    totalAssets: number,
  ): {
    counterparties: Array<{
      name: string;
      exposure: number;
      pctOfAssets: number;
      sector: string;
      flag: boolean;
    }>;
    topConcentrations: Array<{ name: string; pct: number }>;
    sectorConcentrations: Record<string, number>;
    interpretation: string;
    interpretationEs: string;
  } {
    const enriched = counterparties
      .map((c) => ({
        ...c,
        pctOfAssets: +((c.exposure / totalAssets) * 100).toFixed(2),
        flag: c.exposure / totalAssets > 0.05,
      }))
      .sort((a, b) => b.exposure - a.exposure);
    const sectors: Record<string, number> = {};
    enriched.forEach((c) => {
      sectors[c.sector] = (sectors[c.sector] || 0) + c.pctOfAssets;
    });
    return {
      counterparties: enriched,
      topConcentrations: enriched
        .slice(0, 5)
        .map((c) => ({ name: c.name, pct: c.pctOfAssets })),
      sectorConcentrations: sectors,
      interpretation: `${enriched.filter((c) => c.flag).length} counterparties exceed 5% of assets. Largest: ${enriched[0]?.name} at ${enriched[0]?.pctOfAssets}%.`,
      interpretationEs: `${enriched.filter((c) => c.flag).length} contrapartes exceden 5% de activos. Mayor: ${enriched[0]?.name} al ${enriched[0]?.pctOfAssets}%.`,
    };
  }
}
