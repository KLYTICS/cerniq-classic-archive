'use client';

import { useAuthStore, useMarketDataStore } from '@/lib/store';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import TickerSearch from '@/components/TickerSearch';
import MarketOverview from '@/components/MarketOverview';

export default function DashboardPage() {
    const { initialized, isAuthenticated, onboardingComplete, user, logout } = useAuthStore();
    const { lastUpdated } = useMarketDataStore();
    const router = useRouter();

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

    const handleTickerSelect = (ticker: string) => {
        router.push(`/dashboard/ticker/${ticker}`);
    };

    if (!initialized) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
                <div className="flex flex-col items-center gap-3">
                    <div className="w-8 h-8 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />
                    <span className="text-sm text-slate-400">Loading dashboard...</span>
                </div>
            </div>
        );
    }

    if (!isAuthenticated || !onboardingComplete) {
        return null;
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
            {/* Navigation */}
            <nav className="bg-white/5 backdrop-blur-md border-b border-white/10">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex items-center justify-between h-16">
                        <div className="flex items-center gap-4">
                            <h1 className="text-xl font-bold text-white">CERNIQ</h1>
                            {lastUpdated && (
                                <span className="text-xs text-gray-400">
                                    Data as of {new Date(lastUpdated).toLocaleTimeString()}
                                </span>
                            )}
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

            {/* Dashboard Content */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {/* Ticker Search */}
                <div className="mb-8">
                    <TickerSearch onSelect={handleTickerSelect} />
                </div>

                {/* Market Overview */}
                <div className="mb-8">
                    <h3 className="text-lg font-semibold text-white mb-4">Market Overview</h3>
                    <MarketOverview />
                </div>

                <h2 className="text-3xl font-bold text-white mb-8">Services</h2>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {/* Risk Parity Card */}
                    <div
                        onClick={() => router.push('/risk-parity')}
                        className="bg-gradient-to-br from-teal-500/20 to-cyan-500/20 backdrop-blur-md rounded-xl p-6 border-2 border-teal-500/50 hover:border-teal-400 hover:shadow-lg hover:shadow-teal-500/30 transition cursor-pointer"
                    >
                        <h3 className="text-xl font-semibold text-white mb-2">
                            Risk Parity Portfolio
                        </h3>
                        <p className="text-gray-300 mb-4">
                            Build risk-balanced portfolios across AI infrastructure layers
                        </p>
                        <div className="flex items-center gap-2 text-teal-300 font-medium">
                            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                            Live & Ready
                        </div>
                    </div>

                    {/* Risk Analytics Card */}
                    <div
                        onClick={() => router.push('/risk-analytics')}
                        className="bg-gradient-to-br from-red-500/20 to-orange-500/20 backdrop-blur-md rounded-xl p-6 border-2 border-red-500/50 hover:border-red-400 hover:shadow-lg hover:shadow-red-500/30 transition cursor-pointer"
                    >
                        <h3 className="text-xl font-semibold text-white mb-2">
                            Risk Analytics
                        </h3>
                        <p className="text-gray-300 mb-4">
                            Portfolio VaR, CVaR, and Correlation Analysis
                        </p>
                        <div className="flex items-center gap-2 text-red-300 font-medium">
                            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                            Live & Ready
                        </div>
                    </div>

                    {/* Valuation Screener Card */}
                    <div
                        onClick={() => router.push('/dashboard/valuation')}
                        className="bg-gradient-to-br from-purple-500/20 to-blue-500/20 backdrop-blur-md rounded-xl p-6 border-2 border-purple-500/50 hover:border-purple-400 hover:shadow-lg hover:shadow-purple-500/30 transition cursor-pointer"
                    >
                        <h3 className="text-xl font-semibold text-white mb-2">
                            Valuation Screener
                        </h3>
                        <p className="text-gray-300 mb-4">
                            Multi-regime valuation for semiconductor and AI stocks
                        </p>
                        <div className="flex items-center gap-2 text-purple-300 font-medium">
                            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                            Live & Ready
                        </div>
                    </div>

                    {/* SpendCheck Card */}
                    <div
                        onClick={() => router.push('/spendcheck')}
                        className="bg-gradient-to-br from-emerald-500/20 to-teal-500/20 backdrop-blur-md rounded-xl p-6 border-2 border-emerald-500/50 hover:border-emerald-400 hover:shadow-lg hover:shadow-emerald-500/30 transition cursor-pointer"
                    >
                        <h3 className="text-xl font-semibold text-white mb-2">
                            SpendCheck
                        </h3>
                        <p className="text-gray-300 mb-4">
                            Detect AP billing leaks and recover lost cash
                        </p>
                        <div className="flex items-center gap-2 text-emerald-300 font-medium">
                            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                            Live & Ready
                        </div>
                    </div>

                    {/* AI Insights Card */}
                    <div
                        onClick={() => router.push('/ai-insights')}
                        className="bg-gradient-to-br from-purple-500/20 to-pink-500/20 backdrop-blur-md rounded-xl p-6 border-2 border-purple-500/50 hover:border-purple-400 hover:shadow-lg hover:shadow-purple-500/30 transition cursor-pointer"
                    >
                        <h3 className="text-xl font-semibold text-white mb-2">
                            AI Market Insights
                        </h3>
                        <p className="text-gray-300 mb-4">
                            LLM-powered analysis of crypto, AI, and tech markets
                        </p>
                        <div className="flex items-center gap-2 text-purple-300 font-medium">
                            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                            Live & Ready
                        </div>
                    </div>

                    {/* Real-time Data Card */}
                    <div
                        onClick={() => router.push('/live-data')}
                        className="bg-gradient-to-br from-cyan-500/20 to-blue-500/20 backdrop-blur-md rounded-xl p-6 border-2 border-cyan-500/50 hover:border-cyan-400 hover:shadow-lg hover:shadow-cyan-500/30 transition cursor-pointer"
                    >
                        <h3 className="text-xl font-semibold text-white mb-2">
                            Real-Time Market Data
                        </h3>
                        <p className="text-gray-300 mb-4">
                            Live price updates via WebSocket streaming
                        </p>
                        <div className="flex items-center gap-2 text-cyan-300 font-medium">
                            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                            Live & Ready
                        </div>
                    </div>

                    {/* ALM Intelligence Card */}
                    <div
                        onClick={() => router.push('/alm')}
                        className="bg-gradient-to-br from-amber-500/20 to-orange-500/20 backdrop-blur-md rounded-xl p-6 border-2 border-amber-500/50 hover:border-amber-400 hover:shadow-lg hover:shadow-amber-500/30 transition cursor-pointer"
                    >
                        <h3 className="text-xl font-semibold text-white mb-2">
                            ALM Intelligence
                        </h3>
                        <p className="text-gray-300 mb-3">
                            Enterprise risk overview with duration gap, NII sensitivity, LCR
                        </p>
                        <div className="flex flex-wrap gap-2 mb-3">
                            <span className="text-xs bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded">Rate Sensitivity</span>
                            <span className="text-xs bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded">Liquidity</span>
                            <span className="text-xs bg-purple-500/20 text-purple-300 px-2 py-0.5 rounded">Balance Sheet</span>
                            <span className="text-xs bg-orange-500/20 text-orange-300 px-2 py-0.5 rounded">Stress Testing</span>
                        </div>
                        <div className="flex items-center gap-2 text-amber-300 font-medium">
                            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                            Live
                        </div>
                    </div>

                    {/* Portfolio Manager Card */}
                    <div
                        onClick={() => router.push('/portfolios')}
                        className="bg-gradient-to-br from-blue-500/20 to-indigo-500/20 backdrop-blur-md rounded-xl p-6 border-2 border-blue-500/50 hover:border-blue-400 hover:shadow-lg hover:shadow-blue-500/30 transition cursor-pointer"
                    >
                        <h3 className="text-xl font-semibold text-white mb-2">
                            Portfolio Manager
                        </h3>
                        <p className="text-gray-300 mb-4">
                            Create and manage multiple portfolios with positions
                        </p>
                        <div className="flex items-center gap-2 text-blue-300 font-medium">
                            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                            Live & Ready
                        </div>
                    </div>
                </div>

                {/* System Status */}
                <div className="mt-8 bg-green-500/10 border border-green-500/50 text-green-200 px-6 py-4 rounded-xl">
                    <h4 className="font-semibold mb-2">✓ System Online</h4>
                    <p className="text-sm">
                        Platform infrastructure is running. Backend API, database, and real-time services are operational.
                    </p>
                </div>
            </div>
        </div>
    );
}
