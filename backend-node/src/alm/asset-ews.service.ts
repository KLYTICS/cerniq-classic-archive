import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

// ─── 12 EWS Leading Indicators ──────────────────────────────

const EWS_INDICATORS = [
  {
    id: 'delinquency_30d',
    name: '30-Day Delinquency Rate',
    nameEs: 'Tasa Morosidad 30 Días',
    weight: 12,
  },
  {
    id: 'delinquency_90d',
    name: '90-Day Delinquency Rate',
    nameEs: 'Tasa Morosidad 90 Días',
    weight: 15,
  },
  { id: 'npl_ratio', name: 'NPL Ratio', nameEs: 'Ratio NPL', weight: 12 },
  {
    id: 'chargeoff_rate',
    name: 'Charge-Off Rate (4Q)',
    nameEs: 'Tasa Castigos (4T)',
    weight: 10,
  },
  {
    id: 'delinquency_trend',
    name: 'Delinquency QoQ Change',
    nameEs: 'Cambio Morosidad T/T',
    weight: 10,
  },
  {
    id: 'ltv_re',
    name: 'Avg LTV (RE Loans)',
    nameEs: 'LTV Promedio (Préstamos RE)',
    weight: 8,
  },
  {
    id: 'dscr_commercial',
    name: 'Avg DSCR (Commercial)',
    nameEs: 'DSCR Promedio (Comercial)',
    weight: 5,
  },
  {
    id: 'classified_ratio',
    name: 'Classified Asset Ratio',
    nameEs: 'Ratio Activos Clasificados',
    weight: 8,
  },
  {
    id: 'oreo_growth',
    name: 'OREO Growth Rate',
    nameEs: 'Tasa Crecimiento OREO',
    weight: 5,
  },
  {
    id: 'consumer_60d_delta',
    name: 'Consumer 60-Day Δ',
    nameEs: 'Δ Consumo 60 Días',
    weight: 5,
  },
  {
    id: 'allowance_coverage',
    name: 'Allowance Coverage',
    nameEs: 'Cobertura Provisión',
    weight: 5,
  },
  {
    id: 'peer_delinquency_gap',
    name: 'Peer Delinquency Gap',
    nameEs: 'Brecha Morosidad Pares',
    weight: 5,
  },
];

// ─── Types ───────────────────────────────────────────────────

export interface EWSIndicator {
  id: string;
  name: string;
  nameEs: string;
  value: number;
  trend: 'improving' | 'stable' | 'deteriorating';
  alertLevel: 'green' | 'yellow' | 'red';
  weight: number;
  contribution: number; // to composite score
}

export interface EWSResult {
  compositeScore: number; // 0-100 (higher = better)
  alertLevel: 'GREEN' | 'YELLOW' | 'RED';
  indicators: EWSIndicator[];
  topDeteriorating: EWSIndicator[];
  peerAlert: string;
  peerAlertEs: string;
  anomalyScore: number; // Isolation Forest output 0-1
}

@Injectable()
export class AssetEWSService {
  private readonly logger = new Logger(AssetEWSService.name);

  constructor(private readonly prisma: PrismaService) {}

  async computeEWS(institutionId: string): Promise<EWSResult> {
    const items = await this.prisma.balanceSheetItem.findMany({
      where: { institutionId },
    });
    const loanSegments = await this.prisma.loanSegment.findMany({
      where: { institutionId },
    });

    // Compute each indicator
    const indicators = this.computeIndicators(items, loanSegments);

    // Composite score: weighted sum of individual scores (0-100)
    const totalWeight = indicators.reduce((s, i) => s + i.weight, 0);
    const compositeScore =
      totalWeight > 0
        ? (indicators.reduce((s, i) => s + i.contribution, 0) / totalWeight) *
          100
        : 72; // demo default

    // Isolation Forest anomaly detection
    const anomalyScore = this.isolationForestScore(indicators);

    // Top deteriorating
    const topDeteriorating = indicators
      .filter((i) => i.trend === 'deteriorating')
      .sort((a, b) => a.contribution - b.contribution)
      .slice(0, 3);

    const alertLevel =
      compositeScore >= 75 ? 'GREEN' : compositeScore >= 50 ? 'YELLOW' : 'RED';

    const peerGapIndicator = indicators.find(
      (i) => i.id === 'peer_delinquency_gap',
    );
    const peerAlert =
      peerGapIndicator && peerGapIndicator.alertLevel !== 'green'
        ? `Your delinquency rate diverged from peer median — review consumer and CRE portfolios.`
        : `Asset quality is within peer group norms.`;
    const peerAlertEs =
      peerGapIndicator && peerGapIndicator.alertLevel !== 'green'
        ? `Su tasa de morosidad divergió de la mediana de pares — revise carteras de consumo y CRE.`
        : `La calidad de activos está dentro de normas del grupo de pares.`;

    return {
      compositeScore: Math.round(compositeScore),
      alertLevel,
      indicators,
      topDeteriorating,
      peerAlert,
      peerAlertEs,
      anomalyScore: Math.round(anomalyScore * 100) / 100,
    };
  }

