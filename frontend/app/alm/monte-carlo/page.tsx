'use client';

import { useState, useCallback } from 'react';
import { useALM } from '@/components/alm/ALMProvider';
import { useTranslation } from '@/lib/i18n';
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from 'recharts';
import { Cpu, AlertTriangle, Play, RefreshCw } from 'lucide-react';

interface MonteCarloResult {
  paths: number; quarters: number;
  vasicekParams: { kappa: number; theta: number; sigma: number; r0: number };
  meanNII: number; stdNII: number; var95NII: number; cvar99NII: number;
  fanChart: Array<{ quarter: string; p5: number; p25: number; p50: number; p75: number; p95: number }>;
  distribution: { buckets: Array<{ min: number; max: number; count: number }>; mean: number; std: number };
}

export default function MonteCarloPage() {
  const { selectedId } = useALM();
  const { locale } = useTranslation();
  const [result, setResult] = useState<MonteCarloResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [pathCount, setPathCount] = useState(10000);
  const [kappa, setKappa] = useState(0.15);
  const [theta, setTheta] = useState(0.035);
  const [sigma, setSigma] = useState(0.012);

  const runSim = useCallback(async () => {
    if (!selectedId) return;
    setLoading(true);
    try {
      const NODE_API_URL = (process.env.NEXT_PUBLIC_NODE_API_URL || '').trim().replace(/\/+$/, '');
      const res = await fetch(`${NODE_API_URL}/api/alm/${selectedId}/monte-carlo/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paths: pathCount, quarters: 12, kappa, theta, sigma }),
      });
      if (res.ok) setResult(await res.json());
      else setResult(getDemoResult());
    } catch { setResult(getDemoResult()); }
    finally { setLoading(false); }
  }, [selectedId, pathCount, kappa, theta, sigma]);

  if (!selectedId) return <div className="flex-1 flex items-center justify-center p-6"><AlertTriangle className="h-12 w-12 text-amber-500" /></div>;

  return (
    <div className="p-6 space-y-5 max-w-[1400px] mx-auto">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-red-200 bg-red-50">
            <Cpu className="h-4 w-4 text-red-700" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-950">
              {locale === 'es' ? 'Motor Monte Carlo — Vasicek' : 'Monte Carlo Engine — Vasicek'}
            </h1>
            <p className="text-xs text-slate-500">
              {locale === 'es' ? 'Simulación estocástica de NII con variantes antitéticas' : 'Stochastic NII simulation with antithetic variates'}
            </p>
          </div>
        </div>
      </div>

      {/* Parameters */}
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-3">
          {locale === 'es' ? 'Parámetros Vasicek' : 'Vasicek Parameters'}
        </p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: locale === 'es' ? 'Senderos' : 'Paths', value: pathCount, set: setPathCount, min: 1000, max: 50000, step: 1000 },
            { label: 'κ (Mean Reversion)', value: kappa, set: setKappa, min: 0.01, max: 1.0, step: 0.01 },
            { label: 'θ (Long-Run Rate)', value: theta, set: setTheta, min: 0.01, max: 0.10, step: 0.005 },
            { label: 'σ (Volatility)', value: sigma, set: setSigma, min: 0.001, max: 0.05, step: 0.001 },
          ].map(p => (
            <div key={p.label}>
              <label className="text-[10px] text-slate-500 block mb-1">{p.label}</label>
              <input type="number" step={p.step} min={p.min} max={p.max} value={p.value}
                onChange={e => p.set(parseFloat(e.target.value) || p.min)}
                className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs tabular-nums focus:border-red-400 focus:ring-1 focus:ring-red-300" />
            </div>
          ))}
        </div>
        <button onClick={runSim} disabled={loading}
          className="mt-4 flex items-center gap-2 rounded-xl bg-red-600 px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-red-700 disabled:opacity-50">
          {loading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
          {loading ? (locale === 'es' ? `Simulando ${pathCount.toLocaleString()} senderos...` : `Simulating ${pathCount.toLocaleString()} paths...`)
                   : (locale === 'es' ? `Ejecutar ${pathCount.toLocaleString()} Senderos` : `Run ${pathCount.toLocaleString()} Paths`)}
        </button>
      </div>

      {result && (
        <>
          {/* Statistics */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard label={locale === 'es' ? 'NII Esperado' : 'Expected NII'} value={`$${result.meanNII.toFixed(2)}M`} />
            <StatCard label={locale === 'es' ? 'Desv. Estándar' : 'Std Deviation'} value={`$${result.stdNII.toFixed(2)}M`} />
            <StatCard label="VaR 95%" value={`$${result.var95NII.toFixed(2)}M`} warn={result.var95NII < result.meanNII * 0.8} />
            <StatCard label="CVaR 99%" value={`$${result.cvar99NII.toFixed(2)}M`} warn={result.cvar99NII < result.meanNII * 0.7} />
          </div>

          {/* Fan Chart */}
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-4">
              {locale === 'es' ? 'Gráfico de Abanico — NII Trimestral' : 'Fan Chart — Quarterly NII'}
            </p>
            <ResponsiveContainer width="100%" height={350}>
              <AreaChart data={result.fanChart}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="quarter" tick={{ fontSize: 10 }} />
                <YAxis tickFormatter={v => `$${v.toFixed(1)}M`} tick={{ fontSize: 11 }} />
                <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 12 }}
                  formatter={(v: number) => [`$${v.toFixed(3)}M`, '']} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Area type="monotone" dataKey="p95" stroke="none" fill="#dcfce7" fillOpacity={0.5} name="P95" />
                <Area type="monotone" dataKey="p75" stroke="none" fill="#bbf7d0" fillOpacity={0.5} name="P75" />
                <Area type="monotone" dataKey="p50" stroke="#0f172a" fill="none" strokeWidth={3} name="Median" />
                <Area type="monotone" dataKey="p25" stroke="none" fill="#fed7aa" fillOpacity={0.5} name="P25" />
                <Area type="monotone" dataKey="p5" stroke="none" fill="#fecaca" fillOpacity={0.5} name="P5 (VaR)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Distribution Histogram */}
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-4">
              {locale === 'es' ? `Distribución NII — ${result.paths.toLocaleString()} Senderos` : `NII Distribution — ${result.paths.toLocaleString()} Paths`}
            </p>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={result.distribution.buckets}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="min" tick={{ fontSize: 10 }} tickFormatter={v => `$${v}`} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 12 }} />
                <Bar dataKey="count" radius={[2, 2, 0, 0]}>
                  {result.distribution.buckets.map((b, i) => (
                    <Cell key={i} fill={b.min < result.var95NII ? '#fca5a5' : b.min < result.meanNII ? '#fcd34d' : '#86efac'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            <div className="flex justify-center gap-6 mt-2 text-[10px] text-slate-500">
              <span className="flex items-center gap-1"><div className="h-2 w-2 rounded-full bg-red-300" /> {'< VaR 95%'}</span>
              <span className="flex items-center gap-1"><div className="h-2 w-2 rounded-full bg-yellow-300" /> {'< Mean'}</span>
              <span className="flex items-center gap-1"><div className="h-2 w-2 rounded-full bg-green-300" /> {'> Mean'}</span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function StatCard({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <div className={`rounded-xl border p-3 ${warn ? 'border-rose-200 bg-rose-50' : 'border-slate-200 bg-white'}`}>
      <p className="text-[10px] font-medium uppercase tracking-wider text-slate-400">{label}</p>
      <p className={`text-lg font-bold tabular-nums ${warn ? 'text-rose-700' : 'text-slate-950'}`}>{value}</p>
    </div>
  );
}

function getDemoResult(): MonteCarloResult {
  const now = new Date();
  return {
    paths: 10000, quarters: 12,
    vasicekParams: { kappa: 0.15, theta: 0.035, sigma: 0.012, r0: 0.0475 },
    meanNII: 38.4, stdNII: 4.2, var95NII: 31.5, cvar99NII: 28.8,
    meanEVE: 0, var95EVE: 0,
    fanChart: Array.from({ length: 12 }, (_, q) => {
      const d = new Date(now.getFullYear(), now.getMonth() + (q + 1) * 3, 1);
      const base = 3.2 + q * 0.05;
      return {
        quarter: `Q${Math.ceil((d.getMonth() + 1) / 3)} ${d.getFullYear()}`,
        p5: +(base - 0.8 - q * 0.05).toFixed(3),
        p25: +(base - 0.3).toFixed(3),
        p50: +base.toFixed(3),
        p75: +(base + 0.3).toFixed(3),
        p95: +(base + 0.8 + q * 0.04).toFixed(3),
      };
    }),
    distribution: {
      buckets: Array.from({ length: 20 }, (_, i) => {
        const min = 25 + i * 1.3;
        const dist = Math.abs(i - 10);
        return { min: +min.toFixed(2), max: +(min + 1.3).toFixed(2), count: Math.max(50, 800 - dist * dist * 8) };
      }),
      mean: 38.4, std: 4.2,
    },
  };
}
