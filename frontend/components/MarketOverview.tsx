'use client';

import { useEffect, useState, useCallback } from 'react';
import { apiClient } from '@/lib/api';
import { useMarketDataStore } from '@/lib/store';

interface MarketOverviewData {
    ticker: string;
    name: string;
    price: number;
    change: number;
    changePercent: number;
}

const TRACKED_TICKERS = ['SPY', 'QQQ', 'NVDA', 'AAPL', 'MSFT', 'AMZN'];

export default function MarketOverview() {
    const [tickers, setTickers] = useState<MarketOverviewData[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const { setQuotes, getQuote, isStale, lastUpdated } = useMarketDataStore();

    const fetchData = useCallback(async () => {
        // Check if all tickers are cached and fresh
        const allCached = TRACKED_TICKERS.every((t) => !isStale(t));
        if (allCached) {
            const cached = TRACKED_TICKERS.map((t) => {
                const q = getQuote(t)!;
                return {
                    ticker: q.ticker,
                    name: q.name || q.ticker,
                    price: q.price,
                    change: q.change,
                    changePercent: q.changePercent,
                };
            });
            setTickers(cached);
            setLoading(false);
            return;
        }

        try {
            setError(null);
            const promises = TRACKED_TICKERS.map(async (ticker) => {
                try {
                    const data = await apiClient.getNodeQuote(ticker);
                    return {
                        ticker: data.ticker || ticker,
                        name: data.name || data.shortName || ticker,
                        price: data.price ?? 0,
                        change: data.change ?? 0,
                        changePercent: data.changePercent ?? 0,
                    };
                } catch (err) {
                    console.error(`Failed to fetch ${ticker}:`, err);
                    // Return cached data if available, else zero
                    const cached = getQuote(ticker);
                    if (cached) {
                        return {
                            ticker: cached.ticker,
                            name: cached.name || ticker,
                            price: cached.price,
                            change: cached.change,
                            changePercent: cached.changePercent,
                        };
                    }
                    return { ticker, name: ticker, price: 0, change: 0, changePercent: 0 };
                }
            });

            const data = await Promise.all(promises);
            setTickers(data);

            // Update Zustand cache
            setQuotes(data.map((d) => ({
                ticker: d.ticker,
                price: d.price,
                change: d.change,
                changePercent: d.changePercent,
                name: d.name,
            })));
        } catch (err) {
            console.error('MarketOverview fetch error:', err);
            setError('Failed to load market data');
        } finally {
            setLoading(false);
        }
    }, [getQuote, isStale, setQuotes]);

    useEffect(() => {
        fetchData();
        const interval = setInterval(fetchData, 60000);
        return () => clearInterval(interval);
    }, [fetchData]);

    if (loading) {
        return (
            <div>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                    {TRACKED_TICKERS.map((t) => (
                        <div key={t} className="bg-white/5 rounded-lg p-4 animate-pulse">
                            <div className="h-4 bg-white/10 rounded w-12 mb-2" />
                            <div className="h-6 bg-white/10 rounded w-20 mb-1" />
                            <div className="h-3 bg-white/10 rounded w-16" />
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    if (error && tickers.length === 0) {
        return (
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-center">
                <p className="text-red-300 text-sm">{error}</p>
                <button
                    onClick={() => { setLoading(true); fetchData(); }}
                    className="mt-2 text-red-400 hover:text-red-300 text-sm underline"
                >
                    Retry
                </button>
            </div>
        );
    }

    return (
        <div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                {tickers.map((ticker) => (
                    <div
                        key={ticker.ticker}
                        className="bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-md rounded-lg p-4 border border-white/10 hover:border-amber-500/50 transition"
                    >
                        <div className="text-xs text-gray-400 mb-1">{ticker.name}</div>
                        <div className="text-xl font-bold text-white mb-1">
                            ${ticker.price.toFixed(2)}
                        </div>
                        <div
                            className={`text-sm font-medium ${ticker.changePercent >= 0 ? 'text-green-400' : 'text-red-400'
                                }`}
                        >
                            {ticker.changePercent >= 0 ? '↑' : '↓'} {Math.abs(ticker.changePercent).toFixed(2)}%
                        </div>
                    </div>
                ))}
            </div>
            {lastUpdated && (
                <p className="text-xs text-gray-500 mt-2 text-right">
                    Last updated: {new Date(lastUpdated).toLocaleTimeString()}
                </p>
            )}
        </div>
    );
}
