'use client';

import { useState, useEffect, useCallback } from 'react';
import { Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Line, LineChart } from 'recharts';
import { motion } from 'framer-motion';

interface VolatilityConePoint {
    daysToExpiry: number;
    p10: number;
    p25: number;
    p50: number;
    p75: number;
    p90: number;
    currentRV: number;
    currentIV?: number;
}

interface VolatilityConeData {
    ticker: string;
    underlyingPrice: number;
    coneData: VolatilityConePoint[];
    timestamp: Date;
}

const NODE_API_URL = (process.env.NEXT_PUBLIC_NODE_API_URL || '').trim().replace(/\/+$/, '');

export function VolatilityCone() {
    const [ticker, setTicker] = useState('AAPL');
    const [data, setData] = useState<VolatilityConeData | null>(null);
    const [loading, setLoading] = useState(false);

    const fetchCone = useCallback(async () => {
        setLoading(true);
        try {
            const response = await fetch(`${NODE_API_URL}/api/risk/volatility/cone/${ticker}`);
            const result = await response.json();
            setData(result);
        } catch (err) {
            console.error('Failed to fetch volatility cone:', err);
        } finally {
            setLoading(false);
        }
    }, [ticker]);

    useEffect(() => {
        fetchCone();
    }, [fetchCone]);

    if (!data) {
        return (
            <div className="flex items-center justify-center h-96">
                <div className="text-slate-400">Loading volatility cone...</div>
            </div>
        );
    }

    // Prepare data for chart
    const chartData = data.coneData.map(point => ({
        days: point.daysToExpiry,
        'p10-p90': [point.p10 * 100, point.p90 * 100],
        'p25-p75': [point.p25 * 100, point.p75 * 100],
        p50: point.p50 * 100,
        currentRV: point.currentRV * 100,
        currentIV: point.currentIV ? point.currentIV * 100 : undefined,
    }));

    // Determine if current vol is cheap or expensive
    const currentPoint = data.coneData[2]; // 30-day point
    const percentileRank =
        currentPoint.currentRV <= currentPoint.p25 ? 'LOW (Cheap)' :
            currentPoint.currentRV >= currentPoint.p75 ? 'HIGH (Expensive)' :
                'MEDIUM (Normal)';

    const percentileColor =
        percentileRank.includes('Cheap') ? 'text-green-400' :
            percentileRank.includes('Expensive') ? 'text-red-400' :
                'text-yellow-400';

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="w-full bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl shadow-2xl border border-slate-700 p-6"
        >
            {/* Header */}
            <div className="mb-6">
                <h2 className="text-3xl font-bold text-white mb-2 flex items-center gap-3">
                    <span className="text-4xl">📉</span>
                    Volatility Cone
                </h2>
                <p className="text-slate-400">
                    Historical volatility percentile bands vs current volatility
                </p>
            </div>

            {/* Controls */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">Ticker</label>
                    <div className="flex gap-2">
                        <input
                            type="text"
                            value={ticker}
                            onChange={(e) => setTicker(e.target.value.toUpperCase())}
                            className="flex-1 px-4 py-2 bg-slate-800 text-white rounded-lg border border-slate-600 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                            placeholder="AAPL"
                        />
                        <button
                            onClick={fetchCone}
                            disabled={loading}
                            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
                        >
                            {loading ? 'Loading...' : 'Update'}
                        </button>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                    <div className="p-4 bg-slate-800 rounded-lg">
                        <div className="text-xs text-slate-400">Current 30d RV</div>
                        <div className="text-2xl font-bold text-white">
                            {(currentPoint.currentRV * 100).toFixed(1)}%
                        </div>
                    </div>
                    <div className="p-4 bg-slate-800 rounded-lg">
                        <div className="text-xs text-slate-400">Status</div>
                        <div className={`text-lg font-bold ${percentileColor}`}>
                            {percentileRank}
                        </div>
                    </div>
                </div>
            </div>

            {/* Volatility Cone Chart */}
            <div className="bg-slate-800 rounded-lg p-4">
                <ResponsiveContainer width="100%" height={400}>
                    <LineChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                        <XAxis
                            dataKey="days"
                            stroke="#94a3b8"
                            label={{ value: 'Days to Expiry', position: 'insideBottom', offset: -5, fill: '#94a3b8' }}
                        />
                        <YAxis
                            stroke="#94a3b8"
                            label={{ value: 'Volatility (%)', angle: -90, position: 'insideLeft', fill: '#94a3b8' }}
                        />
                        <Tooltip
                            contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569', borderRadius: '8px' }}
                            labelStyle={{ color: '#e2e8f0' }}
                            formatter={(value: number | string | undefined) => `${Number(value ?? 0).toFixed(1)}%`}
                        />
                        <Legend />

                        {/* Percentile Bands */}
                        <Area
                            type="monotone"
                            dataKey="p10-p90"
                            fill="#3b82f6"
                            fillOpacity={0.1}
                            stroke="none"
                            name="10th-90th Percentile"
                        />
                        <Area
                            type="monotone"
                            dataKey="p25-p75"
                            fill="#6366f1"
                            fillOpacity={0.2}
                            stroke="none"
                            name="25th-75th Percentile"
                        />

                        {/* Median */}
                        <Line
                            type="monotone"
                            dataKey="p50"
                            stroke="#8b5cf6"
                            strokeWidth={2}
                            dot={{ r: 4 }}
                            name="Median (50th)"
                        />

                        {/* Current Realized Volatility */}
                        <Line
                            type="monotone"
                            dataKey="currentRV"
                            stroke="#10b981"
                            strokeWidth={3}
                            dot={{ r: 5, fill: '#10b981' }}
                            name="Current Realized Vol"
                        />
                    </LineChart>
                </ResponsiveContainer>
            </div>

            {/* Insights */}
            <div className="mt-6 p-4 bg-slate-800/50 border border-slate-700 rounded-lg">
                <h3 className="text-lg font-semibold text-white mb-2">Cone Insights</h3>
                <div className="space-y-2 text-sm text-slate-300">
                    <div className="flex items-start gap-2">
                        <span className="text-blue-400">•</span>
                        <div>
                            <strong>Cheap Volatility:</strong> Current vol below 25th percentile suggests IV is historically low
                        </div>
                    </div>
                    <div className="flex items-start gap-2">
                        <span className="text-purple-400">•</span>
                        <div>
                            <strong>Expensive Volatility:</strong> Current vol above 75th percentile suggests IV is historically high
                        </div>
                    </div>
                    <div className="flex items-start gap-2">
                        <span className="text-green-400">•</span>
                        <div>
                            <strong>Current Status:</strong> {data.ticker} 30-day realized volatility is <span className={percentileColor}>{percentileRank}</span>
                        </div>
                    </div>
                    <div className="flex items-start gap-2">
                        <span className="text-yellow-400">•</span>
                        <div>
                            <strong>Trading Strategy:</strong> {
                                percentileRank.includes('Cheap') ? 'Consider buying options (long vega)' :
                                    percentileRank.includes('Expensive') ? 'Consider selling options (short vega)' :
                                        'Market volatility is near historical median'
                            }
                        </div>
                    </div>
                </div>
            </div>
        </motion.div>
    );
}
