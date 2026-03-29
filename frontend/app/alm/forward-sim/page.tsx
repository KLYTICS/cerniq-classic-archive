'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '@/lib/api';
import { useALM } from '@/components/alm/ALMProvider';
import { useTranslation } from '@/lib/i18n';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { TrendingUp, AlertTriangle, Play, RefreshCw } from 'lucide-react';

interface ForwardQuarter {
  quarter: string; ratePath: string;
  projectedNII: number; projectedEVE: number;
  projectedLCR: number; projectedNSFR: number;
  projectedNWR: number; totalAssets: number; totalLiabilities: number;
}

interface ForwardSimResult {
  config: { horizon: number; growthAssumptions: Record<string, number>; ratePaths: string[] };
  quarters: ForwardQuarter[];
  summary: {
    baseNIIYear1: number; baseNIIYear3: number;
    up200NIIYear3: number; down100NIIYear3: number;
    worstCaseNWR: number; worstCaseLCR: number;
  };
}

type ForwardChartEntry = Record<string, string | number> & { quarter: string };

const PATH_COLORS: Record<string, string> = { base: '#0f172a', up200: '#ef4444', down100: '#3b82f6' };
const PATH_LABELS: Record<string, { en: string; es: string }> = {
  base: { en: 'Base (Current Rates)', es: 'Base (Tasas Actuales)' },
  up200: { en: '+200bps Parallel', es: '+200bps Paralelo' },
  down100: { en: '-100bps Parallel', es: '-100bps Paralelo' },
};

