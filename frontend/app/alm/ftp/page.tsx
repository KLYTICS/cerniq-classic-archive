'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '@/lib/api';
import { useALM } from '@/components/alm/ALMProvider';
import { useTranslation } from '@/lib/i18n';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  Cell, ReferenceLine,
} from 'recharts';
import { DollarSign, AlertTriangle, RefreshCw } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────

interface FTPSegment {
  segment: string;
  category: 'asset' | 'liability';
  totalBalance: number;
  weightedActualRate: number;
  weightedFTPRate: number;
  weightedSpread: number;
  totalContribution: number;
  instrumentCount: number;
}

interface FTPAnalysis {
  instruments: Array<{
    name: string;
    category: string;
    subcategory: string;
    balance: number;
    actualRate: number;
    ftpRate: number;
    spread: number;
    spreadBps: number;
    contribution: number;
  }>;
  segments: FTPSegment[];
  summary: {
    totalAssetContribution: number;
    totalLiabilityContribution: number;
    netFTPMargin: number;
    netFTPMarginPct: number;
    totalAssets: number;
    totalLiabilities: number;
    weightedAssetSpread: number;
    weightedLiabilitySpread: number;
  };
  curveUsed: string;
  asOfDate: string;
}

// ─── Main Page ────────────────────────────────────────────────

