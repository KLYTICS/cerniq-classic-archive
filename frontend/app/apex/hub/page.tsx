// /apex/hub — Phase 2 (2026-05-16).
//
// Apex's original /hub route is the "operator first-paint" view: one
// dense panel that condenses MODE/RUNTIME state, proof posture, broker
// readiness, and collaboration urgency into a single Bloomberg-density
// snapshot. Operators land here before any decisive trading surface
// (cockpit, war-room, journal) so they always have one coherent read
// on "where the desk stands right now."
//
// Phase 2 wires the OperatorHubSummary view against a *mocked*
// OperatorHubFirstPaintSummary. The shape is byte-equivalent to the
// production contract — Phase 3 will swap the mocked snapshot for a
// real Supabase-backed fetch under APEX_SUPABASE_URL / _ANON_KEY.
//
// The auxiliary ApexRouteGrid below previews the absorbed sub-surfaces
// (cockpit / war-room / journal / sovereign / research / platform /
// community). Each card currently routes to a Phase 5 placeholder; the
// `data-tone` per card reflects the current operator posture from the
// mocked snapshot so this page renders as a complete operator surface
// even without live data.

import {
  ApexPageShell,
  ApexHero,
  ApexActionGroup,
  ApexAction,
  ApexStatusPill,
  ApexSection,
  ApexRouteGrid,
  ApexEmptyState,
} from "@/components/apex/apex-demo-ui";
import { OperatorHubSummary } from "@/components/apex/operator-hub-summary";
import type { OperatorHubFirstPaintSummary } from "@/lib/apex/operator-hub-contracts";

// Phase 2 mocked first-paint snapshot. This payload is shaped exactly
// like a production OperatorHubFirstPaintSummary — the same fields the
// real Apex /hub returns. Tones are tuned to demonstrate the full
// rainbow of states (healthy / watch / action_required) so designers
// reviewing the absorbed surface see every variant render.
const MOCK_HUB_SNAPSHOT: OperatorHubFirstPaintSummary = {
  hero: {
    title: "One PAPER-simulation view for action, proof, and continuity.",
    summary:
      "Operator hub coalesces shift readiness, proof-of-wedge evidence, broker-truth health, and continuity into one decisive read. Embedded inside cerniq under /apex/* — preserved in original form.",
    badges: [
      { label: "MODE PAPER", tone: "healthy" },
      { label: "RUNTIME READY", tone: "healthy" },
      { label: "EMBEDDED · CERNIQ", tone: "watch" },
    ],
  },
  topBlocker: null,
  nextAction: {
    label: "NEXT DECISIVE ACTION",
    title: "OPEN COCKPIT",
    detail:
      "Shift readiness is clean; broker truth coverage is at 0.97. Enter the cockpit to walk the morning paper-trade checklist before market open.",
    targetSurface: "cockpit",
    tone: "healthy",
  },
  proof: {
    label: "IS THE WEDGE PROVING?",
    title: "PAPER proof is compounding.",
    detail:
      "27 closed paper trades over the last 14 sessions. Promotion evidence is one block away from passing the readiness decision gate.",
    tone: "healthy",
    badge: "tracking",
    metrics: [
      { label: "Paper trades", value: "184", tone: "healthy" },
      { label: "Closed trades", value: "27", tone: "healthy" },
      { label: "Review coverage", value: "100%", tone: "healthy" },
      { label: "Avg evidence age", value: "2h 14m", tone: "watch" },
    ],
  },
  liveReadiness: {
    label: "BROADER LIVE PATH",
    title: "LIVE readiness is gated on broker-truth.",
    detail:
      "Release governance is green. Broker truth coverage rate is 0.97; reject rate is 0.011. One residual capsule check before the operator can request promotion approval.",
    tone: "watch",
    badge: "monitor",
    metrics: [
      { label: "Release", value: "STABLE", tone: "healthy" },
      { label: "Broker truth", value: "0.97 / 0.011", tone: "healthy" },
      { label: "Capsule", value: "1 pending", tone: "watch" },
      { label: "Admissibility", value: "Holding", tone: "watch" },
    ],
  },
  collaboration: {
    label: "COLLABORATION URGENCY",
    title: "Continuity is healthy — no takeover required.",
    detail:
      "Three terminals are live, all heartbeats are within the last 30 seconds. Two stale claims are at the warn threshold but have not crossed the takeover line.",
    tone: "healthy",
    metrics: [
      { label: "Active terminals", value: "3 / 4", tone: "healthy" },
      { label: "Takeover required", value: "0", tone: "healthy" },
      { label: "Stale claims", value: "2", tone: "watch" },
      { label: "Active sessions", value: "5", tone: "healthy" },
    ],
  },
  provingWedge: null,
};

