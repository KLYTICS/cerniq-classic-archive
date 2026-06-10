// /apex/platform — Phase 5e closure stub (2026-05-17).
//
// One of three navigation-loop closures for top-nav routes that
// didn't get a flagship port under Phase 5 (the others: /apex/research,
// /apex/community). The top-nav ApexRouteNav from Phase 1.1 lists
// all 7 absorbed surfaces; without these stubs, clicking Platform /
// Research / Community produces a 404 mid-demo.
//
// Each stub renders ApexPageShell + ApexHero + ApexEmptyState
// explaining that this surface ports in Phase 6 alongside its
// backing data + API handlers. The page is intentionally minimal
// — Phase 6 will fully replace this file with the actual surface
// port.
//
// "Preserve original form" intentionally NOT applied here: the
// original /platform was Apex's runtime + infrastructure dashboard
// (telemetry, deploy state, broker connectivity). Porting that
// faithfully requires the runtime-safety hook + broker truth
// snapshot + Vercel telemetry surface — all Phase 6 concerns.

import {
  ApexAction,
  ApexActionGroup,
  ApexEmptyState,
  ApexHero,
  ApexPageShell,
  ApexStatusPill,
} from "@/components/apex/apex-demo-ui";

export default function ApexPlatformPage() {
  return (
    <ApexPageShell active="/apex/platform" maxWidth={1200}>
      <ApexHero
        eyebrow="APEX · PLATFORM · PHASE 5e STUB"
        title="Platform"
        copy={
          <>
            Runtime + infrastructure surface — telemetry, deploy state, broker
            connectivity health. The original Apex /platform composes against
            the runtime-safety hook + broker-truth snapshot + Vercel deploy
            state, each of which ports in Phase 6 alongside the backing API
            handlers.
          </>
        }
        actions={
          <ApexActionGroup>
            <ApexAction href="/apex/hub" tone="success">
              Back to Hub
            </ApexAction>
            <ApexAction href="/apex">Start</ApexAction>
          </ApexActionGroup>
        }
        aside={
          <>
            <ApexStatusPill tone="warn">PHASE 6 STUB</ApexStatusPill>
            <div style={{ marginTop: 16, fontSize: 12, lineHeight: 1.6 }}>
              Closure stub. Top-nav reachability preserved so clicking Platform
              from any surface doesn&apos;t 404. Phase 6 replaces this with the
              runtime-safety + broker-truth telemetry view.
            </div>
          </>
        }
      />
      <ApexEmptyState>
        Phase 6 will port the original{" "}
        <code>apex/components/runtime-health-strip.tsx</code> +{" "}
        <code>workspace-status-strip.tsx</code> + <code>system-health.tsx</code>{" "}
        here, wired to the runtime-safety hook against the Phase 3 coexistence
        path.
      </ApexEmptyState>
    </ApexPageShell>
  );
}
