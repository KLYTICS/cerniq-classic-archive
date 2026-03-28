import { Injectable, Logger } from '@nestjs/common';

/**
 * Liquidity Gap Analysis Service — Quant Model #52
 *
 * Maturity gap analysis showing cumulative cash flow mismatches
 * across time buckets. Core Basel III/COSSEC requirement.
 *
 * Measures structural liquidity risk: can the institution meet
 * obligations as assets and liabilities mature?
 *
 * Time buckets: overnight, 1W, 2W, 1M, 2M, 3M, 6M, 9M, 1Y, 2Y, 3Y, 5Y, >5Y
 */

export interface LiquidityGapResult {
  buckets: Array<{
    period: string;
    periodEs: string;
    assetsCF: number;
    liabilitiesCF: number;
    netGap: number;
    cumulativeGap: number;
    cumulativeGapPct: number; // % of total assets
  }>;
  totalAssets: number;
  totalLiabilities: number;
  shortTermGap: number; // cumulative gap at 3M
  mediumTermGap: number; // cumulative gap at 1Y
  longTermGap: number; // cumulative gap at 5Y+
  status: 'adequate' | 'tight' | 'critical';
  interpretation: string;
  interpretationEs: string;
}

@Injectable()
export class LiquidityGapService {
  private readonly logger = new Logger(LiquidityGapService.name);

  analyze(totalAssets: number = 18_900_000_000): LiquidityGapResult {
    const buckets = this.buildDemoBuckets(totalAssets);

    let cumGap = 0;
    const enriched = buckets.map((b) => {
      cumGap += b.netGap;
      return {
        ...b,
        cumulativeGap: cumGap,
        cumulativeGapPct: +((cumGap / totalAssets) * 100).toFixed(2),
      };
    });

    const shortTermGap =
      enriched.find((b) => b.period === '3M')?.cumulativeGap ?? 0;
    const mediumTermGap =
      enriched.find((b) => b.period === '1Y')?.cumulativeGap ?? 0;
    const longTermGap = enriched[enriched.length - 1]?.cumulativeGap ?? 0;

    const shortTermPct = Math.abs(shortTermGap / totalAssets) * 100;
    const status =
      shortTermPct < 5 ? 'adequate' : shortTermPct < 10 ? 'tight' : 'critical';

    return {
      buckets: enriched,
      totalAssets,
      totalLiabilities: totalAssets * 0.91,
      shortTermGap,
      mediumTermGap,
      longTermGap,
      status,
      interpretation: `Short-term (3M) cumulative gap: $${(shortTermGap / 1e6).toFixed(0)}M (${((shortTermGap / totalAssets) * 100).toFixed(1)}% of assets). Status: ${status}. ${status === 'adequate' ? 'Sufficient liquidity buffer.' : 'Consider extending liability maturities.'}`,
      interpretationEs: `Brecha acumulada corto plazo (3M): $${(shortTermGap / 1e6).toFixed(0)}M (${((shortTermGap / totalAssets) * 100).toFixed(1)}% de activos). Estado: ${status === 'adequate' ? 'adecuado' : status === 'tight' ? 'ajustado' : 'critico'}. ${status === 'adequate' ? 'Colchon de liquidez suficiente.' : 'Considere extender vencimientos de pasivos.'}`,
    };
  }

  private buildDemoBuckets(total: number) {
    const t = total / 1e9;
    return [
      {
        period: 'O/N',
        periodEs: 'O/N',
        assetsCF: t * 120,
        liabilitiesCF: t * 95,
        netGap: t * 25,
      },
      {
        period: '1W',
        periodEs: '1S',
        assetsCF: t * 85,
        liabilitiesCF: t * 110,
        netGap: t * -25,
      },
      {
        period: '2W',
        periodEs: '2S',
        assetsCF: t * 60,
        liabilitiesCF: t * 70,
        netGap: t * -10,
      },
      {
        period: '1M',
        periodEs: '1M',
        assetsCF: t * 180,
        liabilitiesCF: t * 200,
        netGap: t * -20,
      },
      {
        period: '2M',
        periodEs: '2M',
        assetsCF: t * 150,
        liabilitiesCF: t * 130,
        netGap: t * 20,
      },
      {
        period: '3M',
        periodEs: '3M',
        assetsCF: t * 200,
        liabilitiesCF: t * 180,
        netGap: t * 20,
      },
      {
        period: '6M',
        periodEs: '6M',
        assetsCF: t * 350,
        liabilitiesCF: t * 300,
        netGap: t * 50,
      },
      {
        period: '9M',
        periodEs: '9M',
        assetsCF: t * 280,
        liabilitiesCF: t * 250,
        netGap: t * 30,
      },
      {
        period: '1Y',
        periodEs: '1A',
        assetsCF: t * 450,
        liabilitiesCF: t * 400,
        netGap: t * 50,
      },
      {
        period: '2Y',
        periodEs: '2A',
        assetsCF: t * 600,
        liabilitiesCF: t * 550,
        netGap: t * 50,
      },
      {
        period: '3Y',
        periodEs: '3A',
        assetsCF: t * 500,
        liabilitiesCF: t * 480,
        netGap: t * 20,
      },
      {
        period: '5Y',
        periodEs: '5A',
        assetsCF: t * 400,
        liabilitiesCF: t * 350,
        netGap: t * 50,
      },
      {
        period: '>5Y',
        periodEs: '>5A',
        assetsCF: t * 300,
        liabilitiesCF: t * 200,
        netGap: t * 100,
      },
    ].map((b) => ({
      ...b,
      assetsCF: +(b.assetsCF * 1e6),
      liabilitiesCF: +(b.liabilitiesCF * 1e6),
      netGap: +(b.netGap * 1e6),
      cumulativeGap: 0,
      cumulativeGapPct: 0,
    }));
  }
}