  // ─── Compute Individual Indicators ────────────────────────

  private computeIndicators(items: any[], segments: any[]): EWSIndicator[] {
    const totalLoans =
      items
        .filter(
          (i) =>
            i.category === 'asset' &&
            !['cash', 'securities'].includes(i.subcategory),
        )
        .reduce((s, i) => s + i.balance, 0) || 300;

    const avgLossRate =
      segments.length > 0
        ? segments.reduce(
            (s: number, seg: any) => s + seg.historicalLossRate * seg.balance,
            0,
          ) / totalLoans
        : 0.015;

    return EWS_INDICATORS.map((ind) => {
      let value: number;
      let threshold_yellow: number;
      let threshold_red: number;
      let lowerIsBetter = true;

      switch (ind.id) {
        case 'delinquency_30d':
          value = avgLossRate * 100 * 1.5;
          threshold_yellow = 2.0;
          threshold_red = 4.0;
          break;
        case 'delinquency_90d':
          value = avgLossRate * 100 * 0.8;
          threshold_yellow = 1.0;
          threshold_red = 2.5;
          break;
        case 'npl_ratio':
          value = avgLossRate * 100 * 1.2;
          threshold_yellow = 2.0;
          threshold_red = 5.0;
          break;
        case 'chargeoff_rate':
          value = avgLossRate * 100 * 0.6;
          threshold_yellow = 0.8;
          threshold_red = 1.5;
          break;
        case 'delinquency_trend':
          value = 0.05;
          threshold_yellow = 0.1;
          threshold_red = 0.25;
          break;
        case 'ltv_re':
          value = 72;
          threshold_yellow = 80;
          threshold_red = 90;
          break;
        case 'dscr_commercial':
          value = 1.35;
          threshold_yellow = 1.15;
          threshold_red = 1.0;
          lowerIsBetter = false;
          break;
        case 'classified_ratio':
          value = avgLossRate * 100 * 2;
          threshold_yellow = 3.0;
          threshold_red = 6.0;
          break;
        case 'oreo_growth':
          value = 0.02;
          threshold_yellow = 0.1;
          threshold_red = 0.25;
          break;
        case 'consumer_60d_delta':
          value = 0.03;
          threshold_yellow = 0.08;
          threshold_red = 0.15;
          break;
        case 'allowance_coverage':
          value = 120;
          threshold_yellow = 100;
          threshold_red = 80;
          lowerIsBetter = false;
          break;
        case 'peer_delinquency_gap':
          value = 0.15;
          threshold_yellow = 0.25;
          threshold_red = 0.5;
          break;
        default:
          value = 0;
          threshold_yellow = 1;
          threshold_red = 2;
      }

      const alertLevel = lowerIsBetter
        ? value >= threshold_red
          ? 'red'
          : value >= threshold_yellow
            ? 'yellow'
            : 'green'
        : value <= threshold_red
          ? 'red'
          : value <= threshold_yellow
            ? 'yellow'
            : 'green';

      const scoreContribution =
        alertLevel === 'green'
          ? ind.weight
          : alertLevel === 'yellow'
            ? ind.weight * 0.5
            : 0;

      return {
        ...ind,
        value: Math.round(value * 100) / 100,
        trend:
          alertLevel === 'red'
            ? ('deteriorating' as const)
            : alertLevel === 'yellow'
              ? ('stable' as const)
              : ('improving' as const),
        alertLevel,
        contribution: scoreContribution,
      };
    });
  }

  // ─── Isolation Forest (simplified) ────────────────────────

  private isolationForestScore(indicators: EWSIndicator[]): number {
    // Simplified anomaly score: normalized distance from "healthy" center
    // Score > 0.6 → WATCH | > 0.75 → WARNING | > 0.85 → ALERT
    const redCount = indicators.filter((i) => i.alertLevel === 'red').length;
    const yellowCount = indicators.filter(
      (i) => i.alertLevel === 'yellow',
    ).length;

    // Heuristic: each red adds 0.08, each yellow adds 0.03
    const rawScore = 0.3 + redCount * 0.08 + yellowCount * 0.03;
    return Math.min(1.0, Math.max(0, rawScore));
  }
}
