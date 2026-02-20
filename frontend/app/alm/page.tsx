'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { apiClient } from '@/lib/api';
import { analytics, EVENTS } from '@/lib/analytics';
import Link from 'next/link';
import {
    ArrowLeft,
    RefreshCw,
    Landmark,
    TrendingUp,
    Shield,
    DollarSign,
    FileDown,
    AlertTriangle,
    ChevronDown,
    ChevronUp,
    X,
} from 'lucide-react';
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Cell,
    LineChart,
    Line,
    Area,
    ComposedChart,
    ReferenceLine,
    Legend,
} from 'recharts';

// ─── Types ──────────────────────────────────────────────────

interface Instrument {
    name: string;
    amount: number;
    rate: number;
    maturityYears: number;
    isFloating: boolean;
    repricingFrequencyMonths?: number;
}

interface BalanceSheet {
    assets: Instrument[];
    liabilities: Instrument[];
    equity: number;
}

interface NIIScenario {
    shockBps: number;
    nii: number;
    change: number;
    changePct: number;
    riskLevel: 'low' | 'medium' | 'high' | 'critical';
}

interface EVEScenario {
    shockBps: number;
    eve: number;
    change: number;
    changePct: number;
}

interface BPVInstrument {
    name: string;
    amount: number;
    bpv: number;
    modifiedDuration: number;
}

interface FullAnalysisResult {
    summary: {
        totalAssets: number;
        totalLiabilities: number;
        equity: number;
        timestamp: string;
    };
    durationGap: {
        assetDuration: number;
        liabilityDuration: number;
        durationGap: number;
        leverageAdjustedGap: number;
        totalAssets: number;
        totalLiabilities: number;
        interpretation: string;
        assetDetails: any[];
        liabilityDetails: any[];
    };
    niiSimulation: {
        baseNII: number;
        assetIncome: number;
        liabilityCost: number;
        scenarios: NIIScenario[];
    };
    eve: {
        baseEVE: number;
        scenarios: EVEScenario[];
    };
    bpv: {
        totalAssetBPV: number;
        totalLiabilityBPV: number;
        netBPV: number;
        assetBPVs: BPVInstrument[];
        liabilityBPVs: BPVInstrument[];
        interpretation: string;
    };
    lcr: {
        lcr: number;
        hqlaTotal: number;
        hqlaBreakdown: {
            level1: number;
            level2a: number;
            level2aAdjusted: number;
            level2b: number;
            level2bAdjusted: number;
            level2Cap: number;
            level2Applied: number;
        };
        totalNetOutflows: number;
        threshold: number;
        status: 'compliant' | 'warning' | 'breach';
    } | null;
}

// ─── Formatters ─────────────────────────────────────────────

const fmtM = (v: number) => {
    if (Math.abs(v) >= 1e9) return `$${(v / 1e9).toFixed(2)}B`;
    if (Math.abs(v) >= 1e6) return `$${(v / 1e6).toFixed(2)}M`;
    if (Math.abs(v) >= 1e3) return `$${(v / 1e3).toFixed(1)}K`;
    return `$${v.toFixed(0)}`;
};

const fmtPct = (v: number) => `${(v * 100).toFixed(2)}%`;
const fmtYrs = (v: number) => `${v.toFixed(2)} years`;
const fmtBps = (v: number) => `${v > 0 ? '+' : ''}${v}bp`;

// ─── Risk level colors ─────────────────────────────────────

const riskColor = (level: string) => {
    switch (level) {
        case 'low': return 'bg-green-500/20 text-green-400';
        case 'medium': return 'bg-yellow-500/20 text-yellow-400';
        case 'high': return 'bg-orange-500/20 text-orange-400';
        case 'critical': return 'bg-red-500/20 text-red-400';
        default: return 'bg-slate-500/20 text-slate-400';
    }
};

// ─── Duration gap color ─────────────────────────────────────

const gapAccent = (gap: number) => {
    const abs = Math.abs(gap);
    if (abs < 1) return { border: 'border-green-500/50', text: 'text-green-400', bg: 'from-green-900/20 to-green-800/10' };
    if (abs < 3) return { border: 'border-yellow-500/50', text: 'text-yellow-400', bg: 'from-yellow-900/20 to-yellow-800/10' };
    return { border: 'border-red-500/50', text: 'text-red-400', bg: 'from-red-900/20 to-red-800/10' };
};

// ─── Recharts dark tooltip ──────────────────────────────────

const tooltipStyle = {
    backgroundColor: '#1e293b',
    border: '1px solid #475569',
    borderRadius: '8px',
};

