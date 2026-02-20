'use client';

import { useLivePortfolioPnL } from '@/lib/marketDataSocket';
import { motion } from 'framer-motion';

interface LivePortfolioPnLProps {
    portfolioId: string;
    userId: string;
}

export function LivePortfolioPnL({ portfolioId, userId }: LivePortfolioPnLProps) {
    const { pnlData, isConnected } = useLivePortfolioPnL(portfolioId, userId);

    if (!pnlData) {
        return (
            <div className="p-6 bg-slate-900 rounded-xl border border-slate-700">
                <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-slate-600 rounded-full animate-pulse"></div>
                    <span className="text-slate-400">Loading portfolio P&L...</span>
                </div>
            </div>
        );
    }

    const isProfit = pnlData.totalPnL >= 0;
    const connectionColor = isConnected ? 'bg-green-500' : 'bg-orange-500';

    return (
        <motion.div
            className="p-6 bg-gradient-to-br from-slate-900 to-slate-800 rounded-xl border border-slate-700 shadow-lg"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
        >
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    <h3 className="text-xl font-bold text-white">Live Portfolio P&L</h3>
                    <div className="flex items-center gap-2">
                        <motion.div
                            className={`w-2 h-2 rounded-full ${connectionColor}`}
                            animate={{ scale: isConnected ? [1, 1.3, 1] : 1 }}
                            transition={{ repeat: isConnected ? Infinity : 0, duration: 2 }}
                        />
                        <span className="text-xs text-slate-400">
                            {isConnected ? 'Live' : 'Reconnecting...'}
                        </span>
                    </div>
                </div>
                <div className="text-xs text-slate-500">
                    {new Date(pnlData.timestamp).toLocaleTimeString()}
                </div>
            </div>

            {/* Metrics Grid */}
            <div className="grid grid-cols-2 gap-4">
                {/* Total Value */}
                <div className="p-4 bg-slate-800/50 rounded-lg border border-slate-700">
                    <div className="text-xs text-slate-400 mb-1">Total Value</div>
                    <div className="text-2xl font-bold text-white">
                        ${pnlData.totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                </div>

                {/* Total Cost */}
                <div className="p-4 bg-slate-800/50 rounded-lg border border-slate-700">
                    <div className="text-xs text-slate-400 mb-1">Total Cost</div>
                    <div className="text-2xl font-bold text-white">
                        ${pnlData.totalCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                </div>

                {/* Unrealized P&L (Dollar) */}
                <div className={`p-4 rounded-lg border ${isProfit ? 'bg-green-500/10 border-green-500/30' : 'bg-red-500/10 border-red-500/30'}`}>
                    <div className="text-xs text-slate-400 mb-1">Unrealized P&L</div>
                    <motion.div
                        className={`text-2xl font-bold ${isProfit ? 'text-green-400' : 'text-red-400'}`}
                        animate={{
                            scale: [1, 1.05, 1],
                        }}
                        transition={{ duration: 0.5 }}
                    >
                        {isProfit ? '+' : ''}${Math.abs(pnlData.totalPnL).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </motion.div>
                </div>

                {/* Unrealized P&L (Percent) */}
                <div className={`p-4 rounded-lg border ${isProfit ? 'bg-green-500/10 border-green-500/30' : 'bg-red-500/10 border-red-500/30'}`}>
                    <div className="text-xs text-slate-400 mb-1">Return %</div>
                    <motion.div
                        className={`text-2xl font-bold ${isProfit ? 'text-green-400' : 'text-red-400'}`}
                        animate={{
                            scale: [1, 1.05, 1],
                        }}
                        transition={{ duration: 0.5 }}
                    >
                        {isProfit ? '+' : ''}{pnlData.totalPnLPercent.toFixed(2)}%
                    </motion.div>
                </div>
            </div>

            {/* Visual P&L Bar */}
            <div className="mt-6">
                <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-slate-400">Performance</span>
                    <span className={`text-sm font-semibold ${isProfit ? 'text-green-400' : 'text-red-400'}`}>
                        {isProfit ? 'Profit' : 'Loss'}
                    </span>
                </div>
                <div className="h-3 bg-slate-700 rounded-full overflow-hidden">
                    <motion.div
                        className={`h-full ${isProfit ? 'bg-gradient-to-r from-green-500 to-green-400' : 'bg-gradient-to-r from-red-500 to-red-400'}`}
                        initial={{ width: 0 }}
                        animate={{
                            width: `${Math.min(Math.abs(pnlData.totalPnLPercent), 100)}%`,
                        }}
                        transition={{ duration: 0.8, ease: 'easeOut' }}
                    />
                </div>
            </div>
        </motion.div>
    );
}
