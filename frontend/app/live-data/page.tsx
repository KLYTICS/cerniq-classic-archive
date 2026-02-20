'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { io, Socket } from 'socket.io-client';
import { apiClient } from '@/lib/api';

const NODE_API_URL = process.env.NEXT_PUBLIC_NODE_API_URL || 'http://localhost:3000';

interface PriceData {
    symbol: string;
    price: number;
    change: number;
    changePercent: number;
    high: number;
    low: number;
    volume: string;
    lastUpdate: Date;
}

interface PriceAlert {
    id: string;
    symbol: string;
    targetPrice: number;
    direction: 'above' | 'below';
    triggered: boolean;
}

export default function LiveDataPage() {
    const [watchlist, setWatchlist] = useState<string[]>(['NVDA', 'AAPL', 'MSFT', 'GOOGL', 'META', 'AMD', 'TSLA', 'SPY']);
    const [prices, setPrices] = useState<Record<string, PriceData>>({});
    const [newSymbol, setNewSymbol] = useState('');
    const [alerts, setAlerts] = useState<PriceAlert[]>([]);
    const [newAlert, setNewAlert] = useState<{ symbol: string; price: string; direction: 'above' | 'below' }>({ symbol: '', price: '', direction: 'above' });
    const [connected, setConnected] = useState(false);
    const [loading, setLoading] = useState(true);
    const socketRef = useRef<Socket | null>(null);
    const pollingRef = useRef<NodeJS.Timeout | null>(null);

    // Fetch initial data via REST (also serves as polling fallback)
    const fetchPricesViaREST = useCallback(async (tickers: string[]) => {
        const results: Record<string, PriceData> = {};
        await Promise.all(
            tickers.map(async (symbol) => {
                try {
                    const data = await apiClient.getNodeQuote(symbol);
                    results[symbol] = {
                        symbol,
                        price: data.price ?? 0,
                        change: data.change ?? 0,
                        changePercent: data.changePercent ?? 0,
                        high: data.dayHigh ?? data.price * 1.01,
                        low: data.dayLow ?? data.price * 0.99,
                        volume: data.volume ? `${(data.volume / 1_000_000).toFixed(1)}M` : '--',
                        lastUpdate: new Date(),
                    };
                } catch (err) {
                    console.error(`Failed to fetch ${symbol}:`, err);
                }
            })
        );
        setPrices((prev) => ({ ...prev, ...results }));
        setLoading(false);
    }, []);

    // Socket.IO connection
    useEffect(() => {
        const socket = io(`${NODE_API_URL}/market-data`, {
            transports: ['websocket', 'polling'],
            reconnection: true,
            reconnectionDelay: 3000,
        });
        socketRef.current = socket;

        socket.on('connect', () => {
            setConnected(true);
            // Subscribe to all watchlist tickers
            watchlist.forEach((ticker) => {
                socket.emit('subscribe-ticker', { ticker });
            });
            // Stop polling when socket connects
            if (pollingRef.current) {
                clearInterval(pollingRef.current);
                pollingRef.current = null;
            }
        });

        socket.on('disconnect', () => {
            setConnected(false);
            // Start polling fallback
            startPolling();
        });

        socket.on('connect_error', () => {
            setConnected(false);
            // Start polling fallback if socket fails
            if (!pollingRef.current) {
                startPolling();
            }
        });

        socket.on('price-update', (data: { ticker: string; price: number; change: number; changePercent: number; volume?: number; timestamp?: string }) => {
            setPrices((prev) => ({
                ...prev,
                [data.ticker]: {
                    symbol: data.ticker,
                    price: data.price,
                    change: data.change ?? 0,
                    changePercent: data.changePercent ?? 0,
                    high: Math.max(prev[data.ticker]?.high ?? 0, data.price),
                    low: prev[data.ticker]?.low ? Math.min(prev[data.ticker].low, data.price) : data.price,
                    volume: data.volume ? `${(data.volume / 1_000_000).toFixed(1)}M` : prev[data.ticker]?.volume ?? '--',
                    lastUpdate: new Date(data.timestamp || Date.now()),
                },
            }));
            setLoading(false);
        });

        // Initial REST fetch (in case socket takes time)
        fetchPricesViaREST(watchlist);

        return () => {
            socket.disconnect();
            if (pollingRef.current) {
                clearInterval(pollingRef.current);
            }
        };
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    const startPolling = useCallback(() => {
        if (pollingRef.current) return;
        pollingRef.current = setInterval(() => {
            fetchPricesViaREST(watchlist);
        }, 5000);
    }, [watchlist, fetchPricesViaREST]);

    // Subscribe/unsubscribe when watchlist changes
    useEffect(() => {
        if (!socketRef.current?.connected) return;
        // Re-subscribe to current watchlist
        watchlist.forEach((ticker) => {
            socketRef.current?.emit('subscribe-ticker', { ticker });
        });
    }, [watchlist]);

    // Check alerts
    useEffect(() => {
        setAlerts((prev) =>
            prev.map((alert) => {
                if (alert.triggered) return alert;
                const data = prices[alert.symbol];
                if (!data) return alert;
                if (alert.direction === 'above' && data.price >= alert.targetPrice) {
                    return { ...alert, triggered: true };
                }
                if (alert.direction === 'below' && data.price <= alert.targetPrice) {
                    return { ...alert, triggered: true };
                }
                return alert;
            })
        );
    }, [prices]);

    const addToWatchlist = () => {
        const symbol = newSymbol.toUpperCase().trim();
        if (symbol && !watchlist.includes(symbol)) {
            setWatchlist([...watchlist, symbol]);
            // Subscribe via socket
            socketRef.current?.emit('subscribe-ticker', { ticker: symbol });
            // Also fetch immediately via REST
            fetchPricesViaREST([symbol]);
            setNewSymbol('');
        }
    };

    const removeFromWatchlist = (symbol: string) => {
        setWatchlist(watchlist.filter(s => s !== symbol));
        socketRef.current?.emit('unsubscribe-ticker', { ticker: symbol });
    };

    const addAlert = () => {
        if (newAlert.symbol && newAlert.price) {
            setAlerts([
                ...alerts,
                {
                    id: Date.now().toString(),
                    symbol: newAlert.symbol.toUpperCase(),
                    targetPrice: parseFloat(newAlert.price),
                    direction: newAlert.direction,
                    triggered: false,
                },
            ]);
            setNewAlert({ symbol: '', price: '', direction: 'above' });
        }
    };

    const formatPrice = (price: number) => price.toFixed(2);

    // Skeleton loader for initial load
    if (loading && Object.keys(prices).length === 0) {
        return (
            <div className="min-h-screen bg-gray-950 text-white p-8">
                <div className="mb-8">
                    <Link href="/dashboard" className="text-cyan-400 hover:text-cyan-300 text-sm mb-2 block">
                        &larr; Back to Dashboard
                    </Link>
                    <h1 className="text-3xl font-bold bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">
                        Real-Time Market Data
                    </h1>
                    <p className="text-gray-400 mt-1">Connecting to live data stream...</p>
                </div>
                <div className="bg-gray-900/50 rounded-xl border border-gray-800 overflow-hidden">
                    <div className="p-4 border-b border-gray-800">
                        <div className="h-6 bg-white/10 rounded w-32 animate-pulse" />
                    </div>
                    {[...Array(8)].map((_, i) => (
                        <div key={i} className="flex items-center gap-4 p-4 border-t border-gray-800 animate-pulse">
                            <div className="h-5 bg-white/10 rounded w-16" />
                            <div className="h-5 bg-white/10 rounded w-24 ml-auto" />
                            <div className="h-4 bg-white/10 rounded w-16" />
                            <div className="h-4 bg-white/10 rounded w-16" />
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-950 text-white p-8">
            {/* Header */}
            <div className="flex justify-between items-start mb-8">
                <div>
                    <Link href="/dashboard" className="text-cyan-400 hover:text-cyan-300 text-sm mb-2 block">
                        &larr; Back to Dashboard
                    </Link>
                    <h1 className="text-3xl font-bold bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">
                        Real-Time Market Data
                    </h1>
                    <p className="text-gray-400 mt-1">
                        {connected ? 'Live streaming via WebSocket' : 'Polling mode (reconnecting...)'}
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${connected ? 'bg-green-500 animate-pulse' : 'bg-yellow-500'}`}></span>
                    <span className="text-sm text-gray-400">{connected ? 'Live' : 'Polling'}</span>
                </div>
            </div>

            {/* Ticker Tape */}
            <div className="bg-gray-900/80 rounded-xl border border-gray-800 p-4 mb-8 overflow-hidden">
                <div className="flex gap-8 animate-marquee">
                    {Object.values(prices).map((data) => (
                        <div key={data.symbol} className="flex items-center gap-3 whitespace-nowrap">
                            <span className="font-bold text-blue-400">{data.symbol}</span>
                            <span className="font-mono">${formatPrice(data.price)}</span>
                            <span className={`font-medium ${data.change >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                {data.change >= 0 ? '\u25B2' : '\u25BC'} {Math.abs(data.changePercent).toFixed(2)}%
                            </span>
                        </div>
                    ))}
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Watchlist */}
                <div className="lg:col-span-2">
                    <div className="bg-gray-900/50 rounded-xl border border-gray-800 overflow-hidden">
                        <div className="p-4 border-b border-gray-800 flex justify-between items-center">
                            <h2 className="text-xl font-semibold">Watchlist</h2>
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    value={newSymbol}
                                    onChange={(e) => setNewSymbol(e.target.value.toUpperCase())}
                                    placeholder="Add ticker..."
                                    className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm focus:border-cyan-500 focus:outline-none"
                                    onKeyDown={(e) => e.key === 'Enter' && addToWatchlist()}
                                />
                                <button
                                    onClick={addToWatchlist}
                                    className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 rounded-lg text-sm transition"
                                >
                                    Add
                                </button>
                            </div>
                        </div>

                        <table className="w-full">
                            <thead className="bg-gray-800/50">
                                <tr>
                                    <th className="text-left p-4 text-gray-400 font-medium">Symbol</th>
                                    <th className="text-right p-4 text-gray-400 font-medium">Price</th>
                                    <th className="text-right p-4 text-gray-400 font-medium">Change</th>
                                    <th className="text-right p-4 text-gray-400 font-medium">High</th>
                                    <th className="text-right p-4 text-gray-400 font-medium">Low</th>
                                    <th className="text-right p-4 text-gray-400 font-medium">Volume</th>
                                    <th className="p-4"></th>
                                </tr>
                            </thead>
                            <tbody>
                                {watchlist.map((symbol) => {
                                    const data = prices[symbol];
                                    if (!data) {
                                        return (
                                            <tr key={symbol} className="border-t border-gray-800">
                                                <td className="p-4"><span className="font-bold text-cyan-400">{symbol}</span></td>
                                                <td colSpan={5} className="p-4 text-center text-gray-500">Loading...</td>
                                                <td className="p-4">
                                                    <button onClick={() => removeFromWatchlist(symbol)} className="text-gray-500 hover:text-red-400 transition">
                                                        &#x2715;
                                                    </button>
                                                </td>
                                            </tr>
                                        );
                                    }
                                    return (
                                        <tr key={symbol} className="border-t border-gray-800 hover:bg-gray-800/30 transition">
                                            <td className="p-4">
                                                <span className="font-bold text-cyan-400">{symbol}</span>
                                            </td>
                                            <td className="p-4 text-right font-mono text-lg">
                                                ${formatPrice(data.price)}
                                            </td>
                                            <td className={`p-4 text-right ${data.change >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                                <div className="font-medium">
                                                    {data.change >= 0 ? '+' : ''}{formatPrice(data.change)}
                                                </div>
                                                <div className="text-sm">
                                                    {data.change >= 0 ? '+' : ''}{data.changePercent.toFixed(2)}%
                                                </div>
                                            </td>
                                            <td className="p-4 text-right text-gray-400">${formatPrice(data.high)}</td>
                                            <td className="p-4 text-right text-gray-400">${formatPrice(data.low)}</td>
                                            <td className="p-4 text-right text-gray-400">{data.volume}</td>
                                            <td className="p-4">
                                                <button
                                                    onClick={() => removeFromWatchlist(symbol)}
                                                    className="text-gray-500 hover:text-red-400 transition"
                                                >
                                                    &#x2715;
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Price Alerts */}
                <div className="bg-gray-900/50 rounded-xl border border-gray-800 p-6">
                    <h2 className="text-xl font-semibold mb-6">Price Alerts</h2>

                    {/* Add Alert Form */}
                    <div className="space-y-3 mb-6">
                        <input
                            type="text"
                            value={newAlert.symbol}
                            onChange={(e) => setNewAlert({ ...newAlert, symbol: e.target.value.toUpperCase() })}
                            placeholder="Symbol"
                            className="w-full p-3 bg-gray-800 border border-gray-700 rounded-lg focus:border-cyan-500 focus:outline-none"
                        />
                        <div className="flex gap-2">
                            <select
                                value={newAlert.direction}
                                onChange={(e) => setNewAlert({ ...newAlert, direction: e.target.value as 'above' | 'below' })}
                                className="p-3 bg-gray-800 border border-gray-700 rounded-lg focus:border-cyan-500 focus:outline-none"
                            >
                                <option value="above">Above</option>
                                <option value="below">Below</option>
                            </select>
                            <input
                                type="number"
                                value={newAlert.price}
                                onChange={(e) => setNewAlert({ ...newAlert, price: e.target.value })}
                                placeholder="Price"
                                className="flex-1 p-3 bg-gray-800 border border-gray-700 rounded-lg focus:border-cyan-500 focus:outline-none"
                            />
                        </div>
                        <button
                            onClick={addAlert}
                            className="w-full py-3 bg-cyan-600 hover:bg-cyan-500 rounded-lg font-medium transition"
                        >
                            Create Alert
                        </button>
                    </div>

                    {/* Alert List */}
                    <div className="space-y-3">
                        {alerts.length === 0 ? (
                            <p className="text-gray-500 text-center py-4">No alerts set</p>
                        ) : (
                            alerts.map((alert) => (
                                <div
                                    key={alert.id}
                                    className={`p-3 rounded-lg border ${alert.triggered
                                        ? 'bg-green-900/30 border-green-700'
                                        : 'bg-gray-800/50 border-gray-700'
                                        }`}
                                >
                                    <div className="flex justify-between items-center">
                                        <span className="font-bold text-cyan-400">{alert.symbol}</span>
                                        <span className={`text-sm px-2 py-1 rounded ${alert.triggered ? 'bg-green-800 text-green-400' : 'bg-gray-700 text-gray-400'
                                            }`}>
                                            {alert.triggered ? 'Triggered' : 'Active'}
                                        </span>
                                    </div>
                                    <p className="text-gray-400 text-sm mt-1">
                                        {alert.direction === 'above' ? '\u2191 Above' : '\u2193 Below'} ${alert.targetPrice.toFixed(2)}
                                    </p>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>

            <style jsx>{`
                @keyframes marquee {
                    0% { transform: translateX(0); }
                    100% { transform: translateX(-50%); }
                }
                .animate-marquee {
                    animation: marquee 30s linear infinite;
                }
            `}</style>
        </div>
    );
}
