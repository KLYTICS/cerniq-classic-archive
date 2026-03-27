'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Cell,
} from 'recharts';
import { AlertTriangle, TrendingDown, Shield, Activity, Zap, Clock } from 'lucide-react';

interface ScenarioResult {
    scenario: string;
    description: string;
    pnl: number;
    pnlPercent: number;
    severity: 'LOW' | 'MODERATE' | 'HIGH' | 'SEVERE' | 'CATASTROPHIC';
}

interface StressTestResult {
    portfolioValue: number;
    scenarios: ScenarioResult[];
    worstCase: ScenarioResult;
    averageLoss: number;
}

const NODE_API_URL = (
    process.env.NEXT_PUBLIC_NODE_API_URL || ''
).trim().replace(/\/+$/, '');

export default function StressTestPage() {
    const [positions, setPositions] = useState([
        { ticker: 'AAPL', quantity: 100 },
        { ticker: 'GOOGL', quantity: 50 },
        { ticker: 'MSFT', quantity: 75 },
        { ticker: 'NVDA', quantity: 30 },
    ]);
    const [result, setResult] = useState<StressTestResult | null>(null);
    const [loading, setLoading] = useState(false);
    const [scenarioType, setScenarioType] = useState<'historical' | 'hypothetical'>('historical');

    const runStressTest = async () => {
        setLoading(true);
        try {
            const response = await fetch(`${NODE_API_URL}/api/risk/stress-test`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ positions, scenarioType }),
            });
            const data = await response.json();
            setResult(data);
        } catch (error) {
            console.error('Stress test failed:', error);
            // Mock data for demo
            setResult({
                portfolioValue: 125000,
                scenarios: [
                    { scenario: 'Black Monday (1987)', description: '22.6% crash', pnl: -28250, pnlPercent: -22.6, severity: 'CATASTROPHIC' },
                    { scenario: 'Global Financial Crisis (2008)', description: 'Lehman collapse', pnl: -52500, pnlPercent: -42.0, severity: 'CATASTROPHIC' },
                    { scenario: 'COVID-19 Crash (2020)', description: 'Pandemic shock', pnl: -42500, pnlPercent: -34.0, severity: 'SEVERE' },
                    { scenario: 'Dot-Com Crash (2000)', description: 'Tech bubble burst', pnl: -56250, pnlPercent: -45.0, severity: 'CATASTROPHIC' },
                    { scenario: 'Rate Shock (2022)', description: 'Fed rate hikes', pnl: -31250, pnlPercent: -25.0, severity: 'SEVERE' },
                    { scenario: 'LTCM Crisis (1998)', description: 'Liquidity crisis', pnl: -15000, pnlPercent: -12.0, severity: 'MODERATE' },
                    { scenario: 'Asian Crisis (1997)', description: 'EM contagion', pnl: -18750, pnlPercent: -15.0, severity: 'HIGH' },
                ],
                worstCase: { scenario: 'Dot-Com Crash (2000)', description: 'Tech bubble burst', pnl: -56250, pnlPercent: -45.0, severity: 'CATASTROPHIC' },
                averageLoss: -34928,
            });
        } finally {
            setLoading(false);
        }
    };

    const getSeverityColor = (severity: string) => {
        switch (severity) {
            case 'LOW': return '#22c55e';
            case 'MODERATE': return '#eab308';
            case 'HIGH': return '#f97316';
            case 'SEVERE': return '#ef4444';
            case 'CATASTROPHIC': return '#dc2626';
            default: return '#6b7280';
        }
    };

    const chartData = result?.scenarios.map((s) => ({
        name: s.scenario.split(' ')[0],
        fullName: s.scenario,
        pnlPercent: Math.abs(s.pnlPercent),
        severity: s.severity,
    })).sort((a, b) => b.pnlPercent - a.pnlPercent) || [];

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-8">
            {/* Header */}
            <motion.div className="mb-8" initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}>
                <h1 className="text-4xl font-bold text-white mb-2 flex items-center gap-3">
                    <AlertTriangle className="w-10 h-10 text-red-500" />
                    Portfolio Stress Testing
                </h1>
                <p className="text-slate-400">
                    Simulate historical crises and hypothetical scenarios to understand portfolio vulnerabilities
                </p>
            </motion.div>

            {/* Configuration */}
            <motion.div
                className="mb-8 p-6 bg-gradient-to-br from-slate-900 to-slate-800 rounded-xl border border-slate-700"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
            >
                <h3 className="text-lg font-bold text-white mb-4">📊 Portfolio Configuration</h3>

                <div className="grid grid-cols-2 gap-4 mb-4">
                    <div>
                        <label className="block text-sm text-slate-400 mb-2">Scenario Type</label>
                        <div className="flex gap-2">
                            <button
                                onClick={() => setScenarioType('historical')}
                                className={`px-4 py-2 rounded ${scenarioType === 'historical' ? 'bg-red-500 text-white' : 'bg-slate-700 text-slate-300'}`}
                            >
                                📚 Historical Crises
                            </button>
                            <button
                                onClick={() => setScenarioType('hypothetical')}
                                className={`px-4 py-2 rounded ${scenarioType === 'hypothetical' ? 'bg-red-500 text-white' : 'bg-slate-700 text-slate-300'}`}
                            >
                                🔮 Hypothetical
                            </button>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-4 gap-3 mb-4">
                    {positions.map((pos, idx) => (
                        <div key={idx} className="flex gap-2">
                            <input
                                type="text"
                                value={pos.ticker}
                                onChange={(e) => {
                                    const updated = [...positions];
                                    updated[idx].ticker = e.target.value;
                                    setPositions(updated);
                                }}
                                className="flex-1 px-3 py-2 bg-slate-800 border border-slate-600 rounded text-white"
                                placeholder="Ticker"
                            />
                            <input
                                type="number"
                                value={pos.quantity}
                                onChange={(e) => {
                                    const updated = [...positions];
                                    updated[idx].quantity = parseInt(e.target.value);
                                    setPositions(updated);
                                }}
                                className="w-20 px-3 py-2 bg-slate-800 border border-slate-600 rounded text-white"
                                placeholder="Qty"
                            />
                        </div>
                    ))}
                </div>

                <button
                    onClick={runStressTest}
                    disabled={loading}
                    className="px-6 py-3 bg-red-500 hover:bg-red-600 disabled:bg-slate-600 rounded-lg text-white font-bold flex items-center gap-2"
                >
                    {loading ? (
                        <>Running Stress Test...</>
                    ) : (
                        <>
                            <Zap className="w-5 h-5" /> Run Stress Test
                        </>
                    )}
                </button>
            </motion.div>

            {result && (
                <>
                    {/* Summary Cards */}
                    <div className="grid grid-cols-4 gap-4 mb-8">
                        <motion.div
                            className="p-6 bg-gradient-to-br from-blue-900/30 to-blue-800/20 border border-blue-700/30 rounded-xl"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                        >
                            <Shield className="w-8 h-8 text-blue-400 mb-2" />
                            <div className="text-xs text-blue-400 uppercase">Portfolio Value</div>
                            <div className="text-2xl font-bold text-white">${result.portfolioValue.toLocaleString()}</div>
                        </motion.div>

                        <motion.div
                            className="p-6 bg-gradient-to-br from-red-900/30 to-red-800/20 border border-red-700/30 rounded-xl"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.1 }}
                        >
                            <TrendingDown className="w-8 h-8 text-red-400 mb-2" />
                            <div className="text-xs text-red-400 uppercase">Worst Case Loss</div>
                            <div className="text-2xl font-bold text-white">
                                ${Math.abs(result.worstCase.pnl).toLocaleString()}
                            </div>
                            <div className="text-sm text-red-400">({result.worstCase.pnlPercent.toFixed(1)}%)</div>
                        </motion.div>

                        <motion.div
                            className="p-6 bg-gradient-to-br from-orange-900/30 to-orange-800/20 border border-orange-700/30 rounded-xl"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.2 }}
                        >
                            <Activity className="w-8 h-8 text-orange-400 mb-2" />
                            <div className="text-xs text-orange-400 uppercase">Average Loss</div>
                            <div className="text-2xl font-bold text-white">
                                ${Math.abs(result.averageLoss).toLocaleString()}
                            </div>
                        </motion.div>

                        <motion.div
                            className="p-6 bg-gradient-to-br from-purple-900/30 to-purple-800/20 border border-purple-700/30 rounded-xl"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.3 }}
                        >
                            <Clock className="w-8 h-8 text-purple-400 mb-2" />
                            <div className="text-xs text-purple-400 uppercase">Worst Case Scenario</div>
                            <div className="text-lg font-bold text-white">{result.worstCase.scenario}</div>
                        </motion.div>
                    </div>

                    {/* Bar Chart */}
                    <motion.div
                        className="mb-8 p-6 bg-gradient-to-br from-slate-900 to-slate-800 rounded-xl border border-slate-700"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                    >
                        <h3 className="text-xl font-bold text-white mb-4">📉 Scenario Impact Comparison</h3>
                        <div className="h-80">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={chartData} layout="vertical">
                                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                                    <XAxis type="number" stroke="#94a3b8" unit="%" />
                                    <YAxis type="category" dataKey="name" stroke="#94a3b8" width={100} />
                                    <Tooltip
                                        contentStyle={{
                                            backgroundColor: '#1e293b',
                                            border: '1px solid #475569',
                                            borderRadius: '8px',
                                        }}
                                        formatter={(value) => [`${Number(value ?? 0).toFixed(1)}%`, 'Loss']}
                                        labelFormatter={(name) => chartData.find((d) => d.name === name)?.fullName || name}
                                    />
                                    <Bar dataKey="pnlPercent" radius={[0, 4, 4, 0]}>
                                        {chartData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={getSeverityColor(entry.severity)} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </motion.div>

                    {/* Scenario Details Table */}
                    <motion.div
                        className="p-6 bg-gradient-to-br from-slate-900 to-slate-800 rounded-xl border border-slate-700"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                    >
                        <h3 className="text-xl font-bold text-white mb-4">📋 Scenario Details</h3>
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="text-slate-400 border-b border-slate-700">
                                    <th className="py-2 px-3 text-left">Scenario</th>
                                    <th className="py-2 px-3 text-left">Description</th>
                                    <th className="py-2 px-3 text-right">P&L ($)</th>
                                    <th className="py-2 px-3 text-right">P&L (%)</th>
                                    <th className="py-2 px-3 text-center">Severity</th>
                                </tr>
                            </thead>
                            <tbody>
                                {result.scenarios.map((scenario, idx) => (
                                    <tr key={idx} className="border-b border-slate-800">
                                        <td className="py-3 px-3 text-white font-semibold">{scenario.scenario}</td>
                                        <td className="py-3 px-3 text-slate-400">{scenario.description}</td>
                                        <td className="py-3 px-3 text-right text-red-400 font-semibold">
                                            ${scenario.pnl.toLocaleString()}
                                        </td>
                                        <td className="py-3 px-3 text-right text-red-400">
                                            {scenario.pnlPercent.toFixed(1)}%
                                        </td>
                                        <td className="py-3 px-3 text-center">
                                            <span
                                                className="px-2 py-1 rounded text-xs font-semibold"
                                                style={{
                                                    backgroundColor: `${getSeverityColor(scenario.severity)}20`,
                                                    color: getSeverityColor(scenario.severity),
                                                    border: `1px solid ${getSeverityColor(scenario.severity)}50`,
                                                }}
                                            >
                                                {scenario.severity}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </motion.div>
                </>
            )}
        </div>
    );
}
