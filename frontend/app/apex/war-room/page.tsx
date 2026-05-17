"use client";

// /apex/war-room — Phase 5d (war-room lobby with mocked session list, 2026-05-17).
//
// Fourth of four flagship-route ports under Phase 5. The original
// apex/app/war-room/page.tsx (503 lines) is the heaviest of the
// flagship surfaces — it depends on:
//   - 4 heavy panel components (BetweenSessionContinuityCard,
//     OvernightOperationsPanel, RuntimeHealthStrip, ShiftStartConsole)
//   - 5 hooks (useOperatorHub, useRuntimeSafety, useShiftStart,
//     useApexStore, useWarRoomOperator)
//   - Live API calls to /api/war-room/sessions
//   - A React Error Boundary for panel-level degradation
//
// Phase 5d ports the *visual identity* of the lobby:
//   - ApexHero with operator MetricStrip (mocked operator identity)
//   - ApexRouteGrid (hub/research/journal navigation)
//   - ApexStatePanel collaboration-state callout
//   - Create-session form (disabled, "READ-ONLY DEMO" label)
//   - Active-sessions list with 3 mocked WarRoomSessionSummary entries
//     spanning the continuity-state rainbow (active_driver / observer_only
//     / driver_stale_resume_required)
//   - ApexEmptyState placeholders for the 4 heavy panels (Phase 6 ports
//     each alongside their backing API handlers)
//
// "Preserve original form" — Apex's lobby copy + eyebrow + hero
// title are preserved verbatim. The route nav points at /apex/* paths
// per the absorption directive. The error-boundary recovery view
// (used when one panel fails) is omitted from this static port —
// the Phase 6 wiring will reintroduce it alongside live panels that
// could actually fail.

import { useState } from "react";
import {
  ApexAction,
  ApexActionGroup,
  ApexEmptyState,
  ApexHero,
  ApexMetricStrip,
  ApexPageShell,
  ApexRouteGrid,
  ApexSection,
  ApexStatePanel,
  ApexStatusPill,
} from "@/components/apex/apex-demo-ui";
import type {
  DemoOperator,
  WarRoomSessionSummary,
} from "@/lib/apex/war-room-contracts";

