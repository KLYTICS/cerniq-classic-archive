'use client';

import { useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell,
} from 'recharts';

import { useTranslation } from '@/lib/i18n';
import { AlmPage } from '@/components/alm/AlmPage';
import { MetricStrip, type MetricStripItem } from '@/components/density/MetricStrip';
import { DataTable, type DataTableColumn } from '@/components/density/DataTable';

interface RBC2Component {
  readonly name: string;
  readonly code: string;
  readonly amount: number;
  readonly riskWeight: number;
  readonly weighted: number;
}

interface RBC2Thresholds {
  readonly wellCapitalized: number;
  readonly adequately: number;
  readonly undercapitalized: number;
}

interface RBC2Result {
  readonly totalRiskWeightedAssets: number;
  readonly netWorth: number;
  readonly rbc2Ratio: number;
  readonly wellCapitalized: boolean;
  readonly components: readonly RBC2Component[];
  readonly thresholds: RBC2Thresholds;
}

const COMPONENT_COLORS = [
  '#0ea5e9', '#6366f1', '#f59e0b', '#10b981',
  '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6',
] as const;

function validateRBC2(raw: unknown): RBC2Result {
  if (!raw || typeof raw !== 'object') throw new Error('RBC2 response must be an object');
  const r = raw as Record<string, unknown>;
  if (typeof r.rbc2Ratio !== 'number') throw new Error('RBC2: missing rbc2Ratio');
  if (!Array.isArray(r.components)) throw new Error('RBC2: components must be array');
  return r as unknown as RBC2Result;
}

function getDemo(): RBC2Result {
  return {
    totalRiskWeightedAssets: 285.4,
    netWorth: 32.8,
    rbc2Ratio: 0.1149,
    wellCapitalized: true,
    thresholds: { wellCapitalized: 0.10, adequately: 0.08, undercapitalized: 0.06 },
    components: [
      { name: 'Net Amount of Loans', code: 'RC-1', amount: 180,  riskWeight: 0.60, weighted: 108.0 },
      { name: 'Investments > 5Y',    code: 'RC-2', amount: 65,   riskWeight: 0.50, weighted: 32.5  },
      { name: 'Investments 1-5Y',    code: 'RC-3', amount: 45,   riskWeight: 0.25, weighted: 11.25 },
      { name: 'Real Estate Owned',   code: 'RC-4', amount: 3.5,  riskWeight: 1.00, weighted: 3.5   },
      { name: 'Delinquent Loans',    code: 'RC-5', amount: 8.2,  riskWeight: 1.50, weighted: 12.3  },
      { name: 'CUSO Investments',    code: 'RC-6', amount: 5.0,  riskWeight: 1.00, weighted: 5.0   },
      { name: 'Concentration Risk',  code: 'RC-7', amount: 42,   riskWeight: 0.75, weighted: 31.5  },
      { name: 'Interest Rate Risk',  code: 'RC-8', amount: 162,  riskWeight: 0.50, weighted: 81.0  },
    ],
  };
}

interface ComponentRow extends RBC2Component {
  readonly color: string;
}

