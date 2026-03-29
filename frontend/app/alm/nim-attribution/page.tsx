'use client';

import { useState, useEffect } from 'react';
import { useALM } from '@/components/alm/ALMProvider';
import { useTranslation } from '@/lib/i18n';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, ReferenceLine } from 'recharts';
import { TrendingDown, AlertTriangle } from 'lucide-react';

interface NIMAttributionFactor {
  factor: string;
  factorEs: string;
  bps: number;
  explanation: string;
  explanationEs: string;
}

interface NIMAttributionData {
  nimCurrent: number;
  nimPrior: number;
  nimDeltaBps: number;
  attribution: NIMAttributionFactor[];
  totalExplainedBps: number;
  residualBps: number;
}

export default function NIMAttributionPage() {
  const { selectedId } = useALM();
  const { locale } = useTranslation();
  const [data, setData] = useState<NIMAttributionData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!selectedId) return;
    (async () => {
      setLoading(true);
      try {
        const NODE = (process.env.NEXT_PUBLIC_NODE_API_URL || '').trim().replace(/\/+$/, '');
        const res = await fetch(`${NODE}/api/alm/${selectedId}/nim-attribution`);
        if (res.ok) setData(await res.json() as NIMAttributionData);
        else setData(getDemoData());
      } catch { setData(getDemoData()); }
      finally { setLoading(false); }
    })();
  }, [selectedId]);

  if (!selectedId) return <div className="flex-1 flex items-center justify-center p-6"><AlertTriangle className="h-12 w-12 text-amber-500" /></div>;
  if (loading || !data) return <div className="flex-1 flex items-center justify-center p-6"><div className="h-8 w-8 animate-spin rounded-full border-2 border-cyan-200 border-t-cyan-600" /></div>;

  const chartData = data.attribution.map((factor) => ({
    name: locale === 'es' ? factor.factorEs : factor.factor,
    bps: factor.bps,
  }));

  return (
    <div className="p-6 space-y-5 max-w-[1400px] mx-auto">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-amber-200 bg-amber-50">
          <TrendingDown className="h-4 w-4 text-amber-700" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-slate-950">{locale === 'es' ? 'Atribución NIM — 7 Factores' : 'NIM Attribution — 7 Factors'}</h1>
          <p className="text-xs text-slate-500">{locale === 'es' ? 'Descomposición del cambio NIM en drivers individuales' : 'NIM change decomposed into individual drivers'}</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl border border-slate-200 bg-white p-3 text-center">
          <p className="text-[10px] text-slate-400">NIM {locale === 'es' ? 'Previo' : 'Prior'}</p>
          <p className="text-2xl font-bold tabular-nums text-slate-950">{data.nimPrior}%</p>
        </div>
        <div className={`rounded-xl border p-3 text-center ${data.nimDeltaBps >= 0 ? 'border-emerald-200 bg-emerald-50' : 'border-rose-200 bg-rose-50'}`}>
          <p className="text-[10px] text-slate-400">{locale === 'es' ? 'Cambio' : 'Change'}</p>
          <p className={`text-2xl font-bold tabular-nums ${data.nimDeltaBps >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>{data.nimDeltaBps >= 0 ? '+' : ''}{data.nimDeltaBps} bps</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-3 text-center">
          <p className="text-[10px] text-slate-400">NIM {locale === 'es' ? 'Actual' : 'Current'}</p>
          <p className="text-2xl font-bold tabular-nums text-slate-950">{data.nimCurrent}%</p>
        </div>
      </div>

      {/* Waterfall Chart */}
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-4">{locale === 'es' ? 'Cascada de Factores NIM (bps)' : 'NIM Factor Waterfall (bps)'}</p>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-15} textAnchor="end" height={60} />
            <YAxis tick={{ fontSize: 11 }} label={{ value: 'bps', angle: -90, position: 'insideLeft', style: { fontSize: 10 } }} />
            <Tooltip contentStyle={{ borderRadius: 12, fontSize: 12 }} />
            <ReferenceLine y={0} stroke="#94a3b8" />
            <Bar dataKey="bps" radius={[4, 4, 0, 0]}>
              {chartData.map((entry, i) => <Cell key={i} fill={entry.bps >= 0 ? '#10b981' : '#ef4444'} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Factor Detail */}
      <div className="space-y-2">
        {data.attribution.map((factor, i) => (
          <div key={i} className={`flex items-center gap-3 rounded-xl border p-3 ${factor.bps >= 0 ? 'border-emerald-100 bg-emerald-50/30' : 'border-rose-100 bg-rose-50/30'}`}>
            <span className={`text-sm font-bold tabular-nums w-16 text-right ${factor.bps >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>{factor.bps >= 0 ? '+' : ''}{factor.bps}</span>
            <div className="flex-1">
              <p className="text-sm font-medium text-slate-800">{locale === 'es' ? factor.factorEs : factor.factor}</p>
              <p className="text-[10px] text-slate-500">{locale === 'es' ? factor.explanationEs : factor.explanation}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function getDemoData(): NIMAttributionData {
  return {
    nimCurrent: 3.42, nimPrior: 3.68, nimDeltaBps: -26,
    attribution: [
      { factor: 'Rate Environment', factorEs: 'Entorno de Tasas', bps: -9, explanation: 'Fed rate changes impacting repricing.', explanationEs: 'Cambios Fed impactando repreciación.' },
      { factor: 'Deposit Beta', factorEs: 'Beta de Depósitos', bps: -7, explanation: 'Deposit costs rising faster than yields.', explanationEs: 'Costos depósitos subiendo más rápido.' },
      { factor: 'Volume Growth', factorEs: 'Crecimiento Volumen', bps: 4, explanation: 'New loans at current rates.', explanationEs: 'Nuevos préstamos a tasas actuales.' },
      { factor: 'Mix Shift', factorEs: 'Cambio en Mezcla', bps: -3, explanation: 'Shift toward lower-yield assets.', explanationEs: 'Movimiento hacia activos de menor rendimiento.' },
      { factor: 'Repricing Lag', factorEs: 'Rezago Repreciación', bps: -5, explanation: 'Fixed-rate assets not yet repriced.', explanationEs: 'Activos tasa fija sin repreciar.' },
      { factor: 'Prepayment', factorEs: 'Prepago', bps: -4, explanation: 'High-rate mortgages prepaying.', explanationEs: 'Hipotecas de alta tasa prepagando.' },
      { factor: 'Credit Quality', factorEs: 'Calidad Crediticia', bps: -2, explanation: 'Higher provisions.', explanationEs: 'Mayor provisión.' },
    ],
    totalExplainedBps: -26, residualBps: 0,
  };
}
