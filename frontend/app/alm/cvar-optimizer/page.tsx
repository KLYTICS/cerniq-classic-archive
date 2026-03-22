'use client';

import { useState, useEffect } from 'react';
import { useALM } from '@/components/alm/ALMProvider';
import { useTranslation } from '@/lib/i18n';
import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, ZAxis } from 'recharts';
import { Target, AlertTriangle } from 'lucide-react';

interface CVaRResult {
  optimalReturn: number;
  optimalCVaR: number;
  optimalSharpe: number;
  confidenceLevel: number;
  frontier: Array<{ risk: number; ret: number; label: string }>;
  currentPortfolio: { risk: number; ret: number };
  optimalPortfolio: { risk: number; ret: number };
  weights: Array<{ asset: string; current: number; optimal: number }>;
}

export default function CVaROptimizerPage() {
  const { selectedId } = useALM();
  const { locale } = useTranslation();
  const [data, setData] = useState<CVaRResult | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!selectedId) return;
    (async () => {
      setLoading(true);
      try {
        const NODE = (process.env.NEXT_PUBLIC_NODE_API_URL || '').trim().replace(/\/+$/, '');
        const res = await fetch(`${NODE}/api/alm/${selectedId}/cvar-optimizer`);
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
        <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-violet-200 bg-violet-50">
          <Target className="h-4 w-4 text-violet-700" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-slate-950">{locale === 'es' ? 'Optimizador CVaR — Rockafellar-Uryasev' : 'CVaR Optimizer — Rockafellar-Uryasev'}</h1>
          <p className="text-xs text-slate-500">{locale === 'es' ? 'Frontera eficiente bajo Conditional Value-at-Risk' : 'Efficient frontier under Conditional Value-at-Risk'}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KPI label={locale === 'es' ? 'Retorno Óptimo' : 'Optimal Return'} value={`${(data.optimalReturn * 100).toFixed(2)}%`} accent />
        <KPI label={`CVaR ${data.confidenceLevel}%`} value={`${(data.optimalCVaR * 100).toFixed(2)}%`} warn={data.optimalCVaR > 0.08} />
        <KPI label="Sharpe Ratio" value={data.optimalSharpe.toFixed(3)} accent={data.optimalSharpe > 0.5} />
        <KPI label={locale === 'es' ? 'Nivel Confianza' : 'Confidence Level'} value={`${data.confidenceLevel}%`} />
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-4">
          {locale === 'es' ? 'Frontera Eficiente CVaR' : 'CVaR Efficient Frontier'}
        </p>
        <ResponsiveContainer width="100%" height={350}>
          <ScatterChart>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="risk" name={locale === 'es' ? 'Riesgo (CVaR)' : 'Risk (CVaR)'} tick={{ fontSize: 11 }}
              tickFormatter={v => `${(v * 100).toFixed(1)}%`} />
            <YAxis dataKey="ret" name={locale === 'es' ? 'Retorno' : 'Return'} tick={{ fontSize: 11 }}
              tickFormatter={v => `${(v * 100).toFixed(1)}%`} />
            <ZAxis range={[40, 40]} />
            <Tooltip contentStyle={{ borderRadius: 12, fontSize: 12 }}
              formatter={(v: number) => `${(v * 100).toFixed(2)}%`} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Scatter name={locale === 'es' ? 'Frontera' : 'Frontier'} data={data.frontier} fill="#8b5cf6" />
            <Scatter name={locale === 'es' ? 'Actual' : 'Current'} data={[data.currentPortfolio]} fill="#ef4444" />
            <Scatter name={locale === 'es' ? 'Óptimo' : 'Optimal'} data={[data.optimalPortfolio]} fill="#10b981" />
          </ScatterChart>
        </ResponsiveContainer>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-3">
          {locale === 'es' ? 'Pesos Actual vs Óptimo' : 'Current vs Optimal Weights'}
        </p>
        <div className="space-y-2">
          {data.weights.map((w, i) => (
            <div key={i} className="flex items-center gap-3">
              <span className="w-28 text-xs text-slate-600 truncate">{w.asset}</span>
              <div className="flex-1 h-4 bg-slate-100 rounded-full overflow-hidden relative">
                <div className="absolute h-full bg-slate-300 rounded-full" style={{ width: `${w.current * 100}%` }} />
                <div className="absolute h-full bg-violet-500 rounded-full opacity-60" style={{ width: `${w.optimal * 100}%` }} />
              </div>
              <span className="text-[10px] font-mono text-slate-500 w-24 text-right">
                {(w.current * 100).toFixed(1)}% → {(w.optimal * 100).toFixed(1)}%
              </span>
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

function getDemo(): CVaRResult {
  const frontier = Array.from({ length: 15 }, (_, i) => ({
    risk: 0.02 + i * 0.006, ret: 0.03 + i * 0.004 + Math.random() * 0.002, label: `P${i + 1}`,
  }));
  return {
    optimalReturn: 0.072, optimalCVaR: 0.054, optimalSharpe: 0.68, confidenceLevel: 95,
    frontier,
    currentPortfolio: { risk: 0.065, ret: 0.055 },
    optimalPortfolio: { risk: 0.054, ret: 0.072 },
    weights: [
      { asset: 'US Treasuries', current: 0.30, optimal: 0.25 },
      { asset: 'MBS', current: 0.25, optimal: 0.18 },
      { asset: 'Munis', current: 0.10, optimal: 0.22 },
      { asset: 'Corporates', current: 0.20, optimal: 0.20 },
      { asset: 'Agency Bonds', current: 0.10, optimal: 0.10 },
      { asset: 'Cash', current: 0.05, optimal: 0.05 },
    ],
  };
}
