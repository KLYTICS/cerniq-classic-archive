'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    AreaChart,
    Area,
} from 'recharts';
import { TrendingUp, TrendingDown, Activity, Target, BarChart3, Play } from 'lucide-react';

interface BacktestResult {
    strategyName: string;
    startDate: string;
    endDate: string;
    initialCapital: number;
    finalValue: number;
    metrics: {
        totalReturn: number;
        sharpeRatio: number;
        maxDrawdown: number;
        winRate: number;
        profitFactor: number;
        totalTrades: number;
        avgTradesPerMonth: number;
    };
    trades: any[];
    equityCurve: { date: string; value: number }[];
}

const NODE_API_URL = (
    process.env.NEXT_PUBLIC_NODE_API_URL || ''
).trim().replace(/\/+$/, '');

export default function BacktestPage() {
    const [result, setResult] = useState<BacktestResult | null>(null);
    const [loading, setLoading] = useState(false);
    const [config, setConfig] = useState({
        strategyType: 'SMA_CROSSOVER',
        tickers: 'AAPL,GOOGL,MSFT',
        startDate: '2023-01-01',
        endDate: '2023-12-31',
        initialCapital: 100000,
        shortPeriod: 10,
        longPeriod: 30,
    });

    const runBacktest = async () => {
        setLoading(true);
        try {
            const strategy = {
                name: `${config.strategyType} (${config.shortPeriod}/${config.longPeriod})`,
                type: config.strategyType,
                lookbackPeriod: config.longPeriod + 10,
                params: { shortPeriod: config.shortPeriod, longPeriod: config.longPeriod },
            };

            const response = await fetch(`${NODE_API_URL}/api/execution/backtest`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    strategy,
                    tickers: config.tickers.split(',').map((t) => t.trim()),
                    startDate: config.startDate,
                    endDate: config.endDate,
                    initialCapital: config.initialCapital,
                    commission: 5,
                }),
            });

            const data = await response.json();
            setResult(data);
        } catch (error) {
            console.error('Backtest failed:', error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-8">
            {/* Header */}
            <motion.div
                className="mb-8"
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
            >
                <h1 className="text-4xl font-bold text-white mb-2">Strategy Backtesting</h1>
                <p className="text-slate-400">
                    Test trading strategies on historical data with institutional-grade analytics
                </p>
            </motion.div>

            {/* Configuration Panel */}
            <motion.div
                className="mb-8 p-6 bg-gradient-to-br from-slate-900 to-slate-800 rounded-xl border border-slate-700"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.1 }}
            >
                <h3 className="text-lg font-bold text-white mb-4">⚙️ Backtest Configuration</h3>
                <div className="grid grid-cols-4 gap-4">
                    <div>
                        <label className="block text-sm text-slate-400 mb-1">Strategy</label>
                        <select
                            value={config.strategyType}
                            onChange={(e) => setConfig({ ...config, strategyType: e.target.value })}
                            className="w-full px-4 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white"
                        >
                            <option value="SMA_CROSSOVER">SMA Crossover</option>
                            <option value="RSI_REVERSAL">RSI Mean Reversion</option>
                            <option value="MOMENTUM">Momentum</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm text-slate-400 mb-1">Tickers (comma-separated)</label>
                        <input
                            type="text"
                            value={config.tickers}
                            onChange={(e) => setConfig({ ...config, tickers: e.target.value })}
                            className="w-full px-4 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white"
                        />
                    </div>
                    <div>
                        <label className="block text-sm text-slate-400 mb-1">Start Date</label>
                        <input
                            type="date"
                            value={config.startDate}
                            onChange={(e) => setConfig({ ...config, startDate: e.target.value })}
                            className="w-full px-4 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white"
                        />
                    </div>
                    <div>
                        <label className="block text-sm text-slate-400 mb-1">End Date</label>
                        <input
                            type="date"
                            value={config.endDate}
                            onChange={(e) => setConfig({ ...config, endDate: e.target.value })}
                            className="w-full px-4 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white"
                        />
                    </div>
                    <div>
                        <label className="block text-sm text-slate-400 mb-1">Initial Capital</label>
                        <input
                            type="number"
                            value={config.initialCapital}
                            onChange={(e) => setConfig({ ...config, initialCapital: parseInt(e.target.value) })}
                            className="w-full px-4 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white"
                        />
                    </div>
                    <div>
                        <label className="block text-sm text-slate-400 mb-1">Short Period</label>
                        <input
                            type="number"
                            value={config.shortPeriod}
                            onChange={(e) => setConfig({ ...config, shortPeriod: parseInt(e.target.value) })}
                            className="w-full px-4 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white"
                        />
                    </div>
                    <div>
                        <label className="block text-sm text-slate-400 mb-1">Long Period</label>
                        <input
                            type="number"
                            value={config.longPeriod}
                            onChange={(e) => setConfig({ ...config, longPeriod: parseInt(e.target.value) })}
                            className="w-full px-4 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white"
                        />
                    </div>
                    <div className="flex items-end">
                        <button
                            onClick={runBacktest}
                            disabled={loading}
                            className="w-full px-6 py-2 bg-purple-500 hover:bg-purple-600 disabled:bg-slate-600 rounded-lg text-white font-semibold flex items-center justify-center gap-2 transition-colors"
                        >
                            {loading ? (
                                <>Running...</>
                            ) : (
                                <>
                                    <Play className="w-4 h-4" /> Run Backtest
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </motion.div>

            {result && (
                <>
                    {/* Performance Metrics */}
                    <div className="grid grid-cols-6 gap-4 mb-8">
                        <MetricCard
                            icon={<TrendingUp className="w-6 h-6" />}
                            label="Total Return"
                            value={`${result.metrics.totalReturn.toFixed(2)}%`}
                            color={result.metrics.totalReturn >= 0 ? 'green' : 'red'}
                        />
                        <MetricCard
                            icon={<Activity className="w-6 h-6" />}
                            label="Sharpe Ratio"
                            value={result.metrics.sharpeRatio.toFixed(2)}
                            color={result.metrics.sharpeRatio >= 1 ? 'green' : 'yellow'}
                        />
                        <MetricCard
                            icon={<TrendingDown className="w-6 h-6" />}
                            label="Max Drawdown"
                            value={`-${result.metrics.maxDrawdown.toFixed(2)}%`}
                            color="red"
                        />
                        <MetricCard
                            icon={<Target className="w-6 h-6" />}
                            label="Win Rate"
                            value={`${result.metrics.winRate.toFixed(1)}%`}
                            color={result.metrics.winRate >= 50 ? 'green' : 'yellow'}
                        />
                        <MetricCard
                            icon={<BarChart3 className="w-6 h-6" />}
                            label="Profit Factor"
                            value={result.metrics.profitFactor.toFixed(2)}
                            color={result.metrics.profitFactor >= 1.5 ? 'green' : 'yellow'}
                        />
                        <MetricCard
                            icon={<Activity className="w-6 h-6" />}
                            label="Total Trades"
                            value={result.metrics.totalTrades.toString()}
                            color="blue"
                        />
                    </div>

                    {/* Equity Curve */}
                    <motion.div
                        className="mb-8 p-6 bg-gradient-to-br from-slate-900 to-slate-800 rounded-xl border border-slate-700"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                    >
                        <h3 className="text-xl font-bold text-white mb-4">📈 Equity Curve</h3>
                        <div className="flex justify-between text-sm text-slate-400 mb-4">
                            <span>Initial: ${result.initialCapital.toLocaleString()}</span>
                            <span>Final: ${result.finalValue.toLocaleString()}</span>
                            <span>
                                P&L: ${(result.finalValue - result.initialCapital).toLocaleString()} (
                                {result.metrics.totalReturn.toFixed(2)}%)
                            </span>
                        </div>
                        <div className="h-80">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={result.equityCurve}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                                    <XAxis dataKey="date" stroke="#94a3b8" />
                                    <YAxis stroke="#94a3b8" domain={['auto', 'auto']} />
                                    <Tooltip
                                        contentStyle={{
                                            backgroundColor: '#1e293b',
                                            border: '1px solid #475569',
                                            borderRadius: '8px',
                                        }}
                                        formatter={(value: number | undefined) => [`$${(value || 0).toLocaleString()}`, 'Portfolio Value']}
                                    />
                                    <Area
                                        type="monotone"
                                        dataKey="value"
                                        stroke={result.metrics.totalReturn >= 0 ? '#10b981' : '#ef4444'}
                                        fill={result.metrics.totalReturn >= 0 ? '#10b981' : '#ef4444'}
                                        fillOpacity={0.3}
                                        strokeWidth={2}
                                    />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </motion.div>

                    {/* Trade Log */}
                    <motion.div
                        className="p-6 bg-gradient-to-br from-slate-900 to-slate-800 rounded-xl border border-slate-700"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                    >
                        <h3 className="text-xl font-bold text-white mb-4">📋 Trade Log</h3>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="text-slate-400 border-b border-slate-700">
                                        <th className="py-2 px-3 text-left">Date</th>
                                        <th className="py-2 px-3 text-left">Ticker</th>
                                        <th className="py-2 px-3 text-left">Action</th>
                                        <th className="py-2 px-3 text-right">Shares</th>
                                        <th className="py-2 px-3 text-right">Price</th>
                                        <th className="py-2 px-3 text-left">Reason</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {result.trades.slice(0, 20).map((trade, idx) => (
                                        <tr key={idx} className="border-b border-slate-800">
                                            <td className="py-2 px-3 text-slate-300">{trade.date}</td>
                                            <td className="py-2 px-3 text-white font-semibold">{trade.ticker}</td>
                                            <td className="py-2 px-3">
                                                <span
                                                    className={`px-2 py-1 rounded text-xs font-semibold ${trade.action === 'BUY'
                                                        ? 'bg-green-500/20 text-green-400'
                                                        : 'bg-red-500/20 text-red-400'
                                                        }`}
                                                >
                                                    {trade.action}
                                                </span>
                                            </td>
                                            <td className="py-2 px-3 text-right text-slate-300">{trade.shares}</td>
                                            <td className="py-2 px-3 text-right text-white">
                                                ${trade.price.toFixed(2)}
                                            </td>
                                            <td className="py-2 px-3 text-slate-400">{trade.reason}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            {result.trades.length > 20 && (
                                <div className="text-center py-2 text-slate-400 text-sm">
                                    ... and {result.trades.length - 20} more trades
                                </div>
                            )}
                        </div>
                    </motion.div>
                </>
            )}
        </div>
    );
}

function MetricCard({
    icon,
    label,
    value,
    color,
}: {
    icon: React.ReactNode;
    label: string;
    value: string;
    color: 'green' | 'red' | 'yellow' | 'blue';
}) {
    const colorClasses = {
        green: 'from-green-900/20 to-green-800/10 border-green-700/30 text-green-400',
        red: 'from-red-900/20 to-red-800/10 border-red-700/30 text-red-400',
        yellow: 'from-yellow-900/20 to-yellow-800/10 border-yellow-700/30 text-yellow-400',
        blue: 'from-blue-900/20 to-blue-800/10 border-blue-700/30 text-blue-400',
    };

    return (
        <motion.div
            className={`p-4 bg-gradient-to-br ${colorClasses[color]} border rounded-xl`}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
        >
            <div className={`mb-2 ${colorClasses[color].split(' ').pop()}`}>{icon}</div>
            <div className="text-xs text-slate-400 uppercase">{label}</div>
            <div className="text-2xl font-bold text-white">{value}</div>
        </motion.div>
    );
}
