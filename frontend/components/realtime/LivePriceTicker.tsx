'use client';

import { motion } from 'framer-motion';
import { useLivePrice } from '@/lib/marketDataSocket';

interface LivePriceTickerProps {
    ticker: string;
}

export function LivePriceTicker({ ticker }: LivePriceTickerProps) {
    const { priceData, isConnected, priceDirection } = useLivePrice(ticker);

    if (!priceData) {
        return (
            <div className="flex items-center gap-2 px-4 py-2 bg-slate-800 rounded-lg">
                <div className="w-2 h-2 bg-slate-600 rounded-full"></div>
                <span className="text-slate-400 text-sm">Connecting...</span>
            </div>
        );
    }

    const isPositive = priceData.change >= 0;
    const connectionColor = isConnected ? 'bg-green-500' : 'bg-red-500';

    return (
        <motion.div
            className="flex items-center gap-4 px-6 py-3 bg-gradient-to-r from-slate-900 to-slate-800 rounded-xl border border-slate-700 shadow-lg"
            animate={{
                backgroundColor: priceDirection === 'up' ? '#10b98110' : priceDirection === 'down' ? '#ef444410' : undefined,
            }}
            transition={{ duration: 0.3 }}
        >
            {/* Connection Status */}
            <div className="flex items-center gap-2">
                <motion.div
                    className={`w-2 h-2 rounded-full ${connectionColor}`}
                    animate={{ scale: isConnected ? [1, 1.3, 1] : 1 }}
                    transition={{ repeat: isConnected ? Infinity : 0, duration: 2 }}
                />
                <span className="text-xs text-slate-500 uppercase">Live</span>
            </div>

            {/* Ticker Symbol */}
            <div className="text-lg font-bold text-white">{ticker}</div>

            {/*  Price */}
            <div className="flex items-baseline gap-2">
                <motion.div
                    className="text-3xl font-bold text-white"
                    animate={{
                        scale: priceDirection !== 'neutral' ? [1, 1.1, 1] : 1,
                        color: priceDirection === 'up' ? '#10b981' : priceDirection === 'down' ? '#ef4444' : '#ffffff',
                    }}
                    transition={{ duration: 0.3 }}
                >
                    ${priceData.price.toFixed(2)}
                </motion.div>

                {/* Direction Arrow */}
                {priceDirection !== 'neutral' && (
                    <motion.div
                        initial={{ opacity: 0, y: 0 }}
                        animate={{ opacity: 1, y: priceDirection === 'up' ? -5 : 5 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.3 }}
                        className={priceDirection === 'up' ? 'text-green-500' : 'text-red-500'}
                    >
                        {priceDirection === 'up' ? '↑' : '↓'}
                    </motion.div>
                )}
            </div>

            {/* Change */}
            <div className={`flex items-center gap-1 px-3 py-1 rounded-lg ${isPositive ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                <span className="text-sm font-semibold">
                    {isPositive ? '+' : ''}{priceData.change.toFixed(2)}
                </span>
                <span className="text-sm">
                    ({isPositive ? '+' : ''}{priceData.changePercent.toFixed(2)}%)
                </span>
            </div>

            {/* Volume */}
            <div className="flex flex-col items-end text-slate-400">
                <span className="text-xs">Volume</span>
                <span className="text-sm font-semibold">{(priceData.volume / 1000000).toFixed(2)}M</span>
            </div>

            {/* Last Update */}
            <div className="text-xs text-slate-500">
                {new Date(priceData.timestamp).toLocaleTimeString()}
            </div>
        </motion.div>
    );
}
