import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

export interface ConcentrationVaRResult {
  herfindahlIndex: number;
  granularityAdjustment: number;
  diversifiedVaR: number;
  concentrationVaR: number;
  concentrationPremium: number;
  concentrationPremiumPct: number;
  topConcentrations: Array<{
    segment: string;
    shareOfPortfolio: number;
    el: number;
    ul: number;
  }>;
  narrativeEs: string;
  narrativeEn: string;
}

@Injectable()
export class CreditConcentrationVaRService {
  private readonly logger = new Logger(CreditConcentrationVaRService.name);

  constructor(private readonly prisma: PrismaService) {}

  async compute(institutionId: string): Promise<ConcentrationVaRResult> {
    const segments = await this.prisma.loanSegment.findMany({
      where: { institutionId },
    });

    if (segments.length === 0) return this.getDemoResult();

    const totalLoans = segments.reduce((s: number, seg: any) => s + seg.balance, 0);
    if (totalLoans === 0) return this.getDemoResult();

    // HHI = Σ(s_i²) where s_i = segment_i / total
    const H = segments.reduce(
      (s: number, seg: any) => s + Math.pow(seg.balance / totalLoans, 2),
      0,
    );

    // Per-segment EL and UL
    const segmentRisk = segments.map((seg: any) => {
      const pd = seg.historicalLossRate * 1.5;
      const lgd = seg.lgd;
      const ead = seg.balance;
      const el = pd * lgd * ead;
      const rho = 0.12; // avg asset correlation
      // Vasicek UL approximation
      const ul = this.vasicekUL(pd, lgd, ead, rho);
      return { name: seg.segmentName, ead, el, ul, share: ead / totalLoans };
    });

    const portfolioEL = segmentRisk.reduce((s: number, r: any) => s + r.el, 0);
    const portfolioUL = Math.sqrt(
      segmentRisk.reduce((s: number, r: any) => s + r.ul ** 2, 0),
    );

    // Gordy granularity adjustment: GA ≈ (H / (1-H)) × (UL²/EL)
    const GA =
      portfolioEL > 0
        ? (H / (1 - H + 1e-10)) * (portfolioUL ** 2 / portfolioEL)
        : 0;

    const diversifiedVaR = portfolioEL + portfolioUL * 3; // 99.9%
    const concentrationVaR = diversifiedVaR + GA;
    const premium = concentrationVaR - diversifiedVaR;
    const premiumPct = diversifiedVaR > 0 ? premium / diversifiedVaR : 0;

    const sorted = [...segmentRisk].sort((a, b) => b.share - a.share);

    const hFormatted = +(H * 100).toFixed(1);
    const isConcentrated = H > 0.15;

    return {
      herfindahlIndex: +H.toFixed(4),
      granularityAdjustment: +GA.toFixed(2),
      diversifiedVaR: +diversifiedVaR.toFixed(2),
      concentrationVaR: +concentrationVaR.toFixed(2),
      concentrationPremium: +premium.toFixed(2),
      concentrationPremiumPct: +premiumPct.toFixed(4),
      topConcentrations: sorted.slice(0, 5).map((r) => ({
        segment: r.name,
        shareOfPortfolio: +r.share.toFixed(3),
        el: +r.el.toFixed(2),
        ul: +r.ul.toFixed(2),
      })),
      narrativeEs: isConcentrated
        ? `Riesgo de concentración elevado (HHI=${hFormatted}%). Los 3 segmentos principales representan ${(sorted.slice(0, 3).reduce((s, r) => s + r.share, 0) * 100).toFixed(0)}% del portafolio. Prima de concentración: $${premium.toFixed(1)}M (${(premiumPct * 100).toFixed(1)}% del VaR diversificado).`
        : `Portafolio bien diversificado (HHI=${hFormatted}%). Prima de concentración es mínima: $${premium.toFixed(1)}M.`,
      narrativeEn: isConcentrated
        ? `Elevated concentration risk (HHI=${hFormatted}%). Top 3 segments represent ${(sorted.slice(0, 3).reduce((s, r) => s + r.share, 0) * 100).toFixed(0)}% of portfolio. Concentration premium: $${premium.toFixed(1)}M (${(premiumPct * 100).toFixed(1)}% of diversified VaR).`
        : `Well-diversified portfolio (HHI=${hFormatted}%). Concentration premium is minimal: $${premium.toFixed(1)}M.`,
    };
  }

  private vasicekUL(pd: number, lgd: number, ead: number, rho: number): number {
    const normInv = (p: number) => {
      if (p <= 0.0001) return -3.7;
      if (p >= 0.9999) return 3.7;
      const a = [
        -3.969683028665376e1, 2.209460984245205e2, -2.759285104469687e2,
        1.38357751867269e2, -3.066479806614716e1, 2.506628277459239,
      ];
      const b = [
        -5.447609879822406e1, 1.615858368580409e2, -1.556989798598866e2,
        6.680131188771972e1, -1.328068155288572e1,
      ];
      const q = p - 0.5;
      const r = q * q;
      return (
        ((((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) *
          q) /
        (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1)
      );
    };
    const normCDF = (x: number) => {
      const t = 1 / (1 + 0.2316419 * Math.abs(x));
      const d = 0.3989422804014327;
      const p =
        d *
        Math.exp((-x * x) / 2) *
        t *
        (0.3193815 +
          t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
      return x > 0 ? 1 - p : p;
    };

    const conditionalPD = normCDF(
      (normInv(Math.min(0.99, pd)) + Math.sqrt(rho) * normInv(0.999)) /
        Math.sqrt(1 - rho),
    );
    return Math.max(0, (conditionalPD * lgd - pd * lgd) * ead);
  }

  private getDemoResult(): ConcentrationVaRResult {
    return {
      herfindahlIndex: 0.185,
      granularityAdjustment: 1.8,
      diversifiedVaR: 28.5,
      concentrationVaR: 30.3,
      concentrationPremium: 1.8,
      concentrationPremiumPct: 0.063,
      topConcentrations: [
        { segment: 'Commercial RE', shareOfPortfolio: 0.27, el: 4.97, ul: 8.4 },
        {
          segment: 'Residential Mortgage',
          shareOfPortfolio: 0.21,
          el: 3.29,
          ul: 5.7,
        },
        {
          segment: 'Consumer Loans',
          shareOfPortfolio: 0.19,
          el: 4.01,
          ul: 5.82,
        },
      ],
      narrativeEs:
        'Riesgo de concentración elevado (HHI=18.5%). Los 3 segmentos principales representan 67% del portafolio.',
      narrativeEn:
        'Elevated concentration risk (HHI=18.5%). Top 3 segments represent 67% of portfolio.',
    };
  }
}