const tooltipLabelStyle = { color: '#f1f5f9' };

// ─── Page Component ─────────────────────────────────────────

export default function AlmPage() {
    const [data, setData] = useState<FullAnalysisResult | null>(null);
    const [balanceSheet, setBalanceSheet] = useState<BalanceSheet | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [mode, setMode] = useState<'demo' | 'custom'>('demo');
    const [editOpen, setEditOpen] = useState(false);
    const [toastMsg, setToastMsg] = useState<string | null>(null);

    const fetchDemoAnalysis = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const result = await apiClient.getAlmDemoAnalysis();
            setData(result);
            const bs = await apiClient.getAlmDemoBalanceSheet();
            setBalanceSheet(bs);
        } catch (err: any) {
            console.error('ALM fetch error:', err);
            setError(err.message || 'Failed to fetch ALM analysis');
        } finally {
            setLoading(false);
        }
    }, []);

    const runCustomAnalysis = useCallback(async () => {
        if (!balanceSheet) return;
        setLoading(true);
        setError(null);
        try {
            const result = await apiClient.postAlmFullAnalysis(balanceSheet);
            setData(result);
            analytics.track(EVENTS.ALM_ANALYSIS_RUN);
        } catch (err: any) {
            console.error('ALM custom analysis error:', err);
            setError(err.message || 'Failed to run custom analysis');
        } finally {
            setLoading(false);
        }
    }, [balanceSheet]);

    useEffect(() => {
        fetchDemoAnalysis();
    }, [fetchDemoAnalysis]);

    const handleRunAnalysis = () => {
        if (mode === 'demo') {
            fetchDemoAnalysis();
        } else {
            runCustomAnalysis();
        }
    };

    const handleModeSwitch = (newMode: 'demo' | 'custom') => {
        setMode(newMode);
        if (newMode === 'demo') {
            fetchDemoAnalysis();
        }
    };

    const handleResetToDemo = async () => {
        setMode('demo');
        const bs = await apiClient.getAlmDemoBalanceSheet();
        setBalanceSheet(bs);
        fetchDemoAnalysis();
        setEditOpen(false);
    };

    const showToast = (msg: string) => {
        setToastMsg(msg);
        setTimeout(() => setToastMsg(null), 3000);
    };

    // ─── Loading skeleton ───────────────────────────────────

    if (loading && !data) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-8">
                <div className="max-w-7xl mx-auto">
                    <div className="animate-pulse space-y-6">
                        <div className="h-10 bg-slate-700 rounded w-1/3"></div>
                        <div className="h-5 bg-slate-700 rounded w-1/2"></div>
                        <div className="grid grid-cols-4 gap-4">
                            {[...Array(4)].map((_, i) => (
                                <div key={i} className="h-32 bg-slate-800 rounded-xl"></div>
                            ))}
                        </div>
                        <div className="grid grid-cols-2 gap-6">
                            <div className="h-80 bg-slate-800 rounded-xl"></div>
                            <div className="h-80 bg-slate-800 rounded-xl"></div>
                        </div>
                        <div className="h-64 bg-slate-800 rounded-xl"></div>
                    </div>
                </div>
            </div>
        );
    }

    // ─── Error state ────────────────────────────────────────

    if (error && !data) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center">
                <div className="text-center max-w-md">
                    <AlertTriangle className="w-16 h-16 text-red-400 mx-auto mb-4" />
                    <h2 className="text-2xl font-bold text-white mb-2">Failed to Load ALM Data</h2>
                    <p className="text-slate-400 mb-6">{error}</p>
                    <button
                        onClick={fetchDemoAnalysis}
                        className="px-6 py-3 bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-400 hover:to-emerald-400 text-white font-semibold rounded-lg transition flex items-center gap-2 mx-auto"
                    >
                        <RefreshCw className="w-4 h-4" />
                        Retry
                    </button>
                </div>
            </div>
        );
    }

    if (!data) return null;

    const gap = data.durationGap;
    const gapStyle = gapAccent(gap.durationGap);

    // ─── NII chart data ─────────────────────────────────────

    const niiChartData = data.niiSimulation.scenarios.map((s) => ({
        scenario: fmtBps(s.shockBps),
        change: s.change / 1e6,
        nii: s.nii / 1e6,
        positive: s.change >= 0,
    }));

    // ─── EVE chart data ─────────────────────────────────────

    const eveChartData = data.eve.scenarios.map((s) => ({
        scenario: fmtBps(s.shockBps),
        eve: s.eve / 1e6,
        shockBps: s.shockBps,
    }));

    // ─── BPV top instruments ────────────────────────────────

    const allBPVInstruments = [
        ...data.bpv.assetBPVs.map((b) => ({ ...b, side: 'Asset' })),
        ...data.bpv.liabilityBPVs.map((b) => ({ ...b, side: 'Liability' })),
    ].sort((a, b) => b.bpv - a.bpv);

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
            {/* Toast */}
            {toastMsg && (
                <div className="fixed top-4 right-4 z-50 bg-slate-800 border border-slate-600 text-white px-6 py-3 rounded-lg shadow-xl flex items-center gap-3 animate-fade-in">
                    <span>{toastMsg}</span>
                    <button onClick={() => setToastMsg(null)} className="text-slate-400 hover:text-white">
                        <X className="w-4 h-4" />
                    </button>
                </div>
            )}

            {/* Header */}
            <div className="border-b border-slate-800 bg-slate-950/50 backdrop-blur-md">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
                    <motion.div
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5 }}
                    >
                        <div className="flex items-center gap-3 mb-4">
                            <Link
                                href="/dashboard"
                                className="text-slate-400 hover:text-white transition flex items-center gap-2"
                            >
                                <ArrowLeft className="w-5 h-5" />
                                Dashboard
                            </Link>
                            <div className="h-5 w-px bg-slate-700"></div>
                            <Landmark className="w-5 h-5 text-teal-400" />
                            <span className="text-slate-400 text-sm">Asset Liability Management</span>
                        </div>

                        <div className="flex items-center justify-between flex-wrap gap-4">
                            <div>
                                <h1 className="text-4xl font-bold text-white mb-1">ALM Dashboard</h1>
                                <p className="text-slate-400">
                                    Duration gap, NII simulation, rate sensitivity, LCR
                                </p>
                            </div>

                            <div className="flex items-center gap-3">
                                {/* Mode toggle */}
                                <div className="flex bg-slate-800 rounded-lg border border-slate-700 p-0.5">
                                    <button
                                        onClick={() => handleModeSwitch('demo')}
                                        className={`px-4 py-2 rounded-md text-sm font-medium transition ${mode === 'demo'
                                            ? 'bg-teal-500/20 text-teal-300 border border-teal-500/30'
                                            : 'text-slate-400 hover:text-white'
                                            }`}
                                    >
                                        Demo Bank ($500M)
                                    </button>
                                    <button
                                        onClick={() => handleModeSwitch('custom')}
                                        className={`px-4 py-2 rounded-md text-sm font-medium transition ${mode === 'custom'
                                            ? 'bg-teal-500/20 text-teal-300 border border-teal-500/30'
                                            : 'text-slate-400 hover:text-white'
                                            }`}
                                    >
                                        Custom
                                    </button>
                                </div>

                                <button
                                    onClick={handleRunAnalysis}
                                    disabled={loading}
                                    className="px-5 py-2.5 bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-400 hover:to-emerald-400 text-white font-semibold rounded-lg transition flex items-center gap-2 disabled:opacity-50"
                                >
                                    <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                                    Run Full Analysis
                                </button>

                                <button
                                    onClick={() => showToast('PDF export coming in Sprint 3')}
                                    className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 border border-slate-600 text-white font-medium rounded-lg transition flex items-center gap-2"
                                >
                                    <FileDown className="w-4 h-4" />
                                    Export PDF
                                </button>
                            </div>
                        </div>
                    </motion.div>
                </div>
            </div>

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
                {/* ─── 1. Summary Cards ──────────────────────────── */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <motion.div
                        className="p-6 bg-gradient-to-br from-blue-900/20 to-blue-800/10 border border-blue-700/30 rounded-xl"
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.1 }}
                    >
                        <div className="flex items-center justify-between mb-3">
                            <DollarSign className="w-8 h-8 text-blue-400" />
                            <span className="text-xs text-blue-400 font-semibold uppercase">Total Assets</span>
                        </div>
                        <div className="text-3xl font-bold text-white mb-1">{fmtM(data.summary.totalAssets)}</div>
                        <div className="text-sm text-slate-400">{data.durationGap.assetDetails.length} instruments</div>
                    </motion.div>

                    <motion.div
                        className="p-6 bg-gradient-to-br from-purple-900/20 to-purple-800/10 border border-purple-700/30 rounded-xl"
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.2 }}
                    >
                        <div className="flex items-center justify-between mb-3">
                            <TrendingUp className="w-8 h-8 text-purple-400" />
                            <span className="text-xs text-purple-400 font-semibold uppercase">Total Liabilities</span>
                        </div>
                        <div className="text-3xl font-bold text-white mb-1">{fmtM(data.summary.totalLiabilities)}</div>
                        <div className="text-sm text-slate-400">{data.durationGap.liabilityDetails.length} instruments</div>
                    </motion.div>

                    <motion.div
                        className="p-6 bg-gradient-to-br from-emerald-900/20 to-emerald-800/10 border border-emerald-700/30 rounded-xl"
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.3 }}
                    >
                        <div className="flex items-center justify-between mb-3">
                            <Shield className="w-8 h-8 text-emerald-400" />
                            <span className="text-xs text-emerald-400 font-semibold uppercase">Equity</span>
                        </div>
                        <div className="text-3xl font-bold text-white mb-1">{fmtM(data.summary.equity)}</div>
                        <div className="text-sm text-slate-400">
                            {((data.summary.equity / data.summary.totalAssets) * 100).toFixed(1)}% capital ratio
                        </div>
                    </motion.div>

                    <motion.div
                        className={`p-6 bg-gradient-to-br ${gapStyle.bg} border ${gapStyle.border} rounded-xl`}
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.4 }}
                    >
                        <div className="flex items-center justify-between mb-3">
                            <Landmark className={`w-8 h-8 ${gapStyle.text}`} />
                            <span className={`text-xs font-semibold uppercase ${gapStyle.text}`}>Duration Gap</span>
                        </div>
                        <div className={`text-3xl font-bold text-white mb-1`}>
                            {gap.durationGap > 0 ? '+' : ''}{fmtYrs(gap.durationGap)}
                        </div>
                        <div className="text-sm text-slate-400">
                            {Math.abs(gap.durationGap) < 1 ? 'Well matched' : gap.durationGap > 0 ? 'Asset-sensitive' : 'Liability-sensitive'}
                        </div>
                    </motion.div>
                </div>

                {/* ─── 2. NII Sensitivity ────────────────────────── */}
                <motion.div
                    className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-xl border border-slate-700 p-6"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.5 }}
                >
                    <h3 className="text-xl font-bold text-white mb-1">NII Sensitivity Analysis</h3>
                    <p className="text-sm text-slate-400 mb-6">
                        Base NII: {fmtM(data.niiSimulation.baseNII)} (Income: {fmtM(data.niiSimulation.assetIncome)} − Cost: {fmtM(data.niiSimulation.liabilityCost)})
                    </p>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* NII Table */}
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-slate-700">
                                        <th className="text-left py-2 text-slate-400">Rate Scenario</th>
                                        <th className="text-right py-2 text-slate-400">NII ($M)</th>
                                        <th className="text-right py-2 text-slate-400">Change ($M)</th>
                                        <th className="text-right py-2 text-slate-400">Change (%)</th>
                                        <th className="text-center py-2 text-slate-400">Risk</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {data.niiSimulation.scenarios.map((s, i) => (
                                        <tr key={i} className="border-b border-slate-800 hover:bg-slate-800/50 transition">
                                            <td className="py-2.5 text-white font-mono font-semibold">{fmtBps(s.shockBps)}</td>
                                            <td className="py-2.5 text-right text-slate-300">{(s.nii / 1e6).toFixed(2)}</td>
                                            <td className={`py-2.5 text-right font-semibold ${s.change >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                                {s.change >= 0 ? '+' : ''}{(s.change / 1e6).toFixed(2)}
                                            </td>
                                            <td className={`py-2.5 text-right ${s.changePct >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                                {fmtPct(s.changePct)}
                                            </td>
                                            <td className="py-2.5 text-center">
                                                <span className={`px-2 py-1 rounded text-xs font-semibold ${riskColor(s.riskLevel)}`}>
                                                    {s.riskLevel}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* NII Bar Chart */}
                        <div className="h-80">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={niiChartData} margin={{ top: 10, right: 10, left: 10, bottom: 5 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                                    <XAxis dataKey="scenario" stroke="#94a3b8" tick={{ fill: '#94a3b8', fontSize: 11 }} />
                                    <YAxis stroke="#94a3b8" tick={{ fill: '#94a3b8', fontSize: 11 }} tickFormatter={(v) => `$${v.toFixed(1)}M`} />
                                    <Tooltip
                                        contentStyle={tooltipStyle}
                                        labelStyle={tooltipLabelStyle}
                                        formatter={(value: any) => [`$${Number(value).toFixed(2)}M`, 'NII Change']}
                                    />
                                    <Bar dataKey="change" name="NII Change ($M)" radius={[4, 4, 0, 0]}>
                                        {niiChartData.map((entry, i) => (
                                            <Cell key={i} fill={entry.positive ? '#10b981' : '#ef4444'} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </motion.div>

                {/* ─── 3. EVE Sensitivity ─────────────────────────── */}
                <motion.div
                    className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-xl border border-slate-700 p-6"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.6 }}
                >
                    <h3 className="text-xl font-bold text-white mb-1">Economic Value of Equity (EVE)</h3>
                    <p className="text-sm text-slate-400 mb-6">Base EVE: {fmtM(data.eve.baseEVE)}</p>

                    <div className="h-80">
                        <ResponsiveContainer width="100%" height="100%">
                            <ComposedChart data={eveChartData} margin={{ top: 10, right: 30, left: 10, bottom: 5 }}>
                                <defs>
                                    <linearGradient id="eveGradient" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                                <XAxis dataKey="scenario" stroke="#94a3b8" tick={{ fill: '#94a3b8', fontSize: 11 }} />
                                <YAxis stroke="#94a3b8" tick={{ fill: '#94a3b8', fontSize: 11 }} tickFormatter={(v) => `$${v.toFixed(0)}M`} />
                                <Tooltip
                                    contentStyle={tooltipStyle}
                                    labelStyle={tooltipLabelStyle}
                                    formatter={(value: any) => [`$${Number(value).toFixed(2)}M`, 'EVE']}
                                />
                                <ReferenceLine
                                    y={data.eve.baseEVE / 1e6}
                                    stroke="#fbbf24"
                                    strokeDasharray="5 5"
                                    strokeWidth={2}
                                    label={{
                                        value: `Base: ${fmtM(data.eve.baseEVE)}`,
                                        fill: '#fbbf24',
                                        fontSize: 12,
                                        position: 'right',
                                    }}
                                />
                                <Area
                                    type="monotone"
                                    dataKey="eve"
                                    stroke="none"
                                    fill="url(#eveGradient)"
                                />
                                <Line
                                    type="monotone"
                                    dataKey="eve"
                                    stroke="#8b5cf6"
                                    strokeWidth={3}
                                    dot={{ r: 4, fill: '#8b5cf6', stroke: '#fff', strokeWidth: 2 }}
                                    activeDot={{ r: 8 }}
                                />
                            </ComposedChart>
                        </ResponsiveContainer>
                    </div>
                </motion.div>

                {/* ─── 4. Duration Gap + LCR side by side ────────── */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Duration Gap */}
                    <motion.div
                        className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-xl border border-slate-700 p-6"
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.7 }}
                    >
                        <h3 className="text-xl font-bold text-white mb-1">Duration Gap Analysis</h3>
                        <p className="text-sm text-slate-400 mb-6">Weighted-average Macaulay duration</p>

                        <div className="h-56">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart
                                    data={[
                                        { name: 'Assets', duration: gap.assetDuration, fill: '#3b82f6' },
                                        { name: 'Liabilities (adj)', duration: gap.liabilityDuration * (data.summary.totalLiabilities / data.summary.totalAssets), fill: '#a855f7' },
                                    ]}
                                    margin={{ top: 10, right: 30, left: 10, bottom: 5 }}
                                >
                                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                                    <XAxis dataKey="name" stroke="#94a3b8" tick={{ fill: '#94a3b8', fontSize: 12 }} />
                                    <YAxis stroke="#94a3b8" tick={{ fill: '#94a3b8', fontSize: 12 }} tickFormatter={(v) => `${v.toFixed(1)}yr`} />
                                    <Tooltip
                                        contentStyle={tooltipStyle}
                                        labelStyle={tooltipLabelStyle}
                                        formatter={(value: any) => [`${Number(value).toFixed(2)} years`, 'Duration']}
                                    />
                                    <Bar dataKey="duration" name="Duration (years)" radius={[8, 8, 0, 0]}>
                                        <Cell fill="#3b82f6" />
                                        <Cell fill="#a855f7" />
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>

                        <div className="mt-4 p-4 bg-slate-800/50 rounded-lg border border-slate-700">
                            <div className="grid grid-cols-3 gap-4 text-center text-sm mb-3">
                                <div>
                                    <div className="text-slate-400">Asset Dur.</div>
                                    <div className="text-white font-bold">{fmtYrs(gap.assetDuration)}</div>
                                </div>
                                <div>
                                    <div className="text-slate-400">Liab. Dur.</div>
                                    <div className="text-white font-bold">{fmtYrs(gap.liabilityDuration)}</div>
                                </div>
                                <div>
                                    <div className="text-slate-400">Gap</div>
                                    <div className={`font-bold ${gapStyle.text}`}>
                                        {gap.durationGap > 0 ? '+' : ''}{fmtYrs(gap.durationGap)}
                                    </div>
                                </div>
                            </div>
                            <p className="text-sm text-slate-300">{gap.interpretation}</p>
                        </div>
                    </motion.div>

                    {/* LCR */}
                    <motion.div
                        className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-xl border border-slate-700 p-6"
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.8 }}
                    >
                        <h3 className="text-xl font-bold text-white mb-1">Liquidity Coverage Ratio</h3>
                        <p className="text-sm text-slate-400 mb-6">Basel III minimum: 100%</p>

                        {data.lcr ? (
                            <>
                                {/* LCR Gauge */}
                                <div className="flex flex-col items-center mb-6">
                                    <div className="relative w-40 h-40 flex items-center justify-center">
                                        <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
                                            <circle cx="60" cy="60" r="52" fill="none" stroke="#334155" strokeWidth="10" />
                                            <circle
                                                cx="60" cy="60" r="52" fill="none"
                                                stroke={data.lcr.lcr >= 100 ? '#10b981' : data.lcr.lcr >= 90 ? '#f59e0b' : '#ef4444'}
                                                strokeWidth="10"
                                                strokeDasharray={`${Math.min(data.lcr.lcr / 300, 1) * 327} 327`}
                                                strokeLinecap="round"
                                            />
                                        </svg>
                                        <div className="absolute text-center">
                                            <div className={`text-3xl font-bold ${data.lcr.lcr >= 100 ? 'text-green-400' : data.lcr.lcr >= 90 ? 'text-yellow-400' : 'text-red-400'}`}>
                                                {data.lcr.lcr.toFixed(0)}%
                                            </div>
                                            <div className="text-xs text-slate-400">LCR</div>
                                        </div>
                                    </div>
                                    <span className={`mt-2 px-3 py-1 rounded-full text-xs font-semibold uppercase ${data.lcr.status === 'compliant'
                                        ? 'bg-green-500/20 text-green-400'
                                        : data.lcr.status === 'warning'
                                            ? 'bg-yellow-500/20 text-yellow-400'
                                            : 'bg-red-500/20 text-red-400'
                                        }`}>
                                        {data.lcr.status}
                                    </span>
                                </div>

                                {/* HQLA Breakdown */}
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                        <thead>
                                            <tr className="border-b border-slate-700">
                                                <th className="text-left py-2 text-slate-400">Component</th>
                                                <th className="text-right py-2 text-slate-400">Amount</th>
                                                <th className="text-right py-2 text-slate-400">Adjusted</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            <tr className="border-b border-slate-800">
                                                <td className="py-2 text-white">Level 1 (0% haircut)</td>
                                                <td className="py-2 text-right text-slate-300">{fmtM(data.lcr.hqlaBreakdown.level1)}</td>
                                                <td className="py-2 text-right text-white font-semibold">{fmtM(data.lcr.hqlaBreakdown.level1)}</td>
                                            </tr>
                                            <tr className="border-b border-slate-800">
                                                <td className="py-2 text-white">Level 2A (15% haircut)</td>
                                                <td className="py-2 text-right text-slate-300">{fmtM(data.lcr.hqlaBreakdown.level2a)}</td>
                                                <td className="py-2 text-right text-white font-semibold">{fmtM(data.lcr.hqlaBreakdown.level2aAdjusted)}</td>
                                            </tr>
                                            <tr className="border-b border-slate-800">
                                                <td className="py-2 text-white">Level 2B (25% haircut)</td>
                                                <td className="py-2 text-right text-slate-300">{fmtM(data.lcr.hqlaBreakdown.level2b)}</td>
                                                <td className="py-2 text-right text-white font-semibold">{fmtM(data.lcr.hqlaBreakdown.level2bAdjusted)}</td>
                                            </tr>
                                            <tr className="border-t-2 border-slate-600">
                                                <td className="py-2 text-white font-bold">Total HQLA</td>
                                                <td className="py-2 text-right"></td>
                                                <td className="py-2 text-right text-teal-400 font-bold">{fmtM(data.lcr.hqlaTotal)}</td>
                                            </tr>
                                            <tr className="border-b border-slate-800">
                                                <td className="py-2 text-slate-400">Net Outflows (30d)</td>
                                                <td className="py-2 text-right"></td>
                                                <td className="py-2 text-right text-slate-300">{fmtM(data.lcr.totalNetOutflows)}</td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>
                            </>
                        ) : (
                            <div className="text-center py-10 text-slate-400">
                                No LCR data available
                            </div>
                        )}
                    </motion.div>
                </div>

                {/* ─── 5. Basis Point Value ──────────────────────── */}
                <motion.div
                    className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-xl border border-slate-700 p-6"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.9 }}
                >
                    <h3 className="text-xl font-bold text-white mb-1">Basis Point Value (DV01)</h3>
                    <p className="text-sm text-slate-400 mb-6">Change in market value per 1bp rate move</p>

                    {/* BPV summary cards */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                        <div className="p-4 bg-slate-800/50 rounded-lg border border-slate-700 text-center">
                            <div className="text-xs text-slate-400 mb-1">Asset BPV</div>
                            <div className="text-2xl font-bold text-blue-400">
                                ${data.bpv.totalAssetBPV.toLocaleString()}
                            </div>
                        </div>
                        <div className="p-4 bg-slate-800/50 rounded-lg border border-slate-700 text-center">
                            <div className="text-xs text-slate-400 mb-1">Liability BPV</div>
                            <div className="text-2xl font-bold text-purple-400">
                                ${data.bpv.totalLiabilityBPV.toLocaleString()}
                            </div>
                        </div>
                        <div className="p-4 bg-slate-800/50 rounded-lg border border-slate-700 text-center">
                            <div className="text-xs text-slate-400 mb-1">Net BPV</div>
                            <div className={`text-2xl font-bold ${data.bpv.netBPV > 0 ? 'text-red-400' : 'text-green-400'}`}>
                                ${Math.abs(data.bpv.netBPV).toLocaleString()}
                            </div>
                        </div>
                    </div>

                    {/* Top instruments by BPV */}
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-slate-700">
                                    <th className="text-left py-2 text-slate-400">Instrument</th>
                                    <th className="text-center py-2 text-slate-400">Side</th>
                                    <th className="text-right py-2 text-slate-400">Notional</th>
                                    <th className="text-right py-2 text-slate-400">Mod. Duration</th>
                                    <th className="text-right py-2 text-slate-400">BPV ($)</th>
                                </tr>
                            </thead>
                            <tbody>
                                {allBPVInstruments.map((b, i) => (
                                    <tr key={i} className="border-b border-slate-800 hover:bg-slate-800/50 transition">
                                        <td className="py-2 text-white font-semibold">{b.name}</td>
                                        <td className="py-2 text-center">
                                            <span className={`px-2 py-0.5 rounded text-xs font-medium ${b.side === 'Asset' ? 'bg-blue-500/20 text-blue-400' : 'bg-purple-500/20 text-purple-400'}`}>
                                                {b.side}
                                            </span>
                                        </td>
                                        <td className="py-2 text-right text-slate-300">{fmtM(b.amount)}</td>
                                        <td className="py-2 text-right text-slate-300">{b.modifiedDuration.toFixed(2)}</td>
                                        <td className="py-2 text-right text-white font-bold">${b.bpv.toLocaleString()}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    <div className="mt-4 p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                        <p className="text-sm text-slate-300">{data.bpv.interpretation}</p>
                    </div>
                </motion.div>

                {/* ─── Edit Balance Sheet Modal ──────────────────── */}
                {mode === 'custom' && (
                    <motion.div
                        className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-xl border border-slate-700 p-6"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                    >
                        <div className="flex items-center justify-between mb-4">
                            <div>
                                <h3 className="text-xl font-bold text-white">Edit Balance Sheet</h3>
                                <p className="text-sm text-slate-400">Modify instruments and re-run the analysis</p>
                            </div>
                            <div className="flex gap-2">
                                <button
                                    onClick={handleResetToDemo}
                                    className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white text-sm rounded-lg transition"
                                >
                                    Reset to Demo
                                </button>
                            </div>
                        </div>

                        {balanceSheet && (
                            <div className="space-y-6">
                                <InstrumentEditor
                                    title="Assets"
                                    instruments={balanceSheet.assets}
                                    onChange={(assets) => setBalanceSheet({ ...balanceSheet, assets })}
                                />
                                <InstrumentEditor
                                    title="Liabilities"
                                    instruments={balanceSheet.liabilities}
                                    onChange={(liabilities) => setBalanceSheet({ ...balanceSheet, liabilities })}
                                />
                                <div className="flex items-center gap-4">
                                    <label className="text-sm text-slate-400">Equity ($):</label>
                                    <input
                                        type="number"
                                        value={balanceSheet.equity}
                                        onChange={(e) => setBalanceSheet({ ...balanceSheet, equity: Number(e.target.value) })}
                                        className="px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white w-48 focus:outline-none focus:border-teal-500"
                                    />
                                </div>
                            </div>
                        )}
                    </motion.div>
                )}
            </div>

            <style jsx>{`
                @keyframes fade-in {
                    from { opacity: 0; transform: translateY(-10px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                .animate-fade-in { animation: fade-in 0.3s ease-out; }
            `}</style>
        </div>
    );
}

// ─── Instrument Editor Sub-component ────────────────────────

function InstrumentEditor({
    title,
    instruments,
    onChange,
}: {
    title: string;
    instruments: Instrument[];
    onChange: (instruments: Instrument[]) => void;
}) {
    const [expanded, setExpanded] = useState(false);

    const updateInstrument = (index: number, field: keyof Instrument, value: any) => {
        const updated = [...instruments];
        (updated[index] as any)[field] = value;
        onChange(updated);
    };

    return (
        <div className="border border-slate-700 rounded-lg">
            <button
                onClick={() => setExpanded(!expanded)}
                className="w-full flex items-center justify-between p-4 hover:bg-slate-800/50 transition"
            >
                <span className="text-white font-semibold">{title} ({instruments.length} instruments)</span>
                {expanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
            </button>

            {expanded && (
                <div className="p-4 pt-0 space-y-3">
                    {instruments.map((inst, i) => (
                        <div key={i} className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 p-3 bg-slate-800/50 rounded-lg">
                            <div>
                                <label className="text-xs text-slate-500">Name</label>
                                <input
                                    type="text"
                                    value={inst.name}
                                    onChange={(e) => updateInstrument(i, 'name', e.target.value)}
                                    className="w-full px-2 py-1.5 bg-slate-700 border border-slate-600 rounded text-white text-sm focus:outline-none focus:border-teal-500"
                                />
                            </div>
                            <div>
                                <label className="text-xs text-slate-500">Amount ($)</label>
                                <input
                                    type="number"
                                    value={inst.amount}
                                    onChange={(e) => updateInstrument(i, 'amount', Number(e.target.value))}
                                    className="w-full px-2 py-1.5 bg-slate-700 border border-slate-600 rounded text-white text-sm focus:outline-none focus:border-teal-500"
                                />
                            </div>
                            <div>
                                <label className="text-xs text-slate-500">Rate</label>
                                <input
                                    type="number"
                                    step="0.001"
                                    value={inst.rate}
                                    onChange={(e) => updateInstrument(i, 'rate', Number(e.target.value))}
                                    className="w-full px-2 py-1.5 bg-slate-700 border border-slate-600 rounded text-white text-sm focus:outline-none focus:border-teal-500"
                                />
                            </div>
                            <div>
                                <label className="text-xs text-slate-500">Maturity (yr)</label>
                                <input
                                    type="number"
                                    value={inst.maturityYears}
                                    onChange={(e) => updateInstrument(i, 'maturityYears', Number(e.target.value))}
                                    className="w-full px-2 py-1.5 bg-slate-700 border border-slate-600 rounded text-white text-sm focus:outline-none focus:border-teal-500"
                                />
                            </div>
                            <div>
                                <label className="text-xs text-slate-500">Floating?</label>
                                <select
                                    value={inst.isFloating ? 'true' : 'false'}
                                    onChange={(e) => updateInstrument(i, 'isFloating', e.target.value === 'true')}
                                    className="w-full px-2 py-1.5 bg-slate-700 border border-slate-600 rounded text-white text-sm focus:outline-none focus:border-teal-500"
                                >
                                    <option value="false">Fixed</option>
                                    <option value="true">Floating</option>
                                </select>
                            </div>
                            <div>
                                <label className="text-xs text-slate-500">Reprice (mo)</label>
                                <input
                                    type="number"
                                    value={inst.repricingFrequencyMonths ?? 0}
                                    onChange={(e) => updateInstrument(i, 'repricingFrequencyMonths', Number(e.target.value))}
                                    disabled={!inst.isFloating}
                                    className="w-full px-2 py-1.5 bg-slate-700 border border-slate-600 rounded text-white text-sm focus:outline-none focus:border-teal-500 disabled:opacity-30"
                                />
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
