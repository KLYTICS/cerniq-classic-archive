'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, Legend } from 'recharts';
import { apiClient } from '@/lib/api';

interface ComponentVaRData {
    portfolioVaR: number;
    portfolioValue: number;
    confidenceLevel: number;
    horizon: number;
    components: {
        ticker: string;
        position: number;
        marginalVaR: number;
        componentVaR: number;
        riskContribution: number;
    }[];
}

interface ComponentVaRChartProps {
    positions: { ticker: string; quantity: number; price: number }[];
    confidenceLevel?: number;
    horizon?: number;
}

export function ComponentVaRChart({ positions, confidenceLevel = 0.95, horizon = 1 }: ComponentVaRChartProps) {
    const [data, setData] = useState<ComponentVaRData | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!positions || positions.length === 0) return;

        const fetchComponentVaR = async () => {
            setLoading(true);
            setError(null);

            try {
                let result;
                try {
                    result = await apiClient.getNodeComponentVaR(positions, confidenceLevel, horizon);
                } catch {
                    result = await apiClient.calculateComponentVaR(positions, confidenceLevel, horizon);
                }
                if (!result) throw new Error('Failed to calculate Component VaR');
                setData(result);
            } catch (err: any) {
                setError(err.message || 'Failed to fetch data');
            } finally {
                setLoading(false);
            }
        };

        fetchComponentVaR();
    }, [positions, confidenceLevel, horizon]);

    if (loading) {
        return (
            <div className="p-6 bg-slate-900 rounded-xl border border-slate-700">
                <div className="animate-pulse space-y-4">
                    <div className="h-6 bg-slate-700 rounded w-1/3"></div>
                    <div className="h-64 bg-slate-700 rounded"></div>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="p-6 bg-red-900/20 rounded-xl border border-red-700">
                <p className="text-red-400">Error: {error}</p>
            </div>
        );
    }

    if (!data) {
        return (
            <div className="p-6 bg-slate-900 rounded-xl border border-slate-700">
                <p className="text-slate-400">Add positions to see Component VaR analysis</p>
            </div>
        );
    }

    // Prepare chart data
    const chartData = data.components
        .sort((a, b) => b.componentVaR - a.componentVaR)
        .map((comp) => ({
            ticker: comp.ticker,
            componentVaR: comp.componentVaR,
            riskContribution: comp.riskContribution,
            position: comp.position,
        }));

    // Color scale based on risk contribution
    const getBarColor = (contribution: number) => {
        if (contribution > 30) return '#ef4444'; // High risk - red
        if (contribution > 15) return '#f59e0b'; // Medium risk - orange
        return '#10b981'; // Low risk - green
    };

    return (
        <motion.div
            className="p-6 bg-gradient-to-br from-slate-900 to-slate-800 rounded-xl border border-slate-700 shadow-lg"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
        >
            {/* Header */}
            <div className="mb-6">
                <h3 className="text-xl font-bold text-white mb-2">Component VaR Analysis</h3>
                <p className="text-sm text-slate-400">Risk contribution breakdown by position</p>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="p-4 bg-slate-800/50 rounded-lg border border-slate-700">
                    <div className="text-xs text-slate-400 mb-1">Portfolio VaR</div>
                    <div className="text-2xl font-bold text-red-400">
                        ${data.portfolioVaR.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </div>
                    <div className="text-xs text-slate-500 mt-1">
                        ({((data.portfolioVaR / data.portfolioValue) * 100).toFixed(2)}% of portfolio)
                    </div>
                </div>

                <div className="p-4 bg-slate-800/50 rounded-lg border border-slate-700">
                    <div className="text-xs text-slate-400 mb-1">Portfolio Value</div>
                    <div className="text-2xl font-bold text-white">
                        ${data.portfolioValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </div>
                </div>

                <div className="p-4 bg-slate-800/50 rounded-lg border border-slate-700">
                    <div className="text-xs text-slate-400 mb-1">Confidence Level</div>
                    <div className="text-2xl font-bold text-blue-400">{(data.confidenceLevel * 100).toFixed(0)}%</div>
                    <div className="text-xs text-slate-500 mt-1">{data.horizon}-day horizon</div>
                </div>
            </div>

            {/* Bar Chart */}
            <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} layout="vertical" margin={{ top: 5, right: 30, left: 100, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                        <XAxis type="number" stroke="#94a3b8" />
                        <YAxis dataKey="ticker" type="category" stroke="#94a3b8" width={90} />
                        <Tooltip
                            contentStyle={{
                                backgroundColor: '#1e293b',
                                border: '1px solid #475569',
                                borderRadius: '8px',
                            }}
                            labelStyle={{ color: '#f1f5f9' }}
                            formatter={(value: any, name: string | undefined) => {
                                if (name === 'componentVaR') {
                                    return [`$${value.toLocaleString()}`, 'Component VaR'];
                                }
                                return [value, name];
                            }}
                        />
                        <Legend />
                        <Bar dataKey="componentVaR" name="Component VaR ($)" radius={[0, 8, 8, 0]}>
                            {chartData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={getBarColor(entry.riskContribution)} />
                            ))}
                        </Bar>
                    </BarChart>
                </ResponsiveContainer>
            </div>

            {/* Risk Contribution Table */}
            <div className="mt-6">
                <h4 className="text-sm font-semibold text-white mb-3">Risk Contribution Details</h4>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-slate-700">
                                <th className="text-left py-2 text-slate-400">Ticker</th>
                                <th className="text-right py-2 text-slate-400">Position</th>
                                <th className="text-right py-2 text-slate-400">Component VaR</th>
                                <th className="text-right py-2 text-slate-400">Risk %</th>
                            </tr>
                        </thead>
                        <tbody>
                            {data.components
                                .sort((a, b) => b.riskContribution - a.riskContribution)
                                .map((comp, idx) => (
                                    <tr key={idx} className="border-b border-slate-800">
                                        <td className="py-2 text-white font-semibold">{comp.ticker}</td>
                                        <td className="py-2 text-right text-slate-300">
                                            ${comp.position.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                        </td>
                                        <td className="py-2 text-right text-red-400 font-semibold">
                                            ${comp.componentVaR.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                        </td>
                                        <td className="py-2 text-right">
                                            <span
                                                className={`px-2 py-1 rounded text-xs font-semibold ${comp.riskContribution > 30
                                                    ? 'bg-red-500/20 text-red-400'
                                                    : comp.riskContribution > 15
                                                        ? 'bg-orange-500/20 text-orange-400'
                                                        : 'bg-green-500/20 text-green-400'
                                                    }`}
                                            >
                                                {comp.riskContribution.toFixed(1)}%
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Insights */}
            <div className="mt-6 p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                <div className="flex items-start gap-3">
                    <div className="text-blue-400 text-xl">💡</div>
                    <div>
                        <h5 className="text-sm font-semibold text-blue-400 mb-1">Component VaR Insights</h5>
                        <p className="text-xs text-slate-300">
                            Component VaR shows how much each position contributes to total portfolio risk. Positions with high
                            risk contribution may be candidates for hedging or position size reduction.
                        </p>
                    </div>
                </div>
            </div>
        </motion.div>
    );
}
