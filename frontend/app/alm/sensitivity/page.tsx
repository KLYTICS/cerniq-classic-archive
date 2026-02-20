'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { apiClient } from '@/lib/api';
import { analytics, EVENTS } from '@/lib/analytics';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { ArrowLeft, RefreshCw, TrendingUp, AlertTriangle } from 'lucide-react';
import ScenarioChart from '@/components/alm/ScenarioChart';
import RiskBadge from '@/components/alm/RiskBadge';

interface NIISensitivity {
  scenarios: Array<{
    name: string;
    shiftBps: number;
    niImpact: number;
    niImpactPct: number;
    mveImpact: number;
    mveImpactPct: number;
  }>;
  baseNII: number;
  riskRating: 'low' | 'moderate' | 'high' | 'critical';
}

interface DurationGap {
  assetDuration: number;
  liabilityDuration: number;
  durationGap: number;
  riskProfile: 'asset-sensitive' | 'liability-sensitive' | 'neutral';
}

function LoadingSkeleton() {
  return (
    <div className="min-h-screen bg-slate-950 p-6 animate-pulse">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="h-8 bg-slate-800 rounded w-64" />
        <div className="grid grid-cols-2 gap-4">
          <div className="h-80 bg-slate-800/50 rounded-xl" />
          <div className="h-80 bg-slate-800/50 rounded-xl" />
        </div>
        <div className="h-64 bg-slate-800/50 rounded-xl" />
      </div>
    </div>
  );
}

function generateRiskNarrative(nii: NIISensitivity, dg: DurationGap): string {
  const profile = dg.riskProfile.replace('-', ' ');
  const gap = Math.abs(dg.durationGap);
  const worstScenario = nii.scenarios.reduce((worst, s) =>
    Math.abs(s.niImpact) > Math.abs(worst.niImpact) ? s : worst,
    nii.scenarios[0],
  );

  let narrative = `This institution is ${profile} with a duration gap of ${dg.durationGap > 0 ? '+' : ''}${dg.durationGap} years. `;
  narrative += `Asset-weighted duration is ${dg.assetDuration}yr versus liability duration of ${dg.liabilityDuration}yr. `;

  if (dg.riskProfile === 'asset-sensitive') {
    narrative += `Rising rates would increase NII as assets reprice faster than liabilities, while falling rates pose the primary risk. `;
  } else if (dg.riskProfile === 'liability-sensitive') {
    narrative += `Rising rates would compress NII as liabilities reprice faster than assets. `;
  } else {
    narrative += `The near-zero duration gap provides natural hedging against rate movements. `;
  }

  if (worstScenario) {
    narrative += `Under the worst-case scenario (${worstScenario.name}), NII changes by $${worstScenario.niImpact}M (${worstScenario.niImpactPct}%). `;
    narrative += `Market value of equity impact under this scenario is $${worstScenario.mveImpact}M (${worstScenario.mveImpactPct}%). `;
  }

  if (nii.riskRating === 'critical' || nii.riskRating === 'high') {
    narrative += `Overall interest rate risk is rated ${nii.riskRating.toUpperCase()} — immediate review of hedging strategies is recommended.`;
  } else {
    narrative += `Overall interest rate risk is rated ${nii.riskRating} — within acceptable parameters.`;
  }

  return narrative;
}

export default function SensitivityPage() {
  return (
    <Suspense fallback={<LoadingSkeleton />}>
      <SensitivityContent />
    </Suspense>
  );
}

