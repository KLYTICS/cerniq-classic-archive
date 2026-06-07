'use client';

import { useMemo, type ReactNode } from 'react';

import { useTranslation } from '@/lib/i18n';
import { AlmPage } from '@/components/alm/AlmPage';
import {
  MetricStrip,
  type MetricStripItem,
} from '@/components/density/MetricStrip';
import {
  DataTable,
  type DataTableColumn,
} from '@/components/density/DataTable';
import { DataGapBanner } from '@/components/ui/cerniq';

import {
  validateNev,
  overallBanner,
  bandTone,
  bandLabel,
  formatShockLabel,
  formatNevMillions,
  formatPct,
  formatSensitivity,
  supervisoryShock,
  orderedShocks,
  isSupervisoryAnchor,
  anchorCellClass,
  type NevAnalysisResult,
  type NevShockPoint,
  type SemaforoTone,
} from './nev-helpers';

/**
 * NEV (Net Economic Value / Valor Económico Neto) — the conclusion-first
 * supervisory view of the COSSEC CC-2025-01 interest-rate-risk test.
 *
 * Wires the (previously backend-only) Layer 1 endpoint:
 *   - GET /api/alm/{id}/stress-test/nev
 *
 * No `getDemo` fallback is supplied: a supervisory artifact must never render
 * fabricated risk. The backend returns `overallRating: 'data_unavailable'` +
 * `baseNEV: null` + a `gaps[]` manifest for an empty balance sheet, which this
 * page renders honestly (gray semáforo + "cargue el balance" message + `—`,
 * never a `0` sentinel).
 */

const TONE_BG: Record<SemaforoTone, string> = {
  green: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  amber: 'border-amber-200 bg-amber-50 text-amber-800',
  red: 'border-rose-200 bg-rose-50 text-rose-800',
  gray: 'border-slate-200 bg-slate-50 text-slate-600',
};

const TONE_DOT: Record<SemaforoTone, string> = {
  green: 'bg-emerald-500',
  amber: 'bg-amber-500',
  red: 'bg-rose-500',
  gray: 'bg-slate-400',
};

/**
 * Wraps a shock-ladder cell so the +300bps supervisory-anchor row paints one
 * contiguous highlighted stripe (see `anchorCellClass`). `block` lets the
 * negative-margin bleed fill the `<td>`; inline content still honors the
 * column's text alignment.
 */
function AnchorCell({
  anchor,
  children,
}: {
  readonly anchor: boolean;
  readonly children: ReactNode;
}) {
  return <span className={anchorCellClass(anchor)}>{children}</span>;
}

