'use client';

import { useMemo } from 'react';
import { Check, X, Download } from 'lucide-react';

import { useTranslation } from '@/lib/i18n';
import { AlmPage } from '@/components/alm/AlmPage';
import { MetricStrip, type MetricStripItem } from '@/components/density/MetricStrip';
import { DataTable, type DataTableColumn } from '@/components/density/DataTable';

interface Form5300Field {
  readonly accountCode: string;
  readonly label: string;
  readonly value: number;
  readonly schedule: string;
  readonly sourceField: string;
}

interface Form5300ValidationNotice {
  readonly code: string;
  readonly description: string;
}

interface Form5300Data {
  readonly quarter: string;
  readonly charterNumber: string;
  readonly fields: readonly Form5300Field[];
  readonly validationResult: {
    readonly valid: boolean;
    readonly errors: readonly Form5300ValidationNotice[];
    readonly warnings: readonly Form5300ValidationNotice[];
  };
  readonly summary: {
    readonly totalAssets: number;
    readonly totalLiabilities: number;
    readonly netWorth: number;
    readonly netWorthRatio: number;
    readonly totalLoans: number;
    readonly totalShares: number;
    readonly totalInvestments: number;
  };
}

function validateForm5300(raw: unknown): Form5300Data {
  if (!raw || typeof raw !== 'object') throw new Error('Form 5300 response must be an object');
  const r = raw as Record<string, unknown>;
  if (!Array.isArray(r.fields)) throw new Error('Form 5300: fields must be array');
  if (!r.validationResult || !r.summary) throw new Error('Form 5300: missing validationResult or summary');
  return r as unknown as Form5300Data;
}

function getDemo(): Form5300Data {
  return {
    quarter: '2026Q1',
    charterNumber: '12345',
    fields: [
      { accountCode: '010',      label: 'Cash & Cash Equivalents', value: 45,  schedule: 'A', sourceField: 'BalanceSheetItem.cash' },
      { accountCode: '799B',     label: 'Total Investments',        value: 50,  schedule: 'A', sourceField: 'BalanceSheetItem.securities' },
      { accountCode: '025A',     label: 'Personal Loans',           value: 85,  schedule: 'A', sourceField: 'BalanceSheetItem.consumer_loans' },
      { accountCode: '703',      label: 'First Mortgage RE',        value: 95,  schedule: 'A', sourceField: 'BalanceSheetItem.residential_mortgage' },
      { accountCode: '010A',     label: 'Regular Shares',           value: 180, schedule: 'C', sourceField: 'BalanceSheetItem.demand_deposits' },
      { accountCode: '050',      label: 'Share Certificates',       value: 75,  schedule: 'C', sourceField: 'BalanceSheetItem.time_deposits' },
      { accountCode: '010TOTAL', label: 'Total Assets',             value: 445, schedule: 'A', sourceField: 'computed' },
      { accountCode: '931',      label: 'Net Worth',                value: 40,  schedule: 'D', sourceField: 'computed' },
    ],
    validationResult: {
      valid: true,
      errors: [],
      warnings: [{ code: 'EC-020', description: 'Delinquent loans approaching 6% threshold' }],
    },
    summary: { totalAssets: 445, totalLiabilities: 385, netWorth: 60, netWorthRatio: 13.5, totalLoans: 300, totalShares: 330, totalInvestments: 50 },
  };
}

