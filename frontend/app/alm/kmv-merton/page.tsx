'use client';

import { useState, useEffect } from 'react';
import { useALM } from '@/components/alm/ALMProvider';
import { useTranslation } from '@/lib/i18n';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Gauge, AlertTriangle } from 'lucide-react';

interface KMVResult {
  portfolioDD: number;
  portfolioEDF: number;
  riskRating: string;
  obligors: Array<{ name: string; assetValue: number; debtPoint: number; dd: number; edf: number; rating: string }>;
}

export default function KMVMertonPage() {
  const { selectedId } = useALM();
  const { locale } = useTranslation();
  const [data, setData] = useState<KMVResult | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!selectedId) return;
    (async () => {
      setLoading(true);
      try {
        const NODE = (process.env.NEXT_PUBLIC_NODE_API_URL || '').trim().replace(/\/+$/, '');
        const res = await fetch(`${NODE}/api/alm/${selectedId}/kmv-merton`);
        if (res.ok) setData(await res.json());
        else setData(getDemo());
      } catch { setData(getDemo()); }
      finally { setLoading(false); }
    })();
  }, [selectedId]);

  if (!selectedId) return <div className="flex-1 flex items-center justify-center p-6"><AlertTriangle className="h-12 w-12 text-amber-500" /></div>;
  if (loading || !data) return <div className="flex-1 flex items-center justify-center p-6"><div className="h-8 w-8 animate-spin rounded-full border-2 border-cyan-200 border-t-cyan-600" /></div>;

  const ddColor = (dd: number) => dd > 3 ? '#22c55e' : dd > 2 ? '#eab308' : dd > 1 ? '#f97316' : '#ef4444';

  return (
    <div className="p-6 space-y-5 max-w-[1400px] mx-auto">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-amber-200 bg-amber-50">
          <Gauge className="h-4 w-4 text-amber-700" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-slate-950">{locale === 'es' ? 'KMV-Merton — Distancia al Incumplimiento' : 'KMV-Merton — Distance to Default'}</h1>
          <p className="text-xs text-slate-500">{locale === 'es' ? 'Modelo estructural: activos vs punto de deuda → EDF' : 'Structural model: assets vs debt point → EDF'}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KPI label={locale === 'es' ? 'DD Portafolio' : 'Portfolio DD'} value={data.portfolioDD.toFixed(2)} accent={data.portfolioDD > 3} warn={data.portfolioDD < 2} />
        <KPI label={locale === 'es' ? 'EDF Portafolio' : 'Portfolio EDF'} value={`${(data.portfolioEDF * 100).toFixed(3)}%`} warn={data.portfolioEDF > 0.02} />
        <KPI label={locale === 'es' ? 'Calificación' : 'Risk Rating'} value={data.riskRating} accent={data.riskRating.startsWith('A')} />
        <KPI label={locale === 'es' ? 'Obligados' : 'Obligors'} value={`${data.obligors.length}`} />
      </div>

      {/* DD Gauge — horizontal bar */}
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-4">
          {locale === 'es' ? 'Distancia al Incumplimiento por Obligado' : 'Distance to Default by Obligor'}
        </p>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={data.obligors} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis type="number" tick={{ fontSize: 11 }} domain={[0, 6]} />
            <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 11 }} />
            <Tooltip contentStyle={{ borderRadius: 12, fontSize: 12 }}
              formatter={(v: number, name: string) => [name === 'dd' ? v.toFixed(2) : `${(v * 100).toFixed(3)}%`, name === 'dd' ? 'DD' : 'EDF']} />
            <Bar dataKey="dd" name="Distance-to-Default" radius={[0, 4, 4, 0]}>
              {data.obligors.map((o, i) => <Cell key={i} fill={ddColor(o.dd)} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        <div className="flex justify-center gap-4 mt-2 text-[10px] text-slate-500">
          <span className="flex items-center gap-1"><div className="h-2 w-2 rounded-full bg-green-500" /> DD &gt; 3 Safe</span>
          <span className="flex items-center gap-1"><div className="h-2 w-2 rounded-full bg-yellow-500" /> DD 2-3 Watch</span>
          <span className="flex items-center gap-1"><div className="h-2 w-2 rounded-full bg-orange-500" /> DD 1-2 Warning</span>
          <span className="flex items-center gap-1"><div className="h-2 w-2 rounded-full bg-red-500" /> DD &lt; 1 Critical</span>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-3">
          {locale === 'es' ? 'Detalle de Obligados' : 'Obligor Detail'}
        </p>
        <div className="space-y-2">
          {data.obligors.map((o, i) => (
            <div key={i} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
              <div>
                <span className="text-sm font-medium text-slate-800">{o.name}</span>
                <span className="ml-2 text-[10px] text-slate-400">Assets: ${o.assetValue}M | Debt: ${o.debtPoint}M</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs font-mono" style={{ color: ddColor(o.dd) }}>DD {o.dd.toFixed(2)}</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-200 text-slate-600">{o.rating}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function KPI({ label, value, accent, warn }: { label: string; value: string; accent?: boolean; warn?: boolean }) {
  return (
    <div className={`rounded-xl border p-3 ${warn ? 'border-rose-200 bg-rose-50' : accent ? 'border-emerald-200 bg-emerald-50' : 'border-slate-200 bg-white'}`}>
      <p className="text-[10px] font-medium uppercase text-slate-400">{label}</p>
      <p className={`text-lg font-bold tabular-nums ${warn ? 'text-rose-700' : accent ? 'text-emerald-700' : 'text-slate-950'}`}>{value}</p>
    </div>
  );
}

function getDemo(): KMVResult {
  return {
    portfolioDD: 3.42, portfolioEDF: 0.0031, riskRating: 'A-',
    obligors: [
      { name: 'Consumer RE Pool', assetValue: 95, debtPoint: 72, dd: 4.1, edf: 0.0002, rating: 'A+' },
      { name: 'Commercial CRE', assetValue: 68, debtPoint: 55, dd: 2.8, edf: 0.0026, rating: 'BBB+' },
      { name: 'Auto Loan Pool', assetValue: 42, debtPoint: 38, dd: 1.9, edf: 0.029, rating: 'BB+' },
      { name: 'Small Business', assetValue: 25, debtPoint: 22, dd: 1.5, edf: 0.067, rating: 'BB-' },
      { name: 'Personal Unsecured', assetValue: 18, debtPoint: 16, dd: 1.1, edf: 0.136, rating: 'B+' },
      { name: 'Municipal Bonds', assetValue: 35, debtPoint: 12, dd: 5.2, edf: 0.00001, rating: 'AA' },
    ],
  };
}
