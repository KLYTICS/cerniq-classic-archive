'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '@/lib/api';
import { analytics, EVENTS } from '@/lib/analytics';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, RefreshCw, Landmark, TrendingUp, Shield, DollarSign, ChevronRight } from 'lucide-react';
import RiskScoreGauge from '@/components/alm/RiskScoreGauge';
import ALMKPICard from '@/components/alm/ALMKPICard';
import RiskBadge from '@/components/alm/RiskBadge';

interface ALMSummary {
  institution: {
    id: string;
    name: string;
    type: string;
    totalAssets: number;
    currency: string;
    reportingDate: string;
  };
  durationGap: {
    assetDuration: number;
    liabilityDuration: number;
    durationGap: number;
    riskProfile: 'asset-sensitive' | 'liability-sensitive' | 'neutral';
  };
  niiSensitivity: {
    scenarios: Array<{
      name: string;
      shiftBps: number;
      niImpact: number;
      niImpactPct: number;
    }>;
    baseNII: number;
    riskRating: 'low' | 'moderate' | 'high' | 'critical';
  };
  liquidity: {
    lcr: number;
    hqla: number;
    netOutflows: number;
    status: 'compliant' | 'warning' | 'breach';
    buffer: number;
  };
  topRisks: string[];
  recommendations: string[];
  riskScore: number;
}

interface Institution {
  id: string;
  name: string;
  type: string;
  totalAssets: number;
}

function LoadingSkeleton() {
  return (
    <div className="min-h-screen bg-slate-950 p-6 animate-pulse">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="h-8 bg-slate-800 rounded w-64" />
        <div className="grid grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-28 bg-slate-800/50 rounded-xl" />
          ))}
        </div>
        <div className="h-64 bg-slate-800/50 rounded-xl" />
      </div>
    </div>
  );
}

