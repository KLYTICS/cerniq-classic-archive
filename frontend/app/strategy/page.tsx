'use client';

import { StrategyBuilder } from '@/components/options/StrategyBuilder';

export default function StrategyPage() {
    return (
        <main className="min-h-screen bg-black py-12 px-4">
            <div className="container mx-auto">
                <div className="text-center mb-8">
                    <h1 className="text-5xl font-bold text-white mb-4">
                        Options Strategy Analyzer
                    </h1>
                    <p className="text-xl text-slate-400">
                        Build and analyze multi-leg options strategies with real-time payoff diagrams
                    </p>
                </div>

                <StrategyBuilder />

                <div className="mt-12 max-w-5xl mx-auto bg-slate-900/50 border border-slate-700 rounded-xl p-6">
                    <h3 className="text-2xl font-bold text-white mb-4">How to Use</h3>
                    <div className="space-y-3 text-slate-300">
                        <div className="flex items-start gap-3">
                            <div className="text-2xl">1️⃣</div>
                            <div>
                                <strong className="text-white">Load a Preset</strong> - Choose from Bull Call Spread, Bear Put Spread, Long Straddle, or Iron Condor
                            </div>
                        </div>
                        <div className="flex items-start gap-3">
                            <div className="text-2xl">2️⃣</div>
                            <div>
                                <strong className="text-white">Customize Legs</strong> - Adjust strikes, quantities, buy/sell, or add custom legs
                            </div>
                        </div>
                        <div className="flex items-start gap-3">
                            <div className="text-2xl">3️⃣</div>
                            <div>
                                <strong className="text-white">Set Parameters</strong> - Configure underlying price and implied volatility
                            </div>
                        </div>
                        <div className="flex items-start gap-3">
                            <div className="text-2xl">4️⃣</div>
                            <div>
                                <strong className="text-white">Calculate</strong> - View payoff diagram, break-evens, max profit/loss, and portfolio Greeks
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </main>
    );
}
