import { useEffect, useRef, useState, useCallback, useSyncExternalStore } from 'react';
import { io, Socket } from 'socket.io-client';
import { getMarketSocketNamespaceUrl } from './marketTransport';

interface PriceUpdate {
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
    quoteTimestamp?: Date | string;
    serverTimestamp?: Date | string;
    ageMs?: number;
    price: number;
    change: number;
    changePercent: number;
    volume: number;
    timestamp: Date;
    high?: number;
    low?: number;
    previousClose?: number;
}

interface NewsArticle {
    id: string;
    title: string;
    publisher: string;
    link: string;
    publishedAt: string | Date;
    relatedTickers?: string[];
    thumbnailUrl?: string;
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

interface InstrumentUpdate {
    ticker: string;
    quote?: PriceUpdate;
    profile: InstrumentProfile;
    timestamp?: string | Date;
}

interface NewsUpdate {
    ticker: string;
    items: NewsArticle[];
    timestamp?: string | Date;
}

interface GreeksUpdate {
    ticker: string;
    strike: number;
    maturity: string;
    optionType: 'call' | 'put';
    underlyingPrice: number;
    greeks: {
        delta: number;
        gamma: number;
        theta: number;
        vega: number;
        rho: number;
        price: number;
    };
    timestamp: Date;
}

interface PnLUpdate {
    portfolioId: string;
    totalValue: number;
    totalCost: number;
    totalPnL: number;
    totalPnLPercent: number;
    timestamp: Date;
}

const SOCKET_NAMESPACE_URL = getMarketSocketNamespaceUrl();
let sharedSocket: Socket | null = null;
let socketConsumerCount = 0;
const connectionListeners = new Set<(connected: boolean) => void>();
const tickerRoomReferences = new Map<string, number>();

function notifyConnectionState(connected: boolean) {
    connectionListeners.forEach((listener) => listener(connected));
}

function subscribeToConnectionSnapshot(onStoreChange: () => void) {
    const handleConnectionChange = () => {
        onStoreChange();
    };

    connectionListeners.add(handleConnectionChange);
    return () => {
        connectionListeners.delete(handleConnectionChange);
    };
}

function getConnectionSnapshot() {
    return sharedSocket?.connected ?? false;
}

function getSharedSocket(): Socket {
    if (sharedSocket) {
        return sharedSocket;
    }

    sharedSocket = io(SOCKET_NAMESPACE_URL, {
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
    });

    sharedSocket.on('connect', () => {
        notifyConnectionState(true);
    });

    sharedSocket.on('disconnect', () => {
        notifyConnectionState(false);
    });

    sharedSocket.on('error', (error) => {
        console.error('Socket.IO error:', error);
    });

    return sharedSocket;
}

function retainTickerRoom(ticker: string) {
    const symbol = ticker.toUpperCase();
    const socket = getSharedSocket();
    const current = tickerRoomReferences.get(symbol) ?? 0;
    if (current === 0) {
        socket.emit('subscribe-ticker', { ticker: symbol });
    }
    tickerRoomReferences.set(symbol, current + 1);
}

function releaseTickerRoom(ticker: string) {
    const symbol = ticker.toUpperCase();
    const socket = getSharedSocket();
    const current = tickerRoomReferences.get(symbol) ?? 0;
    if (current <= 1) {
        tickerRoomReferences.delete(symbol);
        socket.emit('unsubscribe-ticker', { ticker: symbol });
        return;
    }
    tickerRoomReferences.set(symbol, current - 1);
}

/**
 * Hook for real-time market data via Socket.IO
 */
export function useMarketDataSocket() {
    const isConnected = useSyncExternalStore(
        subscribeToConnectionSnapshot,
        getConnectionSnapshot,
        () => false,
    );
    const socketRef = useRef<Socket | null>(null);

    useEffect(() => {
        const socket = getSharedSocket();
        socketRef.current = socket;
        socketConsumerCount += 1;

        return () => {
            socketConsumerCount = Math.max(0, socketConsumerCount - 1);
            if (socketConsumerCount === 0 && sharedSocket) {
                sharedSocket.close();
                sharedSocket = null;
                tickerRoomReferences.clear();
                notifyConnectionState(false);
            }
        };
    }, []);

    const subscribeTicker = useCallback((ticker: string, callback: (data: PriceUpdate) => void) => {
        const socket = socketRef.current ?? getSharedSocket();
        const symbol = ticker.toUpperCase();
        const handler = (data: PriceUpdate) => {
            if (data.ticker?.toUpperCase() === symbol) {
                callback(data);
            }
        };

        retainTickerRoom(symbol);
        socket.on('price-update', handler);

        return () => {
            socket.off('price-update', handler);
            releaseTickerRoom(symbol);
        };
    }, []);

    const subscribeGreeks = useCallback((
        ticker: string,
        strike: number,
        maturity: string,
        optionType: 'call' | 'put',
        callback: (data: GreeksUpdate) => void,
    ) => {
        const socket = socketRef.current ?? getSharedSocket();
        const symbol = ticker.toUpperCase();
        const handler = (data: GreeksUpdate) => {
            if (
                data.ticker?.toUpperCase() === symbol &&
                data.strike === strike &&
                data.maturity === maturity &&
                data.optionType === optionType
            ) {
                callback(data);
            }
        };

        socket.emit('subscribe-greeks', { ticker: symbol, strike, maturity, optionType });
        socket.on('greeks-update', handler);

        return () => {
            socket.off('greeks-update', handler);
        };
    }, []);

    const subscribePortfolioPnL = useCallback((
        portfolioId: string,
        userId: string,
        callback: (data: PnLUpdate) => void,
    ) => {
        const socket = socketRef.current ?? getSharedSocket();
        const handler = (data: PnLUpdate) => {
            if (data.portfolioId === portfolioId) {
                callback(data);
            }
        };

        socket.emit('subscribe-portfolio-pnl', { portfolioId, userId });
        socket.on('pnl-update', handler);

        return () => {
            socket.off('pnl-update', handler);
        };
    }, []);

    const subscribeInstrument = useCallback((ticker: string, callback: (data: InstrumentUpdate) => void) => {
        const socket = socketRef.current ?? getSharedSocket();
        const symbol = ticker.toUpperCase();
        const handler = (data: InstrumentUpdate) => {
            if (data.ticker?.toUpperCase() === symbol) {
                callback(data);
            }
        };

        retainTickerRoom(symbol);
        socket.on('instrument-update', handler);

        return () => {
            socket.off('instrument-update', handler);
            releaseTickerRoom(symbol);
        };
    }, []);

    const subscribeNews = useCallback((ticker: string, callback: (data: NewsUpdate) => void) => {
        const socket = socketRef.current ?? getSharedSocket();
        const symbol = ticker.toUpperCase();
        const handler = (data: NewsUpdate) => {
            if (data.ticker?.toUpperCase() === symbol) {
                callback(data);
            }
        };

        retainTickerRoom(symbol);
        socket.on('news-update', handler);

        return () => {
            socket.off('news-update', handler);
            releaseTickerRoom(symbol);
        };
    }, []);

    return {
        isConnected,
        subscribeTicker,
        subscribeGreeks,
        subscribePortfolioPnL,
        subscribeInstrument,
        subscribeNews,
    };
}

/**
 * Hook for live ticker price updates
 */
export function useLivePrice(ticker: string | null) {
    const [priceData, setPriceData] = useState<PriceUpdate | null>(null);
    const [priceDirection, setPriceDirection] = useState<'up' | 'down' | 'neutral'>('neutral');
    const { isConnected, subscribeTicker } = useMarketDataSocket();
    const previousPriceRef = useRef<number | null>(null);
    const directionResetTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        if (!ticker || !isConnected) {
            previousPriceRef.current = null;
            setPriceDirection('neutral');
            return;
        }

        const unsubscribe = subscribeTicker(ticker, (data) => {
            const previousPrice = previousPriceRef.current;
            if (previousPrice !== null) {
                if (data.price > previousPrice) {
                    setPriceDirection('up');
                } else if (data.price < previousPrice) {
                    setPriceDirection('down');
                } else {
                    setPriceDirection('neutral');
                }

                if (directionResetTimeoutRef.current) {
                    clearTimeout(directionResetTimeoutRef.current);
                }

                directionResetTimeoutRef.current = setTimeout(() => {
                    setPriceDirection('neutral');
                }, 500);
            }

            previousPriceRef.current = data.price;
            setPriceData(data);
        });

        return () => {
            unsubscribe();
            if (directionResetTimeoutRef.current) {
                clearTimeout(directionResetTimeoutRef.current);
                directionResetTimeoutRef.current = null;
            }
        };
    }, [ticker, isConnected, subscribeTicker]);

    return { priceData, isConnected, priceDirection };
}

