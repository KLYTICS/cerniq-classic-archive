'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { CheckCircle, XCircle, AlertTriangle, BarChart3, Clock, DollarSign } from 'lucide-react';

interface SlippageAnalysis {
    ticker: string;
    executionPrice: number;
    midPrice: number;
    slippageBps: number;
    slippageCost: number;
    quality: 'EXCELLENT' | 'GOOD' | 'FAIR' | 'POOR';
    side: 'BUY' | 'SELL';
    quantity: number;
    notional: number;
}

export default function ExecutionQualityPage() {
    const [executions, setExecutions] = useState([
        { ticker: 'AAPL', executionPrice: 175.50, side: 'BUY', quantity: 100 },
        { ticker: 'GOOGL', executionPrice: 140.25, side: 'BUY', quantity: 50 },
        { ticker: 'MSFT', executionPrice: 380.00, side: 'SELL', quantity: 30 },
    ]);
    const [analyses, setAnalyses] = useState<SlippageAnalysis[]>([]);
    const [loading, setLoading] = useState(false);

    const analyzeExecutions = async () => {
        setLoading(true);
        const results: SlippageAnalysis[] = [];

        for (const exec of executions) {
            try {
                const response = await fetch('http://localhost:3000/api/execution/slippage', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        ...exec,
                        executionTime: new Date().toISOString(),
                    }),
                });
                const data = await response.json();
                results.push(data);
            } catch (error) {
                console.error('Analysis failed:', error);
            }
        }

        setAnalyses(results);
        setLoading(false);
    };

    const getQualityIcon = (quality: string) => {
        switch (quality) {
            case 'EXCELLENT':
                return <CheckCircle className="w-5 h-5 text-green-400" />;
            case 'GOOD':
                return <CheckCircle className="w-5 h-5 text-blue-400" />;
            case 'FAIR':
                return <AlertTriangle className="w-5 h-5 text-yellow-400" />;
            case 'POOR':
                return <XCircle className="w-5 h-5 text-red-400" />;
            default:
                return null;
        }
    };

    const getQualityColor = (quality: string) => {
        switch (quality) {
            case 'EXCELLENT':
                return 'bg-green-500/20 text-green-400 border-green-500/30';
            case 'GOOD':
                return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
            case 'FAIR':
                return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
            case 'POOR':
                return 'bg-red-500/20 text-red-400 border-red-500/30';
            default:
                return '';
        }
    };

    // Calculate summary stats
    const avgSlippage = analyses.length > 0
        ? analyses.reduce((sum, a) => sum + a.slippageBps, 0) / analyses.length
        : 0;
    const totalCost = analyses.reduce((sum, a) => sum + a.slippageCost, 0);
    const excellentCount = analyses.filter((a) => a.quality === 'EXCELLENT').length;

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-8">
            {/* Header */}
            <motion.div className="mb-8" initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}>
                <h1 className="text-4xl font-bold text-white mb-2">Execution Quality Analytics</h1>
                <p className="text-slate-400">
                    MiFID II / SEC compliant best execution analysis with slippage and VWAP comparison
                </p>
            </motion.div>

            {/* Summary Cards */}
            {analyses.length > 0 && (
                <div className="grid grid-cols-4 gap-4 mb-8">
                    <motion.div
                        className="p-6 bg-gradient-to-br from-blue-900/20 to-blue-800/10 border border-blue-700/30 rounded-xl"
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                    >
                        <BarChart3 className="w-8 h-8 text-blue-400 mb-2" />
                        <div className="text-xs text-blue-400 uppercase">Avg Slippage</div>
                        <div className="text-2xl font-bold text-white">{avgSlippage.toFixed(2)} bps</div>
                    </motion.div>
                    <motion.div
                        className="p-6 bg-gradient-to-br from-red-900/20 to-red-800/10 border border-red-700/30 rounded-xl"
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.1 }}
                    >
                        <DollarSign className="w-8 h-8 text-red-400 mb-2" />
                        <div className="text-xs text-red-400 uppercase">Total Slippage Cost</div>
                        <div className="text-2xl font-bold text-white">${totalCost.toFixed(2)}</div>
                    </motion.div>
                    <motion.div
                        className="p-6 bg-gradient-to-br from-green-900/20 to-green-800/10 border border-green-700/30 rounded-xl"
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.2 }}
                    >
                        <CheckCircle className="w-8 h-8 text-green-400 mb-2" />
                        <div className="text-xs text-green-400 uppercase">Excellent Fills</div>
                        <div className="text-2xl font-bold text-white">
                            {excellentCount} / {analyses.length}
                        </div>
                    </motion.div>
                    <motion.div
                        className="p-6 bg-gradient-to-br from-purple-900/20 to-purple-800/10 border border-purple-700/30 rounded-xl"
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.3 }}
                    >
                        <Clock className="w-8 h-8 text-purple-400 mb-2" />
                        <div className="text-xs text-purple-400 uppercase">Analysis Time</div>
                        <div className="text-2xl font-bold text-white">Real-time</div>
                    </motion.div>
                </div>
            )}

            {/* Execution Input */}
            <motion.div
                className="mb-8 p-6 bg-gradient-to-br from-slate-900 to-slate-800 rounded-xl border border-slate-700"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
            >
                <h3 className="text-lg font-bold text-white mb-4">📝 Enter Executions</h3>
                <div className="space-y-3">
                    {executions.map((exec, idx) => (
                        <div key={idx} className="grid grid-cols-5 gap-3">
                            <input
                                type="text"
                                value={exec.ticker}
                                onChange={(e) => {
                                    const updated = [...executions];
                                    updated[idx].ticker = e.target.value;
                                    setExecutions(updated);
                                }}
                                className="px-3 py-2 bg-slate-800 border border-slate-600 rounded text-white"
                                placeholder="Ticker"
                            />
                            <input
                                type="number"
                                value={exec.executionPrice}
                                onChange={(e) => {
                                    const updated = [...executions];
                                    updated[idx].executionPrice = parseFloat(e.target.value);
                                    setExecutions(updated);
                                }}
                                className="px-3 py-2 bg-slate-800 border border-slate-600 rounded text-white"
                                placeholder="Price"
                            />
                            <select
                                value={exec.side}
                                onChange={(e) => {
                                    const updated = [...executions];
                                    updated[idx].side = e.target.value as 'BUY' | 'SELL';
                                    setExecutions(updated);
                                }}
                                className="px-3 py-2 bg-slate-800 border border-slate-600 rounded text-white"
                            >
                                <option value="BUY">BUY</option>
                                <option value="SELL">SELL</option>
                            </select>
                            <input
                                type="number"
                                value={exec.quantity}
                                onChange={(e) => {
                                    const updated = [...executions];
                                    updated[idx].quantity = parseInt(e.target.value);
                                    setExecutions(updated);
                                }}
                                className="px-3 py-2 bg-slate-800 border border-slate-600 rounded text-white"
                                placeholder="Quantity"
                            />
                            <button
                                onClick={() => setExecutions(executions.filter((_, i) => i !== idx))}
                                className="px-3 py-2 bg-red-500/20 border border-red-500/30 rounded text-red-400 hover:bg-red-500/30"
                            >
                                Remove
                            </button>
                        </div>
                    ))}
                </div>
                <div className="mt-4 flex gap-3">
                    <button
                        onClick={() =>
                            setExecutions([...executions, { ticker: '', executionPrice: 0, side: 'BUY', quantity: 0 }])
                        }
                        className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded text-white"
                    >
                        + Add Execution
                    </button>
                    <button
                        onClick={analyzeExecutions}
                        disabled={loading}
                        className="px-6 py-2 bg-blue-500 hover:bg-blue-600 disabled:bg-slate-600 rounded text-white font-semibold"
                    >
                        {loading ? 'Analyzing...' : '🔍 Analyze Slippage'}
                    </button>
                </div>
            </motion.div>

            {/* Analysis Results */}
            {analyses.length > 0 && (
                <motion.div
                    className="p-6 bg-gradient-to-br from-slate-900 to-slate-800 rounded-xl border border-slate-700"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                >
                    <h3 className="text-xl font-bold text-white mb-4">📊 Slippage Analysis</h3>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="text-slate-400 border-b border-slate-700">
                                    <th className="py-2 px-3 text-left">Ticker</th>
                                    <th className="py-2 px-3 text-left">Side</th>
                                    <th className="py-2 px-3 text-right">Fill Price</th>
                                    <th className="py-2 px-3 text-right">Mid Price</th>
                                    <th className="py-2 px-3 text-right">Slippage (bps)</th>
                                    <th className="py-2 px-3 text-right">Cost ($)</th>
                                    <th className="py-2 px-3 text-center">Quality</th>
                                </tr>
                            </thead>
                            <tbody>
                                {analyses.map((analysis, idx) => (
                                    <tr key={idx} className="border-b border-slate-800">
                                        <td className="py-3 px-3 text-white font-semibold">{analysis.ticker}</td>
                                        <td className="py-3 px-3">
                                            <span
                                                className={`px-2 py-1 rounded text-xs font-semibold ${analysis.side === 'BUY'
                                                        ? 'bg-green-500/20 text-green-400'
                                                        : 'bg-red-500/20 text-red-400'
                                                    }`}
                                            >
                                                {analysis.side}
                                            </span>
                                        </td>
                                        <td className="py-3 px-3 text-right text-white">
                                            ${analysis.executionPrice.toFixed(2)}
                                        </td>
                                        <td className="py-3 px-3 text-right text-slate-300">
                                            ${analysis.midPrice.toFixed(2)}
                                        </td>
                                        <td
                                            className={`py-3 px-3 text-right font-semibold ${analysis.slippageBps > 0 ? 'text-red-400' : 'text-green-400'
                                                }`}
                                        >
                                            {analysis.slippageBps.toFixed(2)}
                                        </td>
                                        <td
                                            className={`py-3 px-3 text-right ${analysis.slippageCost > 0 ? 'text-red-400' : 'text-green-400'
                                                }`}
                                        >
                                            ${analysis.slippageCost.toFixed(2)}
                                        </td>
                                        <td className="py-3 px-3 text-center">
                                            <span
                                                className={`inline-flex items-center gap-1 px-2 py-1 rounded border ${getQualityColor(
                                                    analysis.quality,
                                                )}`}
                                            >
                                                {getQualityIcon(analysis.quality)}
                                                {analysis.quality}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </motion.div>
            )}
        </div>
    );
}
