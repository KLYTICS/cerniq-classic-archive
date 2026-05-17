'use client';

/**
 * /alm/market-rates — live macro reference data.
 *
 * Distinct from /alm/yield-curve which fits a Nelson-Siegel curve to an
 * institution-specific portfolio. This page surfaces the LIVE OBSERVED
 * market data that those models reference: US Treasury Constant-Maturity
 * curve from FRED today; future iterations can add SOFR, OIS, indices,
 * and FX pairs (each as its own card under the same data discipline).
 *
 * Macro-data only — not institution-scoped. Sits inside the ALM shell
 * (provided by /app/alm/layout.tsx) for navigation consistency but
 * doesn't take an institutionId.
 */

import { YieldCurveCard } from '@/components/risk/YieldCurveCard';

export default function MarketRatesPage(): JSX.Element {
  return (
    <main className="mx-auto max-w-5xl px-4 py-6">
      <header className="mb-6 border-b border-zinc-800 pb-4">
        <h1 className="text-lg font-semibold text-zinc-100">
          Market Rates — Live Reference
        </h1>
        <p className="mt-1 max-w-3xl text-sm text-zinc-400">
          Authoritative live data behind every ALM model: yield curves,
          short-rate references, and FX from public-data providers (FRED
          today). Each card carries explicit provenance — provider name,
          observation date, and lineage breadcrumbs — so any number on this
          page can be re-derived against the source.
        </p>
      </header>

      <div className="grid grid-cols-1 gap-4">
        <YieldCurveCard />
      </div>

      <footer className="mt-6 border-t border-zinc-800 pt-4 text-xs text-zinc-500">
        <p>
          <strong className="text-zinc-400">Vendor surface:</strong> US
          Treasury yield-curve data is sourced from FRED (Federal Reserve
          Economic Data, St. Louis Fed). Bloomberg BPIPE / Refinitiv Eikon /
          ICE Bank of America connectors are planned but not yet active —
          contact engineering before promoting any institutional-grade rate
          to production audit use.
        </p>
        <p className="mt-2">
          <strong className="text-zinc-400">Data discipline:</strong>{' '}
          Three explicit render states (live · loading · DataGap) per
          KLYTICS Rule 1. The page never falls back to silent zeros when a
          provider is unavailable; the user always sees the gap explicitly
          with provider name + remediation action.
        </p>
      </footer>
    </main>
  );
}
