'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '@/lib/api';
import { useALM } from '@/components/alm/ALMProvider';
import { useTranslation } from '@/lib/i18n';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  AreaChart, Area, Cell,
} from 'recharts';
import { Shield, AlertTriangle, RefreshCw, Upload, Calculator } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────

interface CECLSegmentResult {
  segmentName: string;
  balance: number;
  methodology: string;
  historicalLossRate: number;
  qualitativeAdj: number;
  adjustedLossRate: number;
  expectedLoss: number;
  allowanceRequired: number;
  coverageRatio: number;
}

interface CECLSummary {
  totalBalance: number;
  totalAllowance: number;
  weightedCoverageRatio: number;
  methodology: string;
  segments: CECLSegmentResult[];
  macroScenarioBreakdown?: {
    baseline: number;
    adverse: number;
    severelyAdverse: number;
    weighted: number;
  };
}

interface CECLForecast {
  quarters: Array<{
    quarter: string;
    allowance: number;
    provisionExpense: number;
    netChargeOffs: number;
    coverageRatio: number;
  }>;
  totalProvision12M: number;
}

type Methodology = 'warm' | 'vintage' | 'pdlgd';

const METHOD_LABELS: Record<Methodology, { en: string; es: string }> = {
  warm: { en: 'WARM (Weighted Avg Remaining Life)', es: 'WARM (Vida Remanente Ponderada)' },
  vintage: { en: 'Vintage / Cohort Analysis', es: 'Análisis de Cosecha' },
  pdlgd: { en: 'PD × LGD (Macro Scenarios)', es: 'PD × LGD (Escenarios Macro)' },
};

const CHART_COLORS = ['#06b6d4', '#f59e0b', '#8b5cf6', '#10b981', '#ef4444', '#ec4899'];

// ─── Main Page ────────────────────────────────────────────────

