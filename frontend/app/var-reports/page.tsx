'use client';

import { useState } from 'react';
import Link from 'next/link';

interface VarResult {
    portfolio_value: number;
    confidence_level: number;
    time_horizon: number;
    var_amount: number;
    var_percent: number;
    cvar_amount: number;
    cvar_percent: number;
    expected_return: number;
    volatility: number;
    sharpe_ratio: number;
    symbols: string[];
    weights: number[];
}

interface HistogramBin {
    range_start: number;
    range_end: number;
    count: number;
    percentage: number;
}

interface MonteCarloResult {
    simulations: number;
    mean_return: number;
    std_return: number;
    percentile_5: number;
    percentile_25: number;
    percentile_50: number;
    percentile_75: number;
    percentile_95: number;
    worst_case: number;
    best_case: number;
    histogram: HistogramBin[];
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8001';

export default function VarReportsPage() {
    const [symbols, setSymbols] = useState('NVDA,AAPL,MSFT,GOOGL');
    const [portfolioValue, setPortfolioValue] = useState('100000');
    const [confidenceLevel, setConfidenceLevel] = useState('0.95');
    const [timeHorizon, setTimeHorizon] = useState('1');
    const [loading, setLoading] = useState(false);
    const [varResult, setVarResult] = useState<VarResult | null>(null);
    const [mcResult, setMcResult] = useState<MonteCarloResult | null>(null);

    const calculateVaR = async () => {
        setLoading(true);

        // Mock result for demo
        const mockResult: VarResult = {
            portfolio_value: parseFloat(portfolioValue),
            confidence_level: parseFloat(confidenceLevel),
            time_horizon: parseInt(timeHorizon),
            var_amount: parseFloat(portfolioValue) * 0.032,
            var_percent: 3.2,
            cvar_amount: parseFloat(portfolioValue) * 0.042,
            cvar_percent: 4.2,
            expected_return: 12.5,
            volatility: 28.4,
            sharpe_ratio: 0.44,
            symbols: symbols.split(',').map(s => s.trim()),
            weights: symbols.split(',').map(() => 1 / symbols.split(',').length),
        };

        // Generate mock histogram
        const mockHistogram: HistogramBin[] = [];
        const startVal = parseFloat(portfolioValue) * 0.7;
        const binWidth = parseFloat(portfolioValue) * 0.03;
        const normalDistribution = [2, 5, 12, 25, 35, 45, 55, 60, 58, 50, 40, 30, 20, 12, 8, 5, 3, 2, 1, 1];

        for (let i = 0; i < 20; i++) {
            mockHistogram.push({
                range_start: startVal + i * binWidth,
                range_end: startVal + (i + 1) * binWidth,
                count: normalDistribution[i] * 100,
                percentage: normalDistribution[i] / 5,
            });
        }

        const mockMC: MonteCarloResult = {
            simulations: 10000,
            mean_return: 8.5,
            std_return: 18.2,
            percentile_5: parseFloat(portfolioValue) * 0.78,
            percentile_25: parseFloat(portfolioValue) * 0.92,
            percentile_50: parseFloat(portfolioValue) * 1.08,
            percentile_75: parseFloat(portfolioValue) * 1.22,
            percentile_95: parseFloat(portfolioValue) * 1.42,
            worst_case: parseFloat(portfolioValue) * 0.52,
            best_case: parseFloat(portfolioValue) * 2.15,
            histogram: mockHistogram,
        };

        setTimeout(() => {
            setVarResult(mockResult);
            setMcResult(mockMC);
            setLoading(false);
        }, 1500);
    };

    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0,
        }).format(value);
    };

    const maxCount = mcResult ? Math.max(...mcResult.histogram.map(h => h.count)) : 0;

    return (
        <div className="min-h-screen bg-gray-950 text-white p-8">
            {/* Header */}
            <div className="mb-8">
                <Link href="/dashboard" className="text-red-400 hover:text-red-300 text-sm mb-2 block">
                    ← Back to Dashboard
                </Link>
                <h1 className="text-3xl font-bold bg-gradient-to-r from-red-400 to-orange-400 bg-clip-text text-transparent">
                    VaR/CVaR Risk Reports
                </h1>
                <p className="text-gray-400 mt-1">Calculate Value at Risk and run Monte Carlo simulations</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Input Panel */}
                <div className="bg-gray-900/50 rounded-xl border border-gray-800 p-6">
                    <h2 className="text-xl font-semibold mb-6">Portfolio Configuration</h2>

                    <div className="space-y-5">
                        <div>
                            <label className="block text-gray-400 text-sm mb-2">Ticker Symbols</label>
                            <input
                                type="text"
                                value={symbols}
                                onChange={(e) => setSymbols(e.target.value)}
                                placeholder="NVDA,AAPL,MSFT"
                                className="w-full p-3 bg-gray-800 border border-gray-700 rounded-lg focus:border-red-500 focus:outline-none"
                            />
                            <p className="text-xs text-gray-500 mt-1">Comma-separated tickers</p>
                        </div>

                        <div>
                            <label className="block text-gray-400 text-sm mb-2">Portfolio Value</label>
                            <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">$</span>
                                <input
                                    type="number"
                                    value={portfolioValue}
                                    onChange={(e) => setPortfolioValue(e.target.value)}
                                    className="w-full p-3 pl-7 bg-gray-800 border border-gray-700 rounded-lg focus:border-red-500 focus:outline-none"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-gray-400 text-sm mb-2">Confidence Level</label>
                            <div className="flex gap-2">
                                {['0.90', '0.95', '0.99'].map((level) => (
                                    <button
                                        key={level}
                                        onClick={() => setConfidenceLevel(level)}
                                        className={`flex-1 py-2 rounded-lg transition ${confidenceLevel === level
                                                ? 'bg-red-600 text-white'
                                                : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                                            }`}
                                    >
                                        {(parseFloat(level) * 100).toFixed(0)}%
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div>
                            <label className="block text-gray-400 text-sm mb-2">Time Horizon (Days)</label>
                            <div className="flex gap-2">
                                {['1', '5', '20'].map((days) => (
                                    <button
                                        key={days}
                                        onClick={() => setTimeHorizon(days)}
                                        className={`flex-1 py-2 rounded-lg transition ${timeHorizon === days
                                                ? 'bg-red-600 text-white'
                                                : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                                            }`}
                                    >
                                        {days}d
                                    </button>
                                ))}
                            </div>
                        </div>

                        <button
                            onClick={calculateVaR}
                            disabled={loading}
                            className="w-full py-4 bg-gradient-to-r from-red-500 to-orange-500 rounded-lg font-semibold hover:opacity-90 transition disabled:opacity-50 mt-4"
                        >
                            {loading ? 'Calculating...' : 'Calculate Risk Metrics'}
                        </button>
                    </div>
                </div>

                {/* Results Panel */}
                <div className="lg:col-span-2 space-y-6">
                    {varResult ? (
                        <>
                            {/* VaR/CVaR Cards */}
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                <div className="bg-gradient-to-br from-red-900/50 to-red-800/30 rounded-xl border border-red-700/50 p-5">
                                    <p className="text-red-300 text-sm mb-1">VaR ({(varResult.confidence_level * 100).toFixed(0)}%)</p>
                                    <p className="text-2xl font-bold text-red-400">{formatCurrency(varResult.var_amount)}</p>
                                    <p className="text-red-300 text-sm">{varResult.var_percent.toFixed(2)}%</p>
                                </div>
                                <div className="bg-gradient-to-br from-orange-900/50 to-orange-800/30 rounded-xl border border-orange-700/50 p-5">
                                    <p className="text-orange-300 text-sm mb-1">CVaR (ES)</p>
                                    <p className="text-2xl font-bold text-orange-400">{formatCurrency(varResult.cvar_amount)}</p>
                                    <p className="text-orange-300 text-sm">{varResult.cvar_percent.toFixed(2)}%</p>
                                </div>
                                <div className="bg-gray-900/50 rounded-xl border border-gray-800 p-5">
                                    <p className="text-gray-400 text-sm mb-1">Expected Return</p>
                                    <p className="text-2xl font-bold text-green-400">+{varResult.expected_return.toFixed(1)}%</p>
                                </div>
                                <div className="bg-gray-900/50 rounded-xl border border-gray-800 p-5">
                                    <p className="text-gray-400 text-sm mb-1">Sharpe Ratio</p>
                                    <p className="text-2xl font-bold">{varResult.sharpe_ratio.toFixed(2)}</p>
                                </div>
                            </div>

                            {/* Monte Carlo Histogram */}
                            {mcResult && (
                                <div className="bg-gray-900/50 rounded-xl border border-gray-800 p-6">
                                    <div className="flex justify-between items-start mb-6">
                                        <div>
                                            <h3 className="text-lg font-semibold">Monte Carlo Distribution</h3>
                                            <p className="text-gray-400 text-sm">{mcResult.simulations.toLocaleString()} simulations • 1 year horizon</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-sm text-gray-400">Mean Return</p>
                                            <p className="text-xl font-bold text-green-400">+{mcResult.mean_return.toFixed(1)}%</p>
                                        </div>
                                    </div>

                                    {/* Histogram */}
                                    <div className="h-48 flex items-end gap-1 mb-4">
                                        {mcResult.histogram.map((bin, i) => (
                                            <div
                                                key={i}
                                                className="flex-1 bg-gradient-to-t from-blue-600 to-blue-400 rounded-t opacity-80 hover:opacity-100 transition-opacity"
                                                style={{ height: `${(bin.count / maxCount) * 100}%` }}
                                                title={`${formatCurrency(bin.range_start)} - ${formatCurrency(bin.range_end)}: ${bin.count} simulations`}
                                            ></div>
                                        ))}
                                    </div>

                                    {/* Percentile Labels */}
                                    <div className="flex justify-between text-xs text-gray-400 border-t border-gray-800 pt-4">
                                        <div className="text-center">
                                            <p className="text-red-400 font-medium">5th %ile</p>
                                            <p>{formatCurrency(mcResult.percentile_5)}</p>
                                        </div>
                                        <div className="text-center">
                                            <p className="text-orange-400 font-medium">25th %ile</p>
                                            <p>{formatCurrency(mcResult.percentile_25)}</p>
                                        </div>
                                        <div className="text-center">
                                            <p className="text-yellow-400 font-medium">Median</p>
                                            <p>{formatCurrency(mcResult.percentile_50)}</p>
                                        </div>
                                        <div className="text-center">
                                            <p className="text-green-400 font-medium">75th %ile</p>
                                            <p>{formatCurrency(mcResult.percentile_75)}</p>
                                        </div>
                                        <div className="text-center">
                                            <p className="text-blue-400 font-medium">95th %ile</p>
                                            <p>{formatCurrency(mcResult.percentile_95)}</p>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Portfolio Breakdown */}
                            <div className="bg-gray-900/50 rounded-xl border border-gray-800 p-6">
                                <h3 className="text-lg font-semibold mb-4">Portfolio Allocation</h3>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                    {varResult.symbols.map((symbol, i) => (
                                        <div key={symbol} className="bg-gray-800/50 rounded-lg p-4 text-center">
                                            <p className="text-blue-400 font-bold text-lg">{symbol}</p>
                                            <p className="text-2xl font-semibold">{(varResult.weights[i] * 100).toFixed(1)}%</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </>
                    ) : (
                        <div className="bg-gray-900/50 rounded-xl border border-gray-800 p-12 text-center">
                            <div className="text-6xl mb-4">📊</div>
                            <h3 className="text-xl font-semibold mb-2">Configure Your Portfolio</h3>
                            <p className="text-gray-400">Enter portfolio details and click Calculate to see VaR, CVaR, and Monte Carlo results</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
