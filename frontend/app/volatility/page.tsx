'use client';

import { VolatilitySmile } from '@/components/options/VolatilitySmile';

export default function VolatilityPage() {
    return (
        <main className="min-h-screen bg-black py-12 px-4">
            <div className="container mx-auto">
                <div className="text-center mb-12">
                    <h1 className="text-5xl font-bold text-white mb-4">
                        Volatility Analytics
                    </h1>
                    <p className="text-xl text-slate-400">
                        Analyze implied volatility patterns across strikes and maturities
                    </p>
                </div>

                <VolatilitySmile />

                <div className="mt-12 max-w-4xl mx-auto bg-slate-900/50 border border-slate-700 rounded-xl p-6">
                    <h3 className="text-2xl font-bold text-white mb-4">Understanding Volatility Smile</h3>
                    <div className="space-y-4 text-slate-300">
                        <div>
                            <h4 className="text-lg font-semibold text-white mb-2">What is it?</h4>
                            <p>
                                The volatility smile shows how implied volatility (IV) varies across different strike prices for options with the same expiration date.
                                In theory, all strikes should have the same IV, but in practice, OTM options often have higher IV creating a "smile" or "skew" shape.
                            </p>
                        </div>
                        <div>
                            <h4 className="text-lg font-semibold text-white mb-2">Why does it exist?</h4>
                            <ul className="list-disc list-inside space-y-1 ml-4">
                                <li>Market demand for downside protection (higher put IV)</li>
                                <li>Fat tails in return distributions (crash risk)</li>
                                <li>Supply/demand imbalances</li>
                                <li>Leverage effects and correlation asymmetries</li>
                            </ul>
                        </div>
                        <div>
                            <h4 className="text-lg font-semibold text-white mb-2">How to use it?</h4>
                            <ul className="list-disc list-inside space-y-1 ml-4">
                                <li>Identify cheap vs expensive strikes for strategy construction</li>
                                <li>Detect market sentiment (skewed toward puts or calls)</li>
                                <li>Arbitrage opportunities when smile deviates from norms</li>
                                <li>Risk management: higher IV = higher option prices and potential payouts</li>
                            </ul>
                        </div>
                    </div>
                </div>
            </div>
        </main>
    );
}
