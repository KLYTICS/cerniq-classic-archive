'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '@/lib/api';
import { analytics, EVENTS } from '@/lib/analytics';
import { RefreshCw, Shield, AlertTriangle, CheckCircle } from 'lucide-react';
import RiskBadge from '@/components/alm/RiskBadge';
import { useALM } from '@/components/alm/ALMProvider';
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

function LCRGauge({ lcr }: { lcr: number }) {
  const cappedLcr = Math.min(lcr, 200);
  const color = lcr >= 100 ? '#22c55e' : lcr >= 90 ? '#eab308' : '#ef4444';
  const data = [{ value: cappedLcr, fill: color }];

  return (
    <div className="flex flex-col items-center">
      <div style={{ width: 200, height: 200 }} className="relative">
        <ResponsiveContainer width="100%" height="100%">
          <RadialBarChart
            cx="50%"
            cy="50%"
            innerRadius="70%"
            outerRadius="100%"
            barSize={14}
            data={data}
            startAngle={180}
            endAngle={0}
          >
            <PolarAngleAxis type="number" domain={[0, 200]} angleAxisId={0} tick={false} />
            <RadialBar
              background={{ fill: 'rgba(255,255,255,0.03)' }}
              dataKey="value"
              cornerRadius={8}
              angleAxisId={0}
            />
          </RadialBarChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex flex-col items-center justify-center" style={{ paddingTop: 16 }}>
          <span className="text-3xl font-bold text-white tabular-nums">{lcr.toFixed(1)}%</span>
          <span className="text-[10px] text-slate-500 mt-0.5 uppercase tracking-wider">LCR</span>
        </div>
      </div>
      <span className="text-xs font-medium mt-1" style={{ color }}>
        {lcr >= 100 ? 'Compliant' : lcr >= 90 ? 'Warning' : 'Below Minimum'}
      </span>
    </div>
  );
}

function HQLAComposition({ hqla, netOutflows }: { hqla: number; netOutflows: number }) {
  const level1 = hqla * 0.70;
  const level2a = hqla * 0.20;
  const level2b = hqla * 0.10;

  const data = [
    { name: 'Level 1', desc: 'Cash & Govt Bonds', value: Math.round(level1 * 100) / 100, color: '#22c55e' },
    { name: 'Level 2A', desc: 'Agency MBS, Corp', value: Math.round(level2a * 100) / 100, color: '#3b82f6' },
    { name: 'Level 2B', desc: 'Lower-rated Corp', value: Math.round(level2b * 100) / 100, color: '#8b5cf6' },
  ];

  return (
    <div>
      <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-4">HQLA Composition</h3>
      <div className="flex items-center gap-6">
        <ResponsiveContainer width={160} height={160}>
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={45}
              outerRadius={72}
              paddingAngle={3}
              dataKey="value"
            >
              {data.map((entry, index) => (
                <Cell key={index} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                backgroundColor: '#0f172a',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 8,
                color: '#f1f5f9',
                fontSize: 12,
              }}
              formatter={(value: number | undefined) => [`$${(value ?? 0).toFixed(1)}M`, '']}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="space-y-3 flex-1">
          {data.map((item, i) => (
            <div key={i} className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: item.color }} />
                <div>
                  <p className="text-xs text-white font-medium">{item.name}</p>
                  <p className="text-[10px] text-slate-500">{item.desc}</p>
                </div>
              </div>
              <span className="text-xs text-slate-300 font-mono tabular-nums">${item.value.toFixed(1)}M</span>
            </div>
          ))}
        </div>
      </div>
      <div className="mt-4 pt-3 border-t border-white/[0.06] space-y-1.5">
        <div className="flex justify-between text-[11px]">
          <span className="text-slate-500">Total HQLA</span>
          <span className="text-white font-medium tabular-nums">${hqla.toFixed(1)}M</span>
        </div>
        <div className="flex justify-between text-[11px]">
          <span className="text-slate-500">Net Outflows (30-day)</span>
          <span className="text-white font-medium tabular-nums">${netOutflows.toFixed(1)}M</span>
        </div>
      </div>
    </div>
  );
}

