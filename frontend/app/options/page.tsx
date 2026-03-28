import type { Metadata } from 'next';
import { GreeksCalculator } from '@/components/options/GreeksCalculator';

export const metadata: Metadata = {
  title: 'Options Analytics — CERNIQ',
  description: 'Institutional-grade Black-Scholes pricing and Greeks calculation for options analytics.',
};

export default function OptionsPage() {
    return (
        <main className="min-h-screen bg-black py-12 px-4">
            <div className="container mx-auto">
                <div className="text-center mb-12">
                    <h1 className="text-5xl font-bold text-white mb-4">
                        Options Analytics
                    </h1>
                    <p className="text-xl text-slate-400">
                        Institutional-grade Black-Scholes pricing and Greeks calculation
                    </p>
                </div>

                <GreeksCalculator />

                <div className="mt-12 max-w-4xl mx-auto">
                    <div className="bg-slate-900/50 border border-slate-700 rounded-xl p-6">
                        <h3 className="text-2xl font-bold text-white mb-4">API Endpoints Available</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                            <div className="bg-slate-800/50 p-4 rounded-lg">
                                <div className="text-green-400 font-mono mb-2">POST /api/options/calculate</div>
                                <div className="text-slate-400">Calculate Black-Scholes Greeks for single option</div>
                            </div>
                            <div className="bg-slate-800/50 p-4 rounded-lg">
                                <div className="text-green-400 font-mono mb-2">POST /api/options/strategy</div>
                                <div className="text-slate-400">Analyze multi-leg options strategies</div>
                            </div>
                            <div className="bg-slate-800/50 p-4 rounded-lg">
                                <div className="text-green-400 font-mono mb-2">POST /api/options/implied-volatility</div>
                                <div className="text-slate-400">Solve for implied volatility (Newton-Raphson)</div>
                            </div>
                            <div className="bg-slate-800/50 p-4 rounded-lg">
                                <div className="text-green-400 font-mono mb-2">GET /api/options/strategy-presets</div>
                                <div className="text-slate-400">Get common strategy templates</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </main>
    );
}
