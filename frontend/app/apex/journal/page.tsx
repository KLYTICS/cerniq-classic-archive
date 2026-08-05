// /apex/journal — Phase 5a (display-only trade journal port, 2026-05-16).
//
// First of four flagship-route ports under Phase 5. Mirrors apex's
// own `/journal/page.tsx` layout — ApexPageShell + ApexHero +
// ApexMetricStrip + ApexRouteGrid + TradeJournalPanel — preserving
// the original visual surface verbatim. The route nav points at the
// absorbed /apex/* paths instead of Apex's root paths.
//
// Phase 5a renders against mocked TradeJournalRecord data. Phase 6
// will swap MOCK_RECORDS for live data via useTradeJournal() once
// the data-hook is implemented against the Phase 3 coexistence path.
//
// "Preserve original form" — same eyebrow ("Journal"), same hero
// title and copy, same status pill ("Review trail visible"), same
// MetricStrip metric labels ("What", "Why"). The only adjustments
// vs. the original are: (a) navigation targets are /apex/hub etc.
// instead of /hub; (b) the TradeJournalPanel is the display-only
// variant from Phase 5 (no review save, no API refresh).

"use client";

import {
  ApexAction,
  ApexActionGroup,
  ApexHero,
  ApexMetricStrip,
  ApexPageShell,
  ApexRouteGrid,
  ApexStatusPill,
} from "@/components/apex/apex-demo-ui";
import { TradeJournalPanel } from "@/components/apex/trade-journal-panel";
import type {
  TradeJournalRecord,
  TradeJournalSummary,
} from "@/lib/apex/trade-journal-contracts";

// Six mocked journal records spanning the outcome rainbow:
// closed_win / closed_loss / executed / blocked / suppressed.
// Tones, review states, and thesis chains are chosen to demonstrate
// every color-coded state the panel renders.
const MOCK_RECORDS: TradeJournalRecord[] = [
  {
    journalId: "j-2026-05-15-eurusd-001",
    pair: "EUR/USD",
    direction: "LONG",
    outcome: "closed_win",
    createdAt: "2026-05-15 14:32",
    thesis: {
      headline: "EUR/USD long on ECB-Fed divergence + NY-session momentum",
      chain: [
        "Macro: ECB hawkish hold vs. Fed dovish tilt opens divergence trade",
        "Edge profile: NY-session range expansion bias on EUR pairs",
        "Allocator: 1.2% risk, 35bp stop, 90bp target",
        "Eligibility: clean release-state, fresh broker-truth, no capsule blockers",
      ],
      allocatorSummary:
        "Bayesian sizing on 14-day EUR/USD vol regime; size capped at 1.2%.",
      executionSummary:
        "Filled 1.0860, 35bp stop 1.0825, 90bp target hit at 1.0935. +90bp realized.",
    },
    realizedOutcome: {
      realizedPnl: "+90bp",
      closedAt: "2026-05-15 21:14",
    },
    review: {
      reviewState: "promoted_learning",
      notes: [
        {
          noteId: "n-001",
          reviewState: "reviewed",
          note: "Operator: confirmed thesis chain held; tight stop didn't trip on US PMI release.",
          createdAt: "2026-05-15 21:38",
        },
        {
          noteId: "n-002",
          reviewState: "promoted_learning",
          note: "Promote: ECB-Fed divergence pattern flagged for edge-profile update.",
          createdAt: "2026-05-15 21:42",
        },
      ],
    },
  },
  {
    journalId: "j-2026-05-15-gbpjpy-002",
    pair: "GBP/JPY",
    direction: "SHORT",
    outcome: "closed_loss",
    createdAt: "2026-05-15 09:18",
    thesis: {
      headline: "GBP/JPY short on UK CPI miss + risk-off pivot",
      chain: [
        "Macro: UK CPI 3.1% (vs. 3.3% expected) — disinflation accelerating",
        "Edge profile: London-open mean-reversion on JPY-cross overextension",
        "Allocator: 0.8% risk, 45bp stop, 110bp target",
      ],
      allocatorSummary:
        "Reduced size — overlapping JPY exposure with USD/JPY paper position.",
      executionSummary:
        "Filled 191.42, stopped at 191.87. -45bp realized; risk-off pivot never materialized.",
    },
    realizedOutcome: {
      realizedPnl: "-45bp",
      closedAt: "2026-05-15 11:24",
    },
    review: {
      reviewState: "thesis_rejected",
      notes: [
        {
          noteId: "n-003",
          reviewState: "thesis_rejected",
          note: "Thesis invalidated by BoE dovish-but-firm tone at 11:00 LDN press.",
          createdAt: "2026-05-15 11:38",
        },
      ],
    },
  },
  {
    journalId: "j-2026-05-15-audusd-003",
    pair: "AUD/USD",
    direction: "LONG",
    outcome: "executed",
    createdAt: "2026-05-15 16:02",
    thesis: {
      headline: "AUD/USD long on copper breakout + risk-on rotation",
      chain: [
        "Macro: copper breaking 5-week range, China stimulus rumors",
        "Edge profile: AUD-commodity correlation strong in last 30d window",
        "Allocator: 1.0% risk, 30bp stop, 75bp target",
      ],
      allocatorSummary:
        "Standard sizing — no overlap with other commodity longs.",
      executionSummary: "Filled 0.6712 at 16:04; position open.",
    },
    realizedOutcome: { realizedPnl: null, closedAt: null },
    review: {
      reviewState: "unreviewed",
      notes: [],
    },
  },
  {
    journalId: "j-2026-05-15-usdcad-004",
    pair: "USD/CAD",
    direction: "LONG",
    outcome: "blocked",
    createdAt: "2026-05-15 13:45",
    thesis: {
      headline: "USD/CAD long on oil weakness — BLOCKED by exposure cap",
      chain: [
        "Macro: WTI -2.1% on inventory build",
        "Edge profile: CAD-oil correlation softened in regime change",
        "Eligibility: BLOCKED — already at 2.8% net USD long exposure",
      ],
      allocatorSummary:
        "Would have been 0.9% risk; blocked by 3.0% USD exposure ceiling.",
      executionSummary: "Order not placed. Block reason: exposure_cap.",
    },
    realizedOutcome: {
      realizedPnl: null,
      closedAt: null,
    },
    review: {
      reviewState: "action_required",
      notes: [
        {
          noteId: "n-004",
          reviewState: "action_required",
          note: "Review exposure cap: regime change may warrant lifting USD ceiling.",
          createdAt: "2026-05-15 13:52",
        },
      ],
    },
  },
  {
    journalId: "j-2026-05-15-nzdusd-005",
    pair: "NZD/USD",
    direction: "SHORT",
    outcome: "suppressed",
    createdAt: "2026-05-15 10:11",
    thesis: {
      headline:
        "NZD/USD short on dairy auction miss — SUPPRESSED by broker-truth gap",
      chain: [
        "Macro: Fonterra GDT -3.4% (vs. flat expected)",
        "Edge profile: NZD-dairy reaction window 2-4 hours",
        "Suppressed: broker-truth coverage at 0.84 (below 0.90 threshold)",
      ],
      allocatorSummary: "Would have been 1.1% risk.",
      executionSummary:
        "Suppressed by broker-truth quality gate. No execution attempted.",
    },
    realizedOutcome: { realizedPnl: null, closedAt: null },
    review: {
      reviewState: "execution_anomaly",
      notes: [
        {
          noteId: "n-005",
          reviewState: "execution_anomaly",
          note: "Broker-truth gap during AU-session; investigate provider failover.",
          createdAt: "2026-05-15 10:20",
        },
      ],
    },
  },
  {
    journalId: "j-2026-05-14-eurchf-006",
    pair: "EUR/CHF",
    direction: "LONG",
    outcome: "closed_win",
    createdAt: "2026-05-14 11:23",
    thesis: {
      headline: "EUR/CHF long on SNB dovish-on-floor + EUR strength",
      chain: [
        "Macro: SNB chairman hints at floor defense",
        "Edge profile: EUR/CHF mean-reverts in low-vol regime",
        "Allocator: 0.7% risk, 25bp stop, 60bp target",
      ],
      allocatorSummary: "Conservative sizing — low-vol pair, tight stop.",
      executionSummary: "Filled 0.9682, target hit at 0.9742. +60bp realized.",
    },
    realizedOutcome: {
      realizedPnl: "+60bp",
      closedAt: "2026-05-14 18:55",
    },
    review: {
      reviewState: "thesis_confirmed",
      notes: [
        {
          noteId: "n-006",
          reviewState: "thesis_confirmed",
          note: "Confirmed — SNB intervention rumors materialized into floor commentary.",
          createdAt: "2026-05-14 19:02",
        },
      ],
    },
  },
];

