'use client';

import { useState } from 'react';
import { AlertTriangle, BarChart3, CheckCircle, Clock, DollarSign, Plus, XCircle } from 'lucide-react';
import PlatformPage from '@/components/layout/PlatformPage';

interface SlippageAnalysis {
  ticker: string;
  executionPrice: number;
  midPrice: number;
  slippageBps: number;
  slippageCost: number;
  quality: 'EXCELLENT' | 'GOOD' | 'FAIR' | 'POOR';
  side: 'BUY' | 'SELL';
  quantity: number;
  notional: number;
}

const NODE_API_URL = (process.env.NEXT_PUBLIC_NODE_API_URL || '').trim().replace(/\/+$/, '');

export default function ExecutionQualityPage() {
  const [executions, setExecutions] = useState([
    { ticker: 'AAPL', executionPrice: 175.5, side: 'BUY' as const, quantity: 100 },
    { ticker: 'GOOGL', executionPrice: 140.25, side: 'BUY' as const, quantity: 50 },
    { ticker: 'MSFT', executionPrice: 380, side: 'SELL' as const, quantity: 30 },
  ]);
  const [analyses, setAnalyses] = useState<SlippageAnalysis[]>([]);
  const [loading, setLoading] = useState(false);

  const analyzeExecutions = async () => {
    setLoading(true);
    const results: SlippageAnalysis[] = [];

    for (const execution of executions) {
      try {
        const response = await fetch(`${NODE_API_URL}/api/execution/slippage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...execution,
            executionTime: new Date().toISOString(),
          }),
        });
        const data = await response.json();
        results.push(data);
      } catch (error) {
        console.error('Analysis failed:', error);
      }
    }

    setAnalyses(results);
    setLoading(false);
  };

  const getQualityIcon = (quality: string) => {
    switch (quality) {
      case 'EXCELLENT':
        return <CheckCircle className="h-4 w-4 text-emerald-600" />;
      case 'GOOD':
        return <CheckCircle className="h-4 w-4 text-cyan-600" />;
      case 'FAIR':
        return <AlertTriangle className="h-4 w-4 text-amber-500" />;
      case 'POOR':
        return <XCircle className="h-4 w-4 text-rose-600" />;
      default:
        return null;
    }
  };

  const getQualityChip = (quality: string) => {
    switch (quality) {
      case 'EXCELLENT':
        return 'cerniq-chip cerniq-chip-positive';
      case 'GOOD':
        return 'cerniq-chip';
      case 'FAIR':
        return 'cerniq-chip cerniq-chip-warning';
      case 'POOR':
        return 'cerniq-chip cerniq-chip-negative';
      default:
        return 'cerniq-chip';
    }
  };

  const averageSlippage = analyses.length > 0 ? analyses.reduce((sum, item) => sum + item.slippageBps, 0) / analyses.length : 0;
  const totalCost = analyses.reduce((sum, item) => sum + item.slippageCost, 0);
  const excellentCount = analyses.filter((item) => item.quality === 'EXCELLENT').length;

  return (
    <PlatformPage
      kicker="Execution quality"
      title="Compare intended trades against actual fills before slippage becomes a hidden tax."
      description="Use CERNIQ to review mid-price slippage, execution cost, and best-execution quality on a clean review surface your desk can actually read."
      meta={
        <>
          <span className="cerniq-mini-stat">
            <strong>{executions.length}</strong> staged executions
          </span>
          <span className="cerniq-mini-stat">
            <strong>{analyses.length}</strong> analyzed fills
          </span>
        </>
      }
      actions={
        <>
          <button
            onClick={() =>
              setExecutions((current) => [...current, { ticker: '', executionPrice: 0, side: 'BUY', quantity: 0 }])
            }
            className="cerniq-button-secondary px-5 py-3 text-sm"
          >
            <Plus className="h-4 w-4" />
            Add execution
          </button>
          <button onClick={analyzeExecutions} disabled={loading} className="cerniq-button-primary px-5 py-3 text-sm disabled:opacity-60">
            {loading ? 'Analyzing…' : 'Analyze slippage'}
          </button>
        </>
      }
    >
      {analyses.length > 0 ? (
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="cerniq-stat-card cerniq-stat-card-accent">
            <BarChart3 className="h-6 w-6 text-cyan-600" />
            <p className="mt-4 text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">Average slippage</p>
            <p className="mt-2 text-3xl font-bold text-slate-950">{averageSlippage.toFixed(2)} bps</p>
          </div>
          <div className="cerniq-stat-card cerniq-stat-card-accent">
            <DollarSign className="h-6 w-6 text-rose-600" />
            <p className="mt-4 text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">Total cost</p>
            <p className="mt-2 text-3xl font-bold text-slate-950">${totalCost.toFixed(2)}</p>
          </div>
          <div className="cerniq-stat-card cerniq-stat-card-accent">
            <CheckCircle className="h-6 w-6 text-emerald-600" />
            <p className="mt-4 text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">Excellent fills</p>
            <p className="mt-2 text-3xl font-bold text-slate-950">
              {excellentCount} / {analyses.length}
            </p>
          </div>
          <div className="cerniq-stat-card cerniq-stat-card-accent">
            <Clock className="h-6 w-6 text-amber-500" />
            <p className="mt-4 text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">Analysis mode</p>
            <p className="mt-2 text-3xl font-bold text-slate-950">Real-time</p>
          </div>
        </section>
      ) : null}

      <section className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <div className="cerniq-panel p-6">
          <p className="cerniq-section-label">Trade input</p>
          <h2 className="mt-2 font-display text-2xl text-slate-950">Execution blotter</h2>
          <p className="mt-3 text-sm leading-7 text-slate-600">
            Capture the trades you want to inspect. CERNIQ will compare each fill against the mid price and classify quality automatically.
          </p>

          <div className="mt-6 space-y-3">
            {executions.map((execution, index) => (
              <div key={`${execution.ticker}-${index}`} className="grid gap-3 rounded-[1.25rem] border border-slate-200 bg-white/85 p-4 md:grid-cols-[1.1fr_1fr_1fr_1fr_auto]">
                <input
                  type="text"
                  value={execution.ticker}
                  onChange={(event) => {
                    const updated = [...executions];
                    updated[index].ticker = event.target.value.toUpperCase();
                    setExecutions(updated);
                  }}
                  className="cerniq-field text-sm uppercase"
                  placeholder="Ticker"
                />
                <input
                  type="number"
                  value={execution.executionPrice}
                  onChange={(event) => {
                    const updated = [...executions];
                    updated[index].executionPrice = parseFloat(event.target.value);
                    setExecutions(updated);
                  }}
                  className="cerniq-field text-sm"
                  placeholder="Execution price"
                />
                <select
                  value={execution.side}
                  onChange={(event) => {
                    const updated = [...executions];
                    updated[index].side = event.target.value as 'BUY' | 'SELL';
                    setExecutions(updated);
                  }}
                  className="cerniq-field cerniq-select text-sm"
                >
                  <option value="BUY">Buy</option>
                  <option value="SELL">Sell</option>
                </select>
                <input
                  type="number"
                  value={execution.quantity}
                  onChange={(event) => {
                    const updated = [...executions];
                    updated[index].quantity = parseInt(event.target.value, 10);
                    setExecutions(updated);
                  }}
                  className="cerniq-field text-sm"
                  placeholder="Quantity"
                />
                <button
                  onClick={() => setExecutions((current) => current.filter((_, itemIndex) => itemIndex !== index))}
                  className="rounded-full border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700 transition hover:border-rose-300"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="cerniq-panel p-6">
          <p className="cerniq-section-label">Review guidance</p>
          <h2 className="mt-2 font-display text-2xl text-slate-950">What this view is telling you</h2>
          <div className="mt-6 space-y-4">
            <div className="cerniq-stat-line text-sm leading-7">
              Average slippage shows whether the desk is paying an invisible spread tax across the whole sample.
            </div>
            <div className="cerniq-stat-line text-sm leading-7">
              Good and excellent fills should dominate when routing and execution timing are working as intended.
            </div>
            <div className="cerniq-stat-line text-sm leading-7">
              Repeated poor fills in the same names are often where routing logic or liquidity assumptions need work.
            </div>
          </div>

          <div className="mt-8 rounded-[1.35rem] border border-cyan-200 bg-cyan-50/80 p-5">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-cyan-700/80">Compliance context</p>
            <p className="mt-3 text-sm leading-7 text-slate-700">
              The output is designed for best-execution review, combining fill price, mid-market comparison, and per-trade cost impact in one record.
            </p>
          </div>
        </div>
      </section>

      {analyses.length > 0 ? (
        <section className="cerniq-table-shell">
          <div className="border-b border-slate-200/80 px-6 py-5">
            <p className="cerniq-section-label">Results</p>
            <h2 className="mt-2 font-display text-2xl text-slate-950">Slippage analysis</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="cerniq-table text-sm">
              <thead>
                <tr>
                  <th className="text-left">Ticker</th>
                  <th className="text-left">Side</th>
                  <th className="text-right">Fill price</th>
                  <th className="text-right">Mid price</th>
                  <th className="text-right">Slippage</th>
                  <th className="text-right">Cost</th>
                  <th className="text-center">Quality</th>
                </tr>
              </thead>
              <tbody>
                {analyses.map((analysis, index) => (
                  <tr key={`${analysis.ticker}-${index}`}>
                    <td className="font-semibold text-cyan-800">{analysis.ticker}</td>
                    <td>
                      <span className={analysis.side === 'BUY' ? 'cerniq-chip cerniq-chip-positive' : 'cerniq-chip cerniq-chip-negative'}>
                        {analysis.side}
                      </span>
                    </td>
                    <td className="text-right tabular-nums">${analysis.executionPrice.toFixed(2)}</td>
                    <td className="text-right tabular-nums text-slate-600">${analysis.midPrice.toFixed(2)}</td>
                    <td className={`text-right font-semibold tabular-nums ${analysis.slippageBps > 0 ? 'text-rose-700' : 'text-emerald-700'}`}>
                      {analysis.slippageBps.toFixed(2)} bps
                    </td>
                    <td className={`text-right tabular-nums ${analysis.slippageCost > 0 ? 'text-rose-700' : 'text-emerald-700'}`}>
                      ${analysis.slippageCost.toFixed(2)}
                    </td>
                    <td className="text-center">
                      <span className={getQualityChip(analysis.quality)}>
                        {getQualityIcon(analysis.quality)}
                        {analysis.quality}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </PlatformPage>
  );
}
