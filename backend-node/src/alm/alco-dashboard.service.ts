import { Injectable } from '@nestjs/common';

/**
 * ALCO Dashboard Aggregator — Quant Model #83. Aggregates all key metrics for
 * ALCO meeting presentation.
 *
 * D1 (2026-04-07): every input is nullable. When a metric is null, the
 * dashboard renders the value as `—` and the status as `info` (neutral
 * grey) instead of `red` (which would imply a real failure). This lets
 * upstream services pass through `LCRSummary.lcr: number | null` without
 * a translation layer that could re-introduce silent zeros.
 */
@Injectable()
export class ALCODashboardService {
  aggregate(params: {
    nim: number | null;
    eve: number | null;
    nii: number | null;
    lcr: number | null;
    nsfr: number | null;
    capitalRatio: number | null;
    durationGap: number | null;
    camelScore: number | null;
    earPct: number | null;
    roeAnnualized: number | null;
  }): {
    metrics: Array<{
      name: string;
      nameEs: string;
      value: string;
      status: 'green' | 'amber' | 'red' | 'info';
      threshold: string;
    }>;
    overallHealth: 'strong' | 'adequate' | 'needs_attention' | 'data_unavailable';
    interpretation: string;
    interpretationEs: string;
  } {
    const m = params;

    // Tiny helper: build a metric row, defaulting to `—` + 'info' when the
    // value is null. The fmt function only runs on real numbers, so the
    // surrounding pass/amber/red logic stays self-contained.
    type MetricRow = {
      name: string;
      nameEs: string;
      value: string;
      status: 'green' | 'amber' | 'red' | 'info';
      threshold: string;
    };
    const row = (
      name: string,
      nameEs: string,
      v: number | null,
      threshold: string,
      fmt: (n: number) => string,
      grade: (n: number) => 'green' | 'amber' | 'red',
    ): MetricRow =>
      v === null
        ? { name, nameEs, value: '—', status: 'info', threshold }
        : { name, nameEs, value: fmt(v), status: grade(v), threshold };

    const metrics: MetricRow[] = [
      row(
        'NIM',
        'NIM',
        m.nim,
        '≥3.0%',
        (n) => `${(n * 100).toFixed(2)}%`,
        (n) => (n >= 0.03 ? 'green' : n >= 0.02 ? 'amber' : 'red'),
      ),
      row(
        'LCR',
        'LCR',
        m.lcr,
        '≥100%',
        (n) => `${n.toFixed(0)}%`,
        (n) => (n >= 100 ? 'green' : n >= 80 ? 'amber' : 'red'),
      ),
      row(
        'NSFR',
        'NSFR',
        m.nsfr,
        '≥100%',
        (n) => `${n.toFixed(0)}%`,
        (n) => (n >= 100 ? 'green' : n >= 90 ? 'amber' : 'red'),
      ),
      row(
        'Capital Ratio',
        'Ratio Capital',
        m.capitalRatio,
        '≥7.0%',
        (n) => `${n.toFixed(1)}%`,
        (n) => (n >= 7 ? 'green' : n >= 5 ? 'amber' : 'red'),
      ),
      row(
        'Duration Gap',
        'Brecha Duracion',
        m.durationGap,
        '≤2yr',
        (n) => `${n.toFixed(1)}yr`,
        (n) => (Math.abs(n) <= 2 ? 'green' : Math.abs(n) <= 4 ? 'amber' : 'red'),
      ),
      row(
        'CAMEL',
        'CAMEL',
        m.camelScore,
        '≤2',
        (n) => `${n}`,
        (n) => (n <= 2 ? 'green' : n <= 3 ? 'amber' : 'red'),
      ),
      row(
        'EaR',
        'GaR',
        m.earPct,
        '<3%',
        (n) => `${n.toFixed(1)}%`,
        (n) => (n < 3 ? 'green' : n < 6 ? 'amber' : 'red'),
      ),
    ];
    const reds = metrics.filter((x) => x.status === 'red').length;
    const ambers = metrics.filter((x) => x.status === 'amber').length;
    const infos = metrics.filter((x) => x.status === 'info').length;
    const greens = metrics.filter((x) => x.status === 'green').length;

    // D1: when more than half the metrics are data_unavailable, the overall
    // health is 'data_unavailable' — a partial dashboard with most fields
    // missing is more misleading than honest acknowledgment.
    const health =
      infos > metrics.length / 2
        ? ('data_unavailable' as const)
        : reds > 0
          ? ('needs_attention' as const)
          : ambers > 2
            ? ('adequate' as const)
            : ('strong' as const);

    const interpretation =
      health === 'data_unavailable'
        ? `${infos}/7 metrics unavailable — load institution data before reviewing the ALCO dashboard.`
        : `${greens}/7 metrics green. ${reds} red flags${infos > 0 ? `, ${infos} unavailable` : ''}. Overall: ${health}.`;
    const interpretationEs =
      health === 'data_unavailable'
        ? `${infos}/7 metricas no disponibles — cargue los datos de la institucion antes de revisar el panel ALCO.`
        : `${greens}/7 metricas verdes. ${reds} alertas rojas${infos > 0 ? `, ${infos} no disponibles` : ''}. General: ${health === 'strong' ? 'fuerte' : health === 'adequate' ? 'adecuado' : 'necesita atencion'}.`;

    return {
      metrics,
      overallHealth: health,
      interpretation,
      interpretationEs,
    };
  }
}
