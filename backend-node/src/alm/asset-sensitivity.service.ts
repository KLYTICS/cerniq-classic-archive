import { Injectable } from '@nestjs/common';

/**
 * Asset/Liability Sensitivity Classification — Quant Model #58
 *
 * Classifies the institution as asset-sensitive or liability-sensitive
 * based on repricing characteristics. Key ALCO metric.
 *
 * Asset-sensitive: NII increases when rates rise (more assets reprice)
 * Liability-sensitive: NII decreases when rates rise (more liabilities reprice)
 */
@Injectable()
export class AssetSensitivityService {
  classify(params: {
    assetsRepricingWithin1Y: number;
    liabilitiesRepricingWithin1Y: number;
    totalAssets: number;
    totalLiabilities: number;
    floatingRateAssets: number;
    floatingRateLiabilities: number;
  }): {
    classification: 'asset-sensitive' | 'liability-sensitive' | 'neutral';
    repricingGapRatio: number;
    niiImpactUp100: number;
    niiImpactDown100: number;
    floatingRateRatio: { assets: number; liabilities: number };
    interpretation: string;
    interpretationEs: string;
  } {
    const { assetsRepricingWithin1Y, liabilitiesRepricingWithin1Y, totalAssets, totalLiabilities, floatingRateAssets, floatingRateLiabilities } = params;

    const repricingGap = assetsRepricingWithin1Y - liabilitiesRepricingWithin1Y;
    const repricingGapRatio = repricingGap / totalAssets;
    const classification = repricingGapRatio > 0.02 ? 'asset-sensitive' : repricingGapRatio < -0.02 ? 'liability-sensitive' : 'neutral';

    const niiImpactUp100 = repricingGap * 0.01; // +100bps
    const niiImpactDown100 = -repricingGap * 0.01;

    return {
      classification,
      repricingGapRatio: +(repricingGapRatio * 100).toFixed(2),
      niiImpactUp100: +niiImpactUp100.toFixed(0),
      niiImpactDown100: +niiImpactDown100.toFixed(0),
      floatingRateRatio: {
        assets: +((floatingRateAssets / totalAssets) * 100).toFixed(1),
        liabilities: +((floatingRateLiabilities / totalLiabilities) * 100).toFixed(1),
      },
      interpretation: `Institution is ${classification}. Repricing gap: ${(repricingGapRatio * 100).toFixed(1)}% of assets. A +100bps shock ${classification === 'asset-sensitive' ? 'increases' : 'decreases'} NII by ~$${(Math.abs(niiImpactUp100) / 1e6).toFixed(1)}M.`,
      interpretationEs: `Institucion es ${classification === 'asset-sensitive' ? 'sensible a activos' : classification === 'liability-sensitive' ? 'sensible a pasivos' : 'neutral'}. Brecha de repricing: ${(repricingGapRatio * 100).toFixed(1)}% de activos. Un shock de +100pbs ${classification === 'asset-sensitive' ? 'aumenta' : 'disminuye'} NII en ~$${(Math.abs(niiImpactUp100) / 1e6).toFixed(1)}M.`,
    };
  }
}
