'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ResponsiveContainer, Area, AreaChart } from 'recharts';

interface StrategyLeg {
    strike: number;
    expiration: string;
    optionType: 'call' | 'put';
    quantity: number;
    buySell: 'buy' | 'sell';
}

interface PayoffPoint {
    underlyingPrice: number;
    profitLoss: number;
}

interface StrategyResult {
    strategyName: string;
    payoff: PayoffPoint[];
    breakEvens: number[];
    maxProfit: number;
    maxLoss: number;
    greeks: {
        delta: number;
        gamma: number;
        theta: number;
        vega: number;
    };
    initialCost: number;
}

const STRATEGY_PRESETS = [
    {
        name: 'Bull Call Spread',
        description: 'Bullish limited risk/reward',
        legs: [
            { strike: 100, optionType: 'call' as const, quantity: 1, buySell: 'buy' as const },
            { strike: 110, optionType: 'call' as const, quantity: 1, buySell: 'sell' as const },
        ],
    },
    {
        name: 'Bear Put Spread',
        description: 'Bearish limited risk/reward',
        legs: [
            { strike: 110, optionType: 'put' as const, quantity: 1, buySell: 'buy' as const },
            { strike: 100, optionType: 'put' as const, quantity: 1, buySell: 'sell' as const },
        ],
    },
    {
        name: 'Long Straddle',
        description: 'High volatility play',
        legs: [
            { strike: 105, optionType: 'call' as const, quantity: 1, buySell: 'buy' as const },
            { strike: 105, optionType: 'put' as const, quantity: 1, buySell: 'buy' as const },
        ],
    },
    {
        name: 'Iron Condor',
        description: 'Neutral income strategy',
        legs: [
            { strike: 95, optionType: 'put' as const, quantity: 1, buySell: 'buy' as const },
            { strike: 100, optionType: 'put' as const, quantity: 1, buySell: 'sell' as const },
            { strike: 110, optionType: 'call' as const, quantity: 1, buySell: 'sell' as const },
            { strike: 115, optionType: 'call' as const, quantity: 1, buySell: 'buy' as const },
        ],
    },
];

