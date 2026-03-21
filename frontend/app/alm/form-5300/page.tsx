'use client';

import { useState, useEffect } from 'react';
import { useALM } from '@/components/alm/ALMProvider';
import { useTranslation } from '@/lib/i18n';
import { FileSpreadsheet, AlertTriangle, Check, X, Download } from 'lucide-react';

export default function Form5300Page() {
  const { selectedId } = useALM();
  const { locale } = useTranslation();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!selectedId) return;
    (async () => {
      setLoading(true);
      try {
        const NODE_API_URL = (process.env.NEXT_PUBLIC_NODE_API_URL || '').trim().replace(/\/+$/, '');
        const res = await fetch(`${NODE_API_URL}/api/alm/${selectedId}/form-5300`);
        if (res.ok) setData(await res.json());
        else setData(getDemoData());
      } catch { setData(getDemoData()); }
      finally { setLoading(false); }
    })();
  }, [selectedId]);

  if (!selectedId) return <div className="flex-1 flex items-center justify-center p-6"><AlertTriangle className="h-12 w-12 text-amber-500" /></div>;
  if (loading || !data) return <div className="flex-1 flex items-center justify-center p-6"><div className="h-8 w-8 animate-spin rounded-full border-2 border-cyan-200 border-t-cyan-600" /></div>;

  const vr = data.validationResult;

  return (
    <div className="p-6 space-y-5 max-w-[1400px] mx-auto">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-sky-200 bg-sky-50">
            <FileSpreadsheet className="h-4 w-4 text-sky-700" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-950">NCUA Form 5300 — {data.quarter}</h1>
            <p className="text-xs text-slate-500">{locale === 'es' ? 'Auto-generado desde datos CERNIQ' : 'Auto-populated from CERNIQ data'}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-600 hover:border-slate-300"><Download className="h-3.5 w-3.5" /> XML</button>
          <button className="flex items-center gap-1.5 rounded-xl bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-700"><Download className="h-4 w-4" /> PDF</button>
        </div>
      </div>

      {/* Validation Status */}
      <div className={`flex items-center gap-3 rounded-xl border p-4 ${vr.valid ? 'border-emerald-200 bg-emerald-50' : 'border-rose-200 bg-rose-50'}`}>
        {vr.valid ? <Check className="h-6 w-6 text-emerald-600" /> : <X className="h-6 w-6 text-rose-600" />}
        <div>
          <p className={`text-sm font-bold ${vr.valid ? 'text-emerald-700' : 'text-rose-700'}`}>
            {vr.valid ? (locale === 'es' ? 'Validación Aprobada' : 'Validation Passed') : (locale === 'es' ? 'Errores de Validación' : 'Validation Errors')}
          </p>
          <p className="text-xs text-slate-600">{vr.errors.length} {locale === 'es' ? 'errores' : 'errors'}, {vr.warnings.length} {locale === 'es' ? 'advertencias' : 'warnings'}</p>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { l: locale === 'es' ? 'Activos Totales' : 'Total Assets', v: `$${data.summary.totalAssets}M` },
          { l: locale === 'es' ? 'Pasivos Totales' : 'Total Liabilities', v: `$${data.summary.totalLiabilities}M` },
          { l: locale === 'es' ? 'Capital Neto' : 'Net Worth', v: `$${data.summary.netWorth}M` },
          { l: 'NWR', v: `${data.summary.netWorthRatio}%` },
        ].map(({ l, v }) => (
          <div key={l} className="rounded-xl border border-slate-200 bg-white p-3">
            <p className="text-[10px] font-medium uppercase text-slate-400">{l}</p>
            <p className="text-lg font-bold tabular-nums text-slate-950">{v}</p>
          </div>
        ))}
      </div>

      {/* Fields Table */}
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-100">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">NCUA 5300 {locale === 'es' ? 'Campos' : 'Fields'} ({data.fields.length})</p>
        </div>
        <div className="max-h-[400px] overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-slate-50">
              <tr className="border-b border-slate-100">
                {[locale === 'es' ? 'Código' : 'Code', locale === 'es' ? 'Descripción' : 'Label', locale === 'es' ? 'Valor ($M)' : 'Value ($M)', 'Schedule', locale === 'es' ? 'Fuente' : 'Source'].map(h => (
                  <th key={h} className="px-3 py-2 text-left text-[10px] font-medium text-slate-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.fields.map((f: any, i: number) => (
                <tr key={i} className="border-b border-slate-50 last:border-0">
                  <td className="px-3 py-2 text-xs font-mono text-slate-600">{f.accountCode}</td>
                  <td className="px-3 py-2 text-xs text-slate-700">{f.label}</td>
                  <td className="px-3 py-2 text-xs tabular-nums font-medium text-slate-800">{f.value.toFixed(1)}</td>
                  <td className="px-3 py-2 text-xs text-slate-500">{f.schedule}</td>
                  <td className="px-3 py-2 text-[10px] text-slate-400">{f.sourceField}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function getDemoData() {
  return {
    quarter: '2026Q1', charterNumber: '12345',
    fields: [
      { accountCode: '010', label: 'Cash & Cash Equivalents', value: 45, schedule: 'A', sourceField: 'BalanceSheetItem.cash' },
      { accountCode: '799B', label: 'Total Investments', value: 50, schedule: 'A', sourceField: 'BalanceSheetItem.securities' },
      { accountCode: '025A', label: 'Personal Loans', value: 85, schedule: 'A', sourceField: 'BalanceSheetItem.consumer_loans' },
      { accountCode: '703', label: 'First Mortgage RE', value: 95, schedule: 'A', sourceField: 'BalanceSheetItem.residential_mortgage' },
      { accountCode: '010A', label: 'Regular Shares', value: 180, schedule: 'C', sourceField: 'BalanceSheetItem.demand_deposits' },
      { accountCode: '050', label: 'Share Certificates', value: 75, schedule: 'C', sourceField: 'BalanceSheetItem.time_deposits' },
      { accountCode: '010TOTAL', label: 'Total Assets', value: 445, schedule: 'A', sourceField: 'computed' },
      { accountCode: '931', label: 'Net Worth', value: 40, schedule: 'D', sourceField: 'computed' },
    ],
    validationResult: { valid: true, errors: [], warnings: [{ code: 'EC-020', description: 'Delinquent loans approaching 6% threshold' }] },
    summary: { totalAssets: 445, totalLiabilities: 385, netWorth: 60, netWorthRatio: 13.5, totalLoans: 300, totalShares: 330, totalInvestments: 50 },
  };
}