// The seven absorbed sub-surfaces from Apex's top-nav, with their
// Phase-5 destinations. Tones reflect the same posture the mocked
// snapshot conveys: cockpit is the recommended next action, journal
// has an open evidence loop, war-room is being warmed for the live
// path, research is steady, etc.
const ABSORBED_ROUTES = [
  {
    href: "/apex/cockpit",
    eyebrow: "DECISIVE",
    title: "Cockpit",
    summary:
      "Pre-market checklist + intraday paper-execution loop. The recommended next action surfaces here.",
    action: "Open cockpit",
    tone: "success" as const,
    status: "READY",
  },
  {
    href: "/apex/war-room",
    eyebrow: "LIVE-PATH",
    title: "War Room",
    summary:
      "Live session orchestration with broker-truth sentinels and capsule-state monitors.",
    action: "Enter war room",
    tone: "warn" as const,
    status: "WARMING",
  },
  {
    href: "/apex/journal",
    eyebrow: "PROOF",
    title: "Journal",
    summary:
      "Trade journal + promotion evidence. One review loop is open and gates promotion-ready status.",
    action: "Review journal",
    tone: "warn" as const,
    status: "1 OPEN",
  },
  {
    href: "/apex/sovereign",
    eyebrow: "GOVERNANCE",
    title: "Sovereign",
    summary:
      "Release governance, capsule admissibility, and operator-level approvals. Sovereign-role-gated.",
    action: "Sovereign console",
    tone: "default" as const,
    status: "GATED",
  },
  {
    href: "/apex/research",
    eyebrow: "EVIDENCE",
    title: "Research",
    summary:
      "Research notes, market hypotheses, and FX regime analyses feeding paper-trade decisions.",
    action: "Open research",
    tone: "default" as const,
  },
  {
    href: "/apex/platform",
    eyebrow: "RUNTIME",
    title: "Platform",
    summary:
      "Runtime + infrastructure surface — telemetry, deploy state, broker connectivity health.",
    action: "Platform health",
    tone: "default" as const,
  },
  {
    href: "/apex/community",
    eyebrow: "CONTINUITY",
    title: "Community",
    summary:
      "Operator continuity threads, shift-handoff notes, and inbound coordination across desks.",
    action: "Community feed",
    tone: "default" as const,
  },
];

export default function ApexHubPage() {
  return (
    <ApexPageShell active="/apex/hub" maxWidth={1200}>
      <ApexHero
        eyebrow="APEX · OPERATOR HUB · PHASE 2"
        title="Operator Hub"
        copy={
          <>
            The decisive first-paint view for paper-simulation operators.
            Renders against mocked data in Phase 2 — Phase 3 will wire the Apex
            Supabase data layer behind the same first-paint shape.
          </>
        }
        actions={
          <ApexActionGroup>
            <ApexAction href="/apex/cockpit" tone="success">
              Open Cockpit
            </ApexAction>
            <ApexAction href="/apex/journal">Trade Journal</ApexAction>
            <ApexAction href="/apex">Back to Start</ApexAction>
          </ApexActionGroup>
        }
        aside={
          <>
            <div className="apex-eyebrow">DATA SOURCE</div>
            <div style={{ marginTop: 8 }}>
              <ApexStatusPill tone="warn">MOCKED · PHASE 2</ApexStatusPill>
            </div>
            <div style={{ marginTop: 16, fontSize: 12, lineHeight: 1.6 }}>
              Snapshot shape matches{" "}
              <strong>OperatorHubFirstPaintSummary</strong> exactly. Phase 3
              swaps the static payload for a Supabase fetch under
              <code style={{ marginLeft: 4 }}>APEX_SUPABASE_URL</code>; the view
              layer requires zero changes.
            </div>
          </>
        }
      />

      <OperatorHubSummary firstPaint={MOCK_HUB_SNAPSHOT} />

      <ApexSection
        eyebrow="ABSORBED SUB-SURFACES"
        title="Seven decisive surfaces"
        copy={
          <>
            Each Apex top-nav surface is preserved under <code>/apex/*</code>{" "}
            inside cerniq. Phase 5 ports the flagship pages (cockpit, war-room,
            sovereign, journal) one per commit; the remaining three (platform,
            research, community) follow.
          </>
        }
      >
        <ApexRouteGrid routes={ABSORBED_ROUTES} />
      </ApexSection>

      <ApexSection
        eyebrow="PHASE 2 NOTE"
        title="What still uses Phase 1 surface"
        copy={
          <>
            The other six absorbed routes (cockpit, war-room, journal,
            sovereign, research, platform, community) render the Phase 1
            scaffold until Phase 5 lands.
          </>
        }
      >
        <ApexEmptyState>
          Phase 5 will port the original `/cockpit/page.tsx`,
          `/war-room/[sessionId]/page.tsx`, `/sovereign/page.tsx`, and
          `/journal/page.tsx` views — preserving their original form per the
          absorption directive.
        </ApexEmptyState>
      </ApexSection>
    </ApexPageShell>
  );
}
