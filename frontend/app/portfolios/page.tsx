'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Briefcase, Plus, Wallet } from 'lucide-react';
import PlatformPage from '@/components/layout/PlatformPage';
import { apiClient } from '@/lib/api';
import { useAuthStore } from '@/lib/store';

interface Portfolio {
  id: string;
  name: string;
  description: string | null;
  currency: string;
  initialCash: number;
  currentCash: number;
  totalValue: number;
  totalPnL: number;
  totalPnLPercent: number;
  positions: Position[];
}

interface Position {
  id: string;
  ticker: string;
  quantity: number;
  avgCost: number;
  currentPrice: number;
  marketValue: number;
  unrealizedPnL: number;
  unrealizedPnLPercent: number;
  weight: number;
}

export default function PortfoliosPage() {
  const router = useRouter();
  const { initialized, isAuthenticated, onboardingComplete, user } = useAuthStore();
  const [portfolios, setPortfolios] = useState<Portfolio[]>([]);
  const [selectedPortfolio, setSelectedPortfolio] = useState<Portfolio | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showPositionModal, setShowPositionModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [newPortfolio, setNewPortfolio] = useState({ name: '', description: '', benchmark: 'SPY' });
  const [newPosition, setNewPosition] = useState({ symbol: '', quantity: '', price: '' });

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
      const data = await apiClient.getPortfolios();
      const nextPortfolios: Portfolio[] = Array.isArray(data) ? data : [];

      setPortfolios(nextPortfolios);
      setSelectedPortfolio((current) => {
        if (nextPortfolios.length === 0) {
          return null;
        }

        if (!current) {
          return nextPortfolios[0];
        }

        return nextPortfolios.find((portfolio) => portfolio.id === current.id) || nextPortfolios[0];
      });
    } catch (error) {
      console.error('Failed to fetch portfolios:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreatePortfolio = async () => {
    if (!newPortfolio.name || !user?.id) {
      return;
    }

    try {
      await apiClient.createPortfolio(user.id, {
        name: newPortfolio.name,
        description: newPortfolio.description,
        currency: 'USD',
        initial_capital: 100000,
        initialCash: 100000,
      });
      setShowAddModal(false);
      setNewPortfolio({ name: '', description: '', benchmark: 'SPY' });
      await fetchPortfolios();
    } catch (error) {
      console.error('Failed to create portfolio:', error);
    }
  };

  const handleAddPosition = async () => {
    if (!selectedPortfolio || !user?.id || !newPosition.symbol || !newPosition.quantity || !newPosition.price) {
      return;
    }

    try {
      await apiClient.addPosition(selectedPortfolio.id, user.id, {
        symbol: newPosition.symbol.toUpperCase(),
        ticker: newPosition.symbol.toUpperCase(),
        quantity: Number(newPosition.quantity),
        price: Number(newPosition.price),
      });
      setShowPositionModal(false);
      setNewPosition({ symbol: '', quantity: '', price: '' });
      await fetchPortfolios();
    } catch (error) {
      console.error('Failed to add position:', error);
    }
  };

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(value);

  const formatPercent = (value: number) => `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;

  if (!initialized || !isAuthenticated || !onboardingComplete) {
    return null;
  }

  if (loading && portfolios.length === 0) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f7fbff]">
        <div className="h-12 w-12 animate-spin rounded-full border-2 border-cyan-200 border-t-cyan-600" />
      </div>
    );
  }

  return (
    <>
      <PlatformPage
        kicker="Portfolio manager"
        title="Track holdings, cash, and unrealized performance without leaving the CERNIQ workspace."
        description="Portfolio Manager keeps the operating picture clean: one list of mandates on the left, one position surface on the right, and clear performance totals at the top."
        meta={
          <>
            <span className="cerniq-mini-stat">
              <strong>{portfolios.length}</strong> portfolios
            </span>
            {selectedPortfolio ? (
              <>
                <span className="cerniq-mini-stat">
                  <strong>{selectedPortfolio.positions.length}</strong> positions
                </span>
                <span className="cerniq-mini-stat">
                  <strong>{formatCurrency(selectedPortfolio.currentCash)}</strong> cash
                </span>
              </>
            ) : null}
          </>
        }
        actions={
          <>
            <Link href="/dashboard" className="cerniq-button-secondary px-5 py-3 text-sm">
              Back to dashboard
            </Link>
            <button onClick={() => setShowAddModal(true)} className="cerniq-button-primary px-5 py-3 text-sm">
              <Plus className="h-4 w-4" />
              New portfolio
            </button>
          </>
        }
      >
        <section className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
          <div className="cerniq-panel p-6">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="cerniq-section-label">Portfolio list</p>
                <h2 className="mt-2 font-display text-2xl text-slate-950">Your mandates</h2>
              </div>
              <Briefcase className="h-5 w-5 text-cyan-700" />
            </div>

            {portfolios.length === 0 ? (
              <div className="cerniq-empty-state px-6 py-10">
                <p className="font-display text-2xl text-slate-950">No portfolios created yet</p>
                <p className="mt-3 text-sm leading-7 text-slate-600">
                  Create your first portfolio to start tracking positions, cash, and performance.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {portfolios.map((portfolio) => {
                  const isSelected = selectedPortfolio?.id === portfolio.id;
                  return (
                    <button
                      key={portfolio.id}
                      onClick={() => setSelectedPortfolio(portfolio)}
                      className={`w-full rounded-[1.35rem] border p-5 text-left transition ${
                        isSelected
                          ? 'border-cyan-200 bg-gradient-to-br from-cyan-50 via-white to-sky-50 shadow-[0_18px_38px_rgba(63,93,132,0.1)]'
                          : 'border-slate-200 bg-white/88 hover:border-cyan-200 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <h3 className="font-display text-xl text-slate-950">{portfolio.name}</h3>
                          <p className="mt-2 text-sm leading-6 text-slate-600">
                            {portfolio.description || 'No description provided'}
                          </p>
                        </div>
                        <span className="cerniq-chip">{portfolio.currency}</span>
                      </div>

                      <div className="mt-5 grid gap-3 sm:grid-cols-3">
                        <div>
                          <p className="cerniq-caption">Market value</p>
                          <p className="mt-1 text-lg font-semibold text-slate-950">{formatCurrency(portfolio.totalValue)}</p>
                        </div>
                        <div>
                          <p className="cerniq-caption">Unrealized P&L</p>
                          <p className={`mt-1 text-lg font-semibold ${portfolio.totalPnL >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                            {formatCurrency(portfolio.totalPnL)}
                          </p>
                        </div>
                        <div>
                          <p className="cerniq-caption">Return</p>
                          <p className={`mt-1 text-lg font-semibold ${portfolio.totalPnLPercent >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                            {formatPercent(portfolio.totalPnLPercent)}
                          </p>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="space-y-6">
            {selectedPortfolio ? (
              <>
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="cerniq-stat-card cerniq-stat-card-accent">
                    <p className="cerniq-caption">Current cash</p>
                    <p className="mt-3 text-3xl font-bold text-slate-950">{formatCurrency(selectedPortfolio.currentCash)}</p>
                  </div>
                  <div className="cerniq-stat-card cerniq-stat-card-accent">
                    <p className="cerniq-caption">Total value</p>
                    <p className="mt-3 text-3xl font-bold text-slate-950">{formatCurrency(selectedPortfolio.totalValue)}</p>
                  </div>
                  <div className="cerniq-stat-card cerniq-stat-card-accent">
                    <p className="cerniq-caption">Unrealized return</p>
                    <p className={`mt-3 text-3xl font-bold ${selectedPortfolio.totalPnLPercent >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                      {formatPercent(selectedPortfolio.totalPnLPercent)}
                    </p>
                  </div>
                </div>

                <section className="cerniq-table-shell">
                  <div className="flex items-center justify-between border-b border-slate-200/80 px-6 py-5">
                    <div>
                      <p className="cerniq-section-label">Positions</p>
                      <h2 className="mt-2 font-display text-2xl text-slate-950">{selectedPortfolio.name}</h2>
                    </div>
                    <button onClick={() => setShowPositionModal(true)} className="cerniq-button-primary px-5 py-3 text-sm">
                      <Plus className="h-4 w-4" />
                      Add position
                    </button>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="cerniq-table text-sm">
                      <thead>
                        <tr>
                          <th className="text-left">Symbol</th>
                          <th className="text-right">Quantity</th>
                          <th className="text-right">Average cost</th>
                          <th className="text-right">Current price</th>
                          <th className="text-right">Market value</th>
                          <th className="text-right">P&amp;L</th>
                          <th className="text-right">Return</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedPortfolio.positions.length === 0 ? (
                          <tr>
                            <td colSpan={7} className="py-10 text-center text-slate-500">
                              No positions yet. Add the first holding to start performance tracking.
                            </td>
                          </tr>
                        ) : (
                          selectedPortfolio.positions.map((position) => (
                            <tr key={position.id}>
                              <td className="font-semibold text-cyan-800">{position.ticker}</td>
                              <td className="text-right tabular-nums">{position.quantity}</td>
                              <td className="text-right tabular-nums text-slate-600">{formatCurrency(position.avgCost)}</td>
                              <td className="text-right tabular-nums">{formatCurrency(position.currentPrice)}</td>
                              <td className="text-right tabular-nums font-semibold">{formatCurrency(position.marketValue)}</td>
                              <td className={`text-right tabular-nums font-semibold ${position.unrealizedPnL >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                                {formatCurrency(position.unrealizedPnL)}
                              </td>
                              <td className={`text-right tabular-nums ${position.unrealizedPnLPercent >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                                {formatPercent(position.unrealizedPnLPercent)}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                      <tfoot>
                        <tr>
                          <td>Total value</td>
                          <td colSpan={3} />
                          <td className="text-right">{formatCurrency(selectedPortfolio.totalValue)}</td>
                          <td className={`text-right ${selectedPortfolio.totalPnL >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                            {formatCurrency(selectedPortfolio.totalPnL)}
                          </td>
                          <td className={`text-right ${selectedPortfolio.totalPnLPercent >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                            {formatPercent(selectedPortfolio.totalPnLPercent)}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </section>
              </>
            ) : (
              <section className="cerniq-empty-state">
                <Wallet className="mx-auto h-12 w-12 text-cyan-700/70" />
                <h2 className="mt-5 font-display text-3xl text-slate-950">Select a portfolio</h2>
                <p className="mt-3 text-sm leading-7 text-slate-600">
                  Pick a portfolio from the left to inspect its holdings and current performance.
                </p>
              </section>
            )}
          </div>
        </section>
      </PlatformPage>

      {showAddModal ? (
        <div className="cerniq-modal-backdrop">
          <div className="cerniq-modal">
            <h3 className="font-display text-2xl text-slate-950">Create new portfolio</h3>
            <p className="mt-2 text-sm leading-6 text-slate-600">Start a new mandate inside the CERNIQ portfolio manager.</p>
            <div className="mt-6 space-y-4">
              <input
                type="text"
                placeholder="Portfolio name"
                className="cerniq-field"
                value={newPortfolio.name}
                onChange={(event) => setNewPortfolio({ ...newPortfolio, name: event.target.value })}
              />
              <input
                type="text"
                placeholder="Description (optional)"
                className="cerniq-field"
                value={newPortfolio.description}
                onChange={(event) => setNewPortfolio({ ...newPortfolio, description: event.target.value })}
              />
            </div>
            <div className="mt-6 flex gap-3">
              <button onClick={() => setShowAddModal(false)} className="cerniq-button-secondary flex-1 py-3">
                Cancel
              </button>
              <button onClick={handleCreatePortfolio} className="cerniq-button-primary flex-1 py-3">
                Create
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {showPositionModal ? (
        <div className="cerniq-modal-backdrop">
          <div className="cerniq-modal">
            <h3 className="font-display text-2xl text-slate-950">Add position</h3>
            <p className="mt-2 text-sm leading-6 text-slate-600">Enter the security, quantity, and price to update the current portfolio.</p>
            <div className="mt-6 space-y-4">
              <input
                type="text"
                placeholder="Ticker symbol"
                className="cerniq-field uppercase"
                value={newPosition.symbol}
                onChange={(event) => setNewPosition({ ...newPosition, symbol: event.target.value.toUpperCase() })}
              />
              <input
                type="number"
                placeholder="Quantity"
                className="cerniq-field"
                value={newPosition.quantity}
                onChange={(event) => setNewPosition({ ...newPosition, quantity: event.target.value })}
              />
              <input
                type="number"
                step="0.01"
                placeholder="Price per share"
                className="cerniq-field"
                value={newPosition.price}
                onChange={(event) => setNewPosition({ ...newPosition, price: event.target.value })}
              />
            </div>
            <div className="mt-6 flex gap-3">
              <button onClick={() => setShowPositionModal(false)} className="cerniq-button-secondary flex-1 py-3">
                Cancel
              </button>
              <button onClick={handleAddPosition} className="cerniq-button-primary flex-1 py-3">
                Buy
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
