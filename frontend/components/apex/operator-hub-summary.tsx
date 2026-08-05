"use client";

// Apex absorption — Phase 2 OperatorHubSummary view (2026-05-16).
//
// Verbatim port of `apex/components/operator-hub-summary-view.tsx`
// per the directive "fully swallow apex functionalities and preserve
// original form". The only adjustments are:
//   1. Contract type import points at `@/lib/apex/operator-hub-contracts`
//      (the Phase 2 shim) instead of Apex's deep contracts.ts +
//      simulation-hub.ts pair.
//   2. SimulationHubTone is re-imported from the same shim file
//      rather than `@/lib/simulation-hub`.
//
// The component itself is byte-equivalent: same hyperscript pattern,
// same hardcoded color constants (BORDER #123046, PANEL #07111b, etc.),
// same `data-testid` selectors so any future test imports from the
// Apex tree continue to find their hooks.
//
// Phase 3 will replace the local contract shim with the full Apex
// contracts graph; this file does not need to change at that point.

import { createElement as h } from "react";
import type {
  OperatorHubFirstPaintMetric,
  OperatorHubFirstPaintSummary,
  SimulationHubTone,
} from "@/lib/apex/operator-hub-contracts";

const BORDER = "#123046";
const PANEL = "#07111b";
const TEXT = "#d7e9f7";
const MUTED = "#7aa6c2";
const LABEL = "#4FC3F7";
const SUCCESS = "#00FFB2";
const WARN = "#FFD166";
const ACTION = "#F7B267";
const CRITICAL = "#FF8A80";

function toneColor(tone: SimulationHubTone) {
  if (tone === "critical") return CRITICAL;
  if (tone === "action_required") return ACTION;
  if (tone === "watch") return WARN;
  return SUCCESS;
}

function renderMetric(metric: OperatorHubFirstPaintMetric) {
  return h(
    "div",
    {
      key: metric.label,
      style: {
        border: `1px solid ${BORDER}`,
        borderRadius: 4,
        padding: 8,
        background: "#08131f",
      },
    },
    h(
      "div",
      { style: { color: LABEL, fontSize: 9, letterSpacing: 1 } },
      metric.label.toUpperCase(),
    ),
    h(
      "div",
      {
        style: {
          marginTop: 4,
          color: toneColor(metric.tone),
          fontSize: 15,
          fontWeight: 700,
        },
      },
      metric.value,
    ),
  );
}

function fallbackSummary(
  error: string | null | undefined,
): OperatorHubFirstPaintSummary {
  return {
    hero: {
      title: "One PAPER-simulation view for action, proof, and continuity.",
      summary: error
        ? `The hub summary is degraded right now: ${error}.`
        : "The hub summary is syncing operator proof, continuity, and desk guidance.",
      badges: [
        { label: "MODE PAPER", tone: "healthy" },
        { label: "RUNTIME SYNCING", tone: error ? "action_required" : "watch" },
      ],
    },
    topBlocker: error
      ? {
          title: "Hub first-paint data is degraded.",
          detail: error,
          tone: "action_required",
        }
      : null,
    nextAction: {
      label: "NEXT DECISIVE ACTION",
      title: "SYNCING",
      detail:
        "Keep the desk readable while the canonical operator hub snapshot recovers.",
      targetSurface: "hub",
      tone: error ? "action_required" : "watch",
    },
    proof: {
      label: "IS THE WEDGE PROVING?",
      title: "PAPER proof is loading.",
      detail:
        "Promotion evidence, broker truth, and review coverage are still syncing.",
      tone: "watch",
      metrics: [
        { label: "Paper trades", value: "—", tone: "watch" },
        { label: "Closed trades", value: "—", tone: "watch" },
      ],
    },
    liveReadiness: {
      label: "BROADER LIVE PATH",
      title: "LIVE readiness is loading.",
      detail:
        "Release governance, broker truth, capsule state, and admissibility are still syncing.",
      tone: error ? "action_required" : "watch",
      metrics: [
        {
          label: "Release",
          value: "—",
          tone: error ? "action_required" : "watch",
        },
        {
          label: "Broker truth",
          value: "—",
          tone: error ? "action_required" : "watch",
        },
      ],
    },
    collaboration: {
      label: "COLLABORATION URGENCY",
      title: "Continuity is loading.",
      detail:
        "Terminal ownership, inbox pressure, and takeover state are still syncing.",
      tone: error ? "action_required" : "watch",
      metrics: [
        {
          label: "Takeover required",
          value: "—",
          tone: error ? "action_required" : "watch",
        },
        {
          label: "Stale claims",
          value: "—",
          tone: error ? "action_required" : "watch",
        },
      ],
    },
    provingWedge: null,
  };
}

