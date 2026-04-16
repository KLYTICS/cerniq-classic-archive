'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { useTranslation } from '@/lib/i18n';
import { LiveRateCard } from '@/components/wave03/live-rate-card';

// ─── Types ──────────────────────────────────────────────────────────────────

interface RateData {
  label: string;
  value: number;
  change24h: number;
  unit: string;
  source: string;
  sparkline: number[];
}

interface YieldPoint {
  tenor: string;
  rate: number;
}

interface RateAlert {
  id: string;
  metric: string;
  type: 'WARN' | 'BREACH';
  message: string;
  messageEs: string;
  timestamp: string;
}

interface InstitutionImpact {
  niiChange: number;
  eveChange: number;
  durationGap: number;
  niiChangeVsStatic: number;
  eveChangeVsStatic: number;
}

interface AlertThreshold {
  metric: string;
  warnLevel: number;
  breachLevel: number;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API = (process.env.NEXT_PUBLIC_NODE_API_URL || '').trim().replace(/\/+$/, '');

function authHeaders(): HeadersInit {
  const token = typeof window !== 'undefined' ? sessionStorage.getItem('capex_access_token') : null;
  return token ? { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } : { 'Content-Type': 'application/json' };
}

function formatDate(iso: string): string {
  try { return new Date(iso).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }); }
  catch { return iso; }
}

// ─── Demo data ──────────────────────────────────────────────────────────────

function generateSparkline(base: number, points: number = 24): number[] {
  const data: number[] = [];
  let val = base;
  for (let i = 0; i < points; i++) {
    val += (Math.random() - 0.5) * 0.03;
    data.push(parseFloat(val.toFixed(4)));
  }
  return data;
}

const DEMO_RATES: RateData[] = [
  { label: 'SOFR', value: 5.31, change24h: -0.02, unit: '%', source: 'Fed / NY', sparkline: generateSparkline(5.31) },
  { label: 'PR Deposit Index', value: 3.85, change24h: 0.05, unit: '%', source: 'COSSEC', sparkline: generateSparkline(3.85) },
  { label: 'Fed Funds', value: 5.33, change24h: 0.00, unit: '%', source: 'FOMC', sparkline: generateSparkline(5.33) },
];

const DEMO_YIELD_CURVE: YieldPoint[] = [
  { tenor: '1M', rate: 5.35 },
  { tenor: '3M', rate: 5.32 },
  { tenor: '6M', rate: 5.20 },
  { tenor: '1Y', rate: 4.95 },
  { tenor: '2Y', rate: 4.65 },
  { tenor: '3Y', rate: 4.42 },
  { tenor: '5Y', rate: 4.30 },
  { tenor: '7Y', rate: 4.35 },
  { tenor: '10Y', rate: 4.42 },
  { tenor: '20Y', rate: 4.70 },
  { tenor: '30Y', rate: 4.62 },
];

const DEMO_ALERTS: RateAlert[] = [
  { id: 'a1', metric: 'SOFR', type: 'WARN', message: 'SOFR dropped 2bps — approaching lower threshold', messageEs: 'SOFR bajo 2bps — acercandose al umbral inferior', timestamp: '2026-04-16T09:30:00Z' },
  { id: 'a2', metric: 'Duration Gap', type: 'BREACH', message: 'Duration gap exceeded 2.0yr limit after rate update', messageEs: 'Brecha de duracion excedio limite de 2.0 anos tras actualizacion', timestamp: '2026-04-16T08:45:00Z' },
  { id: 'a3', metric: 'NII Sensitivity', type: 'WARN', message: 'NII sensitivity at -5.1% — within 10% of policy limit', messageEs: 'Sensibilidad NII en -5.1% — dentro del 10% del limite', timestamp: '2026-04-15T16:20:00Z' },
];

const DEMO_IMPACT: InstitutionImpact = {
  niiChange: -2.1,
  eveChange: -8.3,
  durationGap: 1.8,
  niiChangeVsStatic: -0.4,
  eveChangeVsStatic: -1.2,
};

