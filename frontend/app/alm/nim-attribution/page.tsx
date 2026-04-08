'use client';

import { useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, ReferenceLine,
} from 'recharts';

import { useTranslation } from '@/lib/i18n';
import { AlmPage } from '@/components/alm/AlmPage';
import { MetricStrip, type MetricStripItem } from '@/components/density/MetricStrip';
import { DataTable, type DataTableColumn } from '@/components/density/DataTable';

/**
 * NIM Attribution — migrated to AlmPage.
 *
 * Decomposes the quarter-over-quarter NIM delta into contributing factors
 * (rate environment, deposit beta, volume, mix, repricing lag, prepayment,
 * credit quality). Bars above the reference line contribute positively to
 * NIM; below the line drag NIM down.
 */

interface NIMAttributionFactor {
  readonly factor: string;
  readonly factorEs: string;
  readonly bps: number;
  readonly explanation: string;
  readonly explanationEs: string;
}

interface NIMAttributionData {
  readonly nimCurrent: number;
  readonly nimPrior: number;
  readonly nimDeltaBps: number;
  readonly attribution: readonly NIMAttributionFactor[];
  readonly totalExplainedBps: number;
  readonly residualBps: number;
}

function validateNim(raw: unknown): NIMAttributionData {
  if (!raw || typeof raw !== 'object') throw new Error('NIM response must be an object');
  const r = raw as Record<string, unknown>;
  if (typeof r.nimCurrent !== 'number') throw new Error('NIM: missing nimCurrent');
  if (typeof r.nimPrior !== 'number') throw new Error('NIM: missing nimPrior');
  if (!Array.isArray(r.attribution)) throw new Error('NIM: attribution must be array');
  return r as unknown as NIMAttributionData;
}

function getDemo(): NIMAttributionData {
  return {
    nimCurrent: 3.42,
    nimPrior: 3.68,
    nimDeltaBps: -26,
    attribution: [
      { factor: 'Rate Environment', factorEs: 'Entorno de Tasas',    bps: -9, explanation: 'Fed rate changes impacting repricing.', explanationEs: 'Cambios Fed impactando repreciación.' },
      { factor: 'Deposit Beta',     factorEs: 'Beta de Depósitos',   bps: -7, explanation: 'Deposit costs rising faster than yields.', explanationEs: 'Costos de depósitos subiendo más rápido.' },
      { factor: 'Volume Growth',    factorEs: 'Crecimiento Volumen', bps:  4, explanation: 'New loans at current rates.', explanationEs: 'Nuevos préstamos a tasas actuales.' },
      { factor: 'Mix Shift',        factorEs: 'Cambio en Mezcla',    bps: -3, explanation: 'Shift toward lower-yield assets.', explanationEs: 'Movimiento hacia activos de menor rendimiento.' },
      { factor: 'Repricing Lag',    factorEs: 'Rezago Repreciación', bps: -5, explanation: 'Fixed-rate assets not yet repriced.', explanationEs: 'Activos de tasa fija sin repreciar.' },
      { factor: 'Prepayment',       factorEs: 'Prepago',             bps: -4, explanation: 'High-rate mortgages prepaying.', explanationEs: 'Hipotecas de alta tasa prepagando.' },
      { factor: 'Credit Quality',   factorEs: 'Calidad Crediticia',  bps: -2, explanation: 'Higher provisions.', explanationEs: 'Mayor provisión.' },
    ],
    totalExplainedBps: -26,
    residualBps: 0,
  };
}

function NimContent({ data }: { data: NIMAttributionData }) {
  const { locale } = useTranslation();

  const stripItems = useMemo<readonly MetricStripItem[]>(() => [
    { key: 'nim_prior',     label: locale === 'es' ? 'NIM Previo'   : 'NIM Prior',   value: data.nimPrior,   unit: '%' },
    { key: 'nim_current',   label: locale === 'es' ? 'NIM Actual'   : 'NIM Current', value: data.nimCurrent, unit: '%' },
    { key: 'nim_delta',     label: locale === 'es' ? 'Cambio NIM'   : 'NIM Change',  value: data.nimDeltaBps,unit: 'bps' },
    { key: 'explained_bps', label: locale === 'es' ? 'Explicado'    : 'Explained',   value: data.totalExplainedBps, unit: 'bps' },
    { key: 'residual_bps',  label: locale === 'es' ? 'Residual'     : 'Residual',    value: data.residualBps, unit: 'bps' },
  ], [data, locale]);

  const chartData = useMemo(
    () => data.attribution.map((f) => ({
      name: locale === 'es' ? f.factorEs : f.factor,
      bps: f.bps,
    })),
    [data, locale],
  );

  type FactorRow = NIMAttributionFactor;
  const columns = useMemo<readonly DataTableColumn<FactorRow>[]>(() => [
    {
      id: 'factor',
      header: locale === 'es' ? 'Factor' : 'Factor',
      kind: 'custom',
      accessor: (r) => r.factor,
      render: (r) => <span className="text-xs font-medium text-slate-800">{locale === 'es' ? r.factorEs : r.factor}</span>,
    },
    { id: 'bps',  header: 'bps',                                    kind: 'number', accessor: (r) => r.bps, unit: 'bps' },
    { id: 'exp',  header: locale === 'es' ? 'Explicación' : 'Explanation', kind: 'custom',
      accessor: (r) => r.explanation,
      render: (r) => (
        <span className="text-[11px] text-slate-500">{locale === 'es' ? r.explanationEs : r.explanation}</span>
      ),
      align: 'text-left',
    },
  ], [locale]);

  return (
    <>
      <MetricStrip items={stripItems} locale={locale} density="compact" />

      {/* Waterfall */}
      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <p className="mb-4 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
          {locale === 'es' ? 'Cascada de Factores NIM (bps)' : 'NIM Factor Waterfall (bps)'}
        </p>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-15} textAnchor="end" height={60} />
            <YAxis tick={{ fontSize: 11 }} label={{ value: 'bps', angle: -90, position: 'insideLeft', style: { fontSize: 10 } }} />
            <Tooltip contentStyle={{ borderRadius: 12, fontSize: 12 }} />
            <ReferenceLine y={0} stroke="#94a3b8" />
            <Bar dataKey="bps" radius={[4, 4, 0, 0]}>
              {chartData.map((entry) => (
                <Cell key={entry.name} fill={entry.bps >= 0 ? '#059669' : '#dc2626'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </section>

      {/* Factor detail table */}
      <section>
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
          {locale === 'es' ? 'Detalle por Factor' : 'Factor Detail'}
        </p>
        <DataTable
          rows={data.attribution}
          columns={columns}
          locale={locale}
          rowKey={(r) => r.factor}
        />
      </section>
    </>
  );
}

export default function NIMAttributionPage() {
  return (
    <AlmPage<NIMAttributionData>
      slug="nim-attribution"
      iconTint="amber"
      validate={validateNim}
      getDemo={getDemo}
    >
      {(data) => <NimContent data={data} />}
    </AlmPage>
  );
}