function formatAge(value: string) {
  const deltaMs = Date.now() - new Date(value).getTime();
  if (!Number.isFinite(deltaMs) || deltaMs < 0) return "just now";
  const minutes = Math.floor(deltaMs / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

// Mocked operator — in apex this comes from useWarRoomOperator()
// against the workspace + session store. The role is "owner" so
// the hero shows "Driver controls available".
const MOCK_OPERATOR: DemoOperator = {
  userId: "demo-operator",
  displayName: "Demo Operator",
  role: "owner",
  terminalId: "t-demo-001",
  terminalLabel: "T-DEMO-01",
};

// Three mocked sessions spanning the continuity-state rainbow.
// Realistic pair / route / lock owner / stale-since values so the
// list renders the full color-coded surface.
const MOCK_SESSIONS: WarRoomSessionSummary[] = [
  {
    sessionId: "wr-001",
    name: "EUR/USD London Open Coordination",
    status: "active",
    activePair: "EUR/USD",
    activeRoute: "command",
    openTradeCount: 2,
    lockState: "held",
    lockOwnerDisplayName: "Demo Operator",
    lockTerminalLabel: "T-DEMO-01",
    driverTerminalId: "t-demo-001",
    continuityState: "active_driver",
    staleSince: null,
    resumeAllowed: true,
    resumeReason: null,
    recommendedAction: "continue",
    lastActivityAt: new Date(Date.now() - 4 * 60_000).toISOString(),
    updatedAt: new Date(Date.now() - 4 * 60_000).toISOString(),
  },
  {
    sessionId: "wr-002",
    name: "GBP/JPY US-close Risk Review",
    status: "active",
    activePair: "GBP/JPY",
    activeRoute: "execute",
    openTradeCount: 1,
    lockState: "held",
    lockOwnerDisplayName: "Other Operator",
    lockTerminalLabel: "T-OPS-02",
    driverTerminalId: "t-ops-002",
    continuityState: "observer_only",
    staleSince: null,
    resumeAllowed: false,
    resumeReason: "another_driver_active",
    recommendedAction: "observe",
    lastActivityAt: new Date(Date.now() - 18 * 60_000).toISOString(),
    updatedAt: new Date(Date.now() - 18 * 60_000).toISOString(),
  },
  {
    sessionId: "wr-003",
    name: "AUD/USD APAC Handoff (stale)",
    status: "active",
    activePair: "AUD/USD",
    activeRoute: "command",
    openTradeCount: 0,
    lockState: "stale",
    lockOwnerDisplayName: "Overnight Operator",
    lockTerminalLabel: "T-APAC-03",
    driverTerminalId: "t-apac-003",
    continuityState: "driver_stale_resume_required",
    staleSince: new Date(Date.now() - 42 * 60_000).toISOString(),
    resumeAllowed: true,
    resumeReason: "stale_lock_takeover_permitted",
    recommendedAction: "resume",
    lastActivityAt: new Date(Date.now() - 42 * 60_000).toISOString(),
    updatedAt: new Date(Date.now() - 42 * 60_000).toISOString(),
  },
];

function continuityTone(state: WarRoomSessionSummary["continuityState"]) {
  if (state === "active_driver") return "#00FFB2";
  if (state === "observer_only") return "#4FC3F7";
  if (state === "resume_in_progress") return "#FFD166";
  return "#FF8A80";
}

function SessionRow({ session }: { session: WarRoomSessionSummary }) {
  const tone = continuityTone(session.continuityState);
  return (
    <div
      key={session.sessionId}
      style={{
        background: "#06101a",
        border: "1px solid #0a1e2e",
        borderRadius: 4,
        padding: 12,
        display: "grid",
        gap: 8,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
        <div style={{ color: "#F5F7FA", fontSize: 13, fontWeight: 700 }}>
          {session.name}
        </div>
        <div
          style={{
            color: tone,
            fontSize: 10,
            letterSpacing: 1.2,
            fontWeight: 700,
          }}
        >
          {session.continuityState.replaceAll("_", " ").toUpperCase()}
        </div>
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: 8,
          fontSize: 11,
          color: "#c8dff0",
        }}
      >
        <div>
          <div style={{ color: "#4FC3F7", fontSize: 9, letterSpacing: 1 }}>
            PAIR
          </div>
          <div>{session.activePair}</div>
        </div>
        <div>
          <div style={{ color: "#4FC3F7", fontSize: 9, letterSpacing: 1 }}>
            ROUTE
          </div>
          <div style={{ textTransform: "uppercase" }}>
            {session.activeRoute}
          </div>
        </div>
        <div>
          <div style={{ color: "#4FC3F7", fontSize: 9, letterSpacing: 1 }}>
            OPEN TRADES
          </div>
          <div>{session.openTradeCount}</div>
        </div>
        <div>
          <div style={{ color: "#4FC3F7", fontSize: 9, letterSpacing: 1 }}>
            LAST ACTIVITY
          </div>
          <div>{formatAge(session.lastActivityAt)}</div>
        </div>
      </div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          fontSize: 11,
          color: "#9ecae1",
        }}
      >
        <div>
          Driver: <strong>{session.lockOwnerDisplayName}</strong> ·{" "}
          {session.lockTerminalLabel}
          {session.staleSince
            ? ` · stale since ${formatAge(session.staleSince)}`
            : ""}
        </div>
        <button
          type="button"
          disabled
          style={{
            border: `1px solid ${session.resumeAllowed ? "#00FFB240" : "#1d425c"}`,
            background: session.resumeAllowed
              ? "rgba(0,255,178,0.06)"
              : "transparent",
            color: session.resumeAllowed ? "#00FFB2" : "#7aa6c2",
            padding: "4px 10px",
            cursor: "not-allowed",
            fontSize: 10,
            letterSpacing: 1,
          }}
        >
          {session.recommendedAction.toUpperCase()} · DEMO
        </button>
      </div>
    </div>
  );
}