export function useLiveInstrument(ticker: string | null) {
    const [instrumentData, setInstrumentData] = useState<InstrumentUpdate | null>(null);
    const { isConnected, subscribeInstrument } = useMarketDataSocket();

    useEffect(() => {
        if (!ticker || !isConnected) return;

        const unsubscribe = subscribeInstrument(ticker, (data) => {
            setInstrumentData(data);
        });

        return unsubscribe;
    }, [ticker, isConnected, subscribeInstrument]);

    return { instrumentData, isConnected };
}

export function useLiveNews(ticker: string | null) {
    const [newsData, setNewsData] = useState<NewsUpdate | null>(null);
    const { isConnected, subscribeNews } = useMarketDataSocket();

    useEffect(() => {
        if (!ticker || !isConnected) return;

        const unsubscribe = subscribeNews(ticker, (data) => {
            setNewsData(data);
        });

        return unsubscribe;
    }, [ticker, isConnected, subscribeNews]);

    return { newsData, isConnected };
}

/**
 * Hook for live Greeks updates
 */
export function useLiveGreeks(
    ticker: string | null,
    strike: number,
    maturity: string,
    optionType: 'call' | 'put',
) {
    const [greeksData, setGreeksData] = useState<GreeksUpdate | null>(null);
    const { isConnected, subscribeGreeks } = useMarketDataSocket();

    useEffect(() => {
        if (!ticker || !isConnected) return;

        const unsubscribe = subscribeGreeks(ticker, strike, maturity, optionType, (data) => {
            setGreeksData(data);
        });

        return unsubscribe;
    }, [ticker, strike, maturity, optionType, isConnected, subscribeGreeks]);

    return { greeksData, isConnected };
}

/**
 * Hook for live portfolio P&L
 */
export function useLivePortfolioPnL(portfolioId: string | null, userId: string) {
    const [pnlData, setPnlData] = useState<PnLUpdate | null>(null);
    const { isConnected, subscribePortfolioPnL } = useMarketDataSocket();

    useEffect(() => {
        if (!portfolioId || !isConnected) return;

        const unsubscribe = subscribePortfolioPnL(portfolioId, userId, (data) => {
            setPnlData(data);
        });

        return unsubscribe;
    }, [portfolioId, userId, isConnected, subscribePortfolioPnL]);

    return { pnlData, isConnected };
}
