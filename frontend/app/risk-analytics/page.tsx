'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { ComponentVaRChart } from '@/components/risk/ComponentVaRChart';
import { VolatilityForecastChart } from '@/components/risk/VolatilityForecastChart';
import { CorrelationHeatmap } from '@/components/risk/CorrelationHeatmap';
import { Search, RefreshCw, TrendingDown, Shield, AlertTriangle, Briefcase } from 'lucide-react';
import { apiClient } from '@/lib/api';
import { useAuthStore } from '@/lib/store';

interface Portfolio {
    id: string;
    name: string;
    positions: any[];
}

export default function RiskAnalyticsPage() {
    const router = useRouter();
    const { initialized, isAuthenticated, onboardingComplete, user } = useAuthStore();
    const [portfolios, setPortfolios] = useState<Portfolio[]>([]);
    const [selectedPortfolio, setSelectedPortfolio] = useState<Portfolio | null>(null);
    const [loading, setLoading] = useState(true);
    const [forecastTicker, setForecastTicker] = useState('');
    const [horizon, setHorizon] = useState(30);

    useEffect(() => {
        if (!initialized) {
            return;
        }

        if (!isAuthenticated) {
            router.push('/login');
            return;
        }

        if (!onboardingComplete) {
            router.push('/onboarding');
            return;
        }

        if (user?.id) {
            fetchPortfolios(user.id);
        }
    }, [initialized, isAuthenticated, onboardingComplete, user, router]);

    const fetchPortfolios = async (uid: string) => {
        setLoading(true);
        try {
            let data;
            try {
                data = await apiClient.getNodePortfolios();
            } catch {
                // Fallback to Rust backend
                data = await apiClient.getPortfolios();
            }
            setPortfolios(data);
            if (data.length > 0) {
                setSelectedPortfolio(data[0]);
                if (data[0].positions.length > 0) {
                    setForecastTicker(data[0].positions[0].ticker);
                }
            }
        } catch (error) {
            console.error('Failed to fetch portfolios:', error);
        } finally {
            setLoading(false);
        }
    };

    const handlePortfolioChange = (portfolioId: string) => {
        const portfolio = portfolios.find(p => p.id === portfolioId);
        if (portfolio) {
            setSelectedPortfolio(portfolio);
            if (portfolio.positions.length > 0) {
                setForecastTicker(portfolio.positions[0].ticker);
            }
        }
    };

    // Prepare positions for charts
    const positions = selectedPortfolio?.positions.map(p => ({
        ticker: p.ticker,
        quantity: Number(p.quantity),
        price: Number(p.currentPrice || p.avgCost) // Use current price if available, else cost
    })) || [];

    const tickers = positions.map((p) => p.ticker);

    if (!initialized || !isAuthenticated || !onboardingComplete) {
        return null;
    }

    if (loading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-8">
            {/* Header */}
            <motion.div
                className="mb-8"
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
            >
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-4xl font-bold text-white mb-2">Risk Analytics Dashboard</h1>
                        <p className="text-slate-400">
                            Advanced risk metrics powered by Component VaR, GARCH forecasting, and correlation analysis
                        </p>
                    </div>
                    <div className="flex gap-3">
                        <div className="relative">
                            <select
                                className="appearance-none bg-slate-800 border border-slate-600 text-white py-2 pl-4 pr-10 rounded-lg focus:outline-none focus:border-blue-500"
                                value={selectedPortfolio?.id || ''}
                                onChange={(e) => handlePortfolioChange(e.target.value)}
                            >
                                {portfolios.length === 0 ? (
                                    <option>No Portfolios</option>
                                ) : (
                                    portfolios.map(p => (
                                        <option key={p.id} value={p.id}>{p.name}</option>
                                    ))
                                )}
                            </select>
                            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-white">
                                <Briefcase className="w-4 h-4" />
                            </div>
                        </div>

                        <button
                            onClick={() => {
                                if (user?.id) {
                                    fetchPortfolios(user.id);
                                }
                            }}
                            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-600 rounded-lg flex items-center gap-2 text-white transition-colors"
                        >
                            <RefreshCw className="w-4 h-4" />
                            Refresh
                        </button>
                    </div>
                </div>
            </motion.div>

            {/* Empty State */}
            {(!selectedPortfolio || positions.length === 0) ? (
                <div className="flex flex-col items-center justify-center h-96 text-slate-400">
                    <Briefcase className="w-16 h-16 mb-4 opacity-50" />
                    <h3 className="text-xl font-semibold mb-2">No Positions Found</h3>
                    <p>Please add positions to your portfolio to view risk analytics.</p>
                </div>
            ) : (
                <>
                    {/* Key Metrics Cards */}
                    <div className="grid grid-cols-4 gap-4 mb-8">
                        <motion.div
                            className="p-6 bg-gradient-to-br from-red-900/20 to-red-800/10 border border-red-700/30 rounded-xl"
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: 0.1 }}
                        >
                            <div className="flex items-center justify-between mb-3">
                                <AlertTriangle className="w-8 h-8 text-red-400" />
                                <span className="text-xs text-red-400 font-semibold uppercase">Portfolio VaR</span>
                            </div>
                            <div className="text-3xl font-bold text-white mb-1">
                                {/* Placeholder for calculated VaR */}
                                ---
                            </div>
                            <div className="text-sm text-slate-400">95% confidence, 1-day</div>
                        </motion.div>

                        <motion.div
                            className="p-6 bg-gradient-to-br from-blue-900/20 to-blue-800/10 border border-blue-700/30 rounded-xl"
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: 0.2 }}
                        >
                            <div className="flex items-center justify-between mb-3">
                                <Shield className="w-8 h-8 text-blue-400" />
                                <span className="text-xs text-blue-400 font-semibold uppercase">CVaR</span>
                            </div>
                            <div className="text-3xl font-bold text-white mb-1">
                                {/* Placeholder for calculated CVaR */}
                                ---
                            </div>
                            <div className="text-sm text-slate-400">Expected shortfall</div>
                        </motion.div>

                        <motion.div
                            className="p-6 bg-gradient-to-br from-purple-900/20 to-purple-800/10 border border-purple-700/30 rounded-xl"
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: 0.3 }}
                        >
                            <div className="flex items-center justify-between mb-3">
                                <TrendingDown className="w-8 h-8 text-purple-400" />
                                <span className="text-xs text-purple-400 font-semibold uppercase">Diversity Score</span>
                            </div>
                            <div className="text-3xl font-bold text-white mb-1">{tickers.length > 5 ? 'High' : (tickers.length > 2 ? 'Med' : 'Low')}</div>
                            <div className="text-sm text-slate-400">Based on holdings</div>
                        </motion.div>

                        <motion.div
                            className="p-6 bg-gradient-to-br from-green-900/20 to-green-800/10 border border-green-700/30 rounded-xl"
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: 0.4 }}
                        >
                            <div className="flex items-center justify-between mb-3">
                                <Search className="w-8 h-8 text-green-400" />
                                <span className="text-xs text-green-400 font-semibold uppercase">Pos Count</span>
                            </div>
                            <div className="text-3xl font-bold text-white mb-1">{tickers.length}</div>
                            <div className="text-sm text-slate-400">Active positions</div>
                        </motion.div>
                    </div>

                    {/* Main Content Grid */}
                    <div className="space-y-8">
                        {/* Row 1: Component VaR */}
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.5 }}
                        >
                            <ComponentVaRChart positions={positions} confidenceLevel={0.95} horizon={1} />
                        </motion.div>

                        {/* Row 2: Volatility Forecast + Correlation Heatmap */}
                        <div className="grid grid-cols-2 gap-8">
                            <motion.div
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: 0.6 }}
                            >
                                <div className="mb-4 flex items-center gap-4">
                                    <input
                                        type="text"
                                        value={forecastTicker}
                                        onChange={(e) => setForecastTicker(e.target.value.toUpperCase())}
                                        className="px-4 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-purple-500"
                                        placeholder="Ticker"
                                    />
                                    <select
                                        value={horizon}
                                        onChange={(e) => setHorizon(parseInt(e.target.value))}
                                        className="px-4 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-purple-500"
                                    >
                                        <option value={7}>7 days</option>
                                        <option value={14}>14 days</option>
                                        <option value={30}>30 days</option>
                                        <option value={60}>60 days</option>
                                    </select>
                                </div>
                                <VolatilityForecastChart ticker={forecastTicker} horizon={horizon} />
                            </motion.div>

                            <motion.div
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: 0.7 }}
                            >
                                <CorrelationHeatmap tickers={tickers} />
                            </motion.div>
                        </div>

                        {/* Usage Guide */}
                        <motion.div
                            className="p-6 bg-gradient-to-r from-slate-800/50 to-slate-700/30 border border-slate-600 rounded-xl"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 0.8 }}
                        >
                            <h3 className="text-lg font-bold text-white mb-4">🎯 How to Use This Dashboard</h3>
                            <div className="grid grid-cols-3 gap-6 text-sm">
                                <div>
                                    <h4 className="font-semibold text-purple-400 mb-2">Component VaR</h4>
                                    <p className="text-slate-300">
                                        Shows risk contribution of each position. High contributors are candidates for hedging or
                                        reduction.
                                    </p>
                                </div>
                                <div>
                                    <h4 className="font-semibold text-purple-400 mb-2">Volatility Forecast</h4>
                                    <p className="text-slate-300">
                                        GARCH(1,1) model predicts future volatility with 95% confidence bands. Rising vol suggests
                                        increasing risk.
                                    </p>
                                </div>
                                <div>
                                    <h4 className="font-semibold text-purple-400 mb-2">Correlation Matrix</h4>
                                    <p className="text-slate-300">
                                        Red cells indicate high positive correlation (increase portfolio risk). Blue cells show
                                        diversification.
                                    </p>
                                </div>
                            </div>
                        </motion.div>
                    </div>
                </>
            )}
        </div>
    );
}
