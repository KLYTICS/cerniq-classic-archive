'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '@/lib/api';
import { useALM } from '@/components/alm/ALMProvider';
import { useTranslation } from '@/lib/i18n';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Shield, AlertTriangle, Check, X, RefreshCw } from 'lucide-react';

interface VaRResult {
  method: string; confidenceLevel: number; horizon: number;
  var: number; cvar: number; varPct: number; portfolioValue: number;
}

interface BacktestResult {
  testDays: number; exceptions: number; exceptionRate: number;
  expectedExceptions: number; kupiecLR: number; kupiecPValue: number;
  trafficLight: 'GREEN' | 'AMBER' | 'RED';
}

interface VaRSuite { historical: VaRResult; parametric: VaRResult; montecarlo: VaRResult; backtestResult: BacktestResult }

const METHOD_COLORS = { historical: '#06b6d4', parametric: '#f59e0b', montecarlo: '#8b5cf6' };
const TRAFFIC_STYLES = {
  GREEN: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
  AMBER: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
  RED: { bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200' },
};

export default function VaRPage() {
  const { selectedId } = useALM();
  const { locale } = useTranslation();
  const [data, setData] = useState<VaRSuite | null>(null);
  const [loading, setLoading] = useState(true);
  const [confidence, setConfidence] = useState<95 | 99>(95);
  const [horizon, setHorizon] = useState<1 | 10>(1);

  const loadData = useCallback(async () => {
    if (!selectedId) return;
    setLoading(true);
    try { setData(await apiClient.getVaRSuite(selectedId, confidence, horizon)); }
    catch { setData(getDemoData(confidence, horizon)); }
    finally { setLoading(false); }
  }, [selectedId, confidence, horizon]);

  useEffect(() => { loadData(); }, [loadData]);

  if (!selectedId) return <div className="flex-1 flex items-center justify-center p-6"><AlertTriangle className="h-12 w-12 text-amber-500" /></div>;
  if (loading || !data) return <div className="flex-1 flex items-center justify-center p-6"><div className="h-8 w-8 animate-spin rounded-full border-2 border-cyan-200 border-t-cyan-600" /></div>;

  const compChart = [
    { method: locale === 'es' ? 'Histórico' : 'Historical', var: data.historical.var, cvar: data.historical.cvar, color: METHOD_COLORS.historical },
    { method: locale === 'es' ? 'Paramétrico' : 'Parametric', var: data.parametric.var, cvar: data.parametric.cvar, color: METHOD_COLORS.parametric },
    { method: 'Monte Carlo', var: data.montecarlo.var, cvar: data.montecarlo.cvar, color: METHOD_COLORS.montecarlo },
  ];

  const bt = data.backtestResult;
  const tl = TRAFFIC_STYLES[bt.trafficLight];

  return (
    <div className="p-6 space-y-5 max-w-[1400px] mx-auto">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-purple-200 bg-purple-50">
            <Shield className="h-4 w-4 text-purple-700" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-950">
              {locale === 'es' ? 'Suite VaR — Valor en Riesgo' : 'VaR Suite — Value at Risk'}
            </h1>
            <p className="text-xs text-slate-500">
              {locale === 'es' ? 'Histórico + Paramétrico + Monte Carlo + Backtest Kupiec' : 'Historical + Parametric + Monte Carlo + Kupiec Backtest'}
            </p>
          </div>
        </div>
        {/* Controls */}
        <div className="flex items-center gap-2">
          <select value={confidence} onChange={e => setConfidence(+e.target.value as 95 | 99)}
            className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs">
            <option value={95}>95%</option>
            <option value={99}>99%</option>
          </select>
          <select value={horizon} onChange={e => setHorizon(+e.target.value as 1 | 10)}
            className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs">
            <option value={1}>1-Day</option>
            <option value={10}>10-Day</option>
          </select>
        </div>
      </div>

      {/* Three Method Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {[
          { key: 'historical' as const, label: locale === 'es' ? 'Simulación Histórica' : 'Historical Simulation', data: data.historical },
          { key: 'parametric' as const, label: locale === 'es' ? 'Delta-Normal' : 'Parametric (Delta-Normal)', data: data.parametric },
          { key: 'montecarlo' as const, label: 'Monte Carlo', data: data.montecarlo },
        ].map(({ key, label, data: d }) => (
          <div key={key} className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="h-3 w-3 rounded-full" style={{ backgroundColor: METHOD_COLORS[key] }} />
              <p className="text-xs font-semibold text-slate-700">{label}</p>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-[10px] text-slate-500">VaR {confidence}%</span>
                <span className="text-sm font-bold tabular-nums text-slate-950">${d.var.toFixed(2)}M</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[10px] text-slate-500">CVaR / ES</span>
                <span className="text-sm font-bold tabular-nums text-rose-700">${d.cvar.toFixed(2)}M</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[10px] text-slate-500">% {locale === 'es' ? 'Portfolio' : 'Portfolio'}</span>
                <span className="text-sm font-medium tabular-nums text-slate-600">{d.varPct}%</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* VaR Comparison Chart */}
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-4">
          VaR vs. CVaR — {locale === 'es' ? 'Comparación de Métodos' : 'Method Comparison'}
        </p>
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={compChart}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="method" tick={{ fontSize: 11 }} />
            <YAxis tickFormatter={v => `$${v}M`} tick={{ fontSize: 11 }} />
            <Tooltip
              contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 12 }}
              formatter={(value) => [`$${Number(value ?? 0).toFixed(2)}M`, '']}
            />
            <Bar dataKey="var" name={`VaR ${confidence}%`} radius={[4, 4, 0, 0]}>
              {compChart.map((e, i) => <Cell key={i} fill={e.color} />)}
            </Bar>
            <Bar dataKey="cvar" name="CVaR / ES" fill="#ef4444" radius={[4, 4, 0, 0]} opacity={0.6} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Kupiec Backtest */}
      <div className={`rounded-xl border p-4 ${tl.bg} ${tl.border}`}>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-bold text-slate-950">
              {locale === 'es' ? 'Backtest Kupiec — Semáforo Basel' : 'Kupiec Backtest — Basel Traffic Light'}
            </p>
            <p className="text-xs text-slate-600 mt-1">
              {bt.exceptions} {locale === 'es' ? 'excepciones en' : 'exceptions in'} {bt.testDays} {locale === 'es' ? 'días' : 'days'} ({locale === 'es' ? 'esperado' : 'expected'}: {bt.expectedExceptions.toFixed(1)}) | LR: {bt.kupiecLR.toFixed(2)} | p: {bt.kupiecPValue}
            </p>
          </div>
          <div className={`flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-bold ${tl.bg} ${tl.text} ${tl.border}`}>
            {bt.trafficLight === 'GREEN' && <Check className="h-4 w-4" />}
            {bt.trafficLight === 'AMBER' && <AlertTriangle className="h-4 w-4" />}
            {bt.trafficLight === 'RED' && <X className="h-4 w-4" />}
            {bt.trafficLight}
          </div>
        </div>
      </div>
    </div>
  );
}

function getDemoData(conf: number, hor: number): VaRSuite {
  const scale = hor === 10 ? 3.16 : 1;
  const cScale = conf === 99 ? 1.4 : 1;
  return {
    historical: { method: 'historical', confidenceLevel: conf / 100, horizon: hor, var: +(9.3 * scale * cScale).toFixed(2), cvar: +(12.1 * scale * cScale).toFixed(2), varPct: 2.09, portfolioValue: 445 },
    parametric: { method: 'parametric', confidenceLevel: conf / 100, horizon: hor, var: +(8.7 * scale * cScale).toFixed(2), cvar: +(10.8 * scale * cScale).toFixed(2), varPct: 1.96, portfolioValue: 445 },
    montecarlo: { method: 'montecarlo', confidenceLevel: conf / 100, horizon: hor, var: +(9.5 * scale * cScale).toFixed(2), cvar: +(12.8 * scale * cScale).toFixed(2), varPct: 2.13, portfolioValue: 445 },
    backtestResult: { testDays: 250, exceptions: 3, exceptionRate: 0.012, expectedExceptions: conf === 99 ? 2.5 : 12.5, kupiecLR: 1.85, kupiecPValue: 0.10, trafficLight: 'GREEN' },
  };
}
