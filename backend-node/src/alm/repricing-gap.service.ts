import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

// ─── OCIF CC-2022-03 Repricing Buckets ──────────────────────

const BUCKETS = [
  { label: '0–30 Days', labelEs: '0–30 Días', minDays: 0, maxDays: 30 },
  { label: '31–90 Days', labelEs: '31–90 Días', minDays: 31, maxDays: 90 },
  { label: '91–180 Days', labelEs: '91–180 Días', minDays: 91, maxDays: 180 },
  { label: '181d–1 Year', labelEs: '181d–1 Año', minDays: 181, maxDays: 365 },
  { label: '1–3 Years', labelEs: '1–3 Años', minDays: 366, maxDays: 1095 },
  { label: '3–5 Years', labelEs: '3–5 Años', minDays: 1096, maxDays: 1825 },
  { label: 'Over 5 Years', labelEs: 'Más de 5 Años', minDays: 1826, maxDays: 999999 },
];

// ─── Types ───────────────────────────────────────────────────

export interface RepricingBucket {
  label: string;
  labelEs: string;
  minDays: number;
  maxDays: number;
  assets: number;
  liabilities: number;
  gap: number;
  cumulativeGap: number;
  gapAsPctAssets: number;
  isPolicyBreach: boolean;
}

export interface RepricingGapResult {
  buckets: RepricingBucket[];
  totalAssets: number;
  totalLiabilities: number;
  durationGap: number;
  analysisDate: string;
  policyLimitPct: number;
}

@Injectable()
export class RepricingGapService {
  private readonly logger = new Logger(RepricingGapService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getRepricingGap(institutionId: string, policyLimitPct: number = 15): Promise<RepricingGapResult> {
    const items = await this.prisma.balanceSheetItem.findMany({ where: { institutionId } });

    if (items.length === 0) return this.getDemoResult();

    const totalAssets = items.filter(i => i.category === 'asset').reduce((s, i) => s + i.balance, 0);
    const totalLiabilities = items.filter(i => i.category === 'liability').reduce((s, i) => s + i.balance, 0);

    const assetDuration = totalAssets > 0
      ? items.filter(i => i.category === 'asset').reduce((s, i) => s + i.balance * i.duration, 0) / totalAssets
      : 0;
    const liabDuration = totalLiabilities > 0
      ? items.filter(i => i.category === 'liability').reduce((s, i) => s + i.balance * i.duration, 0) / totalLiabilities
      : 0;

    let cumulativeGap = 0;
    const buckets: RepricingBucket[] = BUCKETS.map(bucket => {
      const assets = items
        .filter(i => i.category === 'asset')
        .filter(i => this.getRepricingDays(i) >= bucket.minDays && this.getRepricingDays(i) <= bucket.maxDays)
        .reduce((s, i) => s + i.balance, 0);

      const liabilities = items
        .filter(i => i.category === 'liability')
        .filter(i => this.getRepricingDays(i) >= bucket.minDays && this.getRepricingDays(i) <= bucket.maxDays)
        .reduce((s, i) => s + i.balance, 0);

      const gap = assets - liabilities;
      cumulativeGap += gap;
      const gapAsPctAssets = totalAssets > 0 ? (gap / totalAssets) * 100 : 0;

      return {
        ...bucket,
        assets: Math.round(assets * 10) / 10,
        liabilities: Math.round(liabilities * 10) / 10,
        gap: Math.round(gap * 10) / 10,
        cumulativeGap: Math.round(cumulativeGap * 10) / 10,
        gapAsPctAssets: Math.round(gapAsPctAssets * 10) / 10,
        isPolicyBreach: Math.abs(gapAsPctAssets) > policyLimitPct,
      };
    });

    return {
      buckets,
      totalAssets: Math.round(totalAssets * 10) / 10,
      totalLiabilities: Math.round(totalLiabilities * 10) / 10,
      durationGap: Math.round((assetDuration - liabDuration) * 100) / 100,
      analysisDate: new Date().toISOString(),
      policyLimitPct,
    };
  }

  // ─── Private ──────────────────────────────────────────────

  private getRepricingDays(item: any): number {
    // Variable-rate instruments reprice at their repricing frequency
    if (item.rateType === 'variable') {
      // If repriceDate is set, use days until that date
      if (item.repriceDate) {
        const days = Math.ceil((new Date(item.repriceDate).getTime() - Date.now()) / 86400000);
        return Math.max(0, days);
      }
      // Default: demand deposits = 1 day, other variable = 90 days
      const sub = (item.subcategory || '').toLowerCase();
      if (sub.includes('demand') || sub.includes('checking')) return 1;
      return 90;
    }

    // Fixed-rate instruments reprice at maturity
    if (item.maturityDate) {
      const days = Math.ceil((new Date(item.maturityDate).getTime() - Date.now()) / 86400000);
      return Math.max(0, days);
    }

    // Use duration as proxy
    return Math.round(item.duration * 365);
  }

  private getDemoResult(): RepricingGapResult {
    let cumGap = 0;
    const demoAssets = [45, 30, 25, 60, 120, 80, 85];
    const demoLiabs = [95, 55, 40, 35, 85, 45, 30];

    return {
      buckets: BUCKETS.map((b, i) => {
        const gap = demoAssets[i] - demoLiabs[i];
        cumGap += gap;
        const gapPct = (gap / 445) * 100;
        return { ...b, assets: demoAssets[i], liabilities: demoLiabs[i], gap,
          cumulativeGap: Math.round(cumGap * 10) / 10, gapAsPctAssets: Math.round(gapPct * 10) / 10,
          isPolicyBreach: Math.abs(gapPct) > 15 };
      }),
      totalAssets: 445, totalLiabilities: 385, durationGap: 2.1,
      analysisDate: new Date().toISOString(), policyLimitPct: 15,
    };
  }
}
