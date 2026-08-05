// /apex/sovereign — Phase 5c (sovereign console with mocked data, 2026-05-17).
//
// Third of four flagship-route ports under Phase 5. Verbatim port of
// apex/app/sovereign/page.tsx with two adjustments:
//
//   1. The `requireSovereignPageAccess()` auth gate is removed (it's
//      a Phase 4 auth-bridge concern). When Phase 4 lands, the gate
//      reattaches at the top of this page.
//
//   2. The two server data fetches (`generateSovereignSignals()` and
//      `listThemePromotionStates()`) are replaced with mocked
//      payloads shaped exactly like the production contracts. Phase 6
//      ports the real fetchers alongside the API handlers.
//
// "Preserve original form" — same 4-quadrant Bloomberg layout
// (Regime panel + Theme cards / Signal stream + Promotion lanes),
// same COL color tokens (#0a0d12 bg / #10141c panel / #23a559 long /
// #e0455a short / #5a8ddb accent / #e0a23c warn / #e0763c stressed),
// same Panel/RegimePanel/ThemeCardsPanel/SignalStreamPanel/Promotion
// Panel inline-defined sub-components.
//
// Note: this page is wrapped in ApexPageShell (not the bare full-
// viewport main of the original) so it stays inside the absorbed
// /apex/* namespace surface. The original Apex /sovereign is a
// full-viewport console; here it renders inside cerniq's normal
// page chrome.

import {
  ApexAction,
  ApexActionGroup,
  ApexHero,
  ApexPageShell,
  ApexStatusPill,
} from "@/components/apex/apex-demo-ui";
import {
  SOVEREIGN_THEMES,
  SOVEREIGN_THEME_IDS,
  getThemeUsRevenueShare,
} from "@/lib/apex/sovereign-themes";
import type {
  SovereignRegime,
  SovereignSignal,
  SovereignSignalSet,
  TensionRegime,
  ThemePromotionState,
} from "@/lib/apex/sovereign-contracts";

export const dynamic = "force-dynamic";

// ── color tokens (verbatim from apex/app/sovereign/page.tsx) ────────────────
const COL = {
  bg: "#0a0d12",
  panel: "#10141c",
  border: "#1d2330",
  ink: "#dde3ec",
  inkDim: "#7a8597",
  long: "#23a559",
  short: "#e0455a",
  flat: "#7a8597",
  accent: "#5a8ddb",
  warn: "#e0a23c",
  crit: "#e0455a",
};

function tensionColor(regime: TensionRegime): string {
  switch (regime) {
    case "calm":
      return COL.long;
    case "elevated":
      return COL.warn;
    case "stressed":
      return "#e0763c";
    case "crisis":
      return COL.crit;
  }
}

