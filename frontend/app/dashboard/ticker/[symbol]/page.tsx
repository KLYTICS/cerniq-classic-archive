'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { motion } from 'framer-motion';
import { Activity, Newspaper } from 'lucide-react';
import { apiClient } from '@/lib/api';
import StockInsightsPopup from '@/components/dashboard/StockInsightsPopup';
import { useMarketDataSocket } from '@/lib/marketDataSocket';

interface TickerPageProps {
    params: { symbol: string };
}

interface QuoteData {
    ticker: string;
    assetType?: 'stock' | 'etf' | 'crypto' | 'index';
    shortName?: string;
    longName?: string;
    exchange?: string;
    currency?: string;
    marketState?: string;
    session?: 'PREMARKET' | 'REGULAR' | 'AFTER_HOURS' | 'CLOSED' | 'CRYPTO' | 'UNKNOWN';
    freshnessState?: 'NEAR_REALTIME' | 'DELAYED' | 'STALE' | 'DISCONNECTED' | 'UNAVAILABLE';
    provider?: string;
    quoteTimestamp?: string | Date;
    serverTimestamp?: string | Date;
    ageMs?: number;
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

interface InstrumentProfile {
    ticker: string;
    assetType: 'stock' | 'etf' | 'crypto' | 'index';
    shortName?: string;
    longName?: string;
    exchange?: string;
    currency?: string;
    marketState?: string;
    sector?: string;
    industry?: string;
    categoryName?: string;
    family?: string;
    description?: string;
    website?: string;
    marketCap?: number;
    totalAssets?: number;
    expenseRatio?: number;
    yield?: number;
    ytdReturn?: number;
    topHoldings?: Array<{ symbol: string; name: string; weight: number }>;
}

interface NewsArticle {
    id: string;
    title: string;
    publisher: string;
    link: string;
    publishedAt: string | Date;
    relatedTickers?: string[];
}

export default function TickerDetailPage({ params }: TickerPageProps) {
    const router = useRouter();
    const symbol = params.symbol.toUpperCase();

    const [quote, setQuote] = useState<QuoteData | null>(null);
    const [fundamentals, setFundamentals] = useState<FundamentalsData | null>(null);
    const [profile, setProfile] = useState<InstrumentProfile | null>(null);
    const [news, setNews] = useState<NewsArticle[]>([]);
    const [connected, setConnected] = useState(false);
    const [historical, setHistorical] = useState<HistoricalData[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const { isConnected, subscribeTicker, subscribeInstrument, subscribeNews } = useMarketDataSocket();

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            setError(null);

            try {
                const snapshot = await apiClient.getNodeSnapshot(symbol, 8);
                setQuote(snapshot.quote);
                setProfile(snapshot.profile);
                setNews(snapshot.news || []);

                // Fetch fundamentals (stocks only)
                try {
                    const fundData = await apiClient.getNodeFundamentals(symbol);
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

    useEffect(() => {
        setConnected(isConnected);
    }, [isConnected]);

    useEffect(() => {
        if (!isConnected) {
            return;
        }

        const cleanups: Array<() => void> = [];

        const unsubscribeTicker = subscribeTicker(symbol, (payload) => {
            setQuote((current) => ({
                ...(current || { ticker: symbol, price: 0, change: 0, changePercent: 0, volume: 0, high: 0, low: 0, open: 0, previousClose: 0 }),
                ...payload,
            }));
        });
        if (unsubscribeTicker) {
            cleanups.push(unsubscribeTicker);
        }

        const unsubscribeInstrument = subscribeInstrument(symbol, (payload) => {
            if (payload.profile) {
                setProfile(payload.profile);
            }
            if (payload.quote) {
                setQuote((current) => ({
                    ...(current || { ticker: symbol, price: 0, change: 0, changePercent: 0, volume: 0, high: 0, low: 0, open: 0, previousClose: 0 }),
                    ...payload.quote,
                }));
            }
        });
        if (unsubscribeInstrument) {
            cleanups.push(unsubscribeInstrument);
        }

        const unsubscribeNews = subscribeNews(symbol, (payload) => {
            setNews(payload.items || []);
        });
        if (unsubscribeNews) {
            cleanups.push(unsubscribeNews);
        }

        return () => {
            cleanups.forEach((cleanup) => cleanup());
        };
    }, [isConnected, subscribeInstrument, subscribeNews, subscribeTicker, symbol]);

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
                                {profile ? (
                                    <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs uppercase tracking-[0.24em] text-slate-200">
                                        {profile.assetType}
                                    </span>
                                ) : null}
                                <StockInsightsPopup
                                    ticker={symbol}
                                    trigger={
                                        <button className="bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 px-3 py-1.5 rounded-lg transition flex items-center gap-2 text-sm font-medium border border-amber-500/30">
                                            ✨ AI Insight
                                        </button>
                                    }
                                />
                            </div>
                            {profile ? (
                                <p className="text-gray-400 mt-1">
                                    {[profile.longName || profile.shortName, profile.exchange, profile.marketState].filter(Boolean).join(' • ')}
                                </p>
                            ) : fundamentals ? (
                                <p className="text-gray-400 mt-1">
                                    {fundamentals.sector} • {fundamentals.industry}
                                </p>
                            ) : null}
                        </div>
                        <div className="text-right">
                            <div className="text-4xl font-bold text-white">${quote.price.toFixed(2)}</div>
                            <div className={`text-xl font-medium ${isPositive ? 'text-green-400' : 'text-red-400'}`}>
                                {isPositive ? '↑' : '↓'} ${Math.abs(quote.change).toFixed(2)} ({Math.abs(quote.changePercent).toFixed(2)}%)
                            </div>
                            <div className="mt-2 flex items-center justify-end gap-2 text-xs uppercase tracking-[0.24em] text-slate-400">
                                <Activity className={`h-3.5 w-3.5 ${connected ? 'text-emerald-400' : 'text-amber-400'}`} />
                                {connected ? 'Live stream' : 'Snapshot'}
                            </div>
                            <div className="mt-2 text-xs uppercase tracking-[0.18em] text-slate-400">
                                {quote.session || 'UNKNOWN'} • {quote.freshnessState || 'UNAVAILABLE'}{quote.provider ? ` • ${quote.provider}` : ''}
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

                {(profile || news.length > 0) && (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-8">
                        {profile && (
                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.25 }}
                                className="bg-white/10 backdrop-blur-md rounded-xl p-6 border border-white/10"
                            >
                                <h3 className="text-xl font-semibold text-white mb-4">Instrument Profile</h3>
                                <div className="space-y-3">
                                    {profile.categoryName && <StatRow label="Category" value={profile.categoryName} />}
                                    {profile.family && <StatRow label="Family" value={profile.family} />}
                                    {profile.totalAssets ? <StatRow label="Total Assets" value={`$${(profile.totalAssets / 1e9).toFixed(2)}B`} /> : null}
                                    {profile.expenseRatio !== undefined ? <StatRow label="Expense Ratio" value={`${(profile.expenseRatio * 100).toFixed(2)}%`} /> : null}
                                    {profile.yield !== undefined ? <StatRow label="Yield" value={`${(profile.yield * 100).toFixed(2)}%`} /> : null}
                                    {profile.ytdReturn !== undefined ? <StatRow label="YTD Return" value={`${(profile.ytdReturn * 100).toFixed(2)}%`} /> : null}
                                </div>
                                {profile.description ? (
                                    <p className="mt-5 text-sm leading-6 text-slate-300">{profile.description}</p>
                                ) : null}
                                {profile.topHoldings && profile.topHoldings.length > 0 ? (
                                    <div className="mt-5">
                                        <div className="text-sm font-semibold text-white">Top Holdings</div>
                                        <div className="mt-3 space-y-2">
                                            {profile.topHoldings.slice(0, 5).map((holding) => (
                                                <div key={`${holding.symbol}-${holding.name}`} className="flex items-center justify-between text-sm">
                                                    <span className="text-slate-200">{holding.symbol}</span>
                                                    <span className="text-slate-400">{holding.weight.toFixed(2)}%</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ) : null}
                            </motion.div>
                        )}

                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.3 }}
                            className="bg-white/10 backdrop-blur-md rounded-xl p-6 border border-white/10"
                        >
                            <div className="flex items-center gap-2">
                                <Newspaper className="h-5 w-5 text-amber-300" />
                                <h3 className="text-xl font-semibold text-white">Latest News</h3>
                            </div>
                            <div className="mt-4 space-y-3">
                                {news.length === 0 ? (
                                    <p className="text-sm text-slate-400">No headlines available yet for {symbol}.</p>
                                ) : (
                                    news.slice(0, 5).map((item) => (
                                        <a
                                            key={item.id}
                                            href={item.link}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="block rounded-xl border border-white/10 bg-white/5 px-4 py-3 transition hover:border-white/20 hover:bg-white/10"
                                        >
                                            <div className="text-sm font-semibold text-white">{item.title}</div>
                                            <div className="mt-1 text-xs uppercase tracking-[0.18em] text-slate-400">
                                                {item.publisher} • {new Date(item.publishedAt).toLocaleString()}
                                            </div>
                                        </a>
                                    ))
                                )}
                            </div>
                        </motion.div>
                    </div>
                )}

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