export function OperatorHubSummary({
  firstPaint,
  error = null,
}: {
  firstPaint?: OperatorHubFirstPaintSummary | null;
  error?: string | null;
}) {
  const snapshot = firstPaint ?? fallbackSummary(error);

  return h(
    "section",
    {
      "data-testid": "operator-hub-summary",
      style: {
        display: "grid",
        gap: 14,
        padding: 16,
        borderRadius: 6,
        border: `1px solid ${BORDER}`,
        background: "linear-gradient(180deg, #07111b 0%, #050c14 100%)",
        color: TEXT,
      },
    },
    h(
      "div",
      {
        style: {
          display: "flex",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap",
          alignItems: "flex-start",
        },
      },
      h(
        "div",
        { style: { display: "grid", gap: 6 } },
        h(
          "div",
          { style: { color: LABEL, fontSize: 10, letterSpacing: 2 } },
          "OPERATOR HUB",
        ),
        h(
          "div",
          { style: { fontSize: 26, fontWeight: 800, lineHeight: 1.1 } },
          snapshot.hero.title,
        ),
        h(
          "div",
          { style: { maxWidth: 760, fontSize: 13, color: "#9ecae1" } },
          snapshot.hero.summary,
        ),
      ),
      h(
        "div",
        {
          style: {
            display: "flex",
            gap: 8,
            flexWrap: "wrap",
            justifyContent: "flex-end",
          },
        },
        snapshot.hero.badges.map((badge) =>
          h(
            "span",
            {
              key: badge.label,
              style: {
                padding: "6px 10px",
                borderRadius: 999,
                border: `1px solid ${toneColor(badge.tone)}40`,
                color: toneColor(badge.tone),
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: 0.6,
              },
            },
            badge.label,
          ),
        ),
      ),
    ),
    snapshot.topBlocker
      ? h(
          "div",
          {
            "data-testid": "hub-top-blocker",
            style: {
              display: "grid",
              gap: 6,
              padding: 12,
              borderRadius: 4,
              border: `1px solid ${toneColor(snapshot.topBlocker.tone)}40`,
              background: "rgba(255,255,255,0.02)",
            },
          },
          h(
            "div",
            {
              style: {
                color: toneColor(snapshot.topBlocker.tone),
                fontSize: 11,
                letterSpacing: 1.3,
              },
            },
            "TOP BLOCKER",
          ),
          h(
            "div",
            { style: { fontSize: 15, fontWeight: 700 } },
            snapshot.topBlocker.title,
          ),
          h(
            "div",
            { style: { color: "#c8dff0", fontSize: 12 } },
            snapshot.topBlocker.detail,
          ),
        )
      : null,
    h(
      "div",
      {
        style: {
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
          gap: 12,
        },
      },
      h(
        "div",
        {
          style: {
            display: "grid",
            gap: 10,
            padding: 12,
            borderRadius: 4,
            border: "1px solid #102638",
            background: PANEL,
          },
        },
        h(
          "div",
          { style: { color: LABEL, fontSize: 10, letterSpacing: 2 } },
          snapshot.nextAction.label,
        ),
        h(
          "div",
          {
            style: {
              fontSize: 18,
              fontWeight: 700,
              color: toneColor(snapshot.nextAction.tone),
            },
          },
          snapshot.nextAction.title,
        ),
        h(
          "div",
          { style: { fontSize: 13, color: TEXT } },
          snapshot.nextAction.detail,
        ),
        h(
          "div",
          { style: { fontSize: 12, color: MUTED } },
          `Target surface: ${snapshot.nextAction.targetSurface}`,
        ),
      ),
      h(
        "div",
        {
          "data-testid": "hub-proof-state",
          style: {
            display: "grid",
            gap: 10,
            padding: 12,
            borderRadius: 4,
            border: "1px solid #102638",
            background: PANEL,
          },
        },
        h(
          "div",
          {
            style: {
              display: "flex",
              justifyContent: "space-between",
              gap: 8,
              alignItems: "center",
            },
          },
          h(
            "div",
            { style: { color: LABEL, fontSize: 10, letterSpacing: 2 } },
            snapshot.proof.label,
          ),
          h(
            "div",
            {
              style: {
                color: toneColor(snapshot.proof.tone),
                fontSize: 11,
                fontWeight: 700,
              },
            },
            (snapshot.proof.badge ?? "monitor").toUpperCase(),
          ),
        ),
        h(
          "div",
          {
            style: {
              fontSize: 18,
              fontWeight: 700,
              color: toneColor(snapshot.proof.tone),
            },
          },
          snapshot.proof.title,
        ),
        h(
          "div",
          { style: { fontSize: 13, color: TEXT } },
          snapshot.proof.detail,
        ),
        h(
          "div",
          {
            style: {
              display: "grid",
              gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
              gap: 8,
            },
          },
          snapshot.proof.metrics.map(renderMetric),
        ),
      ),
      h(
        "div",
        {
          "data-testid": "hub-live-readiness-state",
          style: {
            display: "grid",
            gap: 10,
            padding: 12,
            borderRadius: 4,
            border: "1px solid #102638",
            background: PANEL,
          },
        },
        h(
          "div",
          {
            style: {
              display: "flex",
              justifyContent: "space-between",
              gap: 8,
              alignItems: "center",
            },
          },
          h(
            "div",
            { style: { color: LABEL, fontSize: 10, letterSpacing: 2 } },
            snapshot.liveReadiness.label,
          ),
          h(
            "div",
            {
              style: {
                color: toneColor(snapshot.liveReadiness.tone),
                fontSize: 11,
                fontWeight: 700,
              },
            },
            (snapshot.liveReadiness.badge ?? "monitor").toUpperCase(),
          ),
        ),
        h(
          "div",
          {
            style: {
              fontSize: 18,
              fontWeight: 700,
              color: toneColor(snapshot.liveReadiness.tone),
            },
          },
          snapshot.liveReadiness.title,
        ),
        h(
          "div",
          { style: { fontSize: 13, color: TEXT } },
          snapshot.liveReadiness.detail,
        ),
        h(
          "div",
          {
            style: {
              display: "grid",
              gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
              gap: 8,
            },
          },
          snapshot.liveReadiness.metrics.map(renderMetric),
        ),
      ),
      h(
        "div",
        {
          "data-testid": "hub-collaboration-state",
          style: {
            display: "grid",
            gap: 10,
            padding: 12,
            borderRadius: 4,
            border: "1px solid #102638",
            background: PANEL,
          },
        },
        h(
          "div",
          { style: { color: LABEL, fontSize: 10, letterSpacing: 2 } },
          snapshot.collaboration.label,
        ),
        h(
          "div",
          {
            style: {
              fontSize: 18,
              fontWeight: 700,
              color: toneColor(snapshot.collaboration.tone),
            },
          },
          snapshot.collaboration.title,
        ),
        h(
          "div",
          { style: { fontSize: 13, color: TEXT } },
          snapshot.collaboration.detail,
        ),
        h(
          "div",
          {
            style: {
              display: "grid",
              gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
              gap: 8,
            },
          },
          snapshot.collaboration.metrics.map(renderMetric),
        ),
      ),
    ),
  );
}