function Form5300Content({ data }: { data: Form5300Data }) {
  const { locale } = useTranslation();
  const vr = data.validationResult;

  const stripItems = useMemo<readonly MetricStripItem[]>(() => [
    { key: 'total_assets',     label: locale === 'es' ? 'Activos'    : 'Total Assets',     value: data.summary.totalAssets,     unit: 'USD_M' },
    { key: 'total_liabilities',label: locale === 'es' ? 'Pasivos'    : 'Total Liabilities', value: data.summary.totalLiabilities, unit: 'USD_M' },
    { key: 'net_worth',        label: locale === 'es' ? 'Capital'    : 'Net Worth',         value: data.summary.netWorth,         unit: 'USD_M' },
    { key: 'nwr',              label: 'NWR',                                                 value: data.summary.netWorthRatio,    unit: '%' },
    { key: 'total_loans',      label: locale === 'es' ? 'Préstamos'  : 'Total Loans',        value: data.summary.totalLoans,       unit: 'USD_M' },
    { key: 'total_shares',     label: locale === 'es' ? 'Aportaciones' : 'Total Shares',     value: data.summary.totalShares,      unit: 'USD_M' },
    { key: 'field_count',      label: locale === 'es' ? 'Campos'     : 'Fields',            value: data.fields.length,            unit: 'count' },
  ], [data, locale]);

  const columns = useMemo<readonly DataTableColumn<Form5300Field>[]>(() => [
    { id: 'code',     header: locale === 'es' ? 'Código' : 'Code', kind: 'custom',
      accessor: (r) => r.accountCode,
      render: (r) => <span className="font-mono text-xs text-slate-600">{r.accountCode}</span>,
      align: 'text-left',
    },
    { id: 'label',    header: locale === 'es' ? 'Descripción' : 'Label', kind: 'text', accessor: (r) => r.label, align: 'text-left' },
    { id: 'value',    header: locale === 'es' ? 'Valor' : 'Value',        kind: 'number', accessor: (r) => r.value, unit: 'USD_M' },
    { id: 'schedule', header: 'Sched',                                    kind: 'text',   accessor: (r) => r.schedule },
    { id: 'source',   header: locale === 'es' ? 'Fuente' : 'Source', kind: 'custom',
      accessor: (r) => r.sourceField,
      render: (r) => <span className="font-mono text-[10px] text-slate-400">{r.sourceField}</span>,
      align: 'text-left',
    },
  ], [locale]);

  return (
    <>
      <div className="text-[11px] text-slate-500">
        {locale === 'es' ? 'Trimestre' : 'Quarter'}: <strong>{data.quarter}</strong> · Charter: <strong>{data.charterNumber}</strong>
      </div>

      <MetricStrip items={stripItems} locale={locale} density="compact" />

      {/* Validation banner */}
      <section className={`flex items-center gap-3 rounded-xl border p-4 ${
        vr.valid ? 'border-emerald-200 bg-emerald-50' : 'border-rose-200 bg-rose-50'
      }`}>
        {vr.valid ? <Check className="h-6 w-6 text-emerald-600" /> : <X className="h-6 w-6 text-rose-600" />}
        <div className="flex-1">
          <p className={`text-sm font-bold ${vr.valid ? 'text-emerald-700' : 'text-rose-700'}`}>
            {vr.valid
              ? (locale === 'es' ? 'Validación Aprobada' : 'Validation Passed')
              : (locale === 'es' ? 'Errores de Validación' : 'Validation Errors')}
          </p>
          <p className="text-xs text-slate-600">
            {vr.errors.length} {locale === 'es' ? 'errores' : 'errors'}, {vr.warnings.length} {locale === 'es' ? 'advertencias' : 'warnings'}
          </p>
        </div>
      </section>

      {/* Warnings list (if any) */}
      {vr.warnings.length > 0 ? (
        <section className="rounded-xl border border-amber-200 bg-amber-50/50 p-4">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-700">
            {locale === 'es' ? 'Advertencias' : 'Warnings'}
          </p>
          <ul className="space-y-1">
            {vr.warnings.map((w) => (
              <li key={w.code} className="text-xs text-amber-800">
                <span className="font-mono font-bold">{w.code}</span> — {w.description}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* Fields table */}
      <section>
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
          NCUA 5300 {locale === 'es' ? 'Campos' : 'Fields'} ({data.fields.length})
        </p>
        <DataTable rows={data.fields} columns={columns} locale={locale} rowKey={(r) => r.accountCode} />
      </section>
    </>
  );
}

export default function Form5300Page() {
  const { locale } = useTranslation();
  return (
    <AlmPage<Form5300Data>
      slug="form-5300"
      iconTint="sky"
      validate={validateForm5300}
      getDemo={getDemo}
      controls={
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:border-slate-300"
          >
            <Download className="h-3.5 w-3.5" />
            XML
          </button>
          <button
            type="button"
            className="inline-flex items-center gap-1.5 rounded-lg bg-sky-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-sky-700"
          >
            <Download className="h-3.5 w-3.5" />
            {locale === 'es' ? 'PDF' : 'PDF'}
          </button>
        </div>
      }
    >
      {(data) => <Form5300Content data={data} />}
    </AlmPage>
  );
}
