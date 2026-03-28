import { Injectable } from '@nestjs/common';

/**
 * Collateral Haircut Calculator — Quant Model #74
 *
 * Calculates regulatory and market-implied haircuts for pledged collateral.
 * Used for FHLB borrowing capacity and repo market access.
 */
@Injectable()
export class CollateralHaircutService {
  calculate(assets: Array<{ type: string; typeEs: string; marketValue: number; creditRating?: string; maturityYears?: number }>): {
    assets: Array<{ type: string; typeEs: string; marketValue: number; haircut: number; pledgeableValue: number }>;
    totalMarketValue: number; totalPledgeable: number; avgHaircut: number;
    interpretation: string; interpretationEs: string;
  } {
    const enriched = assets.map(a => {
      const haircut = this.getHaircut(a.type, a.creditRating, a.maturityYears);
      return { ...a, haircut, pledgeableValue: +(a.marketValue * (1 - haircut / 100)).toFixed(0) };
    });
    const totalMV = enriched.reduce((s, a) => s + a.marketValue, 0);
    const totalPledge = enriched.reduce((s, a) => s + a.pledgeableValue, 0);
    const avgHaircut = +((1 - totalPledge / totalMV) * 100).toFixed(1);

    return {
      assets: enriched, totalMarketValue: totalMV, totalPledgeable: totalPledge, avgHaircut,
      interpretation: `Total collateral: $${(totalMV / 1e6).toFixed(0)}M. Pledgeable after haircuts: $${(totalPledge / 1e6).toFixed(0)}M (avg haircut: ${avgHaircut}%).`,
      interpretationEs: `Colateral total: $${(totalMV / 1e6).toFixed(0)}M. Pignorable despues de haircuts: $${(totalPledge / 1e6).toFixed(0)}M (haircut promedio: ${avgHaircut}%).`,
    };
  }

  private getHaircut(type: string, rating?: string, maturity?: number): number {
    const t = type.toLowerCase();
    if (t.includes('cash') || t.includes('treasury bill')) return 0;
    if (t.includes('treasury') || t.includes('government')) return maturity && maturity > 10 ? 4 : 2;
    if (t.includes('agency') || t.includes('mbs')) return maturity && maturity > 10 ? 8 : 5;
    if (t.includes('municipal')) return rating === 'AAA' ? 5 : 10;
    if (t.includes('corporate')) return rating === 'AAA' ? 8 : rating === 'AA' ? 12 : 20;
    if (t.includes('equity')) return 25;
    return 15;
  }
}
