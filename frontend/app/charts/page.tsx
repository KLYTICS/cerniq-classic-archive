'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { CandlestickChart } from '@/components/charts/CandlestickChart';
import { TrendingUp, BarChart3, Activity, Search } from 'lucide-react';

export default function ChartsPage() {
    const [selectedTicker, setSelectedTicker] = useState('AAPL');
    const [searchTicker, setSearchTicker] = useState('');

    const popularTickers = ['AAPL', 'GOOGL', 'MSFT', 'TSLA', 'NVDA', 'AMD', 'META', 'AMZN'];

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        if (searchTicker.trim()) {
            setSelectedTicker(searchTicker.toUpperCase());
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-8">
            {/* Header */}
            <motion.div
                className="mb-8"
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
            >
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-4xl font-bold text-white mb-2">Advanced Charting</h1>
                        <p className="text-slate-400">
                            Professional-grade charts with technical indicators and custom timeframes
                        </p>
                    </div>

                    {/* Search */}
                    <form onSubmit={handleSearch} className="flex gap-2">
                        <input
                            type="text"
                            value={searchTicker}
                            onChange={(e) => setSearchTicker(e.target.value)}
                            placeholder="Enter ticker..."
                            className="px-4 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
                        />
                        <button
                            type="submit"
                            className="px-4 py-2 bg-blue-500 hover:bg-blue-600 rounded-lg flex items-center gap-2 text-white transition-colors"
                        >
                            <Search className="w-4 h-4" />
                            Search
                        </button>
                    </form>
                </div>
            </motion.div>

            {/* Feature Cards */}
            <div className="grid grid-cols-3 gap-4 mb-8">
                <motion.div
                    className="p-6 bg-gradient-to-br from-blue-900/20 to-blue-800/10 border border-blue-700/30 rounded-xl"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.1 }}
                >
                    <div className="flex items-center gap-3 mb-3">
                        <TrendingUp className="w-8 h-8 text-blue-400" />
                        <span className="text-xs text-blue-400 font-semibold uppercase">Technical Analysis</span>
                    </div>
                    <div className="text-sm text-slate-300">
                        SMA, EMA, RSI, MACD, Bollinger Bands, and more
                    </div>
                </motion.div>

                <motion.div
                    className="p-6 bg-gradient-to-br from-purple-900/20 to-purple-800/10 border border-purple-700/30 rounded-xl"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.2 }}
                >
                    <div className="flex items-center gap-3 mb-3">
                        <BarChart3 className="w-8 h-8 text-purple-400" />
                        <span className="text-xs text-purple-400 font-semibold uppercase">Multiple Timeframes</span>
                    </div>
                    <div className="text-sm text-slate-300">
                        1D, 1W, 1M, 3M, 1Y, and ALL historical data
                    </div>
                </motion.div>

                <motion.div
                    className="p-6 bg-gradient-to-br from-green-900/20 to-green-800/10 border border-green-700/30 rounded-xl"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.3 }}
                >
                    <div className="flex items-center gap-3 mb-3">
                        <Activity className="w-8 h-8 text-green-400" />
                        <span className="text-xs text-green-400 font-semibold uppercase">Real-Time Updates</span>
                    </div>
                    <div className="text-sm text-slate-300">
                        Live price data with Redis caching for performance
                    </div>
                </motion.div>
            </div>

            {/* Popular Tickers Quick Select */}
            <motion.div
                className="mb-6"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.4 }}
            >
                <div className="text-sm text-slate-400 mb-2">Quick Select:</div>
                <div className="flex gap-2">
                    {popularTickers.map((ticker) => (
                        <button
                            key={ticker}
                            onClick={() => setSelectedTicker(ticker)}
                            className={`px-4 py-2 rounded-lg font-semibold transition-colors ${selectedTicker === ticker
                                    ? 'bg-blue-500 text-white'
                                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                                }`}
                        >
                            {ticker}
                        </button>
                    ))}
                </div>
            </motion.div>

            {/* Main Chart */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
            >
                <CandlestickChart ticker={selectedTicker} initialTimeframe="3M" />
            </motion.div>

            {/* Chart Guide */}
            <motion.div
                className="mt-8 p-6 bg-gradient-to-r from-slate-800/50 to-slate-700/30 border border-slate-600 rounded-xl"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.6 }}
            >
                <h3 className="text-lg font-bold text-white mb-4">📊 Chart Features</h3>
                <div className="grid grid-cols-2 gap-6 text-sm">
                    <div>
                        <h4 className="font-semibold text-blue-400 mb-2">Chart Types</h4>
                        <ul className="text-slate-300 space-y-1">
                            <li>• <strong>Candlestick</strong>: Traditional OHLC visualization</li>
                            <li>• <strong>Line</strong>: Simple closing price line</li>
                            <li>• <strong>Area</strong>: Filled area chart showing trends</li>
                        </ul>
                    </div>
                    <div>
                        <h4 className="font-semibold text-blue-400 mb-2">Technical Indicators</h4>
                        <ul className="text-slate-300 space-y-1">
                            <li>• <strong>SMA 20/50/200</strong>: Moving average overlays</li>
                            <li>• <strong>Bollinger Bands</strong>: Volatility bands (±2σ)</li>
                            <li>• <strong>Volume</strong>: Trading volume histogram</li>
                        </ul>
                    </div>
                    <div>
                        <h4 className="font-semibold text-blue-400 mb-2">Timeframes</h4>
                        <ul className="text-slate-300 space-y-1">
                            <li>• <strong>1D-1W</strong>: Intraday to weekly</li>
                            <li>• <strong>1M-3M</strong>: Monthly to quarterly</li>
                            <li>• <strong>1Y-ALL</strong>: Yearly to all available history</li>
                        </ul>
                    </div>
                    <div>
                        <h4 className="font-semibold text-blue-400 mb-2">Performance</h4>
                        <ul className="text-slate-300 space-y-1">
                            <li>• <strong>Redis Caching</strong>: 15-minute TTL</li>
                            <li>• <strong>Optimized Rendering</strong>: Smooth 60fps charts</li>
                            <li>• <strong>Responsive</strong>: Desktop and mobile optimized</li>
                        </ul>
                    </div>
                </div>
            </motion.div>
        </div>
    );
}