function NevContent({ data }: { readonly data: NevAnalysisResult }) {
  const { locale } = useTranslation();
  const es = locale === 'es';

  const banner = overallBanner(data.overallRating);
  const anchor = useMemo(() => supervisoryShock(data.shocks), [data.shocks]);
  const ladder = useMemo(() => orderedShocks(data.shocks), [data.shocks]);
  const gapCounts = useMemo(() => {
    let critical = 0;
    let warning = 0;
    for (const g of data.gaps ?? []) {
      if (g.severity === 'CRITICAL') critical += 1;
      else if (g.severity === 'WARNING') warning += 1;
    }
    return { critical, warning };
  }, [data.gaps]);

  // Numeric supervisory anchors. `null` flows through to NumberCell as `—`,
  // so the data_unavailable shape (no +300 shock, null base) reads honestly.
  const stripItems: readonly MetricStripItem[] = [
    {
      key: 'nev_ratio_300',
      label: es ? 'Razón VEN @ +300pb' : 'NEV Ratio @ +300bps',
      value: anchor?.nevRatio ?? null,
      unit: '%',
    },
    {
      key: 'nev_sens_300',
      label: es ? 'Sensibilidad @ +300pb' : 'Sensitivity @ +300bps',
      value: anchor ? Math.abs(anchor.nevChangePct) : null,
      unit: '%',
    },
    {
      key: 'base_nev',
      label: es ? 'VEN Base' : 'Base NEV',
      value: data.baseNEV,
      unit: 'USD_M',
    },
    {
      key: 'base_nev_ratio',
      label: es ? 'Razón VEN Base' : 'Base NEV Ratio',
      value: data.baseNEVRatio,
      unit: '%',
    },
    {
      key: 'worst_ratio',
      label: es ? 'Peor Razón VEN' : 'Worst NEV Ratio',
      value: data.worstCase?.nevRatio ?? null,
      unit: '%',
    },
  ];

  const columns: readonly DataTableColumn<NevShockPoint>[] = [
    {
      id: 'shock',
      header: es ? 'Choque' : 'Shock',
      kind: 'custom',
      align: 'text-left',
      accessor: (s) => s.shockBps,
      render: (s) => {
        const isAnchor = isSupervisoryAnchor(s.shockBps);
        return (
          <AnchorCell anchor={isAnchor}>
            <span className="tabular-nums">{formatShockLabel(s.shockBps, es)}</span>
            {isAnchor ? (
              <span className="ml-2 rounded bg-sky-600 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white">
                {es ? 'Ancla supervisora' : 'Supervisory anchor'}
              </span>
            ) : null}
          </AnchorCell>
        );
      },
    },
    {
      id: 'nev',
      header: es ? 'Valor VEN' : 'NEV Value',
      kind: 'custom',
      align: 'text-right',
      accessor: (s) => s.nev,
      render: (s) => (
        <AnchorCell anchor={isSupervisoryAnchor(s.shockBps)}>
          <span className="tabular-nums">{formatNevMillions(s.nev)}</span>
        </AnchorCell>
      ),
    },
    {
      id: 'ratio',
      header: es ? 'Razón VEN' : 'NEV Ratio',
      kind: 'custom',
      align: 'text-right',
      accessor: (s) => s.nevRatio,
      render: (s) => (
        <AnchorCell anchor={isSupervisoryAnchor(s.shockBps)}>
          <span className="tabular-nums">{formatPct(s.nevRatio)}</span>
        </AnchorCell>
      ),
    },
    {
      id: 'sensitivity',
      header: es ? 'Sensibilidad' : 'Sensitivity',
      kind: 'custom',
      align: 'text-right',
      accessor: (s) => s.nevChangePct,
      render: (s) => (
        <AnchorCell anchor={isSupervisoryAnchor(s.shockBps)}>
          <span className="tabular-nums">{formatSensitivity(s.nevChangePct)}</span>
        </AnchorCell>
      ),
    },
    {
      id: 'band',
      header: es ? 'Banda VEN' : 'NEV Band',
      kind: 'custom',
      align: 'text-left',
      accessor: (s) => s.riskBand.level,
      render: (s) => {
        const tone = bandTone(s.riskBand.level);
        return (
          <AnchorCell anchor={isSupervisoryAnchor(s.shockBps)}>
            <span className="inline-flex items-center gap-1.5">
              <span
                className={`h-2 w-2 rounded-full ${TONE_DOT[tone]}`}
                aria-hidden
              />
              {bandLabel(s.riskBand.level, es)}
            </span>
          </AnchorCell>
        );
      },
    },
  ];

  return (
    <>
      {/* Conclusion-first semáforo banner: the supervisory verdict (worse-of
          NEV ratio + sensitivity at +300bps) a Presidente Ejecutivo reads in
          one glance. */}
      <section className={`rounded-xl border p-4 ${TONE_BG[banner.tone]}`}>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span
              className={`h-3 w-3 rounded-full ${TONE_DOT[banner.tone]}`}
              aria-hidden
            />
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] opacity-70">
                {es
                  ? 'Valor Económico Neto (VEN) — Prueba Supervisora'
                  : 'Net Economic Value (NEV) — Supervisory Test'}
              </p>
              <p className="text-lg font-bold">{es ? banner.es : banner.en}</p>
            </div>
          </div>
          {anchor ? (
            <div className="text-right text-[11px] leading-tight opacity-80">
              <p className="font-semibold uppercase tracking-wide">
                {es ? 'Ancla +300pb' : '+300bps anchor'}
              </p>
              <p className="tabular-nums">
                {es ? 'Razón VEN' : 'NEV ratio'} {formatPct(anchor.nevRatio)} ·{' '}
                {es ? 'Sensib.' : 'Sens.'} {formatSensitivity(anchor.nevChangePct)}
              </p>
            </div>
          ) : (
            <div className="max-w-xs text-right text-[11px] leading-tight opacity-80">
              <p>
                {es
                  ? 'Cargue el balance (activos y pasivos) y los segmentos para ejecutar la revaluación VEN.'
                  : 'Load the balance sheet (assets and liabilities) and segments to run the NEV revaluation.'}
              </p>
            </div>
          )}
        </div>
      </section>

      {/* D1: enumerate every missing input rather than papering over it. */}
      {data.gaps && data.gaps.length > 0 ? (
        <DataGapBanner
          gaps={data.gaps}
          criticalCount={gapCounts.critical}
          warningCount={gapCounts.warning}
        />
      ) : null}

      <MetricStrip items={stripItems} locale={locale} density="compact" />

      <section>
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
          {es
            ? 'Escalera de Choques VEN (±100/200/300pb)'
            : 'NEV Shock Ladder (±100/200/300bps)'}
        </p>
        {ladder.length > 0 ? (
          <>
            <DataTable
              rows={ladder}
              columns={columns}
              locale={locale}
              rowKey={(s) => String(s.shockBps)}
            />
            <p className="mt-2 text-[10px] leading-snug text-slate-400">
              {es
                ? 'La banda por choque refleja la razón VEN; el veredicto supervisor (peor de razón y sensibilidad, COSSEC CC-2025-01) se ancla en +300pb — fila resaltada arriba.'
                : 'Each shock band reflects the NEV ratio; the supervisory verdict (worse of ratio and sensitivity, COSSEC CC-2025-01) is anchored on +300bps — highlighted row above.'}
            </p>
          </>
        ) : (
          <p className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-xs text-slate-500">
            {es
              ? 'No hay escalera de choques — cargue el balance de situación y los segmentos para revaluar el VEN bajo ±100/200/300pb.'
              : 'No shock ladder available — load the balance sheet and segments to revalue NEV under ±100/200/300bps.'}
          </p>
        )}
      </section>
    </>
  );
}

export default function NevPage() {
  return (
    <AlmPage<NevAnalysisResult>
      slug="nev"
      iconTint="blue"
      validate={validateNev}
    >
      {(data) => <NevContent data={data} />}
    </AlmPage>
  );
}
