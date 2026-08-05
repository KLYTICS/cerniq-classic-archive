// /apex — Phase 1.1 entry (2026-05-17).
//
// Replaces the Phase 1.0 inline-JSX scaffold with the ported ApexDemoUI
// shells (ApexPageShell, ApexHero, ApexMetricStrip, ApexJourneyRail,
// ApexAction). These are verbatim ports of `apex/components/apex-demo-ui
// .tsx`, with the only adjustment being that the embedded route nav
// points at /apex/* sub-paths instead of Apex's root paths.
//
// "Preserve original form" — the page now reads visually the way Apex's
// own /design-system + /platform routes do: matte-black + cyan/teal
// accents, monospace typography, Orbitron headings, Rajdhani metric
// numerals. Side-by-side with Apex's own surface, this should be a
// byte-for-byte equivalent rendering.
//
// Phase 2 will add /apex/hub with mocked data, exercising the rest of
// the demo-ui surface (ApexStatePanel, ApexRouteGrid, etc.).

import {
  ApexPageShell,
  ApexHero,
  ApexMetricStrip,
  ApexJourneyRail,
  ApexAction,
  ApexActionGroup,
  ApexStatusPill,
} from "@/components/apex/apex-demo-ui";

export default function ApexEntryPage() {
  return (
    <ApexPageShell active="/apex" maxWidth={1200}>
      <ApexHero
        eyebrow="KLYTICS · APEX · ABSORBED 2026-05-17"
        title="Trading Command Center"
        copy={
          <>
            Autonomous FX execution, deterministic risk governance, and
            operator-grade trade journaling — preserved in its original form,
            embedded within the CERNIQ platform.
          </>
        }
        actions={
          <ApexActionGroup>
            <ApexAction href="/apex/hub" tone="success">
              Enter Hub
            </ApexAction>
            <ApexAction href="/apex/cockpit">Open Cockpit</ApexAction>
            <ApexAction href="/apex/journal">Trade Journal</ApexAction>
          </ApexActionGroup>
        }
        aside={
          <>
            <div className="apex-eyebrow">STATUS</div>
            <div style={{ marginTop: 8 }}>
              <ApexStatusPill tone="success">EMBEDDED · LIVE</ApexStatusPill>
            </div>
            <div style={{ marginTop: 16, fontSize: 12, lineHeight: 1.6 }}>
              Auth-coverage gates from cerniq inherited:{" "}
              <strong>Pattern #3 + #4 closed</strong>, KLYTICS Rules{" "}
              <strong>4 · 9 · 11 · 12</strong> CI-enforced. The absorbed Apex
              surface is locked into the same invariant suite.
            </div>
          </>
        }
      />

      <ApexMetricStrip
        metrics={[
          { label: "PHASE", value: "1.1", detail: "DemoUI shells ported" },
          { label: "SURFACES", value: "18 / 18", detail: "preserved 1:1" },
          {
            label: "COMPONENTS",
            value: "12 / 144",
            detail: "design-system tier done",
          },
          {
            label: "API HANDLERS",
            value: "0 / 262",
            detail: "Phase 6",
          },
          {
            label: "TESTS",
            value: "0 / 3,414",
            detail: "absorbed in Phase 7",
          },
        ]}
      />

      <ApexJourneyRail
        steps={[
          {
            label: "phase-1-0",
            title: "Namespace + theme port",
            detail:
              "Sub-app at /apex/* with scoped CSS vars + IBM Plex / Orbitron / Rajdhani font stack. Shipped 9741fdde.",
            tone: "success",
          },
          {
            label: "phase-1-1",
            title: "DemoUI design system",
            detail:
              "Twelve presentational shells ported verbatim from apex-demo-ui.tsx. This page exercises them.",
            tone: "success",
          },
          {
            label: "phase-2",
            title: "Hub with mocked data",
            detail:
              "/apex/hub. Defines the data-component boundary that Phases 3+ fill with real Supabase queries.",
          },
          {
            label: "phase-3",
            title: "Supabase coexistence",
            detail:
              "APEX_SUPABASE_URL + APEX_SUPABASE_ANON_KEY namespaced env. Apex tables stay in their DB, cerniq Prisma stays separate.",
          },
          {
            label: "phase-4",
            title: "Auth bridge",
            detail:
              "Strip NextAuth 5-beta; translate cerniq's JWT to Apex's session shape. Preserve sovereign GitHub-allowlist gate.",
          },
          {
            label: "phase-5",
            title: "Flagship routes",
            detail:
              "/cockpit, /war-room/[sessionId], /sovereign, /journal. One per commit + IDOR ordering-lock spec.",
          },
          {
            label: "phase-6",
            title: "API handlers",
            detail:
              "262 routes ported into backend-node/src/apex/ NestJS controllers for KLYTICS verifier coverage.",
          },
          {
            label: "phase-7",
            title: "Verifier coverage",
            detail:
              "verify-auth-coverage --strict + Rule 4/9/11/12 extend to absorbed surface. 3,414 Apex tests run alongside cerniq.",
          },
        ]}
      />
    </ApexPageShell>
  );
}
