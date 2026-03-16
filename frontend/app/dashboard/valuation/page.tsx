'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AlertCircle } from 'lucide-react';
import PlatformPage from '@/components/layout/PlatformPage';
import { useAuthStore } from '@/lib/store';
import { apiClient } from '@/lib/api';
import TickerSearch from '@/components/valuation/TickerSearch';
import ValuationCard from '@/components/valuation/ValuationCard';
import CycleChart from '@/components/valuation/CycleChart';
import MetricsGrid from '@/components/valuation/MetricsGrid';

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
  const { initialized, isAuthenticated, onboardingComplete } = useAuthStore();
  const router = useRouter();

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [valuationData, setValuationData] = useState<ValuationData | null>(null);
  const [chartData, setChartData] = useState<Array<{ date: string; revenue: number }>>([]);

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
    }
  }, [initialized, isAuthenticated, onboardingComplete, router]);

  const handleSearch = async (ticker: string) => {
    setIsLoading(true);
    setError(null);
    setValuationData(null);
    setChartData([]);

    try {
      let data: ValuationData | null = null;

      try {
        data = await apiClient.getNodeValuation(ticker, 'cyclical');
      } catch {
        await apiClient.computeCyclicalValuation(ticker);
        data = await apiClient.getCyclicalValuation(ticker);
      }

      if (data) {
        setValuationData(data);
      }

      try {
        const historyData = await apiClient.getNodeHistory(ticker, undefined, undefined);
        if (Array.isArray(historyData) && historyData.length > 0) {
          const quarterly: Array<{ date: string; revenue: number }> = [];
          const step = Math.max(1, Math.floor(historyData.length / 16));
          for (let index = 0; index < historyData.length; index += step) {
            const point = historyData[index];
            quarterly.push({
              date: point.date || new Date(point.timestamp).toISOString().slice(0, 10),
              revenue: point.close || point.price || 0,
            });
          }
          setChartData(quarterly);
        }
      } catch (chartError) {
        console.error('Failed to fetch chart data:', chartError);
      }
    } catch (err: unknown) {
      console.error('Valuation error:', err);
      const message =
        typeof err === 'object' &&
        err !== null &&
        'message' in err &&
        typeof (err as { message?: unknown }).message === 'string'
          ? (err as { message: string }).message
          : 'Failed to compute valuation. Please try again.';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  if (!initialized || !isAuthenticated || !onboardingComplete) {
    return null;
  }

  return (
    <PlatformPage
      kicker="Cyclical valuation"
      title="Move from ticker search to normalized earnings, fair value, and cycle context."
      description="This CERNIQ view is built for businesses that do not screen cleanly on simple multiples. Search a name, normalize the cycle, and review the valuation range with context that is easier to defend."
      meta={
        valuationData ? (
          <>
            <span className="cerniq-mini-stat">
              <strong>{valuationData.ticker}</strong>
            </span>
            <span className="cerniq-mini-stat">
              <strong>{valuationData.cycles_detected}</strong> cycles detected
            </span>
            <span className="cerniq-mini-stat">
              <strong>{valuationData.current_cycle_position}</strong>
            </span>
          </>
        ) : undefined
      }
      actions={
        <Link href="/dashboard" className="cerniq-button-secondary px-5 py-3 text-sm">
          Back to dashboard
        </Link>
      }
    >
      <section className="cerniq-panel p-6">
        <p className="cerniq-section-label">Search</p>
        <h2 className="mt-2 font-display text-2xl text-slate-950">Run cyclical analysis</h2>
        <p className="mt-3 text-sm leading-7 text-slate-600">
          Enter a ticker to compute normalized earnings, range-based fair value, and supporting cycle metrics.
        </p>
        <div className="mt-6">
          <TickerSearch onSearch={handleSearch} isLoading={isLoading} />
        </div>
      </section>

      {error ? (
        <section className="rounded-[1.5rem] border border-rose-200 bg-rose-50/90 p-6">
          <div className="flex items-start gap-4">
            <AlertCircle className="mt-0.5 h-5 w-5 text-rose-600" />
            <div>
              <h3 className="font-semibold text-rose-900">Valuation error</h3>
              <p className="mt-2 text-sm leading-7 text-rose-800">{error}</p>
              <button onClick={() => setError(null)} className="mt-3 text-sm font-semibold text-rose-700 underline">
                Dismiss
              </button>
            </div>
          </div>
        </section>
      ) : null}

      {isLoading ? (
        <section className="cerniq-empty-state">
          <div className="mx-auto max-w-md">
            <div className="mx-auto h-12 w-12 animate-spin rounded-full border-2 border-cyan-200 border-t-cyan-600" />
            <h2 className="mt-5 font-display text-3xl text-slate-950">Computing valuation</h2>
            <p className="mt-3 text-sm leading-7 text-slate-600">
              CERNIQ is detecting cycles, normalizing earnings, and building the fair-value range.
            </p>
          </div>
        </section>
      ) : null}

      {valuationData && !isLoading ? (
        <div className="space-y-6">
          <ValuationCard
            ticker={valuationData.ticker}
            fairValueLow={valuationData.fair_value_low}
            fairValueHigh={valuationData.fair_value_high}
            currentPrice={valuationData.current_price}
            upsideDownside={valuationData.upside_downside_pct}
            cyclePosition={valuationData.current_cycle_position}
          />

          {chartData.length > 0 ? <CycleChart data={chartData} midCycleRevenue={valuationData.mid_cycle_revenue} /> : null}

          <MetricsGrid
            cyclesDetected={valuationData.cycles_detected}
            midCycleRevenue={valuationData.mid_cycle_revenue}
            midCycleEps={valuationData.mid_cycle_eps}
            midCycleMargin={valuationData.mid_cycle_margin}
            midCyclePe={valuationData.mid_cycle_pe}
            fairValueBase={valuationData.fair_value_base}
          />

          <section className="rounded-[1.5rem] border border-amber-200 bg-amber-50/90 p-6">
            <p className="cerniq-section-label text-amber-700/80">Disclaimer</p>
            <p className="mt-3 text-sm leading-7 text-slate-700">
              This valuation is informational only. Cyclical ranges rely on historical regime patterns and should be paired with independent research and investment judgment.
            </p>
          </section>
        </div>
      ) : null}

      {!valuationData && !isLoading && !error ? (
        <section className="cerniq-empty-state">
          <h2 className="font-display text-3xl text-slate-950">Ready to analyze</h2>
          <p className="mt-3 text-sm leading-7 text-slate-600">
            Search for a semiconductor or other cyclical business above to load its valuation range and cycle history.
          </p>
        </section>
      ) : null}
    </PlatformPage>
  );
}
