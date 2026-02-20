'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { apiClient } from '@/lib/api';

interface GreeksResult {
    delta: number;
    gamma: number;
    theta: number;
    vega: number;
    rho: number;
    price: number;
}

export function GreeksCalculator() {
    const [ticker, setTicker] = useState('');
    const [underlying, setUnderlying] = useState(100);
    const [strike, setStrike] = useState(105);
    const [timeToExpiry, setTimeToExpiry] = useState(0.25);
    const [volatility, setVolatility] = useState(0.25);
    const [riskFreeRate, setRiskFreeRate] = useState(0.05);
    const [optionType, setOptionType] = useState<'call' | 'put'>('call');
    const [result, setResult] = useState<GreeksResult | null>(null);
    const [loading, setLoading] = useState(false);
    const [fetchingPrice, setFetchingPrice] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchUnderlyingPrice = async () => {
        if (!ticker.trim()) return;
        setFetchingPrice(true);
        try {
            const data = await apiClient.getNodeQuote(ticker.toUpperCase());
            if (data?.price) {
                setUnderlying(data.price);
                setStrike(Math.round(data.price * 1.05));
            }
        } catch (err) {
            console.error('Failed to fetch underlying price:', err);
        } finally {
            setFetchingPrice(false);
        }
    };

    const calculateGreeks = async () => {
        setLoading(true);
        setError(null);

        try {
            const data = await apiClient.calculateNodeGreeks({
                underlying,
                strike,
                timeToExpiry,
                riskFreeRate,
                volatility,
                optionType,
            });
            setResult(data);
        } catch (err: any) {
            setError(err.message || 'An error occurred');
        } finally {
            setLoading(false);
        }
    };

    const moneyness = ((underlying / strike) - 1) * 100;
    const isITM = (optionType === 'call' && underlying > strike) || (optionType === 'put' && underlying < strike);

    return (
        <div className="w-full max-w-4xl mx-auto p-6 bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl shadow-2xl border border-slate-700">
            <h2 className="text-3xl font-bold text-white mb-6 flex items-center gap-3">
                <span className="text-4xl">📊</span>
                Black-Scholes Greeks Calculator
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                {/* Left Column: Inputs */}
                <div className="space-y-4">
                    {/* Ticker Lookup */}
                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">
                            Fetch Real Price
                        </label>
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={ticker}
                                onChange={(e) => setTicker(e.target.value.toUpperCase())}
                                placeholder="e.g. AAPL"
                                className="flex-1 py-2 px-3 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500"
                                onKeyDown={(e) => e.key === 'Enter' && fetchUnderlyingPrice()}
                            />
                            <button
                                onClick={fetchUnderlyingPrice}
                                disabled={fetchingPrice || !ticker.trim()}
                                className="py-2 px-4 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium transition disabled:opacity-50"
                            >
                                {fetchingPrice ? '...' : 'Lookup'}
                            </button>
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">
                            Option Type
                        </label>
                        <div className="flex gap-2">
                            <button
                                onClick={() => setOptionType('call')}
                                className={`flex-1 py-2 px-4 rounded-lg font-medium transition-all ${optionType === 'call'
                                        ? 'bg-green-600 text-white shadow-lg shadow-green-600/50'
                                        : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                                    }`}
                            >
                                Call
                            </button>
                            <button
                                onClick={() => setOptionType('put')}
                                className={`flex-1 py-2 px-4 rounded-lg font-medium transition-all ${optionType === 'put'
                                        ? 'bg-red-600 text-white shadow-lg shadow-red-600/50'
                                        : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                                    }`}
                            >
                                Put
                            </button>
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">
                            Underlying Price: ${underlying.toFixed(2)}
                        </label>
                        <input
                            type="number"
                            min="0.01"
                            step="0.5"
                            value={underlying}
                            onChange={(e) => setUnderlying(Number(e.target.value))}
                            className="w-full py-2 px-3 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">
                            Strike Price: ${strike.toFixed(2)}
                            <span className={`ml-2 text-xs px-2 py-1 rounded ${isITM ? 'bg-green-600/20 text-green-400' : 'bg-red-600/20 text-red-400'}`}>
                                {isITM ? 'ITM' : 'OTM'} ({moneyness > 0 ? '+' : ''}{moneyness.toFixed(1)}%)
                            </span>
                        </label>
                        <input
                            type="number"
                            min="0.01"
                            step="0.5"
                            value={strike}
                            onChange={(e) => setStrike(Number(e.target.value))}
                            className="w-full py-2 px-3 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">
                            Time to Expiry: {(timeToExpiry * 365).toFixed(0)} days ({(timeToExpiry * 12).toFixed(1)} months)
                        </label>
                        <input
                            type="range"
                            min="0.01"
                            max="2"
                            step="0.01"
                            value={timeToExpiry}
                            onChange={(e) => setTimeToExpiry(Number(e.target.value))}
                            className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">
                            Implied Volatility: {(volatility * 100).toFixed(0)}%
                        </label>
                        <input
                            type="range"
                            min="0.05"
                            max="1.0"
                            step="0.01"
                            value={volatility}
                            onChange={(e) => setVolatility(Number(e.target.value))}
                            className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-purple-500"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">
                            Risk-Free Rate: {(riskFreeRate * 100).toFixed(1)}%
                        </label>
                        <input
                            type="range"
                            min="0"
                            max="0.10"
                            step="0.0025"
                            value={riskFreeRate}
                            onChange={(e) => setRiskFreeRate(Number(e.target.value))}
                            className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                        />
                    </div>

                    <button
                        onClick={calculateGreeks}
                        disabled={loading}
                        className="w-full py-3 px-6 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-bold rounded-lg shadow-lg hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {loading ? 'Calculating...' : 'Calculate Greeks'}
                    </button>
                </div>

                {/* Right Column: Results */}
                <div>
                    {error && (
                        <div className="p-4 bg-red-900/50 border border-red-600 rounded-lg text-red-200 mb-4">
                            {error}
                        </div>
                    )}

                    {result && (
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="space-y-3"
                        >
                            <div className="p-4 bg-gradient-to-r from-blue-600/20 to-purple-600/20 border border-blue-500/50 rounded-lg">
                                <div className="text-sm text-slate-400">Option Price</div>
                                <div className="text-3xl font-bold text-white">${result.price.toFixed(2)}</div>
                            </div>

                            <div className="p-4 bg-slate-800/50 border border-slate-700 rounded-lg">
                                <div className="text-sm text-slate-400 mb-1">Delta (Δ)</div>
                                <div className="flex items-center justify-between">
                                    <div className="text-2xl font-bold text-white">{result.delta.toFixed(4)}</div>
                                    <div className="text-xs text-slate-400">Price sensitivity</div>
                                </div>
                                <div className="mt-2 h-2 bg-slate-700 rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-gradient-to-r from-green-500 to-blue-500"
                                        style={{ width: `${Math.abs(result.delta) * 100}%` }}
                                    />
                                </div>
                            </div>

                            <div className="p-4 bg-slate-800/50 border border-slate-700 rounded-lg">
                                <div className="text-sm text-slate-400 mb-1">Gamma (Γ)</div>
                                <div className="flex items-center justify-between">
                                    <div className="text-2xl font-bold text-white">{result.gamma.toFixed(4)}</div>
                                    <div className="text-xs text-slate-400">Delta sensitivity</div>
                                </div>
                            </div>

                            <div className="p-4 bg-slate-800/50 border border-slate-700 rounded-lg">
                                <div className="text-sm text-slate-400 mb-1">Theta (Θ)</div>
                                <div className="flex items-center justify-between">
                                    <div className={`text-2xl font-bold ${result.theta < 0 ? 'text-red-400' : 'text-green-400'}`}>
                                        {result.theta.toFixed(4)}
                                    </div>
                                    <div className="text-xs text-slate-400">Time decay (daily)</div>
                                </div>
                            </div>

                            <div className="p-4 bg-slate-800/50 border border-slate-700 rounded-lg">
                                <div className="text-sm text-slate-400 mb-1">Vega (ν)</div>
                                <div className="flex items-center justify-between">
                                    <div className="text-2xl font-bold text-white">{result.vega.toFixed(4)}</div>
                                    <div className="text-xs text-slate-400">Vol sensitivity (1%)</div>
                                </div>
                            </div>

                            <div className="p-4 bg-slate-800/50 border border-slate-700 rounded-lg">
                                <div className="text-sm text-slate-400 mb-1">Rho (ρ)</div>
                                <div className="flex items-center justify-between">
                                    <div className="text-2xl font-bold text-white">{result.rho.toFixed(4)}</div>
                                    <div className="text-xs text-slate-400">Rate sensitivity (1%)</div>
                                </div>
                            </div>
                        </motion.div>
                    )}

                    {!result && !error && (
                        <div className="h-full flex items-center justify-center text-slate-500">
                            <div className="text-center">
                                <div className="text-6xl mb-4">📈</div>
                                <div>Adjust parameters and calculate Greeks</div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <div className="mt-6 p-4 bg-slate-800/30 border border-slate-700 rounded-lg">
                <div className="text-xs text-slate-400 space-y-1">
                    <div><strong>Delta:</strong> Change in option price for $1 move in underlying</div>
                    <div><strong>Gamma:</strong> Rate of change of delta</div>
                    <div><strong>Theta:</strong> Daily time decay (typically negative for long options)</div>
                    <div><strong>Vega:</strong> Change in price for 1% change in implied volatility</div>
                    <div><strong>Rho:</strong> Change in price for 1% change in interest rates</div>
                </div>
            </div>
        </div>
    );
}
