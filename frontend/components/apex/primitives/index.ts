// Apex absorption — Phase 6.0 primitives barrel (2026-05-17).
//
// Re-exports the leaf primitives that Phase 6+ panels consume. Mirrors
// `apex/components/primitives/index.ts` — same export names, same
// import surface for downstream components:
//
//   import { InlineStat, Strip } from "@/components/apex/primitives";
//
// Future Phase 6 commits expand this barrel as additional primitives
// land (Banner, Panel, MetricCell, StatusPill, etc.).

export { InlineStat, type InlineStatProps } from "./inline-stat";
export { Strip, type StripProps, type StripPlacement } from "./strip";
