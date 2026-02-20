'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { apiClient } from '@/lib/api';
import { analytics, EVENTS } from '@/lib/analytics';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { ArrowLeft, RefreshCw, Shield, AlertTriangle, CheckCircle } from 'lucide-react';
import RiskBadge from '@/components/alm/RiskBadge';
import {
  PieChart,
  Pie,
  Cell,
  RadialBarChart,
  RadialBar,
  ResponsiveContainer,
  PolarAngleAxis,
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  ReferenceLine,
} from 'recharts';

interface LiquidityPosition {
  lcr: number;
  hqla: number;
  netOutflows: number;
  status: 'compliant' | 'warning' | 'breach';
  buffer: number;
}

function LoadingSkeleton() {
  return (
    <div className="min-h-screen bg-slate-950 p-6 animate-pulse">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="h-8 bg-slate-800 rounded w-64" />
        <div className="grid grid-cols-3 gap-4">
          <div className="h-80 bg-slate-800/50 rounded-xl" />
          <div className="h-80 bg-slate-800/50 rounded-xl" />
          <div className="h-80 bg-slate-800/50 rounded-xl" />
        </div>
      </div>
    </div>
  );
}

function LCRGauge({ lcr }: { lcr: number }) {
  const cappedLcr = Math.min(lcr, 200);
  const color = lcr >= 100 ? '#22c55e' : lcr >= 90 ? '#eab308' : '#ef4444';
  const data = [{ value: cappedLcr, fill: color }];

  return (
    <div className="flex flex-col items-center">
      <div style={{ width: 240, height: 240 }} className="relative">
        <ResponsiveContainer width="100%" height="100%">
          <RadialBarChart
            cx="50%"
            cy="50%"
            innerRadius="70%"
            outerRadius="100%"
            barSize={16}
            data={data}
            startAngle={180}
            endAngle={0}
          >
            <PolarAngleAxis type="number" domain={[0, 200]} angleAxisId={0} tick={false} />
            <RadialBar
              background={{ fill: 'rgba(255,255,255,0.05)' }}
              dataKey="value"
              cornerRadius={8}
              angleAxisId={0}
            />
          </RadialBarChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex flex-col items-center justify-center" style={{ paddingTop: 20 }}>
          <span className="text-4xl font-bold text-white">{lcr.toFixed(1)}%</span>
          <span className="text-xs text-slate-400 mt-1">LCR</span>
        </div>
      </div>
      <span className="text-sm font-medium mt-1" style={{ color }}>
        {lcr >= 100 ? 'Compliant' : lcr >= 90 ? 'Warning' : 'Below Minimum'}
      </span>
    </div>
  );
}

