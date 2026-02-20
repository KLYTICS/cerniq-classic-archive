'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Area, AreaChart } from 'recharts';
import { apiClient } from '@/lib/api';

interface VolatilityForecast {
    ticker: string;
    currentVolatility: number;
    forecast: {
        day: number;
        volatility: number;
        lower95: number;
        upper95: number;
    }[];
    model: string;
}

interface VolatilityForecastChartProps {
    ticker: string;
    horizon?: number;
}

export function VolatilityForecastChart({ ticker, horizon = 30 }: VolatilityForecastChartProps) {
    const [data, setData] = useState<VolatilityForecast | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!ticker) return;

        const fetchForecast = async () => {
            setLoading(true);
            setError(null);

            try {
                let result;
                try {
                    result = await apiClient.getNodeVolatilityForecast(ticker, horizon);
                } catch {
                    result = await apiClient.getVolatilityForecast(ticker, horizon);
                }
                if (!result) throw new Error('Failed to fetch volatility forecast');
                setData(result);
            } catch (err: any) {
                setError(err.message || 'Failed to fetch data');
            } finally {
                setLoading(false);
            }
        };

        fetchForecast();
    }, [ticker, horizon]);

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

    if (!data) return null;

    // Prepare chart data (add day 0 with current volatility)
    const chartData = [
        { day: 0, volatility: data.currentVolatility, lower95: data.currentVolatility, upper95: data.currentVolatility },
        ...data.forecast,
    ];

    const avgForecast = data.forecast.reduce((sum, d) => sum + d.volatility, 0) / data.forecast.length;
    const trend = avgForecast > data.currentVolatility ? 'increasing' : 'decreasing';

    return (
        <motion.div
            className="p-6 bg-gradient-to-br from-slate-900 to-slate-800 rounded-xl border border-slate-700 shadow-lg"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
        >
            {/* Header */}
            <div className="mb-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h3 className="text-xl font-bold text-white mb-1">Volatility Forecast: {ticker}</h3>
                        <p className="text-sm text-slate-400">{data.model} - {horizon}-day forecast</p>
                    </div>
                    <div className="text-right">
                        <div className="text-xs text-slate-400">Current Vol</div>
                        <div className="text-2xl font-bold text-purple-400">
                            {(data.currentVolatility * 100).toFixed(2)}%
                        </div>
                    </div>
                </div>
            </div>

            {/* Chart */}
            <div className="h-80 mb-6">
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                        <defs>
                            <linearGradient id="colorVol" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#a855f7" stopOpacity={0.3} />
                                <stop offset="95%" stopColor="#a855f7" stopOpacity={0} />
                            </linearGradient>
                            <linearGradient id="colorCI" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.1} />
                                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                            </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                        <XAxis dataKey="day" stroke="#94a3b8" label={{ value: 'Days Ahead', position: 'insideBottom', offset: -5, fill: '#94a3b8' }} />
                        <YAxis
                            stroke="#94a3b8"
                            tickFormatter={(value) => `${(value * 100).toFixed(1)}%`}
                            label={{ value: 'Volatility', angle: -90, position: 'insideLeft', fill: '#94a3b8' }}
                        />
                        <Tooltip
                            contentStyle={{
                                backgroundColor: '#1e293b',
                                border: '1px solid #475569',
                                borderRadius: '8px',
                            }}
                            labelStyle={{ color: '#f1f5f9' }}
                            formatter={(value: any, name: string | undefined) => {
                                const formatted = `${(value * 100).toFixed(2)}%`;
                                if (name === 'volatility') return [formatted, 'Forecast'];
                                if (name === 'lower95') return [formatted, '95% Lower Bound'];
                                if (name === 'upper95') return [formatted, '95% Upper Bound'];
                                return [formatted, name];
                            }}
                            labelFormatter={(label) => `Day ${label}`}
                        />
                        <Legend />

                        {/* Confidence interval band */}
                        <Area
                            type="monotone"
                            dataKey="upper95"
                            stroke="none"
                            fill="url(#colorCI)"
                            fillOpacity={1}
                        />
                        <Area
                            type="monotone"
                            dataKey="lower95"
                            stroke="none"
                            fill="#1e293b"
                            fillOpacity={1}
                        />

                        {/* Forecast line */}
                        <Line
                            type="monotone"
                            dataKey="volatility"
                            stroke="#a855f7"
                            strokeWidth={3}
                            dot={{ fill: '#a855f7', r: 4 }}
                            name="Forecast"
                        />
                        <Line
                            type="monotone"
                            dataKey="lower95"
                            stroke="#3b82f6"
                            strokeWidth={1}
                            strokeDasharray="5 5"
                            dot={false}
                            name="95% Lower"
                        />
                        <Line
                            type="monotone"
                            dataKey="upper95"
                            stroke="#3b82f6"
                            strokeWidth={1}
                            strokeDasharray="5 5"
                            dot={false}
                            name="95% Upper"
                        />
                    </AreaChart>
                </ResponsiveContainer>
            </div>

            {/* Forecast Statistics */}
            <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="p-4 bg-slate-800/50 rounded-lg border border-slate-700">
                    <div className="text-xs text-slate-400 mb-1">Avg Forecast</div>
                    <div className="text-xl font-bold text-purple-400">{(avgForecast * 100).toFixed(2)}%</div>
                </div>

                <div className="p-4 bg-slate-800/50 rounded-lg border border-slate-700">
                    <div className="text-xs text-slate-400 mb-1">Trend</div>
                    <div className={`text-xl font-bold ${trend === 'increasing' ? 'text-red-400' : 'text-green-400'}`}>
                        {trend === 'increasing' ? '↑' : '↓'} {Math.abs(((avgForecast - data.currentVolatility) / data.currentVolatility) * 100).toFixed(1)}%
                    </div>
                </div>

                <div className="p-4 bg-slate-800/50 rounded-lg border border-slate-700">
                    <div className="text-xs text-slate-400 mb-1">Day {horizon} Forecast</div>
                    <div className="text-xl font-bold text-white">
                        {(data.forecast[data.forecast.length - 1].volatility * 100).toFixed(2)}%
                    </div>
                </div>
            </div>

            {/* Model Info */}
            <div className="p-4 bg-purple-500/10 border border-purple-500/30 rounded-lg">
                <div className="flex items-start gap-3">
                    <div className="text-purple-400 text-xl">📈</div>
                    <div>
                        <h5 className="text-sm font-semibold text-purple-400 mb-1">GARCH(1,1) Model</h5>
                        <p className="text-xs text-slate-300">
                            Forecasts volatility using historical variance dynamics. The shaded area shows the 95% confidence interval.
                            {trend === 'increasing' && ' Rising volatility suggests increasing market uncertainty.'}
                            {trend === 'decreasing' && ' Decreasing volatility suggests calmer market conditions ahead.'}
                        </p>
                    </div>
                </div>
            </div>
        </motion.div>
    );
}
