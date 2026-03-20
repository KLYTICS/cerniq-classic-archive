'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '@/lib/api';
import { useALM } from '@/components/alm/ALMProvider';
import { useTranslation } from '@/lib/i18n';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  BarChart, Bar,
} from 'recharts';
import { TrendingUp, AlertTriangle, RefreshCw, Save, Zap } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────

interface TenorRate {
  tenor: number;
  rate: number;
}

interface ShockedCurve {
  shockType: string;
  shockLabel: string;
  baseCurve: TenorRate[];
  shockedCurve: TenorRate[];
}

interface YieldCurveAnalysis {
  baseCurve: TenorRate[];
  nelsonSiegelParams: { beta0: number; beta1: number; beta2: number; lambda: number };
  forwardRates: TenorRate[];
  shockedCurves: ShockedCurve[];
  niiImpact: Array<{ shockType: string; label: string; niiChangePct: number; eveChangePct: number }>;
}

const TENOR_LABELS: Record<number, string> = {
  0.25: '3M', 0.5: '6M', 1: '1Y', 2: '2Y', 3: '3Y',
  5: '5Y', 7: '7Y', 10: '10Y', 20: '20Y', 30: '30Y',
};

const SHOCK_COLORS: Record<string, string> = {
  parallel_up: '#ef4444',
  parallel_down: '#3b82f6',
  steepener: '#f59e0b',
  flattener: '#8b5cf6',
  short_up: '#f97316',
  short_down: '#06b6d4',
};

// ─── Main Page ────────────────────────────────────────────────

