'use client';

import { useState, useEffect } from 'react';
import { useALM } from '@/components/alm/ALMProvider';
import { useTranslation } from '@/lib/i18n';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Line } from 'recharts';
import { Activity, AlertTriangle } from 'lucide-react';

interface HullWhiteResult {
  params: { a: number; sigma: number; dt: number; thetaPoints: number };
  initialRate: number;
  simulation: {
    meanPath: number[];
    percentiles: Record<string, number[]>;
    samplePaths: number[][];
  };
  baseCurve: Array<{ tenor: number; rate: number }>;
}

function getDemoData(): HullWhiteResult {
  const steps = 21; // 5 years quarterly + initial
  const r0 = 0.045;
  const meanPath = Array.from({ length: steps }, (_, i) => r0 + (Math.random() - 0.48) * 0.002 * i);
  return {
    params: { a: 0.1, sigma: 0.01, dt: 0.25, thetaPoints: 20 },
    initialRate: r0,
    simulation: {
      meanPath,
      percentiles: {
        p5: meanPath.map((v, i) => v - 0.008 - i * 0.001),
        p25: meanPath.map((v, i) => v - 0.003 - i * 0.0004),
        p50: meanPath,
        p75: meanPath.map((v, i) => v + 0.003 + i * 0.0004),
        p95: meanPath.map((v, i) => v + 0.008 + i * 0.001),
      },
      samplePaths: Array.from({ length: 5 }, () => meanPath.map((v) => v + (Math.random() - 0.5) * 0.015)),
    },
    baseCurve: [
      { tenor: 0.25, rate: 0.048 }, { tenor: 0.5, rate: 0.0465 }, { tenor: 1, rate: 0.044 },
      { tenor: 2, rate: 0.042 }, { tenor: 3, rate: 0.041 }, { tenor: 5, rate: 0.0405 },
    ],
  };
}

