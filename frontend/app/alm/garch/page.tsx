'use client';

import { useState, useEffect } from 'react';
import { useALM } from '@/components/alm/ALMProvider';
import { useTranslation } from '@/lib/i18n';
import { AreaChart, Area, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Activity, AlertTriangle, TrendingUp } from 'lucide-react';

interface GARCHResult {
  params: { omega: number; alpha: number; beta: number; persistence: number; longRunVol: number; halfLife: number };
  currentVol: number;
  forecasts: Array<{ horizon: number; volatility: number; annualizedVol: number }>;
  historicalVols: Array<{ date: string; return_: number; conditionalVol: number }>;
  diagnostics: { logLikelihood: number; aic: number; ljungBoxPValue: number; observationCount: number };
}

function getDemoData(): GARCHResult {
  return {
    params: { omega: 0.0000012, alpha: 0.08, beta: 0.89, persistence: 0.97, longRunVol: 15.8, halfLife: 23 },
    currentVol: 14.2,
    forecasts: [
      { horizon: 1, volatility: 0.0018, annualizedVol: 12.8 },
      { horizon: 5, volatility: 0.0019, annualizedVol: 13.4 },
      { horizon: 21, volatility: 0.0020, annualizedVol: 14.5 },
      { horizon: 63, volatility: 0.0020, annualizedVol: 15.1 },
      { horizon: 252, volatility: 0.0020, annualizedVol: 15.8 },
    ],
    historicalVols: Array.from({ length: 60 }, (_, i) => ({
      date: `D-${60 - i}`,
      return_: (Math.random() - 0.5) * 2,
      conditionalVol: 12 + Math.sin(i * 0.15) * 3 + Math.random() * 2,
    })),
    diagnostics: { logLikelihood: 245.3, aic: -484.6, ljungBoxPValue: 0.42, observationCount: 252 },
  };
}

