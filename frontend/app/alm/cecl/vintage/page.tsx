'use client';

import { useState, useEffect, useCallback } from 'react';
import { useALM } from '@/components/alm/ALMProvider';
import { useTranslation } from '@/lib/i18n';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from 'recharts';
import { Layers, AlertTriangle } from 'lucide-react';

export default function CECLVintagePage() {
  const { selectedId } = useALM();
  const { locale } = useTranslation();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [scenario, setScenario] = useState<'base' | 'adverse' | 'severe'>('base');

  useEffect(() => {
    if (!selectedId) return;
    (async () => {
      setLoading(true);
      try {
        const NODE_API_URL = (process.env.NEXT_PUBLIC_NODE_API_URL || '').trim().replace(/\/+$/, '');
        const res = await fetch(`${NODE_API_URL}/api/alm/${selectedId}/cecl/vintage?scenario=${scenario}`);
        if (res.ok) setData(await res.json());
        else setData(getDemoData());
      } catch { setData(getDemoData()); }
      finally { setLoading(false); }
    })();
  }, [selectedId, scenario]);

  if (!selectedId) return <div className="flex-1 flex items-center justify-center p-6"><AlertTriangle className="h-12 w-12 text-amber-500" /></div>;
  if (loading || !data) return <div className="flex-1 flex items-center justify-center p-6"><div className="h-8 w-8 animate-spin rounded-full border-2 border-cyan-200 border-t-cyan-600" /></div>;

  const allowanceChart = Object.entries(data.segmentBreakdown).map(([name, vals]: [string, any]) => ({
    name, base: vals.base, adverse: vals.adverse, severe: vals.severe,
  }));

  return (
    <div className="p-6 space-y-5 max-w-[1400px] mx-auto">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-orange-200 bg-orange-50">
          <Layers className="h-4 w-4 text-orange-700" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-slate-950">{locale === 'es' ? 'CECL Análisis de Cosecha — Weibull' : 'CECL Vintage Analysis — Weibull'}</h1>
          <p className="text-xs text-slate-500">{locale === 'es' ? 'Modelo de supervivencia, ajustes macro PR, 3 escenarios' : 'Survival model, PR macro overlays, 3 scenarios'}</p>
        </div>
      </div>

      {/* Scenario Toggle */}
      <div className="flex gap-2">
        {(['base', 'adverse', 'severe'] as const).map(s => (
          <button key={s} onClick={() => setScenario(s)}
            className={`rounded-lg border px-4 py-2 text-xs font-medium transition ${scenario === s ? 'border-orange-400 bg-orange-50 text-orange-700' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'}`}>
            {s === 'base' ? (locale === 'es' ? 'Base (50%)' : 'Base (50%)') : s === 'adverse' ? (locale === 'es' ? 'Adverso (30%)' : 'Adverse (30%)') : locale === 'es' ? 'Severo (20%)' : 'Severe (20%)'}
          </button>
        ))}
      </div>

      {/* Summary KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="rounded-xl border border-slate-200 bg-white p-3">
          <p className="text-[10px] font-medium uppercase text-slate-400">{locale === 'es' ? 'Balance Total' : 'Total Balance'}</p>
          <p className="text-lg font-bold tabular-nums text-slate-950">${data.totalBalance.toFixed(1)}M</p>
        </div>
        <div className="rounded-xl border border-orange-200 bg-orange-50 p-3">
          <p className="text-[10px] font-medium uppercase text-orange-600">{locale === 'es' ? 'Provisión Base' : 'Base Allowance'}</p>
          <p className="text-lg font-bold tabular-nums text-orange-700">${data.baseAllowance.toFixed(2)}M</p>
        </div>
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
          <p className="text-[10px] font-medium uppercase text-amber-600">{locale === 'es' ? 'Provisión Adverso' : 'Adverse Allowance'}</p>
          <p className="text-lg font-bold tabular-nums text-amber-700">${data.adverseAllowance.toFixed(2)}M</p>
        </div>
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-3">
          <p className="text-[10px] font-medium uppercase text-rose-600">{locale === 'es' ? 'Provisión Severo' : 'Severe Allowance'}</p>
          <p className="text-lg font-bold tabular-nums text-rose-700">${data.severeAllowance.toFixed(2)}M</p>
        </div>
      </div>

      {/* Allowance by Segment Chart */}
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-4">{locale === 'es' ? 'Provisión por Segmento — 3 Escenarios' : 'Allowance by Segment — 3 Scenarios'}</p>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={allowanceChart}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-15} textAnchor="end" height={50} />
            <YAxis tickFormatter={v => `$${v}M`} tick={{ fontSize: 11 }} />
            <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 12 }} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Bar dataKey="base" name={locale === 'es' ? 'Base' : 'Base'} fill="#06b6d4" radius={[4, 4, 0, 0]} />
            <Bar dataKey="adverse" name={locale === 'es' ? 'Adverso' : 'Adverse'} fill="#f59e0b" radius={[4, 4, 0, 0]} />
            <Bar dataKey="severe" name={locale === 'es' ? 'Severo' : 'Severe'} fill="#ef4444" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Weibull Parameters */}
      {data.weibullParams?.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-3">{locale === 'es' ? 'Parámetros Weibull por Tipo' : 'Weibull Parameters by Type'}</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {data.weibullParams.map((w: any) => (
              <div key={w.loanType} className="rounded-lg border border-slate-100 p-3">
                <p className="text-xs font-medium text-slate-700 capitalize">{w.loanType.replace(/_/g, ' ')}</p>
                <p className="text-[10px] text-slate-500 mt-1">k={w.shape.toFixed(2)} | λ={w.scale.toFixed(0)} | R²={w.r2.toFixed(2)}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function getDemoData() {
  return {
    methodology: 'vintage', totalBalance: 445,
    baseAllowance: 8.2, adverseAllowance: 14.8, severeAllowance: 24.5,
    segmentBreakdown: {
      'Consumer Loans': { base: 2.1, adverse: 3.8, severe: 6.3, balance: 85 },
      'Auto Loans': { base: 1.2, adverse: 2.2, severe: 3.6, balance: 62 },
      'Commercial RE': { base: 2.8, adverse: 5.0, severe: 8.4, balance: 120 },
      'Residential Mortgage': { base: 2.1, adverse: 3.8, severe: 6.2, balance: 95 },
    },
    cohortMatrix: [],
    weibullParams: [
      { loanType: 'consumer', shape: 1.8, scale: 42, r2: 0.87 },
      { loanType: 'auto', shape: 1.5, scale: 36, r2: 0.82 },
      { loanType: 'commercial_re', shape: 2.1, scale: 60, r2: 0.91 },
      { loanType: 'residential_mortgage', shape: 1.3, scale: 84, r2: 0.78 },
    ],
  };
}
