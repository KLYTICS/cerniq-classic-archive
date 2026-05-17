// /apex/community — Phase 5e closure stub (2026-05-17).
//
// See ../platform/page.tsx for the closure-stub rationale.
// /apex/community is the operator-continuity / shift-handoff / inbound-
// coordination surface; porting it faithfully requires the collaboration
// bootstrap snapshot + terminal-ownership graph, both Phase 6 concerns
// that share dependencies with the /apex/war-room lobby surfaces.

import {
  ApexAction,
  ApexActionGroup,
  ApexEmptyState,
  ApexHero,
  ApexPageShell,
  ApexStatusPill,
} from "@/components/apex/apex-demo-ui";

export default function ApexCommunityPage() {
  return (
    <ApexPageShell active="/apex/community" maxWidth={1200}>
      <ApexHero
        eyebrow="APEX · COMMUNITY · PHASE 5e STUB"
        title="Community"
        copy={
          <>
            Operator continuity threads, shift-handoff notes, and inbound
            coordination across desks. The original Apex /community is backed by
            the collaboration-bootstrap snapshot + terminal- ownership graph,
            both of which port in Phase 6 alongside the backing
            /api/collaboration/* handlers.
          </>
        }
        actions={
          <ApexActionGroup>
            <ApexAction href="/apex/hub" tone="success">
              Back to Hub
            </ApexAction>
            <ApexAction href="/apex/war-room">War Room</ApexAction>
          </ApexActionGroup>
        }
        aside={
          <>
            <ApexStatusPill tone="warn">PHASE 6 STUB</ApexStatusPill>
            <div style={{ marginTop: 16, fontSize: 12, lineHeight: 1.6 }}>
              Closure stub. Top-nav reachability preserved so clicking Community
              doesn&apos;t 404. Phase 6 wires the collaboration-bootstrap
              snapshot against the Phase 3 coexistence path.
            </div>
          </>
        }
      />
      <ApexEmptyState>
        Phase 6 will port the collaboration-state aggregator + handoff thread
        viewer. These share dependencies with the /apex/war-room lobby&apos;s
        heavy panels (BetweenSessionContinuityCard, OvernightOperationsPanel) —
        likely shipped together.
      </ApexEmptyState>
    </ApexPageShell>
  );
}
