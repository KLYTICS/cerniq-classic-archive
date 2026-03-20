'use client';

import { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api';
import { useALM } from '@/components/alm/ALMProvider';
import { useTranslation } from '@/lib/i18n';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Cell } from 'recharts';
import { Activity, AlertTriangle, TrendingUp, TrendingDown } from 'lucide-react';

interface PeerMetric {
  metricName: string; metricNameEs: string;
  institutionValue: number; peerMin: number; peerP25: number;
  peerMedian: number; peerP75: number; peerMax: number;
  percentileRank: number;
  status: 'top_quartile' | 'above_median' | 'below_median' | 'bottom_quartile';
}

interface PeerResult {
  institutionId: string; peerGroupName: string; peerGroupNameEs: string;
  peerCount: number; assetTier: string; metrics: PeerMetric[];
}

const QUARTILE_STYLES = {
  top_quartile: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', label: 'Top Quartile', labelEs: 'Cuartil Superior' },
  above_median: { bg: 'bg-cyan-50', text: 'text-cyan-700', border: 'border-cyan-200', label: 'Above Median', labelEs: 'Sobre la Mediana' },
  below_median: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', label: 'Below Median', labelEs: 'Bajo la Mediana' },
  bottom_quartile: { bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200', label: 'Bottom Quartile', labelEs: 'Cuartil Inferior' },
};

export default function PeerAnalyticsPage() {
  const { selectedId } = useALM();
  const { locale } = useTranslation();
  const [data, setData] = useState<PeerResult | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!selectedId) return;
    (async () => {
      setLoading(true);
      try { setData(await apiClient.getPeerAnalytics(selectedId)); }
      catch { setData(getDemoData()); }
      finally { setLoading(false); }
    })();
  }, [selectedId]);

  if (!selectedId) return <div className="flex-1 flex items-center justify-center p-6"><AlertTriangle className="h-12 w-12 text-amber-500" /></div>;
  if (loading || !data) return <div className="flex-1 flex items-center justify-center p-6"><div className="h-8 w-8 animate-spin rounded-full border-2 border-cyan-200 border-t-cyan-600" /></div>;

  return (
    <div className="p-6 space-y-5 max-w-[1400px] mx-auto">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-indigo-200 bg-indigo-50">
          <Activity className="h-4 w-4 text-indigo-700" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-slate-950">
            {locale === 'es' ? 'Análisis de Pares' : 'Peer Analytics'}
          </h1>
          <p className="text-xs text-slate-500">
            {locale === 'es' ? data.peerGroupNameEs : data.peerGroupName} ({data.peerCount} {locale === 'es' ? 'instituciones' : 'institutions'})
          </p>
        </div>
      </div>

      {/* Quartile Dot-Plots */}
      <div className="space-y-3">
        {data.metrics.map(m => {
          const style = QUARTILE_STYLES[m.status];
          const range = m.peerMax - m.peerMin || 1;
          const pct = ((m.institutionValue - m.peerMin) / range) * 100;
          const medianPct = ((m.peerMedian - m.peerMin) / range) * 100;
          const p25Pct = ((m.peerP25 - m.peerMin) / range) * 100;
          const p75Pct = ((m.peerP75 - m.peerMin) / range) * 100;

          return (
            <div key={m.metricName} className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-sm font-semibold text-slate-950">{locale === 'es' ? m.metricNameEs : m.metricName}</p>
                  <p className="text-[10px] text-slate-500">
                    {locale === 'es' ? 'Rango: ' : 'Range: '}{m.peerMin} — {m.peerMax}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-lg font-bold tabular-nums text-slate-950">{m.institutionValue}</span>
                  <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${style.bg} ${style.text} ${style.border}`}>
                    P{m.percentileRank}
                  </span>
                </div>
              </div>

              {/* Dot-plot bar */}
              <div className="relative h-6 mt-2">
                {/* Full range */}
                <div className="absolute top-2.5 left-0 right-0 h-1 rounded-full bg-slate-100" />
                {/* IQR (p25-p75) */}
                <div
                  className="absolute top-1.5 h-3 rounded bg-slate-200"
                  style={{ left: `${p25Pct}%`, width: `${p75Pct - p25Pct}%` }}
                />
                {/* Median line */}
                <div
                  className="absolute top-0.5 w-0.5 h-5 bg-slate-500"
                  style={{ left: `${medianPct}%` }}
                />
                {/* Institution marker */}
                <div
                  className={`absolute top-0 h-6 w-6 -ml-3 rounded-full border-2 flex items-center justify-center ${style.border} ${style.bg}`}
                  style={{ left: `${Math.max(3, Math.min(97, pct))}%` }}
                >
                  <div className={`h-2 w-2 rounded-full ${
                    m.status === 'top_quartile' ? 'bg-emerald-500' :
                    m.status === 'above_median' ? 'bg-cyan-500' :
                    m.status === 'below_median' ? 'bg-amber-500' : 'bg-rose-500'
                  }`} />
                </div>
              </div>
              <div className="flex justify-between text-[9px] text-slate-400 mt-1">
                <span>{m.peerMin}</span>
                <span>p25: {m.peerP25}</span>
                <span className="font-medium text-slate-600">Median: {m.peerMedian}</span>
                <span>p75: {m.peerP75}</span>
                <span>{m.peerMax}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Summary Table */}
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/50">
              {[locale === 'es' ? 'Métrica' : 'Metric', locale === 'es' ? 'Institución' : 'Institution',
                locale === 'es' ? 'Mediana Pares' : 'Peer Median', locale === 'es' ? 'Brecha' : 'Gap',
                locale === 'es' ? 'Percentil' : 'Percentile', locale === 'es' ? 'Cuartil' : 'Quartile'].map(h => (
                <th key={h} className="px-4 py-2.5 text-left text-[11px] font-medium text-slate-500">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.metrics.map(m => {
              const gap = m.institutionValue - m.peerMedian;
              const style = QUARTILE_STYLES[m.status];
              return (
                <tr key={m.metricName} className="border-b border-slate-50 last:border-0">
                  <td className="px-4 py-3 font-medium text-slate-700">{locale === 'es' ? m.metricNameEs : m.metricName}</td>
                  <td className="px-4 py-3 tabular-nums font-bold text-slate-950">{m.institutionValue}</td>
                  <td className="px-4 py-3 tabular-nums text-slate-500">{m.peerMedian}</td>
                  <td className={`px-4 py-3 tabular-nums font-semibold ${gap >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                    {gap >= 0 ? '+' : ''}{gap.toFixed(2)}
                  </td>
                  <td className="px-4 py-3 tabular-nums text-slate-600">P{m.percentileRank}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${style.bg} ${style.text} ${style.border}`}>
                      {locale === 'es' ? style.labelEs : style.label}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function getDemoData(): PeerResult {
  return {
    institutionId: 'demo', peerGroupName: 'PR Cooperativas $50M–$300M', peerGroupNameEs: 'Cooperativas PR $50M–$300M', peerCount: 43, assetTier: 'medium',
    metrics: [
      { metricName: 'Net Interest Margin (%)', metricNameEs: 'Margen de Interés Neto (%)', institutionValue: 3.5, peerMin: 2.0, peerP25: 3.0, peerMedian: 3.6, peerP75: 4.2, peerMax: 5.5, percentileRank: 45, status: 'below_median' },
      { metricName: 'EVE Sensitivity +200bps (%)', metricNameEs: 'Sensibilidad EVE +200bps (%)', institutionValue: 15.2, peerMin: 3, peerP25: 10, peerMedian: 16, peerP75: 24, peerMax: 40, percentileRank: 48, status: 'below_median' },
      { metricName: 'Liquidity Coverage Ratio (%)', metricNameEs: 'Ratio de Cobertura de Liquidez (%)', institutionValue: 115, peerMin: 78, peerP25: 102, peerMedian: 122, peerP75: 150, peerMax: 230, percentileRank: 42, status: 'below_median' },
      { metricName: 'Implied Deposit Beta', metricNameEs: 'Beta de Depósito Implícito', institutionValue: 0.18, peerMin: 0.08, peerP25: 0.12, peerMedian: 0.17, peerP75: 0.24, peerMax: 0.35, percentileRank: 52, status: 'above_median' },
      { metricName: 'Loan-to-Share Ratio (%)', metricNameEs: 'Ratio Préstamos/Acciones (%)', institutionValue: 72, peerMin: 48, peerP25: 62, peerMedian: 72, peerP75: 82, peerMax: 98, percentileRank: 50, status: 'above_median' },
      { metricName: 'CECL Allowance / Loans (%)', metricNameEs: 'Provisión CECL / Préstamos (%)', institutionValue: 1.3, peerMin: 0.5, peerP25: 0.9, peerMedian: 1.3, peerP75: 2.0, peerMax: 3.5, percentileRank: 50, status: 'above_median' },
    ],
  };
}