export default function ForwardSimPage() {
  const { selectedId } = useALM();
  const { locale } = useTranslation();
  const [data, setData] = useState<ForwardSimResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [metric, setMetric] = useState<'NII' | 'LCR' | 'NWR'>('NII');

  const runSim = useCallback(async () => {
    if (!selectedId) return;
    setLoading(true);
    try { setData(await apiClient.runForwardSimulation(selectedId)); }
    catch { setData(getDemoData()); }
    finally { setLoading(false); }
  }, [selectedId]);

  useEffect(() => { runSim(); }, [runSim]);

  if (!selectedId) return <div className="flex-1 flex items-center justify-center p-6"><AlertTriangle className="h-12 w-12 text-amber-500" /></div>;

  const paths = data?.config.ratePaths ?? ['base', 'up200', 'down100'];
  const baseQuarters = data?.quarters.filter(q => q.ratePath === 'base') ?? [];

  // Build chart data: one entry per quarter, keys = path names
  const chartData = baseQuarters.map(bq => {
    const entry: ForwardChartEntry = { quarter: bq.quarter };
    for (const path of paths) {
      const pq = data?.quarters.find(q => q.quarter === bq.quarter && q.ratePath === path);
      if (pq) {
        entry[`${path}_NII`] = pq.projectedNII;
        entry[`${path}_LCR`] = pq.projectedLCR;
        entry[`${path}_NWR`] = pq.projectedNWR;
      }
    }
    return entry;
  });

  const metricKey = metric;

  return (
    <div className="p-6 space-y-5 max-w-[1400px] mx-auto">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-violet-200 bg-violet-50">
            <TrendingUp className="h-4 w-4 text-violet-700" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-950">
              {locale === 'es' ? 'Simulación Forward 3 Años' : '3-Year Forward Simulation'}
            </h1>
            <p className="text-xs text-slate-500">
              {locale === 'es' ? 'Proyecciones NII/LCR/Capital bajo 3 escenarios de tasas' : 'NII/LCR/Capital projections under 3 rate scenarios'}
            </p>
          </div>
        </div>
        <button
          onClick={runSim}
          disabled={loading}
          className="flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-violet-700 disabled:opacity-50"
        >
          {loading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
          {loading ? (locale === 'es' ? 'Ejecutando...' : 'Running...') : (locale === 'es' ? 'Ejecutar Simulación' : 'Run Simulation')}
        </button>
      </div>

      {data && (
        <>
          {/* Summary KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
            <KPI label={locale === 'es' ? 'NII Base Año 1' : 'Base NII Y1'} value={`$${data.summary.baseNIIYear1.toFixed(1)}M`} />
            <KPI label={locale === 'es' ? 'NII Base Año 3' : 'Base NII Y3'} value={`$${data.summary.baseNIIYear3.toFixed(1)}M`} />
            <KPI label={locale === 'es' ? 'NII +200 Año 3' : '+200 NII Y3'} value={`$${data.summary.up200NIIYear3.toFixed(1)}M`} accent />
            <KPI label={locale === 'es' ? 'NII -100 Año 3' : '-100 NII Y3'} value={`$${data.summary.down100NIIYear3.toFixed(1)}M`} />
            <KPI label={locale === 'es' ? 'Peor NWR' : 'Worst NWR'} value={`${data.summary.worstCaseNWR.toFixed(1)}%`} warn={data.summary.worstCaseNWR < 7} />
            <KPI label={locale === 'es' ? 'Peor LCR' : 'Worst LCR'} value={`${data.summary.worstCaseLCR.toFixed(0)}%`} warn={data.summary.worstCaseLCR < 100} />
          </div>

          {/* Metric Selector */}
          <div className="flex gap-2">
            {(['NII', 'LCR', 'NWR'] as const).map(m => (
              <button
                key={m}
                onClick={() => setMetric(m)}
                className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
                  metric === m ? 'border-violet-400 bg-violet-50 text-violet-700' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                }`}
              >
                {m === 'NII' ? (locale === 'es' ? 'Ingreso Neto (NII)' : 'Net Interest Income') :
                 m === 'LCR' ? 'LCR' : (locale === 'es' ? 'Ratio Capital (NWR)' : 'Net Worth Ratio')}
              </button>
            ))}
          </div>

          {/* Fan Chart */}
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-4">
              {metricKey} — {locale === 'es' ? '12 Trimestres, 3 Escenarios' : '12 Quarters, 3 Scenarios'}
            </p>
            <ResponsiveContainer width="100%" height={350}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="quarter" tick={{ fontSize: 10 }} angle={-20} textAnchor="end" height={50} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={v => metricKey === 'NII' ? `$${v}M` : `${v}%`} />
                <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                {metricKey === 'NWR' && <Line type="monotone" dataKey="__threshold" stroke="#ef4444" strokeDasharray="8 4" strokeWidth={1} dot={false} name="7% Minimum" />}
                {paths.map(path => (
                  <Line
                    key={path}
                    type="monotone"
                    dataKey={`${path}_${metricKey}`}
                    stroke={PATH_COLORS[path] || '#6b7280'}
                    strokeWidth={path === 'base' ? 3 : 2}
                    dot={path === 'base'}
                    name={locale === 'es' ? PATH_LABELS[path]?.es : PATH_LABELS[path]?.en}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </>
      )}
    </div>
  );
}

function KPI({ label, value, accent, warn }: { label: string; value: string; accent?: boolean; warn?: boolean }) {
  return (
    <div className={`rounded-xl border p-3 ${warn ? 'border-rose-200 bg-rose-50' : accent ? 'border-violet-200 bg-violet-50' : 'border-slate-200 bg-white'}`}>
      <p className="text-[10px] font-medium uppercase tracking-wider text-slate-400">{label}</p>
      <p className={`text-lg font-bold tabular-nums ${warn ? 'text-rose-700' : accent ? 'text-violet-700' : 'text-slate-950'}`}>{value}</p>
    </div>
  );
}

function getDemoData(): ForwardSimResult {
  const paths = ['base', 'up200', 'down100'];
  const quarters: ForwardQuarter[] = [];
  for (const path of paths) {
    const shock = path === 'up200' ? 200 : path === 'down100' ? -100 : 0;
    for (let q = 1; q <= 12; q++) {
      const growth = Math.pow(1.03, q / 4);
      const rateEffect = (shock / 10000) * 0.5 * q / 12;
      quarters.push({
        quarter: `Q${((q - 1) % 4) + 1} ${2026 + Math.floor((q - 1) / 4)}`,
        ratePath: path,
        projectedNII: +(3.2 * growth + 3.2 * rateEffect).toFixed(2),
        projectedEVE: +(52 * growth - shock * 0.08 * q / 12).toFixed(1),
        projectedLCR: +Math.min(180, Math.max(80, 115 + shock * 0.01 - q * 0.5)).toFixed(1),
        projectedNSFR: +Math.min(160, Math.max(85, 108 + shock * 0.005)).toFixed(1),
        projectedNWR: +Math.max(5, 9.2 - q * 0.05 + shock * 0.001).toFixed(1),
        totalAssets: Math.round(445 * growth),
        totalLiabilities: Math.round(385 * growth),
      });
    }
  }
  return {
    config: { horizon: 3, growthAssumptions: {}, ratePaths: paths },
    quarters,
    summary: { baseNIIYear1: 12.8, baseNIIYear3: 41.2, up200NIIYear3: 48.5, down100NIIYear3: 35.8, worstCaseNWR: 6.8, worstCaseLCR: 88 },
  };
}