export default function CECLPage() {
  const { selectedId } = useALM();
  const { locale } = useTranslation();

  const [methodology, setMethodology] = useState<Methodology>('warm');
  const [analysis, setAnalysis] = useState<CECLSummary | null>(null);
  const [forecast, setForecast] = useState<CECLForecast | null>(null);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async (method: Methodology) => {
    if (!selectedId) return;
    setLoading(true);
    try {
      const [cecl, fc] = await Promise.all([
        apiClient.getCECLAnalysis(selectedId),
        apiClient.getCECLForecast(selectedId),
      ]);
      setAnalysis(cecl);
      setForecast(fc);
    } catch {
      setAnalysis(getDemoSummary(method));
      setForecast(getDemoForecast());
    } finally {
      setLoading(false);
    }
  }, [selectedId]);

  useEffect(() => { loadData(methodology); }, [selectedId, loadData, methodology]);

  const handleMethodologyChange = useCallback((method: Methodology) => {
    setMethodology(method);
  }, []);

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

  return (
    <div className="p-6 space-y-5 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-emerald-200 bg-emerald-50">
            <Shield className="h-4 w-4 text-emerald-700" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-950">
              {locale === 'es' ? 'CECL — Pérdidas Crediticias Esperadas' : 'CECL — Current Expected Credit Losses'}
            </h1>
            <p className="text-xs text-slate-500">FASB ASC 326 — {locale === 'es' ? 'Estimación de pérdidas de por vida' : 'Lifetime loss estimation'}</p>
          </div>
        </div>
      </div>

      {/* Methodology Selector */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">
          {locale === 'es' ? 'Metodología' : 'Methodology'}
        </p>
        <div className="flex flex-wrap gap-2">
          {(Object.keys(METHOD_LABELS) as Methodology[]).map((method) => (
            <button
              key={method}
              onClick={() => handleMethodologyChange(method)}
              className={`rounded-lg border px-4 py-2.5 text-xs font-medium transition ${
                methodology === method
                  ? 'border-emerald-400 bg-emerald-50 text-emerald-700'
                  : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
              }`}
            >
              <Calculator className="inline h-3.5 w-3.5 mr-1.5" />
              {locale === 'es' ? METHOD_LABELS[method].es : METHOD_LABELS[method].en}
            </button>
          ))}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KPICard
          label={locale === 'es' ? 'Balance Total' : 'Total Balance'}
          value={`$${analysis.totalBalance.toFixed(1)}M`}
        />
        <KPICard
          label={locale === 'es' ? 'Provisión Requerida' : 'Allowance Required'}
          value={`$${analysis.totalAllowance.toFixed(2)}M`}
          accent
        />
        <KPICard
          label={locale === 'es' ? 'Ratio de Cobertura' : 'Coverage Ratio'}
          value={`${(analysis.weightedCoverageRatio * 100).toFixed(2)}%`}
        />
        <KPICard
          label={locale === 'es' ? 'Provisión 12M' : '12M Provision'}
          value={forecast ? `$${forecast.totalProvision12M.toFixed(2)}M` : '—'}
        />
      </div>

      {/* Macro Scenario Breakdown (PD×LGD only) */}
      {analysis.macroScenarioBreakdown && (
        <div className="rounded-xl border border-purple-200 bg-purple-50/50 p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-purple-700 mb-3">
            {locale === 'es' ? 'Desglose por Escenario Macroeconómico' : 'Macro Scenario Breakdown'}
          </p>
          <div className="grid grid-cols-4 gap-3">
            {[
              { label: locale === 'es' ? 'Base (50%)' : 'Baseline (50%)', value: analysis.macroScenarioBreakdown.baseline },
              { label: locale === 'es' ? 'Adverso (30%)' : 'Adverse (30%)', value: analysis.macroScenarioBreakdown.adverse },
              { label: locale === 'es' ? 'Sev. Adverso (20%)' : 'Sev. Adverse (20%)', value: analysis.macroScenarioBreakdown.severelyAdverse },
              { label: locale === 'es' ? 'Ponderado' : 'Weighted', value: analysis.macroScenarioBreakdown.weighted },
            ].map(({ label, value }) => (
              <div key={label} className="text-center">
                <p className="text-[10px] text-purple-600">{label}</p>
                <p className="text-sm font-bold tabular-nums text-purple-900">${value.toFixed(2)}M</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Segment Allowance Chart */}
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-4">
          {locale === 'es' ? 'Provisión por Segmento' : 'Allowance by Segment'}
        </p>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={analysis.segments} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis type="number" tickFormatter={(v) => `$${v.toFixed(1)}M`} tick={{ fontSize: 11 }} />
            <YAxis type="category" dataKey="segmentName" tick={{ fontSize: 11 }} width={130} />
            <Tooltip
              contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: '12px' }}
              formatter={(value: number) => [`$${value.toFixed(3)}M`, '']}
            />
            <Bar dataKey="allowanceRequired" name={locale === 'es' ? 'Provisión' : 'Allowance'} radius={[0, 4, 4, 0]}>
              {analysis.segments.map((_, i) => (
                <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Segment Detail Table */}
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-100">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            {locale === 'es' ? 'Detalle por Segmento de Préstamos' : 'Loan Segment Detail'}
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-50 bg-slate-50/50">
                {[
                  locale === 'es' ? 'Segmento' : 'Segment',
                  locale === 'es' ? 'Balance ($M)' : 'Balance ($M)',
                  locale === 'es' ? 'Tasa Pérdida Hist.' : 'Hist. Loss Rate',
                  locale === 'es' ? 'Ajuste Cualit.' : 'Qualitative Adj.',
                  locale === 'es' ? 'Tasa Ajustada' : 'Adjusted Rate',
                  locale === 'es' ? 'Provisión ($M)' : 'Allowance ($M)',
                  locale === 'es' ? 'Cobertura' : 'Coverage',
                ].map((h) => (
                  <th key={h} className="px-4 py-2.5 text-left text-[11px] font-medium text-slate-500 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {analysis.segments.map((seg) => (
                <tr key={seg.segmentName} className="border-b border-slate-50 last:border-0">
                  <td className="px-4 py-3 font-medium text-slate-700">{seg.segmentName}</td>
                  <td className="px-4 py-3 tabular-nums text-slate-600">{seg.balance.toFixed(1)}</td>
                  <td className="px-4 py-3 tabular-nums text-slate-600">{(seg.historicalLossRate * 100).toFixed(2)}%</td>
                  <td className="px-4 py-3 tabular-nums text-slate-600">
                    {seg.qualitativeAdj >= 0 ? '+' : ''}{(seg.qualitativeAdj * 100).toFixed(2)}%
                  </td>
                  <td className="px-4 py-3 tabular-nums font-medium text-slate-700">{(seg.adjustedLossRate * 100).toFixed(2)}%</td>
                  <td className="px-4 py-3 tabular-nums font-semibold text-emerald-700">${seg.allowanceRequired.toFixed(3)}</td>
                  <td className="px-4 py-3 tabular-nums">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                      seg.coverageRatio > 0.02 ? 'bg-amber-50 text-amber-700' :
                      seg.coverageRatio > 0.01 ? 'bg-emerald-50 text-emerald-700' :
                      'bg-slate-50 text-slate-600'
                    }`}>
                      {(seg.coverageRatio * 100).toFixed(2)}%
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 8-Quarter Forecast */}
      {forecast && (
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-4">
            {locale === 'es' ? 'Pronóstico de Provisión — 8 Trimestres' : 'Allowance Forecast — 8 Quarters'}
          </p>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={forecast.quarters}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="quarter" tick={{ fontSize: 11 }} />
              <YAxis tickFormatter={(v) => `$${v.toFixed(1)}M`} tick={{ fontSize: 11 }} />
              <Tooltip
                contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: '12px' }}
                formatter={(value: number) => [`$${value.toFixed(3)}M`, '']}
              />
              <Legend wrapperStyle={{ fontSize: '11px' }} />
              <Area type="monotone" dataKey="allowance" stroke="#06b6d4" fill="#06b6d4" fillOpacity={0.15} strokeWidth={2} name={locale === 'es' ? 'Provisión' : 'Allowance'} />
              <Area type="monotone" dataKey="provisionExpense" stroke="#f59e0b" fill="#f59e0b" fillOpacity={0.1} strokeWidth={2} name={locale === 'es' ? 'Gasto Provisión' : 'Provision Expense'} />
              <Area type="monotone" dataKey="netChargeOffs" stroke="#ef4444" fill="#ef4444" fillOpacity={0.1} strokeWidth={1.5} name={locale === 'es' ? 'Castigos Netos' : 'Net Charge-Offs'} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

// ─── Sub-Components ──────────────────────────────────────────

function KPICard({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className={`rounded-xl border p-3 ${accent ? 'border-emerald-200 bg-emerald-50' : 'border-slate-200 bg-white'}`}>
      <p className="text-[10px] font-medium uppercase tracking-wider text-slate-400">{label}</p>
      <p className={`text-lg font-bold tabular-nums ${accent ? 'text-emerald-700' : 'text-slate-950'}`}>{value}</p>
    </div>
  );
}

// ─── Demo Data ──────────────────────────────────────────────

function getDemoSummary(method: Methodology): CECLSummary {
  const segments: CECLSegmentResult[] = [
    { segmentName: 'Consumer Loans', balance: 85, methodology: 'WARM', historicalLossRate: 0.018, qualitativeAdj: 0.002, adjustedLossRate: 0.020, expectedLoss: 5.95, allowanceRequired: 5.95, coverageRatio: 0.070 },
    { segmentName: 'Auto Loans', balance: 62, methodology: 'WARM', historicalLossRate: 0.012, qualitativeAdj: 0.001, adjustedLossRate: 0.013, expectedLoss: 3.39, allowanceRequired: 3.39, coverageRatio: 0.055 },
    { segmentName: 'Commercial RE', balance: 120, methodology: 'WARM', historicalLossRate: 0.008, qualitativeAdj: 0.003, adjustedLossRate: 0.011, expectedLoss: 9.90, allowanceRequired: 9.90, coverageRatio: 0.083 },
    { segmentName: 'Residential Mortgage', balance: 95, methodology: 'WARM', historicalLossRate: 0.004, qualitativeAdj: 0.001, adjustedLossRate: 0.005, expectedLoss: 7.13, allowanceRequired: 7.13, coverageRatio: 0.075 },
    { segmentName: 'Credit Cards', balance: 28, methodology: 'WARM', historicalLossRate: 0.035, qualitativeAdj: 0.005, adjustedLossRate: 0.040, expectedLoss: 1.68, allowanceRequired: 1.68, coverageRatio: 0.060 },
    { segmentName: 'Commercial & Industrial', balance: 55, methodology: 'WARM', historicalLossRate: 0.015, qualitativeAdj: 0.002, adjustedLossRate: 0.017, expectedLoss: 4.68, allowanceRequired: 4.68, coverageRatio: 0.085 },
  ];

  const totalBalance = segments.reduce((s, r) => s + r.balance, 0);
  const totalAllowance = segments.reduce((s, r) => s + r.allowanceRequired, 0);

  return {
    totalBalance,
    totalAllowance,
    weightedCoverageRatio: totalAllowance / totalBalance,
    methodology: method.toUpperCase(),
    segments,
    ...(method === 'pdlgd' ? {
      macroScenarioBreakdown: {
        baseline: totalAllowance * 0.75,
        adverse: totalAllowance * 1.35,
        severelyAdverse: totalAllowance * 2.25,
        weighted: totalAllowance,
      },
    } : {}),
  };
}

function getDemoForecast(): CECLForecast {
  const now = new Date();
  return {
    quarters: Array.from({ length: 8 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() + (i + 1) * 3, 1);
      return {
        quarter: `Q${Math.ceil((d.getMonth() + 1) / 3)} ${d.getFullYear()}`,
        allowance: 32.73 + i * 0.4,
        provisionExpense: 1.2 + i * 0.15,
        netChargeOffs: 0.8 + i * 0.08,
        coverageRatio: 0.073 + i * 0.001,
      };
    }),
    totalProvision12M: 6.4,
  };
}
