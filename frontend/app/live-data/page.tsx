'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Activity, BellRing, Globe, Newspaper, Plus } from 'lucide-react';
import PlatformPage from '@/components/layout/PlatformPage';
import { apiClient } from '@/lib/api';
import { useMarketDataSocket } from '@/lib/marketDataSocket';

interface PriceData {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  high: number;
  low: number;
  volume: string;
  lastUpdate: Date;
  freshnessState?: 'NEAR_REALTIME' | 'DELAYED' | 'STALE' | 'DISCONNECTED' | 'UNAVAILABLE';
  session?: 'PREMARKET' | 'REGULAR' | 'AFTER_HOURS' | 'CLOSED' | 'CRYPTO' | 'UNKNOWN';
  provider?: string;
}

interface PriceAlert {
  id: string;
  symbol: string;
  targetPrice: number;
  direction: 'above' | 'below';
  triggered: boolean;
}

interface InstrumentProfile {
  ticker: string;
  assetType: 'stock' | 'etf' | 'crypto' | 'index';
  shortName?: string;
  longName?: string;
  exchange?: string;
  currency?: string;
  marketState?: string;
  sector?: string;
  industry?: string;
  categoryName?: string;
  family?: string;
  description?: string;
  website?: string;
  marketCap?: number;
  totalAssets?: number;
  expenseRatio?: number;
  yield?: number;
  ytdReturn?: number;
  topHoldings?: Array<{ symbol: string; name: string; weight: number }>;
}

interface NewsArticle {
  id: string;
  title: string;
  publisher: string;
  link: string;
  publishedAt: string;
  relatedTickers?: string[];
}