function CashFlowWaterfall({ hqla, netOutflows }: { hqla: number; netOutflows: number }) {
  const weeks = [
    { name: 'Week 1', inflow: hqla * 0.08, outflow: -netOutflows * 0.30 },
    { name: 'Week 2', inflow: hqla * 0.06, outflow: -netOutflows * 0.25 },
    { name: 'Week 3', inflow: hqla * 0.05, outflow: -netOutflows * 0.25 },
    { name: 'Week 4', inflow: hqla * 0.04, outflow: -netOutflows * 0.20 },
  ];

  const data = weeks.map((w) => ({
    name: w.name,
    inflow: Math.round(w.inflow * 100) / 100,
    outflow: Math.round(w.outflow * 100) / 100,
  }));

  return (
    <div>
      <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-4">30-Day Cash Flow Projection</h3>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" />
          <XAxis
            dataKey="name"
            tick={{ fill: '#64748b', fontSize: 11 }}
            axisLine={{ stroke: 'rgba(255,255,255,0.06)' }}
          />
          <YAxis
            tick={{ fill: '#64748b', fontSize: 11 }}
            axisLine={{ stroke: 'rgba(255,255,255,0.06)' }}
            label={{ value: '$ Millions', angle: -90, position: 'insideLeft', fill: '#475569', fontSize: 10 }}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: '#0f172a',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 8,
              color: '#f1f5f9',
              fontSize: 12,
            }}
            formatter={(value: number | undefined, name: string | undefined) => [
              `$${(value ?? 0).toFixed(1)}M`,
              name === 'inflow' ? 'Inflows' : 'Outflows',
            ]}
          />
          <ReferenceLine y={0} stroke="rgba(255,255,255,0.1)" />
          <Bar dataKey="inflow" fill="#22c55e" fillOpacity={0.6} radius={[3, 3, 0, 0]} name="inflow" />
          <Bar dataKey="outflow" fill="#ef4444" fillOpacity={0.6} radius={[3, 3, 0, 0]} name="outflow" />
        </BarChart>
      </ResponsiveContainer>
      <div className="flex items-center justify-center gap-4 mt-2 text-[10px] text-slate-500">
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-emerald-500/60" /> Inflows</span>
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-red-500/60" /> Outflows</span>
      </div>
    </div>
  );
}

function SkeletonPulse() {
  return (
    <div className="p-6 space-y-5 animate-pulse">
      <div className="h-6 bg-slate-800 rounded w-48" />
      <div className="h-16 bg-slate-900/40 rounded-xl border border-white/[0.06]" />
      <div className="grid grid-cols-3 gap-4">
        <div className="h-72 bg-slate-900/40 rounded-xl border border-white/[0.06]" />
        <div className="h-72 bg-slate-900/40 rounded-xl border border-white/[0.06]" />
        <div className="h-72 bg-slate-900/40 rounded-xl border border-white/[0.06]" />
      </div>
    </div>
  );
}

