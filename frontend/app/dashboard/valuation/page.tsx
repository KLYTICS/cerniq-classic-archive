'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/store';
import { apiClient } from '@/lib/api';
import TickerSearch from '@/components/valuation/TickerSearch';
import ValuationCard from '@/components/valuation/ValuationCard';
import CycleChart from '@/components/valuation/CycleChart';
import MetricsGrid from '@/components/valuation/MetricsGrid';
import { AlertCircle, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

interface ValuationData {
    ticker: string;
    cycles_detected: number;
    mid_cycle_revenue: number;
    mid_cycle_eps: number;
    mid_cycle_margin: number;
    mid_cycle_pe: number;
    fair_value_base: number;
    fair_value_low: number;
    fair_value_high: number;
    current_price: number;
    upside_downside_pct: number;
    current_cycle_position: string;
}

export default function ValuationPage() {
    const { initialized, isAuthenticated, onboardingComplete, user, logout } = useAuthStore();
    const router = useRouter();

    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [valuationData, setValuationData] = useState<ValuationData | null>(null);
    const [chartData, setChartData] = useState<any[]>([]);

    useEffect(() => {
        if (!initialized) return;

        if (!isAuthenticated) {
            router.push('/login');
            return;
        }

        if (!onboardingComplete) {
            router.push('/onboarding');
        }
    }, [initialized, isAuthenticated, onboardingComplete, router]);

    const handleSearch = async (ticker: string) => {
        setIsLoading(true);
        setError(null);
        setValuationData(null);
        setChartData([]);

        try {
            // Try NestJS valuation endpoint first, fall back to Rust backend
            let data: ValuationData | null = null;

            try {
                data = await apiClient.getNodeValuation(ticker, 'cyclical');
            } catch {
                // Fallback to Rust backend
                await apiClient.computeCyclicalValuation(ticker);
                data = await apiClient.getCyclicalValuation(ticker);
            }

            if (data) {
                setValuationData(data);
            }

            // Fetch real historical price data for chart from NestJS
            try {
                const historyData = await apiClient.getNodeHistory(ticker, undefined, undefined);
                if (historyData && Array.isArray(historyData) && historyData.length > 0) {
                    // Sample quarterly data points from history
                    const quarterly: any[] = [];
                    const step = Math.max(1, Math.floor(historyData.length / 16));
                    for (let i = 0; i < historyData.length; i += step) {
                        const point = historyData[i];
                        quarterly.push({
                            date: point.date || new Date(point.timestamp).toISOString().slice(0, 10),
                            revenue: point.close || point.price || 0,
                        });
                    }
                    setChartData(quarterly);
                }
            } catch (chartErr) {
                console.error('Failed to fetch chart data:', chartErr);
                // Chart data is supplementary — don't fail the whole page
            }

        } catch (err: any) {
            console.error('Valuation error:', err);
            setError(err.response?.data?.message || err.message || 'Failed to compute valuation. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    if (!initialized || !isAuthenticated || !onboardingComplete) {
        return null;
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
            {/* Navigation */}
            <nav className="bg-white/5 backdrop-blur-md border-b border-white/10">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex items-center justify-between h-16">
                        <div className="flex items-center gap-4">
                            <Link
                                href="/dashboard"
                                className="text-gray-300 hover:text-white transition flex items-center gap-2"
                            >
                                <ArrowLeft className="w-5 h-5" />
                                Dashboard
                            </Link>
                            <div className="h-6 w-px bg-white/20"></div>
                            <h1 className="text-xl font-bold text-white">Cyclical Valuation</h1>
                        </div>
                        <div className="flex items-center space-x-4">
                            <span className="text-gray-300">{user?.email}</span>
                            <button
                                onClick={async () => {
                                    await logout();
                                    router.push('/login');
                                }}
                                className="bg-red-500/20 hover:bg-red-500/30 text-red-200 px-4 py-2 rounded-lg transition"
                            >
                                Logout
                            </button>
                        </div>
                    </div>
                </div>
            </nav>

            {/* Main Content */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {/* Header */}
                <div className="mb-8">
                    <h2 className="text-4xl font-bold text-white mb-3">
                        Semiconductor Cycle Valuation
                    </h2>
                    <p className="text-gray-300 text-lg">
                        Analyze cyclical businesses using normalized mid-cycle earnings and regime-specific valuations
                    </p>
                </div>

                {/* Ticker Search */}
                <div className="mb-8">
                    <TickerSearch onSearch={handleSearch} isLoading={isLoading} />
                </div>

                {/* Error State */}
                {error && (
                    <div className="mb-8 bg-red-500/10 border border-red-500/50 rounded-xl p-6 flex items-start gap-4">
                        <AlertCircle className="w-6 h-6 text-red-400 flex-shrink-0 mt-0.5" />
                        <div>
                            <h4 className="text-red-200 font-semibold mb-1">Error</h4>
                            <p className="text-red-300">{error}</p>
                            <button
                                onClick={() => setError(null)}
                                className="mt-2 text-red-400 hover:text-red-300 text-sm underline"
                            >
                                Dismiss
                            </button>
                        </div>
                    </div>
                )}

                {/* Loading State */}
                {isLoading && (
                    <div className="flex items-center justify-center py-20">
                        <div className="text-center">
                            <div className="inline-block animate-spin rounded-full h-16 w-16 border-4 border-purple-500 border-t-transparent mb-4"></div>
                            <p className="text-gray-300 text-lg">Computing valuation...</p>
                            <p className="text-gray-400 text-sm mt-2">Detecting cycles and normalizing earnings</p>
                        </div>
                    </div>
                )}

                {/* Results */}
                {valuationData && !isLoading && (
                    <div className="space-y-8 animate-fade-in">
                        {/* Valuation Card */}
                        <ValuationCard
                            ticker={valuationData.ticker}
                            fairValueLow={valuationData.fair_value_low}
                            fairValueHigh={valuationData.fair_value_high}
                            currentPrice={valuationData.current_price}
                            upsideDownside={valuationData.upside_downside_pct}
                            cyclePosition={valuationData.current_cycle_position}
                        />

                        {/* Cycle Chart */}
                        {chartData.length > 0 && (
                            <CycleChart data={chartData} midCycleRevenue={valuationData.mid_cycle_revenue} />
                        )}

                        {/* Metrics Grid */}
                        <MetricsGrid
                            cyclesDetected={valuationData.cycles_detected}
                            midCycleRevenue={valuationData.mid_cycle_revenue}
                            midCycleEps={valuationData.mid_cycle_eps}
                            midCycleMargin={valuationData.mid_cycle_margin}
                            midCyclePe={valuationData.mid_cycle_pe}
                            fairValueBase={valuationData.fair_value_base}
                        />

                        {/* Disclaimer */}
                        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-6">
                            <h4 className="text-yellow-400 font-semibold mb-2">Investment Disclaimer</h4>
                            <p className="text-gray-300 text-sm">
                                This valuation is provided for informational purposes only and should not be considered as investment advice.
                                Cyclical valuations are based on historical patterns and may not predict future performance. Always conduct your
                                own research and consult with a qualified financial advisor before making investment decisions.
                            </p>
                        </div>
                    </div>
                )}

                {/* Empty State */}
                {!valuationData && !isLoading && !error && (
                    <div className="text-center py-20">
                        <div className="inline-block p-6 bg-white/5 rounded-full mb-6">
                            <svg className="w-16 h-16 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                            </svg>
                        </div>
                        <h3 className="text-2xl font-bold text-white mb-3">Ready to Analyze</h3>
                        <p className="text-gray-400 max-w-md mx-auto">
                            Enter a semiconductor ticker above to compute its cyclical valuation based on historical revenue patterns
                        </p>
                    </div>
                )}
            </div>

            <style jsx>{`
        @keyframes fade-in {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-fade-in {
          animation: fade-in 0.5s ease-out;
        }
      `}</style>
        </div>
    );
}
