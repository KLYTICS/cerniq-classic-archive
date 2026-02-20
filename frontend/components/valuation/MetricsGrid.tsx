'use client';

import { Activity, DollarSign, TrendingUp, BarChart3 } from 'lucide-react';

interface MetricsGridProps {
    cyclesDetected: number;
    midCycleRevenue: number;
    midCycleEps: number;
    midCycleMargin: number;
    midCyclePe: number;
    fairValueBase: number;
}

export default function MetricsGrid({
    cyclesDetected,
    midCycleRevenue,
    midCycleEps,
    midCycleMargin,
    midCyclePe,
    fairValueBase,
}: MetricsGridProps) {
    const formatLargeNumber = (num: number) => {
        if (num >= 1e9) return `$${(num / 1e9).toFixed(2)}B`;
        if (num >= 1e6) return `$${(num / 1e6).toFixed(0)}M`;
        return `$${num.toFixed(2)}`;
    };

    const metrics = [
        {
            label: 'Cycles Detected',
            value: cyclesDetected.toString(),
            icon: Activity,
            color: 'from-blue-500 to-cyan-500',
            bgColor: 'bg-blue-500/10',
        },
        {
            label: 'Mid-Cycle Revenue',
            value: formatLargeNumber(midCycleRevenue),
            icon: DollarSign,
            color: 'from-green-500 to-emerald-500',
            bgColor: 'bg-green-500/10',
        },
        {
            label: 'Mid-Cycle EPS',
            value: `$${midCycleEps.toFixed(2)}`,
            icon: TrendingUp,
            color: 'from-purple-500 to-pink-500',
            bgColor: 'bg-purple-500/10',
        },
        {
            label: 'Mid-Cycle Margin',
            value: `${midCycleMargin.toFixed(1)}%`,
            icon: BarChart3,
            color: 'from-orange-500 to-red-500',
            bgColor: 'bg-orange-500/10',
        },
        {
            label: 'Applied P/E Multiple',
            value: `${midCyclePe.toFixed(1)}x`,
            icon: Activity,
            color: 'from-indigo-500 to-violet-500',
            bgColor: 'bg-indigo-500/10',
        },
        {
            label: 'Fair Value (Base)',
            value: `$${fairValueBase.toFixed(2)}`,
            icon: DollarSign,
            color: 'from-yellow-500 to-amber-500',
            bgColor: 'bg-yellow-500/10',
        },
    ];

    return (
        <div className="bg-white/10 backdrop-blur-md rounded-2xl p-8 border border-white/20">
            <h3 className="text-2xl font-bold text-white mb-6">Valuation Metrics</h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {metrics.map((metric, index) => {
                    const Icon = metric.icon;
                    return (
                        <div
                            key={index}
                            className={`${metric.bgColor} rounded-xl p-5 border border-white/10 hover:border-white/30 transition group`}
                        >
                            <div className="flex items-center gap-3 mb-3">
                                <div className={`p-2 rounded-lg bg-gradient-to-br ${metric.color}`}>
                                    <Icon className="w-5 h-5 text-white" />
                                </div>
                                <span className="text-gray-300 text-sm font-medium">{metric.label}</span>
                            </div>
                            <div className="text-3xl font-bold text-white group-hover:scale-105 transition">
                                {metric.value}
                            </div>
                        </div>
                    );
                })}
            </div>

            <div className="mt-6 p-4 bg-purple-500/10 border border-purple-500/30 rounded-xl">
                <p className="text-sm text-gray-300">
                    <span className="font-semibold text-purple-400">Methodology:</span> Fair value calculated using mid-cycle normalized earnings with regime-specific P/E multiples. Range represents ±15% confidence interval.
                </p>
            </div>
        </div>
    );
}