function SensitivityContent() {
  const searchParams = useSearchParams();
  const institutionId = searchParams.get('id') || '';
  const [nii, setNII] = useState<NIISensitivity | null>(null);
  const [durationGap, setDurationGap] = useState<DurationGap | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!institutionId) return;
    setLoading(true);
    setError(null);
    try {
      const [niiData, dgData] = await Promise.all([
        apiClient.getNIISensitivity(institutionId),
        apiClient.getDurationGap(institutionId),
      ]);
      setNII(niiData);
      setDurationGap(dgData);
      analytics.track(EVENTS.ALM_ANALYSIS_RUN, {
        institutionId,
        view: 'sensitivity',
        riskRating: niiData.riskRating,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load sensitivity data';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [institutionId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (!institutionId) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-center space-y-4">
          <AlertTriangle className="h-12 w-12 text-amber-400 mx-auto" />
          <p className="text-slate-400">No institution selected. Go back to the ALM overview.</p>
          <Link href="/alm" className="inline-block bg-amber-500/20 text-amber-300 px-4 py-2 rounded-lg hover:bg-amber-500/30 transition">
            Back to ALM
          </Link>
        </div>
      </div>
    );
  }

  if (loading) return <LoadingSkeleton />;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950/20 text-white">
      {/* Header */}
      <div className="border-b border-white/10 bg-slate-900/80 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href={`/alm`} className="text-slate-400 hover:text-white transition">
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <div>
              <h1 className="text-xl font-bold flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-blue-400" />
                Rate Sensitivity Analysis
              </h1>
              <p className="text-sm text-slate-400">NII & MVE Impact Scenarios</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {nii && <RiskBadge status={nii.riskRating} />}
            <button
              onClick={fetchData}
              disabled={loading}
              className="flex items-center gap-2 bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 px-4 py-2 rounded-lg transition disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
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

      {nii && durationGap && (
        <div className="max-w-7xl mx-auto px-6 py-6 space-y-6">
          {/* Base NII + Duration Info */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-slate-900/60 border border-white/10 rounded-xl p-5">
              <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Base NII</p>
              <p className="text-2xl font-bold text-white mt-2">${nii.baseNII.toFixed(1)}M</p>
              <p className="text-sm text-slate-300 mt-1">Annual net interest income</p>
            </div>
            <div className="bg-slate-900/60 border border-white/10 rounded-xl p-5">
              <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Asset Duration</p>
              <p className="text-2xl font-bold text-white mt-2">{durationGap.assetDuration}yr</p>
              <p className="text-sm text-slate-300 mt-1">Weighted average</p>
            </div>
            <div className="bg-slate-900/60 border border-white/10 rounded-xl p-5">
              <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Liability Duration</p>
              <p className="text-2xl font-bold text-white mt-2">{durationGap.liabilityDuration}yr</p>
              <p className="text-sm text-slate-300 mt-1">Weighted average</p>
            </div>
            <div className="bg-slate-900/60 border border-white/10 rounded-xl p-5">
              <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Duration Gap</p>
              <p className={`text-2xl font-bold mt-2 ${Math.abs(durationGap.durationGap) < 1 ? 'text-emerald-400' : Math.abs(durationGap.durationGap) < 2 ? 'text-amber-400' : 'text-red-400'}`}>
                {durationGap.durationGap > 0 ? '+' : ''}{durationGap.durationGap}yr
              </p>
              <p className="text-sm text-slate-300 mt-1 capitalize">{durationGap.riskProfile.replace('-', ' ')}</p>
            </div>
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-slate-900/60 border border-white/10 rounded-xl p-6">
              <ScenarioChart
                scenarios={nii.scenarios}
                dataKey="niImpact"
                title="NII Impact by Scenario"
                yAxisLabel="$ Millions"
              />
            </div>
            <div className="bg-slate-900/60 border border-white/10 rounded-xl p-6">
              <ScenarioChart
                scenarios={nii.scenarios}
                dataKey="mveImpact"
                title="MVE Impact by Scenario"
                yAxisLabel="$ Millions"
              />
            </div>
          </div>

          {/* NII Impact Table */}
          <div className="bg-slate-900/60 border border-white/10 rounded-xl p-6">
            <h3 className="text-sm font-medium text-slate-300 mb-4">Scenario Impact Detail</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="text-left py-3 px-4 text-slate-400 font-medium">Scenario</th>
                    <th className="text-left py-3 px-4 text-slate-400 font-medium">Rate Shift</th>
                    <th className="text-right py-3 px-4 text-slate-400 font-medium">NII Impact ($M)</th>
                    <th className="text-right py-3 px-4 text-slate-400 font-medium">NII Impact (%)</th>
                    <th className="text-right py-3 px-4 text-slate-400 font-medium">MVE Impact ($M)</th>
                    <th className="text-right py-3 px-4 text-slate-400 font-medium">MVE Impact (%)</th>
                  </tr>
                </thead>
                <tbody>
                  {[...nii.scenarios].sort((a, b) => a.shiftBps - b.shiftBps).map((s, i) => (
                    <tr key={i} className="border-b border-white/5 hover:bg-white/5 transition">
                      <td className="py-3 px-4 text-white font-medium">{s.name}</td>
                      <td className="py-3 px-4 text-slate-300">{s.shiftBps > 0 ? '+' : ''}{s.shiftBps} bps</td>
                      <td className={`py-3 px-4 text-right font-mono ${s.niImpact >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {s.niImpact >= 0 ? '+' : ''}{s.niImpact.toFixed(2)}
                      </td>
                      <td className={`py-3 px-4 text-right font-mono ${s.niImpactPct >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {s.niImpactPct >= 0 ? '+' : ''}{s.niImpactPct.toFixed(2)}%
                      </td>
                      <td className={`py-3 px-4 text-right font-mono ${s.mveImpact >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {s.mveImpact >= 0 ? '+' : ''}{s.mveImpact.toFixed(2)}
                      </td>
                      <td className={`py-3 px-4 text-right font-mono ${s.mveImpactPct >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {s.mveImpactPct >= 0 ? '+' : ''}{s.mveImpactPct.toFixed(2)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Risk Narrative */}
          <div className="bg-slate-900/60 border border-white/10 rounded-xl p-6">
            <h3 className="text-sm font-medium text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              Risk Assessment Narrative
            </h3>
            <p className="text-slate-200 leading-relaxed">
              {generateRiskNarrative(nii, durationGap)}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
