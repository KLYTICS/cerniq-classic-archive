'use client';

import { TrendingUp, TrendingDown, Minus, Target, PieChart } from 'lucide-react';

interface ValuationCardProps {
    ticker: string;
    fairValueLow: number;
    fairValueHigh: number;
    currentPrice: number;
    upsideDownside: number;
    cyclePosition: string;
}

export default function ValuationCard({
    ticker,
    fairValueLow,
    fairValueHigh,
    currentPrice,
    upsideDownside,
    cyclePosition,
}: ValuationCardProps) {
    const fairValueMid = (fairValueLow + fairValueHigh) / 2;

    // Determine valuation status
    const isUndervalued = upsideDownside > 10;
    const isOvervalued = upsideDownside < -10;
    const isFairlyValued = !isUndervalued && !isOvervalued;

    const statusColor = isUndervalued
        ? 'from-green-500 to-emerald-600'
        : isOvervalued
            ? 'from-red-500 to-rose-600'
            : 'from-yellow-500 to-amber-600';

    const statusBg = isUndervalued
        ? 'bg-green-500/10 border-green-500/50'
        : isOvervalued
            ? 'bg-red-500/10 border-red-500/50'
            : 'bg-yellow-500/10 border-yellow-500/50';

    const statusText = isUndervalued
        ? 'Undervalued'
        : isOvervalued
            ? 'Overvalued'
            : 'Fairly Valued';

    const StatusIcon = isUndervalued ? TrendingUp : isOvervalued ? TrendingDown : Minus;

    // Calculate gauge position (0-100%)
    const minRange = Math.min(fairValueLow * 0.7, currentPrice * 0.7);
    const maxRange = Math.max(fairValueHigh * 1.3, currentPrice * 1.3);
    const gaugePosition = ((currentPrice - minRange) / (maxRange - minRange)) * 100;
    const fairLowPos = ((fairValueLow - minRange) / (maxRange - minRange)) * 100;
    const fairHighPos = ((fairValueHigh - minRange) / (maxRange - minRange)) * 100;

    return (
        <div className="bg-white/10 backdrop-blur-md rounded-2xl p-8 border border-white/20 hover:border-purple-500/50 transition">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h3 className="text-2xl font-bold text-white mb-1">{ticker} Valuation</h3>
                    <p className="text-gray-400 text-sm">Cyclical Analysis</p>
                </div>
                <div className={`px-4 py-2 rounded-xl border ${statusBg} flex items-center gap-2`}>
                    <StatusIcon className="w-5 h-5" />
                    <span className="font-semibold">{statusText}</span>
                </div>
            </div>

            {/* Fair Value Range */}
            <div className="mb-8">
                <div className="flex items-baseline justify-between mb-3">
                    <span className="text-gray-300">Fair Value Range</span>
                    <span className="text-3xl font-bold text-white">
                        ${fairValueLow.toFixed(2)} - ${fairValueHigh.toFixed(2)}
                    </span>
                </div>

                {/* Visual Gauge */}
                <div className="relative h-3 bg-gray-700/50 rounded-full overflow-hidden">
                    {/* Fair value range bar */}
                    <div
                        className="absolute h-full bg-gradient-to-r from-blue-500/40 to-purple-500/40"
                        style={{
                            left: `${fairLowPos}%`,
                            width: `${fairHighPos - fairLowPos}%`,
                        }}
                    />
                    {/* Current price indicator */}
                    <div
                        className="absolute top-1/2 transform -translate-y-1/2 w-1 h-6 bg-white shadow-lg"
                        style={{ left: `${gaugePosition}%` }}
                    />
                </div>

                <div className="flex justify-between mt-2 text-xs text-gray-400">
                    <span>${minRange.toFixed(0)}</span>
                    <span>${maxRange.toFixed(0)}</span>
                </div>
            </div>

            {/* Metrics Grid */}
            <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="bg-white/5 rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-2">
                        <Target className="w-4 h-4 text-purple-400" />
                        <span className="text-gray-400 text-sm">Current Price</span>
                    </div>
                    <div className="text-2xl font-bold text-white">${currentPrice.toFixed(2)}</div>
                </div>

                <div className={`rounded-xl p-4 bg-gradient-to-br ${statusColor}`}>
                    <div className="flex items-center gap-2 mb-2">
                        <StatusIcon className="w-4 h-4 text-white" />
                        <span className="text-white/90 text-sm">Upside/Downside</span>
                    </div>
                    <div className="text-2xl font-bold text-white">
                        {upsideDownside > 0 ? '+' : ''}{upsideDownside.toFixed(1)}%
                    </div>
                </div>
            </div>

            {/* Cycle Position */}
            <div className="bg-purple-500/10 border border-purple-500/30 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                    <PieChart className="w-4 h-4 text-purple-400" />
                    <span className="text-gray-300 text-sm">Cycle Position</span>
                </div>
                <div className="text-lg font-semibold text-white">{cyclePosition}</div>
            </div>
        </div>
    );
}
