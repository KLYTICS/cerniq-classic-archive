// Apex absorption — Phase 2 contract shim (2026-05-16).
//
// The original `apex/lib/operator-hub/contracts.ts` is a 200-line file
// that pulls in ApexMode, ProvingWedgeSnapshot, OperatorTrustSnapshot,
// CollaborationBootstrapSnapshot, DeskCommandSnapshot, ResearchHubSummary
// — a deep dependency graph reaching into ~12 other lib/ modules. The
// full graph belongs to Phase 3 (data-layer coexistence).
//
// For Phase 2 (mocked first-paint), we only need the *first-paint
// summary* shape — the type the `OperatorHubSummary` view consumes. We
// inline that subset here so Phase 2 stays self-contained.
//
// When Phase 3 lands, this file gets replaced (or extended) with the
// full contracts.ts port plus its dependency closure. Until then: the
// surface name `@/lib/apex/operator-hub-contracts` is the stable
// import target inside cerniq's absorbed apex namespace.

export type SimulationHubTone =
  | "healthy"
  | "watch"
  | "action_required"
  | "critical";

export interface OperatorHubFirstPaintBadge {
  label: string;
  tone: SimulationHubTone;
}

export interface OperatorHubFirstPaintMetric {
  label: string;
  value: string;
  tone: SimulationHubTone;
}

export interface OperatorHubFirstPaintNarrative {
  label: string;
  title: string;
  detail: string;
  tone: SimulationHubTone;
  badge?: string | null;
  metrics: OperatorHubFirstPaintMetric[];
}

export interface OperatorHubFirstPaintBlocker {
  title: string;
  detail: string;
  tone: SimulationHubTone;
}

export interface OperatorHubFirstPaintHero {
  title: string;
  summary: string;
  badges: OperatorHubFirstPaintBadge[];
}

export interface OperatorHubFirstPaintNextAction {
  label: string;
  title: string;
  detail: string;
  tone: SimulationHubTone;
  targetSurface: string;
}

export interface OperatorHubFirstPaintSummary {
  hero: OperatorHubFirstPaintHero;
  topBlocker: OperatorHubFirstPaintBlocker | null;
  nextAction: OperatorHubFirstPaintNextAction;
  proof: OperatorHubFirstPaintNarrative;
  liveReadiness: OperatorHubFirstPaintNarrative;
  collaboration: OperatorHubFirstPaintNarrative;
  // Phase 3 will widen this to ProvingWedgeSnapshot | null. For Phase 2
  // it is always null in mocked data — the view checks for null
  // already, so this is a safe narrowing.
  provingWedge: null;
}
