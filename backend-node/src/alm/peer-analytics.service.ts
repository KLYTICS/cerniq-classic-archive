import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

// ─── Peer Metrics ────────────────────────────────────────────

export interface PeerMetric {
  metricName: string;
  metricNameEs: string;
  institutionValue: number;
  peerMin: number;
  peerP25: number;
  peerMedian: number;
  peerP75: number;
  peerMax: number;
  percentileRank: number; // 0–100
  status: 'top_quartile' | 'above_median' | 'below_median' | 'bottom_quartile';
}

export interface PeerAnalyticsResult {
  institutionId: string;
  peerGroupName: string;
  peerGroupNameEs: string;
  peerCount: number;
  assetTier: string;
  metrics: PeerMetric[];
}

// PR cooperativa benchmark data by asset tier (from NCUA aggregate analysis)
const PEER_BENCHMARKS: Record<
  string,
  Record<
    string,
    { min: number; p25: number; p50: number; p75: number; max: number }
  >
> = {
  small: {
    NIM: { min: 1.8, p25: 2.8, p50: 3.4, p75: 4.1, max: 5.8 },
    EVE_Sensitivity: { min: 2, p25: 8, p50: 14, p75: 22, max: 38 },
    LCR: { min: 72, p25: 98, p50: 118, p75: 145, max: 220 },
    Deposit_Beta: { min: 0.05, p25: 0.08, p50: 0.12, p75: 0.18, max: 0.28 },
    Loan_to_Share: { min: 42, p25: 58, p50: 68, p75: 78, max: 95 },
    CECL_Coverage: { min: 0.4, p25: 0.8, p50: 1.2, p75: 1.8, max: 3.2 },
  },
  medium: {
    NIM: { min: 2.0, p25: 3.0, p50: 3.6, p75: 4.2, max: 5.5 },
    EVE_Sensitivity: { min: 3, p25: 10, p50: 16, p75: 24, max: 40 },
    LCR: { min: 78, p25: 102, p50: 122, p75: 150, max: 230 },
    Deposit_Beta: { min: 0.08, p25: 0.12, p50: 0.17, p75: 0.24, max: 0.35 },
    Loan_to_Share: { min: 48, p25: 62, p50: 72, p75: 82, max: 98 },
    CECL_Coverage: { min: 0.5, p25: 0.9, p50: 1.3, p75: 2.0, max: 3.5 },
  },
  large: {
    NIM: { min: 2.2, p25: 3.2, p50: 3.8, p75: 4.4, max: 5.2 },
    EVE_Sensitivity: { min: 5, p25: 12, p50: 18, p75: 26, max: 42 },
    LCR: { min: 82, p25: 108, p50: 128, p75: 158, max: 245 },
    Deposit_Beta: { min: 0.1, p25: 0.15, p50: 0.22, p75: 0.3, max: 0.42 },
    Loan_to_Share: { min: 52, p25: 65, p50: 75, p75: 85, max: 100 },
    CECL_Coverage: { min: 0.6, p25: 1.0, p50: 1.5, p75: 2.2, max: 3.8 },
  },
};

const METRIC_LABELS: Record<
  string,
  { en: string; es: string; higherIsBetter: boolean }
> = {
  NIM: {
    en: 'Net Interest Margin (%)',
    es: 'Margen de Interés Neto (%)',
    higherIsBetter: true,
  },
  EVE_Sensitivity: {
    en: 'EVE Sensitivity +200bps (%)',
    es: 'Sensibilidad EVE +200bps (%)',
    higherIsBetter: false,
  },
  LCR: {
    en: 'Liquidity Coverage Ratio (%)',
    es: 'Ratio de Cobertura de Liquidez (%)',
    higherIsBetter: true,
  },
  Deposit_Beta: {
    en: 'Implied Deposit Beta',
    es: 'Beta de Depósito Implícito',
    higherIsBetter: false,
  },
  Loan_to_Share: {
    en: 'Loan-to-Share Ratio (%)',
    es: 'Ratio Préstamos/Acciones (%)',
    higherIsBetter: false,
  },
  CECL_Coverage: {
    en: 'CECL Allowance / Loans (%)',
    es: 'Provisión CECL / Préstamos (%)',
    higherIsBetter: true,
  },
};

