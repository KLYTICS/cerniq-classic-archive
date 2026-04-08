'use client';

import { useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from 'recharts';

import { useTranslation } from '@/lib/i18n';
import { AlmPage } from '@/components/alm/AlmPage';
import { MetricStrip, type MetricStripItem } from '@/components/density/MetricStrip';
import { DataTable, type DataTableColumn } from '@/components/density/DataTable';

interface FRTBRiskClass {
  readonly name: string;
  readonly imcc: number;
  readonly ses: number;
  readonly total: number;
}

interface FRTBLiquidityHorizon {
  readonly horizon: string;
  readonly days: number;
  readonly capital: number;
}

interface FRTBResult {
  readonly imcc: number;
  readonly ses: number;
  readonly drc: number;
  readonly totalCapital: number;
  readonly riskClasses: readonly FRTBRiskClass[];
  readonly liquidityHorizons: readonly FRTBLiquidityHorizon[];
}

function validateFRTB(raw: unknown): FRTBResult {
  if (!raw || typeof raw !== 'object') throw new Error('FRTB response must be an object');
  const r = raw as Record<string, unknown>;
  if (typeof r.imcc !== 'number') throw new Error('FRTB: missing imcc');
  if (typeof r.ses !== 'number') throw new Error('FRTB: missing ses');
  if (typeof r.drc !== 'number') throw new Error('FRTB: missing drc');
  if (!Array.isArray(r.riskClasses)) throw new Error('FRTB: riskClasses must be array');
  return r as unknown as FRTBResult;
}

function getDemo(): FRTBResult {
  return {
    imcc: 8.4,
    ses: 5.2,
    drc: 3.1,
    totalCapital: 16.7,
    riskClasses: [
      { name: 'GIRR',      imcc: 3.8, ses: 2.1, total: 5.9 },
      { name: 'CSR',       imcc: 2.4, ses: 1.8, total: 4.2 },
      { name: 'Equity',    imcc: 1.2, ses: 0.8, total: 2.0 },
      { name: 'FX',        imcc: 0.7, ses: 0.3, total: 1.0 },
      { name: 'Commodity', imcc: 0.3, ses: 0.2, total: 0.5 },
    ],
    liquidityHorizons: [
      { horizon: 'LH 10d (Rates)',       days: 10,  capital: 3.2 },
      { horizon: 'LH 20d (Credit IG)',   days: 20,  capital: 4.1 },
      { horizon: 'LH 40d (Credit HY)',   days: 40,  capital: 2.8 },
      { horizon: 'LH 60d (Equity Large)',days: 60,  capital: 1.9 },
      { horizon: 'LH 120d (Equity Small)',days: 120,capital: 0.6 },
    ],
  };
}

function FRTBContent({ data }: { data: FRTBResult }) {
  const { locale } = useTranslation();

  const stripItems = useMemo<readonly MetricStripItem[]>(() => [
    { key: 'imcc',          label: 'IMCC',                                     value: data.imcc,         unit: 'USD_M' },
    { key: 'ses',           label: 'SES',                                      value: data.ses,          unit: 'USD_M' },
    { key: 'drc',           label: 'DRC',                                      value: data.drc,          unit: 'USD_M' },
    { key: 'total_capital', label: locale === 'es' ? 'Capital Total' : 'Total Capital', value: data.totalCapital, unit: 'USD_M' },
    { key: 'risk_classes',  label: locale === 'es' ? 'Clases Riesgo' : 'Risk Classes',  value: data.riskClasses.length, unit: 'count' },
    { key: 'lh_buckets',    label: locale === 'es' ? 'Horizontes LH' : 'Liquidity Horizons', value: data.liquidityHorizons.length, unit: 'count' },
  ], [data, locale]);

  const riskClassColumns = useMemo<readonly DataTableColumn<FRTBRiskClass>[]>(() => [
    { id: 'name',  header: locale === 'es' ? 'Clase' : 'Risk Class', kind: 'text', accessor: (r) => r.name, align: 'text-left' },
    { id: 'imcc',  header: 'IMCC',  kind: 'number', accessor: (r) => r.imcc,  unit: 'USD_M' },
    { id: 'ses',   header: 'SES',   kind: 'number', accessor: (r) => r.ses,   unit: 'USD_M' },
    { id: 'total', header: locale === 'es' ? 'Total' : 'Total', kind: 'number', accessor: (r) => r.total, unit: 'USD_M' },
  ], [locale]);

  const horizonColumns = useMemo<readonly DataTableColumn<FRTBLiquidityHorizon>[]>(() => [
    { id: 'horizon', header: locale === 'es' ? 'Horizonte' : 'Horizon', kind: 'text', accessor: (r) => r.horizon, align: 'text-left' },
    { id: 'days',    header: locale === 'es' ? 'Días'       : 'Days',    kind: 'number', accessor: (r) => r.days,    unit: 'days' },
    { id: 'capital', header: locale === 'es' ? 'Capital'    : 'Capital', kind: 'number', accessor: (r) => r.capital, unit: 'USD_M' },
  ], [locale]);

  return (
    <>
      <MetricStrip items={stripItems} locale={locale} density="compact" />

      {/* Stacked bar by risk class */}
      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <p className="mb-4 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
          {locale === 'es' ? 'Capital por Clase de Riesgo (IMCC + SES)' : 'Capital by Risk Class (IMCC + SES)'}
        </p>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={data.riskClasses as FRTBRiskClass[]}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="name" tick={{ fontSize: 11 }} />
            <YAxis tickFormatter={(v) => `$${v}M`} tick={{ fontSize: 11 }} />
            <Tooltip contentStyle={{ borderRadius: 12, fontSize: 12 }} formatter={(value) => `$${Number(value ?? 0).toFixed(2)}M`} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Bar dataKey="imcc" name="IMCC" stackId="a" fill="#0ea5e9" />
            <Bar dataKey="ses"  name="SES"  stackId="a" fill="#f97316" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </section>

      {/* Risk classes table */}
      <section>
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
          {locale === 'es' ? 'Detalle por Clase de Riesgo' : 'Risk Class Detail'}
        </p>
        <DataTable rows={data.riskClasses} columns={riskClassColumns} locale={locale} rowKey={(r) => r.name} />
      </section>

      {/* Liquidity horizons table */}
      <section>
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
          {locale === 'es' ? 'Horizontes de Liquidez' : 'Liquidity Horizons'}
        </p>
        <DataTable rows={data.liquidityHorizons} columns={horizonColumns} locale={locale} rowKey={(r) => r.horizon} />
      </section>
    </>
  );
}

export default function FRTBIMAPage() {
  return (
    <AlmPage<FRTBResult>
      slug="frtb-ima"
      iconTint="sky"
      validate={validateFRTB}
      getDemo={getDemo}
    >
      {(data) => <FRTBContent data={data} />}
    </AlmPage>
  );
}
