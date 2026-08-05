// Apex absorption — Phase 5b cockpit contract shim (2026-05-17).
//
// The original cockpit's ApexCockpit composes 25+ components against
// `useApexStore` (a deep Zustand store), `useLiveEngine` (broker feed
// + decision pipeline), `useRuntimeSafety` (capsule + admissibility
// + release gates), `useSimulationHub` (paper trade orchestrator),
// and `useWorkspaceSession` (sovereign role + workspace gate). That
// composition lives behind 5,000+ transitive LOC.
//
// For Phase 5b the cockpit is rendered as a *visual shell*: tab
// navigation + hero + status strip with the two smallest live
// panels (IntradayPnL, RiskBudget) ported verbatim. The 11 tab
// contents render as ApexEmptyState placeholders until Phase 6
// brings over the store + tab components.
//
// This file narrows just the contract surface those two panels need:
//   - `Trade` — paper-trade execution record (status + outcome)
//   - `AutoRecommendation` — autonomy advisor's daily-trade budget
// Plus a `CockpitMockState` aggregate consumed by the page.

export interface Trade {
  id: string;
  pair: string;
  direction: "LONG" | "SHORT";
  status: "OPEN" | "CLOSED" | "BLOCKED" | "SUPPRESSED";
  pnl: number;
  openedAt: string;
  closedAt: string | null;
}

export interface AutoRecommendation {
  // Number of paper trades the autonomy advisor permits in 1 day.
  // Original AutoRecommendation has 12+ fields covering regime
  // gating, base risk, stress factor, etc. — Phase 5b only needs
  // the daily-trade ceiling + base-risk percentage for RiskBudget.
  maxDailyTrades: number;
  baseRisk: string;
}

export interface CockpitMockState {
  // Mocked credit balance — used as the account-size denominator for
  // 5% daily-DD risk budget calculations in RiskBudget.
  credit: number;
  // Mocked aggregate intraday PnL across all paper positions.
  totalPnl: number;
  // Mocked trade ledger — drives RiskBudget's todayTrades + openCount
  // metrics.
  trades: Trade[];
  // Mocked autonomy recommendation.
  rec: AutoRecommendation;
}
