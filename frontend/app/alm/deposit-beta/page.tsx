'use client';

import { useState, useEffect } from 'react';
import { useALM } from '@/components/alm/ALMProvider';
import { useTranslation } from '@/lib/i18n';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Cell, LineChart, Line } from 'recharts';
import { SlidersHorizontal, AlertTriangle, Database } from 'lucide-react';

interface DepositBetaResult {
  institutionBetas: Array<{ subcategory: string; beta: number; benchmark: number; p25: number; p75: number }>;
  niiImpact: { withCalibrated: number; withDefault: number; difference: number };
  libraryStats: { institutions: number; dateRange: string; categories: number };
  timeSeriesComparison: Array<{ period: string; ffr: number; savingsRate: number; cdRate: number; mmRate: number }>;
}

export default function DepositBetaPage() {
  const { selectedId } = useALM();
  const { locale } = useTranslation();
  const [data, setData] = useState<DepositBetaResult | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!selectedId) return;
    (async () => {
      setLoading(true);
      try {
        const NODE = (process.env.NEXT_PUBLIC_NODE_API_URL || '').trim().replace(/\/+$/, '');
        const res = await fetch(`${NODE}/api/alm/${selectedId}/deposit-betas`);
        if (res.ok) setData(await res.json());
        else setData(getDemo());
      } catch { setData(getDemo()); }
      finally { setLoading(false); }
    })();
  }, [selectedId]);

  if (!selectedId) return <div className="flex-1 flex items-center justify-center p-6"><AlertTriangle className="h-12 w-12 text-amber-500" /></div>;
  if (loading || !data) return <div className="flex-1 flex items-center justify-center p-6"><div className="h-8 w-8 animate-spin rounded-full border-2 border-cyan-200 border-t-cyan-600" /></div>;

  const betaColor = (b: number) => b < 0.3 ? '#22c55e' : b < 0.6 ? '#eab308' : '#ef4444';

  return (
    <div className="p-6 space-y-5 max-w-[1400px] mx-auto">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-cyan-200 bg-cyan-50">
          <SlidersHorizontal className="h-4 w-4 text-cyan-700" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-slate-950">{locale === 'es' ? 'Calibración Beta de Depósitos' : 'Deposit Beta Calibration'}</h1>
          <p className="text-xs text-slate-500">{locale === 'es' ? 'Betas OLS por subcategoría vs biblioteca PR de 94 instituciones' : 'OLS betas by subcategory vs PR library of 94 institutions'}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KPI label={locale === 'es' ? 'NII con Beta Calibrado' : 'NII w/ Calibrated Beta'} value={`$${data.niiImpact.withCalibrated.toFixed(1)}M`} accent />
        <KPI label={locale === 'es' ? 'NII con Beta Default' : 'NII w/ Default Beta'} value={`$${data.niiImpact.withDefault.toFixed(1)}M`} />
        <KPI label={locale === 'es' ? 'Diferencia' : 'Difference'} value={`$${data.niiImpact.difference.toFixed(1)}M`} warn={Math.abs(data.niiImpact.difference) > 1} />
        <div className="rounded-xl border border-cyan-200 bg-cyan-50 p-3">
          <p className="text-[10px] font-medium uppercase text-cyan-600"><Database className="inline h-3 w-3 mr-1" />{locale === 'es' ? 'Biblioteca PR' : 'PR Library'}</p>
          <p className="text-lg font-bold text-cyan-800">{data.libraryStats.institutions}</p>
          <p className="text-[10px] text-cyan-600">{data.libraryStats.dateRange}</p>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-4">
          {locale === 'es' ? 'Beta por Subcategoría vs Benchmark PR' : 'Beta by Subcategory vs PR Benchmark'}
        </p>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={data.institutionBetas} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis type="number" domain={[0, 1]} tick={{ fontSize: 11 }} tickFormatter={v => `${(v * 100).toFixed(0)}%`} />
            <YAxis type="category" dataKey="subcategory" width={140} tick={{ fontSize: 11 }} />
            <Tooltip
              contentStyle={{ borderRadius: 12, fontSize: 12 }}
              formatter={(value) => `${(Number(value ?? 0) * 100).toFixed(1)}%`}
            />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Bar dataKey="beta" name={locale === 'es' ? 'Tu Beta' : 'Your Beta'} radius={[0, 4, 4, 0]}>
              {data.institutionBetas.map((b, i) => <Cell key={i} fill={betaColor(b.beta)} />)}
            </Bar>
            <Bar dataKey="benchmark" name={locale === 'es' ? 'Benchmark PR' : 'PR Benchmark'} fill="#94a3b8" radius={[0, 4, 4, 0]} opacity={0.5} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-4">
          {locale === 'es' ? 'Tasas de Depósito vs FFR (Pass-Through)' : 'Deposit Rates vs FFR (Pass-Through)'}
        </p>
        <ResponsiveContainer width="100%" height={250}>
          <LineChart data={data.timeSeriesComparison}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="period" tick={{ fontSize: 10 }} />
            <YAxis tickFormatter={v => `${v}%`} tick={{ fontSize: 11 }} />
            <Tooltip
              contentStyle={{ borderRadius: 12, fontSize: 12 }}
              formatter={(value) => `${Number(value ?? 0).toFixed(2)}%`}
            />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Line type="monotone" dataKey="ffr" name="Fed Funds Rate" stroke="#0f172a" strokeWidth={2.5} dot={false} />
            <Line type="monotone" dataKey="savingsRate" name={locale === 'es' ? 'Ahorros' : 'Savings'} stroke="#22c55e" strokeWidth={1.5} dot={false} />
            <Line type="monotone" dataKey="cdRate" name="CDs" stroke="#f59e0b" strokeWidth={1.5} dot={false} />
            <Line type="monotone" dataKey="mmRate" name="Money Market" stroke="#6366f1" strokeWidth={1.5} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-3">
          {locale === 'es' ? 'Detalle por Subcategoría' : 'Subcategory Detail'}
        </p>
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-slate-200">
              <th className="py-2 text-left text-slate-500">{locale === 'es' ? 'Categoría' : 'Category'}</th>
              <th className="py-2 text-right text-slate-500">{locale === 'es' ? 'Tu Beta' : 'Your Beta'}</th>
              <th className="py-2 text-right text-slate-500">{locale === 'es' ? 'Benchmark' : 'Benchmark'}</th>
              <th className="py-2 text-right text-slate-500">P25</th>
              <th className="py-2 text-right text-slate-500">P75</th>
              <th className="py-2 text-right text-slate-500">{locale === 'es' ? 'Estado' : 'Status'}</th>
            </tr>
          </thead>
          <tbody>
            {data.institutionBetas.map((b, i) => (
              <tr key={i} className="border-b border-slate-100">
                <td className="py-1.5 text-slate-700">{b.subcategory}</td>
                <td className="py-1.5 text-right tabular-nums font-bold" style={{ color: betaColor(b.beta) }}>{(b.beta * 100).toFixed(1)}%</td>
                <td className="py-1.5 text-right tabular-nums text-slate-500">{(b.benchmark * 100).toFixed(1)}%</td>
                <td className="py-1.5 text-right tabular-nums text-slate-400">{(b.p25 * 100).toFixed(1)}%</td>
                <td className="py-1.5 text-right tabular-nums text-slate-400">{(b.p75 * 100).toFixed(1)}%</td>
                <td className="py-1.5 text-right">
                  <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-bold ${
                    b.beta <= b.p75 && b.beta >= b.p25 ? 'bg-emerald-100 text-emerald-700' :
                    b.beta > b.p75 ? 'bg-amber-100 text-amber-700' : 'bg-sky-100 text-sky-700'
                  }`}>
                    {b.beta <= b.p75 && b.beta >= b.p25 ? 'NORMAL' : b.beta > b.p75 ? 'HIGH' : 'LOW'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function KPI({ label, value, accent, warn }: { label: string; value: string; accent?: boolean; warn?: boolean }) {
  return (
    <div className={`rounded-xl border p-3 ${warn ? 'border-rose-200 bg-rose-50' : accent ? 'border-emerald-200 bg-emerald-50' : 'border-slate-200 bg-white'}`}>
      <p className="text-[10px] font-medium uppercase text-slate-400">{label}</p>
      <p className={`text-lg font-bold tabular-nums ${warn ? 'text-rose-700' : accent ? 'text-emerald-700' : 'text-slate-950'}`}>{value}</p>
    </div>
  );
}

function getDemo(): DepositBetaResult {
  return {
    institutionBetas: [
      { subcategory: 'Demand Deposits', beta: 0.08, benchmark: 0.12, p25: 0.05, p75: 0.18 },
      { subcategory: 'Regular Savings', beta: 0.32, benchmark: 0.38, p25: 0.25, p75: 0.48 },
      { subcategory: 'Money Market', beta: 0.55, benchmark: 0.52, p25: 0.40, p75: 0.65 },
      { subcategory: 'Share Certificates (CDs)', beta: 0.78, benchmark: 0.82, p25: 0.70, p75: 0.90 },
      { subcategory: 'IRA Deposits', beta: 0.65, benchmark: 0.60, p25: 0.50, p75: 0.72 },
      { subcategory: 'Club Accounts', beta: 0.15, benchmark: 0.20, p25: 0.10, p75: 0.28 },
    ],
    niiImpact: { withCalibrated: 37.2, withDefault: 35.8, difference: 1.4 },
    libraryStats: { institutions: 94, dateRange: '2015-2024', categories: 6 },
    timeSeriesComparison: [
      { period: 'Q1 22', ffr: 0.25, savingsRate: 0.10, cdRate: 0.50, mmRate: 0.15 },
      { period: 'Q2 22', ffr: 1.25, savingsRate: 0.15, cdRate: 0.75, mmRate: 0.30 },
      { period: 'Q3 22', ffr: 2.50, savingsRate: 0.25, cdRate: 1.50, mmRate: 0.80 },
      { period: 'Q4 22', ffr: 4.00, savingsRate: 0.50, cdRate: 2.80, mmRate: 1.60 },
      { period: 'Q1 23', ffr: 4.75, savingsRate: 0.75, cdRate: 3.50, mmRate: 2.20 },
      { period: 'Q2 23', ffr: 5.00, savingsRate: 0.90, cdRate: 4.00, mmRate: 2.60 },
      { period: 'Q3 23', ffr: 5.25, savingsRate: 1.00, cdRate: 4.20, mmRate: 2.80 },
      { period: 'Q4 23', ffr: 5.25, savingsRate: 1.10, cdRate: 4.30, mmRate: 2.90 },
      { period: 'Q1 24', ffr: 5.25, savingsRate: 1.15, cdRate: 4.35, mmRate: 3.00 },
      { period: 'Q2 24', ffr: 5.25, savingsRate: 1.20, cdRate: 4.40, mmRate: 3.10 },
      { period: 'Q3 24', ffr: 5.00, savingsRate: 1.15, cdRate: 4.20, mmRate: 2.90 },
      { period: 'Q4 24', ffr: 4.75, savingsRate: 1.10, cdRate: 4.00, mmRate: 2.70 },
    ],
  };
}