const DEMO_THRESHOLDS: AlertThreshold[] = [
  { metric: 'SOFR', warnLevel: 0.10, breachLevel: 0.25 },
  { metric: 'Duration Gap', warnLevel: 1.5, breachLevel: 2.0 },
  { metric: 'NII Sensitivity', warnLevel: -5.0, breachLevel: -8.0 },
  { metric: 'EVE Change', warnLevel: -5.0, breachLevel: -10.0 },
];

// ─── Main Page ──────────────────────────────────────────────────────────────

export default function MarketDataPage() {
  const { locale } = useTranslation();

  const [rates, setRates] = useState<RateData[]>(DEMO_RATES);
  const [yieldCurve, setYieldCurve] = useState<YieldPoint[]>(DEMO_YIELD_CURVE);
  const [alerts, setAlerts] = useState<RateAlert[]>(DEMO_ALERTS);
  const [impact, setImpact] = useState<InstitutionImpact>(DEMO_IMPACT);
  const [thresholds, setThresholds] = useState<AlertThreshold[]>(DEMO_THRESHOLDS);
  const [wsConnected, setWsConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<string>(new Date().toISOString());

  // Fetch initial data
  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch(`${API}/api/market-data/dashboard`, { headers: authHeaders() });
        if (res.ok) {
          const data = await res.json();
          if (data.rates) setRates(data.rates);
          if (data.yieldCurve) setYieldCurve(data.yieldCurve);
          if (data.alerts) setAlerts(data.alerts);
          if (data.impact) setImpact(data.impact);
          if (data.thresholds) setThresholds(data.thresholds);
        }
      } catch {
        // demo
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  // WebSocket connection for live updates
  useEffect(() => {
    let ws: WebSocket | null = null;
    try {
      const wsUrl = API.replace(/^http/, 'ws') + '/alm-realtime';
      ws = new WebSocket(wsUrl);
      ws.onopen = () => setWsConnected(true);
      ws.onclose = () => setWsConnected(false);
      ws.onerror = () => setWsConnected(false);
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'rate-update' && data.rates) {
            setRates(data.rates);
            setLastUpdate(new Date().toISOString());
          }
          if (data.type === 'yield-curve-update' && data.yieldCurve) {
            setYieldCurve(data.yieldCurve);
          }
          if (data.type === 'alert') {
            setAlerts((prev) => [data.alert, ...prev].slice(0, 20));
          }
          if (data.type === 'impact-update' && data.impact) {
            setImpact(data.impact);
          }
        } catch { /* parse error */ }
      };
    } catch {
      // WS not available
    }
    return () => { ws?.close(); };
  }, []);

  // Auto-refresh fallback (REST polling)
  useEffect(() => {
    if (wsConnected) return;
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`${API}/api/market-data/rates`, { headers: authHeaders() });
        if (res.ok) {
          const data = await res.json();
          if (data.rates) { setRates(data.rates); setLastUpdate(new Date().toISOString()); }
        }
      } catch { /* silent */ }
    }, 30_000);
    return () => clearInterval(interval);
  }, [wsConnected]);

  const updateThreshold = useCallback((metric: string, field: 'warnLevel' | 'breachLevel', value: number) => {
    setThresholds((prev) => prev.map((t) => t.metric === metric ? { ...t, [field]: value } : t));
  }, []);

  // ─── Loading ────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 p-6">
        <div className="mx-auto max-w-[1400px] space-y-6">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-32 animate-pulse rounded-xl bg-slate-200" />
            ))}
          </div>
          <div className="h-80 animate-pulse rounded-xl bg-slate-200" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="mx-auto max-w-[1400px] space-y-6">
        {/* Header */}
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div>
              <h1 className="text-lg font-bold text-[#1e3a5f]">
                {locale === 'es' ? 'Datos de Mercado en Tiempo Real' : 'Real-Time Market Data'}
              </h1>
              <div className="flex items-center gap-2 mt-0.5">
                <span className={`h-2 w-2 rounded-full ${wsConnected ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
                <span className="text-[10px] text-slate-400">
                  {wsConnected
                    ? (locale === 'es' ? 'Datos en vivo' : 'Live data')
                    : (locale === 'es' ? 'Desconectado — recargando cada 30s' : 'Disconnected — polling every 30s')}
                </span>
                <span className="text-[10px] text-slate-300">|</span>
                <span className="text-[10px] text-slate-400">
                  {locale === 'es' ? 'Ultima actualizacion' : 'Last update'}: {formatDate(lastUpdate)}
                </span>
              </div>
            </div>
          </div>
          <button
            onClick={() => setSettingsOpen(!settingsOpen)}
            className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-medium text-slate-600 transition hover:bg-slate-50"
          >
            <svg className="mr-1.5 inline h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            {locale === 'es' ? 'Umbrales' : 'Thresholds'}
          </button>
        </header>

        {/* Rate cards */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {rates.map((rate) => (
            <LiveRateCard
              key={rate.label}
              label={rate.label}
              value={rate.value}
              unit={rate.unit}
              change24h={rate.change24h}
              source={rate.source}
              sparklineData={rate.sparkline}
              isLive={wsConnected}
            />
          ))}
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Treasury yield curve */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 lg:col-span-2">
            <h3 className="mb-4 text-sm font-bold text-[#1e3a5f]">
              {locale === 'es' ? 'Curva de Rendimiento del Tesoro de EE.UU.' : 'US Treasury Yield Curve'}
            </h3>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={yieldCurve} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="tenor" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} domain={['auto', 'auto']} tickFormatter={(v) => `${v.toFixed(2)}%`} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 12 }}
                  formatter={(value) => [`${Number(value ?? 0).toFixed(2)}%`, locale === 'es' ? 'Rendimiento' : 'Yield']}
                />
                <Line
                  type="monotone"
                  dataKey="rate"
                  stroke="#1e3a5f"
                  strokeWidth={2.5}
                  dot={{ fill: '#1e3a5f', r: 4, strokeWidth: 2, stroke: '#fff' }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Rate change alerts */}
          <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
            <div className="border-b border-slate-200 px-4 py-3">
              <h3 className="text-sm font-bold text-[#1e3a5f]">
                {locale === 'es' ? 'Alertas de Tasas' : 'Rate Alerts'}
              </h3>
            </div>
            <div className="divide-y divide-slate-50 max-h-[340px] overflow-y-auto">
              {alerts.length === 0 && (
                <p className="px-4 py-6 text-center text-xs text-slate-400">
                  {locale === 'es' ? 'Sin alertas recientes' : 'No recent alerts'}
                </p>
              )}
              {alerts.map((alert) => (
                <div key={alert.id} className="px-4 py-3">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold ${
                      alert.type === 'BREACH' ? 'bg-rose-50 text-rose-700 border-rose-200' : 'bg-amber-50 text-amber-700 border-amber-200'
                    }`}>
                      {alert.type}
                    </span>
                    <span className="text-[10px] font-medium text-slate-500">{alert.metric}</span>
                  </div>
                  <p className="text-xs text-slate-600">
                    {locale === 'es' ? alert.messageEs : alert.message}
                  </p>
                  <p className="mt-1 text-[10px] text-slate-400">{formatDate(alert.timestamp)}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Institution-specific impact */}
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <h3 className="mb-4 text-sm font-bold text-[#1e3a5f]">
            {locale === 'es' ? 'Impacto en Su Institucion (vs. Analisis Estatico)' : 'Institution-Specific Impact (vs. Static Analysis)'}
          </h3>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-5">
            <div className="rounded-lg border border-slate-100 bg-slate-50 p-4 text-center">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                {locale === 'es' ? 'Cambio NII' : 'NII Change'}
              </p>
              <p className={`mt-1 text-xl font-bold ${impact.niiChange < 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                {impact.niiChange > 0 ? '+' : ''}{impact.niiChange.toFixed(1)}M
              </p>
              <p className={`text-[10px] ${impact.niiChangeVsStatic < 0 ? 'text-rose-500' : 'text-emerald-500'}`}>
                {impact.niiChangeVsStatic > 0 ? '+' : ''}{impact.niiChangeVsStatic.toFixed(1)}M vs static
              </p>
            </div>
            <div className="rounded-lg border border-slate-100 bg-slate-50 p-4 text-center">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                {locale === 'es' ? 'Cambio EVE' : 'EVE Change'}
              </p>
              <p className={`mt-1 text-xl font-bold ${impact.eveChange < 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                {impact.eveChange > 0 ? '+' : ''}{impact.eveChange.toFixed(1)}M
              </p>
              <p className={`text-[10px] ${impact.eveChangeVsStatic < 0 ? 'text-rose-500' : 'text-emerald-500'}`}>
                {impact.eveChangeVsStatic > 0 ? '+' : ''}{impact.eveChangeVsStatic.toFixed(1)}M vs static
              </p>
            </div>
            <div className="rounded-lg border border-slate-100 bg-slate-50 p-4 text-center">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                {locale === 'es' ? 'Brecha Duracion' : 'Duration Gap'}
              </p>
              <p className={`mt-1 text-xl font-bold ${impact.durationGap > 2.0 ? 'text-rose-600' : impact.durationGap > 1.5 ? 'text-amber-600' : 'text-emerald-600'}`}>
                {impact.durationGap.toFixed(1)}yr
              </p>
              <p className="text-[10px] text-slate-400">{locale === 'es' ? 'Actual con tasas vivas' : 'Current with live rates'}</p>
            </div>
            <div className="rounded-lg border border-slate-100 bg-slate-50 p-4 text-center">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">SOFR</p>
              <p className="mt-1 text-xl font-bold text-[#1e3a5f]">{rates[0]?.value.toFixed(2)}%</p>
              <p className={`text-[10px] ${(rates[0]?.change24h ?? 0) < 0 ? 'text-rose-500' : 'text-emerald-500'}`}>
                {(rates[0]?.change24h ?? 0) >= 0 ? '+' : ''}{(rates[0]?.change24h ?? 0).toFixed(2)}% 24h
              </p>
            </div>
            <div className="rounded-lg border border-slate-100 bg-slate-50 p-4 text-center">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                {locale === 'es' ? 'Indice Depositos PR' : 'PR Deposit Index'}
              </p>
              <p className="mt-1 text-xl font-bold text-[#1e3a5f]">{rates[1]?.value.toFixed(2)}%</p>
              <p className={`text-[10px] ${(rates[1]?.change24h ?? 0) < 0 ? 'text-rose-500' : 'text-emerald-500'}`}>
                {(rates[1]?.change24h ?? 0) >= 0 ? '+' : ''}{(rates[1]?.change24h ?? 0).toFixed(2)}% 24h
              </p>
            </div>
          </div>
        </div>

        {/* Settings panel (collapsible) */}
        {settingsOpen && (
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <h3 className="mb-4 text-sm font-bold text-[#1e3a5f]">
              {locale === 'es' ? 'Configurar Umbrales de Alerta' : 'Configure Alert Thresholds'}
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                      {locale === 'es' ? 'Metrica' : 'Metric'}
                    </th>
                    <th className="px-4 py-2.5 text-center text-[10px] font-semibold uppercase tracking-wider text-amber-600">
                      {locale === 'es' ? 'Advertencia' : 'Warn Level'}
                    </th>
                    <th className="px-4 py-2.5 text-center text-[10px] font-semibold uppercase tracking-wider text-rose-600">
                      {locale === 'es' ? 'Incumplimiento' : 'Breach Level'}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {thresholds.map((t) => (
                    <tr key={t.metric} className="border-b border-slate-50">
                      <td className="px-4 py-2.5 text-xs font-medium text-slate-700">{t.metric}</td>
                      <td className="px-4 py-2.5 text-center">
                        <input
                          type="number"
                          step="0.01"
                          value={t.warnLevel}
                          onChange={(e) => updateThreshold(t.metric, 'warnLevel', parseFloat(e.target.value) || 0)}
                          className="w-24 rounded border border-slate-200 px-2 py-1 text-center text-xs text-slate-700 focus:border-amber-500 focus:outline-none"
                        />
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        <input
                          type="number"
                          step="0.01"
                          value={t.breachLevel}
                          onChange={(e) => updateThreshold(t.metric, 'breachLevel', parseFloat(e.target.value) || 0)}
                          className="w-24 rounded border border-slate-200 px-2 py-1 text-center text-xs text-slate-700 focus:border-rose-500 focus:outline-none"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-4 flex justify-end">
              <button
                onClick={() => setSettingsOpen(false)}
                className="rounded-lg bg-[#1e3a5f] px-4 py-2 text-xs font-semibold text-white hover:bg-[#2a4f7f]"
              >
                {locale === 'es' ? 'Guardar Umbrales' : 'Save Thresholds'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
