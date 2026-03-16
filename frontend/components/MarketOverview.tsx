'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiClient } from '@/lib/api';
import { useMarketDataSocket } from '@/lib/marketDataSocket';
import { useMarketDataStore } from '@/lib/store';

interface MarketOverviewData {
  ticker: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  timestamp?: string;
}

const TRACKED_TICKERS = ['SPY', 'QQQ', 'NVDA', 'AAPL', 'MSFT', 'AMZN'];
const TICKER_LABELS: Record<string, string> = {
  SPY: 'S&P 500 ETF',
  QQQ: 'Nasdaq 100 ETF',
  NVDA: 'NVIDIA',
  AAPL: 'Apple',
  MSFT: 'Microsoft',
  AMZN: 'Amazon',
};

export default function MarketOverview() {
  const [tickers, setTickers] = useState<MarketOverviewData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { setQuotes, getQuote, isStale, lastUpdated } = useMarketDataStore();
  const { isConnected, subscribeTicker } = useMarketDataSocket();

  const fetchData = useCallback(async () => {
    const allCached = TRACKED_TICKERS.every((ticker) => !isStale(ticker));
    if (allCached) {
      const cached = TRACKED_TICKERS.map((ticker) => {
        const quote = getQuote(ticker)!;
        return {
          ticker: quote.ticker,
          name: quote.name || quote.ticker,
          price: quote.price,
          change: quote.change,
          changePercent: quote.changePercent,
        };
      });
      setTickers(cached);
      setLoading(false);
      return;
    }

    try {
      setError(null);
      const data = await Promise.all(
        TRACKED_TICKERS.map(async (ticker) => {
          try {
            const quote = await apiClient.getNodeQuote(ticker);
            return {
              ticker: quote.ticker || ticker,
              name: quote.name || quote.shortName || TICKER_LABELS[ticker] || ticker,
              price: quote.price ?? 0,
              change: quote.change ?? 0,
              changePercent: quote.changePercent ?? 0,
              timestamp: quote.timestamp,
            };
          } catch (err) {
            console.error(`Failed to fetch ${ticker}:`, err);
            const cached = getQuote(ticker);
            if (cached) {
              return {
                ticker: cached.ticker,
                name: cached.name || ticker,
                price: cached.price,
                change: cached.change,
                changePercent: cached.changePercent,
              };
            }
            return { ticker, name: ticker, price: 0, change: 0, changePercent: 0 };
          }
        })
      );

      setTickers(data);
      setQuotes(
        data.map((quote) => ({
          ticker: quote.ticker,
          price: quote.price,
          change: quote.change,
          changePercent: quote.changePercent,
          name: quote.name,
        }))
      );
    } catch (err) {
      console.error('MarketOverview fetch error:', err);
      setError('Failed to load market data');
    } finally {
      setLoading(false);
    }
  }, [getQuote, isStale, setQuotes]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 60000);
    return () => clearInterval(interval);
  }, [fetchData]);

  useEffect(() => {
    if (!isConnected) {
      return;
    }

    const cleanups = TRACKED_TICKERS.map((ticker) =>
      subscribeTicker(ticker, (payload) => {
        setTickers((current) => {
          const nextMap = new Map(current.map((item) => [item.ticker, item]));
          nextMap.set(payload.ticker, {
            ticker: payload.ticker,
            name: payload.longName || payload.shortName || TICKER_LABELS[payload.ticker] || payload.ticker,
            price: payload.price,
            change: payload.change,
            changePercent: payload.changePercent,
            timestamp: payload.timestamp?.toString(),
          });
          return TRACKED_TICKERS.map((trackedTicker) => nextMap.get(trackedTicker) || {
            ticker: trackedTicker,
            name: TICKER_LABELS[trackedTicker] || trackedTicker,
            price: 0,
            change: 0,
            changePercent: 0,
          });
        });

        setQuotes([{
          ticker: payload.ticker,
          price: payload.price,
          change: payload.change,
          changePercent: payload.changePercent,
          name: payload.longName || payload.shortName || TICKER_LABELS[payload.ticker] || payload.ticker,
        }]);
      })
    ).filter(Boolean) as Array<() => void>;

    return () => {
      cleanups.forEach((cleanup) => cleanup());
    };
  }, [isConnected, setQuotes, subscribeTicker]);

  if (loading) {
    return (
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-2 2xl:grid-cols-3">
        {TRACKED_TICKERS.map((ticker) => (
          <div key={ticker} className="animate-pulse rounded-[1.1rem] border border-slate-200 bg-white px-3.5 py-3">
            <div className="mb-2 h-4 w-12 rounded bg-slate-100" />
            <div className="mb-1 h-6 w-20 rounded bg-slate-100" />
            <div className="h-3 w-16 rounded bg-slate-100" />
          </div>
        ))}
      </div>
    );
  }

  if (error && tickers.length === 0) {
    return (
      <div className="rounded-[1.2rem] border border-red-500/30 bg-red-500/10 p-4 text-center">
        <p className="text-sm text-red-300">{error}</p>
        <button
          onClick={() => {
            setLoading(true);
            fetchData();
          }}
          className="mt-2 text-sm text-red-400 underline transition hover:text-red-300"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-2 2xl:grid-cols-3">
        {tickers.map((ticker) => (
          <div
            key={ticker.ticker}
            className="rounded-[1.1rem] border border-slate-200 bg-white px-3.5 py-3 transition hover:border-cyan-300/40"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-[11px] uppercase tracking-[0.22em] text-slate-500">{ticker.ticker}</div>
                <div className="mt-1 truncate text-xs text-slate-400">{ticker.name}</div>
              </div>
              <div
                className={`rounded-full px-2 py-1 text-[11px] font-semibold ${
                  ticker.changePercent >= 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                }`}
              >
                {ticker.changePercent >= 0 ? '+' : '-'}
                {Math.abs(ticker.changePercent).toFixed(2)}%
              </div>
            </div>
            <div className="mt-4 text-lg font-bold text-slate-950">${ticker.price.toFixed(2)}</div>
            <div className={`mt-1 text-xs font-medium ${ticker.change >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
              {ticker.change >= 0 ? 'Up' : 'Down'} ${Math.abs(ticker.change).toFixed(2)}
            </div>
          </div>
        ))}
      </div>

      {lastUpdated ? (
        <p className="mt-3 text-right text-[11px] uppercase tracking-[0.22em] text-slate-500">
          Live source: market-data service • updated {new Date(lastUpdated).toLocaleTimeString()}
        </p>
      ) : null}
    </div>
  );
}
