'use client';

import { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api';
import { useALM } from '@/components/alm/ALMProvider';
import { useTranslation } from '@/lib/i18n';
import { Activity, AlertTriangle, TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface EWSIndicator {
  id: string; name: string; nameEs: string; value: number;
  trend: 'improving' | 'stable' | 'deteriorating';
  alertLevel: 'green' | 'yellow' | 'red'; weight: number; contribution: number;
}

interface EWSResult {
  compositeScore: number; alertLevel: 'GREEN' | 'YELLOW' | 'RED';
  indicators: EWSIndicator[]; topDeteriorating: EWSIndicator[];
  peerAlert: string; peerAlertEs: string; anomalyScore: number;
}

const ALERT_STYLES = {
  GREEN: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', ring: 'stroke-emerald-500' },
  YELLOW: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', ring: 'stroke-amber-500' },
  RED: { bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200', ring: 'stroke-rose-500' },
};

const TREND_ICONS = { improving: TrendingUp, stable: Minus, deteriorating: TrendingDown };
const INDICATOR_COLORS = { green: 'bg-emerald-100 text-emerald-700 border-emerald-200', yellow: 'bg-amber-100 text-amber-700 border-amber-200', red: 'bg-rose-100 text-rose-700 border-rose-200' };

export default function EWSPage() {
  const { selectedId } = useALM();
  const { locale } = useTranslation();
  const [data, setData] = useState<EWSResult | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!selectedId) return;
    (async () => {
      setLoading(true);
      try { setData(await apiClient.getAssetEWS(selectedId)); }
      catch { setData(getDemoData()); }
      finally { setLoading(false); }
    })();
  }, [selectedId]);

  if (!selectedId) return <div className="flex-1 flex items-center justify-center p-6"><AlertTriangle className="h-12 w-12 text-amber-500" /></div>;
  if (loading || !data) return <div className="flex-1 flex items-center justify-center p-6"><div className="h-8 w-8 animate-spin rounded-full border-2 border-cyan-200 border-t-cyan-600" /></div>;

  const style = ALERT_STYLES[data.alertLevel];

  return (
    <div className="p-6 space-y-5 max-w-[1400px] mx-auto">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-orange-200 bg-orange-50">
          <Activity className="h-4 w-4 text-orange-700" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-slate-950">
            {locale === 'es' ? 'Sistema de Alerta Temprana — Calidad de Activos' : 'Early Warning System — Asset Quality'}
          </h1>
          <p className="text-xs text-slate-500">
            {locale === 'es' ? '12 indicadores líderes, detección de anomalías Isolation Forest' : '12 leading indicators, Isolation Forest anomaly detection'}
          </p>
        </div>
      </div>

      {/* Composite Score + Anomaly */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Composite Gauge */}
        <div className={`rounded-xl border p-5 text-center ${style.bg} ${style.border}`}>
          <div className="relative h-32 w-32 mx-auto mb-3">
            <svg viewBox="0 0 36 36" className="h-32 w-32 -rotate-90">
              <circle cx="18" cy="18" r="15.9" fill="none" stroke="#e2e8f0" strokeWidth="2.5" />
              <circle cx="18" cy="18" r="15.9" fill="none" className={style.ring} strokeWidth="2.5"
                strokeDasharray={`${data.compositeScore} ${100 - data.compositeScore}`} strokeLinecap="round" />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className={`text-3xl font-bold tabular-nums ${style.text}`}>{data.compositeScore}</span>
              <span className="text-[10px] text-slate-500">/100</span>
            </div>
          </div>
          <p className={`text-sm font-bold ${style.text}`}>{data.alertLevel}</p>
          <p className="text-[10px] text-slate-500 mt-1">
            {locale === 'es' ? 'Puntuación Compuesta EWS' : 'EWS Composite Score'}
          </p>
        </div>

        {/* Anomaly Score */}
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <p className="text-[10px] font-medium uppercase tracking-wider text-slate-400 mb-2">
            {locale === 'es' ? 'Anomalía (Isolation Forest)' : 'Anomaly Score (Isolation Forest)'}
          </p>
          <p className={`text-3xl font-bold tabular-nums ${data.anomalyScore > 0.75 ? 'text-rose-700' : data.anomalyScore > 0.6 ? 'text-amber-700' : 'text-emerald-700'}`}>
            {data.anomalyScore.toFixed(2)}
          </p>
          <div className="h-2 rounded-full bg-slate-100 mt-3">
            <div className={`h-2 rounded-full ${data.anomalyScore > 0.75 ? 'bg-rose-500' : data.anomalyScore > 0.6 ? 'bg-amber-400' : 'bg-emerald-400'}`}
              style={{ width: `${data.anomalyScore * 100}%` }} />
          </div>
          <div className="flex justify-between text-[9px] text-slate-400 mt-1">
            <span>0 Normal</span>
            <span>0.6 Watch</span>
            <span>0.75 Warning</span>
            <span>1.0 Alert</span>
          </div>
        </div>

        {/* Peer Alert */}
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <p className="text-[10px] font-medium uppercase tracking-wider text-slate-400 mb-2">
            {locale === 'es' ? 'Alerta de Pares' : 'Peer Alert'}
          </p>
          <p className="text-sm text-slate-700 leading-relaxed">
            {locale === 'es' ? data.peerAlertEs : data.peerAlert}
          </p>
          {data.topDeteriorating.length > 0 && (
            <div className="mt-3 pt-3 border-t border-slate-100">
              <p className="text-[10px] font-semibold text-rose-600 uppercase mb-1">
                {locale === 'es' ? 'Indicadores en Deterioro' : 'Deteriorating Indicators'}
              </p>
              {data.topDeteriorating.map(ind => (
                <p key={ind.id} className="text-xs text-rose-700">• {locale === 'es' ? ind.nameEs : ind.name}</p>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 12-Indicator Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {data.indicators.map(ind => {
          const TrendIcon = TREND_ICONS[ind.trend];
          const colorClass = INDICATOR_COLORS[ind.alertLevel];
          return (
            <div key={ind.id} className={`rounded-xl border p-3 ${colorClass}`}>
              <div className="flex items-start justify-between">
                <p className="text-[10px] font-medium leading-tight">{locale === 'es' ? ind.nameEs : ind.name}</p>
                <TrendIcon className={`h-3.5 w-3.5 shrink-0 ${
                  ind.trend === 'improving' ? 'text-emerald-600' : ind.trend === 'deteriorating' ? 'text-rose-600' : 'text-slate-500'
                }`} />
              </div>
              <p className="text-lg font-bold tabular-nums mt-1">{typeof ind.value === 'number' && ind.value < 1 ? (ind.value * 100).toFixed(2) + '%' : ind.value}</p>
              <div className="flex items-center gap-1 mt-1">
                <div className={`h-1.5 w-1.5 rounded-full ${ind.alertLevel === 'green' ? 'bg-emerald-500' : ind.alertLevel === 'yellow' ? 'bg-amber-500' : 'bg-rose-500'}`} />
                <span className="text-[9px]">{locale === 'es' ? 'Peso' : 'Weight'}: {ind.weight}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function getDemoData(): EWSResult {
  return {
    compositeScore: 72, alertLevel: 'YELLOW',
    indicators: [
      { id: 'delinquency_30d', name: '30-Day Delinquency', nameEs: 'Morosidad 30 Días', value: 2.7, trend: 'stable', alertLevel: 'yellow', weight: 12, contribution: 6 },
      { id: 'delinquency_90d', name: '90-Day Delinquency', nameEs: 'Morosidad 90 Días', value: 1.2, trend: 'improving', alertLevel: 'yellow', weight: 15, contribution: 7.5 },
      { id: 'npl_ratio', name: 'NPL Ratio', nameEs: 'Ratio NPL', value: 2.2, trend: 'stable', alertLevel: 'yellow', weight: 12, contribution: 6 },
      { id: 'chargeoff_rate', name: 'Charge-Off Rate', nameEs: 'Tasa Castigos', value: 0.9, trend: 'stable', alertLevel: 'yellow', weight: 10, contribution: 5 },
      { id: 'delinquency_trend', name: 'Delinquency Trend', nameEs: 'Tendencia Morosidad', value: 0.05, trend: 'improving', alertLevel: 'green', weight: 10, contribution: 10 },
      { id: 'ltv_re', name: 'Avg LTV (RE)', nameEs: 'LTV Promedio (RE)', value: 72, trend: 'stable', alertLevel: 'green', weight: 8, contribution: 8 },
      { id: 'dscr_commercial', name: 'DSCR (Commercial)', nameEs: 'DSCR (Comercial)', value: 1.35, trend: 'improving', alertLevel: 'green', weight: 5, contribution: 5 },
      { id: 'classified_ratio', name: 'Classified Ratio', nameEs: 'Ratio Clasificados', value: 3.6, trend: 'deteriorating', alertLevel: 'yellow', weight: 8, contribution: 4 },
      { id: 'oreo_growth', name: 'OREO Growth', nameEs: 'Crecimiento OREO', value: 0.02, trend: 'improving', alertLevel: 'green', weight: 5, contribution: 5 },
      { id: 'consumer_60d_delta', name: 'Consumer 60d Δ', nameEs: 'Δ Consumo 60d', value: 0.03, trend: 'improving', alertLevel: 'green', weight: 5, contribution: 5 },
      { id: 'allowance_coverage', name: 'Allowance Coverage', nameEs: 'Cobertura Provisión', value: 120, trend: 'stable', alertLevel: 'green', weight: 5, contribution: 5 },
      { id: 'peer_delinquency_gap', name: 'Peer Gap', nameEs: 'Brecha Pares', value: 0.15, trend: 'stable', alertLevel: 'green', weight: 5, contribution: 5 },
    ],
    topDeteriorating: [
      { id: 'classified_ratio', name: 'Classified Ratio', nameEs: 'Ratio Clasificados', value: 3.6, trend: 'deteriorating', alertLevel: 'yellow', weight: 8, contribution: 4 },
    ],
    peerAlert: 'Asset quality is within peer group norms. Watch classified asset ratio trending upward.',
    peerAlertEs: 'La calidad de activos está dentro de normas del grupo de pares. Vigile ratio de activos clasificados con tendencia ascendente.',
    anomalyScore: 0.42,
  };
}