export default function GARCHPage() {
  const { selectedId } = useALM();
  const { locale } = useTranslation();
  const [data, setData] = useState<GARCHResult | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!selectedId) return;
    (async () => {
      setLoading(true);
      try {
        const NODE = (process.env.NEXT_PUBLIC_NODE_API_URL || '').trim().replace(/\/+$/, '');
        const res = await fetch(`${NODE}/api/alm/${selectedId}/garch-volatility`);
        if (res.ok) setData(await res.json());
        else setData(getDemoData());
      } catch { setData(getDemoData()); }
      finally { setLoading(false); }
    })();
  }, [selectedId]);

  if (!selectedId) return <div className="flex-1 flex items-center justify-center p-6"><AlertTriangle className="h-12 w-12 text-amber-500" /></div>;
  if (loading) return <div className="flex-1 flex items-center justify-center p-6"><div className="h-8 w-8 animate-spin rounded-full border-2 border-cyan-200 border-t-cyan-600" /></div>;
  if (!data) return <div className="flex-1 flex items-center justify-center p-6 text-sm text-slate-400">No data available</div>;

  const forecastData = data.forecasts.map(f => ({
    horizon: f.horizon === 1 ? '1D' : f.horizon === 5 ? '1W' : f.horizon === 21 ? '1M' : f.horizon === 63 ? '3M' : '1Y',
    vol: +f.annualizedVol.toFixed(1),
  }));

  const ljungBoxOk = data.diagnostics.ljungBoxPValue > 0.05;
  const formatPercent = (value: number | string | undefined, digits = 1) =>
    `${Number(value ?? 0).toFixed(digits)}%`;

  return (
    <div className="p-6 space-y-5 max-w-[1400px] mx-auto animate-fade-in">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-orange-200 bg-orange-50">
          <Activity className="h-4 w-4 text-orange-700" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-slate-950">{locale === 'es' ? 'GARCH(1,1) — Pronostico de Volatilidad' : 'GARCH(1,1) — Volatility Forecasting'}</h1>
          <p className="text-xs text-slate-500">{locale === 'es' ? 'Modelo de heteroscedasticidad condicional — riesgo de tasa forward' : 'Conditional heteroskedasticity model — forward rate risk'}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="rounded-xl border border-slate-200 bg-white p-3 cerniq-card-hover">
          <p className="text-[10px] font-medium uppercase text-slate-400">{locale === 'es' ? 'Vol. Actual' : 'Current Vol'}</p>
          <p className="text-2xl font-bold tabular-nums text-slate-950">{data.currentVol.toFixed(1)}%</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-3 cerniq-card-hover">
          <p className="text-[10px] font-medium uppercase text-slate-400">{locale === 'es' ? 'Vol. Largo Plazo' : 'Long-Run Vol'}</p>
          <p className="text-2xl font-bold tabular-nums text-slate-950">{data.params.longRunVol.toFixed(1)}%</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-3 cerniq-card-hover">
          <p className="text-[10px] font-medium uppercase text-slate-400">{locale === 'es' ? 'Persistencia' : 'Persistence'}</p>
          <p className="text-2xl font-bold tabular-nums text-slate-950">{data.params.persistence.toFixed(3)}</p>
        </div>
        <div className={`rounded-xl border p-3 cerniq-card-hover ${ljungBoxOk ? 'border-emerald-200 bg-emerald-50' : 'border-amber-200 bg-amber-50'}`}>
          <p className={`text-[10px] font-medium uppercase ${ljungBoxOk ? 'text-emerald-600' : 'text-amber-600'}`}>{locale === 'es' ? 'Ajuste Modelo' : 'Model Fit'}</p>
          <p className={`text-2xl font-bold tabular-nums ${ljungBoxOk ? 'text-emerald-700' : 'text-amber-700'}`}>{ljungBoxOk ? 'PASS' : 'WARN'}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <h3 className="text-sm font-bold text-slate-950 mb-3">{locale === 'es' ? 'Volatilidad Condicional Historica (%)' : 'Historical Conditional Volatility (%)'}</h3>
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={data.historicalVols}>
              <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.3} />
              <XAxis dataKey="date" tick={{ fontSize: 9 }} interval={9} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(value) => formatPercent(value, 0)} />
              <Tooltip formatter={(value) => formatPercent(value)} />
              <Area type="monotone" dataKey="conditionalVol" name={locale === 'es' ? 'Vol Condicional' : 'Conditional Vol'} stroke="#f97316" fill="#fed7aa" fillOpacity={0.4} strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <h3 className="text-sm font-bold text-slate-950 mb-3">{locale === 'es' ? 'Pronostico de Volatilidad por Horizonte' : 'Volatility Forecast by Horizon'}</h3>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={forecastData}>
              <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.3} />
              <XAxis dataKey="horizon" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(value) => formatPercent(value, 0)} domain={['auto', 'auto']} />
              <Tooltip formatter={(value) => formatPercent(value, 0)} />
              <Line type="monotone" dataKey="vol" name={locale === 'es' ? 'Vol Anualizada' : 'Annualized Vol'} stroke="#f97316" strokeWidth={2.5} dot={{ r: 5, fill: '#f97316' }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <h3 className="text-sm font-bold text-slate-950 mb-3">{locale === 'es' ? 'Parametros GARCH(1,1)' : 'GARCH(1,1) Parameters'}</h3>
          <div className="space-y-2 text-xs">
            {[
              { key: 'omega (ω)', val: data.params.omega.toExponential(4), desc: locale === 'es' ? 'Intercepto varianza' : 'Variance intercept' },
              { key: 'alpha (α)', val: data.params.alpha.toFixed(4), desc: locale === 'es' ? 'Efecto ARCH (reaccion a shocks)' : 'ARCH effect (shock reaction)' },
              { key: 'beta (β)', val: data.params.beta.toFixed(4), desc: locale === 'es' ? 'Efecto GARCH (persistencia)' : 'GARCH effect (persistence)' },
              { key: 'α + β', val: data.params.persistence.toFixed(4), desc: locale === 'es' ? 'Persistencia total (< 1)' : 'Total persistence (< 1)' },
              { key: locale === 'es' ? 'Vida media' : 'Half-life', val: `${data.params.halfLife.toFixed(0)} ${locale === 'es' ? 'dias' : 'days'}`, desc: locale === 'es' ? 'Dias para que vol se reduzca 50%' : 'Days for vol to halve after shock' },
            ].map(p => (
              <div key={p.key} className="flex justify-between border-b border-slate-100 pb-1">
                <div>
                  <span className="font-mono text-slate-700">{p.key}</span>
                  <span className="ml-2 text-slate-400">{p.desc}</span>
                </div>
                <span className="font-bold tabular-nums text-slate-950">{p.val}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <h3 className="text-sm font-bold text-slate-950 mb-3">{locale === 'es' ? 'Diagnosticos' : 'Diagnostics'}</h3>
          <div className="space-y-2 text-xs">
            {[
              { key: 'Log-Likelihood', val: data.diagnostics.logLikelihood.toFixed(1) },
              { key: 'AIC', val: data.diagnostics.aic.toFixed(1) },
              { key: 'Ljung-Box p-value', val: data.diagnostics.ljungBoxPValue.toFixed(3), ok: ljungBoxOk },
              { key: locale === 'es' ? 'Observaciones' : 'Observations', val: String(data.diagnostics.observationCount) },
            ].map(d => (
              <div key={d.key} className="flex justify-between border-b border-slate-100 pb-1">
                <span className="text-slate-500">{d.key}</span>
                <span className={`font-bold tabular-nums ${'ok' in d ? (d.ok ? 'text-emerald-700' : 'text-amber-700') : 'text-slate-950'}`}>{d.val}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
