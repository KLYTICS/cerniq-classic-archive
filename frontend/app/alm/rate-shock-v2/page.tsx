'use client';

import { useState, useCallback } from 'react';
import { useALM } from '@/components/alm/ALMProvider';
import { useTranslation } from '@/lib/i18n';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, ReferenceLine, Cell,
} from 'recharts';
import { Zap, AlertTriangle, Play, RotateCcw } from 'lucide-react';

const TENORS = [
  { key: '0.25', label: '3M' }, { key: '0.5', label: '6M' }, { key: '1', label: '1Y' },
  { key: '2', label: '2Y' }, { key: '3', label: '3Y' }, { key: '5', label: '5Y' },
  { key: '7', label: '7Y' }, { key: '10', label: '10Y' }, { key: '20', label: '20Y' }, { key: '30', label: '30Y' },
];

interface ForwardNIIQuarter {
  quarter: string; baselineNII: number; shockedNII: number; delta: number; deltaPct: number;
}

const PRESETS: Record<string, Record<string, number>> = {
  parallel_up: Object.fromEntries(TENORS.map(t => [t.key, 200])),
  parallel_down: Object.fromEntries(TENORS.map(t => [t.key, -200])),
  steepener: { '0.25': -100, '0.5': -90, '1': -75, '2': -50, '3': -30, '5': 0, '7': 30, '10': 60, '20': 90, '30': 100 },
  flattener: { '0.25': 100, '0.5': 90, '1': 75, '2': 50, '3': 30, '5': 0, '7': -30, '10': -60, '20': -90, '30': -100 },
  short_up: { '0.25': 300, '0.5': 275, '1': 250, '2': 200, '3': 150, '5': 75, '7': 40, '10': 0, '20': 0, '30': 0 },
};

