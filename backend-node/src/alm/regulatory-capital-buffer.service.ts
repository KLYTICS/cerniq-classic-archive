import { Injectable } from '@nestjs/common';

/**
 * Regulatory Capital Buffer Analysis — Quant Model #69
 *
 * Calculates capital buffers and runway under stress.
 * How many quarters of losses before breaching minimum ratios?
 */
@Injectable()
export class RegulatoryCapitalBufferService {
  analyze(params: {
    capitalRatio: number;
    minimumRatio: number;
    totalAssets: number;
    quarterlyEarnings: number;
    stressedLossRate: number;
  }): {
    currentBuffer: number;
    bufferDollars: number;
    runwayQuarters: number;
    burnRate: number;
    breakEvenLoss: number;
    interpretation: string;
    interpretationEs: string;
  } {
    const {
      capitalRatio,
      minimumRatio,
      totalAssets,
      quarterlyEarnings,
      stressedLossRate,
    } = params;
    const buffer = capitalRatio - minimumRatio;
    const bufferDollars = (buffer / 100) * totalAssets;
    const quarterlyLoss = ((stressedLossRate / 100) * totalAssets) / 4;
    const netQuarterlyBurn = quarterlyLoss - quarterlyEarnings;
    const runwayQuarters =
      netQuarterlyBurn > 0 ? Math.floor(bufferDollars / netQuarterlyBurn) : 99;
    const breakEvenLoss = (quarterlyEarnings / totalAssets) * 400;

    return {
      currentBuffer: +buffer.toFixed(2),
      bufferDollars: +bufferDollars.toFixed(0),
      runwayQuarters,
      burnRate: +netQuarterlyBurn.toFixed(0),
      breakEvenLoss: +breakEvenLoss.toFixed(2),
      interpretation: `Capital buffer: ${buffer.toFixed(1)}% ($${(bufferDollars / 1e6).toFixed(0)}M). Under stress (${stressedLossRate}% loss rate), runway: ${runwayQuarters} quarters before breaching ${minimumRatio}% minimum.`,
      interpretationEs: `Colchon de capital: ${buffer.toFixed(1)}% ($${(bufferDollars / 1e6).toFixed(0)}M). Bajo estres (${stressedLossRate}% tasa de perdida), pista: ${runwayQuarters} trimestres antes de violar minimo de ${minimumRatio}%.`,
    };
  }
}
