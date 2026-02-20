'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { apiClient } from '@/lib/api';
import { useMarketDataStore } from '@/lib/store';

interface SentimentData {
    overall_score: number;
    sentiment_label: string;
    fear_greed_index: number;
    components: {
        market_momentum: number;
        market_volatility: number;
        safe_haven_demand: number;
        stock_breadth: number;
    };
}

interface TrendingTicker {
    ticker: string;
    name: string;
    price: number;
    change_pct: number;
    sentiment: string;
}

interface SectorData {
    name: string;
    ticker: string;
    price: number;
    performance_1d: number;
    sentiment: string;
}

// Compute Fear & Greed from real market signals
function computeFearGreed(quotes: Record<string, { price: number; change: number; changePercent: number }>) {
    const spy = quotes['SPY'];
    const vix = quotes['VIX'];
    const gld = quotes['GLD'];
    const tlt = quotes['TLT'];

    if (!spy || !vix) {
        return null;
    }

    // Market momentum: SPY change (positive = greed)
    const momentum = Math.min(Math.max((spy.changePercent + 2) * 25, 0), 100);

    // Volatility component: VIX level (low VIX = greed, high VIX = fear)
    // VIX < 15 = extreme greed, VIX > 30 = extreme fear
    const vixPrice = vix.price || 20;
    const volScore = Math.min(Math.max(100 - ((vixPrice - 12) * 4.5), 0), 100);

    // Safe haven demand: GLD/TLT changes (rising gold/bonds = fear)
    const goldChange = gld?.changePercent ?? 0;
    const bondChange = tlt?.changePercent ?? 0;
    const safeHaven = Math.min(Math.max(50 - (goldChange + bondChange) * 15, 0), 100);

    // Breadth approximation from SPY trend
    const breadth = Math.min(Math.max(50 + spy.changePercent * 20, 0), 100);

    const index = Math.round(momentum * 0.3 + volScore * 0.3 + safeHaven * 0.2 + breadth * 0.2);

    let label: string;
    if (index >= 80) label = 'Extreme Greed';
    else if (index >= 60) label = 'Greed';
    else if (index >= 40) label = 'Neutral';
    else if (index >= 20) label = 'Fear';
    else label = 'Extreme Fear';

    return {
        overall_score: index,
        sentiment_label: label,
        fear_greed_index: index,
        components: {
            market_momentum: parseFloat((spy.changePercent).toFixed(1)),
            market_volatility: parseFloat((-vixPrice + 20).toFixed(1)),
            safe_haven_demand: parseFloat((-(goldChange + bondChange)).toFixed(1)),
            stock_breadth: parseFloat((breadth - 50).toFixed(1)),
        },
    };
}

const TRENDING_TICKERS = ['NVDA', 'META', 'TSLA', 'AMD', 'COIN', 'SMCI'];
const SECTOR_ETFS: { name: string; ticker: string }[] = [
    { name: 'Technology', ticker: 'XLK' },
    { name: 'Financials', ticker: 'XLF' },
    { name: 'Healthcare', ticker: 'XLV' },
    { name: 'Energy', ticker: 'XLE' },
    { name: 'Consumer Disc.', ticker: 'XLY' },
    { name: 'Communication', ticker: 'XLC' },
    { name: 'Industrials', ticker: 'XLI' },
    { name: 'Materials', ticker: 'XLB' },
    { name: 'Real Estate', ticker: 'XLRE' },
    { name: 'Utilities', ticker: 'XLU' },
    { name: 'Consumer Staples', ticker: 'XLP' },
];
const SENTIMENT_TICKERS = ['SPY', 'VIX', 'GLD', 'TLT'];

