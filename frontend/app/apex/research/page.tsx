// /apex/research — Phase 5e closure stub (2026-05-17).
//
// See ../platform/page.tsx for the closure-stub rationale. /apex/research
// is the research-notes + market-hypothesis + FX-regime-analysis surface
// in Apex's original; porting it faithfully requires the research-hub
// summary + ranked opportunity evidence aggregator + macro lens, all
// Phase 6 concerns.

import {
  ApexAction,
  ApexActionGroup,
  ApexEmptyState,
  ApexHero,
  ApexPageShell,
  ApexStatusPill,
} from "@/components/apex/apex-demo-ui";

export default function ApexResearchPage() {
  return (
    <ApexPageShell active="/apex/research" maxWidth={1200}>
      <ApexHero
        eyebrow="APEX · RESEARCH · PHASE 5e STUB"
        title="Research"
        copy={
          <>
            Research notes, market hypotheses, and FX regime analyses feeding
            paper-trade decisions. The original Apex /research renders against
            the research-hub summary + ranked opportunity evidence, both of
            which port in Phase 6.
          </>
        }
        actions={
          <ApexActionGroup>
            <ApexAction href="/apex/hub" tone="success">
              Back to Hub
            </ApexAction>
            <ApexAction href="/apex/journal">Journal</ApexAction>
            <ApexAction href="/apex/sovereign">Sovereign</ApexAction>
          </ApexActionGroup>
        }
        aside={
          <>
            <ApexStatusPill tone="warn">PHASE 6 STUB</ApexStatusPill>
            <div style={{ marginTop: 16, fontSize: 12, lineHeight: 1.6 }}>
              Closure stub. Top-nav reachability preserved so the research
              surface doesn&apos;t 404. Phase 6 wires the real research-hub
              aggregator behind the Phase 3 coexistence path.
            </div>
          </>
        }
      />
      <ApexEmptyState>
        Phase 6 will port apex&apos;s research-hub view + ranked opportunity
        evidence rail. The data hook backs onto
        <code>lib/research/contracts.ts</code> in the original; Phase 6 ports
        those contracts alongside the API handler.
      </ApexEmptyState>
    </ApexPageShell>
  );
}
