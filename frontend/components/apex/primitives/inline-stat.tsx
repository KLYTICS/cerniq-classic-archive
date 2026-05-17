// Apex absorption — Phase 6.0 InlineStat primitive (2026-05-17).
//
// Verbatim port of `apex/components/primitives/inline-stat.tsx` (71
// lines). Pure leaf — depends only on `tokens` from the Phase 6.0
// design module. No hooks, no API, no other primitives.
//
// "Preserve original form" — same hyperscript (`createElement`),
// same prop shape, same TONE_LOOKUP, same default tone "neutral",
// same default size 8.

import { createElement } from "react";
import type { ReactNode } from "react";
import { tokens, type StatusTone } from "@/lib/apex/design/tokens";

export interface InlineStatProps {
  /** Short uppercase label, e.g. "FEED", "VIX". */
  label: string;
  value: ReactNode;
  /** Status tone applied to the value. Default "neutral". */
  tone?: StatusTone | "muted";
  /**
   * Override font size for the strip context. Default 8px matches the
   * runtime-health-strip + system-health density. Pass 9+ for less dense
   * surfaces (workspace strip, banner).
   */
  size?: 7 | 8 | 9 | 10;
}

const TONE_LOOKUP: Record<StatusTone | "muted", string> = {
  ok: tokens.color.status.ok,
  warn: tokens.color.status.warn,
  alert: tokens.color.status.alert,
  info: tokens.color.status.info,
  neutral: tokens.color.text.body,
  shadow: tokens.color.status.shadow,
  /** "Muted" — convenience for timestamp / metadata cells that aren't status-coded. */
  muted: tokens.color.text.muted,
};

/**
 * InlineStat — horizontal `LABEL VALUE` cell. Used inside Strip to build
 * the cockpit's status bars (runtime, workspace, system). The label uses
 * the muted color; the value is tone-driven so a glance across the strip
 * tells the operator which subsystems are degraded.
 */
export function InlineStat({
  label,
  value,
  tone = "neutral",
  size = 8,
}: InlineStatProps) {
  return createElement(
    "div",
    {
      style: {
        display: "inline-flex",
        gap: tokens.space[2],
        alignItems: "baseline",
        fontFamily: tokens.font.mono,
      },
    },
    createElement(
      "span",
      {
        style: {
          color: tokens.color.text.muted,
          fontSize: size,
          letterSpacing: tokens.letterSpacing.label,
        },
      },
      label,
    ),
    createElement(
      "span",
      {
        style: {
          color: TONE_LOOKUP[tone],
          fontSize: size,
          fontWeight: tokens.fontWeight.medium,
          fontVariantNumeric: "tabular-nums",
        },
      },
      value,
    ),
  );
}