export default function FTPPage() {
  const { selectedId } = useALM();
  const { locale } = useTranslation();

  const [analysis, setAnalysis] = useState<FTPAnalysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [spreadAdj, setSpreadAdj] = useState(0);
  const [isDemo, setIsDemo] = useState(false);

  const loadData = useCallback(async () => {
    if (!selectedId) return;
    setLoading(true);
    try {
      const data = await apiClient.getFTPAnalysis(selectedId);
      setAnalysis(data);
      setIsDemo(false);
    } catch {
      setAnalysis(getDemoFTP());
      setIsDemo(true);
    } finally {
      setLoading(false);
    }
  }, [selectedId]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleSpreadAdjust = useCallback(async () => {
    if (!selectedId || spreadAdj === 0) return;
    setLoading(true);
    try {
      const data = await apiClient.runCustomFTP(selectedId, { spreadAdjBps: spreadAdj });
      setAnalysis(data);
    } catch { /* keep existing */ } finally {
      setLoading(false);
    }
  }, [selectedId, spreadAdj]);

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

  const waterfallData = analysis.segments.map((seg) => ({
    name: seg.segment.replace(/_/g, ' '),
    contribution: +seg.totalContribution.toFixed(3),
    category: seg.category,
  }));

  return (
    <div className="p-6 space-y-5 max-w-[1400px] mx-auto">
      {isDemo && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 mb-4">
          <strong>Sample data</strong> — Connect your institution for live analysis.
        </div>
      )}
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-amber-200 bg-amber-50">
            <DollarSign className="h-4 w-4 text-amber-700" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-950">
              {locale === 'es' ? 'Precios de Transferencia de Fondos (FTP)' : 'Funds Transfer Pricing (FTP)'}
            </h1>
            <p className="text-xs text-slate-500">
              {locale === 'es'
                ? `Curva: ${analysis.curveUsed} — Descomposición de rentabilidad por instrumento`
                : `Curve: ${analysis.curveUsed} — Profitability decomposition by instrument`}
            </p>
          </div>
        </div>
      </div>

      {/* Summary KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KPI label={locale === 'es' ? 'Contribución Activos' : 'Asset Contribution'}
             value={`$${analysis.summary.totalAssetContribution.toFixed(2)}M`} positive />
        <KPI label={locale === 'es' ? 'Contribución Pasivos' : 'Liability Contribution'}
             value={`$${analysis.summary.totalLiabilityContribution.toFixed(2)}M`}
             positive={analysis.summary.totalLiabilityContribution >= 0} />
        <KPI label={locale === 'es' ? 'Margen FTP Neto' : 'Net FTP Margin'}
             value={`$${analysis.summary.netFTPMargin.toFixed(2)}M`}
             positive={analysis.summary.netFTPMargin > 0} accent />
        <KPI label={locale === 'es' ? 'Margen FTP (%)' : 'FTP Margin (%)'}
             value={`${(analysis.summary.netFTPMarginPct * 100).toFixed(2)}%`}
             positive={analysis.summary.netFTPMarginPct > 0} />
      </div>

      {/* Spread Adjustment */}
      <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4">
        <p className="text-xs font-medium text-slate-600 shrink-0">
          {locale === 'es' ? 'Ajuste de Spread (bps):' : 'Spread Adjustment (bps):'}
        </p>
        <input
          type="range"
          min={-100}
          max={100}
          step={5}
          value={spreadAdj}
          onChange={(e) => setSpreadAdj(+e.target.value)}
          className="flex-1 h-2 rounded-full appearance-none cursor-pointer accent-amber-500"
        />
        <span className="text-sm font-bold tabular-nums text-amber-600 w-16 text-right">
          {spreadAdj >= 0 ? '+' : ''}{spreadAdj}bps
        </span>
        <button
          onClick={handleSpreadAdjust}
          disabled={spreadAdj === 0}
          className="rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-amber-600 disabled:opacity-40"
        >
          <RefreshCw className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Waterfall Chart */}
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-4">
          {locale === 'es' ? 'Contribución FTP por Segmento' : 'FTP Contribution by Segment'}
        </p>
        <ResponsiveContainer width="100%" height={350}>
          <BarChart data={waterfallData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-20} textAnchor="end" height={60} />
            <YAxis tickFormatter={(v) => `$${v}M`} tick={{ fontSize: 11 }} />
            <Tooltip
              contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: '12px' }}
              formatter={(value) => [`$${Number(value ?? 0).toFixed(3)}M`, '']}
            />
            <ReferenceLine y={0} stroke="#94a3b8" strokeDasharray="3 3" />
            <Bar dataKey="contribution" name={locale === 'es' ? 'Contribución' : 'Contribution'} radius={[4, 4, 0, 0]}>
              {waterfallData.map((entry, i) => (
                <Cell key={i} fill={entry.contribution >= 0 ? '#10b981' : '#ef4444'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Segment Table */}
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-100">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            {locale === 'es' ? 'Descomposición FTP por Segmento' : 'FTP Decomposition by Segment'}
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-50 bg-slate-50/50">
                {[
                  locale === 'es' ? 'Segmento' : 'Segment',
                  locale === 'es' ? 'Tipo' : 'Type',
                  locale === 'es' ? 'Balance ($M)' : 'Balance ($M)',
                  locale === 'es' ? 'Tasa Actual' : 'Actual Rate',
                  locale === 'es' ? 'Tasa FTP' : 'FTP Rate',
                  locale === 'es' ? 'Spread (bps)' : 'Spread (bps)',
                  locale === 'es' ? 'Contribución ($M)' : 'Contribution ($M)',
                ].map((h) => (
                  <th key={h} className="px-4 py-2.5 text-left text-[11px] font-medium text-slate-500 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {analysis.segments.map((seg) => (
                <tr key={`${seg.category}-${seg.segment}`} className="border-b border-slate-50 last:border-0">
                  <td className="px-4 py-3 font-medium text-slate-700 capitalize">{seg.segment.replace(/_/g, ' ')}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                      seg.category === 'asset' ? 'bg-cyan-50 text-cyan-700' : 'bg-purple-50 text-purple-700'
                    }`}>
                      {seg.category === 'asset' ? (locale === 'es' ? 'Activo' : 'Asset') : (locale === 'es' ? 'Pasivo' : 'Liability')}
                    </span>
                  </td>
                  <td className="px-4 py-3 tabular-nums text-slate-600">{seg.totalBalance.toFixed(1)}</td>
                  <td className="px-4 py-3 tabular-nums text-slate-600">{(seg.weightedActualRate * 100).toFixed(2)}%</td>
                  <td className="px-4 py-3 tabular-nums text-slate-600">{(seg.weightedFTPRate * 100).toFixed(2)}%</td>
                  <td className={`px-4 py-3 tabular-nums font-semibold ${seg.weightedSpread >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                    {(seg.weightedSpread * 10000).toFixed(0)}
                  </td>
                  <td className={`px-4 py-3 tabular-nums font-bold ${seg.totalContribution >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                    {seg.totalContribution >= 0 ? '+' : ''}{seg.totalContribution.toFixed(3)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── Sub-Components ──────────────────────────────────────────

function KPI({ label, value, positive, accent }: { label: string; value: string; positive?: boolean; accent?: boolean }) {
  return (
    <div className={`rounded-xl border p-3 ${accent ? 'border-amber-200 bg-amber-50' : 'border-slate-200 bg-white'}`}>
      <p className="text-[10px] font-medium uppercase tracking-wider text-slate-400">{label}</p>
      <p className={`text-lg font-bold tabular-nums ${
        accent ? 'text-amber-700' : positive ? 'text-emerald-700' : 'text-rose-700'
      }`}>{value}</p>
    </div>
  );
}

// ─── Demo Data ──────────────────────────────────────────────

function getDemoFTP(): FTPAnalysis {
  return {
    instruments: [],
    segments: [
      { segment: 'commercial_re', category: 'asset', totalBalance: 120, weightedActualRate: 0.058, weightedFTPRate: 0.041, weightedSpread: 0.017, totalContribution: 2.04, instrumentCount: 3 },
      { segment: 'residential_mortgage', category: 'asset', totalBalance: 95, weightedActualRate: 0.055, weightedFTPRate: 0.044, weightedSpread: 0.011, totalContribution: 1.045, instrumentCount: 2 },
      { segment: 'consumer_loans', category: 'asset', totalBalance: 85, weightedActualRate: 0.072, weightedFTPRate: 0.042, weightedSpread: 0.030, totalContribution: 2.55, instrumentCount: 4 },
      { segment: 'auto_loans', category: 'asset', totalBalance: 62, weightedActualRate: 0.065, weightedFTPRate: 0.041, weightedSpread: 0.024, totalContribution: 1.488, instrumentCount: 2 },
      { segment: 'securities', category: 'asset', totalBalance: 50, weightedActualRate: 0.042, weightedFTPRate: 0.042, weightedSpread: 0.000, totalContribution: 0.0, instrumentCount: 3 },
      { segment: 'demand_deposits', category: 'liability', totalBalance: 180, weightedActualRate: 0.005, weightedFTPRate: 0.048, weightedSpread: 0.043, totalContribution: 7.74, instrumentCount: 2 },
      { segment: 'savings', category: 'liability', totalBalance: 95, weightedActualRate: 0.015, weightedFTPRate: 0.046, weightedSpread: 0.031, totalContribution: 2.945, instrumentCount: 2 },
      { segment: 'time_deposits', category: 'liability', totalBalance: 75, weightedActualRate: 0.040, weightedFTPRate: 0.042, weightedSpread: 0.002, totalContribution: 0.15, instrumentCount: 3 },
      { segment: 'borrowings', category: 'liability', totalBalance: 35, weightedActualRate: 0.052, weightedFTPRate: 0.042, weightedSpread: -0.010, totalContribution: -0.35, instrumentCount: 1 },
    ],
    summary: {
      totalAssetContribution: 7.123,
      totalLiabilityContribution: 10.485,
      netFTPMargin: 17.608,
      netFTPMarginPct: 0.0427,
      totalAssets: 412,
      totalLiabilities: 385,
      weightedAssetSpread: 0.0173,
      weightedLiabilitySpread: 0.0272,
    },
    curveUsed: 'US Treasury (Default)',
    asOfDate: new Date().toISOString(),
  };
}
