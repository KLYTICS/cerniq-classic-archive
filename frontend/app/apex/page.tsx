// /apex — Phase 1.0 entry page (2026-05-17).
//
// Minimal Apex-themed landing surface. Establishes the absorption
// boundary visually before any of Apex's data-dependent components
// (cockpit, hub, war-room, sovereign, journal) are ported.
//
// "Preserve original form" — uses Apex's exact CSS vars (loaded via
// the sub-app layout's apex-theme.css import) + Apex's font stack +
// Apex's matte-black-cyan aesthetic. The phrasing on this entry
// page mirrors the manifesto tone from
// `docs/APEX_SPACESHIP_PRODUCT_VISION.md` while staying
// professional-decision-system-flavored per CTO_MEMORY/02 (the
// product-principles doctrine).
//
// Phase 1.1 will replace this scaffold body with the ported
// `ApexPageShell` + `ApexHero` + `ApexJourneyRail` components from
// apex-demo-ui.tsx.

export default function ApexEntryPage() {
  return (
    <main className="apex-page">
      <div
        style={{
          maxWidth: 960,
          margin: "0 auto",
          paddingTop: 80,
        }}
      >
        <div
          style={{
            fontSize: 11,
            letterSpacing: "0.3em",
            color: "var(--apex-label)",
            textTransform: "uppercase",
            marginBottom: 16,
          }}
        >
          KLYTICS · APEX
        </div>

        <h1
          style={{
            fontSize: 48,
            lineHeight: 1.05,
            margin: "0 0 24px",
          }}
        >
          Trading Command Center
        </h1>

        <p
          className="apex-prose"
          style={{
            fontSize: 18,
            lineHeight: 1.55,
            color: "var(--apex-muted)",
            maxWidth: 720,
            marginBottom: 48,
          }}
        >
          Autonomous FX execution, deterministic risk governance, and
          operator-grade trade journaling — preserved in its original form,
          embedded within the CERNIQ platform.
        </p>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: 16,
            marginBottom: 64,
          }}
        >
          {[
            { label: "STATUS", value: "EMBEDDED", tone: "success" as const },
            { label: "PHASE", value: "1.0", tone: "label" as const },
            { label: "SURFACES", value: "18 / 18", tone: "label" as const },
            { label: "IDENTITY", value: "PRESERVED", tone: "success" as const },
          ].map((stat) => (
            <div
              key={stat.label}
              style={{
                background: "var(--apex-panel)",
                border: "1px solid var(--apex-border)",
                borderRadius: "var(--apex-radius)",
                padding: "16px 20px",
              }}
            >
              <div
                style={{
                  fontSize: 10,
                  letterSpacing: "0.2em",
                  color: "var(--apex-subtle)",
                  marginBottom: 8,
                }}
              >
                {stat.label}
              </div>
              <div
                className="apex-metric-value"
                style={{
                  fontSize: 28,
                  color:
                    stat.tone === "success"
                      ? "var(--apex-success)"
                      : "var(--apex-label)",
                }}
              >
                {stat.value}
              </div>
            </div>
          ))}
        </div>

        <div
          style={{
            background: "var(--apex-panel-strong)",
            border: "1px solid var(--apex-border)",
            borderRadius: "var(--apex-radius)",
            padding: 24,
            color: "var(--apex-muted)",
            fontSize: 13,
            lineHeight: 1.6,
          }}
        >
          <strong style={{ color: "var(--apex-label)" }}>
            Phase 1.0 scaffold:
          </strong>{" "}
          this namespace exists. Phase 1.1 ports ApexDemoUI shells; Phase 2
          embeds the simulation hub with mocked data; Phase 3+ wires the
          Supabase coexistence layer, NextAuth → cerniq-JWT bridge, flagship
          routes (cockpit, war-room, sovereign, journal), and the 262 API
          handlers. KLYTICS verifier coverage extends to absorbed surface in
          Phase 7.
        </div>
      </div>
    </main>
  );
}
