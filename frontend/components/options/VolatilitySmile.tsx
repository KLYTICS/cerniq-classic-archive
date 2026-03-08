'use client';

import { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { motion } from 'framer-motion';

interface IVSurfacePoint {
    strike: number;
    maturity: number;
    maturityLabel: string;
    impliedVolatility: number;
    moneyness: number;
}

interface VolatilitySurface {
    ticker: string;
    underlyingPrice: number;
    strikes: number[];
    maturities: number[];
    surface: IVSurfacePoint[];
    timestamp: Date;
}

const MATURITY_COLORS = ['#3b82f6', '#8b5cf6', '#ec4899', '#f97316', '#10b981', '#eab308'];

const NODE_API_URL = (process.env.NEXT_PUBLIC_NODE_API_URL || '').trim().replace(/\/+$/, '');

export function VolatilitySmile() {
    const [ticker, setTicker] = useState('AAPL');
    const [data, setData] = useState<VolatilitySurface | null>(null);
    const [loading, setLoading] = useState(false);
    const [selectedMaturity, setSelectedMaturity] = useState<number | 'all'>(30);

    const fetchSurface = async () => {
        setLoading(true);
        try {
            const response = await fetch(`${NODE_API_URL}/api/options/surface/${ticker}`);
            const result = await response.json();
            setData(result);
        } catch (err) {
            console.error('Failed to fetch IV surface:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchSurface();
    }, [ticker]);

    if (!data) {
        return (
            <div className="flex items-center justify-center h-96">
                <div className="text-slate-400">Loading volatility surface...</div>
            </div>
        );
    }

    // Prepare data for volatility smile chart
    const smileData = data.strikes.map((strike) => {
        const point: any = { strike, moneyness: ((strike / data.underlyingPrice - 1) * 100).toFixed(1) + '%' };

        data.maturities.forEach((maturity) => {
            const surfacePoint = data.surface.find(
                (p) => p.strike === strike && p.maturity === maturity
            );
            if (surfacePoint) {
                point[`${maturity}d`] = (surfacePoint.impliedVolatility * 100).toFixed(1);
            }
        });

        return point;
    });

    // Filter data if specific maturity selected
    const filteredData = selectedMaturity === 'all'
        ? smileData
        : smileData.map(point => ({
            strike: point.strike,
            moneyness: point.moneyness,
            [`${selectedMaturity}d`]: point[`${selectedMaturity}d`],
        }));

    const visibleMaturities = selectedMaturity === 'all'
        ? data.maturities.map(m => `${m}d`)
        : [`${selectedMaturity}d`];

    return (
        <div className="w-full max-w-6xl mx-auto p-6 bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl shadow-2xl border border-slate-700">
            <div className="mb-6">
                <h2 className="text-3xl font-bold text-white mb-2 flex items-center gap-3">
                    <span className="text-4xl">📈</span>
                    Implied Volatility Smile
                </h2>
                <p className="text-slate-400">IV varies across strikes (volatility smile/skew)</p>
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
                            onClick={fetchSurface}
                            disabled={loading}
                            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
                        >
                            {loading ? 'Loading...' : 'Update'}
                        </button>
                    </div>
                </div>

                <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                        Maturity Filter
                    </label>
                    <select
                        value={selectedMaturity}
                        onChange={(e) => setSelectedMaturity(e.target.value === 'all' ? 'all' : Number(e.target.value))}
                        className="w-full px-4 py-2 bg-slate-800 text-white rounded-lg border border-slate-600 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                    >
                        <option value="all">All Maturities</option>
                        {data.maturities.map((m) => (
                            <option key={m} value={m}>
                                {m} days ({(m / 30).toFixed(1)} months)
                            </option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Key Metrics */}
            <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="p-4 bg-slate-800 rounded-lg">
                    <div className="text-xs text-slate-400">Underlying</div>
                    <div className="text-2xl font-bold text-white">${data.underlyingPrice}</div>
                </div>
                <div className="p-4 bg-slate-800 rounded-lg">
                    <div className="text-xs text-slate-400">Strikes</div>
                    <div className="text-2xl font-bold text-white">{data.strikes.length}</div>
                </div>
                <div className="p-4 bg-slate-800 rounded-lg">
                    <div className="text-xs text-slate-400">Maturities</div>
                    <div className="text-2xl font-bold text-white">{data.maturities.length}</div>
                </div>
            </div>

            {/* Volatility Smile Chart */}
            <div className="bg-slate-800 rounded-lg p-4">
                <ResponsiveContainer width="100%" height={400}>
                    <LineChart data={filteredData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                        <XAxis
                            dataKey="strike"
                            stroke="#94a3b8"
                            label={{ value: 'Strike Price', position: 'insideBottom', offset: -5, fill: '#94a3b8' }}
                        />
                        <YAxis
                            stroke="#94a3b8"
                            label={{ value: 'Implied Volatility (%)', angle: -90, position: 'insideLeft', fill: '#94a3b8' }}
                        />
                        <Tooltip
                            contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569', borderRadius: '8px' }}
                            labelStyle={{ color: '#e2e8f0' }}
                            formatter={(value: any) => `${value}%`}
                        />
                        <Legend />
                        {visibleMaturities.map((maturity, index) => (
                            <Line
                                key={maturity}
                                type="monotone"
                                dataKey={maturity}
                                stroke={MATURITY_COLORS[index % MATURITY_COLORS.length]}
                                strokeWidth={2}
                                dot={{ r: 4 }}
                                name={maturity}
                            />
                        ))}
                    </LineChart>
                </ResponsiveContainer>
            </div>

            {/* Insights */}
            <div className="mt-6 p-4 bg-slate-800/50 border border-slate-700 rounded-lg">
                <h3 className="text-lg font-semibold text-white mb-2">Volatility Smile Insights</h3>
                <div className="space-y-2 text-sm text-slate-300">
                    <div className="flex items-start gap-2">
                        <span className="text-blue-400">•</span>
                        <div><strong>ATM Strike:</strong> ${data.underlyingPrice} (current underlying price)</div>
                    </div>
                    <div className="flex items-start gap-2">
                        <span className="text-purple-400">•</span>
                        <div><strong>Volatility Smile:</strong> IV typically higher for OTM options (wings of the smile)</div>
                    </div>
                    <div className="flex items-start gap-2">
                        <span className="text-pink-400">•</span>
                        <div><strong>Term Structure:</strong> Longer maturities generally have higher IV</div>
                    </div>
                    <div className="flex items-start gap-2">
                        <span className="text-orange-400">•</span>
                        <div><strong>Skew:</strong> Asymmetric smile indicates directional bias (puts vs calls)</div>
                    </div>
                </div>
            </div>
        </div>
    );
}
