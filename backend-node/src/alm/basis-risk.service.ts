import { Injectable } from '@nestjs/common';

/** Basis Risk Analysis — Quant Model #76. Measures mismatch between asset and liability repricing indices. */
@Injectable()
export class BasisRiskService {
  analyze(params: { assetIndex: string; liabilityIndex: string; historicalSpread: number[]; currentSpread: number }): {
    meanSpread: number; spreadVol: number; currentVsHistorical: number; risk: 'low' | 'moderate' | 'high';
    interpretation: string; interpretationEs: string;
  } {
    const n = params.historicalSpread.length;
    const mean = params.historicalSpread.reduce((s, v) => s + v, 0) / n;
    const variance = params.historicalSpread.reduce((s, v) => s + (v - mean) ** 2, 0) / (n - 1);
    const vol = Math.sqrt(variance);
    const zScore = Math.abs((params.currentSpread - mean) / (vol || 1));
    const risk = zScore < 1 ? 'low' : zScore < 2 ? 'moderate' : 'high';
    return {
      meanSpread: +mean.toFixed(4), spreadVol: +vol.toFixed(4), currentVsHistorical: +zScore.toFixed(2), risk,
      interpretation: `Basis risk (${params.assetIndex} vs ${params.liabilityIndex}): ${risk}. Current spread ${(params.currentSpread * 10000).toFixed(0)}bps vs historical mean ${(mean * 10000).toFixed(0)}bps (${zScore.toFixed(1)}σ).`,
      interpretationEs: `Riesgo base (${params.assetIndex} vs ${params.liabilityIndex}): ${risk === 'low' ? 'bajo' : risk === 'moderate' ? 'moderado' : 'alto'}. Spread actual ${(params.currentSpread * 10000).toFixed(0)}pbs vs media historica ${(mean * 10000).toFixed(0)}pbs (${zScore.toFixed(1)}σ).`,
    };
  }
}
