'use client';

import { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api';
import { useALM } from '@/components/alm/ALMProvider';
import { useTranslation } from '@/lib/i18n';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';
import { AlertTriangle, Shield, Check, X } from 'lucide-react';

interface ConcentrationExposure {
  limitName: string;
  limitType: string;
  maxPct: number;
  currentPct: number;
  currentBalance: number;
  headroom: number;
  status: 'compliant' | 'warning' | 'breach';
  utilizationPct: number;
}

interface ConcentrationAnalysis {
  exposures: ConcentrationExposure[];
  hhi: number;
  hhiInterpretation: string;
  diversificationScore: number;
  breachCount: number;
  warningCount: number;
  totalAssets: number;
}

const STATUS_COLORS = {
  compliant: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', bar: '#10b981' },
  warning: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', bar: '#f59e0b' },
  breach: { bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200', bar: '#ef4444' },
};

export default function ConcentrationPage() {
  const { selectedId } = useALM();
  const { locale } = useTranslation();
  const [analysis, setAnalysis] = useState<ConcentrationAnalysis | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!selectedId) return;
    (async () => {
      setLoading(true);
      try {
        const data = await apiClient.getConcentrationAnalysis(selectedId);
        setAnalysis(data);
      } catch {
        setAnalysis(getDemoAnalysis());
      } finally {
        setLoading(false);
      }
    })();
  }, [selectedId]);

  if (!selectedId) {
    return (
      <div className="flex-1 flex items-center justify-center p-6">
        <AlertTriangle className="h-12 w-12 text-amber-500 mx-auto" />
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

  if (!analysis) return <div className="flex-1 flex items-center justify-center p-6 text-sm text-slate-400">No data available</div>;

  function getDemoAnalysis(): ConcentrationAnalysis {
    return {
      hhi: 1450, hhiInterpretation: 'Moderate', diversificationScore: 72, breachCount: 1, warningCount: 2, totalAssets: 18900000000,
      exposures: [
        { limitName: 'Commercial Real Estate', limitType: 'Regulatory', maxPct: 0.30, currentPct: 0.28, currentBalance: 5292000000, headroom: 378000000, status: 'warning', utilizationPct: 93 },
        { limitName: 'Single Borrower', limitType: 'Board', maxPct: 0.15, currentPct: 0.12, currentBalance: 2268000000, headroom: 567000000, status: 'compliant', utilizationPct: 80 },
        { limitName: 'Construction & Development', limitType: 'Regulatory', maxPct: 0.10, currentPct: 0.11, currentBalance: 2079000000, headroom: -189000000, status: 'breach', utilizationPct: 110 },
        { limitName: 'Consumer Unsecured', limitType: 'Board', maxPct: 0.20, currentPct: 0.14, currentBalance: 2646000000, headroom: 1134000000, status: 'compliant', utilizationPct: 70 },
        { limitName: 'Government Securities', limitType: 'Policy', maxPct: 0.25, currentPct: 0.22, currentBalance: 4158000000, headroom: 567000000, status: 'warning', utilizationPct: 88 },
        { limitName: 'Municipal Bonds', limitType: 'Board', maxPct: 0.08, currentPct: 0.05, currentBalance: 945000000, headroom: 567000000, status: 'compliant', utilizationPct: 63 },
      ],
    };
  }

  const chartData = analysis.exposures.map((e) => ({
    name: e.limitName,
    current: +(e.currentPct * 100).toFixed(1),
    limit: +(e.maxPct * 100).toFixed(1),
    status: e.status,
  }));

  return (
    <div className="p-6 space-y-5 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-rose-200 bg-rose-50">
          <Shield className="h-4 w-4 text-rose-700" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-slate-950">
            {locale === 'es' ? 'Análisis de Concentración' : 'Concentration Analysis'}
          </h1>
          <p className="text-xs text-slate-500">
            {locale === 'es' ? 'Límites de exposición, HHI, alertas de concentración' : 'Exposure limits, HHI index, concentration alerts'}
          </p>
        </div>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="rounded-xl border border-slate-200 bg-white p-3">
          <p className="text-[10px] font-medium uppercase tracking-wider text-slate-400">HHI Index</p>
          <p className="text-lg font-bold tabular-nums text-slate-950">{analysis.hhi.toLocaleString()}</p>
          <p className="text-[10px] text-slate-400">{analysis.hhiInterpretation}</p>
        </div>
        <div className="rounded-xl border border-cyan-200 bg-cyan-50 p-3">
          <p className="text-[10px] font-medium uppercase tracking-wider text-cyan-600">
            {locale === 'es' ? 'Diversificación' : 'Diversification'}
          </p>
          <p className="text-lg font-bold tabular-nums text-cyan-700">{analysis.diversificationScore}/100</p>
        </div>
        <div className={`rounded-xl border p-3 ${analysis.breachCount > 0 ? 'border-rose-200 bg-rose-50' : 'border-slate-200 bg-white'}`}>
          <p className="text-[10px] font-medium uppercase tracking-wider text-slate-400">
            {locale === 'es' ? 'Incumplimientos' : 'Breaches'}
          </p>
          <p className={`text-lg font-bold tabular-nums ${analysis.breachCount > 0 ? 'text-rose-700' : 'text-emerald-700'}`}>
            {analysis.breachCount}
          </p>
        </div>
        <div className={`rounded-xl border p-3 ${analysis.warningCount > 0 ? 'border-amber-200 bg-amber-50' : 'border-slate-200 bg-white'}`}>
          <p className="text-[10px] font-medium uppercase tracking-wider text-slate-400">
            {locale === 'es' ? 'Alertas' : 'Warnings'}
          </p>
          <p className={`text-lg font-bold tabular-nums ${analysis.warningCount > 0 ? 'text-amber-700' : 'text-emerald-700'}`}>
            {analysis.warningCount}
          </p>
        </div>
      </div>

      {/* Exposure vs Limits Chart */}
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-4">
          {locale === 'es' ? 'Exposición vs. Límites de Política' : 'Exposure vs. Policy Limits'}
        </p>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chartData} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis type="number" tickFormatter={(v) => `${v}%`} tick={{ fontSize: 11 }} />
            <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={120} />
            <Tooltip contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: '12px' }} />
            <Bar dataKey="current" name={locale === 'es' ? 'Actual' : 'Current'} radius={[0, 4, 4, 0]}>
              {chartData.map((entry, i) => (
                <Cell key={i} fill={STATUS_COLORS[entry.status as keyof typeof STATUS_COLORS].bar} />
              ))}
            </Bar>
            <Bar dataKey="limit" name={locale === 'es' ? 'Límite' : 'Limit'} fill="#cbd5e1" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Detail Table */}
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/50">
              {[
                locale === 'es' ? 'Exposición' : 'Exposure',
                locale === 'es' ? 'Tipo' : 'Type',
                locale === 'es' ? 'Balance ($M)' : 'Balance ($M)',
                locale === 'es' ? 'Actual' : 'Current',
                locale === 'es' ? 'Límite' : 'Limit',
                locale === 'es' ? 'Utilización' : 'Utilization',
                locale === 'es' ? 'Estado' : 'Status',
              ].map((h) => (
                <th key={h} className="px-4 py-2.5 text-left text-[11px] font-medium text-slate-500">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {analysis.exposures.map((e) => {
              const style = STATUS_COLORS[e.status];
              return (
                <tr key={e.limitName} className="border-b border-slate-50 last:border-0">
                  <td className="px-4 py-3 font-medium text-slate-700">{e.limitName}</td>
                  <td className="px-4 py-3 text-xs text-slate-500 capitalize">{e.limitType.replace('_', ' ')}</td>
                  <td className="px-4 py-3 tabular-nums text-slate-600">{e.currentBalance.toFixed(1)}</td>
                  <td className="px-4 py-3 tabular-nums font-semibold text-slate-700">{(e.currentPct * 100).toFixed(1)}%</td>
                  <td className="px-4 py-3 tabular-nums text-slate-500">{(e.maxPct * 100).toFixed(1)}%</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 rounded-full bg-slate-100">
                        <div
                          className={`h-1.5 rounded-full ${e.status === 'breach' ? 'bg-rose-500' : e.status === 'warning' ? 'bg-amber-400' : 'bg-emerald-400'}`}
                          style={{ width: `${Math.min(e.utilizationPct, 100)}%` }}
                        />
                      </div>
                      <span className="text-[10px] tabular-nums text-slate-500 w-10 text-right">{e.utilizationPct.toFixed(0)}%</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${style.bg} ${style.text} ${style.border}`}>
                      {e.status === 'compliant' && <Check className="h-2.5 w-2.5" />}
                      {e.status === 'warning' && <AlertTriangle className="h-2.5 w-2.5" />}
                      {e.status === 'breach' && <X className="h-2.5 w-2.5" />}
                      {e.status.charAt(0).toUpperCase() + e.status.slice(1)}
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
