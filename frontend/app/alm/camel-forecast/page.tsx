'use client';

import { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api';
import { useALM } from '@/components/alm/ALMProvider';
import { useTranslation } from '@/lib/i18n';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell, ErrorBar } from 'recharts';
import { TrendingUp, AlertTriangle, TrendingDown, Minus } from 'lucide-react';

interface Forecast { dimension: string; currentScore: number; q2Forecast: number; q4Forecast: number; q2CI: [number, number]; q4CI: [number, number]; trend: string; ar2Params: { phi1: number; phi2: number; intercept: number; r2: number } }

const DIM_LABELS: Record<string, { en: string; es: string }> = {
  capital: { en: 'Capital', es: 'Capital' }, assetQuality: { en: 'Asset Quality', es: 'Calidad Activos' },
  management: { en: 'Management', es: 'Administración' }, earnings: { en: 'Earnings', es: 'Rentabilidad' },
  liquidity: { en: 'Liquidity', es: 'Liquidez' },
};
const SCORE_COLORS = ['', '#009E3A', '#16A34A', '#D97706', '#C2410C', '#B91C1C'];
const TREND_ICON = { improving: TrendingDown, stable: Minus, deteriorating: TrendingUp }; // lower CAMEL = better

export default function CamelForecastPage() {
  const { selectedId } = useALM();
  const { locale } = useTranslation();
  const [data, setData] = useState<Forecast[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!selectedId) return;
    (async () => {
      setLoading(true);
      try { setData(await apiClient.getCamelForecast(selectedId)); }
      catch { setData(getDemoData()); }
      finally { setLoading(false); }
    })();
  }, [selectedId]);

  if (!selectedId) return <div className="flex-1 flex items-center justify-center p-6"><AlertTriangle className="h-12 w-12 text-amber-500" /></div>;
  if (loading) return <div className="flex-1 flex items-center justify-center p-6"><div className="h-8 w-8 animate-spin rounded-full border-2 border-cyan-200 border-t-cyan-600" /></div>;

  const chartData = data.map(f => ({
    dimension: locale === 'es' ? DIM_LABELS[f.dimension]?.es ?? f.dimension : DIM_LABELS[f.dimension]?.en ?? f.dimension,
    current: f.currentScore, q2: f.q2Forecast, q4: f.q4Forecast,
  }));

  return (
    <div className="p-6 space-y-5 max-w-[1400px] mx-auto">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-violet-200 bg-violet-50">
          <TrendingUp className="h-4 w-4 text-violet-700" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-slate-950">{locale === 'es' ? 'Pronóstico CAMEL — AR(2)' : 'CAMEL Forecast — AR(2)'}</h1>
          <p className="text-xs text-slate-500">{locale === 'es' ? 'Pronóstico 2 y 4 trimestres por dimensión con intervalos de confianza' : '2Q and 4Q forecast per dimension with confidence intervals'}</p>
        </div>
      </div>

      {/* Forecast Chart */}
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="dimension" tick={{ fontSize: 11 }} />
            <YAxis domain={[0.5, 5.5]} tick={{ fontSize: 11 }} reversed label={{ value: locale === 'es' ? 'Puntuación' : 'Score', angle: -90, position: 'insideLeft', style: { fontSize: 10 } }} />
            <Tooltip contentStyle={{ borderRadius: 12, fontSize: 12 }} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Bar dataKey="current" name={locale === 'es' ? 'Actual' : 'Current'} fill="#6366f1" radius={[4, 4, 0, 0]} />
            <Bar dataKey="q2" name={locale === 'es' ? '+2 Trim.' : '+2Q'} fill="#06b6d4" radius={[4, 4, 0, 0]} />
            <Bar dataKey="q4" name={locale === 'es' ? '+4 Trim.' : '+4Q'} fill="#f59e0b" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Detail Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
        {data.map(f => {
          const Icon = TREND_ICON[f.trend as keyof typeof TREND_ICON] ?? Minus;
          const trendColor = f.trend === 'improving' ? 'text-emerald-600' : f.trend === 'deteriorating' ? 'text-rose-600' : 'text-slate-500';
          return (
            <div key={f.dimension} className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold text-slate-700">{locale === 'es' ? DIM_LABELS[f.dimension]?.es : DIM_LABELS[f.dimension]?.en}</p>
                <Icon className={`h-4 w-4 ${trendColor}`} />
              </div>
              <div className="flex items-center gap-3">
                <div className="text-center">
                  <p className="text-[9px] text-slate-400">{locale === 'es' ? 'Actual' : 'Now'}</p>
                  <div className="h-8 w-8 rounded-full flex items-center justify-center text-sm font-bold text-white" style={{ backgroundColor: SCORE_COLORS[f.currentScore] ?? '#6b7280' }}>{f.currentScore}</div>
                </div>
                <span className="text-slate-300">→</span>
                <div className="text-center">
                  <p className="text-[9px] text-slate-400">+2Q</p>
                  <div className="h-8 w-8 rounded-full flex items-center justify-center text-sm font-bold text-white" style={{ backgroundColor: SCORE_COLORS[Math.round(f.q2Forecast)] ?? '#6b7280' }}>{f.q2Forecast}</div>
                </div>
                <span className="text-slate-300">→</span>
                <div className="text-center">
                  <p className="text-[9px] text-slate-400">+4Q</p>
                  <div className="h-8 w-8 rounded-full flex items-center justify-center text-sm font-bold text-white" style={{ backgroundColor: SCORE_COLORS[Math.round(f.q4Forecast)] ?? '#6b7280' }}>{f.q4Forecast}</div>
                </div>
              </div>
              <p className="text-[9px] text-slate-400 mt-2">CI: [{f.q4CI[0]}–{f.q4CI[1]}] | R²: {f.ar2Params.r2.toFixed(2)}</p>
            </div>
          );
        })}
      </div>

      {/* Deterioration Warning */}
      {data.some(f => f.trend === 'deteriorating') && (
        <div className="flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4">
          <AlertTriangle className="h-5 w-5 text-rose-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-rose-800">{locale === 'es' ? 'Alerta de Deterioro' : 'Deterioration Alert'}</p>
            <p className="text-xs text-rose-700 mt-1">
              {data.filter(f => f.trend === 'deteriorating').map(f => locale === 'es' ? DIM_LABELS[f.dimension]?.es : DIM_LABELS[f.dimension]?.en).join(', ')}
              {locale === 'es' ? ' muestra(n) tendencia negativa. Revise antes del próximo examen COSSEC.' : ' showing negative trend. Review before next COSSEC exam.'}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function getDemoData(): Forecast[] {
  return [
    { dimension: 'capital', currentScore: 2, q2Forecast: 2, q4Forecast: 2, q2CI: [1.5, 2.5], q4CI: [1.5, 2.5], trend: 'stable', ar2Params: { phi1: 0.3, phi2: 0.1, intercept: 1.2, r2: 0.78 } },
    { dimension: 'assetQuality', currentScore: 2, q2Forecast: 2.5, q4Forecast: 3, q2CI: [2, 3], q4CI: [2, 3.5], trend: 'deteriorating', ar2Params: { phi1: 0.5, phi2: 0.2, intercept: 0.8, r2: 0.65 } },
    { dimension: 'management', currentScore: 2, q2Forecast: 2, q4Forecast: 2, q2CI: [1.5, 2.5], q4CI: [1.5, 2.5], trend: 'stable', ar2Params: { phi1: 0.1, phi2: 0.05, intercept: 1.7, r2: 0.45 } },
    { dimension: 'earnings', currentScore: 2, q2Forecast: 2, q4Forecast: 2.5, q2CI: [1.5, 2.5], q4CI: [2, 3], trend: 'deteriorating', ar2Params: { phi1: 0.4, phi2: 0.15, intercept: 1.0, r2: 0.72 } },
    { dimension: 'liquidity', currentScore: 2, q2Forecast: 2, q4Forecast: 1.5, q2CI: [1.5, 2.5], q4CI: [1, 2], trend: 'improving', ar2Params: { phi1: 0.2, phi2: 0.1, intercept: 1.5, r2: 0.60 } },
  ];
}
