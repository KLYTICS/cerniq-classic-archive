'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '@/lib/api';
import { useALM } from '@/components/alm/ALMProvider';
import { useTranslation } from '@/lib/i18n';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine } from 'recharts';
import { ShieldAlert, AlertTriangle, Play, RefreshCw, Check, X } from 'lucide-react';

const SCENARIO_COLORS = ['#ef4444', '#f59e0b', '#8b5cf6'];

export default function StressV2Page() {
  const { selectedId } = useALM();
  const { locale } = useTranslation();
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const runAll = useCallback(async () => {
    if (!selectedId) return;
    setLoading(true);
    try { setResults(await apiClient.runAllStressV2(selectedId)); }
    catch { setResults(getDemoResults()); }
    finally { setLoading(false); }
  }, [selectedId]);

  if (!selectedId) return <div className="flex-1 flex items-center justify-center p-6"><AlertTriangle className="h-12 w-12 text-amber-500" /></div>;

  return (
    <div className="p-6 space-y-5 max-w-[1400px] mx-auto">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-red-200 bg-red-50">
            <ShieldAlert className="h-4 w-4 text-red-700" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-950">{locale === 'es' ? 'Motor de Estrés DFAST 2.0' : 'DFAST Stress Engine 2.0'}</h1>
            <p className="text-xs text-slate-500">{locale === 'es' ? '3 escenarios DFAST, proyección capital 9 trimestres' : '3 DFAST scenarios, 9-quarter capital projection'}</p>
          </div>
        </div>
        <button onClick={runAll} disabled={loading} className="flex items-center gap-2 rounded-xl bg-red-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50">
          {loading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
          {loading ? (locale === 'es' ? 'Ejecutando...' : 'Running...') : (locale === 'es' ? 'Ejecutar 3 Escenarios' : 'Run All 3 Scenarios')}
        </button>
      </div>

      {results.length > 0 && (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {results.map((r, i) => (
              <div key={r.scenarioId} className={`rounded-xl border p-4 ${r.isCapitalAdequate ? 'border-emerald-200 bg-emerald-50' : 'border-rose-200 bg-rose-50'}`}>
                <div className="flex items-center gap-2 mb-2">
                  <div className="h-3 w-3 rounded-full" style={{ backgroundColor: SCENARIO_COLORS[i] }} />
                  <p className="text-sm font-semibold text-slate-800">{r.scenarioName}</p>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div><p className="text-[9px] text-slate-400">Min NWR</p><p className={`text-sm font-bold tabular-nums ${r.minNWR >= 7 ? 'text-emerald-700' : 'text-rose-700'}`}>{r.minNWR}%</p></div>
                  <div><p className="text-[9px] text-slate-400">Min LCR</p><p className={`text-sm font-bold tabular-nums ${r.minLCR >= 100 ? 'text-emerald-700' : 'text-rose-700'}`}>{r.minLCR}%</p></div>
                  <div><p className="text-[9px] text-slate-400">{locale === 'es' ? 'Adecuado' : 'Adequate'}</p><p>{r.isCapitalAdequate ? <Check className="h-5 w-5 text-emerald-600 mx-auto" /> : <X className="h-5 w-5 text-rose-600 mx-auto" />}</p></div>
                </div>
              </div>
            ))}
          </div>

          {/* NWR Path Chart */}
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-4">{locale === 'es' ? 'Trayectoria NWR — 9 Trimestres' : 'NWR Path — 9 Quarters'}</p>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="quarter" data={results[0]?.quarters} tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `${v}%`} domain={[0, 'auto']} />
                <Tooltip contentStyle={{ borderRadius: 12, fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <ReferenceLine y={7} stroke="#ef4444" strokeDasharray="8 4" label={{ value: '7% min', position: 'insideTopRight', style: { fontSize: 10, fill: '#ef4444' } }} />
                {results.map((r, i) => (
                  <Line key={r.scenarioId} data={r.quarters} type="monotone" dataKey="nwr" stroke={SCENARIO_COLORS[i]} strokeWidth={2} dot={false} name={r.scenarioName} />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Narratives */}
          <div className="space-y-3">
            {results.map((r, i) => (
              <div key={r.scenarioId} className="rounded-xl border border-slate-200 bg-white p-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: SCENARIO_COLORS[i] }} />
                  <p className="text-sm font-semibold text-slate-800">{r.scenarioName}</p>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">{locale === 'es' ? r.narrativeEs : r.narrativeEn}</p>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function getDemoResults() {
  const mkQuarters = (base: number, trend: number) => Array.from({ length: 9 }, (_, q) => ({
    quarter: `Q${(q % 4) + 1} ${2026 + Math.floor(q / 4)}`, nii: +(3.2 + trend * q * 0.1).toFixed(2),
    nwr: +(base + trend * q * 0.3).toFixed(1), lcr: +(115 + trend * q * 2).toFixed(0), eve: 50, nsfr: 108, el: 0.5,
  }));
  return [
    { scenarioId: 'dfast-severe', scenarioName: 'Severe Adverse', quarters: mkQuarters(9.2, -0.3), minNWR: 6.5, minLCR: 88, cumulativeNIILoss: -4.2, isCapitalAdequate: false, narrativeEs: 'Bajo escenario severamente adverso, NWR cae a 6.5% — subcapitalizada.', narrativeEn: 'Under severe adverse, NWR falls to 6.5% — undercapitalized.' },
    { scenarioId: 'dfast-hurricane', scenarioName: 'Hurricane', quarters: mkQuarters(9.2, -0.5), minNWR: 5.2, minLCR: 72, cumulativeNIILoss: -8.1, isCapitalAdequate: false, narrativeEs: 'Escenario huracán: NWR cae a 5.2%, LCR a 72%.', narrativeEn: 'Hurricane: NWR falls to 5.2%, LCR to 72%.' },
    { scenarioId: 'dfast-stagflation', scenarioName: 'Stagflation', quarters: mkQuarters(9.2, -0.15), minNWR: 7.8, minLCR: 95, cumulativeNIILoss: -2.1, isCapitalAdequate: true, narrativeEs: 'Estanflación: institución mantiene capitalización adecuada.', narrativeEn: 'Stagflation: institution maintains adequate capitalization.' },
  ];
}