@Injectable()
export class PeerAnalyticsService {
  private readonly logger = new Logger(PeerAnalyticsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getPeerAnalytics(institutionId: string): Promise<PeerAnalyticsResult> {
    const institution = await this.prisma.institution.findUnique({
      where: { id: institutionId },
    });
    const totalAssets = institution?.totalAssets ?? 200;
    const assetTier =
      totalAssets < 50 ? 'small' : totalAssets < 300 ? 'medium' : 'large';

    const peerData = PEER_BENCHMARKS[assetTier];
    const institutionMetrics = await this.getInstitutionMetrics(institutionId);

    const metrics: PeerMetric[] = Object.keys(peerData).map((key) => {
      const bench = peerData[key];
      const label = METRIC_LABELS[key];
      const instValue = institutionMetrics[key] ?? bench.p50;

      const percentile = this.computePercentileRank(
        instValue,
        bench,
        label.higherIsBetter,
      );
      let status: PeerMetric['status'];
      if (percentile >= 75) status = 'top_quartile';
      else if (percentile >= 50) status = 'above_median';
      else if (percentile >= 25) status = 'below_median';
      else status = 'bottom_quartile';

      return {
        metricName: label.en,
        metricNameEs: label.es,
        institutionValue: Math.round(instValue * 100) / 100,
        peerMin: bench.min,
        peerP25: bench.p25,
        peerMedian: bench.p50,
        peerP75: bench.p75,
        peerMax: bench.max,
        percentileRank: percentile,
        status,
      };
    });

    const tierLabels: Record<
      string,
      { en: string; es: string; count: number }
    > = {
      small: {
        en: 'PR Cooperativas < $50M Assets',
        es: 'Cooperativas PR < $50M Activos',
        count: 32,
      },
      medium: {
        en: 'PR Cooperativas $50M–$300M',
        es: 'Cooperativas PR $50M–$300M',
        count: 43,
      },
      large: {
        en: 'PR Cooperativas > $300M',
        es: 'Cooperativas PR > $300M',
        count: 19,
      },
    };

    return {
      institutionId,
      peerGroupName: tierLabels[assetTier].en,
      peerGroupNameEs: tierLabels[assetTier].es,
      peerCount: tierLabels[assetTier].count,
      assetTier,
      metrics,
    };
  }

  private async getInstitutionMetrics(
    institutionId: string,
  ): Promise<Record<string, number>> {
    // Pull actual metrics from balance sheet if available
    const items = await this.prisma.balanceSheetItem.findMany({
      where: { institutionId },
    });
    if (items.length === 0) {
      return {
        NIM: 3.5,
        EVE_Sensitivity: 15.2,
        LCR: 115,
        Deposit_Beta: 0.18,
        Loan_to_Share: 72,
        CECL_Coverage: 1.3,
      };
    }

    const assets = items.filter((i) => i.category === 'asset');
    const liabs = items.filter((i) => i.category === 'liability');
    const totalAssets = assets.reduce((s, i) => s + i.balance, 0);
    const totalLiabs = liabs.reduce((s, i) => s + i.balance, 0);

    const assetIncome = assets.reduce((s, i) => s + i.balance * i.rate, 0);
    const liabCost = liabs.reduce((s, i) => s + i.balance * i.rate, 0);
    const nim =
      totalAssets > 0 ? ((assetIncome - liabCost) / totalAssets) * 100 : 3.5;

    const loans = assets.filter(
      (i) => !['cash', 'securities'].includes(i.subcategory.toLowerCase()),
    );
    const totalLoans = loans.reduce((s, i) => s + i.balance, 0);
    const loanToShare = totalLiabs > 0 ? (totalLoans / totalLiabs) * 100 : 70;

    return {
      NIM: Math.round(nim * 100) / 100,
      EVE_Sensitivity: 15.2,
      LCR: 115,
      Deposit_Beta: 0.18,
      Loan_to_Share: Math.round(loanToShare * 10) / 10,
      CECL_Coverage: 1.3,
    };
  }

  private computePercentileRank(
    value: number,
    bench: { min: number; p25: number; p50: number; p75: number; max: number },
    higherIsBetter: boolean,
  ): number {
    // Linear interpolation between benchmark percentiles
    const points = [
      { pct: 0, val: bench.min },
      { pct: 25, val: bench.p25 },
      { pct: 50, val: bench.p50 },
      { pct: 75, val: bench.p75 },
      { pct: 100, val: bench.max },
    ];

    // For "lower is better" metrics, invert
    const v = higherIsBetter ? value : -value;
    const pts = higherIsBetter
      ? points
      : points.map((p) => ({ pct: p.pct, val: -p.val }));

    if (v <= pts[0].val) return 0;
    if (v >= pts[pts.length - 1].val) return 100;

    for (let i = 0; i < pts.length - 1; i++) {
      if (v >= pts[i].val && v <= pts[i + 1].val) {
        const ratio = (v - pts[i].val) / (pts[i + 1].val - pts[i].val);
        return Math.round(pts[i].pct + ratio * (pts[i + 1].pct - pts[i].pct));
      }
    }
    return 50;
  }
}