function HQLAComposition({ hqla, netOutflows }: { hqla: number; netOutflows: number }) {
  // Simulated HQLA breakdown (Level 1 ~70%, Level 2A ~20%, Level 2B ~10%)
  const level1 = hqla * 0.70;
  const level2a = hqla * 0.20;
  const level2b = hqla * 0.10;

  const data = [
    { name: 'Level 1 (Cash, Govt Bonds)', value: Math.round(level1 * 100) / 100, color: '#22c55e' },
    { name: 'Level 2A (Agency MBS, Corp Bonds)', value: Math.round(level2a * 100) / 100, color: '#3b82f6' },
    { name: 'Level 2B (Lower-rated Corp)', value: Math.round(level2b * 100) / 100, color: '#8b5cf6' },
  ];

  return (
    <div>
      <h3 className="text-sm font-medium text-slate-300 mb-3">HQLA Composition</h3>
      <div className="flex items-center gap-6">
        <ResponsiveContainer width={180} height={180}>
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={50}
              outerRadius={80}
              paddingAngle={3}
              dataKey="value"
            >
              {data.map((entry, index) => (
                <Cell key={index} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                backgroundColor: '#1e293b',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 8,
                color: '#f1f5f9',
              }}
              formatter={(value: number | undefined) => [`$${(value ?? 0).toFixed(1)}M`, '']}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="space-y-3">
          {data.map((item, i) => (
            <div key={i} className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
              <div>
                <p className="text-sm text-white">${item.value.toFixed(1)}M</p>
                <p className="text-xs text-slate-400">{item.name}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="mt-4 pt-4 border-t border-white/10 flex justify-between text-sm">
        <span className="text-slate-400">Total HQLA</span>
        <span className="text-white font-medium">${hqla.toFixed(1)}M</span>
      </div>
      <div className="flex justify-between text-sm mt-1">
        <span className="text-slate-400">Net Outflows (30-day)</span>
        <span className="text-white font-medium">${netOutflows.toFixed(1)}M</span>
      </div>
    </div>
  );
}

function CashFlowWaterfall({ hqla, netOutflows }: { hqla: number; netOutflows: number }) {
  // Simulate 30-day cash flow waterfall
  const weeks = [
    { name: 'Week 1', inflow: hqla * 0.08, outflow: -netOutflows * 0.30 },
    { name: 'Week 2', inflow: hqla * 0.06, outflow: -netOutflows * 0.25 },
    { name: 'Week 3', inflow: hqla * 0.05, outflow: -netOutflows * 0.25 },
    { name: 'Week 4', inflow: hqla * 0.04, outflow: -netOutflows * 0.20 },
  ];

  const data = weeks.map((w) => ({
    name: w.name,
    net: Math.round((w.inflow + w.outflow) * 100) / 100,
    inflow: Math.round(w.inflow * 100) / 100,
    outflow: Math.round(w.outflow * 100) / 100,
  }));

  return (
    <div>
      <h3 className="text-sm font-medium text-slate-300 mb-3">30-Day Cash Flow Projection</h3>
      <ResponsiveContainer width="100%" height={250}>
        <BarChart data={data} margin={{ top: 10, right: 10, left: 10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
          <XAxis
            dataKey="name"
            tick={{ fill: '#94a3b8', fontSize: 12 }}
            axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
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
            formatter={(value: number | undefined, name: string | undefined) => [`$${(value ?? 0).toFixed(1)}M`, (name === 'inflow' ? 'Inflows' : name === 'outflow' ? 'Outflows' : 'Net')]}
          />
          <ReferenceLine y={0} stroke="rgba(255,255,255,0.2)" />
          <Bar dataKey="inflow" fill="#22c55e" fillOpacity={0.7} radius={[4, 4, 0, 0]} name="inflow" />
          <Bar dataKey="outflow" fill="#ef4444" fillOpacity={0.7} radius={[4, 4, 0, 0]} name="outflow" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export default function LiquidityPage() {
  return (
    <Suspense fallback={<LoadingSkeleton />}>
      <LiquidityContent />
    </Suspense>
  );
}

function LiquidityContent() {
  const searchParams = useSearchParams();
  const institutionId = searchParams.get('id') || '';
  const [liquidity, setLiquidity] = useState<LiquidityPosition | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!institutionId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await apiClient.getLiquidityPosition(institutionId);
      setLiquidity(data);
      analytics.track(EVENTS.ALM_ANALYSIS_RUN, {
        institutionId,
        view: 'liquidity',
        lcr: data.lcr,
        status: data.status,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load liquidity data';
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
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950/20 text-white">
      {/* Header */}
      <div className="border-b border-white/10 bg-slate-900/80 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href={`/alm`} className="text-slate-400 hover:text-white transition">
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <div>
              <h1 className="text-xl font-bold flex items-center gap-2">
                <Shield className="h-5 w-5 text-emerald-400" />
                Liquidity Analysis
              </h1>
              <p className="text-sm text-slate-400">LCR, HQLA & Cash Flow Projections</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {liquidity && <RiskBadge status={liquidity.status} />}
            <button
              onClick={fetchData}
              disabled={loading}
              className="flex items-center gap-2 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 px-4 py-2 rounded-lg transition disabled:opacity-50"
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

      {liquidity && (
        <div className="max-w-7xl mx-auto px-6 py-6 space-y-6">
          {/* Basel III Compliance Banner */}
          <div className={`rounded-xl border p-4 flex items-center gap-4 ${
            liquidity.status === 'compliant'
              ? 'bg-emerald-500/10 border-emerald-500/30'
              : liquidity.status === 'warning'
              ? 'bg-amber-500/10 border-amber-500/30'
              : 'bg-red-500/10 border-red-500/30'
          }`}>
            {liquidity.status === 'compliant' ? (
              <CheckCircle className="h-6 w-6 text-emerald-400 shrink-0" />
            ) : (
              <AlertTriangle className={`h-6 w-6 shrink-0 ${liquidity.status === 'warning' ? 'text-amber-400' : 'text-red-400'}`} />
            )}
            <div>
              <p className={`font-medium ${
                liquidity.status === 'compliant' ? 'text-emerald-300' : liquidity.status === 'warning' ? 'text-amber-300' : 'text-red-300'
              }`}>
                Basel III LCR: {liquidity.status === 'compliant' ? 'Compliant' : liquidity.status === 'warning' ? 'Warning — Near Threshold' : 'BREACH — Below Minimum'}
              </p>
              <p className="text-sm text-slate-400 mt-0.5">
                LCR at {liquidity.lcr.toFixed(1)}% (minimum: 100%) &middot; Buffer: {liquidity.buffer > 0 ? '+' : ''}{liquidity.buffer.toFixed(1)}%
              </p>
            </div>
          </div>

          {/* Main Grid: LCR Gauge + HQLA + KPIs */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* LCR Gauge */}
            <div className="bg-slate-900/60 border border-white/10 rounded-xl p-6 flex flex-col items-center justify-center">
              <LCRGauge lcr={liquidity.lcr} />
            </div>

            {/* HQLA Composition */}
            <div className="bg-slate-900/60 border border-white/10 rounded-xl p-6">
              <HQLAComposition hqla={liquidity.hqla} netOutflows={liquidity.netOutflows} />
            </div>

            {/* Key Metrics */}
            <div className="bg-slate-900/60 border border-white/10 rounded-xl p-6 space-y-4">
              <h3 className="text-sm font-medium text-slate-300">Liquidity Metrics</h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-slate-400">LCR Ratio</span>
                  <span className="text-lg font-bold text-white">{liquidity.lcr.toFixed(1)}%</span>
                </div>
                <div className="w-full bg-slate-700 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full transition-all ${
                      liquidity.lcr >= 100 ? 'bg-emerald-500' : liquidity.lcr >= 90 ? 'bg-amber-500' : 'bg-red-500'
                    }`}
                    style={{ width: `${Math.min(liquidity.lcr, 200) / 2}%` }}
                  />
                </div>
                <div className="flex justify-between text-xs text-slate-500">
                  <span>0%</span>
                  <span className="text-amber-400">100% min</span>
                  <span>200%</span>
                </div>

                <div className="pt-3 border-t border-white/10 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-400">Total HQLA</span>
                    <span className="text-white">${liquidity.hqla.toFixed(1)}M</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-400">Net Cash Outflows</span>
                    <span className="text-white">${liquidity.netOutflows.toFixed(1)}M</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-400">Buffer over Min</span>
                    <span className={`font-medium ${liquidity.buffer >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {liquidity.buffer > 0 ? '+' : ''}{liquidity.buffer.toFixed(1)}%
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-400">Status</span>
                    <RiskBadge status={liquidity.status} size="sm" />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Cash Flow Waterfall */}
          <div className="bg-slate-900/60 border border-white/10 rounded-xl p-6">
            <CashFlowWaterfall hqla={liquidity.hqla} netOutflows={liquidity.netOutflows} />
          </div>

          {/* Regulatory Note */}
          <div className="bg-slate-900/60 border border-white/10 rounded-xl p-6">
            <h3 className="text-sm font-medium text-slate-400 uppercase tracking-wider mb-3">Basel III LCR Requirements</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-slate-300">
              <div>
                <p className="font-medium text-white mb-1">Minimum Requirement</p>
                <p>Banks must maintain a minimum LCR of 100%, meaning HQLA must equal or exceed total net cash outflows over a 30-day stress scenario.</p>
              </div>
              <div>
                <p className="font-medium text-white mb-1">HQLA Eligibility</p>
                <p>Level 1: Cash, central bank reserves, govt bonds (no haircut). Level 2A: Agency MBS, high-grade corporates (15% haircut). Level 2B: Lower-rated corporates, equities (50% haircut).</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