export default function AIInsightsPage() {
    const [sentiment, setSentiment] = useState<SentimentData | null>(null);
    const [trending, setTrending] = useState<TrendingTicker[]>([]);
    const [sectors, setSectors] = useState<SectorData[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const { setQuotes } = useMarketDataStore();

    const fetchAll = useCallback(async () => {
        setLoading(true);
        setError(null);

        try {
            // Fetch all in parallel: sentiment tickers, trending tickers, sector ETFs
            const [sentimentResults, trendingResults, sectorResults] = await Promise.all([
                Promise.all(
                    SENTIMENT_TICKERS.map(async (t) => {
                        try {
                            const data = await apiClient.getNodeQuote(t);
                            return { ticker: t, price: data.price ?? 0, change: data.change ?? 0, changePercent: data.changePercent ?? 0 };
                        } catch {
                            return { ticker: t, price: 0, change: 0, changePercent: 0 };
                        }
                    })
                ),
                Promise.all(
                    TRENDING_TICKERS.map(async (t) => {
                        try {
                            const data = await apiClient.getNodeQuote(t);
                            return {
                                ticker: data.ticker || t,
                                name: data.name || data.shortName || t,
                                price: data.price ?? 0,
                                change_pct: data.changePercent ?? 0,
                                sentiment: (data.changePercent ?? 0) > 1 ? 'bullish' : (data.changePercent ?? 0) < -1 ? 'bearish' : 'neutral',
                            } as TrendingTicker;
                        } catch {
                            return { ticker: t, name: t, price: 0, change_pct: 0, sentiment: 'neutral' as const };
                        }
                    })
                ),
                Promise.all(
                    SECTOR_ETFS.map(async ({ name, ticker }) => {
                        try {
                            const data = await apiClient.getNodeQuote(ticker);
                            const changePct = data.changePercent ?? 0;
                            return {
                                name,
                                ticker,
                                price: data.price ?? 0,
                                performance_1d: changePct,
                                sentiment: changePct > 0.5 ? 'bullish' : changePct < -0.5 ? 'bearish' : 'neutral',
                            } as SectorData;
                        } catch {
                            return { name, ticker, price: 0, performance_1d: 0, sentiment: 'neutral' as const };
                        }
                    })
                ),
            ]);

            // Compute fear & greed from real quotes
            const sentimentMap: Record<string, { price: number; change: number; changePercent: number }> = {};
            sentimentResults.forEach((r) => { sentimentMap[r.ticker] = r; });
            const fg = computeFearGreed(sentimentMap);
            if (fg) setSentiment(fg);

            setTrending(trendingResults);
            setSectors(sectorResults);

            // Cache all fetched quotes
            const allQuotes = [
                ...sentimentResults.map((r) => ({ ticker: r.ticker, price: r.price, change: r.change, changePercent: r.changePercent })),
                ...trendingResults.map((r) => ({ ticker: r.ticker, price: r.price, change: r.change_pct, changePercent: r.change_pct })),
                ...sectorResults.map((r) => ({ ticker: r.ticker, price: r.price, change: 0, changePercent: r.performance_1d })),
            ];
            setQuotes(allQuotes);
        } catch (err) {
            console.error('AI Insights fetch error:', err);
            setError('Failed to load market insights. Please try again.');
        } finally {
            setLoading(false);
        }
    }, [setQuotes]);

    useEffect(() => {
        fetchAll();
        const interval = setInterval(fetchAll, 60000);
        return () => clearInterval(interval);
    }, [fetchAll]);

    const getSentimentColor = (label: string) => {
        switch (label.toLowerCase()) {
            case 'extreme greed': return 'text-green-400';
            case 'greed': return 'text-green-500';
            case 'neutral': return 'text-yellow-400';
            case 'fear': return 'text-orange-400';
            case 'extreme fear': return 'text-red-400';
            default: return 'text-gray-400';
        }
    };

    const getSentimentBg = (value: number) => {
        if (value >= 75) return 'bg-gradient-to-r from-green-500 to-green-600';
        if (value >= 50) return 'bg-gradient-to-r from-green-600 to-yellow-500';
        if (value >= 25) return 'bg-gradient-to-r from-yellow-500 to-orange-500';
        return 'bg-gradient-to-r from-orange-500 to-red-500';
    };

    // Skeleton loader
    if (loading) {
        return (
            <div className="min-h-screen bg-gray-950 text-white p-8">
                <div className="mb-8">
                    <Link href="/dashboard" className="text-purple-400 hover:text-purple-300 text-sm mb-2 block">
                        &larr; Back to Dashboard
                    </Link>
                    <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                        AI Market Insights
                    </h1>
                    <p className="text-gray-400 mt-1">Loading real-time market sentiment...</p>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
                    {[...Array(3)].map((_, i) => (
                        <div key={i} className="bg-gray-900/50 rounded-xl border border-gray-800 p-6 animate-pulse">
                            <div className="h-5 bg-white/10 rounded w-32 mb-4" />
                            <div className="h-16 bg-white/10 rounded mb-4" />
                            <div className="h-4 bg-white/10 rounded w-20" />
                        </div>
                    ))}
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
                    {[...Array(6)].map((_, i) => (
                        <div key={i} className="bg-gray-900/50 rounded-xl border border-gray-800 p-4 animate-pulse">
                            <div className="h-4 bg-white/10 rounded w-12 mb-2" />
                            <div className="h-6 bg-white/10 rounded w-20 mb-1" />
                            <div className="h-3 bg-white/10 rounded w-16" />
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    // Error state with retry
    if (error && !sentiment && trending.length === 0) {
        return (
            <div className="min-h-screen bg-gray-950 text-white p-8">
                <div className="mb-8">
                    <Link href="/dashboard" className="text-purple-400 hover:text-purple-300 text-sm mb-2 block">
                        &larr; Back to Dashboard
                    </Link>
                    <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                        AI Market Insights
                    </h1>
                </div>
                <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-8 text-center max-w-lg mx-auto">
                    <p className="text-red-300 mb-4">{error}</p>
                    <button
                        onClick={fetchAll}
                        className="px-6 py-2 bg-purple-600 hover:bg-purple-500 rounded-lg transition"
                    >
                        Retry
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-950 text-white p-8">
            {/* Header */}
            <div className="mb-8">
                <Link href="/dashboard" className="text-purple-400 hover:text-purple-300 text-sm mb-2 block">
                    &larr; Back to Dashboard
                </Link>
                <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                    AI Market Insights
                </h1>
                <p className="text-gray-400 mt-1">Real-time market sentiment and trend analysis</p>
            </div>

            {/* Fear & Greed + Summary */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
                {/* Fear & Greed Gauge */}
                <div className="bg-gray-900/50 rounded-xl border border-gray-800 p-6">
                    <h2 className="text-lg font-semibold mb-4 text-gray-200">Fear & Greed Index</h2>
                    {sentiment ? (
                        <div className="text-center">
                            <div className="relative w-48 h-24 mx-auto mb-4">
                                <div className="absolute inset-0 rounded-t-full bg-gradient-to-r from-red-500 via-yellow-500 to-green-500 opacity-20"></div>
                                <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 text-6xl font-bold">
                                    {sentiment.fear_greed_index}
                                </div>
                            </div>
                            <p className={`text-2xl font-bold ${getSentimentColor(sentiment.sentiment_label)}`}>
                                {sentiment.sentiment_label}
                            </p>
                            <div className="mt-4 w-full h-3 bg-gray-800 rounded-full overflow-hidden">
                                <div
                                    className={`h-full ${getSentimentBg(sentiment.fear_greed_index)} transition-all`}
                                    style={{ width: `${sentiment.fear_greed_index}%` }}
                                ></div>
                            </div>
                            <div className="flex justify-between text-xs text-gray-500 mt-1">
                                <span>Extreme Fear</span>
                                <span>Extreme Greed</span>
                            </div>
                        </div>
                    ) : (
                        <p className="text-gray-500 text-center py-8">Insufficient data to compute</p>
                    )}
                </div>

                {/* Sentiment Components */}
                <div className="bg-gray-900/50 rounded-xl border border-gray-800 p-6">
                    <h2 className="text-lg font-semibold mb-4 text-gray-200">Sentiment Components</h2>
                    {sentiment ? (
                        <div className="space-y-3">
                            {Object.entries(sentiment.components).map(([key, value]) => (
                                <div key={key} className="flex justify-between items-center">
                                    <span className="text-gray-400 capitalize">{key.replace(/_/g, ' ')}</span>
                                    <span className={`font-medium ${value >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                        {value >= 0 ? '+' : ''}{value.toFixed(1)}
                                    </span>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="text-gray-500 text-center py-8">--</p>
                    )}
                </div>

                {/* AI Summary */}
                <div className="bg-gray-900/50 rounded-xl border border-gray-800 p-6">
                    <h2 className="text-lg font-semibold mb-4 text-gray-200">Market Summary</h2>
                    {sentiment ? (
                        <p className="text-gray-300 leading-relaxed">
                            The computed Fear & Greed index is at{' '}
                            <span className={`font-medium ${getSentimentColor(sentiment.sentiment_label)}`}>
                                {sentiment.fear_greed_index} ({sentiment.sentiment_label})
                            </span>.
                            {sentiment.fear_greed_index >= 60 && (
                                <> Markets are showing bullish momentum. Watch for potential overextension in high-beta names.</>
                            )}
                            {sentiment.fear_greed_index < 40 && (
                                <> Markets are exhibiting risk-off behavior. Consider defensive positioning.</>
                            )}
                            {sentiment.fear_greed_index >= 40 && sentiment.fear_greed_index < 60 && (
                                <> Market sentiment is balanced. Look for sector rotation opportunities.</>
                            )}
                            {' '}Data derived from SPY, VIX, GLD, and TLT real-time quotes.
                        </p>
                    ) : (
                        <p className="text-gray-500">Waiting for market data...</p>
                    )}
                </div>
            </div>

            {/* Trending Tickers */}
            <div className="mb-8">
                <h2 className="text-xl font-semibold mb-4">Trending Tickers</h2>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                    {trending.map((t) => (
                        <Link
                            href={`/dashboard/ticker/${t.ticker}`}
                            key={t.ticker}
                            className="bg-gray-900/50 rounded-xl border border-gray-800 p-4 hover:border-purple-500/50 transition"
                        >
                            <div className="flex justify-between items-start mb-2">
                                <span className="font-bold text-lg text-blue-400">{t.ticker}</span>
                                <span className={`text-xs px-2 py-1 rounded ${t.sentiment === 'bullish' ? 'bg-green-900/50 text-green-400' :
                                        t.sentiment === 'bearish' ? 'bg-red-900/50 text-red-400' :
                                            'bg-yellow-900/50 text-yellow-400'
                                    }`}>
                                    {t.sentiment}
                                </span>
                            </div>
                            <p className="text-gray-400 text-xs mb-2">{t.name}</p>
                            <p className="text-xl font-semibold">${t.price.toFixed(2)}</p>
                            <p className={`text-sm ${t.change_pct >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                {t.change_pct >= 0 ? '+' : ''}{t.change_pct.toFixed(2)}%
                            </p>
                        </Link>
                    ))}
                </div>
            </div>

            {/* Sector Heat Map */}
            <div className="bg-gray-900/50 rounded-xl border border-gray-800 overflow-hidden">
                <div className="p-4 border-b border-gray-800">
                    <h2 className="text-xl font-semibold">Sector Performance (ETFs)</h2>
                </div>
                <table className="w-full">
                    <thead className="bg-gray-800/50">
                        <tr>
                            <th className="text-left p-3 text-gray-400 font-medium">Sector</th>
                            <th className="text-left p-3 text-gray-400 font-medium">ETF</th>
                            <th className="text-right p-3 text-gray-400 font-medium">Price</th>
                            <th className="text-right p-3 text-gray-400 font-medium">1D Change</th>
                            <th className="text-right p-3 text-gray-400 font-medium">Sentiment</th>
                        </tr>
                    </thead>
                    <tbody>
                        {sectors.map((sector) => (
                            <tr key={sector.ticker} className="border-t border-gray-800 hover:bg-gray-800/30">
                                <td className="p-3 font-medium">{sector.name}</td>
                                <td className="p-3 text-blue-400 font-mono text-sm">{sector.ticker}</td>
                                <td className="p-3 text-right">${sector.price.toFixed(2)}</td>
                                <td className={`p-3 text-right ${sector.performance_1d >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                    {sector.performance_1d >= 0 ? '+' : ''}{sector.performance_1d.toFixed(2)}%
                                </td>
                                <td className="p-3 text-right">
                                    <span className={`text-xs px-2 py-1 rounded ${sector.sentiment === 'bullish' ? 'bg-green-900/50 text-green-400' :
                                            sector.sentiment === 'bearish' ? 'bg-red-900/50 text-red-400' :
                                                'bg-gray-700/50 text-gray-400'
                                        }`}>
                                        {sector.sentiment}
                                    </span>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
