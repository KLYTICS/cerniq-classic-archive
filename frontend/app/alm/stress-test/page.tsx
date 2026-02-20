'use client';

import { useState, useCallback, Suspense } from 'react';
import { apiClient } from '@/lib/api';
import { analytics, EVENTS } from '@/lib/analytics';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { ArrowLeft, RefreshCw, Zap, AlertTriangle, CheckCircle, XCircle, AlertOctagon } from 'lucide-react';
import RiskBadge from '@/components/alm/RiskBadge';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

interface MonteCarloResult {
  paths: number;
  horizon: number;
  ratePaths: number[][];
  niiDistribution: { p5: number; p25: number; median: number; p75: number; p95: number };
  monthlyNIIBands: Array<{ month: number; p5: number; p25: number; median: number; p75: number; p95: number }>;
  worstCaseNII: number;
  expectedNII: number;
  niiAtRisk: number;
}

interface RegulatoryScenario {
  name: string;
  description: string;
  rateShock: number[];
  niImpact: number;
  mveImpact: number;
  lcrImpact: number;
  capitalImpact: number;
  passFailStatus: 'pass' | 'warn' | 'fail';
}

interface StressTestResult {
  monteCarlo: MonteCarloResult;
  regulatory: {
    scenarios: RegulatoryScenario[];
    overallRating: 'resilient' | 'adequate' | 'vulnerable' | 'critical';
  };
}

function LoadingSkeleton() {
  return (
    <div className="min-h-screen bg-slate-950 p-6 animate-pulse">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="h-8 bg-slate-800 rounded w-64" />
        <div className="h-80 bg-slate-800/50 rounded-xl" />
        <div className="grid grid-cols-2 gap-4">
          <div className="h-48 bg-slate-800/50 rounded-xl" />
          <div className="h-48 bg-slate-800/50 rounded-xl" />
        </div>
      </div>
    </div>
  );
}

function StatusIcon({ status }: { status: string }) {
  switch (status) {
    case 'pass':
      return <CheckCircle className="h-5 w-5 text-emerald-400" />;
    case 'warn':
      return <AlertTriangle className="h-5 w-5 text-amber-400" />;
    case 'fail':
      return <XCircle className="h-5 w-5 text-red-400" />;
    default:
      return null;
  }
}

const ratingColors: Record<string, string> = {
  resilient: 'text-emerald-400',
  adequate: 'text-blue-400',
  vulnerable: 'text-amber-400',
  critical: 'text-red-400',
};

const ratingBadge: Record<string, 'low' | 'moderate' | 'high' | 'critical'> = {
  resilient: 'low',
  adequate: 'moderate',
  vulnerable: 'high',
  critical: 'critical',
};

export default function StressTestPage() {
  return (
    <Suspense fallback={<LoadingSkeleton />}>
      <StressTestContent />
    </Suspense>
  );
}