export default function LiveDataPage() {
  const [watchlist, setWatchlist] = useState<string[]>(['NVDA', 'AAPL', 'MSFT', 'GOOGL', 'META', 'AMD', 'TSLA', 'SPY']);
  const [prices, setPrices] = useState<Record<string, PriceData>>({});
  const [profiles, setProfiles] = useState<Record<string, InstrumentProfile>>({});
  const [news, setNews] = useState<Record<string, NewsArticle[]>>({});
  const [selectedSymbol, setSelectedSymbol] = useState('NVDA');
  const [newSymbol, setNewSymbol] = useState('');
  const [alerts, setAlerts] = useState<PriceAlert[]>([]);
  const [newAlert, setNewAlert] = useState<{ symbol: string; price: string; direction: 'above' | 'below' }>({
    symbol: '',
    price: '',
    direction: 'above',
  });
  const [loading, setLoading] = useState(true);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const { isConnected: connected, subscribeTicker, subscribeInstrument, subscribeNews } = useMarketDataSocket();

  const markTriggeredAlerts = useCallback((nextPrices: Record<string, PriceData>) => {
    setAlerts((current) =>
      current.map((alert) => {
        if (alert.triggered) {
          return alert;
        }

        const data = nextPrices[alert.symbol];
        if (!data) {
          return alert;
        }

        if (alert.direction === 'above' && data.price >= alert.targetPrice) {
          return { ...alert, triggered: true };
        }

        if (alert.direction === 'below' && data.price <= alert.targetPrice) {
          return { ...alert, triggered: true };
        }

        return alert;
      })
    );
  }, []);

  const fetchSnapshotsViaREST = useCallback(async (tickers: string[]) => {
    const nextPrices: Record<string, PriceData> = {};
    const nextProfiles: Record<string, InstrumentProfile> = {};
    const nextNews: Record<string, NewsArticle[]> = {};

    await Promise.all(
      tickers.map(async (symbol) => {
        try {
          const snapshot = await apiClient.getNodeSnapshot(symbol, 6);
          const quote = snapshot.quote || {};
          if (quote.price !== undefined) {
            nextPrices[symbol] = {
              symbol,
              price: quote.price ?? 0,
              change: quote.change ?? 0,
              changePercent: quote.changePercent ?? 0,
              high: quote.high ?? quote.price ?? 0,
              low: quote.low ?? quote.price ?? 0,
              volume: quote.volume ? `${(quote.volume / 1_000_000).toFixed(1)}M` : '--',
              lastUpdate: new Date(quote.timestamp || Date.now()),
              freshnessState: quote.freshnessState,
              session: quote.session,
              provider: quote.provider,
            };
          }
          if (snapshot.profile) {
            nextProfiles[symbol] = snapshot.profile;
          }
          if (Array.isArray(snapshot.news)) {
            nextNews[symbol] = snapshot.news;
          }
        } catch (error) {
          console.error(`Failed to fetch snapshot for ${symbol}:`, error);
        }
      })
    );

    if (Object.keys(nextPrices).length > 0) {
      setPrices((current) => {
        const merged = { ...current, ...nextPrices };
        markTriggeredAlerts(merged);
        return merged;
      });
    }
    if (Object.keys(nextProfiles).length > 0) {
      setProfiles((current) => ({ ...current, ...nextProfiles }));
    }
    if (Object.keys(nextNews).length > 0) {
      setNews((current) => ({ ...current, ...nextNews }));
    }
    setLoading(false);
  }, [markTriggeredAlerts]);

  const startPolling = useCallback(() => {
    if (pollingRef.current) {
      return;
    }

    pollingRef.current = setInterval(() => {
      void fetchSnapshotsViaREST(watchlist);
    }, 5000);
  }, [fetchSnapshotsViaREST, watchlist]);

  useEffect(() => {
    const initialFetch = setTimeout(() => {
      void fetchSnapshotsViaREST(watchlist);
    }, 0);

    return () => {
      clearTimeout(initialFetch);
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
      }
    };
  }, [fetchSnapshotsViaREST, watchlist]);

  useEffect(() => {
    if (connected) {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
      return;
    }

    if (!pollingRef.current) {
      startPolling();
    }
  }, [connected, startPolling]);

  useEffect(() => {
    if (!connected) {
      return;
    }

    const cleanups = watchlist.flatMap((ticker) => {
      const unsubscribers = [];

      const unsubscribeTicker = subscribeTicker(ticker, (data) => {
        setPrices((current) => {
          const nextPrices = {
            ...current,
            [data.ticker]: {
              symbol: data.ticker,
              price: data.price,
              change: data.change ?? 0,
              changePercent: data.changePercent ?? 0,
              high: data.high ?? Math.max(current[data.ticker]?.high ?? 0, data.price),
              low: data.low ?? (current[data.ticker]?.low ? Math.min(current[data.ticker].low, data.price) : data.price),
              volume: data.volume ? `${(data.volume / 1_000_000).toFixed(1)}M` : current[data.ticker]?.volume ?? '--',
              lastUpdate: new Date(data.timestamp || Date.now()),
              freshnessState: data.freshnessState,
              session: data.session,
              provider: data.provider,
            },
          };
          markTriggeredAlerts(nextPrices);
          return nextPrices;
        });
        setLoading(false);
      });
      if (unsubscribeTicker) {
        unsubscribers.push(unsubscribeTicker);
      }

      const unsubscribeInstrument = subscribeInstrument(ticker, (payload) => {
        if (payload.profile) {
          setProfiles((current) => ({ ...current, [payload.ticker]: payload.profile }));
        }
        if (payload.quote?.price !== undefined) {
          setPrices((current) => ({
            ...current,
            [payload.ticker]: {
              symbol: payload.ticker,
              price: payload.quote?.price ?? current[payload.ticker]?.price ?? 0,
              change: payload.quote?.change ?? current[payload.ticker]?.change ?? 0,
              changePercent: payload.quote?.changePercent ?? current[payload.ticker]?.changePercent ?? 0,
              high: payload.quote?.high ?? current[payload.ticker]?.high ?? payload.quote?.price ?? 0,
              low: payload.quote?.low ?? current[payload.ticker]?.low ?? payload.quote?.price ?? 0,
              volume: payload.quote?.volume
                ? `${(payload.quote.volume / 1_000_000).toFixed(1)}M`
                : current[payload.ticker]?.volume ?? '--',
              lastUpdate: new Date(payload.quote?.timestamp || Date.now()),
              freshnessState: payload.quote?.freshnessState ?? current[payload.ticker]?.freshnessState,
              session: payload.quote?.session ?? current[payload.ticker]?.session,
              provider: payload.quote?.provider ?? current[payload.ticker]?.provider,
            },
          }));
        }
      });
      if (unsubscribeInstrument) {
        unsubscribers.push(unsubscribeInstrument);
      }

      const unsubscribeNews = subscribeNews(ticker, (payload) => {
        setNews((current) => ({ ...current, [payload.ticker]: payload.items || [] }));
      });
      if (unsubscribeNews) {
        unsubscribers.push(unsubscribeNews);
      }

      return unsubscribers;
    });

    return () => {
      cleanups.forEach((cleanup) => cleanup());
    };
  }, [connected, markTriggeredAlerts, subscribeInstrument, subscribeNews, subscribeTicker, watchlist]);

  const addToWatchlist = () => {
    const symbol = newSymbol.toUpperCase().trim();
    if (!symbol || watchlist.includes(symbol)) {
      return;
    }

    setWatchlist((current) => [...current, symbol]);
    setSelectedSymbol(symbol);
    void fetchSnapshotsViaREST([symbol]);
    setNewSymbol('');
  };

  const removeFromWatchlist = (symbol: string) => {
    setWatchlist((current) => {
      const next = current.filter((item) => item !== symbol);
      if (selectedSymbol === symbol && next.length > 0) {
        setSelectedSymbol(next[0]);
      }
      return next;
    });
  };

  const addAlert = () => {
    if (!newAlert.symbol || !newAlert.price) {
      return;
    }

    setAlerts((current) => [
      ...current,
      {
        id: Date.now().toString(),
        symbol: newAlert.symbol.toUpperCase(),
        targetPrice: parseFloat(newAlert.price),
        direction: newAlert.direction,
        triggered: false,
      },
    ]);
    setNewAlert({ symbol: '', price: '', direction: 'above' });
  };

  const formatPrice = (price: number) => price.toFixed(2);
  const selectedProfile = profiles[selectedSymbol];
  const selectedNews = news[selectedSymbol] || [];
  const selectedPrice = prices[selectedSymbol];

  useEffect(() => {
    if (!watchlist.includes(selectedSymbol) && watchlist.length > 0) {
      setSelectedSymbol(watchlist[0]);
    }
  }, [selectedSymbol, watchlist]);

  if (loading && Object.keys(prices).length === 0) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f7fbff]">
        <div className="h-12 w-12 animate-spin rounded-full border-2 border-cyan-200 border-t-cyan-600" />
      </div>
    );
  }

  return (
    <PlatformPage
      kicker="Live market data"
      title="Monitor quotes, highs, lows, and alerts from the same CERNIQ market surface."
      description="This view keeps live data readable: a watchlist table for real prices, a compact ticker tape for quick scanning, and alerts on the right for names that matter."
      meta={
        <>
          <span className="cerniq-mini-stat">
            <strong>{watchlist.length}</strong> watchlist names
          </span>
          <span className="cerniq-mini-stat">
            <strong>{alerts.length}</strong> price alerts
          </span>
          <span className={`cerniq-mini-stat ${connected ? 'text-emerald-700' : 'text-amber-700'}`}>
            <strong>{connected ? 'Live WebSocket' : 'Polling fallback'}</strong>
          </span>
        </>
      }
      actions={
        <Link href="/dashboard" className="cerniq-button-secondary px-5 py-3 text-sm">
          Back to dashboard
        </Link>
      }
    >
      <section className="cerniq-panel overflow-hidden p-5">
        <div className="flex items-center gap-4 whitespace-nowrap">
          <Activity className={`h-5 w-5 ${connected ? 'text-emerald-600' : 'text-amber-500'}`} />
          <div className="flex min-w-full gap-8 overflow-hidden">
            <div className="flex min-w-max gap-8 animate-[marquee_30s_linear_infinite]">
              {Object.values(prices).map((data) => (
                <div key={data.symbol} className="flex items-center gap-3">
                  <span className="font-semibold text-cyan-800">{data.symbol}</span>
                  <span className="font-semibold text-slate-950">${formatPrice(data.price)}</span>
                  <span className={data.change >= 0 ? 'text-emerald-700' : 'text-rose-700'}>
                    {data.change >= 0 ? '▲' : '▼'} {Math.abs(data.changePercent).toFixed(2)}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <section className="cerniq-table-shell">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200/80 px-6 py-5">
            <div>
              <p className="cerniq-section-label">Watchlist</p>
              <h2 className="mt-2 font-display text-2xl text-slate-950">Streaming quotes</h2>
            </div>
            <div className="flex gap-3">
              <input
                type="text"
                value={newSymbol}
                onChange={(event) => setNewSymbol(event.target.value.toUpperCase())}
                placeholder="Add ticker"
                className="cerniq-field w-36 py-3 text-sm uppercase"
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    addToWatchlist();
                  }
                }}
              />
              <button onClick={addToWatchlist} className="cerniq-button-primary px-5 py-3 text-sm">
                <Plus className="h-4 w-4" />
                Add
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="cerniq-table text-sm">
              <thead>
                <tr>
                  <th className="text-left">Symbol</th>
                  <th className="text-right">Price</th>
                  <th className="text-right">Change</th>
                  <th className="text-right">High</th>
                  <th className="text-right">Low</th>
                  <th className="text-right">Volume</th>
                  <th className="text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {watchlist.map((symbol) => {
                  const data = prices[symbol];
                  if (!data) {
                    return (
                      <tr key={symbol}>
                        <td className="font-semibold text-cyan-800">{symbol}</td>
                        <td colSpan={5} className="text-center text-slate-500">
                          Loading…
                        </td>
                        <td className="text-right">
                          <button onClick={() => removeFromWatchlist(symbol)} className="text-slate-400 transition hover:text-rose-700">
                            Remove
                          </button>
                        </td>
                      </tr>
                    );
                  }

                  return (
                    <tr
                      key={symbol}
                      onClick={() => setSelectedSymbol(symbol)}
                      className={selectedSymbol === symbol ? 'bg-cyan-50/70' : 'cursor-pointer'}
                    >
                      <td className="font-semibold text-cyan-800">{symbol}</td>
                      <td className="text-right tabular-nums font-semibold text-slate-950">${formatPrice(data.price)}</td>
                      <td className={`text-right tabular-nums ${data.change >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                        <div>{data.change >= 0 ? '+' : ''}{formatPrice(data.change)}</div>
                        <div className="text-xs">{data.change >= 0 ? '+' : ''}{data.changePercent.toFixed(2)}%</div>
                      </td>
                      <td className="text-right tabular-nums text-slate-600">${formatPrice(data.high)}</td>
                      <td className="text-right tabular-nums text-slate-600">${formatPrice(data.low)}</td>
                      <td className="text-right tabular-nums text-slate-600">{data.volume}</td>
                      <td className="text-right">
                        <button onClick={() => removeFromWatchlist(symbol)} className="text-slate-400 transition hover:text-rose-700">
                          Remove
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        <div className="space-y-6">
          <section className="cerniq-panel p-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="cerniq-section-label">Selected market</p>
                <h2 className="mt-2 font-display text-2xl text-slate-950">{selectedSymbol}</h2>
              </div>
              <span className="cerniq-chip capitalize">
                {selectedProfile?.assetType || 'market'}
              </span>
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-2">
              <div className="rounded-[1.15rem] border border-slate-200 bg-white/80 p-4">
                <div className="text-xs uppercase tracking-[0.22em] text-slate-500">Last price</div>
                <div className="mt-2 text-3xl font-semibold text-slate-950">
                  {selectedPrice ? `$${formatPrice(selectedPrice.price)}` : '--'}
                </div>
                <div className={`mt-2 text-sm font-medium ${selectedPrice && selectedPrice.change >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                  {selectedPrice ? `${selectedPrice.change >= 0 ? '+' : ''}${formatPrice(selectedPrice.change)} • ${selectedPrice.changePercent.toFixed(2)}%` : 'Waiting for quote'}
                </div>
              </div>
              <div className="rounded-[1.15rem] border border-slate-200 bg-white/80 p-4">
                <div className="text-xs uppercase tracking-[0.22em] text-slate-500">Market status</div>
                <div className="mt-2 text-lg font-semibold text-slate-950">{selectedProfile?.marketState || 'Streaming'}</div>
              <div className="mt-2 text-sm text-slate-600">
                  {(selectedProfile?.exchange || 'Global market')} • {selectedProfile?.currency || 'USD'}
                </div>
                <div className="mt-2 text-xs uppercase tracking-[0.18em] text-slate-500">
                  {selectedPrice?.session || 'UNKNOWN'} • {selectedPrice?.freshnessState || 'UNAVAILABLE'}{selectedPrice?.provider ? ` • ${selectedPrice.provider}` : ''}
                </div>
              </div>
            </div>

            <div className="mt-5 space-y-3 rounded-[1.15rem] border border-slate-200 bg-white/80 p-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-950">
                <Globe className="h-4 w-4 text-cyan-700" />
                {selectedProfile?.longName || selectedProfile?.shortName || selectedSymbol}
              </div>
              <p className="text-sm text-slate-600">
                {[selectedProfile?.sector, selectedProfile?.industry, selectedProfile?.categoryName].filter(Boolean).join(' • ') || 'Live market profile will appear here as data arrives.'}
              </p>
              {selectedProfile?.description ? (
                <p className="text-sm text-slate-600">{selectedProfile.description}</p>
              ) : null}
              {selectedProfile?.topHoldings && selectedProfile.topHoldings.length > 0 ? (
                <div className="pt-2">
                  <div className="text-xs uppercase tracking-[0.22em] text-slate-500">Top holdings</div>
                  <div className="mt-3 space-y-2">
                    {selectedProfile.topHoldings.slice(0, 5).map((holding) => (
                      <div key={`${selectedSymbol}-${holding.symbol}`} className="flex items-center justify-between text-sm">
                        <span className="font-medium text-slate-950">{holding.symbol}</span>
                        <span className="text-slate-600">{holding.weight.toFixed(2)}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>

            <div className="mt-5 rounded-[1.15rem] border border-slate-200 bg-white/80 p-4">
              <div className="flex items-center gap-2">
                <Newspaper className="h-4 w-4 text-cyan-700" />
                <div className="text-sm font-semibold text-slate-950">Streaming news</div>
              </div>
              <div className="mt-4 space-y-3">
                {selectedNews.length === 0 ? (
                  <p className="text-sm text-slate-500">No headlines yet for {selectedSymbol}. The feed refreshes automatically while subscribed.</p>
                ) : (
                  selectedNews.slice(0, 5).map((item) => (
                    <a
                      key={item.id}
                      href={item.link}
                      target="_blank"
                      rel="noreferrer"
                      className="block rounded-[1rem] border border-slate-200 px-4 py-3 transition hover:border-cyan-200 hover:bg-cyan-50/70"
                    >
                      <div className="text-sm font-semibold text-slate-950">{item.title}</div>
                      <div className="mt-1 text-xs uppercase tracking-[0.18em] text-slate-500">
                        {item.publisher} • {new Date(item.publishedAt).toLocaleString()}
                      </div>
                    </a>
                  ))
                )}
              </div>
            </div>
          </section>

          <section className="cerniq-panel p-6">
            <div className="flex items-center gap-3">
              <BellRing className="h-5 w-5 text-cyan-700" />
              <div>
                <p className="cerniq-section-label">Alerts</p>
                <h2 className="mt-2 font-display text-2xl text-slate-950">Price triggers</h2>
              </div>
            </div>

            <div className="mt-6 space-y-3">
              <input
                type="text"
                value={newAlert.symbol}
                onChange={(event) => setNewAlert({ ...newAlert, symbol: event.target.value.toUpperCase() })}
                placeholder="Symbol"
                className="cerniq-field uppercase"
              />
              <div className="grid gap-3 md:grid-cols-[0.9fr_1.1fr]">
                <select
                  value={newAlert.direction}
                  onChange={(event) => setNewAlert({ ...newAlert, direction: event.target.value as 'above' | 'below' })}
                  className="cerniq-field cerniq-select"
                >
                  <option value="above">Above</option>
                  <option value="below">Below</option>
                </select>
                <input
                  type="number"
                  value={newAlert.price}
                  onChange={(event) => setNewAlert({ ...newAlert, price: event.target.value })}
                  placeholder="Trigger price"
                  className="cerniq-field"
                />
              </div>
              <button onClick={addAlert} className="cerniq-button-primary w-full py-3 text-sm">
                Create alert
              </button>
            </div>

            <div className="mt-6 space-y-3">
              {alerts.length === 0 ? (
                <div className="rounded-[1.25rem] border border-dashed border-slate-200 bg-white/70 px-5 py-8 text-center text-sm text-slate-500">
                  No alerts set yet.
                </div>
              ) : (
                alerts.map((alert) => (
                  <div
                    key={alert.id}
                    className={`rounded-[1.25rem] border p-4 ${
                      alert.triggered
                        ? 'border-emerald-200 bg-emerald-50/85'
                        : 'border-slate-200 bg-white/85'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-cyan-800">{alert.symbol}</span>
                      <span className={alert.triggered ? 'cerniq-chip cerniq-chip-positive' : 'cerniq-chip'}>
                        {alert.triggered ? 'Triggered' : 'Active'}
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-slate-600">
                      {alert.direction === 'above' ? 'Above' : 'Below'} ${alert.targetPrice.toFixed(2)}
                    </p>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>
      </section>
    </PlatformPage>
  );
}
