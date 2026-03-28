import { Injectable } from '@nestjs/common';

/**
 * Modified Duration Matching (Immunization) — Quant Model #56
 *
 * Portfolio immunization strategy: match asset and liability durations
 * to minimize EVE sensitivity to parallel rate shifts.
 *
 * Target: D_assets × MV_assets = D_liabilities × MV_liabilities
 * Gap: Duration gap = D_A - (L/A) × D_L
 */
@Injectable()
export class ModifiedDurationMatchingService {
  immunize(params: {
    assets: Array<{
      name: string;
      mv: number;
      duration: number;
      convexity: number;
    }>;
    liabilities: Array<{
      name: string;
      mv: number;
      duration: number;
      convexity: number;
    }>;
  }): {
    durationGap: number;
    dollarDurationGap: number;
    convexityGap: number;
    recommendations: Array<{
      action: string;
      actionEs: string;
      impact: number;
    }>;
    eveImpact: Array<{ shock: number; evePctChange: number }>;
    interpretation: string;
    interpretationEs: string;
  } {
    const totalAssetsMV = params.assets.reduce((s, a) => s + a.mv, 0);
    const totalLiabMV = params.liabilities.reduce((s, l) => s + l.mv, 0);
    const equity = totalAssetsMV - totalLiabMV;

    const assetDuration =
      params.assets.reduce((s, a) => s + a.duration * a.mv, 0) / totalAssetsMV;
    const liabDuration =
      params.liabilities.reduce((s, l) => s + l.duration * l.mv, 0) /
      totalLiabMV;
    const leverageRatio = totalLiabMV / totalAssetsMV;
    const durationGap = assetDuration - leverageRatio * liabDuration;
    const dollarDurationGap = durationGap * totalAssetsMV;

    const assetConvexity =
      params.assets.reduce((s, a) => s + a.convexity * a.mv, 0) / totalAssetsMV;
    const liabConvexity =
      params.liabilities.reduce((s, l) => s + l.convexity * l.mv, 0) /
      totalLiabMV;
    const convexityGap = assetConvexity - leverageRatio * liabConvexity;

    const eveImpact = [-200, -100, -50, 50, 100, 200].map((bps) => {
      const dy = bps / 10000;
      const evePctChange =
        ((-durationGap * dy + 0.5 * convexityGap * dy * dy) * 100) /
        ((equity / totalAssetsMV) * 100);
      return { shock: bps, evePctChange: +evePctChange.toFixed(2) };
    });

    const recommendations = [];
    if (Math.abs(durationGap) > 1) {
      recommendations.push({
        action:
          durationGap > 0
            ? 'Reduce asset duration or extend liability duration'
            : 'Extend asset duration or reduce liability duration',
        actionEs:
          durationGap > 0
            ? 'Reducir duracion de activos o extender duracion de pasivos'
            : 'Extender duracion de activos o reducir duracion de pasivos',
        impact: +(Math.abs(durationGap) * totalAssetsMV * 0.0001).toFixed(0),
      });
    }

    return {
      durationGap: +durationGap.toFixed(3),
      dollarDurationGap: +dollarDurationGap.toFixed(0),
      convexityGap: +convexityGap.toFixed(3),
      recommendations,
      eveImpact,
      interpretation: `Duration gap: ${durationGap.toFixed(2)} years. ${Math.abs(durationGap) < 0.5 ? 'Well immunized.' : `Exposed to ${durationGap > 0 ? 'rising' : 'falling'} rates.`}`,
      interpretationEs: `Brecha de duracion: ${durationGap.toFixed(2)} anos. ${Math.abs(durationGap) < 0.5 ? 'Bien inmunizado.' : `Expuesto a tasas ${durationGap > 0 ? 'en alza' : 'en baja'}.`}`,
    };
  }
}
