"use client";

// /apex/cockpit — Phase 5b (cockpit shell with mocked status strip, 2026-05-17).
//
// Second of four flagship-route ports under Phase 5. The original
// ApexCockpit is a 408-line composition over 25+ component imports
// (Header, PairRow, TabBar, AlarmSidebar, NewsTicker, CommandCenter,
// AutonomyTab, DalioEngine, MauldinEngine, SwarmView, MasterPromptsTab,
// MultiAssetOverviewPanel, CalibrationTab, StressTestTab, PropFirmsTab,
// ExecutionTab, SignalBibles, PlaybookTabContent, SystemHealth,
// QuickActionBar, IntradayPnL, RiskBudget, RuntimeHealthStrip,
// WorkspaceStatusStrip) + 4 hooks (useLiveEngine, useRuntimeSafety,
// useSimulationHub, useWorkspaceSession) + 24 Zustand store selectors
// from useApexStore. The transitive port surface is 5,000+ LOC.
//
// Phase 5b ports the *visual shell* + the *two smallest live panels*:
//   - IntradayPnL (53 lines, verbatim) — drives the status-strip
//     sparkline + session pulse
//   - RiskBudget (67 lines, verbatim) — drives the DD-gauge + trades
//     remaining + capacity counters
// Both panels render against mocked Trade[] + AutoRecommendation data
// so the desk-grade dense status strip looks identical to the original
// cockpit's top bar.
//
// The 11-tab nav renders client-side with internal state; each tab
// shows an ApexEmptyState placeholder explaining that the tab content
// (CommandCenter, ExecutionTab, AutonomyTab, etc.) ports alongside
// the Zustand store + API handlers in Phase 6.
//
// "Preserve original form" — TAB list, status-strip layout, hero
// copy, and Bloomberg-density aesthetic match Apex's cockpit
// identity. The route nav (top-level ApexRouteNav) already points
// at /apex/* per Phase 1.1.

import { useState } from "react";
import {
  ApexAction,
  ApexActionGroup,
  ApexEmptyState,
  ApexHero,
  ApexPageShell,
  ApexSection,
  ApexStatusPill,
} from "@/components/apex/apex-demo-ui";
import { IntradayPnL } from "@/components/apex/intraday-pnl";
import { RiskBudget } from "@/components/apex/risk-budget";
import type { CockpitMockState } from "@/lib/apex/cockpit-contracts";

const TABS = [
  "COMMAND",
  "EXECUTE",
  "AUTONOMY",
  "PLAYBOOK",
  "DALIO",
  "MAULDIN",
  "SWARM",
  "MASTER PROMPTS",
  "STRESS TEST",
  "CALIBRATION",
  "PROP FIRMS",
] as const;

// Mocked cockpit state — credit, intraday PnL, 4 paper trades (one
// closed_win, one closed_loss, two open), autonomy advisor allowing
// 6 trades/day at 1.0% base risk. Values picked to demonstrate the
// rainbow of states across the status strip.
const MOCK_STATE: CockpitMockState = {
  credit: 10000,
  totalPnl: 64.5,
  trades: [
    {
      id: "t-1",
      pair: "EUR/USD",
      direction: "LONG",
      status: "CLOSED",
      pnl: 90,
      openedAt: "2026-05-17 09:15",
      closedAt: "2026-05-17 14:30",
    },
    {
      id: "t-2",
      pair: "GBP/JPY",
      direction: "SHORT",
      status: "CLOSED",
      pnl: -45,
      openedAt: "2026-05-17 10:00",
      closedAt: "2026-05-17 11:12",
    },
    {
      id: "t-3",
      pair: "AUD/USD",
      direction: "LONG",
      status: "OPEN",
      pnl: 19.5,
      openedAt: "2026-05-17 14:55",
      closedAt: null,
    },
    {
      id: "t-4",
      pair: "EUR/CHF",
      direction: "LONG",
      status: "OPEN",
      pnl: 0,
      openedAt: "2026-05-17 15:08",
      closedAt: null,
    },
  ],
  rec: { maxDailyTrades: 6, baseRisk: "1.0" },
};

const TAB_DESCRIPTIONS: Record<(typeof TABS)[number], string> = {
  COMMAND:
    "Central decision board — paper trade queue, current opportunity rank, and the autonomy advisor's next move.",
  EXECUTE:
    "Manual paper-trade execution surface — pair, direction, size, stop, target. Submits to the OANDA paper engine.",
  AUTONOMY:
    "Autonomy advisor configuration — base risk, max daily trades, regime gating, stress factor.",
  PLAYBOOK:
    "Macro playbook viewer — Dalio regime mapping, current macro lens, signal bible references.",
  DALIO:
    "Dalio Engine — long-debt-cycle phase classification, credit/sentiment/news scoring inputs.",
  MAULDIN:
    "Mauldin Engine — global liquidity, central-bank balance sheet, and credit-condition synthesizer.",
  SWARM:
    "Swarm View — agent consensus board across the autonomy committee, with confidence + dissent.",
  "MASTER PROMPTS":
    "Master Prompts — operator-curated prompt library for the agent committee.",
  "STRESS TEST":
    "Stress Test — Monte Carlo + scenario shocks against current paper portfolio.",
  CALIBRATION:
    "Calibration — historical-fit diagnostics for the autonomy advisor's parameters.",
  "PROP FIRMS":
    "Prop Firms — funded-account compliance overlay (FTMO/MyForexFunds/etc. rules).",
};

