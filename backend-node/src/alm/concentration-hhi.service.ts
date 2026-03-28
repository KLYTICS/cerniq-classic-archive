import { Injectable } from '@nestjs/common';

/**
 * Herfindahl-Hirschman Index (HHI) Concentration — Quant Model #64
 *
 * Measures portfolio concentration across segments.
 * HHI = Σ(s_i²) where s_i = market share of segment i (as decimal)
 * Range: 1/N (perfect diversification) to 1 (single segment)
 * Scaled: 0-10,000 when using percentages
 *
 * <1,500 = unconcentrated, 1,500-2,500 = moderate, >2,500 = highly concentrated
 */
@Injectable()
export class ConcentrationHHIService {
  calculate(
    segments: Array<{ name: string; nameEs: string; balance: number }>,
  ): {
    hhi: number;
    hhiScaled: number;
    classification: string;
    classificationEs: string;
    effectiveSegments: number; // 1/HHI — equivalent number of equal segments
    segments: Array<{
      name: string;
      nameEs: string;
      balance: number;
      share: number;
      contribution: number;
    }>;
    interpretation: string;
    interpretationEs: string;
  } {
    const total = segments.reduce((s, seg) => s + seg.balance, 0);
    const enriched = segments
      .map((seg) => {
        const share = seg.balance / total;
        return {
          ...seg,
          share: +share.toFixed(4),
          contribution: +(share * share * 10000).toFixed(1),
        };
      })
      .sort((a, b) => b.share - a.share);

    const hhi = enriched.reduce((s, seg) => s + seg.share * seg.share, 0);
    const hhiScaled = +(hhi * 10000).toFixed(0);
    const effectiveSegments = +(1 / hhi).toFixed(1);
    const classification =
      hhiScaled < 1500
        ? 'Unconcentrated'
        : hhiScaled < 2500
          ? 'Moderately concentrated'
          : 'Highly concentrated';
    const classificationEs =
      hhiScaled < 1500
        ? 'No concentrado'
        : hhiScaled < 2500
          ? 'Moderadamente concentrado'
          : 'Altamente concentrado';

    return {
      hhi: +hhi.toFixed(6),
      hhiScaled,
      classification,
      classificationEs,
      effectiveSegments,
      segments: enriched,
      interpretation: `HHI: ${hhiScaled} (${classification}). Effective segments: ${effectiveSegments}. Top segment: ${enriched[0]?.name} at ${(enriched[0]?.share * 100).toFixed(1)}%.`,
      interpretationEs: `HHI: ${hhiScaled} (${classificationEs}). Segmentos efectivos: ${effectiveSegments}. Mayor segmento: ${enriched[0]?.nameEs} al ${(enriched[0]?.share * 100).toFixed(1)}%.`,
    };
  }
}