export function StrategyBuilder() {
    const [legs, setLegs] = useState<StrategyLeg[]>([]);
    const [underlyingPrice, setUnderlyingPrice] = useState(105);
    const [volatility, setVolatility] = useState(0.30);
    const [result, setResult] = useState<StrategyResult | null>(null);
    const [loading, setLoading] = useState(false);

    const addLeg = () => {
        const newLeg: StrategyLeg = {
            strike: underlyingPrice,
            expiration: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            optionType: 'call',
            quantity: 1,
            buySell: 'buy',
        };
        setLegs([...legs, newLeg]);
    };

    const updateLeg = (index: number, updates: Partial<StrategyLeg>) => {
        const newLegs = [...legs];
        newLegs[index] = { ...newLegs[index], ...updates };
        setLegs(newLegs);
    };

    const removeLeg = (index: number) => {
        setLegs(legs.filter((_, i) => i !== index));
    };

    const loadPreset = (preset: typeof STRATEGY_PRESETS[0]) => {
        const expiration = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        const newLegs = preset.legs.map(leg => ({
            ...leg,
            strike: leg.strike === 100 ? underlyingPrice - 5 :
                leg.strike === 105 ? underlyingPrice :
                    leg.strike === 110 ? underlyingPrice + 5 :
                        leg.strike === 95 ? underlyingPrice - 10 :
                            leg.strike === 115 ? underlyingPrice + 10 : leg.strike,
            expiration,
        }));
        setLegs(newLegs);
    };

    const calculateStrategy = async () => {
        if (legs.length === 0) return;

        const NODE_API_URL = (process.env.NEXT_PUBLIC_NODE_API_URL || '').trim().replace(/\/+$/, '');
        setLoading(true);
        try {
            const response = await fetch(`${NODE_API_URL}/api/options/strategy`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    legs,
                    underlyingPrice,
                    volatility,
                    riskFreeRate: 0.05,
                }),
            });

            const data = await response.json();
            setResult(data);
        } catch (err) {
            console.error('Failed to calculate strategy:', err);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="w-full max-w-7xl mx-auto p-6 space-y-6">
            <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl shadow-2xl border border-slate-700 p-6">
                <h2 className="text-3xl font-bold text-white mb-6 flex items-center gap-3">
                    <span className="text-4xl">🎯</span>
                    Options Strategy Builder
                </h2>

                {/* Parameters */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">
                            Underlying Price: ${underlyingPrice.toFixed(2)}
                        </label>
                        <input
                            type="range"
                            min="50"
                            max="200"
                            step="1"
                            value={underlyingPrice}
                            onChange={(e) => setUnderlyingPrice(Number(e.target.value))}
                            className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">
                            Implied Volatility: {(volatility * 100).toFixed(0)}%
                        </label>
                        <input
                            type="range"
                            min="0.10"
                            max="1.0"
                            step="0.05"
                            value={volatility}
                            onChange={(e) => setVolatility(Number(e.target.value))}
                            className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-purple-500"
                        />
                    </div>
                </div>

                {/* Preset Strategies */}
                <div className="mb-6">
                    <h3 className="text-lg font-semibold text-white mb-3">Load Preset Strategy</h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        {STRATEGY_PRESETS.map((preset) => (
                            <button
                                key={preset.name}
                                onClick={() => loadPreset(preset)}
                                className="p-3 bg-slate-800 hover:bg-slate-700 border border-slate-600 rounded-lg text-left transition-all group"
                            >
                                <div className="text-sm font-semibold text-white group-hover:text-blue-400 transition-colors">
                                    {preset.name}
                                </div>
                                <div className="text-xs text-slate-400 mt-1">{preset.description}</div>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Legs */}
                <div className="space-y-3 mb-6">
                    <div className="flex items-center justify-between">
                        <h3 className="text-lg font-semibold text-white">Strategy Legs ({legs.length})</h3>
                        <button
                            onClick={addLeg}
                            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
                        >
                            + Add Leg
                        </button>
                    </div>

                    <AnimatePresence>
                        {legs.map((leg, index) => (
                            <motion.div
                                key={index}
                                initial={{ opacity: 0, y: -10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, x: -100 }}
                                className="grid grid-cols-12 gap-3 p-4 bg-slate-800 border border-slate-700 rounded-lg"
                            >
                                <div className="col-span-2">
                                    <label className="block text-xs text-slate-400 mb-1">Type</label>
                                    <select
                                        value={leg.buySell}
                                        onChange={(e) => updateLeg(index, { buySell: e.target.value as 'buy' | 'sell' })}
                                        className={`w-full px-2 py-1 rounded text-sm font-semibold ${leg.buySell === 'buy'
                                                ? 'bg-green-600 text-white'
                                                : 'bg-red-600 text-white'
                                            }`}
                                    >
                                        <option value="buy">BUY</option>
                                        <option value="sell">SELL</option>
                                    </select>
                                </div>

                                <div className="col-span-2">
                                    <label className="block text-xs text-slate-400 mb-1">Qty</label>
                                    <input
                                        type="number"
                                        min="1"
                                        value={leg.quantity}
                                        onChange={(e) => updateLeg(index, { quantity: Number(e.target.value) })}
                                        className="w-full px-2 py-1 bg-slate-900 text-white rounded text-sm"
                                    />
                                </div>

                                <div className="col-span-2">
                                    <label className="block text-xs text-slate-400 mb-1">Option</label>
                                    <select
                                        value={leg.optionType}
                                        onChange={(e) => updateLeg(index, { optionType: e.target.value as 'call' | 'put' })}
                                        className="w-full px-2 py-1 bg-slate-900 text-white rounded text-sm"
                                    >
                                        <option value="call">Call</option>
                                        <option value="put">Put</option>
                                    </select>
                                </div>

                                <div className="col-span-2">
                                    <label className="block text-xs text-slate-400 mb-1">Strike</label>
                                    <input
                                        type="number"
                                        value={leg.strike}
                                        onChange={(e) => updateLeg(index, { strike: Number(e.target.value) })}
                                        className="w-full px-2 py-1 bg-slate-900 text-white rounded text-sm"
                                    />
                                </div>

                                <div className="col-span-3">
                                    <label className="block text-xs text-slate-400 mb-1">Expiration</label>
                                    <input
                                        type="date"
                                        value={leg.expiration}
                                        onChange={(e) => updateLeg(index, { expiration: e.target.value })}
                                        className="w-full px-2 py-1 bg-slate-900 text-white rounded text-sm"
                                    />
                                </div>

                                <div className="col-span-1 flex items-end">
                                    <button
                                        onClick={() => removeLeg(index)}
                                        className="w-full px-2 py-1 bg-red-900 hover:bg-red-800 text-red-200 rounded text-sm"
                                    >
                                        ✕
                                    </button>
                                </div>
                            </motion.div>
                        ))}
                    </AnimatePresence>

                    {legs.length === 0 && (
                        <div className="text-center py-8 text-slate-500">
                            <div className="text-5xl mb-3">📊</div>
                            <div>No legs added. Click &quot;Add Leg&quot; or load a preset.</div>
                        </div>
                    )}
                </div>

                <button
                    onClick={calculateStrategy}
                    disabled={loading || legs.length === 0}
                    className="w-full py-3 px-6 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-bold rounded-lg shadow-lg transition-all disabled:opacity-50"
                >
                    {loading ? 'Calculating...' : 'Calculate Strategy'}
                </button>
            </div>

            {/* Results */}
            {result && (
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl shadow-2xl border border-slate-700 p-6"
                >
                    <div className="mb-6">
                        <h3 className="text-2xl font-bold text-white mb-2">{result.strategyName}</h3>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div className="p-4 bg-slate-800 rounded-lg">
                                <div className="text-xs text-slate-400">Max Profit</div>
                                <div className={`text-2xl font-bold ${result.maxProfit > 0 ? 'text-green-400' : 'text-slate-400'}`}>
                                    ${result.maxProfit.toFixed(0)}
                                </div>
                            </div>
                            <div className="p-4 bg-slate-800 rounded-lg">
                                <div className="text-xs text-slate-400">Max Loss</div>
                                <div className={`text-2xl font-bold ${result.maxLoss < 0 ? 'text-red-400' : 'text-slate-400'}`}>
                                    ${result.maxLoss.toFixed(0)}
                                </div>
                            </div>
                            <div className="p-4 bg-slate-800 rounded-lg">
                                <div className="text-xs text-slate-400">Initial Cost</div>
                                <div className="text-2xl font-bold text-white">${result.initialCost.toFixed(0)}</div>
                            </div>
                            <div className="p-4 bg-slate-800 rounded-lg">
                                <div className="text-xs text-slate-400">Break-Evens</div>
                                <div className="text-2xl font-bold text-blue-400">
                                    {result.breakEvens.length > 0 ? result.breakEvens.length : 'N/A'}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Payoff Diagram */}
                    <div className="mb-6">
                        <h4 className="text-lg font-semibold text-white mb-4">Profit/Loss at Expiration</h4>
                        <ResponsiveContainer width="100%" height={400}>
                            <AreaChart data={result.payoff}>
                                <defs>
                                    <linearGradient id="profitGradient" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor="#10b981" stopOpacity={0.8} />
                                        <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
                                    </linearGradient>
                                    <linearGradient id="lossGradient" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor="#ef4444" stopOpacity={0} />
                                        <stop offset="100%" stopColor="#ef4444" stopOpacity={0.8} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                                <XAxis
                                    dataKey="underlyingPrice"
                                    stroke="#94a3b8"
                                    label={{ value: 'Underlying Price', position: 'insideBottom', offset: -5, fill: '#94a3b8' }}
                                />
                                <YAxis
                                    stroke="#94a3b8"
                                    label={{ value: 'Profit/Loss ($)', angle: -90, position: 'insideLeft', fill: '#94a3b8' }}
                                />
                                <Tooltip
                                    contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569', borderRadius: '8px' }}
                                    labelStyle={{ color: '#e2e8f0' }}
                                    itemStyle={{ color: '#94a3b8' }}
                                />
                                <ReferenceLine y={0} stroke="#64748b" strokeWidth={2} />
                                <ReferenceLine x={underlyingPrice} stroke="#3b82f6" strokeDasharray="5 5" strokeWidth={2} />
                                {result.breakEvens.map((be, i) => (
                                    <ReferenceLine key={i} x={be} stroke="#fbbf24" strokeDasharray="3 3" strokeWidth={2} />
                                ))}
                                <Area
                                    type="monotone"
                                    dataKey="profitLoss"
                                    stroke="#6366f1"
                                    strokeWidth={3}
                                    fill="url(#profitGradient)"
                                    fillOpacity={1}
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                        <div className="flex gap-4 mt-4 text-sm">
                            <div className="flex items-center gap-2">
                                <div className="w-4 h-4 bg-blue-500 rounded"></div>
                                <span className="text-slate-400">Current Price</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="w-4 h-4 bg-yellow-500 rounded"></div>
                                <span className="text-slate-400">Break-Even</span>
                            </div>
                        </div>
                    </div>

                    {/* Greeks */}
                    <div>
                        <h4 className="text-lg font-semibold text-white mb-4">Portfolio Greeks</h4>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            <div className="p-3 bg-slate-800 rounded-lg">
                                <div className="text-xs text-slate-400">Delta</div>
                                <div className="text-xl font-bold text-white">{(result.greeks.delta || 0).toFixed(0)}</div>
                            </div>
                            <div className="p-3 bg-slate-800 rounded-lg">
                                <div className="text-xs text-slate-400">Gamma</div>
                                <div className="text-xl font-bold text-white">{(result.greeks.gamma || 0).toFixed(0)}</div>
                            </div>
                            <div className="p-3 bg-slate-800 rounded-lg">
                                <div className="text-xs text-slate-400">Theta</div>
                                <div className={`text-xl font-bold ${result.greeks.theta < 0 ? 'text-red-400' : 'text-green-400'}`}>
                                    {(result.greeks.theta || 0).toFixed(0)}
                                </div>
                            </div>
                            <div className="p-3 bg-slate-800 rounded-lg">
                                <div className="text-xs text-slate-400">Vega</div>
                                <div className="text-xl font-bold text-white">{(result.greeks.vega || 0).toFixed(0)}</div>
                            </div>
                        </div>
                    </div>
                </motion.div>
            )}
        </div>
    );
}