export default function YieldCurvePage() {
  const { selectedId } = useALM();
  const { locale } = useTranslation();

  const [analysis, setAnalysis] = useState<YieldCurveAnalysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeShocks, setActiveShocks] = useState<Set<string>>(new Set(['parallel_up', 'steepener']));
  const [editMode, setEditMode] = useState(false);
  const [editCurve, setEditCurve] = useState<TenorRate[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!selectedId) return;
    (async () => {
      setLoading(true);
      try {
        const data = await apiClient.getYieldCurveAnalysis(selectedId);
        setAnalysis(data);
        setEditCurve(data.baseCurve.map((p: TenorRate) => ({ ...p })));
      } catch {
        // Demo fallback
        const demo = getDemoAnalysis();
        setAnalysis(demo);
        setEditCurve(demo.baseCurve.map((p) => ({ ...p })));
      } finally {
        setLoading(false);
      }
    })();
  }, [selectedId]);

  const toggleShock = useCallback((type: string) => {
    setActiveShocks((prev) => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  }, []);

  const updateTenorRate = useCallback((index: number, rate: number) => {
    setEditCurve((prev) => prev.map((p, i) => i === index ? { ...p, rate } : p));
  }, []);

  const saveCurve = useCallback(async () => {
    if (!selectedId) return;
    setSaving(true);
    try {
      await apiClient.saveCustomYieldCurve({
        institutionId: selectedId,
        name: `Custom Curve ${new Date().toLocaleDateString()}`,
        tenors: editCurve,
        source: 'manual',
      });
      // Refresh analysis
      const data = await apiClient.getYieldCurveAnalysis(selectedId);
      setAnalysis(data);
      setEditMode(false);
    } catch { /* ignore */ } finally {
      setSaving(false);
    }
  }, [selectedId, editCurve]);

  if (!selectedId) {
    return (
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="text-center space-y-4">
          <AlertTriangle className="h-12 w-12 text-amber-500 mx-auto" />
          <p className="text-slate-500 text-sm">{locale === 'es' ? 'Seleccione una institución' : 'Select an institution'}</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-cyan-200 border-t-cyan-600" />
      </div>
    );
  }

  if (!analysis) return null;

  // Build chart data
  const chartData = analysis.baseCurve.map((point) => {
    const entry: Record<string, any> = {
      tenor: TENOR_LABELS[point.tenor] || `${point.tenor}Y`,
      base: +(point.rate * 100).toFixed(3),
    };
    analysis.shockedCurves.forEach((sc) => {
      if (activeShocks.has(sc.shockType)) {
        const sp = sc.shockedCurve.find((p) => p.tenor === point.tenor);
        if (sp) entry[sc.shockType] = +(sp.rate * 100).toFixed(3);
      }
    });
    // Forward rate
    const fwd = analysis.forwardRates.find((f) => f.tenor === point.tenor);
    if (fwd) entry.forward = +(fwd.rate * 100).toFixed(3);
    return entry;
  });

  return (
    <div className="p-6 space-y-5 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-cyan-200 bg-cyan-50">
            <TrendingUp className="h-4 w-4 text-cyan-700" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-950">
              {locale === 'es' ? 'Modelado de Curva de Rendimiento' : 'Yield Curve Modeling'}
            </h1>
            <p className="text-xs text-slate-500">
              {locale === 'es' ? 'Nelson-Siegel, 6 choques Basel IRRBB, tasas forward' : 'Nelson-Siegel, 6 Basel IRRBB shocks, forward rates'}
            </p>
          </div>
        </div>
        <button
          onClick={() => setEditMode(!editMode)}
          className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs transition ${
            editMode ? 'border-cyan-300 bg-cyan-50 text-cyan-700' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
          }`}
        >
          {editMode ? (locale === 'es' ? 'Cancelar Edición' : 'Cancel Edit') : (locale === 'es' ? 'Editar Curva' : 'Edit Curve')}
        </button>
      </div>

      {/* Nelson-Siegel Parameters */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'β₀ (Level)', value: analysis.nelsonSiegelParams.beta0 },
          { label: 'β₁ (Slope)', value: analysis.nelsonSiegelParams.beta1 },
          { label: 'β₂ (Curvature)', value: analysis.nelsonSiegelParams.beta2 },
          { label: 'λ (Decay)', value: analysis.nelsonSiegelParams.lambda },
        ].map(({ label, value }) => (
          <div key={label} className="rounded-xl border border-slate-200 bg-white p-3">
            <p className="text-[10px] font-medium uppercase tracking-wider text-slate-400">{label}</p>
            <p className="text-lg font-bold tabular-nums text-slate-950">{value.toFixed(4)}</p>
          </div>
        ))}
      </div>

      {/* Curve Editor (when in edit mode) */}
      {editMode && (
        <div className="rounded-xl border border-cyan-200 bg-cyan-50/50 p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-semibold text-cyan-800">
              {locale === 'es' ? 'Editar Puntos de la Curva' : 'Edit Curve Points'}
            </p>
            <button
              onClick={saveCurve}
              disabled={saving}
              className="flex items-center gap-1.5 rounded-lg bg-cyan-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-cyan-700 disabled:opacity-50"
            >
              {saving ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              {locale === 'es' ? 'Guardar Curva' : 'Save Curve'}
            </button>
          </div>
          <div className="grid grid-cols-5 md:grid-cols-10 gap-2">
            {editCurve.map((point, i) => (
              <div key={point.tenor} className="text-center">
                <label className="text-[10px] font-medium text-slate-500 block mb-1">
                  {TENOR_LABELS[point.tenor] || `${point.tenor}Y`}
                </label>
                <input
                  type="number"
                  step="0.001"
                  value={+(point.rate * 100).toFixed(3)}
                  onChange={(e) => updateTenorRate(i, parseFloat(e.target.value) / 100 || 0)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-center text-xs tabular-nums focus:border-cyan-400 focus:ring-1 focus:ring-cyan-300"
                />
                <span className="text-[9px] text-slate-400">%</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Main Chart: Base + Shocked Curves */}
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-4">
          {locale === 'es' ? 'Curvas de Rendimiento: Base vs. Choques' : 'Yield Curves: Base vs. Shocks'}
        </p>
        <ResponsiveContainer width="100%" height={350}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="tenor" tick={{ fontSize: 11 }} />
            <YAxis tickFormatter={(v) => `${v}%`} tick={{ fontSize: 11 }} domain={['auto', 'auto']} />
            <Tooltip
              contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: '12px' }}
              formatter={(value: number) => [`${value.toFixed(3)}%`, '']}
            />
            <Legend wrapperStyle={{ fontSize: '11px' }} />
            <Line type="monotone" dataKey="base" stroke="#0f172a" strokeWidth={3} dot={{ r: 4 }} name="Base Curve" />
            <Line type="monotone" dataKey="forward" stroke="#94a3b8" strokeWidth={1.5} strokeDasharray="4 4" dot={false} name="Forward Rates" />
            {analysis.shockedCurves
              .filter((sc) => activeShocks.has(sc.shockType))
              .map((sc) => (
                <Line
                  key={sc.shockType}
                  type="monotone"
                  dataKey={sc.shockType}
                  stroke={SHOCK_COLORS[sc.shockType] || '#6b7280'}
                  strokeWidth={2}
                  dot={false}
                  name={sc.shockLabel}
                />
              ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Shock Toggles */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">
          {locale === 'es' ? 'Seleccionar Escenarios de Choque Basel IRRBB' : 'Select Basel IRRBB Shock Scenarios'}
        </p>
        <div className="flex flex-wrap gap-2">
          {analysis.shockedCurves.map((sc) => {
            const active = activeShocks.has(sc.shockType);
            return (
              <button
                key={sc.shockType}
                onClick={() => toggleShock(sc.shockType)}
                className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs transition ${
                  active
                    ? 'border-slate-400 bg-slate-900 text-white'
                    : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                }`}
              >
                <div
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: SHOCK_COLORS[sc.shockType] || '#6b7280' }}
                />
                {sc.shockLabel}
              </button>
            );
          })}
        </div>
      </div>

      {/* NII / EVE Impact Table */}
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-100">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            {locale === 'es' ? 'Impacto NII / EVE por Escenario' : 'NII / EVE Impact by Shock Scenario'}
          </p>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-50 bg-slate-50/50">
              <th className="px-5 py-2.5 text-left text-[11px] font-medium text-slate-500">
                {locale === 'es' ? 'Escenario' : 'Scenario'}
              </th>
              <th className="px-5 py-2.5 text-right text-[11px] font-medium text-slate-500">
                {locale === 'es' ? 'Cambio NII (%)' : 'NII Change (%)'}
              </th>
              <th className="px-5 py-2.5 text-right text-[11px] font-medium text-slate-500">
                {locale === 'es' ? 'Cambio EVE (%)' : 'EVE Change (%)'}
              </th>
              <th className="px-5 py-2.5 text-center text-[11px] font-medium text-slate-500">
                {locale === 'es' ? 'Riesgo' : 'Risk'}
              </th>
            </tr>
          </thead>
          <tbody>
            {analysis.niiImpact.map((row) => {
              const niiRisk = Math.abs(row.niiChangePct) > 15 ? 'high' : Math.abs(row.niiChangePct) > 8 ? 'medium' : 'low';
              return (
                <tr key={row.shockType} className="border-b border-slate-50 last:border-0">
                  <td className="px-5 py-3 flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full" style={{ backgroundColor: SHOCK_COLORS[row.shockType] || '#6b7280' }} />
                    <span className="font-medium text-slate-700">{row.label}</span>
                  </td>
                  <td className={`px-5 py-3 text-right tabular-nums font-semibold ${row.niiChangePct >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                    {row.niiChangePct >= 0 ? '+' : ''}{row.niiChangePct.toFixed(2)}%
                  </td>
                  <td className={`px-5 py-3 text-right tabular-nums font-semibold ${row.eveChangePct >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                    {row.eveChangePct >= 0 ? '+' : ''}{row.eveChangePct.toFixed(2)}%
                  </td>
                  <td className="px-5 py-3 text-center">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                      niiRisk === 'high' ? 'bg-rose-50 text-rose-700' :
                      niiRisk === 'medium' ? 'bg-amber-50 text-amber-700' :
                      'bg-emerald-50 text-emerald-700'
                    }`}>
                      {niiRisk === 'high' ? (locale === 'es' ? 'Alto' : 'High') :
                       niiRisk === 'medium' ? (locale === 'es' ? 'Medio' : 'Medium') :
                       locale === 'es' ? 'Bajo' : 'Low'}
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

// ─── Demo Data ────────────────────────────────────────────────

function getDemoAnalysis(): YieldCurveAnalysis {
  const baseCurve: TenorRate[] = [
    { tenor: 0.25, rate: 0.0480 }, { tenor: 0.5, rate: 0.0465 }, { tenor: 1, rate: 0.0440 },
    { tenor: 2, rate: 0.0420 }, { tenor: 3, rate: 0.0410 }, { tenor: 5, rate: 0.0405 },
    { tenor: 7, rate: 0.0410 }, { tenor: 10, rate: 0.0420 }, { tenor: 20, rate: 0.0455 }, { tenor: 30, rate: 0.0465 },
  ];

  const shockTypes = [
    { type: 'parallel_up', label: 'Parallel +200bps', shift: 200 },
    { type: 'parallel_down', label: 'Parallel -200bps', shift: -200 },
    { type: 'steepener', label: 'Steepener', shortShift: -100, longShift: 100 },
    { type: 'flattener', label: 'Flattener', shortShift: 100, longShift: -100 },
    { type: 'short_up', label: 'Short Rate +300bps', shift: 0 },
    { type: 'short_down', label: 'Short Rate -300bps', shift: 0 },
  ];

  const baselShocks: Record<string, Record<number, number>> = {
    parallel_up: Object.fromEntries(baseCurve.map((p) => [p.tenor, 200])),
    parallel_down: Object.fromEntries(baseCurve.map((p) => [p.tenor, -200])),
    steepener: { 0.25: -100, 0.5: -90, 1: -75, 2: -50, 3: -30, 5: 0, 7: 30, 10: 60, 20: 90, 30: 100 },
    flattener: { 0.25: 100, 0.5: 90, 1: 75, 2: 50, 3: 30, 5: 0, 7: -30, 10: -60, 20: -90, 30: -100 },
    short_up: { 0.25: 300, 0.5: 275, 1: 250, 2: 200, 3: 150, 5: 75, 7: 40, 10: 0, 20: 0, 30: 0 },
    short_down: { 0.25: -300, 0.5: -275, 1: -250, 2: -200, 3: -150, 5: -75, 7: -40, 10: 0, 20: 0, 30: 0 },
  };

  const shockedCurves: ShockedCurve[] = shockTypes.map(({ type, label }) => ({
    shockType: type,
    shockLabel: label,
    baseCurve,
    shockedCurve: baseCurve.map((p) => ({
      tenor: p.tenor,
      rate: Math.max(0, p.rate + (baselShocks[type]?.[p.tenor] ?? 0) / 10000),
    })),
  }));

  return {
    baseCurve,
    nelsonSiegelParams: { beta0: 0.0465, beta1: -0.0025, beta2: -0.0060, lambda: 1.8 },
    forwardRates: [
      { tenor: 0.5, rate: 0.0450 }, { tenor: 1, rate: 0.0415 }, { tenor: 2, rate: 0.0400 },
      { tenor: 3, rate: 0.0400 }, { tenor: 5, rate: 0.0398 }, { tenor: 7, rate: 0.0418 },
      { tenor: 10, rate: 0.0435 }, { tenor: 20, rate: 0.0490 }, { tenor: 30, rate: 0.0495 },
    ],
    shockedCurves,
    niiImpact: [
      { shockType: 'parallel_up', label: 'Parallel +200bps', niiChangePct: 12.4, eveChangePct: -18.2 },
      { shockType: 'parallel_down', label: 'Parallel -200bps', niiChangePct: -10.8, eveChangePct: 15.6 },
      { shockType: 'steepener', label: 'Steepener', niiChangePct: 3.2, eveChangePct: -6.1 },
      { shockType: 'flattener', label: 'Flattener', niiChangePct: -2.8, eveChangePct: 4.9 },
      { shockType: 'short_up', label: 'Short Rate +300bps', niiChangePct: 18.7, eveChangePct: -8.4 },
      { shockType: 'short_down', label: 'Short Rate -300bps', niiChangePct: -16.2, eveChangePct: 7.1 },
    ],
  };
}
