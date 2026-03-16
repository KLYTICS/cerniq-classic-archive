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
            } catch (err: unknown) {
                setError(err instanceof Error ? err.message : 'Failed to fetch data');
            } finally {
                setLoading(false);
            }
        };

        fetchComponentVaR();
    }, [positions, confidenceLevel, horizon]);

    if (loading) {
        return (
            <div className="cerniq-panel p-6">
                <div className="animate-pulse space-y-4">
                    <div className="h-6 w-1/3 rounded bg-slate-100"></div>
                    <div className="h-64 rounded bg-slate-100"></div>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-6">
                <p className="text-rose-700">Error: {error}</p>
            </div>
        );
    }

    if (!data) {
        return (
            <div className="cerniq-panel p-6">
                <p className="text-slate-500">Add positions to see Component VaR analysis.</p>
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
            className="cerniq-panel p-6 shadow-lg"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
        >
            {/* Header */}
            <div className="mb-6">
                <h3 className="text-xl font-bold text-slate-950 mb-2">Component VaR Analysis</h3>
                <p className="text-sm text-slate-500">Risk contribution breakdown by position.</p>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="rounded-lg border border-slate-200 bg-white/86 p-4">
                    <div className="mb-1 text-xs text-slate-500">Portfolio VaR</div>
                    <div className="text-2xl font-bold text-rose-700">
                        ${data.portfolioVaR.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </div>
                    <div className="mt-1 text-xs text-slate-500">
                        ({((data.portfolioVaR / data.portfolioValue) * 100).toFixed(2)}% of portfolio)
                    </div>
                </div>

                <div className="rounded-lg border border-slate-200 bg-white/86 p-4">
                    <div className="mb-1 text-xs text-slate-500">Portfolio Value</div>
                    <div className="text-2xl font-bold text-slate-950">
                        ${data.portfolioValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </div>
                </div>

                <div className="rounded-lg border border-slate-200 bg-white/86 p-4">
                    <div className="mb-1 text-xs text-slate-500">Confidence Level</div>
                    <div className="text-2xl font-bold text-cyan-700">{(data.confidenceLevel * 100).toFixed(0)}%</div>
                    <div className="mt-1 text-xs text-slate-500">{data.horizon}-day horizon</div>
                </div>
            </div>

            {/* Bar Chart */}
            <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} layout="vertical" margin={{ top: 5, right: 30, left: 100, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#cbd5e1" />
                        <XAxis type="number" stroke="#64748b" />
                        <YAxis dataKey="ticker" type="category" stroke="#64748b" width={90} />
                        <Tooltip
                            contentStyle={{
                                backgroundColor: '#ffffff',
                                border: '1px solid #cbd5e1',
                                borderRadius: '8px',
                            }}
                            labelStyle={{ color: '#0f172a' }}
                            formatter={(value: number | string, name: string | undefined) => {
                                if (name === 'componentVaR') {
                                    return [`$${Number(value).toLocaleString()}`, 'Component VaR'];
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
                <h4 className="mb-3 text-sm font-semibold text-slate-950">Risk Contribution Details</h4>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-slate-200">
                                <th className="py-2 text-left text-slate-500">Ticker</th>
                                <th className="py-2 text-right text-slate-500">Position</th>
                                <th className="py-2 text-right text-slate-500">Component VaR</th>
                                <th className="py-2 text-right text-slate-500">Risk %</th>
                            </tr>
                        </thead>
                        <tbody>
                            {data.components
                                .sort((a, b) => b.riskContribution - a.riskContribution)
                                .map((comp, idx) => (
                                    <tr key={idx} className="border-b border-slate-100">
                                        <td className="py-2 font-semibold text-cyan-800">{comp.ticker}</td>
                                        <td className="py-2 text-right text-slate-600">
                                            ${comp.position.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                        </td>
                                        <td className="py-2 text-right font-semibold text-rose-700">
                                            ${comp.componentVaR.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                        </td>
                                        <td className="py-2 text-right">
                                            <span
                                                className={`px-2 py-1 rounded text-xs font-semibold ${comp.riskContribution > 30
                                                    ? 'bg-rose-100 text-rose-700'
                                                    : comp.riskContribution > 15
                                                        ? 'bg-amber-100 text-amber-700'
                                                        : 'bg-emerald-100 text-emerald-700'
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
            <div className="mt-6 rounded-lg border border-cyan-200 bg-cyan-50/80 p-4">
                <div className="flex items-start gap-3">
                    <div className="text-cyan-700 text-xl">💡</div>
                    <div>
                        <h5 className="mb-1 text-sm font-semibold text-cyan-700">Component VaR Insights</h5>
                        <p className="text-xs text-slate-700">
                            Component VaR shows how much each position contributes to total portfolio risk. Positions with high
                            risk contribution may be candidates for hedging or position size reduction.
                        </p>
                    </div>
                </div>
            </div>
        </motion.div>
    );
}
