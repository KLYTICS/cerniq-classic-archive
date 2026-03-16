'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Briefcase, RefreshCw, Shield, TrendingDown, AlertTriangle, Search } from 'lucide-react';
import { ComponentVaRChart } from '@/components/risk/ComponentVaRChart';
import { VolatilityForecastChart } from '@/components/risk/VolatilityForecastChart';
import { CorrelationHeatmap } from '@/components/risk/CorrelationHeatmap';
import PlatformPage from '@/components/layout/PlatformPage';
import { apiClient } from '@/lib/api';
import { useAuthStore } from '@/lib/store';

interface Portfolio {
  id: string;
  name: string;
  positions: Array<{
    ticker: string;
    quantity: number;
    currentPrice?: number;
    avgCost?: number;
  }>;
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
      void fetchPortfolios();
    }
  }, [initialized, isAuthenticated, onboardingComplete, router, user]);

  const fetchPortfolios = async () => {
    setLoading(true);
    try {
      let data;
      try {
        data = await apiClient.getNodePortfolios();
      } catch {
        data = await apiClient.getPortfolios();
      }

      const nextPortfolios: Portfolio[] = Array.isArray(data) ? data : [];
      setPortfolios(nextPortfolios);

      if (nextPortfolios.length > 0) {
        const nextSelected = nextPortfolios[0];
        setSelectedPortfolio(nextSelected);
        if (nextSelected.positions.length > 0) {
          setForecastTicker(nextSelected.positions[0].ticker);
        }
      } else {
        setSelectedPortfolio(null);
        setForecastTicker('');
      }
    } catch (error) {
      console.error('Failed to fetch portfolios:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePortfolioChange = (portfolioId: string) => {
    const portfolio = portfolios.find((item) => item.id === portfolioId);
    if (!portfolio) {
      return;
    }

    setSelectedPortfolio(portfolio);
    if (portfolio.positions.length > 0) {
      setForecastTicker(portfolio.positions[0].ticker);
    }
  };

  const positions = selectedPortfolio?.positions.map((position) => ({
    ticker: position.ticker,
    quantity: Number(position.quantity),
    price: Number(position.currentPrice || position.avgCost || 0),
  })) || [];

  const tickers = positions.map((position) => position.ticker);
  const positionCount = tickers.length;

  if (!initialized || !isAuthenticated || !onboardingComplete) {
    return null;
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f7fbff]">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-cyan-200 border-t-cyan-600" />
          <span className="text-sm uppercase tracking-[0.24em] text-slate-500">Loading risk analytics</span>
        </div>
      </div>
    );
  }

  return (
    <PlatformPage
      kicker="Risk analytics"
      title="Inspect portfolio concentration, volatility, and diversification from one readable surface."
      description="CERNIQ turns live positions into Component VaR, volatility forecasting, and cross-asset correlation so you can see where risk is building before it shows up in P&L."
      meta={
        <>
          <span className="cerniq-mini-stat">
            <strong>{selectedPortfolio?.name || 'No portfolio selected'}</strong>
          </span>
          <span className="cerniq-mini-stat">
            <strong>{positionCount}</strong> active positions
          </span>
          <span className="cerniq-mini-stat">
            <strong>{horizon} days</strong> forecast horizon
          </span>
        </>
      }
      actions={
        <>
          <div className="relative">
            <select
              className="cerniq-field cerniq-select min-w-[220px] cursor-pointer py-3 pl-4 pr-10 text-sm"
              value={selectedPortfolio?.id || ''}
              onChange={(event) => handlePortfolioChange(event.target.value)}
            >
              {portfolios.length === 0 ? (
                <option value="">No portfolios available</option>
              ) : (
                portfolios.map((portfolio) => (
                  <option key={portfolio.id} value={portfolio.id}>
                    {portfolio.name}
                  </option>
                ))
              )}
            </select>
            <Briefcase className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          </div>
          <button
            onClick={() => {
              if (user?.id) {
                void fetchPortfolios();
              }
            }}
            className="cerniq-button-secondary px-5 py-3 text-sm"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>
        </>
      }
    >
      {!selectedPortfolio || positions.length === 0 ? (
        <section className="cerniq-empty-state">
          <div className="mx-auto max-w-lg">
            <Briefcase className="mx-auto h-12 w-12 text-cyan-700/70" />
            <h2 className="mt-5 font-display text-3xl text-slate-950">No positions available yet</h2>
            <p className="mt-3 text-sm leading-7 text-slate-600">
              Add holdings to a CERNIQ portfolio to unlock Component VaR, forecasted volatility, and correlation analysis.
            </p>
          </div>
        </section>
      ) : (
        <div className="space-y-6">
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div className="cerniq-stat-card cerniq-stat-card-accent">
              <div className="mb-4 flex items-center justify-between">
                <AlertTriangle className="h-6 w-6 text-rose-500" />
                <span className="cerniq-chip cerniq-chip-negative">Portfolio VaR</span>
              </div>
              <p className="text-3xl font-bold text-slate-950">Pending</p>
              <p className="mt-2 text-sm leading-6 text-slate-600">Calculated live inside the Component VaR model below.</p>
            </div>

            <div className="cerniq-stat-card cerniq-stat-card-accent">
              <div className="mb-4 flex items-center justify-between">
                <Shield className="h-6 w-6 text-cyan-600" />
                <span className="cerniq-chip">Expected shortfall</span>
              </div>
              <p className="text-3xl font-bold text-slate-950">Pending</p>
              <p className="mt-2 text-sm leading-6 text-slate-600">Use this view to compare tail risk against one-day VaR.</p>
            </div>

            <div className="cerniq-stat-card cerniq-stat-card-accent">
              <div className="mb-4 flex items-center justify-between">
                <TrendingDown className="h-6 w-6 text-amber-500" />
                <span className="cerniq-chip cerniq-chip-warning">Diversification</span>
              </div>
              <p className="text-3xl font-bold text-slate-950">
                {tickers.length > 5 ? 'High' : tickers.length > 2 ? 'Medium' : 'Low'}
              </p>
              <p className="mt-2 text-sm leading-6 text-slate-600">Estimated from current position count and correlation mix.</p>
            </div>

            <div className="cerniq-stat-card cerniq-stat-card-accent">
              <div className="mb-4 flex items-center justify-between">
                <Search className="h-6 w-6 text-emerald-600" />
                <span className="cerniq-chip cerniq-chip-positive">Coverage</span>
              </div>
              <p className="text-3xl font-bold text-slate-950">{tickers.length}</p>
              <p className="mt-2 text-sm leading-6 text-slate-600">Securities included in the current portfolio risk snapshot.</p>
            </div>
          </section>

          <section className="grid gap-6 xl:grid-cols-[1.08fr_0.92fr]">
            <ComponentVaRChart positions={positions} confidenceLevel={0.95} horizon={1} />

            <div className="cerniq-surface-grid">
              <div className="cerniq-panel p-6">
                <div className="mb-4 flex flex-wrap items-end justify-between gap-4">
                  <div>
                    <p className="cerniq-section-label">Forecast</p>
                    <h2 className="mt-2 font-display text-2xl text-slate-950">Volatility outlook</h2>
                  </div>

                  <div className="flex gap-3">
                    <input
                      type="text"
                      value={forecastTicker}
                      onChange={(event) => setForecastTicker(event.target.value.toUpperCase())}
                      className="cerniq-field w-28 py-3 text-sm uppercase"
                      placeholder="Ticker"
                    />
                    <select
                      value={horizon}
                      onChange={(event) => setHorizon(parseInt(event.target.value, 10))}
                      className="cerniq-field cerniq-select min-w-[120px] py-3 text-sm"
                    >
                      <option value={7}>7 days</option>
                      <option value={14}>14 days</option>
                      <option value={30}>30 days</option>
                      <option value={60}>60 days</option>
                    </select>
                  </div>
                </div>

                <VolatilityForecastChart ticker={forecastTicker} horizon={horizon} />
              </div>

              <div className="cerniq-panel p-6">
                <p className="cerniq-section-label">Operator notes</p>
                <div className="mt-4 space-y-4">
                  <div className="cerniq-stat-line text-sm leading-7">
                    Component VaR shows which positions are doing the most work inside total portfolio risk.
                  </div>
                  <div className="cerniq-stat-line text-sm leading-7">
                    The forecast panel helps you separate temporary calm from building volatility pressure.
                  </div>
                  <div className="cerniq-stat-line text-sm leading-7">
                    Use the heatmap to find clusters that may break diversification when markets move together.
                  </div>
                </div>
              </div>
            </div>
          </section>

          <CorrelationHeatmap tickers={tickers} />
        </div>
      )}
    </PlatformPage>
  );
}
