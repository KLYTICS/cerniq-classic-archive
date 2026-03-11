'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { motion } from 'framer-motion';
import { apiClient } from '@/lib/api';
import StockInsightsPopup from '@/components/dashboard/StockInsightsPopup';

interface TickerPageProps {
    params: { symbol: string };
}

interface QuoteData {
    ticker: string;
    price: number;
    change: number;
    changePercent: number;
    volume: number;
    marketCap?: number;
    high: number;
    low: number;
    open: number;
    previousClose: number;
}

interface FundamentalsData {
    ticker: string;
    marketCap: number;
    peRatio?: number;
    forwardPE?: number;
    pbRatio?: number;
    dividendYield?: number;
    eps?: number;
    beta?: number;
    fiftyTwoWeekHigh?: number;
    fiftyTwoWeekLow?: number;
    sector?: string;
    industry?: string;
}

interface HistoricalData {
    date: string;
    close: number;
    volume: number;
}

export default function TickerDetailPage({ params }: TickerPageProps) {
    const router = useRouter();
    const symbol = params.symbol.toUpperCase();

    const [quote, setQuote] = useState<QuoteData | null>(null);
    const [fundamentals, setFundamentals] = useState<FundamentalsData | null>(null);
    const [historical, setHistorical] = useState<HistoricalData[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            setError(null);

            try {
                // Fetch quote
                const quoteData = await apiClient.getQuote(symbol);
                setQuote(quoteData);

                // Fetch fundamentals (stocks only)
                try {
                    const fundData = await apiClient.getFundamentals(symbol);
                    setFundamentals(fundData);
                } catch (err) {
                    console.log('Fundamentals not available');
                }

                // Fetch historical data (last 30 days)
                const endDate = new Date();
                const startDate = new Date();
                startDate.setDate(startDate.getDate() - 30);

                const histData = await apiClient.getHistoricalPrices(
                    symbol,
                    startDate.toISOString().split('T')[0],
                    endDate.toISOString().split('T')[0]
                );
                setHistorical(histData);
            } catch (err: any) {
                console.error(err);
                setError(err.message || 'Failed to load ticker data');
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [symbol]);

    if (loading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-900 via-[#1B3A6B]/80 to-slate-900 flex items-center justify-center">
                <div className="text-white text-xl">Loading {symbol}...</div>
            </div>
        );
    }

    if (error || !quote) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-900 via-[#1B3A6B]/80 to-slate-900 flex items-center justify-center">
                <div className="text-center">
                    <div className="text-red-400 text-xl mb-4">
                        {error || `Could not load data for ${symbol}`}
                    </div>
                    <button
                        onClick={() => router.push('/dashboard')}
                        className="bg-amber-600 hover:bg-amber-500 text-white px-6 py-3 rounded-lg transition"
                    >
                        Back to Dashboard
                    </button>
                </div>
            </div>
        );
    }

    const isPositive = quote.changePercent >= 0;

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-[#1B3A6B]/80 to-slate-900">
            {/* Header */}
            <div className="bg-white/5 backdrop-blur-md border-b border-white/10">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
                    <button
                        onClick={() => router.push('/dashboard')}
                        className="text-amber-400 hover:text-amber-300 mb-4 flex items-center gap-2"
                    >
                        ← Back to Dashboard
                    </button>
                    <div className="flex items-end justify-between">
                        <div>
                            <div className="flex items-center gap-4">
                                <h1 className="text-4xl font-bold text-white">{symbol}</h1>
                                <StockInsightsPopup
                                    ticker={symbol}
                                    trigger={
                                        <button className="bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 px-3 py-1.5 rounded-lg transition flex items-center gap-2 text-sm font-medium border border-amber-500/30">
                                            ✨ AI Insight
                                        </button>
                                    }
                                />
                            </div>
                            {fundamentals && (
                                <p className="text-gray-400 mt-1">
                                    {fundamentals.sector} • {fundamentals.industry}
                                </p>
                            )}
                        </div>
                        <div className="text-right">
                            <div className="text-4xl font-bold text-white">${quote.price.toFixed(2)}</div>
                            <div className={`text-xl font-medium ${isPositive ? 'text-green-400' : 'text-red-400'}`}>
                                {isPositive ? '↑' : '↓'} ${Math.abs(quote.change).toFixed(2)} ({Math.abs(quote.changePercent).toFixed(2)}%)
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Main Content */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {/* Price Chart */}
                {historical.length > 0 && (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="bg-white/10 backdrop-blur-md rounded-xl p-6 border border-white/10 mb-8"
                    >
                        <h3 className="text-xl font-semibold text-white mb-4">30-Day Price Chart</h3>
                        <ResponsiveContainer width="100%" height={300}>
                            <LineChart data={historical}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff20" />
                                <XAxis dataKey="date" stroke="#9ca3af" />
                                <YAxis stroke="#9ca3af" domain={['auto', 'auto']} />
                                <Tooltip
                                    contentStyle={{
                                        backgroundColor: '#1e293b',
                                        border: '1px solid #475569',
                                        borderRadius: '8px',
                                    }}
                                    labelStyle={{ color: '#cbd5e1' }}
                                />
                                <Line
                                    type="monotone"
                                    dataKey="close"
                                    stroke="#8b5cf6"
                                    strokeWidth={2}
                                    dot={false}
                                />
                            </LineChart>
                        </ResponsiveContainer>
                    </motion.div>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Key Statistics */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 }}
                        className="bg-white/10 backdrop-blur-md rounded-xl p-6 border border-white/10"
                    >
                        <h3 className="text-xl font-semibold text-white mb-4">Key Statistics</h3>
                        <div className="space-y-3">
                            <StatRow label="Open" value={`$${quote.open.toFixed(2)}`} />
                            <StatRow label="High" value={`$${quote.high.toFixed(2)}`} />
                            <StatRow label="Low" value={`$${quote.low.toFixed(2)}`} />
                            <StatRow label="Previous Close" value={`$${quote.previousClose.toFixed(2)}`} />
                            <StatRow label="Volume" value={quote.volume.toLocaleString()} />
                            {quote.marketCap && (
                                <StatRow label="Market Cap" value={`$${(quote.marketCap / 1e9).toFixed(2)}B`} />
                            )}
                        </div>
                    </motion.div>

                    {/* Fundamentals */}
                    {fundamentals && (
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.2 }}
                            className="bg-white/10 backdrop-blur-md rounded-xl p-6 border border-white/10"
                        >
                            <h3 className="text-xl font-semibold text-white mb-4">Fundamentals</h3>
                            <div className="space-y-3">
                                {fundamentals.peRatio && <StatRow label="P/E Ratio" value={fundamentals.peRatio.toFixed(2)} />}
                                {fundamentals.forwardPE && <StatRow label="Forward P/E" value={fundamentals.forwardPE.toFixed(2)} />}
                                {fundamentals.pbRatio && <StatRow label="P/B Ratio" value={fundamentals.pbRatio.toFixed(2)} />}
                                {fundamentals.eps && <StatRow label="EPS" value={`$${fundamentals.eps.toFixed(2)}`} />}
                                {fundamentals.beta && <StatRow label="Beta" value={fundamentals.beta.toFixed(2)} />}
                                {fundamentals.dividendYield && (
                                    <StatRow label="Dividend Yield" value={`${(fundamentals.dividendYield * 100).toFixed(2)}%`} />
                                )}
                                {fundamentals.fiftyTwoWeekHigh && (
                                    <StatRow label="52W High" value={`$${fundamentals.fiftyTwoWeekHigh.toFixed(2)}`} />
                                )}
                                {fundamentals.fiftyTwoWeekLow && (
                                    <StatRow label="52W Low" value={`$${fundamentals.fiftyTwoWeekLow.toFixed(2)}`} />
                                )}
                            </div>
                        </motion.div>
                    )}
                </div>

                {/* Actions */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                    className="mt-8 flex gap-4"
                >
                    <button className="flex-1 bg-amber-600 hover:bg-amber-500 text-white px-6 py-3 rounded-lg transition font-medium">
                        Add to Watchlist
                    </button>
                    <button className="flex-1 bg-blue-500 hover:bg-blue-600 text-white px-6 py-3 rounded-lg transition font-medium">
                        Add to Portfolio
                    </button>
                    <button
                        onClick={() => router.push(`/dashboard/valuation?ticker=${symbol}`)}
                        className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white px-6 py-3 rounded-lg transition font-medium"
                    >
                        Run Cyclical Valuation
                    </button>
                </motion.div>
            </div>
        </div>
    );
}

function StatRow({ label, value }: { label: string; value: string }) {
    return (
        <div className="flex justify-between items-center">
            <span className="text-gray-400">{label}</span>
            <span className="text-white font-medium">{value}</span>
        </div>
    );
}