function RBC2Content({ data }: { data: RBC2Result }) {
  const { locale } = useTranslation();

  const status =
    data.rbc2Ratio >= data.thresholds.wellCapitalized ? 'well' :
    data.rbc2Ratio >= data.thresholds.adequately ? 'adequate' :
    data.rbc2Ratio >= data.thresholds.undercapitalized ? 'under' :
    'critical';
  const statusStyles = {
    well:     { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700', label: locale === 'es' ? 'Bien Capitalizado' : 'Well Capitalized' },
    adequate: { bg: 'bg-amber-50',   border: 'border-amber-200',   text: 'text-amber-700',   label: locale === 'es' ? 'Adecuadamente Capitalizado' : 'Adequately Capitalized' },
    under:    { bg: 'bg-orange-50',  border: 'border-orange-200',  text: 'text-orange-700',  label: locale === 'es' ? 'Subcapitalizado' : 'Undercapitalized' },
    critical: { bg: 'bg-rose-50',    border: 'border-rose-200',    text: 'text-rose-700',    label: locale === 'es' ? 'Crítico' : 'Critically Undercapitalized' },
  }[status];

  const stripItems = useMemo<readonly MetricStripItem[]>(() => [
    { key: 'rbc2_ratio',        label: locale === 'es' ? 'Ratio RBC2'        : 'RBC2 Ratio',          value: data.rbc2Ratio,                  unit: 'ratio' },
    { key: 'net_worth',         label: locale === 'es' ? 'Patrimonio Neto'    : 'Net Worth',          value: data.netWorth,                   unit: 'USD_M' },
    { key: 'total_rwa',         label: locale === 'es' ? 'Activos Pond.'     : 'Risk-Weighted',       value: data.totalRiskWeightedAssets,    unit: 'USD_M' },
    { key: 'well_cap_thresh',   label: locale === 'es' ? 'Umbral Bien'       : 'Well-Cap Threshold',  value: data.thresholds.wellCapitalized, unit: 'ratio' },
    { key: 'adequate_thresh',   label: locale === 'es' ? 'Umbral Adec.'      : 'Adequate Threshold',  value: data.thresholds.adequately,      unit: 'ratio' },
    { key: 'component_count',   label: locale === 'es' ? 'Componentes'       : 'Components',          value: data.components.length,          unit: 'count' },
  ], [data, locale]);

  const componentRows = useMemo<readonly ComponentRow[]>(
    () => data.components.map((c, i) => ({ ...c, color: COMPONENT_COLORS[i % COMPONENT_COLORS.length]! })),
    [data],
  );

  const columns = useMemo<readonly DataTableColumn<ComponentRow>[]>(() => [
    { id: 'code', header: locale === 'es' ? 'Código' : 'Code', kind: 'custom',
      accessor: (r) => r.code,
      render: (r) => (
        <span className="inline-flex items-center gap-2 font-mono text-xs tabular-nums text-slate-700">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: r.color }} aria-hidden />
          {r.code}
        </span>
      ),
      align: 'text-left',
    },
    { id: 'name',   header: locale === 'es' ? 'Componente' : 'Component', kind: 'text', accessor: (r) => r.name, align: 'text-left' },
    { id: 'amount', header: locale === 'es' ? 'Monto'       : 'Amount',   kind: 'number', accessor: (r) => r.amount,     unit: 'USD_M' },
    { id: 'weight', header: locale === 'es' ? 'Peso'        : 'Weight',   kind: 'number', accessor: (r) => r.riskWeight, unit: 'ratio' },
    { id: 'weighted', header: locale === 'es' ? 'Ponderado' : 'Weighted', kind: 'number', accessor: (r) => r.weighted,   unit: 'USD_M' },
  ], [locale]);

  return (
    <>
      <MetricStrip items={stripItems} locale={locale} density="compact" />

      {/* Status banner */}
      <section className={`flex items-center justify-between rounded-xl border p-4 ${statusStyles.bg} ${statusStyles.border}`}>
        <div>
          <p className={`text-sm font-bold ${statusStyles.text}`}>{statusStyles.label}</p>
          <p className="text-xs text-slate-600">
            {locale === 'es' ? 'Per Letter NCUA 15-CU-02' : 'Per NCUA Letter 15-CU-02'}
          </p>
        </div>
        <div className={`font-mono text-xl font-bold tabular-nums ${statusStyles.text}`}>
          {(data.rbc2Ratio * 100).toFixed(2)}%
        </div>
      </section>

      {/* Component waterfall */}
      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <p className="mb-4 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
          {locale === 'es' ? '8 Componentes Ponderados por Riesgo' : '8 Risk-Weighted Components'}
        </p>
        <ResponsiveContainer width="100%" height={320}>
          <BarChart
            data={componentRows as unknown as RBC2Component[]}
            layout="vertical"
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis type="number" tickFormatter={(v) => `$${v}M`} tick={{ fontSize: 11 }} />
            <YAxis type="category" dataKey="code" width={60} tick={{ fontSize: 11 }} />
            <Tooltip
              contentStyle={{ borderRadius: 12, fontSize: 12 }}
              formatter={(value) => [`$${Number(value ?? 0).toFixed(2)}M`, locale === 'es' ? 'Ponderado' : 'Weighted']}
              labelFormatter={(l) => data.components.find((c) => c.code === l)?.name ?? String(l)}
            />
            <Bar dataKey="weighted" radius={[0, 4, 4, 0]}>
              {componentRows.map((c) => (
                <Cell key={c.code} fill={c.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </section>

      {/* Component detail table */}
      <section>
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
          {locale === 'es' ? 'Detalle de Componentes' : 'Component Detail'}
        </p>
        <DataTable rows={componentRows} columns={columns} locale={locale} rowKey={(r) => r.code} />
      </section>
    </>
  );
}

export default function RBC2Page() {
  return (
    <AlmPage<RBC2Result>
      slug="rbc2"
      iconTint="blue"
      validate={validateRBC2}
      getDemo={getDemo}
    >
      {(data) => <RBC2Content data={data} />}
    </AlmPage>
  );
}
