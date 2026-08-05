// Apex absorption — Phase 6.0 Strip primitive (2026-05-17).
//
// Verbatim port of `apex/components/primitives/strip.tsx` (74 lines).
// Pure leaf — depends only on `tokens` from the Phase 6.0 design
// module. No hooks, no API, no other primitives.
//
// "Preserve original form" — placement options (header/footer/free),
// density options (default/dense), border + background mapping,
// data-strip test hook all preserved exactly.

import { createElement } from "react";
import type { CSSProperties, ReactNode } from "react";
import { tokens } from "@/lib/apex/design/tokens";

export type StripPlacement = "header" | "footer" | "free";

export interface StripProps {
  /** Optional in the type so `createElement(Strip, props, ...children)` typechecks. */
  children?: ReactNode;
  /**
   * Placement relative to container. Default "header" adds border-bottom;
   * "footer" adds border-top with darker background (for the sticky bottom
   * system-health row); "free" adds no rule (compose inside a Panel).
   */
  placement?: StripPlacement;
  /** Dense padding for the system-health-style footer. */
  density?: "default" | "dense";
  /** Test hook — every strip SHOULD set this. */
  "data-strip"?: string;
  style?: CSSProperties;
}

const PLACEMENT_STYLES: Record<
  StripPlacement,
  Pick<CSSProperties, "background" | "borderTop" | "borderBottom">
> = {
  header: {
    background: tokens.color.surface.raised,
    borderBottom: `1px solid ${tokens.color.border.strong}`,
  },
  footer: {
    background: tokens.color.surface.canvas,
    borderTop: `1px solid ${tokens.color.border.strong}`,
  },
  free: {
    background: tokens.color.surface.raised,
  },
};

/**
 * Strip — horizontal flex row of InlineStat / button / pill children. The
 * canonical chrome for runtime/workspace/system status bars. Replaces the
 * recurring `<div style={{ display: flex, gap, padding, borderBottom }}>`
 * pattern across the cockpit.
 */
export function Strip({
  children,
  placement = "header",
  density = "default",
  style,
  ...rest
}: StripProps) {
  const placementStyle = PLACEMENT_STYLES[placement];
  const padding =
    density === "dense"
      ? `${tokens.space[1]}px ${tokens.space[5]}px`
      : `${tokens.space[4]}px ${tokens.space[5]}px`;

  return createElement(
    "div",
    {
      ...rest,
      style: {
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        gap: tokens.space[5],
        padding,
        ...placementStyle,
        ...style,
      },
    },
    children,
  );
}