export default function LiquidityPage() {
  const { selectedId } = useALM();
  const [liquidity, setLiquidity] = useState<LiquidityPosition | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!selectedId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await apiClient.getLiquidityPosition(selectedId);
      setLiquidity(data);
      analytics.track(EVENTS.ALM_ANALYSIS_RUN, {
        institutionId: selectedId,
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
  }, [selectedId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (!selectedId) {
    return (
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="text-center space-y-4">
          <AlertTriangle className="h-12 w-12 text-amber-400 mx-auto" />
          <p className="text-slate-400 text-sm">No institution selected.</p>
        </div>
      </div>
    );
  }

  if (loading) return <SkeletonPulse />;

  return (
    <div className="p-6 space-y-5 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
            <Shield className="h-4 w-4 text-emerald-400" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-white">Liquidity Analysis</h1>
            <p className="text-xs text-slate-500">LCR, HQLA & Cash Flow Projections</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {liquidity && <RiskBadge status={liquidity.status} size="sm" />}
          <button
            onClick={fetchData}
            disabled={loading}
            className="flex items-center gap-1.5 bg-white/[0.04] hover:bg-white/[0.07] border border-white/[0.08] text-slate-400 hover:text-white px-3 py-1.5 rounded-lg text-xs transition disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3 text-red-300 text-sm">
          {error}
        </div>
      )}

      {liquidity && (
        <>
          {/* Basel III Compliance Banner */}
          <div className={`rounded-xl border p-3.5 flex items-center gap-3 ${
            liquidity.status === 'compliant'
              ? 'bg-emerald-500/5 border-emerald-500/15'
              : liquidity.status === 'warning'
              ? 'bg-amber-500/5 border-amber-500/15'
              : 'bg-red-500/5 border-red-500/15'
          }`}>
            {liquidity.status === 'compliant' ? (
              <CheckCircle className="h-5 w-5 text-emerald-400 shrink-0" />
            ) : (
              <AlertTriangle className={`h-5 w-5 shrink-0 ${liquidity.status === 'warning' ? 'text-amber-400' : 'text-red-400'}`} />
            )}
            <div>
              <p className={`text-sm font-medium ${
                liquidity.status === 'compliant' ? 'text-emerald-300' : liquidity.status === 'warning' ? 'text-amber-300' : 'text-red-300'
              }`}>
                Basel III LCR: {liquidity.status === 'compliant' ? 'Compliant' : liquidity.status === 'warning' ? 'Warning' : 'BREACH'}
              </p>
              <p className="text-[11px] text-slate-500 mt-0.5">
                LCR at {liquidity.lcr.toFixed(1)}% (min: 100%) &middot; Buffer: {liquidity.buffer > 0 ? '+' : ''}{liquidity.buffer.toFixed(1)}%
              </p>
            </div>
          </div>

          {/* Main Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* LCR Gauge */}
            <div className="bg-slate-900/40 border border-white/[0.06] rounded-xl p-5 flex flex-col items-center justify-center">
              <LCRGauge lcr={liquidity.lcr} />
            </div>

            {/* HQLA */}
            <div className="bg-slate-900/40 border border-white/[0.06] rounded-xl p-5">
              <HQLAComposition hqla={liquidity.hqla} netOutflows={liquidity.netOutflows} />
            </div>

            {/* Key Metrics */}
            <div className="bg-slate-900/40 border border-white/[0.06] rounded-xl p-5">
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-4">Liquidity Metrics</h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-[11px] text-slate-500">LCR Ratio</span>
                  <span className="text-lg font-bold text-white tabular-nums">{liquidity.lcr.toFixed(1)}%</span>
                </div>
                <div className="w-full bg-white/[0.04] rounded-full h-1.5">
                  <div
                    className={`h-1.5 rounded-full transition-all ${
                      liquidity.lcr >= 100 ? 'bg-emerald-500' : liquidity.lcr >= 90 ? 'bg-amber-500' : 'bg-red-500'
                    }`}
                    style={{ width: `${Math.min(liquidity.lcr, 200) / 2}%` }}
                  />
                </div>
                <div className="flex justify-between text-[10px] text-slate-600">
                  <span>0%</span>
                  <span className="text-amber-500/60">100% min</span>
                  <span>200%</span>
                </div>

                <div className="pt-3 border-t border-white/[0.06] space-y-2.5">
                  <div className="flex justify-between text-[11px]">
                    <span className="text-slate-500">Total HQLA</span>
                    <span className="text-white font-medium tabular-nums">${liquidity.hqla.toFixed(1)}M</span>
                  </div>
                  <div className="flex justify-between text-[11px]">
                    <span className="text-slate-500">Net Cash Outflows</span>
                    <span className="text-white font-medium tabular-nums">${liquidity.netOutflows.toFixed(1)}M</span>
                  </div>
                  <div className="flex justify-between text-[11px]">
                    <span className="text-slate-500">Buffer over Min</span>
                    <span className={`font-medium tabular-nums ${liquidity.buffer >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {liquidity.buffer > 0 ? '+' : ''}{liquidity.buffer.toFixed(1)}%
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-[11px]">
                    <span className="text-slate-500">Status</span>
                    <RiskBadge status={liquidity.status} size="sm" />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Cash Flow Waterfall */}
          <div className="bg-slate-900/40 border border-white/[0.06] rounded-xl p-5">
            <CashFlowWaterfall hqla={liquidity.hqla} netOutflows={liquidity.netOutflows} />
          </div>

          {/* Basel III Info */}
          <div className="bg-slate-900/40 border border-white/[0.06] rounded-xl p-5">
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Basel III LCR Requirements</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-[11px] text-slate-400">
              <div>
                <p className="text-xs font-medium text-slate-300 mb-1">Minimum Requirement</p>
                <p className="leading-relaxed">Banks must maintain a minimum LCR of 100%, meaning HQLA must equal or exceed total net cash outflows over a 30-day stress scenario.</p>
              </div>
              <div>
                <p className="text-xs font-medium text-slate-300 mb-1">HQLA Eligibility</p>
                <p className="leading-relaxed">Level 1: Cash, central bank reserves, govt bonds (no haircut). Level 2A: Agency MBS, high-grade corporates (15%). Level 2B: Lower-rated corporates, equities (50%).</p>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