export default function ALMOverviewPage() {
  const router = useRouter();
  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [selectedId, setSelectedId] = useState<string>('');
  const [summary, setSummary] = useState<ALMSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchInstitutions = useCallback(async () => {
    try {
      const data = await apiClient.getInstitutions();
      setInstitutions(data);
      if (data.length > 0 && !selectedId) {
        setSelectedId(data[0].id);
      }
    } catch {
      // No institutions yet — show empty state
      setInstitutions([]);
      setLoading(false);
    }
  }, [selectedId]);

  const fetchSummary = useCallback(async (institutionId: string) => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiClient.getALMSummary(institutionId);
      setSummary(data);
      analytics.track(EVENTS.ALM_ANALYSIS_RUN, {
        institutionId,
        riskScore: data.riskScore,
        durationGap: data.durationGap.durationGap,
        lcr: data.liquidity.lcr,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load ALM summary';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchInstitutions();
  }, [fetchInstitutions]);

  useEffect(() => {
    if (selectedId) {
      fetchSummary(selectedId);
    }
  }, [selectedId, fetchSummary]);

  if (loading && !summary) return <LoadingSkeleton />;

  // Empty state — no institutions
  if (!loading && institutions.length === 0) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-center space-y-4">
          <Landmark className="h-16 w-16 text-amber-400 mx-auto" />
          <h2 className="text-2xl font-bold text-white">No Institutions Yet</h2>
          <p className="text-slate-400 max-w-md">
            Create an institution and import your balance sheet to get started with ALM analysis.
          </p>
          <Link
            href="/alm/balance-sheet"
            className="inline-block bg-amber-500 hover:bg-amber-400 text-slate-900 font-semibold px-6 py-3 rounded-lg transition"
          >
            Set Up Balance Sheet
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-amber-950/20 text-white">
      {/* Header */}
      <div className="border-b border-white/10 bg-slate-900/80 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/dashboard" className="text-slate-400 hover:text-white transition">
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <div>
              <h1 className="text-xl font-bold flex items-center gap-2">
                <Landmark className="h-5 w-5 text-amber-400" />
                ALM Intelligence
              </h1>
              <p className="text-sm text-slate-400">Enterprise Risk Overview</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* Institution Selector */}
            {institutions.length > 0 && (
              <select
                value={selectedId}
                onChange={(e) => setSelectedId(e.target.value)}
                className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
              >
                {institutions.map((inst) => (
                  <option key={inst.id} value={inst.id}>
                    {inst.name}
                  </option>
                ))}
              </select>
            )}
            <button
              onClick={() => selectedId && fetchSummary(selectedId)}
              disabled={loading}
              className="flex items-center gap-2 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 px-4 py-2 rounded-lg transition disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Run Analysis
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="max-w-7xl mx-auto px-6 mt-4">
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3 text-red-300 text-sm">
            {error}
          </div>
        </div>
      )}

      {summary && (
        <div className="max-w-7xl mx-auto px-6 py-6 space-y-6">
          {/* Risk Score + Institution Info */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="bg-slate-900/60 border border-white/10 rounded-xl p-6 flex flex-col items-center justify-center">
              <RiskScoreGauge score={summary.riskScore} />
              <p className="text-sm text-slate-400 mt-2">Composite Risk Score</p>
            </div>

            <div className="lg:col-span-2 bg-slate-900/60 border border-white/10 rounded-xl p-6">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h2 className="text-lg font-bold">{summary.institution.name}</h2>
                  <p className="text-sm text-slate-400 capitalize">
                    {summary.institution.type.replace('_', ' ')} &middot; ${summary.institution.totalAssets.toLocaleString()}M assets
                  </p>
                </div>
                <RiskBadge status={summary.niiSensitivity.riskRating} />
              </div>

              {/* Top Risks */}
              <div className="space-y-2">
                <h3 className="text-xs font-medium text-slate-500 uppercase tracking-wider">Top Risks</h3>
                {summary.topRisks.map((risk, i) => (
                  <div key={i} className="flex items-start gap-2 text-sm">
                    <span className="text-amber-400 mt-0.5">&#9679;</span>
                    <span className="text-slate-300">{risk}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* KPI Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <ALMKPICard
              title="Duration Gap"
              value={`${summary.durationGap.durationGap > 0 ? '+' : ''}${summary.durationGap.durationGap}yr`}
              subtitle={summary.durationGap.riskProfile.replace('-', ' ')}
              color={Math.abs(summary.durationGap.durationGap) < 1 ? 'emerald' : Math.abs(summary.durationGap.durationGap) < 2 ? 'amber' : 'red'}
            />
            <ALMKPICard
              title="NII at Risk"
              value={`$${summary.niiSensitivity.baseNII.toFixed(1)}M`}
              subtitle={`Rating: ${summary.niiSensitivity.riskRating}`}
              color={summary.niiSensitivity.riskRating === 'low' ? 'emerald' : summary.niiSensitivity.riskRating === 'moderate' ? 'amber' : 'red'}
            />
            <ALMKPICard
              title="LCR Ratio"
              value={`${summary.liquidity.lcr}%`}
              subtitle={summary.liquidity.status}
              color={summary.liquidity.status === 'compliant' ? 'emerald' : summary.liquidity.status === 'warning' ? 'amber' : 'red'}
            />
            <ALMKPICard
              title="LCR Buffer"
              value={`${summary.liquidity.buffer > 0 ? '+' : ''}${summary.liquidity.buffer}%`}
              subtitle="vs 100% minimum"
              color={summary.liquidity.buffer >= 20 ? 'cyan' : summary.liquidity.buffer >= 0 ? 'amber' : 'red'}
            />
          </div>

          {/* Quick Nav to Sub-Pages */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { href: '/alm/sensitivity', icon: TrendingUp, title: 'Rate Sensitivity', desc: 'NII & MVE impact analysis', color: 'text-blue-400' },
              { href: '/alm/liquidity', icon: Shield, title: 'Liquidity', desc: 'LCR, HQLA & cash flows', color: 'text-emerald-400' },
              { href: '/alm/balance-sheet', icon: DollarSign, title: 'Balance Sheet', desc: 'Assets, liabilities & import', color: 'text-purple-400' },
            ].map((item) => (
              <Link
                key={item.href}
                href={`${item.href}?id=${selectedId}`}
                className="bg-slate-900/60 border border-white/10 rounded-xl p-5 hover:border-white/20 hover:bg-slate-800/60 transition group"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <item.icon className={`h-5 w-5 ${item.color}`} />
                    <div>
                      <p className="font-medium text-white">{item.title}</p>
                      <p className="text-xs text-slate-400">{item.desc}</p>
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-slate-500 group-hover:text-white transition" />
                </div>
              </Link>
            ))}
          </div>

          {/* Recommendations */}
          <div className="bg-slate-900/60 border border-white/10 rounded-xl p-6">
            <h3 className="text-sm font-medium text-slate-400 uppercase tracking-wider mb-3">Recommendations</h3>
            <div className="space-y-2">
              {summary.recommendations.map((rec, i) => (
                <div key={i} className="flex items-start gap-3 text-sm">
                  <span className="text-cyan-400 font-bold mt-0.5">{i + 1}.</span>
                  <span className="text-slate-200">{rec}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
