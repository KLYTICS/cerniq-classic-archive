import { Injectable, Logger } from '@nestjs/common';

/**
 * Interest Income Decomposition Service — Quant Model #53
 *
 * Decomposes changes in NII into volume, rate, and mix effects.
 * Answers: "Why did NII change?" — was it more loans, higher rates, or shift in mix?
 *
 * ΔI = ΔV×R₀ + V₀×ΔR + ΔV×ΔR (volume + rate + interaction)
 *
 * Critical for ALCO meetings and board reporting.
 */

export interface IncomeDecompositionResult {
  totalNIIChange: number;
  volumeEffect: number;
  rateEffect: number;
  mixEffect: number;
  interactionEffect: number;
  segments: Array<{
    name: string; nameEs: string;
    prevBalance: number; currBalance: number;
    prevRate: number; currRate: number;
    prevIncome: number; currIncome: number;
    volumeContrib: number; rateContrib: number; mixContrib: number;
  }>;
  interpretation: string;
  interpretationEs: string;
}

@Injectable()
export class InterestIncomeDecompositionService {
  private readonly logger = new Logger(InterestIncomeDecompositionService.name);

  decompose(params: {
    segments: Array<{
      name: string; nameEs: string;
      prevBalance: number; currBalance: number;
      prevRate: number; currRate: number;
    }>;
  }): IncomeDecompositionResult {
    const { segments: segParams } = params;

    let totalVolumeEffect = 0;
    let totalRateEffect = 0;
    let totalMixEffect = 0;

    const segments = segParams.map(s => {
      const prevIncome = s.prevBalance * s.prevRate;
      const currIncome = s.currBalance * s.currRate;
      const deltaV = s.currBalance - s.prevBalance;
      const deltaR = s.currRate - s.prevRate;

      const volumeContrib = deltaV * s.prevRate;
      const rateContrib = s.prevBalance * deltaR;
      const mixContrib = deltaV * deltaR;

      totalVolumeEffect += volumeContrib;
      totalRateEffect += rateContrib;
      totalMixEffect += mixContrib;

      return { ...s, prevIncome, currIncome, volumeContrib, rateContrib, mixContrib };
    });

    const totalChange = totalVolumeEffect + totalRateEffect + totalMixEffect;

    return {
      totalNIIChange: +totalChange.toFixed(2),
      volumeEffect: +totalVolumeEffect.toFixed(2),
      rateEffect: +totalRateEffect.toFixed(2),
      mixEffect: +totalMixEffect.toFixed(2),
      interactionEffect: +totalMixEffect.toFixed(2),
      segments,
      interpretation: `NII changed by $${(totalChange / 1e6).toFixed(1)}M. Volume effect: $${(totalVolumeEffect / 1e6).toFixed(1)}M, Rate effect: $${(totalRateEffect / 1e6).toFixed(1)}M, Mix: $${(totalMixEffect / 1e6).toFixed(1)}M.`,
      interpretationEs: `NII cambio en $${(totalChange / 1e6).toFixed(1)}M. Efecto volumen: $${(totalVolumeEffect / 1e6).toFixed(1)}M, Efecto tasa: $${(totalRateEffect / 1e6).toFixed(1)}M, Mezcla: $${(totalMixEffect / 1e6).toFixed(1)}M.`,
    };
  }
}
