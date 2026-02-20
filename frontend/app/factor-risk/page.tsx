'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import {
    RadarChart,
    PolarGrid,
    PolarAngleAxis,
    PolarRadiusAxis,
    Radar,
    ResponsiveContainer,
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Cell,
} from 'recharts';
import { Layers, TrendingUp, PieChart, Activity, Info } from 'lucide-react';

interface FactorExposure {
    factor: string;
    exposure: number;
    riskContribution: number;
    description: string;
}

export default function FactorRiskPage() {
    const [positions, setPositions] = useState([
        { ticker: 'AAPL', quantity: 100 },
        { ticker: 'NVDA', quantity: 50 },
        { ticker: 'JPM', quantity: 75 },
        { ticker: 'XOM', quantity: 60 },
    ]);
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<{
        exposures: FactorExposure[];
        totalFactorRisk: number;
        idiosyncraticRisk: number;
        portfolioValue: number;
    } | null>(null);

    const analyzeFactors = async () => {
        setLoading(true);
        try {
            const response = await fetch('http://localhost:3000/api/risk/factor-exposures', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ positions }),
            });
            const data = await response.json();
            setResult(data);
        } catch (error) {
            // Mock data for demo
            setResult({
                portfolioValue: 85000,
                totalFactorRisk: 78.5,
                idiosyncraticRisk: 21.5,
                exposures: [
                    { factor: 'MKT', exposure: 1.15, riskContribution: 62.3, description: 'Market Risk Premium' },
                    { factor: 'SMB', exposure: -0.12, riskContribution: 4.2, description: 'Small Minus Big (Size)' },
                    { factor: 'HML', exposure: 0.08, riskContribution: 5.8, description: 'High Minus Low (Value)' },
                    { factor: 'RMW', exposure: 0.22, riskContribution: 8.5, description: 'Robust Minus Weak (Profitability)' },
                    { factor: 'CMA', exposure: 0.05, riskContribution: 3.2, description: 'Conservative Minus Aggressive' },
                    { factor: 'MOM', exposure: 0.35, riskContribution: 16.0, description: 'Momentum Factor' },
                ],
            });
        } finally {
            setLoading(false);
        }
    };

    const radarData = result?.exposures.map((e) => ({
        factor: e.factor,
        exposure: Math.abs(e.exposure) * 100,
        fullMark: 150,
    })) || [];

    const riskData = result?.exposures.map((e) => ({
        factor: e.factor,
        contribution: e.riskContribution,
    })) || [];

    const getBarColor = (factor: string) => {
        const colors: Record<string, string> = {
            MKT: '#8b5cf6',
            SMB: '#06b6d4',
            HML: '#f59e0b',
            RMW: '#22c55e',
            CMA: '#ec4899',
            MOM: '#3b82f6',
        };
        return colors[factor] || '#6b7280';
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-8">
            {/* Header */}
            <motion.div className="mb-8" initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}>
                <h1 className="text-4xl font-bold text-white mb-2 flex items-center gap-3">
                    <Layers className="w-10 h-10 text-purple-500" />
                    Factor Risk Analysis
                </h1>
                <p className="text-slate-400">
                    Fama-French 6-Factor Model decomposition for systematic risk exposure analysis
                </p>
            </motion.div>

            {/* Configuration */}
            <motion.div
                className="mb-8 p-6 bg-gradient-to-br from-slate-900 to-slate-800 rounded-xl border border-slate-700"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
            >
                <h3 className="text-lg font-bold text-white mb-4">📊 Portfolio Positions</h3>
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
                            />
                        </div>
                    ))}
                </div>
                <button
                    onClick={analyzeFactors}
                    disabled={loading}
                    className="px-6 py-3 bg-purple-500 hover:bg-purple-600 disabled:bg-slate-600 rounded-lg text-white font-bold flex items-center gap-2"
                >
                    {loading ? 'Analyzing...' : <><Layers className="w-5 h-5" /> Analyze Factors</>}
                </button>
            </motion.div>

            {result && (
                <>
                    {/* Summary Cards */}
                    <div className="grid grid-cols-3 gap-4 mb-8">
                        <motion.div
                            className="p-6 bg-gradient-to-br from-purple-900/30 to-purple-800/20 border border-purple-700/30 rounded-xl"
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                        >
                            <Activity className="w-8 h-8 text-purple-400 mb-2" />
                            <div className="text-xs text-purple-400 uppercase">Factor Risk</div>
                            <div className="text-3xl font-bold text-white">{result.totalFactorRisk.toFixed(1)}%</div>
                            <div className="text-sm text-purple-300">of total variance</div>
                        </motion.div>

                        <motion.div
                            className="p-6 bg-gradient-to-br from-cyan-900/30 to-cyan-800/20 border border-cyan-700/30 rounded-xl"
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: 0.1 }}
                        >
                            <PieChart className="w-8 h-8 text-cyan-400 mb-2" />
                            <div className="text-xs text-cyan-400 uppercase">Idiosyncratic Risk</div>
                            <div className="text-3xl font-bold text-white">{result.idiosyncraticRisk.toFixed(1)}%</div>
                            <div className="text-sm text-cyan-300">stock-specific</div>
                        </motion.div>

                        <motion.div
                            className="p-6 bg-gradient-to-br from-green-900/30 to-green-800/20 border border-green-700/30 rounded-xl"
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: 0.2 }}
                        >
                            <TrendingUp className="w-8 h-8 text-green-400 mb-2" />
                            <div className="text-xs text-green-400 uppercase">Market Beta</div>
                            <div className="text-3xl font-bold text-white">
                                {result.exposures.find((e) => e.factor === 'MKT')?.exposure.toFixed(2) || '1.00'}
                            </div>
                            <div className="text-sm text-green-300">portfolio sensitivity</div>
                        </motion.div>
                    </div>

                    {/* Charts */}
                    <div className="grid grid-cols-2 gap-6 mb-8">
                        {/* Radar Chart */}
                        <motion.div
                            className="p-6 bg-gradient-to-br from-slate-900 to-slate-800 rounded-xl border border-slate-700"
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                        >
                            <h3 className="text-xl font-bold text-white mb-4">🎯 Factor Exposure Profile</h3>
                            <div className="h-72">
                                <ResponsiveContainer width="100%" height="100%">
                                    <RadarChart data={radarData}>
                                        <PolarGrid stroke="#334155" />
                                        <PolarAngleAxis dataKey="factor" tick={{ fill: '#94a3b8' }} />
                                        <PolarRadiusAxis angle={30} domain={[0, 150]} tick={{ fill: '#64748b' }} />
                                        <Radar
                                            name="Exposure"
                                            dataKey="exposure"
                                            stroke="#8b5cf6"
                                            fill="#8b5cf6"
                                            fillOpacity={0.4}
                                        />
                                    </RadarChart>
                                </ResponsiveContainer>
                            </div>
                        </motion.div>

                        {/* Risk Contribution Chart */}
                        <motion.div
                            className="p-6 bg-gradient-to-br from-slate-900 to-slate-800 rounded-xl border border-slate-700"
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                        >
                            <h3 className="text-xl font-bold text-white mb-4">📊 Risk Contribution by Factor</h3>
                            <div className="h-72">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={riskData}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                                        <XAxis dataKey="factor" stroke="#94a3b8" />
                                        <YAxis stroke="#94a3b8" unit="%" />
                                        <Tooltip
                                            contentStyle={{
                                                backgroundColor: '#1e293b',
                                                border: '1px solid #475569',
                                                borderRadius: '8px',
                                            }}
                                            formatter={(value: number | undefined) => [`${(value || 0).toFixed(1)}%`, 'Risk Contribution']}
                                        />
                                        <Bar dataKey="contribution" radius={[4, 4, 0, 0]}>
                                            {riskData.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={getBarColor(entry.factor)} />
                                            ))}
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </motion.div>
                    </div>

                    {/* Factor Details */}
                    <motion.div
                        className="p-6 bg-gradient-to-br from-slate-900 to-slate-800 rounded-xl border border-slate-700"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                    >
                        <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                            <Info className="w-5 h-5" /> Factor Details
                        </h3>
                        <div className="grid grid-cols-2 gap-4">
                            {result.exposures.map((exp, idx) => (
                                <div
                                    key={idx}
                                    className="p-4 bg-slate-800/50 rounded-lg border border-slate-700"
                                >
                                    <div className="flex justify-between items-center mb-2">
                                        <span
                                            className="text-lg font-bold px-3 py-1 rounded"
                                            style={{
                                                backgroundColor: `${getBarColor(exp.factor)}20`,
                                                color: getBarColor(exp.factor),
                                            }}
                                        >
                                            {exp.factor}
                                        </span>
                                        <span className="text-2xl font-bold text-white">
                                            {exp.exposure > 0 ? '+' : ''}{exp.exposure.toFixed(2)}
                                        </span>
                                    </div>
                                    <div className="text-sm text-slate-400">{exp.description}</div>
                                    <div className="mt-2 text-xs text-slate-500">
                                        Risk Contribution: {exp.riskContribution.toFixed(1)}%
                                    </div>
                                </div>
                            ))}
                        </div>
                    </motion.div>
                </>
            )}
        </div>
    );
}