export default function ApexWarRoomPage() {
  const [name, setName] = useState("APEX War Room");

  const canCreate = MOCK_OPERATOR.role !== "viewer";
  const canResume = MOCK_SESSIONS.some((s) => s.resumeAllowed);

  return (
    <ApexPageShell active="/apex/war-room" maxWidth={1180}>
      <div
        data-testid="war-room-lobby-root"
        style={{ color: "#c8dff0", display: "grid", gap: 16 }}
      >
        <ApexHero
          eyebrow="War room"
          title="Driver / observer roles stay clear before shared execution."
          copy="Use this lobby when the hub recommends collaboration, stale ownership recovery, or explicit handoff. APEX separates driver authority from observer context so shared control stays auditable."
          actions={
            <ApexActionGroup>
              <ApexAction href="/apex/hub">Open Hub</ApexAction>
              <ApexAction href="/apex/cockpit" tone="success">
                Open Cockpit
              </ApexAction>
            </ApexActionGroup>
          }
          aside={
            <>
              <ApexStatusPill
                tone={canCreate && canResume ? "success" : "warn"}
              >
                {canCreate && canResume
                  ? "Driver controls available"
                  : "Protected read-only posture"}
              </ApexStatusPill>
              <ApexMetricStrip
                metrics={[
                  {
                    label: "Operator",
                    value: MOCK_OPERATOR.displayName,
                    detail: MOCK_OPERATOR.role,
                  },
                  {
                    label: "Terminal",
                    value: MOCK_OPERATOR.terminalLabel,
                    detail: MOCK_OPERATOR.terminalId,
                  },
                  {
                    label: "Next safe surface",
                    value: "Hub",
                    detail:
                      "Hub remains canonical when collaboration pressure is low.",
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
              status: "Hub-first posture",
              title: "Return to hub",
              summary:
                "Use the hub to confirm route health, paper proof, and whether shared control is still the right next action.",
              action: "Open hub",
              tone: "success",
            },
            {
              href: "/apex/research",
              eyebrow: "Paper proof",
              status: "Research context",
              title: "Open research",
              summary:
                "Review ranked evidence before escalating shared execution context.",
              action: "Open research",
            },
            {
              href: "/apex/journal",
              eyebrow: "Guarded live readiness",
              status: "Learning loop",
              title: "Open journal",
              summary:
                "Check prior outcomes and operator notes before a handoff becomes action.",
              action: "Open journal",
              tone: "warn",
            },
          ]}
        />

        <ApexSection
          eyebrow="HEAVY PANELS · PHASE 6"
          title="Runtime, overnight, shift-start panels"
          copy={
            <>
              The original lobby renders <code>RuntimeHealthStrip</code>,{" "}
              <code>OvernightOperationsPanel</code>, and{" "}
              <code>ShiftStartConsole</code> here. Each pulls from a different
              hook (<code>useRuntimeSafety</code>, internal state, and{" "}
              <code>useShiftStart</code>) that depends on the Apex Zustand store
              + API surface. Phase 6 ports each alongside the matching API
              handler.
            </>
          }
        >
          <ApexEmptyState>
            Phase 6 ports RuntimeHealthStrip + OvernightOperationsPanel +
            ShiftStartConsole + BetweenSessionContinuityCard, each behind their
            respective hooks. Until then, this section is a visual placeholder
            so the lobby&apos;s flow remains intelligible.
          </ApexEmptyState>
        </ApexSection>

        <ApexStatePanel
          eyebrow="Collaboration degraded"
          title="Shared control stays auditable even when an upper panel recovers."
          copy="Create-session, continuity, and active-session controls remain visible so the lobby is understandable during partial failures."
          tone={canCreate && canResume ? "success" : "warn"}
        />

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
            gap: 18,
          }}
        >
          {/* Create-session card. */}
          <div
            style={{
              background: "#06101a",
              border: "1px solid #0a1e2e",
              borderRadius: 4,
              padding: 16,
            }}
          >
            <div
              style={{
                fontSize: 9,
                color: "#FFD166",
                marginBottom: 10,
                letterSpacing: 2,
              }}
            >
              CREATE SESSION
            </div>
            <div style={{ fontSize: 8, color: "#1a3040", marginBottom: 4 }}>
              SESSION NAME
            </div>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              style={{
                width: "100%",
                marginBottom: 12,
                background: "#050b12",
                border: "1px solid #16384f",
                color: "#d8ecfa",
                padding: "8px 10px",
              }}
            />
            <div style={{ fontSize: 8, color: "#1a3040", marginBottom: 12 }}>
              Operator: {MOCK_OPERATOR.displayName} · {MOCK_OPERATOR.role}
            </div>
            <button
              type="button"
              disabled
              style={{
                width: "100%",
                border: "1px solid #1d425c",
                background: "rgba(122,166,194,0.06)",
                color: "#7aa6c2",
                padding: "10px 12px",
                cursor: "not-allowed",
                fontWeight: 700,
                fontSize: 11,
                letterSpacing: 1.2,
              }}
            >
              CREATE SESSION · READ-ONLY DEMO
            </button>
          </div>

          {/* Active sessions card. */}
          <div
            style={{
              background: "#06101a",
              border: "1px solid #0a1e2e",
              borderRadius: 4,
              padding: 16,
              display: "grid",
              gap: 10,
            }}
          >
            <div
              style={{
                fontSize: 9,
                color: "#4FC3F7",
                letterSpacing: 2,
                marginBottom: 4,
              }}
            >
              ACTIVE SESSIONS · {MOCK_SESSIONS.length}
            </div>
            {MOCK_SESSIONS.map((session) => (
              <SessionRow key={session.sessionId} session={session} />
            ))}
          </div>
        </div>
      </div>
    </ApexPageShell>
  );
}