export default function ApexCockpitPage() {
  const [activeTab, setActiveTab] = useState<(typeof TABS)[number]>("COMMAND");

  return (
    <ApexPageShell active="/apex/cockpit" maxWidth={1200}>
      <main style={{ display: "grid", gap: 16 }}>
        <ApexHero
          eyebrow="APEX · COCKPIT · PHASE 5b"
          title="Trading Cockpit"
          copy={
            <>
              The decisive paper-trade execution surface. Live status strip
              renders against mocked Trade ledger + autonomy recommendation; tab
              content ports alongside the Zustand store + API handlers in Phase
              6.
            </>
          }
          actions={
            <ApexActionGroup>
              <ApexAction href="/apex/hub" tone="success">
                Back to Hub
              </ApexAction>
              <ApexAction href="/apex/journal">Trade Journal</ApexAction>
              <ApexAction href="/apex/war-room">War Room</ApexAction>
            </ApexActionGroup>
          }
          aside={
            <>
              <ApexStatusPill tone="warn">PAPER · DEMO STATE</ApexStatusPill>
              <div style={{ marginTop: 16, fontSize: 12, lineHeight: 1.6 }}>
                Status strip is <strong>live-driven</strong> from mocked state —
                change <code>MOCK_STATE.totalPnl</code> in
                <code style={{ marginLeft: 4 }}>page.tsx</code> to verify the
                color thresholds animate (green ≤50% DD / yellow ≤80% / red
                &gt;80%).
              </div>
            </>
          }
        />

        {/* Cockpit status strip — verbatim from Apex's top header. */}
        <section
          style={{
            background: "#08131f",
            border: "1px solid #123046",
            borderRadius: 4,
            padding: "10px 14px",
            display: "flex",
            gap: 18,
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          <div style={{ display: "grid", gap: 2 }}>
            <div style={{ color: "#4FC3F7", fontSize: 9, letterSpacing: 2 }}>
              COCKPIT STATUS
            </div>
            <div style={{ color: "#F5F7FA", fontSize: 13, fontWeight: 700 }}>
              {MOCK_STATE.trades.filter((t) => t.status === "OPEN").length} open
              · {MOCK_STATE.trades.length} today
            </div>
          </div>
          <div
            style={{ width: 1, height: 36, background: "#123046" }}
            aria-hidden
          />
          <IntradayPnL totalPnl={MOCK_STATE.totalPnl} />
          <div
            style={{ width: 1, height: 36, background: "#123046" }}
            aria-hidden
          />
          <RiskBudget
            trades={MOCK_STATE.trades}
            totalPnl={MOCK_STATE.totalPnl}
            rec={MOCK_STATE.rec}
            credit={MOCK_STATE.credit}
          />
        </section>

        {/* Tab navigation. */}
        <nav
          aria-label="Cockpit tabs"
          style={{
            display: "flex",
            gap: 4,
            flexWrap: "wrap",
            borderBottom: "1px solid #123046",
            paddingBottom: 8,
          }}
        >
          {TABS.map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              aria-current={activeTab === tab ? "page" : undefined}
              style={{
                border: "1px solid",
                borderColor: activeTab === tab ? "#4FC3F7" : "#1d425c",
                background:
                  activeTab === tab ? "rgba(79,195,247,0.08)" : "transparent",
                color: activeTab === tab ? "#4FC3F7" : "#9ecae1",
                padding: "6px 10px",
                fontSize: 10,
                letterSpacing: 1.2,
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              {tab}
            </button>
          ))}
        </nav>

        <ApexSection
          eyebrow={`COCKPIT · ${activeTab}`}
          title={`${activeTab} panel`}
          copy={TAB_DESCRIPTIONS[activeTab]}
        >
          <ApexEmptyState>
            Phase 6 ports this tab&apos;s content — the original{" "}
            <code>{activeTab}</code> panel composes against the Apex Zustand
            store (regime, debtPhase, vix, sentiment, newsScore, credit, etc.)
            and the live broker-feed hooks. The visual shell is preserved here;
            the live composition arrives with the Phase 6 API handler + state
            store port.
          </ApexEmptyState>
        </ApexSection>
      </main>
    </ApexPageShell>
  );
}
