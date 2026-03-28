import { Injectable } from '@nestjs/common';
/** Recovery Rate Estimation — Quant Model #80. Estimates LGD by collateral type. MILESTONE: 80 quant models. */
@Injectable()
export class RecoveryRateService {
  estimate(loans: Array<{ type: string; typeEs: string; balance: number; collateralValue: number; collateralType: string; seniorityRank: number }>): {
    loans: Array<{ type: string; typeEs: string; balance: number; ltv: number; estimatedRecovery: number; lgd: number }>;
    portfolioLGD: number; portfolioRecovery: number;
    interpretation: string; interpretationEs: string;
  } {
    const enriched = loans.map(l => {
      const ltv = +(l.balance / (l.collateralValue || l.balance) * 100).toFixed(1);
      const baseRecovery = this.getBaseRecovery(l.collateralType);
      const seniorityAdj = Math.max(0, 1 - (l.seniorityRank - 1) * 0.15);
      const estimatedRecovery = +(baseRecovery * seniorityAdj * Math.min(1, l.collateralValue / l.balance)).toFixed(2);
      return { ...l, ltv, estimatedRecovery, lgd: +(1 - estimatedRecovery).toFixed(2) };
    });
    const totalBalance = enriched.reduce((s, l) => s + l.balance, 0);
    const portfolioLGD = +(enriched.reduce((s, l) => s + l.lgd * l.balance, 0) / totalBalance).toFixed(3);
    return {
      loans: enriched, portfolioLGD, portfolioRecovery: +(1 - portfolioLGD).toFixed(3),
      interpretation: `Portfolio LGD: ${(portfolioLGD * 100).toFixed(1)}%. Recovery: ${((1 - portfolioLGD) * 100).toFixed(1)}%.`,
      interpretationEs: `LGD portafolio: ${(portfolioLGD * 100).toFixed(1)}%. Recuperacion: ${((1 - portfolioLGD) * 100).toFixed(1)}%.`,
    };
  }
  private getBaseRecovery(type: string): number {
    const t = type.toLowerCase();
    if (t.includes('real estate') || t.includes('mortgage')) return 0.65;
    if (t.includes('auto') || t.includes('vehicle')) return 0.55;
    if (t.includes('equipment')) return 0.45;
    if (t.includes('unsecured')) return 0.25;
    return 0.40;
  }
}