function fmtPct(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function fmtNum(value: number, digits = 2): string {
  return value.toFixed(digits);
}

function fmtUsd(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}k`;
  return `$${value.toFixed(0)}`;
}

// ── panel components (verbatim) ─────────────────────────────────────────────

function Panel({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        background: COL.panel,
        border: `1px solid ${COL.border}`,
        borderRadius: 6,
        padding: "12px 16px",
        display: "flex",
        flexDirection: "column",
        gap: 12,
        minHeight: 0,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
        }}
      >
        <span
          style={{
            fontSize: 11,
            letterSpacing: 1.2,
            textTransform: "uppercase",
            color: COL.inkDim,
          }}
        >
          {title}
        </span>
        {subtitle ? (
          <span style={{ fontSize: 10, color: COL.inkDim }}>{subtitle}</span>
        ) : null}
      </div>
      {children}
    </div>
  );
}

function RegimePanel({ regime }: { regime: SovereignRegime }) {
  return (
    <Panel
      title="Regime · Tension Index"
      subtitle={new Date(regime.generatedAt).toUTCString()}
    >
      <div style={{ display: "flex", alignItems: "baseline", gap: 16 }}>
        <span
          style={{
            fontSize: 48,
            fontWeight: 600,
            color: tensionColor(regime.tensionRegime),
            lineHeight: 1,
          }}
        >
          {(regime.tensionIndex * 100).toFixed(0)}
        </span>
        <span
          style={{
            fontSize: 14,
            textTransform: "uppercase",
            color: tensionColor(regime.tensionRegime),
          }}
        >
          {regime.tensionRegime}
        </span>
      </div>
      <div style={{ display: "flex", gap: 24, fontSize: 12, color: COL.ink }}>
        <div>
          <div style={{ color: COL.inkDim, fontSize: 10 }}>US BIAS</div>
          <div
            style={{
              fontSize: 16,
              color: regime.usBias > 0 ? COL.accent : COL.inkDim,
            }}
          >
            {regime.usBias > 0 ? "+" : ""}
            {regime.usBias.toFixed(2)}
          </div>
        </div>
        <div>
          <div style={{ color: COL.inkDim, fontSize: 10 }}>MODE</div>
          <div style={{ fontSize: 16 }}>{regime.mode}</div>
        </div>
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(2, 1fr)",
          gap: 6,
          fontSize: 11,
        }}
      >
        {regime.components.map((c) => (
          <div
            key={c.name}
            style={{
              display: "flex",
              justifyContent: "space-between",
              padding: "4px 8px",
              background: "#0d1219",
              borderRadius: 4,
              opacity: c.confidence === 0 ? 0.4 : 1,
            }}
          >
            <span style={{ color: COL.inkDim }}>{c.name}</span>
            <span>
              {fmtNum(c.value)}{" "}
              <span style={{ color: COL.inkDim }}>· {c.source}</span>
            </span>
          </div>
        ))}
      </div>
      <div style={{ fontSize: 10, color: COL.inkDim }}>{regime.detail}</div>
    </Panel>
  );
}

function ThemeCardsPanel({
  promotions,
}: {
  promotions: ReadonlyArray<ThemePromotionState>;
}) {
  const promotionByTheme = new Map(
    promotions.map((p) => [p.theme, p] as const),
  );
  return (
    <Panel title="Themes · Universe">
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: 8,
        }}
      >
        {SOVEREIGN_THEME_IDS.map((id) => {
          const theme = SOVEREIGN_THEMES[id];
          const usShare = getThemeUsRevenueShare(theme);
          const promo = promotionByTheme.get(id);
          return (
            <div
              key={id}
              style={{
                background: "#0d1219",
                border: `1px solid ${COL.border}`,
                borderRadius: 4,
                padding: "10px 12px",
                fontSize: 11,
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                }}
              >
                <span style={{ color: COL.ink, fontSize: 13 }}>
                  {theme.label}
                </span>
                <span
                  style={{
                    color:
                      promo?.lane === "live"
                        ? COL.long
                        : promo?.lane === "paper"
                          ? COL.accent
                          : COL.inkDim,
                    fontSize: 10,
                    textTransform: "uppercase",
                    letterSpacing: 1,
                  }}
                >
                  {promo?.lane ?? "—"}
                </span>
              </div>
              <div style={{ color: COL.inkDim, marginTop: 4 }}>
                {theme.constituents.length} symbols
              </div>
              <div style={{ color: COL.inkDim, marginTop: 4 }}>
                Anchor{" "}
                <span style={{ color: COL.ink }}>{theme.anchorSymbol}</span> ·
                US rev <span style={{ color: COL.ink }}>{fmtPct(usShare)}</span>
              </div>
              <div style={{ color: COL.inkDim, marginTop: 4 }}>
                Bias weight{" "}
                <span style={{ color: COL.ink }}>
                  {fmtNum(theme.usBiasWeight)}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </Panel>
  );
}

function SignalStreamPanel({
  signals,
}: {
  signals: ReadonlyArray<SovereignSignal>;
}) {
  const top = [...signals]
    .filter((s) => s.confidence > 0)
    .sort(
      (a, b) =>
        Math.abs(b.score) * b.confidence - Math.abs(a.score) * a.confidence,
    )
    .slice(0, 16);

  return (
    <Panel
      title="Signal Stream · Top by |score|×conf"
      subtitle={`${signals.length} total`}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 4,
          fontSize: 11,
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "70px 80px 50px 50px 80px 60px 1fr",
            gap: 8,
            color: COL.inkDim,
            fontSize: 10,
            padding: "0 6px",
          }}
        >
          <span>SYMBOL</span>
          <span>THEME</span>
          <span>SIDE</span>
          <span>SCORE</span>
          <span>CONF</span>
          <span>LANE</span>
          <span>NOTIONAL</span>
        </div>
        {top.map((s) => (
          <div
            key={s.signalId}
            style={{
              display: "grid",
              gridTemplateColumns: "70px 80px 50px 50px 80px 60px 1fr",
              gap: 8,
              padding: "4px 6px",
              borderRadius: 3,
              background: "#0d1219",
            }}
          >
            <span style={{ color: COL.ink }}>{s.symbol}</span>
            <span style={{ color: COL.inkDim }}>{s.theme}</span>
            <span
              style={{
                color:
                  s.side === "long"
                    ? COL.long
                    : s.side === "short"
                      ? COL.short
                      : COL.flat,
                textTransform: "uppercase",
                fontWeight: 600,
              }}
            >
              {s.side}
            </span>
            <span
              style={{
                color:
                  s.score > 0 ? COL.long : s.score < 0 ? COL.short : COL.flat,
              }}
            >
              {s.score > 0 ? "+" : ""}
              {fmtNum(s.score)}
            </span>
            <span style={{ color: COL.inkDim }}>{fmtPct(s.confidence)}</span>
            <span
              style={{
                color:
                  s.lane === "live"
                    ? COL.long
                    : s.lane === "paper"
                      ? COL.accent
                      : COL.inkDim,
                textTransform: "uppercase",
                fontSize: 10,
              }}
            >
              {s.lane}
            </span>
            <span style={{ color: COL.ink }}>
              {fmtUsd(s.sizing.targetNotionalUsd)}
            </span>
          </div>
        ))}
        {top.length === 0 ? (
          <div style={{ color: COL.inkDim, padding: 12, textAlign: "center" }}>
            No high-confidence signals — feed adapters may be cold.
          </div>
        ) : null}
      </div>
    </Panel>
  );
}

function PromotionPanel({
  promotions,
}: {
  promotions: ReadonlyArray<ThemePromotionState>;
}) {
  return (
    <Panel
      title="Promotion Lanes"
      subtitle="POST /api/sovereign/promote to change"
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 6,
          fontSize: 11,
        }}
      >
        {promotions.map((p) => (
          <div
            key={p.theme}
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 80px 1fr",
              alignItems: "center",
              gap: 8,
              padding: "8px 10px",
              background: "#0d1219",
              borderRadius: 4,
            }}
          >
            <span style={{ color: COL.ink }}>
              {SOVEREIGN_THEMES[p.theme].label}
            </span>
            <span
              style={{
                color:
                  p.lane === "live"
                    ? COL.long
                    : p.lane === "paper"
                      ? COL.accent
                      : COL.inkDim,
                textTransform: "uppercase",
                fontWeight: 600,
                letterSpacing: 1,
              }}
            >
              {p.lane}
            </span>
            <span
              style={{
                color: COL.inkDim,
                fontSize: 10,
                textAlign: "right",
              }}
            >
              {p.promotedAt
                ? `${new Date(p.promotedAt).toISOString().slice(0, 16).replace("T", " ")}Z`
                : "default"}
            </span>
          </div>
        ))}
      </div>
    </Panel>
  );
}

// ── mocked data ─────────────────────────────────────────────────────────────

const MOCK_SIGNAL_SET: SovereignSignalSet = {
  regime: {
    snapshotId: "regime-2026-05-17-1530",
    generatedAt: "2026-05-17T15:30:00Z",
    mode: "PAPER",
    tensionIndex: 0.42,
    tensionRegime: "elevated",
    usBias: 0.34,
    macroRegimeLabel: "usd_pressure",
    components: [
      {
        name: "VIX term structure",
        value: 0.51,
        confidence: 0.95,
        source: "cboe",
      },
      { name: "Credit spreads", value: 0.38, confidence: 0.92, source: "ice" },
      { name: "DXY momentum", value: 0.44, confidence: 0.88, source: "ice" },
      {
        name: "Cross-asset corr",
        value: 0.36,
        confidence: 0.81,
        source: "internal",
      },
      {
        name: "FX vol surface",
        value: 0.41,
        confidence: 0.79,
        source: "broker",
      },
      {
        name: "Funding stress",
        value: 0.27,
        confidence: 0.74,
        source: "ny_fed",
      },
    ],
    detail:
      "Tension elevated on USD-funding tightness + 30d VIX term inversion. " +
      "US-bias overlay tilting positive on Vanguard core + nuclear themes; " +
      "ITAR-tagged constituents are flagged for promotion review.",
  },
  signals: [
    {
      signalId: "sig-001",
      generatedAt: "2026-05-17T15:30:00Z",
      expiresAt: "2026-05-17T20:30:00Z",
      theme: "ai_supply_chain",
      symbol: "NVDA",
      side: "long",
      score: 0.78,
      confidence: 0.86,
      components: [],
      regime: {
        tensionIndex: 0.42,
        tensionRegime: "elevated",
        usBias: 0.34,
        biasFactor: 1.0,
      },
      sizing: {
        targetNotionalUsd: 1_250_000,
        targetWeight: 0.12,
        capAppliedUsd: null,
      },
      lane: "live",
    },
    {
      signalId: "sig-002",
      generatedAt: "2026-05-17T15:30:00Z",
      expiresAt: "2026-05-17T20:30:00Z",
      theme: "tech_broad",
      symbol: "MSFT",
      side: "long",
      score: 0.64,
      confidence: 0.81,
      components: [],
      regime: {
        tensionIndex: 0.42,
        tensionRegime: "elevated",
        usBias: 0.34,
        biasFactor: 1.0,
      },
      sizing: {
        targetNotionalUsd: 850_000,
        targetWeight: 0.08,
        capAppliedUsd: null,
      },
      lane: "live",
    },
    {
      signalId: "sig-003",
      generatedAt: "2026-05-17T15:30:00Z",
      expiresAt: "2026-05-17T20:30:00Z",
      theme: "vanguard_core",
      symbol: "VOO",
      side: "long",
      score: 0.58,
      confidence: 0.93,
      components: [],
      regime: {
        tensionIndex: 0.42,
        tensionRegime: "elevated",
        usBias: 0.34,
        biasFactor: 1.0,
      },
      sizing: {
        targetNotionalUsd: 2_400_000,
        targetWeight: 0.22,
        capAppliedUsd: null,
      },
      lane: "live",
    },
    {
      signalId: "sig-004",
      generatedAt: "2026-05-17T15:30:00Z",
      expiresAt: "2026-05-17T20:30:00Z",
      theme: "nuclear",
      symbol: "URA",
      side: "long",
      score: 0.49,
      confidence: 0.71,
      components: [],
      regime: {
        tensionIndex: 0.42,
        tensionRegime: "elevated",
        usBias: 0.34,
        biasFactor: 1.0,
      },
      sizing: {
        targetNotionalUsd: 380_000,
        targetWeight: 0.04,
        capAppliedUsd: null,
      },
      lane: "paper",
    },
    {
      signalId: "sig-005",
      generatedAt: "2026-05-17T15:30:00Z",
      expiresAt: "2026-05-17T20:30:00Z",
      theme: "quantum",
      symbol: "IONQ",
      side: "long",
      score: 0.31,
      confidence: 0.52,
      components: [],
      regime: {
        tensionIndex: 0.42,
        tensionRegime: "elevated",
        usBias: 0.34,
        biasFactor: 1.0,
      },
      sizing: {
        targetNotionalUsd: 95_000,
        targetWeight: 0.009,
        capAppliedUsd: 100_000,
      },
      lane: "shadow",
    },
    {
      signalId: "sig-006",
      generatedAt: "2026-05-17T15:30:00Z",
      expiresAt: "2026-05-17T20:30:00Z",
      theme: "ai_supply_chain",
      symbol: "TSM",
      side: "short",
      score: -0.42,
      confidence: 0.68,
      components: [],
      regime: {
        tensionIndex: 0.42,
        tensionRegime: "elevated",
        usBias: 0.34,
        biasFactor: 1.0,
      },
      sizing: {
        targetNotionalUsd: 220_000,
        targetWeight: 0.02,
        capAppliedUsd: null,
      },
      lane: "paper",
    },
    {
      signalId: "sig-007",
      generatedAt: "2026-05-17T15:30:00Z",
      expiresAt: "2026-05-17T20:30:00Z",
      theme: "tech_broad",
      symbol: "META",
      side: "long",
      score: 0.41,
      confidence: 0.74,
      components: [],
      regime: {
        tensionIndex: 0.42,
        tensionRegime: "elevated",
        usBias: 0.34,
        biasFactor: 1.0,
      },
      sizing: {
        targetNotionalUsd: 480_000,
        targetWeight: 0.045,
        capAppliedUsd: null,
      },
      lane: "live",
    },
    {
      signalId: "sig-008",
      generatedAt: "2026-05-17T15:30:00Z",
      expiresAt: "2026-05-17T20:30:00Z",
      theme: "nuclear",
      symbol: "CEG",
      side: "long",
      score: 0.36,
      confidence: 0.61,
      components: [],
      regime: {
        tensionIndex: 0.42,
        tensionRegime: "elevated",
        usBias: 0.34,
        biasFactor: 1.0,
      },
      sizing: {
        targetNotionalUsd: 145_000,
        targetWeight: 0.013,
        capAppliedUsd: null,
      },
      lane: "paper",
    },
  ],
};

const MOCK_PROMOTIONS: ReadonlyArray<ThemePromotionState> = [
  {
    theme: "ai_supply_chain",
    lane: "live",
    promotedAt: "2026-04-15T09:00:00Z",
    promotedBy: "operator",
    paperWindowDays: 90,
    paperSharpe: 1.42,
  },
  {
    theme: "tech_broad",
    lane: "live",
    promotedAt: "2026-04-15T09:00:00Z",
    promotedBy: "operator",
    paperWindowDays: 90,
    paperSharpe: 1.31,
  },
  {
    theme: "vanguard_core",
    lane: "live",
    promotedAt: "2026-04-15T09:00:00Z",
    promotedBy: "operator",
    paperWindowDays: 90,
    paperSharpe: 0.88,
  },
  {
    theme: "nuclear",
    lane: "paper",
    promotedAt: "2026-05-01T12:00:00Z",
    promotedBy: "operator",
    paperWindowDays: 60,
    paperSharpe: 1.08,
  },
  {
    theme: "quantum",
    lane: "shadow",
    promotedAt: null,
    promotedBy: null,
    paperWindowDays: null,
    paperSharpe: null,
  },
];

export default function ApexSovereignPage() {
  return (
    <ApexPageShell active="/apex/sovereign" maxWidth={1400}>
      <main style={{ display: "grid", gap: 16 }}>
        <ApexHero
          eyebrow="APEX · SOVEREIGN · PHASE 5c"
          title="Sovereign Console"
          copy={
            <>
              Owner-only intelligence layer. Regime tension index over a curated
              5-theme universe (AI supply chain, broad tech, Vanguard core,
              quantum, nuclear) with promotion-lane state per theme. Phase 4
              will reattach the sovereign-role auth gate; Phase 6 wires the live
              signal aggregator.
            </>
          }
          actions={
            <ApexActionGroup>
              <ApexAction href="/apex/hub" tone="success">
                Back to Hub
              </ApexAction>
              <ApexAction href="/apex/research">Research</ApexAction>
              <ApexAction href="/apex/journal">Journal</ApexAction>
            </ApexActionGroup>
          }
          aside={
            <>
              <ApexStatusPill tone="warn">MOCKED · PHASE 5c</ApexStatusPill>
              <div style={{ marginTop: 16, fontSize: 12, lineHeight: 1.6 }}>
                Regime: <strong>elevated</strong> (tension 42, USD-pressure).
                Phase 6 will replace MOCK_SIGNAL_SET +{" "}
                <code>MOCK_PROMOTIONS</code> with{" "}
                <code>generateSovereignSignals()</code> +{" "}
                <code>listThemePromotionStates()</code> from the apex server
                module.
              </div>
            </>
          }
        />

        {/*
          The original /sovereign is full-viewport 2x2 grid; here we
          stack it as a single column inside the cerniq page chrome
          so it composes with the ApexPageShell nav above. Phase 6
          may reintroduce the 2x2 viewport layout once the auth gate
          and data fetchers are wired.
        */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)",
            gap: 12,
            background: COL.bg,
            padding: 12,
            borderRadius: 6,
          }}
        >
          <RegimePanel regime={MOCK_SIGNAL_SET.regime} />
          <ThemeCardsPanel promotions={MOCK_PROMOTIONS} />
          <SignalStreamPanel signals={MOCK_SIGNAL_SET.signals} />
          <PromotionPanel promotions={MOCK_PROMOTIONS} />
        </div>
      </main>
    </ApexPageShell>
  );
}
