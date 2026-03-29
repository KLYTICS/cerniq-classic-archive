'use client';

import { useState, useEffect } from 'react';
import { useALM } from '@/components/alm/ALMProvider';
import { useTranslation } from '@/lib/i18n';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Ruler, AlertTriangle } from 'lucide-react';

interface PortfolioKRDPoint {
  tenor: string;
  tenorYears: number;
  krd: number;
}

interface InstrumentKRDDetail {
  instrumentName: string;
  balance: number;
  modifiedDuration: number;
  effectiveDuration: number;
  convexity: number;
}

interface KeyRateDurationData {
  instruments: InstrumentKRDDetail[];
  portfolioModifiedDuration: number;
  portfolioEffectiveDuration: number;
  portfolioConvexity: number;
  durationGap: number;
  negativeConvexityExposure: number;
  portfolioKRDs: PortfolioKRDPoint[];
}

export default function KRDPage() {
  const { selectedId } = useALM();
  const { locale } = useTranslation();
  const [data, setData] = useState<KeyRateDurationData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!selectedId) return;
    (async () => {
      setLoading(true);
      try {
        const NODE_API_URL = (process.env.NEXT_PUBLIC_NODE_API_URL || '').trim().replace(/\/+$/, '');
        const res = await fetch(`${NODE_API_URL}/api/alm/${selectedId}/key-rate-durations`);
        if (res.ok) setData(await res.json() as KeyRateDurationData);
        else setData(getDemoData());
      } catch { setData(getDemoData()); }
      finally { setLoading(false); }
    })();
  }, [selectedId]);

  if (!selectedId) return <div className="flex-1 flex items-center justify-center p-6"><AlertTriangle className="h-12 w-12 text-amber-500" /></div>;
  if (loading || !data) return <div className="flex-1 flex items-center justify-center p-6"><div className="h-8 w-8 animate-spin rounded-full border-2 border-cyan-200 border-t-cyan-600" /></div>;

  return (
    <div className="p-6 space-y-5 max-w-[1400px] mx-auto">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-teal-200 bg-teal-50">
          <Ruler className="h-4 w-4 text-teal-700" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-slate-950">{locale === 'es' ? 'Duraciones de Tasa Clave (KRD)' : 'Key-Rate Durations (KRD)'}</h1>
          <p className="text-xs text-slate-500">{locale === 'es' ? 'Sensibilidad por tenor, convexidad efectiva, brecha de duración' : 'Sensitivity by tenor, effective convexity, duration gap'}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <KPI label={locale === 'es' ? 'Dur. Modificada' : 'Mod. Duration'} value={`${data.portfolioModifiedDuration} yr`} />
        <KPI label={locale === 'es' ? 'Dur. Efectiva' : 'Eff. Duration'} value={`${data.portfolioEffectiveDuration} yr`} accent />
        <KPI label={locale === 'es' ? 'Convexidad' : 'Convexity'} value={data.portfolioConvexity.toFixed(2)} warn={data.portfolioConvexity < -1} />
        <KPI label={locale === 'es' ? 'Brecha Duración' : 'Duration Gap'} value={`${data.durationGap} yr`} />
        <KPI label={locale === 'es' ? 'Conv. Negativa ($M)' : 'Neg. Convexity ($M)'} value={`$${data.negativeConvexityExposure}M`} warn={data.negativeConvexityExposure > 30} />
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-4">{locale === 'es' ? 'Perfil KRD del Portafolio' : 'Portfolio KRD Profile'}</p>
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={data.portfolioKRDs}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="tenor" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} label={{ value: locale === 'es' ? 'Años' : 'Years', angle: -90, position: 'insideLeft', style: { fontSize: 10 } }} />
            <Tooltip contentStyle={{ borderRadius: 12, fontSize: 12 }} />
            <Bar dataKey="krd" name="KRD" fill="#14b8a6" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {data.instruments?.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-100">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{locale === 'es' ? 'Detalle por Instrumento' : 'Instrument Detail'}</p>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-50 bg-slate-50/50">
                {[locale === 'es' ? 'Instrumento' : 'Instrument', locale === 'es' ? 'Balance' : 'Balance', locale === 'es' ? 'Dur. Mod.' : 'Mod. Dur.', locale === 'es' ? 'Dur. Efec.' : 'Eff. Dur.', locale === 'es' ? 'Convexidad' : 'Convexity'].map(h => (
                  <th key={h} className="px-4 py-2 text-left text-[10px] font-medium text-slate-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.instruments.map((inst, i) => (
                <tr key={i} className="border-b border-slate-50 last:border-0">
                  <td className="px-4 py-2.5 text-xs font-medium text-slate-700">{inst.instrumentName}</td>
                  <td className="px-4 py-2.5 text-xs tabular-nums">${inst.balance}M</td>
                  <td className="px-4 py-2.5 text-xs tabular-nums">{inst.modifiedDuration}</td>
                  <td className="px-4 py-2.5 text-xs tabular-nums font-medium text-teal-700">{inst.effectiveDuration}</td>
                  <td className={`px-4 py-2.5 text-xs tabular-nums ${inst.convexity < 0 ? 'text-rose-600 font-medium' : ''}`}>{inst.convexity}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function KPI({ label, value, accent, warn }: { label: string; value: string; accent?: boolean; warn?: boolean }) {
  return (
    <div className={`rounded-xl border p-3 ${warn ? 'border-rose-200 bg-rose-50' : accent ? 'border-teal-200 bg-teal-50' : 'border-slate-200 bg-white'}`}>
      <p className="text-[10px] font-medium uppercase text-slate-400">{label}</p>
      <p className={`text-lg font-bold tabular-nums ${warn ? 'text-rose-700' : accent ? 'text-teal-700' : 'text-slate-950'}`}>{value}</p>
    </div>
  );
}

function getDemoData(): KeyRateDurationData {
  return {
    instruments: [], portfolioModifiedDuration: 4.2, portfolioEffectiveDuration: 3.8,
    portfolioConvexity: -0.6, durationGap: 2.1, negativeConvexityExposure: 50,
    portfolioKRDs: [
      { tenor: '3M', tenorYears: 0.25, krd: 0.12 }, { tenor: '1Y', tenorYears: 1, krd: 0.35 },
      { tenor: '2Y', tenorYears: 2, krd: 0.58 }, { tenor: '3Y', tenorYears: 3, krd: 0.72 },
      { tenor: '5Y', tenorYears: 5, krd: 0.85 }, { tenor: '7Y', tenorYears: 7, krd: 0.62 },
      { tenor: '10Y', tenorYears: 10, krd: 0.38 }, { tenor: '30Y', tenorYears: 30, krd: 0.18 },
    ],
  };
}
