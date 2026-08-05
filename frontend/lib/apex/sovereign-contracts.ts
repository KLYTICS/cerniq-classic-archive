// Apex absorption — Phase 5c sovereign contract port (2026-05-17).
//
// Verbatim port of `apex/lib/server/sovereign/types.ts`. The original
// imports `ApexMode` from `@/lib/config`; we inline that here as
// the 3-variant string union to avoid dragging the full apex config
// module across.
//
// The sovereign console is the "owner-only intelligence layer" —
// regime tension index + theme universe (AI supply chain, broad tech,
// Vanguard core, quantum, nuclear) + signal stream + promotion
// lanes. The full data pipeline lives in apex/lib/server/sovereign/
// (signals/aggregator, promotion, access gate, quotes) and is
// Phase 6's port lift. Phase 5c ports just the *types* + the
// curated *themes catalog* (which is pure static data).

export type ApexMode = "DEMO" | "PAPER" | "LIVE";

export type ThemeId =
  | "ai_supply_chain"
  | "tech_broad"
  | "vanguard_core"
  | "quantum"
  | "nuclear";

export type ThemeTier = "anchor" | "core" | "satellite";

export interface ThemeConstituent {
  symbol: string;
  name: string;
  tier: ThemeTier;
  isEtf: boolean;
  usRevenueShare: number;
  flags?: ReadonlyArray<
    "itar" | "sanctioned_jurisdiction" | "concentration_risk"
  >;
}

export interface ThemeDefinition {
  id: ThemeId;
  label: string;
  narrative: string;
  anchorSymbol: string;
  usBiasWeight: number;
  constituents: ReadonlyArray<ThemeConstituent>;
}

export type TensionRegime = "calm" | "elevated" | "stressed" | "crisis";

export interface TensionComponent {
  name: string;
  value: number;
  confidence: number;
  source: string;
}

export interface SovereignRegime {
  snapshotId: string;
  generatedAt: string;
  mode: ApexMode;
  tensionIndex: number;
  tensionRegime: TensionRegime;
  components: ReadonlyArray<TensionComponent>;
  usBias: number;
  macroRegimeLabel:
    | "risk_on"
    | "risk_off"
    | "usd_dominance"
    | "usd_pressure"
    | "balanced"
    | null;
  detail: string;
}

export type SignalSide = "long" | "short" | "flat";

export interface SignalComponentScore {
  name: "momentum" | "breadth" | "flow" | "options" | "cross_asset";
  score: number;
  confidence: number;
  detail?: string;
}

export type ExecutionLane = "shadow" | "paper" | "live";

export interface SovereignSignal {
  signalId: string;
  generatedAt: string;
  expiresAt: string;
  theme: ThemeId;
  symbol: string;
  side: SignalSide;
  score: number;
  confidence: number;
  components: ReadonlyArray<SignalComponentScore>;
  regime: {
    tensionIndex: number;
    tensionRegime: TensionRegime;
    usBias: number;
    biasFactor: number;
  };
  sizing: {
    targetNotionalUsd: number;
    targetWeight: number;
    capAppliedUsd: number | null;
  };
  lane: ExecutionLane;
}

export interface ThemePromotionState {
  theme: ThemeId;
  lane: ExecutionLane;
  promotedAt: string | null;
  promotedBy: string | null;
  paperWindowDays: number | null;
  paperSharpe: number | null;
}

export interface SovereignSignalSet {
  regime: SovereignRegime;
  signals: ReadonlyArray<SovereignSignal>;
}
