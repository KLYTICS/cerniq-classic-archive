'use client';

import { useEffect, useState } from 'react';
import { useWebSocket } from '@/lib/websocket';
import StockInsightsPopup from './dashboard/StockInsightsPopup';

interface PriceUpdate {
    ticker: string;
    price: number;
    change: number;
    change_percent: number;
    volume: number;
    timestamp: string;
}

interface MarketTickerProps {
    tickers: string[];
}

export default function MarketTicker({ tickers }: MarketTickerProps) {
    const [prices, setPrices] = useState<Map<string, PriceUpdate>>(new Map());
    const [isSubscribed, setIsSubscribed] = useState(false);

    const { isConnected, send } = useWebSocket((message) => {
        if (message.type === 'price_update') {
            const update = message.data as PriceUpdate;
            setPrices((prev) => new Map(prev).set(update.ticker, update));
        } else if (message.type === 'subscribed') {
            setIsSubscribed(true);
            console.log('Subscribed to:', message.data.tickers);
        } else if (message.type === 'error') {
            console.error('WebSocket error:', message.data.message);
        }
    });

    useEffect(() => {
        if (isConnected && tickers.length > 0) {
            // Subscribe to tickers
            send({
                type: 'subscribe',
                tickers: tickers,
            });
        }
    }, [isConnected, tickers, send]);

    if (!isConnected) {
        return (
            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
                <p className="text-sm text-yellow-800 dark:text-yellow-200">
                    🔄 Connecting to market data stream...
                </p>
            </div>
        );
    }

    if (!isSubscribed || prices.size === 0) {
        return (
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                <p className="text-sm text-blue-800 dark:text-blue-200">
                    📡 Loading market data...
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-2">
            <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                    Live Market Data
                </h3>
                <div className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse"></div>
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                        Connected
                    </span>
                </div>
            </div>

            <div className="grid gap-3">
                {Array.from(prices.entries()).map(([ticker, data]) => (
                    <div
                        key={ticker}
                        className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 transition-all hover:shadow-md"
                    >
                        <div className="flex items-start justify-between">
                            <div>
                                <h4 className="font-bold text-lg text-gray-900 dark:text-white">
                                    {ticker}
                                </h4>
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                                    {new Date(data.timestamp).toLocaleTimeString()}
                                </p>
                            </div>
                            <div className="text-right">
                                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                                    ${data.price.toFixed(2)}
                                </p>
                                <div
                                    className={`flex items-center justify-end gap-1 mt-1 ${data.change >= 0
                                        ? 'text-green-600 dark:text-green-400'
                                        : 'text-red-600 dark:text-red-400'
                                        }`}
                                >
                                    <span className="text-sm font-semibold">
                                        {data.change >= 0 ? '↑' : '↓'} {Math.abs(data.change).toFixed(2)}
                                    </span>
                                    <span className="text-sm">
                                        ({data.change_percent >= 0 ? '+' : ''}
                                        {data.change_percent.toFixed(2)}%)
                                    </span>
                                </div>
                                <div className="mt-2 flex justify-end">
                                    <StockInsightsPopup
                                        ticker={ticker}
                                        trigger={
                                            <button className="text-xs bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 px-2 py-1 rounded transition flex items-center gap-1">
                                                ✨ AI Insight
                                            </button>
                                        }
                                    />
                                </div>
                            </div>
                        </div>
                        <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
                            <div className="flex items-center justify-between text-xs text-gray-600 dark:text-gray-400">
                                <span>Volume</span>
                                <span className="font-mono">
                                    {(data.volume / 1_000_000).toFixed(2)}M
                                </span>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