function StressTestContent() {
  const searchParams = useSearchParams();
  const institutionId = searchParams.get('id') || '';
  const [result, setResult] = useState<StressTestResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const runStressTest = useCallback(async () => {
    if (!institutionId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await apiClient.runStressTest(institutionId, {
        paths: 1000,
        horizon: 12,
      });
      setResult(data);
      analytics.track(EVENTS.ALM_STRESS_TEST_RUN, {
        institutionId,
        paths: 1000,
        niiAtRisk: data.monteCarlo.niiAtRisk,
        overallRating: data.regulatory.overallRating,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to run stress test';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [institutionId]);

  if (!institutionId) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-center space-y-4">
          <AlertTriangle className="h-12 w-12 text-amber-400 mx-auto" />
          <p className="text-slate-400">No institution selected.</p>
          <Link href="/alm" className="inline-block bg-amber-500/20 text-amber-300 px-4 py-2 rounded-lg hover:bg-amber-500/30 transition">
            Back to ALM
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-orange-950/20 text-white">
      {/* Header */}
      <div className="border-b border-white/10 bg-slate-900/80 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/alm" className="text-slate-400 hover:text-white transition">
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <div>
              <h1 className="text-xl font-bold flex items-center gap-2">
                <Zap className="h-5 w-5 text-orange-400" />
                Stress Testing
              </h1>
              <p className="text-sm text-slate-400">Monte Carlo Simulation & Regulatory Scenarios</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {result && <RiskBadge status={ratingBadge[result.regulatory.overallRating] || 'moderate'} />}
            <button
              onClick={runStressTest}
              disabled={loading}
              className="flex items-center gap-2 bg-orange-500/20 hover:bg-orange-500/30 text-orange-300 px-4 py-2 rounded-lg transition disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              {loading ? 'Running...' : 'Run Stress Test'}
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="max-w-7xl mx-auto px-6 mt-4">
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3 text-red-300 text-sm">{error}</div>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-6 py-6 space-y-6">
        {/* Pre-run state */}
        {!result && !loading && (
          <div className="flex flex-col items-center justify-center min-h-[50vh] text-center">
            <Zap className="h-16 w-16 text-orange-400 mb-4" />
            <h2 className="text-2xl font-bold text-white mb-2">Interest Rate Stress Testing</h2>
            <p className="text-slate-400 max-w-lg mb-6">
              Run 1,000 Monte Carlo rate paths using a Vasicek model, plus 4 regulatory scenarios
              (Rapid Rise, Gradual Rise, Yield Curve Inversion, Shock Down) to assess your institution&apos;s resilience.
            </p>
            <button
              onClick={runStressTest}
              className="px-6 py-3 bg-orange-500 hover:bg-orange-400 text-slate-900 font-semibold rounded-lg transition"
            >
              Run Stress Test
            </button>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="flex flex-col items-center justify-center min-h-[50vh]">
            <RefreshCw className="h-12 w-12 text-orange-400 animate-spin mb-4" />
            <p className="text-slate-400">Simulating 1,000 rate paths...</p>
          </div>
        )}

        {/* Results */}
        {result && !loading && (
          <>
            {/* NII at Risk Hero */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-gradient-to-br from-orange-500/20 to-red-500/10 border border-orange-500/30 rounded-xl p-6 text-center">
                <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">NII at Risk</p>
                <p className="text-4xl font-bold text-orange-300 mt-2">${result.monteCarlo.niiAtRisk}M</p>
                <p className="text-sm text-slate-400 mt-1">Expected - 5th percentile</p>
              </div>
              <div className="bg-slate-900/60 border border-white/10 rounded-xl p-6 text-center">
                <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Expected NII</p>
                <p className="text-3xl font-bold text-white mt-2">${result.monteCarlo.expectedNII}M</p>
                <p className="text-sm text-slate-400 mt-1">Median across {result.monteCarlo.paths} paths</p>
              </div>
              <div className="bg-slate-900/60 border border-white/10 rounded-xl p-6 text-center">
                <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Regulatory Rating</p>
                <p className={`text-3xl font-bold mt-2 capitalize ${ratingColors[result.regulatory.overallRating]}`}>
                  {result.regulatory.overallRating}
                </p>
                <p className="text-sm text-slate-400 mt-1">
                  {result.regulatory.scenarios.filter((s) => s.passFailStatus === 'pass').length}/4 scenarios pass
                </p>
              </div>
            </div>

            {/* Monte Carlo Fan Chart */}
            <div className="bg-slate-900/60 border border-white/10 rounded-xl p-6">
              <h3 className="text-sm font-medium text-slate-300 mb-4">NII Distribution — 12 Month Projection</h3>
              <ResponsiveContainer width="100%" height={350}>
                <AreaChart data={result.monteCarlo.monthlyNIIBands} margin={{ top: 10, right: 10, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis
                    dataKey="month"
                    tick={{ fill: '#94a3b8', fontSize: 12 }}
                    axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
                    tickFormatter={(m: number) => `M${m}`}
                  />
                  <YAxis
                    tick={{ fill: '#94a3b8', fontSize: 12 }}
                    axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
                    label={{ value: '$ Millions', angle: -90, position: 'insideLeft', fill: '#64748b', fontSize: 11 }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#1e293b',
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: 8,
                      color: '#f1f5f9',
                    }}
                    formatter={(value: number | undefined) => [`$${(value ?? 0).toFixed(2)}M`, '']}
                    labelFormatter={(label) => `Month ${label}`}
                  />
                  <Area type="monotone" dataKey="p95" stackId="1" stroke="none" fill="#22c55e" fillOpacity={0.1} name="95th %ile" />
                  <Area type="monotone" dataKey="p75" stackId="2" stroke="none" fill="#22c55e" fillOpacity={0.15} name="75th %ile" />
                  <Area type="monotone" dataKey="median" stackId="3" stroke="#f59e0b" strokeWidth={2} fill="#f59e0b" fillOpacity={0.1} name="Median" />
                  <Area type="monotone" dataKey="p25" stackId="4" stroke="none" fill="#ef4444" fillOpacity={0.15} name="25th %ile" />
                  <Area type="monotone" dataKey="p5" stackId="5" stroke="none" fill="#ef4444" fillOpacity={0.1} name="5th %ile" />
                </AreaChart>
              </ResponsiveContainer>
              <div className="flex items-center justify-center gap-6 mt-3 text-xs text-slate-400">
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-emerald-500/30" /> 75-95th %ile</span>
                <span className="flex items-center gap-1"><span className="w-3 h-1 rounded bg-amber-500" /> Median</span>
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-red-500/30" /> 5-25th %ile</span>
              </div>
            </div>

            {/* NII Distribution Table */}
            <div className="bg-slate-900/60 border border-white/10 rounded-xl p-6">
              <h3 className="text-sm font-medium text-slate-300 mb-4">NII Distribution Summary</h3>
              <div className="grid grid-cols-5 gap-4">
                {[
                  { label: '5th Percentile', value: result.monteCarlo.niiDistribution.p5, color: 'text-red-400' },
                  { label: '25th Percentile', value: result.monteCarlo.niiDistribution.p25, color: 'text-orange-400' },
                  { label: 'Median', value: result.monteCarlo.niiDistribution.median, color: 'text-amber-400' },
                  { label: '75th Percentile', value: result.monteCarlo.niiDistribution.p75, color: 'text-emerald-400' },
                  { label: '95th Percentile', value: result.monteCarlo.niiDistribution.p95, color: 'text-cyan-400' },
                ].map((item) => (
                  <div key={item.label} className="text-center">
                    <p className="text-xs text-slate-400">{item.label}</p>
                    <p className={`text-xl font-bold mt-1 ${item.color}`}>${item.value}M</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Regulatory Scenario Cards */}
            <div>
              <h3 className="text-sm font-medium text-slate-300 mb-4">Regulatory Stress Scenarios</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {result.regulatory.scenarios.map((scenario) => (
                  <div
                    key={scenario.name}
                    className={`bg-slate-900/60 border rounded-xl p-5 ${
                      scenario.passFailStatus === 'pass'
                        ? 'border-emerald-500/30'
                        : scenario.passFailStatus === 'warn'
                        ? 'border-amber-500/30'
                        : 'border-red-500/30'
                    }`}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <StatusIcon status={scenario.passFailStatus} />
                        <h4 className="font-medium text-white">{scenario.name}</h4>
                      </div>
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                        scenario.passFailStatus === 'pass'
                          ? 'bg-emerald-500/20 text-emerald-300'
                          : scenario.passFailStatus === 'warn'
                          ? 'bg-amber-500/20 text-amber-300'
                          : 'bg-red-500/20 text-red-300'
                      }`}>
                        {scenario.passFailStatus.toUpperCase()}
                      </span>
                    </div>
                    <p className="text-sm text-slate-400 mb-3">{scenario.description}</p>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <span className="text-slate-500">NII Impact</span>
                        <span className={`block font-mono font-medium ${scenario.niImpact >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                          {scenario.niImpact >= 0 ? '+' : ''}${scenario.niImpact}M
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-500">MVE Impact</span>
                        <span className={`block font-mono font-medium ${scenario.mveImpact >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                          {scenario.mveImpact >= 0 ? '+' : ''}${scenario.mveImpact}M
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-500">LCR Under Stress</span>
                        <span className={`block font-mono font-medium ${scenario.lcrImpact >= 100 ? 'text-emerald-400' : 'text-red-400'}`}>
                          {scenario.lcrImpact}%
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-500">Capital Impact</span>
                        <span className={`block font-mono font-medium ${scenario.capitalImpact >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                          {scenario.capitalImpact >= 0 ? '+' : ''}{scenario.capitalImpact}%
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
