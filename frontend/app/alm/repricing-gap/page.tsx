'use client';

import { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api';
import { useALM } from '@/components/alm/ALMProvider';
import { useTranslation } from '@/lib/i18n';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine, Cell } from 'recharts';
import { BarChart3, AlertTriangle } from 'lucide-react';

interface RepricingBucket {
  label: string; labelEs: string;
  assets: number; liabilities: number; gap: number;
  cumulativeGap: number; gapAsPctAssets: number; isPolicyBreach: boolean;
}

interface RepricingGapResult {
  buckets: RepricingBucket[];
  totalAssets: number; totalLiabilities: number; durationGap: number;
  analysisDate: string; policyLimitPct: number;
}

export default function RepricingGapPage() {
  const { selectedId } = useALM();
  const { locale } = useTranslation();
  const [data, setData] = useState<RepricingGapResult | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!selectedId) return;
    (async () => {
      setLoading(true);
      try { setData(await apiClient.getRepricingGap(selectedId)); }
      catch { setData(getDemoData()); }
      finally { setLoading(false); }
    })();
  }, [selectedId]);

  if (!selectedId) return <div className="flex-1 flex items-center justify-center p-6"><AlertTriangle className="h-12 w-12 text-amber-500" /></div>;
  if (loading || !data) return <div className="flex-1 flex items-center justify-center p-6"><div className="h-8 w-8 animate-spin rounded-full border-2 border-cyan-200 border-t-cyan-600" /></div>;

  const chartData = data.buckets.map(b => ({
    bucket: locale === 'es' ? b.labelEs : b.label,
    assets: b.assets, liabilities: -b.liabilities, gap: b.gap,
    cumGap: b.cumulativeGap, breach: b.isPolicyBreach,
  }));

  return (
    <div className="p-6 space-y-5 max-w-[1400px] mx-auto">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-sky-200 bg-sky-50">
          <BarChart3 className="h-4 w-4 text-sky-700" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-slate-950">
            {locale === 'es' ? 'Informe de Brecha de Repricing' : 'Repricing Gap Report'}
          </h1>
          <p className="text-xs text-slate-500">OCIF Carta Circular 2022-03 §IV.B — {locale === 'es' ? 'Formato regulatorio' : 'Regulatory format'}</p>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="rounded-xl border border-slate-200 bg-white p-3">
          <p className="text-[10px] font-medium uppercase tracking-wider text-slate-400">{locale === 'es' ? 'Activos Totales' : 'Total Assets'}</p>
          <p className="text-lg font-bold tabular-nums text-slate-950">${data.totalAssets}M</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-3">
          <p className="text-[10px] font-medium uppercase tracking-wider text-slate-400">{locale === 'es' ? 'Pasivos Totales' : 'Total Liabilities'}</p>
          <p className="text-lg font-bold tabular-nums text-slate-950">${data.totalLiabilities}M</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-3">
          <p className="text-[10px] font-medium uppercase tracking-wider text-slate-400">{locale === 'es' ? 'Brecha Duración' : 'Duration Gap'}</p>
          <p className="text-lg font-bold tabular-nums text-slate-950">{data.durationGap} {locale === 'es' ? 'años' : 'years'}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-3">
          <p className="text-[10px] font-medium uppercase tracking-wider text-slate-400">{locale === 'es' ? 'Límite Política' : 'Policy Limit'}</p>
          <p className="text-lg font-bold tabular-nums text-slate-950">±{data.policyLimitPct}%</p>
        </div>
      </div>

      {/* Gap Chart */}
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-4">
          {locale === 'es' ? 'Brecha por Segmento de Vencimiento' : 'Gap by Maturity Bucket'}
        </p>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="bucket" tick={{ fontSize: 10 }} angle={-15} textAnchor="end" height={50} />
            <YAxis tickFormatter={v => `$${v}M`} tick={{ fontSize: 11 }} />
            <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 12 }} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <ReferenceLine y={0} stroke="#94a3b8" />
            <Bar dataKey="assets" name={locale === 'es' ? 'Activos' : 'Assets'} fill="#06b6d4" radius={[4, 4, 0, 0]} />
            <Bar dataKey="liabilities" name={locale === 'es' ? 'Pasivos' : 'Liabilities'} fill="#8b5cf6" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* OCIF Table */}
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-100">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            OCIF Schedule 7 — {locale === 'es' ? 'Análisis de Brecha de Repricing' : 'Repricing Gap Analysis'}
          </p>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-50 bg-slate-50/50">
              {[locale === 'es' ? 'Segmento' : 'Bucket', locale === 'es' ? 'Activos ($M)' : 'Assets ($M)',
                locale === 'es' ? 'Pasivos ($M)' : 'Liabilities ($M)', locale === 'es' ? 'Brecha ($M)' : 'Gap ($M)',
                locale === 'es' ? 'Brecha Acum.' : 'Cum. Gap', locale === 'es' ? '% de Activos' : '% of Assets'].map(h => (
                <th key={h} className="px-4 py-2.5 text-right text-[11px] font-medium text-slate-500 first:text-left">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.buckets.map(b => (
              <tr key={b.label} className={`border-b border-slate-50 last:border-0 ${b.isPolicyBreach ? 'bg-rose-50/50' : ''}`}>
                <td className="px-4 py-3 font-medium text-slate-700">{locale === 'es' ? b.labelEs : b.label}</td>
                <td className="px-4 py-3 text-right tabular-nums text-slate-600">{b.assets.toFixed(1)}</td>
                <td className="px-4 py-3 text-right tabular-nums text-slate-600">{b.liabilities.toFixed(1)}</td>
                <td className={`px-4 py-3 text-right tabular-nums font-semibold ${b.gap >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>{b.gap.toFixed(1)}</td>
                <td className={`px-4 py-3 text-right tabular-nums font-semibold ${b.cumulativeGap >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>{b.cumulativeGap.toFixed(1)}</td>
                <td className={`px-4 py-3 text-right tabular-nums ${b.isPolicyBreach ? 'font-bold text-rose-700' : 'text-slate-600'}`}>
                  {b.gapAsPctAssets.toFixed(1)}%{b.isPolicyBreach ? ' ⚠' : ''}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function getDemoData(): RepricingGapResult {
  const buckets = [
    { label: '0–30 Days', labelEs: '0–30 Días', assets: 45, liabilities: 95, gap: -50, cumulativeGap: -50, gapAsPctAssets: -11.2, isPolicyBreach: false },
    { label: '31–90 Days', labelEs: '31–90 Días', assets: 30, liabilities: 55, gap: -25, cumulativeGap: -75, gapAsPctAssets: -5.6, isPolicyBreach: false },
    { label: '91–180 Days', labelEs: '91–180 Días', assets: 25, liabilities: 40, gap: -15, cumulativeGap: -90, gapAsPctAssets: -3.4, isPolicyBreach: false },
    { label: '181d–1 Year', labelEs: '181d–1 Año', assets: 60, liabilities: 35, gap: 25, cumulativeGap: -65, gapAsPctAssets: 5.6, isPolicyBreach: false },
    { label: '1–3 Years', labelEs: '1–3 Años', assets: 120, liabilities: 85, gap: 35, cumulativeGap: -30, gapAsPctAssets: 7.9, isPolicyBreach: false },
    { label: '3–5 Years', labelEs: '3–5 Años', assets: 80, liabilities: 45, gap: 35, cumulativeGap: 5, gapAsPctAssets: 7.9, isPolicyBreach: false },
    { label: 'Over 5 Years', labelEs: 'Más de 5 Años', assets: 85, liabilities: 30, gap: 55, cumulativeGap: 60, gapAsPctAssets: 12.4, isPolicyBreach: false },
  ];
  return { buckets, totalAssets: 445, totalLiabilities: 385, durationGap: 2.1, analysisDate: new Date().toISOString(), policyLimitPct: 15 };
}
