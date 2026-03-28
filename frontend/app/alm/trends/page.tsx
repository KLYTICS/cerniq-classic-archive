'use client';

import { useState, useEffect, useCallback } from 'react';
import { useALM } from '@/components/alm/ALMProvider';
import { useTranslation } from '@/lib/i18n';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { TrendingUp, RefreshCw, Eye, EyeOff } from 'lucide-react';

// ─── Types ──────────────────────────────────────────────────

interface TrendPoint {
  date: string;
  riskScore: number;
  capitalRatio: number;
  lcr: number;
  durationGap: number;
}

interface MetricConfig {
  key: keyof Omit<TrendPoint, 'date'>;
  labelEn: string;
  labelEs: string;
  color: string;
  unit: string;
}

const METRICS: MetricConfig[] = [
  { key: 'riskScore', labelEn: 'Risk Score', labelEs: 'Puntuaci\u00f3n de Riesgo', color: '#06b6d4', unit: '' },
  { key: 'capitalRatio', labelEn: 'Capital Ratio', labelEs: 'Ratio de Capital', color: '#8b5cf6', unit: '%' },
  { key: 'lcr', labelEn: 'LCR', labelEs: 'LCR', color: '#22c55e', unit: '%' },
  { key: 'durationGap', labelEn: 'Duration Gap', labelEs: 'Brecha de Duraci\u00f3n', color: '#f59e0b', unit: 'yr' },
];

// ─── Demo data fallback ─────────────────────────────────────

function generateDemoData(): TrendPoint[] {
  const now = new Date();
  return Array.from({ length: 12 }, (_, i) => {
    const d = new Date(now);
    d.setMonth(d.getMonth() - (11 - i));
    return {
      date: d.toISOString().slice(0, 10),
      riskScore: 62 + Math.round(Math.random() * 20),
      capitalRatio: 10.5 + Math.round(Math.random() * 30) / 10,
      lcr: 105 + Math.round(Math.random() * 40),
      durationGap: 1.2 + Math.round(Math.random() * 20) / 10,
    };
  });
}

// ─── Page ───────────────────────────────────────────────────

