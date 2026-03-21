import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

// Wrong-Way Risk — Exposure increases when counterparty most likely to default

export interface WWRResult {
  naiveCVA: number;
  adjustedCVA: number;
  wwrPremium: number;
  wwrMultiplier: number;
  bySegment: Array<{ segment: string; naiveCVA: number; adjustedCVA: number; premium: number }>;
  narrativeEs: string;
  narrativeEn: string;
}

@Injectable()
export class WrongWayRiskService {
  private readonly logger = new Logger(WrongWayRiskService.name);

  constructor(private readonly prisma: PrismaService) {}

  async computeWWR(institutionId: string, wwrCorrelation: number = 0.3): Promise<WWRResult> {
    const segments = await this.prisma.loanSegment.findMany({ where: { institutionId } });
    if (segments.length === 0) return this.getDemoResult();

    let totalNaive = 0, totalAdjusted = 0;
    const bySegment: WWRResult['bySegment'] = [];

    for (const seg of segments) {
      const pd = seg.historicalLossRate * 1.5;
      const lgd = seg.lgd;
      const ead = seg.balance;
      const maturity = seg.weightedAvgMaturity ?? 3;
      const vol = 0.15; // exposure volatility

      // Naive CVA = LGD × PD × EAD × maturity
      const naiveCVA = lgd * pd * ead * maturity / 4; // quarterly

      // WWR adjustment: E[X|D=1] = E[X] × (1 + ρ × σ × Φ⁻¹(PD) / PD)
      const normInvPD = this.normInv(1 - pd);
      const wwrAdj = 1 + wwrCorrelation * vol * normInvPD / (pd || 1e-6);
      const adjustedEPE = ead * Math.max(0.5, Math.min(3.0, wwrAdj));
      const adjustedCVA = lgd * pd * adjustedEPE * maturity / 4;

      totalNaive += naiveCVA;
      totalAdjusted += adjustedCVA;
      bySegment.push({
        segment: seg.segmentName,
        naiveCVA: +naiveCVA.toFixed(3),
        adjustedCVA: +adjustedCVA.toFixed(3),
        premium: +(adjustedCVA - naiveCVA).toFixed(3),
      });
    }

    const premium = totalAdjusted - totalNaive;
    const multiplier = totalNaive > 0 ? totalAdjusted / totalNaive : 1;

    return {
      naiveCVA: +totalNaive.toFixed(2),
      adjustedCVA: +totalAdjusted.toFixed(2),
      wwrPremium: +premium.toFixed(2),
      wwrMultiplier: +multiplier.toFixed(3),
      bySegment,
      narrativeEs: `El CVA ajustado por wrong-way risk es $${totalAdjusted.toFixed(1)}M (${multiplier.toFixed(1)}× el CVA naive de $${totalNaive.toFixed(1)}M). La prima WWR de $${premium.toFixed(1)}M refleja que la exposición crediticia aumenta precisamente cuando la probabilidad de incumplimiento es mayor.`,
      narrativeEn: `WWR-adjusted CVA is $${totalAdjusted.toFixed(1)}M (${multiplier.toFixed(1)}× naive CVA of $${totalNaive.toFixed(1)}M). The WWR premium of $${premium.toFixed(1)}M reflects that credit exposure increases precisely when default probability is highest.`,
    };
  }

  private normInv(p: number): number {
    if (p <= 0.0001) return -3.7; if (p >= 0.9999) return 3.7;
    const a = [-3.969683028665376e1, 2.209460984245205e2, -2.759285104469687e2, 1.383577518672690e2, -3.066479806614716e1, 2.506628277459239e0];
    const b = [-5.447609879822406e1, 1.615858368580409e2, -1.556989798598866e2, 6.680131188771972e1, -1.328068155288572e1];
    const q = p - 0.5, r = q * q;
    return (((((a[0]*r+a[1])*r+a[2])*r+a[3])*r+a[4])*r+a[5])*q / (((((b[0]*r+b[1])*r+b[2])*r+b[3])*r+b[4])*r+1);
  }

  private getDemoResult(): WWRResult {
    return { naiveCVA: 2.4, adjustedCVA: 3.8, wwrPremium: 1.4, wwrMultiplier: 1.58, bySegment: [{ segment: 'Commercial RE', naiveCVA: 1.2, adjustedCVA: 2.0, premium: 0.8 }, { segment: 'Consumer', naiveCVA: 0.8, adjustedCVA: 1.1, premium: 0.3 }], narrativeEs: 'CVA ajustado: $3.8M (1.58× naive).', narrativeEn: 'Adjusted CVA: $3.8M (1.58× naive).' };
  }
}
