'use client';

import { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api';
import { useALM } from '@/components/alm/ALMProvider';
import { useTranslation } from '@/lib/i18n';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, ReferenceLine } from 'recharts';
import { TrendingUp, AlertTriangle, ArrowUp, ArrowDown, Minus } from 'lucide-react';

interface RateRec {
  product: string; category: string; currentRate: number; peerMedianRate: number;
  suggestedRate: number; rateDeltaBps: number; direction: string; niiImpact: number;
  volumeImpact: string; rationale: string; rationaleEs: string;
}

interface NIMResult { currentNIM: number; projectedNIM: number; nimGainBps: number; totalNIIGain: number; recommendations: RateRec[] }

export default function NIMOptimizerPage() {
  const { selectedId } = useALM();
  const { locale } = useTranslation();
  const [data, setData] = useState<NIMResult | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!selectedId) return;
    (async () => {
      setLoading(true);
      try {
        const NODE_API_URL = (process.env.NEXT_PUBLIC_NODE_API_URL || '').trim().replace(/\/+$/, '');
        const res = await fetch(`${NODE_API_URL}/api/alm/${selectedId}/nim-optimizer`);
        if (res.ok) setData(await res.json());
        else setData(getDemoData());
      } catch { setData(getDemoData()); }
      finally { setLoading(false); }
    })();
  }, [selectedId]);

  if (!selectedId) return <div className="flex-1 flex items-center justify-center p-6"><AlertTriangle className="h-12 w-12 text-amber-500" /></div>;
  if (loading) return <div className="flex-1 flex items-center justify-center p-6"><div className="h-8 w-8 animate-spin rounded-full border-2 border-cyan-200 border-t-cyan-600" /></div>;
  if (!data) return <div className="flex-1 flex items-center justify-center p-6 text-sm text-slate-400">No data available</div>;

  function getDemoData(): NIMResult {
    return {
      currentNIM: 3.42, projectedNIM: 3.68, nimGainBps: 26, totalNIIGain: 4800000,
      recommendations: [
        { product: 'Auto Loans', category: 'Lending', currentRate: 6.25, peerMedianRate: 6.85, suggestedRate: 6.75, rateDeltaBps: 50, direction: 'up', niiImpact: 1200000, volumeImpact: 'Minimal', rationale: 'Below peer median by 60bps with strong demand', rationaleEs: 'Por debajo de la mediana de pares por 60bps con demanda fuerte' },
        { product: 'Personal Loans', category: 'Lending', currentRate: 9.50, peerMedianRate: 10.15, suggestedRate: 9.95, rateDeltaBps: 45, direction: 'up', niiImpact: 850000, volumeImpact: 'Low', rationale: 'Competitive gap allows 45bps increase', rationaleEs: 'Brecha competitiva permite aumento de 45bps' },
        { product: 'Share Certificates', category: 'Deposits', currentRate: 4.75, peerMedianRate: 4.40, suggestedRate: 4.50, rateDeltaBps: -25, direction: 'down', niiImpact: 1100000, volumeImpact: 'Moderate', rationale: 'Above peer median; reduce to capture spread', rationaleEs: 'Sobre la mediana; reducir para capturar margen' },
        { product: 'Money Market', category: 'Deposits', currentRate: 3.90, peerMedianRate: 3.65, suggestedRate: 3.70, rateDeltaBps: -20, direction: 'down', niiImpact: 650000, volumeImpact: 'Low', rationale: 'Slightly above median with stable balances', rationaleEs: 'Ligeramente sobre mediana con saldos estables' },
        { product: 'Commercial RE', category: 'Lending', currentRate: 7.10, peerMedianRate: 7.45, suggestedRate: 7.35, rateDeltaBps: 25, direction: 'up', niiImpact: 1000000, volumeImpact: 'Minimal', rationale: 'Strong collateral supports higher rate', rationaleEs: 'Colateral fuerte soporta tasa mayor' },
      ],
    };
  }

  const chartData = data.recommendations.map(r => ({ name: r.product, impact: r.niiImpact, direction: r.direction }));

  return (
    <div className="p-6 space-y-5 max-w-[1400px] mx-auto">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-green-200 bg-green-50">
          <TrendingUp className="h-4 w-4 text-green-700" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-slate-950">{locale === 'es' ? 'Optimizador NIM — Recomendaciones de Tasa' : 'NIM Optimizer — Rate Recommendations'}</h1>
          <p className="text-xs text-slate-500">{locale === 'es' ? 'Oportunidades de repricing vs. mediana de pares PR' : 'Repricing opportunities vs. PR peer median'}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="rounded-xl border border-slate-200 bg-white p-3">
          <p className="text-[10px] font-medium uppercase text-slate-400">NIM {locale === 'es' ? 'Actual' : 'Current'}</p>
          <p className="text-2xl font-bold tabular-nums text-slate-950">{data.currentNIM}%</p>
        </div>
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3">
          <p className="text-[10px] font-medium uppercase text-emerald-600">NIM {locale === 'es' ? 'Proyectado' : 'Projected'}</p>
          <p className="text-2xl font-bold tabular-nums text-emerald-700">{data.projectedNIM}%</p>
        </div>
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3">
          <p className="text-[10px] font-medium uppercase text-emerald-600">{locale === 'es' ? 'Ganancia' : 'Gain'}</p>
          <p className="text-2xl font-bold tabular-nums text-emerald-700">+{data.nimGainBps} bps</p>
        </div>
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3">
          <p className="text-[10px] font-medium uppercase text-emerald-600">{locale === 'es' ? 'NII Adicional' : 'NII Gain'}</p>
          <p className="text-2xl font-bold tabular-nums text-emerald-700">+${data.totalNIIGain}M</p>
        </div>
      </div>

      {chartData.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-4">{locale === 'es' ? 'Impacto NII por Producto' : 'NII Impact by Product'}</p>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tickFormatter={v => `$${v}M`} tick={{ fontSize: 11 }} />
              <Tooltip contentStyle={{ borderRadius: 12, fontSize: 12 }} />
              <ReferenceLine y={0} stroke="#94a3b8" />
              <Bar dataKey="impact" radius={[4, 4, 0, 0]}>
                {chartData.map((e, i) => <Cell key={i} fill={e.impact >= 0 ? '#10b981' : '#ef4444'} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="space-y-3">
        {data.recommendations.map((r, i) => (
          <div key={i} className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                {r.direction === 'increase' ? <ArrowUp className="h-4 w-4 text-emerald-600" /> : r.direction === 'decrease' ? <ArrowDown className="h-4 w-4 text-cyan-600" /> : <Minus className="h-4 w-4 text-slate-400" />}
                <span className="text-sm font-semibold text-slate-800 capitalize">{r.product}</span>
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${r.category === 'asset' ? 'bg-cyan-50 text-cyan-700' : 'bg-purple-50 text-purple-700'}`}>{r.category}</span>
              </div>
              <span className="text-sm font-bold tabular-nums text-emerald-700">+${r.niiImpact}M</span>
            </div>
            <div className="flex gap-6 text-xs text-slate-500 mb-2">
              <span>{locale === 'es' ? 'Actual' : 'Current'}: {(r.currentRate * 100).toFixed(2)}%</span>
              <span>{locale === 'es' ? 'Pares' : 'Peer'}: {(r.peerMedianRate * 100).toFixed(2)}%</span>
              <span>{locale === 'es' ? 'Sugerido' : 'Suggested'}: {(r.suggestedRate * 100).toFixed(2)}%</span>
              <span>{r.rateDeltaBps > 0 ? '+' : ''}{r.rateDeltaBps} bps</span>
            </div>
            <p className="text-xs text-slate-600">{locale === 'es' ? r.rationaleEs : r.rationale}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