const MOCK_SUMMARY: TradeJournalSummary = {
  unreviewedCount: 1,
  latestExecuted: MOCK_RECORDS[0]!,
  latestBlockedOrSuppressed: MOCK_RECORDS[3]!,
};

export default function ApexJournalPage() {
  return (
    <ApexPageShell active="/apex/journal" maxWidth={1200}>
      <main style={{ display: "grid", gap: 16 }}>
        <ApexHero
          eyebrow="Journal"
          title="Turn paper trades into buyer-visible learning."
          copy="The journal explains what the desk tried, what happened, and which lessons become future operating memory. It is the audit-friendly learning loop behind the APEX story."
          actions={
            <ApexActionGroup>
              <ApexAction href="/apex/hub" tone="success">
                Back to Hub
              </ApexAction>
              <ApexAction href="/apex/cockpit">Open Cockpit</ApexAction>
              <ApexAction href="/apex/research">Research</ApexAction>
            </ApexActionGroup>
          }
          aside={
            <>
              <ApexStatusPill tone="success">
                Review trail visible
              </ApexStatusPill>
              <ApexMetricStrip
                metrics={[
                  {
                    label: "What",
                    value: "Trade memory",
                    detail: "Executed, blocked, and suppressed decisions.",
                  },
                  {
                    label: "Why",
                    value: "Learning loop",
                    detail:
                      "Turns paper outcomes into future operating memory.",
                  },
                ]}
              />
            </>
          }
        />
        <ApexRouteGrid
          routes={[
            {
              href: "/apex/hub",
              eyebrow: "Recommended next surface",
              status: "Paper proof",
              title: "Return to hub",
              summary:
                "Review the recommended next surface after inspecting learning history.",
              action: "Open hub",
              tone: "success",
            },
            {
              href: "/apex/research",
              eyebrow: "Paper proof",
              status: "Research wedge",
              title: "Inspect research",
              summary:
                "Compare journal outcomes with current ranked opportunity evidence.",
              action: "Open research",
            },
            {
              href: "/apex/war-room",
              eyebrow: "Collaboration degraded",
              status: "Guarded handoff",
              title: "Escalate collaboration",
              summary:
                "Open shared control only when the learning thread needs a handoff.",
              action: "Open war room",
              tone: "warn",
            },
          ]}
        />
        <TradeJournalPanel records={MOCK_RECORDS} summary={MOCK_SUMMARY} />
      </main>
    </ApexPageShell>
  );
}
