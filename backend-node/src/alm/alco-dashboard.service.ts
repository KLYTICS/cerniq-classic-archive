import { Injectable } from '@nestjs/common';
/** ALCO Dashboard Aggregator — Quant Model #83. Aggregates all key metrics for ALCO meeting presentation. */
@Injectable()
export class ALCODashboardService {
  aggregate(params: {
    nim: number;
    eve: number;
    nii: number;
    lcr: number;
    nsfr: number;
    capitalRatio: number;
    durationGap: number;
    camelScore: number;
    earPct: number;
    roeAnnualized: number;
  }): {
    metrics: Array<{
      name: string;
      nameEs: string;
      value: string;
      status: 'green' | 'amber' | 'red';
      threshold: string;
    }>;
    overallHealth: 'strong' | 'adequate' | 'needs_attention';
    interpretation: string;
    interpretationEs: string;
  } {
    const m = params;
    const metrics = [
      {
        name: 'NIM',
        nameEs: 'NIM',
        value: `${(m.nim * 100).toFixed(2)}%`,
        status:
          m.nim >= 0.03
            ? ('green' as const)
            : m.nim >= 0.02
              ? ('amber' as const)
              : ('red' as const),
        threshold: '≥3.0%',
      },
      {
        name: 'LCR',
        nameEs: 'LCR',
        value: `${m.lcr.toFixed(0)}%`,
        status:
          m.lcr >= 100
            ? ('green' as const)
            : m.lcr >= 80
              ? ('amber' as const)
              : ('red' as const),
        threshold: '≥100%',
      },
      {
        name: 'NSFR',
        nameEs: 'NSFR',
        value: `${m.nsfr.toFixed(0)}%`,
        status:
          m.nsfr >= 100
            ? ('green' as const)
            : m.nsfr >= 90
              ? ('amber' as const)
              : ('red' as const),
        threshold: '≥100%',
      },
      {
        name: 'Capital Ratio',
        nameEs: 'Ratio Capital',
        value: `${m.capitalRatio.toFixed(1)}%`,
        status:
          m.capitalRatio >= 7
            ? ('green' as const)
            : m.capitalRatio >= 5
              ? ('amber' as const)
              : ('red' as const),
        threshold: '≥7.0%',
      },
      {
        name: 'Duration Gap',
        nameEs: 'Brecha Duracion',
        value: `${m.durationGap.toFixed(1)}yr`,
        status:
          Math.abs(m.durationGap) <= 2
            ? ('green' as const)
            : Math.abs(m.durationGap) <= 4
              ? ('amber' as const)
              : ('red' as const),
        threshold: '≤2yr',
      },
      {
        name: 'CAMEL',
        nameEs: 'CAMEL',
        value: `${m.camelScore}`,
        status:
          m.camelScore <= 2
            ? ('green' as const)
            : m.camelScore <= 3
              ? ('amber' as const)
              : ('red' as const),
        threshold: '≤2',
      },
      {
        name: 'EaR',
        nameEs: 'GaR',
        value: `${m.earPct.toFixed(1)}%`,
        status:
          m.earPct < 3
            ? ('green' as const)
            : m.earPct < 6
              ? ('amber' as const)
              : ('red' as const),
        threshold: '<3%',
      },
    ];
    const reds = metrics.filter((m) => m.status === 'red').length;
    const ambers = metrics.filter((m) => m.status === 'amber').length;
    const health =
      reds > 0
        ? ('needs_attention' as const)
        : ambers > 2
          ? ('adequate' as const)
          : ('strong' as const);
    return {
      metrics,
      overallHealth: health,
      interpretation: `${metrics.filter((m) => m.status === 'green').length}/7 metrics green. ${reds} red flags. Overall: ${health}.`,
      interpretationEs: `${metrics.filter((m) => m.status === 'green').length}/7 metricas verdes. ${reds} alertas rojas. General: ${health === 'strong' ? 'fuerte' : health === 'adequate' ? 'adecuado' : 'necesita atencion'}.`,
    };
  }
}
