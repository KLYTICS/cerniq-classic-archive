import { Injectable } from '@nestjs/common';

/**
 * Funding Concentration Risk — Quant Model #70
 *
 * Analyzes dependence on individual funding sources.
 * Flags single-source risk: any depositor >5% of total funding
 * is a concentration risk per COSSEC/NCUA guidance.
 *
 * MILESTONE: 70th quant model in CERNIQ.
 */
@Injectable()
export class FundingConcentrationService {
  analyze(params: {
    fundingSources: Array<{
      name: string;
      nameEs: string;
      amount: number;
      type: 'retail' | 'wholesale' | 'government' | 'brokered';
    }>;
    totalFunding: number;
  }): {
    concentrationFlags: Array<{
      source: string;
      sourceEs: string;
      amount: number;
      pct: number;
      flag: string;
      flagEs: string;
    }>;
    retailPct: number;
    wholesalePct: number;
    brokeredPct: number;
    largestSourcePct: number;
    diversificationScore: number; // 0-100
    interpretation: string;
    interpretationEs: string;
  } {
    const { fundingSources, totalFunding } = params;
    const enriched = fundingSources
      .map((s) => ({ ...s, pct: (s.amount / totalFunding) * 100 }))
      .sort((a, b) => b.pct - a.pct);

    const flags = enriched
      .filter((s) => s.pct > 5)
      .map((s) => ({
        source: s.name,
        sourceEs: s.nameEs,
        amount: s.amount,
        pct: +s.pct.toFixed(1),
        flag: s.pct > 10 ? 'HIGH concentration risk' : 'Moderate concentration',
        flagEs:
          s.pct > 10
            ? 'ALTO riesgo de concentracion'
            : 'Concentracion moderada',
      }));

    const byType = { retail: 0, wholesale: 0, government: 0, brokered: 0 };
    enriched.forEach((s) => {
      byType[s.type] += s.pct;
    });

    const hhi = enriched.reduce((s, src) => s + (src.pct / 100) ** 2, 0);
    const diversificationScore = Math.round(
      Math.max(0, Math.min(100, (1 - hhi) * 120)),
    );

    return {
      concentrationFlags: flags,
      retailPct: +byType.retail.toFixed(1),
      wholesalePct: +byType.wholesale.toFixed(1),
      brokeredPct: +byType.brokered.toFixed(1),
      largestSourcePct: +enriched[0]?.pct?.toFixed(1) || 0,
      diversificationScore,
      interpretation: `${flags.length} concentration flags. Largest source: ${enriched[0]?.name} at ${enriched[0]?.pct.toFixed(1)}%. Retail: ${byType.retail.toFixed(0)}%, Wholesale: ${byType.wholesale.toFixed(0)}%. Diversification: ${diversificationScore}/100.`,
      interpretationEs: `${flags.length} alertas de concentracion. Mayor fuente: ${enriched[0]?.nameEs} al ${enriched[0]?.pct.toFixed(1)}%. Minorista: ${byType.retail.toFixed(0)}%, Mayorista: ${byType.wholesale.toFixed(0)}%. Diversificacion: ${diversificationScore}/100.`,
    };
  }
}
