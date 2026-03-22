'use client';

import { useState, useEffect } from 'react';
import { useALM } from '@/components/alm/ALMProvider';
import { useTranslation } from '@/lib/i18n';
import { RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import { Brain, AlertTriangle } from 'lucide-react';

interface BLResult {
  priorWeights: Record<string, number>;
  posteriorWeights: Record<string, number>;
  expectedReturn: number;
  riskBudget: number;
  sharpeRatio: number;
  views: Array<{ asset: string; view: string; confidence: number }>;
  radarData: Array<{ asset: string; prior: number; posterior: number }>;
}

export default function BlackLittermanPage() {
  const { selectedId } = useALM();
  const { locale } = useTranslation();
  const [data, setData] = useState<BLResult | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!selectedId) return;
    (async () => {
      setLoading(true);
      try {
        const NODE = (process.env.NEXT_PUBLIC_NODE_API_URL || '').trim().replace(/\/+$/, '');
        const res = await fetch(`${NODE}/api/alm/${selectedId}/black-litterman`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
        if (res.ok) setData(await res.json());
        else setData(getDemo());
      } catch { setData(getDemo()); }
      finally { setLoading(false); }
    })();
  }, [selectedId]);

  if (!selectedId) return <div className="flex-1 flex items-center justify-center p-6"><AlertTriangle className="h-12 w-12 text-amber-500" /></div>;
  if (loading || !data) return <div className="flex-1 flex items-center justify-center p-6"><div className="h-8 w-8 animate-spin rounded-full border-2 border-cyan-200 border-t-cyan-600" /></div>;

  return (
    <div className="p-6 space-y-5 max-w-[1400px] mx-auto">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-indigo-200 bg-indigo-50">
          <Brain className="h-4 w-4 text-indigo-700" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-slate-950">{locale === 'es' ? 'Black-Litterman — Asignación Bayesiana' : 'Black-Litterman — Bayesian Allocation'}</h1>
          <p className="text-xs text-slate-500">{locale === 'es' ? 'Equilibrio de mercado + opiniones del inversor → portafolio óptimo' : 'Market equilibrium + investor views → optimal portfolio'}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KPI label={locale === 'es' ? 'Retorno Esperado' : 'Expected Return'} value={`${(data.expectedReturn * 100).toFixed(2)}%`} />
        <KPI label={locale === 'es' ? 'Presupuesto de Riesgo' : 'Risk Budget'} value={`${(data.riskBudget * 100).toFixed(2)}%`} />
        <KPI label="Sharpe Ratio" value={data.sharpeRatio.toFixed(3)} accent={data.sharpeRatio > 0.5} />
        <KPI label={locale === 'es' ? 'Opiniones Activas' : 'Active Views'} value={`${data.views.length}`} />
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-4">
          {locale === 'es' ? 'Pesos Prior vs Posterior' : 'Prior vs Posterior Weights'}
        </p>
        <ResponsiveContainer width="100%" height={350}>
          <RadarChart data={data.radarData}>
            <PolarGrid stroke="#e2e8f0" />
            <PolarAngleAxis dataKey="asset" tick={{ fontSize: 11 }} />
            <PolarRadiusAxis tick={{ fontSize: 10 }} />
            <Tooltip contentStyle={{ borderRadius: 12, fontSize: 12 }} formatter={(v: number) => `${(v * 100).toFixed(1)}%`} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Radar name="Prior (CAPM)" dataKey="prior" stroke="#94a3b8" fill="#94a3b8" fillOpacity={0.2} />
            <Radar name="Posterior (BL)" dataKey="posterior" stroke="#6366f1" fill="#6366f1" fillOpacity={0.3} />
          </RadarChart>
        </ResponsiveContainer>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-3">
          {locale === 'es' ? 'Opiniones del Inversor' : 'Investor Views'}
        </p>
        <div className="space-y-2">
          {data.views.map((v, i) => (
            <div key={i} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
              <div>
                <span className="text-sm font-medium text-slate-800">{v.asset}</span>
                <span className="ml-2 text-xs text-slate-500">{v.view}</span>
              </div>
              <span className="text-xs font-mono text-indigo-600">{(v.confidence * 100).toFixed(0)}% conf</span>
            </div>
          ))}
        </div>
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

function getDemo(): BLResult {
  return {
    expectedReturn: 0.0682, riskBudget: 0.112, sharpeRatio: 0.61,
    views: [
      { asset: 'US Treasuries', view: 'Outperform +50bp', confidence: 0.85 },
      { asset: 'MBS', view: 'Underperform -30bp', confidence: 0.60 },
      { asset: 'Munis', view: 'Outperform +40bp', confidence: 0.75 },
    ],
    priorWeights: { 'US Treasuries': 0.25, MBS: 0.20, Munis: 0.15, Corporates: 0.20, 'Agency Bonds': 0.10, Cash: 0.10 },
    posteriorWeights: { 'US Treasuries': 0.32, MBS: 0.14, Munis: 0.22, Corporates: 0.18, 'Agency Bonds': 0.08, Cash: 0.06 },
    radarData: [
      { asset: 'US Treasuries', prior: 0.25, posterior: 0.32 },
      { asset: 'MBS', prior: 0.20, posterior: 0.14 },
      { asset: 'Munis', prior: 0.15, posterior: 0.22 },
      { asset: 'Corporates', prior: 0.20, posterior: 0.18 },
      { asset: 'Agency Bonds', prior: 0.10, posterior: 0.08 },
      { asset: 'Cash', prior: 0.10, posterior: 0.06 },
    ],
  };
}