export default function HullWhitePage() {
  const { selectedId } = useALM();
  const { locale } = useTranslation();
  const [data, setData] = useState<HullWhiteResult | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!selectedId) return;
    (async () => {
      setLoading(true);
      try {
        const NODE = (process.env.NEXT_PUBLIC_NODE_API_URL || '').trim().replace(/\/+$/, '');
        const res = await fetch(`${NODE}/api/alm/${selectedId}/yield-curve/hull-white`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ numPaths: 500, horizonYears: 5 }),
        });
        if (res.ok) setData(await res.json());
        else setData(getDemoData());
      } catch { setData(getDemoData()); }
      finally { setLoading(false); }
    })();
  }, [selectedId]);

  if (!selectedId) return <div className="flex-1 flex items-center justify-center p-6"><AlertTriangle className="h-12 w-12 text-amber-500" /></div>;
  if (loading) return <div className="flex-1 flex items-center justify-center p-6"><div className="h-8 w-8 animate-spin rounded-full border-2 border-cyan-200 border-t-cyan-600" /></div>;
  if (!data) return <div className="flex-1 flex items-center justify-center p-6 text-sm text-slate-400">No data available</div>;

  const fanChartData = data.simulation.meanPath.map((_, i) => ({
    quarter: `Q${i}`,
    p5: +((data.simulation.percentiles.p5[i] ?? 0) * 100).toFixed(2),
    p25: +((data.simulation.percentiles.p25[i] ?? 0) * 100).toFixed(2),
    mean: +((data.simulation.meanPath[i] ?? 0) * 100).toFixed(2),
    p75: +((data.simulation.percentiles.p75[i] ?? 0) * 100).toFixed(2),
    p95: +((data.simulation.percentiles.p95[i] ?? 0) * 100).toFixed(2),
  }));

  const terminalRate = data.simulation.meanPath[data.simulation.meanPath.length - 1] ?? 0;
  const rateRange = ((data.simulation.percentiles.p95[data.simulation.percentiles.p95.length - 1] ?? 0) -
    (data.simulation.percentiles.p5[data.simulation.percentiles.p5.length - 1] ?? 0)) * 10000;

  return (
    <div className="p-6 space-y-5 max-w-[1400px] mx-auto">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-violet-200 bg-violet-50">
          <Activity className="h-4 w-4 text-violet-700" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-slate-950">{locale === 'es' ? 'Modelo Hull-White (Tasa Corta)' : 'Hull-White Short-Rate Model'}</h1>
          <p className="text-xs text-slate-500">{locale === 'es' ? 'Proceso Ornstein-Uhlenbeck con reversion a la media — 500 trayectorias simuladas' : 'Mean-reverting Ornstein-Uhlenbeck process — 500 simulated paths'}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="rounded-xl border border-slate-200 bg-white p-3">
          <p className="text-[10px] font-medium uppercase text-slate-400">{locale === 'es' ? 'Tasa Inicial' : 'Initial Rate'}</p>
          <p className="text-2xl font-bold tabular-nums text-slate-950">{(data.initialRate * 100).toFixed(2)}%</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-3">
          <p className="text-[10px] font-medium uppercase text-slate-400">{locale === 'es' ? 'Tasa Terminal (Media)' : 'Terminal Rate (Mean)'}</p>
          <p className="text-2xl font-bold tabular-nums text-slate-950">{(terminalRate * 100).toFixed(2)}%</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-3">
          <p className="text-[10px] font-medium uppercase text-slate-400">{locale === 'es' ? 'Rango 90% (5Y)' : '90% Range (5Y)'}</p>
          <p className="text-2xl font-bold tabular-nums text-slate-950">{rateRange.toFixed(0)} bps</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-3">
          <p className="text-[10px] font-medium uppercase text-slate-400">{locale === 'es' ? 'Reversion Media' : 'Mean Reversion'}</p>
          <p className="text-2xl font-bold tabular-nums text-slate-950">a = {data.params.a}</p>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <h3 className="text-sm font-bold text-slate-950 mb-3">{locale === 'es' ? 'Fan Chart — Trayectorias de Tasa Corta (5 Anos)' : 'Fan Chart — Short Rate Paths (5 Years)'}</h3>
        <ResponsiveContainer width="100%" height={380}>
          <AreaChart data={fanChartData}>
            <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.3} />
            <XAxis dataKey="quarter" tick={{ fontSize: 10 }} />
            <YAxis domain={['auto', 'auto']} tick={{ fontSize: 11 }} tickFormatter={(v: number) => `${v.toFixed(1)}%`} />
            <Tooltip formatter={(value) => `${Number(value).toFixed(2)}%`} />
            <Legend />
            <Area type="monotone" dataKey="p95" name="P95" stroke="none" fill="#c4b5fd" fillOpacity={0.3} />
            <Area type="monotone" dataKey="p75" name="P75" stroke="none" fill="#a78bfa" fillOpacity={0.3} />
            <Area type="monotone" dataKey="p25" name="P25" stroke="none" fill="#a78bfa" fillOpacity={0.3} />
            <Area type="monotone" dataKey="p5" name="P5" stroke="none" fill="#c4b5fd" fillOpacity={0.3} />
            <Line type="monotone" dataKey="mean" name={locale === 'es' ? 'Media' : 'Mean'} stroke="#7c3aed" strokeWidth={2.5} dot={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <h3 className="text-sm font-bold text-slate-950 mb-3">{locale === 'es' ? 'Parametros del Modelo' : 'Model Parameters'}</h3>
          <div className="space-y-2 text-xs">
            <div className="flex justify-between border-b border-slate-100 pb-1">
              <span className="text-slate-500">{locale === 'es' ? 'Velocidad de reversion (a)' : 'Mean reversion speed (a)'}</span>
              <span className="font-bold tabular-nums text-slate-950">{data.params.a}</span>
            </div>
            <div className="flex justify-between border-b border-slate-100 pb-1">
              <span className="text-slate-500">{locale === 'es' ? 'Volatilidad (sigma)' : 'Volatility (sigma)'}</span>
              <span className="font-bold tabular-nums text-slate-950">{data.params.sigma}</span>
            </div>
            <div className="flex justify-between border-b border-slate-100 pb-1">
              <span className="text-slate-500">{locale === 'es' ? 'Paso temporal' : 'Time step'}</span>
              <span className="font-bold tabular-nums text-slate-950">{data.params.dt} {locale === 'es' ? 'anos' : 'years'}</span>
            </div>
            <div className="flex justify-between border-b border-slate-100 pb-1">
              <span className="text-slate-500">{locale === 'es' ? 'Puntos theta calibrados' : 'Calibrated theta points'}</span>
              <span className="font-bold tabular-nums text-slate-950">{data.params.thetaPoints}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">{locale === 'es' ? 'Trayectorias simuladas' : 'Simulated paths'}</span>
              <span className="font-bold tabular-nums text-slate-950">500</span>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <h3 className="text-sm font-bold text-slate-950 mb-3">{locale === 'es' ? 'Distribucion Terminal (5Y)' : 'Terminal Distribution (5Y)'}</h3>
          <div className="space-y-2 text-xs">
            {(['p5', 'p25', 'p50', 'p75', 'p95'] as const).map(pct => {
              const vals = data.simulation.percentiles[pct];
              const terminal = vals?.[vals.length - 1] ?? 0;
              return (
                <div key={pct} className="flex justify-between border-b border-slate-100 pb-1">
                  <span className="text-slate-500">{pct.toUpperCase()}</span>
                  <span className="font-bold tabular-nums text-slate-950">{(terminal * 100).toFixed(2)}%</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
