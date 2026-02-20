'use client';

import { useState } from 'react';
import Link from 'next/link';

interface RiskParityResult {
    symbols: string[];
    optimal_weights: number[];
    risk_contributions: number[];
    equal_risk_contribution: number;
    portfolio_volatility: number;
    expected_return: number;
    sharpe_ratio: number;
}

export default function RiskParityPage() {
    const [symbols, setSymbols] = useState(['SPY', 'TLT', 'GLD', 'VNQ']);
    const [newSymbol, setNewSymbol] = useState('');
    const [targetVol, setTargetVol] = useState('15');
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<RiskParityResult | null>(null);

    const addSymbol = () => {
        if (newSymbol && !symbols.includes(newSymbol.toUpperCase())) {
            setSymbols([...symbols, newSymbol.toUpperCase()]);
            setNewSymbol('');
        }
    };

    const removeSymbol = (symbol: string) => {
        setSymbols(symbols.filter(s => s !== symbol));
    };

    const calculateParity = async () => {
        setLoading(true);

        // Mock calculation with realistic risk parity weights
        const assetVols: Record<string, number> = {
            'SPY': 0.18, 'QQQ': 0.25, 'TLT': 0.12, 'GLD': 0.15, 'VNQ': 0.22,
            'NVDA': 0.50, 'AAPL': 0.28, 'MSFT': 0.26, 'META': 0.38, 'AMD': 0.45,
            'XOM': 0.28, 'JPM': 0.24, 'JNJ': 0.16, 'UNH': 0.20, 'HD': 0.22,
        };

        const invVols = symbols.map(s => 1 / (assetVols[s] || 0.25));
        const sumInv = invVols.reduce((a, b) => a + b, 0);
        const weights = invVols.map(v => v / sumInv);

        // Calculate risk contributions
        const portVol = symbols.reduce((acc, s, i) => {
            const vol = assetVols[s] || 0.25;
            return acc + weights[i] * weights[i] * vol * vol;
        }, 0) ** 0.5;

        const riskContribs = symbols.map((s, i) => {
            const vol = assetVols[s] || 0.25;
            return (weights[i] * vol * vol) / (portVol * portVol) * 100;
        });

        setTimeout(() => {
            setResult({
                symbols,
                optimal_weights: weights,
                risk_contributions: riskContribs,
                equal_risk_contribution: 100 / symbols.length,
                portfolio_volatility: portVol * 100,
                expected_return: weights.reduce((acc, w) => acc + w * 0.08, 0) * 100,
                sharpe_ratio: 0.52,
            });
            setLoading(false);
        }, 1000);
    };

    const colors = ['#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#6366f1', '#14b8a6', '#f43f5e'];

    return (
        <div className="min-h-screen bg-gray-950 text-white p-8">
            {/* Header */}
            <div className="mb-8">
                <Link href="/dashboard" className="text-teal-400 hover:text-teal-300 text-sm mb-2 block">
                    ← Back to Dashboard
                </Link>
                <h1 className="text-3xl font-bold bg-gradient-to-r from-teal-400 to-cyan-400 bg-clip-text text-transparent">
                    Risk Parity Portfolio
                </h1>
                <p className="text-gray-400 mt-1">Build risk-balanced portfolios where each asset contributes equal risk</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Asset Selection */}
                <div className="bg-gray-900/50 rounded-xl border border-gray-800 p-6">
                    <h2 className="text-xl font-semibold mb-6">Select Assets</h2>

                    {/* Add Symbol */}
                    <div className="flex gap-2 mb-4">
                        <input
                            type="text"
                            value={newSymbol}
                            onChange={(e) => setNewSymbol(e.target.value.toUpperCase())}
                            placeholder="Add ticker..."
                            className="flex-1 p-3 bg-gray-800 border border-gray-700 rounded-lg focus:border-teal-500 focus:outline-none uppercase"
                            onKeyDown={(e) => e.key === 'Enter' && addSymbol()}
                        />
                        <button
                            onClick={addSymbol}
                            className="px-4 bg-teal-600 hover:bg-teal-500 rounded-lg transition"
                        >
                            +
                        </button>
                    </div>

                    {/* Selected Symbols */}
                    <div className="flex flex-wrap gap-2 mb-6">
                        {symbols.map((symbol, i) => (
                            <span
                                key={symbol}
                                className="px-3 py-2 rounded-lg text-sm font-medium flex items-center gap-2"
                                style={{ backgroundColor: colors[i % colors.length] + '30', color: colors[i % colors.length] }}
                            >
                                {symbol}
                                <button
                                    onClick={() => removeSymbol(symbol)}
                                    className="hover:opacity-70"
                                >
                                    ×
                                </button>
                            </span>
                        ))}
                    </div>

                    {/* Quick Add */}
                    <div className="mb-6">
                        <p className="text-sm text-gray-400 mb-2">Quick Add:</p>
                        <div className="flex flex-wrap gap-2">
                            {['NVDA', 'AAPL', 'BND', 'VTI', 'VXUS'].map((s) => (
                                <button
                                    key={s}
                                    onClick={() => !symbols.includes(s) && setSymbols([...symbols, s])}
                                    disabled={symbols.includes(s)}
                                    className="px-3 py-1 text-sm bg-gray-800 hover:bg-gray-700 rounded-lg disabled:opacity-50 transition"
                                >
                                    {s}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Target Volatility */}
                    <div className="mb-6">
                        <label className="block text-gray-400 text-sm mb-2">Target Volatility</label>
                        <div className="flex gap-2">
                            {['10', '15', '20'].map((vol) => (
                                <button
                                    key={vol}
                                    onClick={() => setTargetVol(vol)}
                                    className={`flex-1 py-2 rounded-lg transition ${targetVol === vol
                                            ? 'bg-teal-600 text-white'
                                            : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                                        }`}
                                >
                                    {vol}%
                                </button>
                            ))}
                        </div>
                    </div>

                    <button
                        onClick={calculateParity}
                        disabled={loading || symbols.length < 2}
                        className="w-full py-4 bg-gradient-to-r from-teal-500 to-cyan-500 rounded-lg font-semibold hover:opacity-90 transition disabled:opacity-50"
                    >
                        {loading ? 'Optimizing...' : 'Calculate Optimal Weights'}
                    </button>
                </div>

                {/* Results */}
                <div className="lg:col-span-2">
                    {result ? (
                        <div className="space-y-6">
                            {/* Stats Cards */}
                            <div className="grid grid-cols-3 gap-4">
                                <div className="bg-gray-900/50 rounded-xl border border-gray-800 p-5">
                                    <p className="text-gray-400 text-sm mb-1">Portfolio Volatility</p>
                                    <p className="text-2xl font-bold text-teal-400">{result.portfolio_volatility.toFixed(1)}%</p>
                                </div>
                                <div className="bg-gray-900/50 rounded-xl border border-gray-800 p-5">
                                    <p className="text-gray-400 text-sm mb-1">Expected Return</p>
                                    <p className="text-2xl font-bold text-green-400">+{result.expected_return.toFixed(1)}%</p>
                                </div>
                                <div className="bg-gray-900/50 rounded-xl border border-gray-800 p-5">
                                    <p className="text-gray-400 text-sm mb-1">Sharpe Ratio</p>
                                    <p className="text-2xl font-bold">{result.sharpe_ratio.toFixed(2)}</p>
                                </div>
                            </div>

                            {/* Weight & Risk Contribution */}
                            <div className="bg-gray-900/50 rounded-xl border border-gray-800 p-6">
                                <h3 className="text-lg font-semibold mb-6">Optimal Allocation</h3>

                                <div className="space-y-4">
                                    {result.symbols.map((symbol, i) => (
                                        <div key={symbol} className="flex items-center gap-4">
                                            <div className="w-16 font-bold text-lg" style={{ color: colors[i % colors.length] }}>
                                                {symbol}
                                            </div>
                                            <div className="flex-1">
                                                <div className="flex justify-between text-sm text-gray-400 mb-1">
                                                    <span>Weight: {(result.optimal_weights[i] * 100).toFixed(1)}%</span>
                                                    <span>Risk Contribution: {result.risk_contributions[i].toFixed(1)}%</span>
                                                </div>
                                                <div className="h-4 bg-gray-800 rounded-full overflow-hidden flex">
                                                    <div
                                                        className="h-full transition-all"
                                                        style={{
                                                            width: `${result.optimal_weights[i] * 100}%`,
                                                            backgroundColor: colors[i % colors.length],
                                                        }}
                                                    ></div>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                {/* Target Line */}
                                <div className="mt-6 pt-4 border-t border-gray-800">
                                    <div className="flex justify-between items-center text-sm">
                                        <span className="text-gray-400">Target Equal Risk Contribution:</span>
                                        <span className="font-medium text-teal-400">{result.equal_risk_contribution.toFixed(1)}% each</span>
                                    </div>
                                </div>
                            </div>

                            {/* Pie Chart Visualization */}
                            <div className="bg-gray-900/50 rounded-xl border border-gray-800 p-6">
                                <h3 className="text-lg font-semibold mb-4">Weight Distribution</h3>
                                <div className="flex items-center justify-center gap-8">
                                    {/* Simple SVG Pie */}
                                    <svg viewBox="0 0 100 100" className="w-48 h-48">
                                        {(() => {
                                            let currentAngle = 0;
                                            return result.symbols.map((symbol, i) => {
                                                const weight = result.optimal_weights[i];
                                                const angle = weight * 360;
                                                const startAngle = currentAngle;
                                                currentAngle += angle;

                                                const x1 = 50 + 45 * Math.cos((startAngle - 90) * Math.PI / 180);
                                                const y1 = 50 + 45 * Math.sin((startAngle - 90) * Math.PI / 180);
                                                const x2 = 50 + 45 * Math.cos((startAngle + angle - 90) * Math.PI / 180);
                                                const y2 = 50 + 45 * Math.sin((startAngle + angle - 90) * Math.PI / 180);
                                                const largeArc = angle > 180 ? 1 : 0;

                                                return (
                                                    <path
                                                        key={symbol}
                                                        d={`M 50 50 L ${x1} ${y1} A 45 45 0 ${largeArc} 1 ${x2} ${y2} Z`}
                                                        fill={colors[i % colors.length]}
                                                        className="hover:opacity-80 transition-opacity"
                                                    />
                                                );
                                            });
                                        })()}
                                    </svg>

                                    {/* Legend */}
                                    <div className="space-y-2">
                                        {result.symbols.map((symbol, i) => (
                                            <div key={symbol} className="flex items-center gap-3">
                                                <div
                                                    className="w-4 h-4 rounded"
                                                    style={{ backgroundColor: colors[i % colors.length] }}
                                                ></div>
                                                <span className="font-medium">{symbol}</span>
                                                <span className="text-gray-400">{(result.optimal_weights[i] * 100).toFixed(1)}%</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="bg-gray-900/50 rounded-xl border border-gray-800 p-12 text-center h-full flex flex-col items-center justify-center">
                            <div className="text-6xl mb-4">⚖️</div>
                            <h3 className="text-xl font-semibold mb-2">Build a Risk Parity Portfolio</h3>
                            <p className="text-gray-400 max-w-md">
                                Select at least 2 assets to calculate optimal weights where each asset contributes equal risk to the portfolio
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