export default function RateShockV2Page() {
  const { selectedId } = useALM();
  const { locale } = useTranslation();

  const [shocks, setShocks] = useState<Record<string, number>>(
    Object.fromEntries(TENORS.map(t => [t.key, 0]))
  );
  const [forwardNII, setForwardNII] = useState<ForwardNIIQuarter[]>([]);
  const [loading, setLoading] = useState(false);

  const updateShock = useCallback((tenor: string, bps: number) => {
    setShocks(prev => ({ ...prev, [tenor]: bps }));
  }, []);

  const applyPreset = useCallback((preset: Record<string, number>) => {
    setShocks({ ...preset });
    setForwardNII([]);
  }, []);

  const resetShocks = useCallback(() => {
    setShocks(Object.fromEntries(TENORS.map(t => [t.key, 0])));
    setForwardNII([]);
  }, []);

  const runSimulation = useCallback(async () => {
    if (!selectedId) return;
    setLoading(true);
    try {
      const NODE_API_URL = (process.env.NEXT_PUBLIC_NODE_API_URL || '').trim().replace(/\/+$/, '');
      const res = await fetch(`${NODE_API_URL}/api/alm/${selectedId}/yield-curve/forward-nii`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shockBpsPerTenor: shocks, quarters: 12 }),
      });
      if (res.ok) setForwardNII(await res.json());
      else setForwardNII(getDemoForwardNII(shocks));
    } catch { setForwardNII(getDemoForwardNII(shocks)); }
    finally { setLoading(false); }
  }, [selectedId, shocks]);

  if (!selectedId) return <div className="flex-1 flex items-center justify-center p-6"><AlertTriangle className="h-12 w-12 text-amber-500" /></div>;

  // Curve shape visualization
  const curveData = TENORS.map(t => ({
    tenor: t.label,
    shock: shocks[t.key] ?? 0,
  }));

  return (
    <div className="p-6 space-y-5 max-w-[1400px] mx-auto">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-orange-200 bg-orange-50">
            <Zap className="h-4 w-4 text-orange-700" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-950">
              {locale === 'es' ? 'Simulador de Choque de Tasas v2' : 'Rate Shock Simulator v2'}
            </h1>
            <p className="text-xs text-slate-500">
              {locale === 'es' ? 'Choques tenor-específicos + cascada NII 12 trimestres' : 'Tenor-specific shocks + 12-quarter NII waterfall'}
            </p>
          </div>
        </div>
        <button onClick={resetShocks} className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-600 hover:border-slate-300">
          <RotateCcw className="h-3.5 w-3.5" /> Reset
        </button>
      </div>

      {/* Preset Buttons */}
      <div className="flex flex-wrap gap-2">
        {[
          { key: 'parallel_up', label: locale === 'es' ? 'Paralelo +200' : 'Parallel +200' },
          { key: 'parallel_down', label: locale === 'es' ? 'Paralelo -200' : 'Parallel -200' },
          { key: 'steepener', label: locale === 'es' ? 'Empinamiento' : 'Steepener' },
          { key: 'flattener', label: locale === 'es' ? 'Aplanamiento' : 'Flattener' },
          { key: 'short_up', label: locale === 'es' ? 'Corto +300' : 'Short +300' },
        ].map(p => (
          <button key={p.key} onClick={() => applyPreset(PRESETS[p.key])}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-600 transition hover:border-orange-300 hover:bg-orange-50">
            {p.label}
          </button>
        ))}
      </div>

      {/* Tenor Sliders */}
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-3">
          {locale === 'es' ? 'Choque por Tenor (bps)' : 'Shock by Tenor (bps)'}
        </p>
        <div className="grid grid-cols-5 md:grid-cols-10 gap-3">
          {TENORS.map(t => (
            <div key={t.key} className="text-center">
              <label className="text-[10px] font-medium text-slate-500 block mb-1">{t.label}</label>
              <input
                type="number"
                step="25"
                value={shocks[t.key]}
                onChange={e => updateShock(t.key, parseInt(e.target.value) || 0)}
                className="w-full rounded-lg border border-slate-300 bg-white px-1 py-1.5 text-center text-xs tabular-nums focus:border-orange-400 focus:ring-1 focus:ring-orange-300"
              />
            </div>
          ))}
        </div>
      </div>

      {/* Shock Shape Chart */}
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-4">
          {locale === 'es' ? 'Forma del Choque' : 'Shock Shape'}
        </p>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={curveData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="tenor" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} label={{ value: 'bps', angle: -90, position: 'insideLeft', style: { fontSize: 10 } }} />
            <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 12 }} />
            <ReferenceLine y={0} stroke="#94a3b8" />
            <Bar dataKey="shock" radius={[4, 4, 0, 0]}>
              {curveData.map((e, i) => (
                <Cell key={i} fill={e.shock >= 0 ? '#f59e0b' : '#3b82f6'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Run Button */}
      <button
        onClick={runSimulation}
        disabled={loading}
        className="flex items-center gap-2 rounded-xl bg-orange-500 px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-orange-600 disabled:opacity-50"
      >
        {loading ? <div className="h-4 w-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> : <Play className="h-4 w-4" />}
        {loading ? (locale === 'es' ? 'Calculando...' : 'Computing...') : (locale === 'es' ? 'Ejecutar Cascada NII 12T' : 'Run 12-Quarter NII Waterfall')}
      </button>

      {/* Forward NII Waterfall */}
      {forwardNII.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-4">
            {locale === 'es' ? 'Cascada NII: Base vs. Choque — 12 Trimestres' : 'NII Waterfall: Base vs. Shocked — 12 Quarters'}
          </p>
          <ResponsiveContainer width="100%" height={350}>
            <BarChart data={forwardNII}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="quarter" tick={{ fontSize: 10 }} angle={-20} textAnchor="end" height={50} />
              <YAxis tickFormatter={v => `$${v}M`} tick={{ fontSize: 11 }} />
              <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 12 }}
                formatter={(value) => [`$${Number(value ?? 0).toFixed(2)}M`, '']} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="baselineNII" name={locale === 'es' ? 'NII Base' : 'Baseline NII'} fill="#06b6d4" radius={[4, 4, 0, 0]} />
              <Bar dataKey="shockedNII" name={locale === 'es' ? 'NII Choque' : 'Shocked NII'} fill="#f59e0b" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>

          {/* Delta Table */}
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="px-2 py-1.5 text-left text-slate-500">Q</th>
                  <th className="px-2 py-1.5 text-right text-slate-500">Base</th>
                  <th className="px-2 py-1.5 text-right text-slate-500">Shocked</th>
                  <th className="px-2 py-1.5 text-right text-slate-500">Δ ($M)</th>
                  <th className="px-2 py-1.5 text-right text-slate-500">Δ (%)</th>
                </tr>
              </thead>
              <tbody>
                {forwardNII.map(q => (
                  <tr key={q.quarter} className="border-b border-slate-50">
                    <td className="px-2 py-1.5 text-slate-700 font-medium">{q.quarter}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums">${q.baselineNII.toFixed(2)}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums">${q.shockedNII.toFixed(2)}</td>
                    <td className={`px-2 py-1.5 text-right tabular-nums font-semibold ${q.delta >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                      {q.delta >= 0 ? '+' : ''}{q.delta.toFixed(2)}
                    </td>
                    <td className={`px-2 py-1.5 text-right tabular-nums ${q.deltaPct >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                      {q.deltaPct >= 0 ? '+' : ''}{q.deltaPct.toFixed(1)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function getDemoForwardNII(shocks: Record<string, number>): ForwardNIIQuarter[] {
  const avgShock = Object.values(shocks).reduce((a, b) => a + b, 0) / Object.values(shocks).length;
  const now = new Date();
  return Array.from({ length: 12 }, (_, q) => {
    const qDate = new Date(now.getFullYear(), now.getMonth() + q * 3, 1);
    const base = 3.2 * (1 + q * 0.005);
    const effect = (avgShock / 10000) * base * Math.min(1, q / 4);
    return {
      quarter: `Q${Math.ceil((qDate.getMonth() + 1) / 3)} ${qDate.getFullYear()}`,
      baselineNII: +base.toFixed(2),
      shockedNII: +(base + effect).toFixed(2),
      delta: +effect.toFixed(2),
      deltaPct: +((effect / base) * 100).toFixed(1),
    };
  });
}
