import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';

const SOCKET_URL = (
    process.env.NEXT_PUBLIC_SOCKET_URL ||
    process.env.NEXT_PUBLIC_NODE_API_URL ||
    ''
).trim().replace(/\/+$/, '');

interface PriceUpdate {
    ticker: string;
    price: number;
    change: number;
    changePercent: number;
    volume: number;
    timestamp: Date;
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

/**
 * Hook for real-time market data via Socket.IO
 */
export function useMarketDataSocket() {
    const [isConnected, setIsConnected] = useState(false);
    const socketRef = useRef<Socket | null>(null);

    useEffect(() => {
        const socket = io(`${SOCKET_URL}/market-data`, {
            transports: ['websocket', 'polling'],
            reconnection: true,
            reconnectionAttempts: 5,
            reconnectionDelay: 1000,
        });

        socket.on('connect', () => {
            console.log('✓ Socket.IO connected');
            setIsConnected(true);
        });

        socket.on('disconnect', () => {
            console.log('✗ Socket.IO disconnected');
            setIsConnected(false);
        });

        socket.on('error', (error) => {
            console.error('Socket.IO error:', error);
        });

        socketRef.current = socket;

        return () => {
            socket.close();
        };
    }, []);

    const subscribeTicker = useCallback((ticker: string, callback: (data: PriceUpdate) => void) => {
        if (!socketRef.current) return;

        socketRef.current.emit('subscribe-ticker', { ticker });
        socketRef.current.on('price-update', callback);

        return () => {
            socketRef.current?.emit('unsubscribe-ticker', { ticker });
            socketRef.current?.off('price-update', callback);
        };
    }, []);

    const subscribeGreeks = useCallback((
        ticker: string,
        strike: number,
        maturity: string,
        optionType: 'call' | 'put',
        callback: (data: GreeksUpdate) => void,
    ) => {
        if (!socketRef.current) return;

        socketRef.current.emit('subscribe-greeks', { ticker, strike, maturity, optionType });
        socketRef.current.on('greeks-update', callback);

        return () => {
            socketRef.current?.off('greeks-update', callback);
        };
    }, []);

    const subscribePortfolioPnL = useCallback((
        portfolioId: string,
        userId: string,
        callback: (data: PnLUpdate) => void,
    ) => {
        if (!socketRef.current) return;

        socketRef.current.emit('subscribe-portfolio-pnl', { portfolioId, userId });
        socketRef.current.on('pnl-update', callback);

        return () => {
            socketRef.current?.off('pnl-update', callback);
        };
    }, []);

    return {
        isConnected,
        subscribeTicker,
        subscribeGreeks,
        subscribePortfolioPnL,
    };
}

/**
 * Hook for live ticker price updates
 */
export function useLivePrice(ticker: string | null) {
    const [priceData, setPriceData] = useState<PriceUpdate | null>(null);
    const { isConnected, subscribeTicker } = useMarketDataSocket();

    useEffect(() => {
        if (!ticker || !isConnected) return;

        const unsubscribe = subscribeTicker(ticker, (data) => {
            setPriceData(data);
        });

        return unsubscribe;
    }, [ticker, isConnected, subscribeTicker]);

    return { priceData, isConnected };
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
