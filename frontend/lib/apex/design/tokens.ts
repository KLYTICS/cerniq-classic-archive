// Apex absorption — Phase 6.0 design tokens (2026-05-17).
//
// Verbatim port of `apex/lib/design/tokens.ts` (238 lines). Two-tier
// model: raw `palette` scales (internal, never imported directly by
// components) and semantic `tokens` (the public surface).
//
// Phase 6.0 establishes the leaf level of the Phase 6 dep cascade
// (per docs/platform/APEX_ABSORPTION.md). Future ports of the
// 25+ heavy panel components consume this module via:
//
//   import { tokens, type StatusTone } from "@/lib/apex/design/tokens";
//
// "Preserve original form" — palette values, semantic role names,
// font triad, spacing scale, motion durations, and z-index scale
// all preserved byte-for-byte. The only adjustment vs. original is
// the file path (`apex/lib/design/tokens.ts` → cerniq's namespaced
// `lib/apex/design/tokens.ts`).

const palette = {
  navy: {
    950: "#040810", // body background
    925: "#040c18", // scrollbar track
    900: "#050b13", // section background (apex-hub-layout)
    875: "#070f1a", // input background
    850: "#081220", // panel background (alpha 0.97 over body)
    800: "#0a1828",
    700: "#0d2030", // input border
    650: "#0d2a44", // scrollbar thumb
    600: "#102638", // section border (apex-hub-layout)
    500: "#1a3a52",
  },
  ice: {
    50: "#F3F7FB", // headline text on dark
    100: "#E1ECF5",
    200: "#c8dff0", // input text
    300: "#8FB4CF", // section summary text
    400: "#8ba8c0", // body text
    500: "#6b8aa0",
    600: "#4FC3F7", // eyebrow / link accent
  },
  mint: {
    300: "#5fffd1",
    500: "#00FFB2", // primary accent — autonomy, profit, ok states
    600: "#00d99a",
    900: "rgba(0,255,178,0.025)", // row hover
  },
  amber: {
    400: "#FFC857", // warning
    600: "#D9941C",
  },
  scarlet: {
    400: "#ff4757", // alert / breaking / loss
    600: "#d63031",
    900: "rgba(255,71,87,0.08)", // breaking pulse background
  },
  violet: {
    400: "#A78BFA", // shadow lane / synthetic
  },
} as const;

export const tokens = {
  color: {
    surface: {
      canvas: palette.navy[950],
      sunken: palette.navy[925],
      raised: palette.navy[900],
      panel: "rgba(8,18,32,0.97)",
      input: palette.navy[875],
      hoverRow: palette.mint[900],
      breaking: palette.scarlet[900],
    },
    border: {
      subtle: "rgba(255,255,255,0.05)",
      default: palette.navy[700],
      strong: palette.navy[600],
      focus: "rgba(0,255,178,0.25)",
      accent: palette.mint[500],
      alert: palette.scarlet[400],
    },
    text: {
      primary: palette.ice[50],
      body: palette.ice[400],
      secondary: palette.ice[300],
      muted: palette.ice[500],
      inputValue: palette.ice[200],
      eyebrow: palette.ice[600],
      accent: palette.mint[500],
      warning: palette.amber[400],
      alert: palette.scarlet[400],
      shadow: palette.violet[400],
    },
    status: {
      ok: palette.mint[500],
      warn: palette.amber[400],
      alert: palette.scarlet[400],
      info: palette.ice[600],
      neutral: palette.ice[400],
      shadow: palette.violet[400],
    },
    priority: {
      critical: palette.scarlet[400],
      high: palette.amber[400],
      medium: palette.ice[600],
      low: palette.ice[500],
    },
  },
  font: {
    mono: "'IBM Plex Mono', 'Courier New', monospace",
    display: "'Orbitron', 'IBM Plex Mono', monospace",
    accent: "'Rajdhani', 'IBM Plex Mono', sans-serif",
  },
  fontSize: {
    eyebrow: 9,
    body: 10,
    metric: 12,
    label: 11,
    title: 13,
    hero: 24,
    display: 32,
  },
  fontWeight: {
    regular: 400,
    medium: 600,
    bold: 700,
    display: 800,
  },
  letterSpacing: {
    tight: 0,
    normal: 0.5,
    wide: 1,
    label: 1.5,
    eyebrow: 2,
  },
  space: {
    0: 0,
    1: 2,
    2: 4,
    3: 6,
    4: 8,
    5: 12,
    6: 16,
    7: 20,
    8: 24,
    9: 32,
  },
  radius: {
    none: 0,
    sm: 2,
    md: 3,
    lg: 6,
    pill: 999,
  },
  motion: {
    duration: {
      instant: 100,
      fast: 150,
      base: 200,
      slow: 250,
      crawl: 800,
    },
    easing: {
      base: "ease",
      enter: "ease-out",
      exit: "ease-in",
      step: "step-end",
    },
  },
  z: {
    base: 0,
    raised: 10,
    sticky: 100,
    overlay: 500,
    modal: 1000,
    toast: 2000,
    debug: 9999,
  },
} as const;

export const chartPalette = {
  series: [
    palette.mint[500],
    palette.ice[600],
    palette.amber[400],
    palette.violet[400],
    palette.scarlet[400],
  ],
  divergent: {
    positive: palette.mint[500],
    negative: palette.scarlet[400],
    neutral: palette.ice[400],
  },
  heat: [
    palette.navy[700],
    palette.navy[500],
    palette.ice[600],
    palette.mint[500],
  ],
} as const;

export type Tokens = typeof tokens;
export type StatusTone = keyof typeof tokens.color.status;
export type PriorityTone = keyof typeof tokens.color.priority;
