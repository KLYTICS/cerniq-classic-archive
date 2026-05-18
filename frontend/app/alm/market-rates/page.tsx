'use client';

/**
 * /alm/market-rates — live macro reference data.
 *
 * Distinct from /alm/yield-curve which fits a Nelson-Siegel curve to an
 * institution-specific portfolio. This page surfaces the LIVE OBSERVED
 * market data that those models reference:
 *
 *   - US Treasury Constant-Maturity yield curve (FRED, 11 tenors)
 *   - Federal Funds Rate (FRED: DFF) — policy rate, anchors short-rate sensitivity
 *   - Prime Rate (FRED: DPRIME) — variable-rate loan reference for cooperativas
 *   - 30-Year Fixed Mortgage Rate (FRED: MORTGAGE30US) — directly relevant to mortgage books
 *   - CPI (FRED: CPIAUCSL) — inflation, affects rate forecasts and credit quality
 *   - USD/EUR FX rate (FRED: DEXUSEU) — any EUR exposure on the books
 *
 * Every card is disciplined identically (`useMacroData` factory + the
 * `MacroIndicatorCard` component): four explicit render states (live ·
 * loading · DataGap · error), all driven by the same backend orchestrator
 * + circuit-breaker, all carrying lineage in the footer.
 *
 * Future vendor additions slot into this same surface: Bloomberg BPIPE for
 * institutional-grade rates, Treasury Direct as a FRED fallback, ECB SDW
 * for euro-area macro. Each adds one provider, zero coupling to the cards.
 */

import { YieldCurveCard } from '@/components/risk/YieldCurveCard';
import { MacroIndicatorCard } from '@/components/risk/MacroIndicatorCard';
import {
  useEconomicIndicator,
  useFXRate,
  useInterestRate,
} from '@/lib/hooks/use-macro-data';

export default function MarketRatesPage() {
  // Hooks — call order matches the card grid below. Each is independent
  // (separate AbortController, separate cache), so a slow CPI fetch won't
  // delay the Fed Funds card.
  const fedFunds = useInterestRate('DFF');
  const primeRate = useInterestRate('DPRIME');
  const mortgage30y = useInterestRate('MORTGAGE30US');
  const cpi = useEconomicIndicator('CPIAUCSL');
  const usdEur = useFXRate('DEXUSEU', 'USD', 'EUR');

  return (
    <main className="mx-auto max-w-6xl px-4 py-6">
      <header className="mb-6 border-b border-zinc-800 pb-4">
        <h1 className="text-lg font-semibold text-zinc-100">
          Market Rates — Live Reference
        </h1>
        <p className="mt-1 max-w-3xl text-sm text-zinc-400">
          Authoritative live data behind every ALM model: yield curves,
          short-rate references, and FX from public-data providers (FRED
          today). Each card carries explicit provenance — provider name,
          observation date, and lineage breadcrumbs — so any number on this
          page can be re-derived against the source. No silent zero
          fallbacks: when a provider is unavailable, the card surfaces the
          gap explicitly with remediation context.
        </p>
      </header>

      {/* Yield curve gets its own row — it's the densest visualization. */}
      <div className="mb-4">
        <YieldCurveCard />
      </div>

      {/* Single-value indicators in a dense Bloomberg-style grid. */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        <MacroIndicatorCard
          title="Federal Funds Rate"
          subtitle="effective overnight; sets short-rate floor"
          result={fedFunds}
          valueAccessor={(d) => d.rate}
          valueSuffix="%"
        />
        <MacroIndicatorCard
          title="Prime Rate"
          subtitle="bank prime loan; variable-rate reference"
          result={primeRate}
          valueAccessor={(d) => d.rate}
          valueSuffix="%"
        />
        <MacroIndicatorCard
          title="30-Year Mortgage Rate"
          subtitle="Freddie Mac PMMS national average"
          result={mortgage30y}
          valueAccessor={(d) => d.rate}
          valueSuffix="%"
        />
        <MacroIndicatorCard
          title="CPI"
          subtitle="consumer price index, urban; level"
          result={cpi}
          valueAccessor={(d) => d.value}
          valueSuffix=""
          valueFormat={(v) => v.toFixed(1)}
        />
        <MacroIndicatorCard
          title="USD/EUR"
          subtitle="dollars per euro spot rate"
          result={usdEur}
          valueAccessor={(d) => d.rate}
          valueSuffix=""
          valueFormat={(v) => v.toFixed(4)}
        />
      </div>

      <footer className="mt-6 border-t border-zinc-800 pt-4 text-xs text-zinc-500">
        <p>
          <strong className="text-zinc-400">Vendor surface:</strong> All
          indicators on this page are sourced from FRED (Federal Reserve
          Economic Data, St. Louis Fed). Each card&apos;s footer names the
          exact series id so the number can be re-derived against
          fred.stlouisfed.org. Bloomberg BPIPE / Refinitiv Eikon / ICE Bank
          of America / Treasury Direct (as FRED fallback) are planned but
          not yet active — contact engineering before promoting any
          institutional-grade rate to production audit use.
        </p>
        <p className="mt-2">
          <strong className="text-zinc-400">Data discipline:</strong>{' '}
          Every card renders four explicit states (live · loading ·
          DataGap · error) — never falls back to silent zeros when a
          provider is unavailable. The KLYTICS audit canon Rule 1 (no
          silent zeros) extends from backend through the entire UI surface.
        </p>
      </footer>
    </main>
  );
}
