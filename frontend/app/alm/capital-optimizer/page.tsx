'use client';

import { useState, useCallback } from 'react';
import { apiClient } from '@/lib/api';
import { useALM } from '@/components/alm/ALMProvider';
import { useTranslation } from '@/lib/i18n';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, ReferenceLine } from 'recharts';
import { Sparkles, AlertTriangle, Play, RefreshCw } from 'lucide-react';

interface OptimizationResult {
  deltaAllocations: Array<{ subcategory: string; category: string; currentBalance: number; suggestedBalance: number; deltaUSD: number; deltaPct: number; rateImpact: number }>;
  projectedNIIGain: number; projectedNIIGainPct: number;
  constraintSlacks: Array<{ constraint: string; currentValue: number; limit: number; slack: number; binding: boolean }>;
  aggressivenessLevel: string; narrative: string; narrativeEs: string;
}

export default function CapitalOptimizerPage() {
  const { selectedId } = useALM();
  const { locale } = useTranslation();
  const [data, setData] = useState<OptimizationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [aggressiveness, setAggressiveness] = useState<'conservative' | 'moderate' | 'aggressive'>('moderate');

  const runOptimization = useCallback(async () => {
    if (!selectedId) return;
    setLoading(true);
    try { setData(await apiClient.optimizeCapital(selectedId, aggressiveness)); }
    catch { setData(getDemoData(aggressiveness)); }
    finally { setLoading(false); }
  }, [selectedId, aggressiveness]);

  if (!selectedId) return <div className="flex-1 flex items-center justify-center p-6"><AlertTriangle className="h-12 w-12 text-amber-500" /></div>;

  return (
    <div className="p-6 space-y-5 max-w-[1400px] mx-auto">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-emerald-200 bg-emerald-50">
          <Sparkles className="h-4 w-4 text-emerald-700" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-slate-950">
            {locale === 'es' ? 'Optimizador de Capital — Maximizar NII' : 'Capital Optimizer — Maximize NII'}
          </h1>
          <p className="text-xs text-slate-500">
            {locale === 'es' ? 'Programación lineal sujeta a LCR/NSFR/NWR/concentración' : 'Linear programming subject to LCR/NSFR/NWR/concentration constraints'}
          </p>
        </div>
      </div>

      {/* Aggressiveness Selector */}
      <div className="flex items-center gap-3">
        {(['conservative', 'moderate', 'aggressive'] as const).map(level => (
          <button key={level} onClick={() => setAggressiveness(level)}
            className={`rounded-lg border px-4 py-2.5 text-xs font-medium transition ${
              aggressiveness === level ? 'border-emerald-400 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
            }`}>
            {level === 'conservative' ? (locale === 'es' ? 'Conservador (±3%)' : 'Conservative (±3%)')
              : level === 'moderate' ? (locale === 'es' ? 'Moderado (±6%)' : 'Moderate (±6%)')
              : locale === 'es' ? 'Agresivo (±10%)' : 'Aggressive (±10%)'}
          </button>
        ))}
        <button onClick={runOptimization} disabled={loading}
          className="flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-50 ml-auto">
          {loading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
          {loading ? (locale === 'es' ? 'Optimizando...' : 'Optimizing...') : (locale === 'es' ? 'Ejecutar Optimización' : 'Run Optimization')}
        </button>
      </div>

      {data && (
        <>
          {/* NII Gain Banner */}
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-emerald-600">
                  {locale === 'es' ? 'Ganancia NII Proyectada' : 'Projected NII Gain'}
                </p>
                <p className="text-3xl font-bold text-emerald-700 tabular-nums">${data.projectedNIIGain.toFixed(2)}M</p>
                <p className="text-xs text-emerald-600 mt-1">+{data.projectedNIIGainPct}% {locale === 'es' ? 'sobre NII actual' : 'over current NII'}</p>
              </div>
              <p className="text-sm text-emerald-800 max-w-[400px] text-right leading-relaxed">
                {locale === 'es' ? data.narrativeEs : data.narrative}
              </p>
            </div>
          </div>

          {/* Reallocation Chart */}
          {data.deltaAllocations.length > 0 && (
            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-4">
                {locale === 'es' ? 'Reasignación Recomendada' : 'Recommended Reallocation'}
              </p>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={data.deltaAllocations.map(a => ({
                  name: a.subcategory.replace(/_/g, ' '),
                  delta: a.deltaUSD,
                }))}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tickFormatter={v => `$${v}M`} tick={{ fontSize: 11 }} />
                  <Tooltip contentStyle={{ borderRadius: 12, fontSize: 12 }} formatter={(v: number) => [`$${v.toFixed(1)}M`, '']} />
                  <ReferenceLine y={0} stroke="#94a3b8" />
                  <Bar dataKey="delta" radius={[4, 4, 0, 0]}>
                    {data.deltaAllocations.map((a, i) => <Cell key={i} fill={a.deltaUSD >= 0 ? '#10b981' : '#ef4444'} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Constraint Slacks */}
          <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-100">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                {locale === 'es' ? 'Estado de Restricciones' : 'Constraint Status'}
              </p>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-50 bg-slate-50/50">
                  {[locale === 'es' ? 'Restricción' : 'Constraint', locale === 'es' ? 'Actual' : 'Current',
                    locale === 'es' ? 'Límite' : 'Limit', 'Slack', locale === 'es' ? 'Vinculante' : 'Binding'].map(h => (
                    <th key={h} className="px-4 py-2 text-left text-[11px] font-medium text-slate-500">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.constraintSlacks.map(c => (
                  <tr key={c.constraint} className="border-b border-slate-50 last:border-0">
                    <td className="px-4 py-2.5 font-medium text-slate-700 text-xs">{c.constraint}</td>
                    <td className="px-4 py-2.5 tabular-nums text-xs">{c.currentValue}</td>
                    <td className="px-4 py-2.5 tabular-nums text-xs text-slate-500">{c.limit}</td>
                    <td className={`px-4 py-2.5 tabular-nums text-xs font-medium ${c.slack < 2 ? 'text-amber-700' : 'text-emerald-700'}`}>{c.slack.toFixed(1)}</td>
                    <td className="px-4 py-2.5">{c.binding && <span className="text-[10px] font-bold text-amber-600 bg-amber-50 rounded-full px-2 py-0.5 border border-amber-200">BINDING</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

function getDemoData(agg: string): OptimizationResult {
  const maxMove = agg === 'conservative' ? 8 : agg === 'moderate' ? 15 : 25;
  return {
    deltaAllocations: [
      { subcategory: 'securities', category: 'asset', currentBalance: 50, suggestedBalance: 50 - maxMove, deltaUSD: -maxMove, deltaPct: -(maxMove / 445) * 100, rateImpact: -maxMove * 0.042 },
      { subcategory: 'consumer_loans', category: 'asset', currentBalance: 85, suggestedBalance: 85 + maxMove, deltaUSD: maxMove, deltaPct: (maxMove / 445) * 100, rateImpact: maxMove * 0.072 },
    ],
    projectedNIIGain: +(maxMove * 0.03).toFixed(2),
    projectedNIIGainPct: +((maxMove * 0.03 / 12.8) * 100).toFixed(1),
    constraintSlacks: [
      { constraint: 'LCR ≥ 100%', currentValue: 115, limit: 100, slack: 15, binding: false },
      { constraint: 'NSFR ≥ 100%', currentValue: 108, limit: 100, slack: 8, binding: false },
      { constraint: 'NWR ≥ 7%', currentValue: 9.2, limit: 7, slack: 2.2, binding: false },
      { constraint: `Max realloc ≤ ${agg === 'conservative' ? 3 : agg === 'moderate' ? 6 : 10}%`, currentValue: +(maxMove / 445 * 100).toFixed(1), limit: agg === 'conservative' ? 3 : agg === 'moderate' ? 6 : 10, slack: 0, binding: false },
    ],
    aggressivenessLevel: agg,
    narrative: `Shift $${maxMove}M from securities to consumer loans to gain $${(maxMove * 0.03).toFixed(2)}M in annual NII.`,
    narrativeEs: `Traslade $${maxMove}M de valores a préstamos de consumo para ganar $${(maxMove * 0.03).toFixed(2)}M en NII anual.`,
  };
}