export default function TrendsPage() {
  const { selectedId, institution } = useALM();
  const { locale } = useTranslation();
  const [data, setData] = useState<TrendPoint[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDemo, setIsDemo] = useState(false);
  const [visibleMetrics, setVisibleMetrics] = useState<Set<string>>(
    () => new Set(METRICS.map((m) => m.key)),
  );

  const fetchTrend = useCallback(async (institutionId: string) => {
    setLoading(true);
    setError(null);
    setIsDemo(false);
    try {
      const res = await fetch(`/api/alm/${institutionId}/trend`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      const points: TrendPoint[] = Array.isArray(json) ? json : json.data ?? json.points ?? [];
      if (points.length === 0) throw new Error('empty');
      setData(points);
    } catch {
      // Fall back to demo data
      setData(generateDemoData());
      setIsDemo(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedId) fetchTrend(selectedId);
  }, [selectedId, fetchTrend]);

  const toggleMetric = (key: string) => {
    setVisibleMetrics((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        // Prevent hiding all metrics
        if (next.size > 1) next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const isEs = locale === 'es';

  // ─── Loading state ──────────────────────────────────────────

  if (loading && !data) {
    return (
      <div className="p-6 space-y-5 max-w-[1400px] mx-auto animate-pulse">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-slate-100" />
          <div className="space-y-1.5">
            <div className="h-4 w-56 rounded bg-slate-100" />
            <div className="h-3 w-36 rounded bg-slate-100" />
          </div>
        </div>
        <div className="h-[400px] rounded-xl border border-slate-100 bg-white" />
      </div>
    );
  }

  return (
    <div className="p-5 space-y-4 max-w-[1400px] mx-auto">
      {/* Demo banner */}
      {isDemo && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50/80 px-4 py-2">
          <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-500" />
          <p className="text-[11px] font-medium uppercase tracking-wide text-amber-800/80">
            {isEs ? 'Datos de demostraci\u00f3n \u2014 conecte una instituci\u00f3n para ver datos reales' : 'Demo data \u2014 connect an institution to view live trends'}
          </p>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-5 py-3">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600">
            <TrendingUp className="h-4 w-4 text-white" />
          </div>
          <div>
            <h1 className="text-base font-bold text-slate-950">
              {isEs ? 'Tendencias Hist\u00f3ricas' : 'Historical Trends'}
            </h1>
            <p className="text-[10px] text-slate-500">
              {institution?.name ?? (isEs ? 'Sin instituci\u00f3n seleccionada' : 'No institution selected')}
              {data && ` \u00b7 ${data.length} ${isEs ? 'per\u00edodos' : 'periods'}`}
            </p>
          </div>
        </div>

        <button
          onClick={() => selectedId && fetchTrend(selectedId)}
          disabled={loading}
          className="flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-[10px] text-slate-500 hover:border-slate-300 disabled:opacity-50"
        >
          <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
          {isEs ? 'Actualizar' : 'Refresh'}
        </button>
      </div>

      {/* Error banner */}
      {error && !isDemo && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-2 text-xs text-rose-700">
          {error}
        </div>
      )}

      {/* Metric toggles */}
      <div className="flex flex-wrap gap-2">
        {METRICS.map((m) => {
          const active = visibleMetrics.has(m.key);
          return (
            <button
              key={m.key}
              onClick={() => toggleMetric(m.key)}
              className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-medium transition ${
                active
                  ? 'border-slate-300 bg-white text-slate-800 shadow-sm'
                  : 'border-slate-100 bg-slate-50 text-slate-400'
              }`}
            >
              <span
                className="inline-block h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: active ? m.color : '#cbd5e1' }}
              />
              {isEs ? m.labelEs : m.labelEn}
              {active ? (
                <Eye className="h-3 w-3 text-slate-400" />
              ) : (
                <EyeOff className="h-3 w-3 text-slate-300" />
              )}
            </button>
          );
        })}
      </div>

      {/* Chart */}
      {data && data.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <ResponsiveContainer width="100%" height={420}>
            <LineChart data={data} margin={{ top: 10, right: 30, left: 10, bottom: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 10, fill: '#94a3b8' }}
                tickFormatter={(val: string) => {
                  const d = new Date(val);
                  return d.toLocaleDateString(isEs ? 'es-PR' : 'en-US', {
                    month: 'short',
                    year: '2-digit',
                  });
                }}
              />
              <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} width={45} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#fff',
                  border: '1px solid #e2e8f0',
                  borderRadius: 8,
                  fontSize: 11,
                }}
                labelFormatter={(val) => {
                  const d = new Date(String(val));
                  return d.toLocaleDateString(isEs ? 'es-PR' : 'en-US', {
                    month: 'long',
                    year: 'numeric',
                  });
                }}
              />
              <Legend
                wrapperStyle={{ fontSize: 11, paddingTop: 12 }}
              />
              {METRICS.map((m) =>
                visibleMetrics.has(m.key) ? (
                  <Line
                    key={m.key}
                    type="monotone"
                    dataKey={m.key}
                    name={`${isEs ? m.labelEs : m.labelEn}${m.unit ? ` (${m.unit})` : ''}`}
                    stroke={m.color}
                    strokeWidth={2}
                    dot={{ r: 3, fill: m.color }}
                    activeDot={{ r: 5 }}
                  />
                ) : null,
              )}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Summary table */}
      {data && data.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              {isEs ? 'Resumen de Datos' : 'Data Summary'}
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/50">
                  <th className="px-4 py-2 text-left font-medium text-slate-500">
                    {isEs ? 'Fecha' : 'Date'}
                  </th>
                  {METRICS.map((m) => (
                    <th key={m.key} className="px-4 py-2 text-right font-medium text-slate-500">
                      {isEs ? m.labelEs : m.labelEn}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.map((row, i) => (
                  <tr key={row.date} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50/30'}>
                    <td className="px-4 py-2 text-slate-700 tabular-nums">
                      {new Date(row.date).toLocaleDateString(isEs ? 'es-PR' : 'en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </td>
                    {METRICS.map((m) => (
                      <td key={m.key} className="px-4 py-2 text-right tabular-nums text-slate-700">
                        {typeof row[m.key] === 'number'
                          ? row[m.key].toFixed(m.key === 'riskScore' ? 0 : 1)
                          : row[m.key]}
                        {m.unit}
                      </td>
                    ))}
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
