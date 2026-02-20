'use client';

import { VolatilitySurface3D } from '@/components/options/VolatilitySurface3D';
import { VolatilityCone } from '@/components/risk/VolatilityCone';
import { VolatilitySmile } from '@/components/options/VolatilitySmile';
import { motion } from 'framer-motion';

export default function VolatilityAnalyticsPage() {
    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-6">
            {/* Page Header */}
            <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 }}
                className="mb-8"
            >
                <h1 className="text-5xl font-bold text-white mb-3 flex items-center gap-4">
                    <span className="text-6xl">📊</span>
                    Volatility Analytics Suite
                </h1>
                <p className="text-xl text-slate-400">
                    Advanced options volatility analysis with 3D surfaces, percentile cones, and term structure visualization
                </p>
            </motion.div>

            {/* Main Grid */}
            <div className="space-y-8">
                {/* Row 1: 3D Surface (Full Width) */}
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.6, delay: 0.1 }}
                >
                    <VolatilitySurface3D />
                </motion.div>

                {/* Row 2: Volatility Smile (Full Width) */}
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.6, delay: 0.2 }}
                >
                    <VolatilitySmile />
                </motion.div>

                {/* Row 3: Volatility Cone (Full Width) */}
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.6, delay: 0.3 }}
                >
                    <VolatilityCone />
                </motion.div>

                {/* Info Banner */}
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.6, delay: 0.4 }}
                    className="bg-gradient-to-r from-blue-900/30 to-purple-900/30 border border-blue-700/50 rounded-lg p-6"
                >
                    <h3 className="text-2xl font-bold text-white mb-3">🎯 How to Use This Dashboard</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-slate-300">
                        <div>
                            <div className="font-semibold text-blue-400 mb-2">3D Volatility Surface</div>
                            <p className="text-sm">
                                Visualize the complete IV landscape across all strikes and maturities. Rotate, zoom, and explore volatility smile patterns in 3D space.
                            </p>
                        </div>
                        <div>
                            <div className="font-semibold text-purple-400 mb-2">Volatility Smile</div>
                            <p className="text-sm">
                                Analyze how implied volatility varies across different strike prices. Identify put skew and compare term structures.
                            </p>
                        </div>
                        <div>
                            <div className="font-semibold text-green-400 mb-2">Volatility Cone</div>
                            <p className="text-sm">
                                Compare current volatility against historical percentile bands. Identify whether options are cheap or expensive.
                            </p>
                        </div>
                    </div>
                </motion.div>

                {/* Statistics Cards */}
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.6, delay: 0.5 }}
                    className="grid grid-cols-1 md:grid-cols-4 gap-4"
                >
                    <div className="bg-gradient-to-br from-blue-600/20 to-blue-800/20 border border-blue-600/50 rounded-lg p-4">
                        <div className="text-xs text-blue-300 mb-1">Visualizations</div>
                        <div className="text-3xl font-bold text-white">3</div>
                        <div className="text-xs text-slate-400 mt-1">Interactive charts</div>
                    </div>
                    <div className="bg-gradient-to-br from-purple-600/20 to-purple-800/20 border border-purple-600/50 rounded-lg p-4">
                        <div className="text-xs text-purple-300 mb-1">Data Points</div>
                        <div className="text-3xl font-bold text-white">100+</div>
                        <div className="text-xs text-slate-400 mt-1">Per volatility surface</div>
                    </div>
                    <div className="bg-gradient-to-br from-green-600/20 to-green-800/20 border border-green-600/50 rounded-lg p-4">
                        <div className="text-xs text-green-300 mb-1">Percentiles</div>
                        <div className="text-3xl font-bold text-white">5</div>
                        <div className="text-xs text-slate-400 mt-1">Historical vol bands</div>
                    </div>
                    <div className="bg-gradient-to-br from-orange-600/20 to-orange-800/20 border border-orange-600/50 rounded-lg p-4">
                        <div className="text-xs text-orange-300 mb-1">Time Horizons</div>
                        <div className="text-3xl font-bold text-white">6</div>
                        <div className="text-xs text-slate-400 mt-1">Maturity buckets</div>
                    </div>
                </motion.div>
            </div>
        </div>
    );
}
