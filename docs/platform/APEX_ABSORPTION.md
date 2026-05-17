# Apex absorption

> **Status as of 2026-05-17:** visible-surface complete (Phases 1–3 + 5 shipped via PR #66). Data layer + auth bridge + 25 heavy panels deferred to Phases 4 + 6. KLYTICS verifier coverage extension is Phase 7.

This document maps the absorption of `~/Desktop/apex` (KLYTICS APEX FX trading command center) into cerniq's frontend under the `/apex/*` route namespace. The absorption follows the operator directive *"this must fully swallow all apex functionalities and take on and preserve original form"*.

## Phase status

| Phase | Status | Scope |
|---|---|---|
| **1.0** | ✅ shipped | `frontend/styles/apex-theme.css` scoped to `.apex-shell` + `/apex` layout + namespace scaffold |
| **1.1** | ✅ shipped | 12 ApexDemoUI design-system components (verbatim port of `apex/components/apex-demo-ui.tsx`) |
| **2** | ✅ shipped | `/apex/hub` operator-hub view + mocked `OperatorHubFirstPaintSummary` |
| **3** | ✅ shipped | Data-layer coexistence env contract (`NEXT_PUBLIC_APEX_SUPABASE_URL` / `_ANON_KEY`) + fetcher interface with graceful fallback |
| **4** | ⏳ deferred | Auth bridge — strip Apex's NextAuth 5-beta; translate cerniq's req.user → Apex session shape |
| **5a** | ✅ shipped | `/apex/journal` display-only trade journal (6 mocked records spanning outcome rainbow) |
| **5b** | ✅ shipped | `/apex/cockpit` shell with IntradayPnL + RiskBudget panels (11-tab nav) |
| **5c** | ✅ shipped | `/apex/sovereign` 4-quadrant Bloomberg console (5-theme universe + 8 mocked signals) |
| **5d** | ✅ shipped | `/apex/war-room` lobby with 3 mocked sessions (continuity-state rainbow) |
| **5e** | ✅ shipped | Navigation closure stubs (`/apex/platform`, `/apex/research`, `/apex/community`) |
| **6** | ⏳ pending | 262 API handlers + Zustand store + 25 heavy panel components + 524-line first-paint aggregator |
| **7** | ⏳ pending | KLYTICS verifier extension to absorbed surface; Apex's 3,414 vitest specs alongside cerniq |

## The coexistence decision (locked Phase 3)

Per operator decision 2026-05-16:

- Apex tables stay in their own Supabase project (no migration to cerniq's Prisma schema)
- `NEXT_PUBLIC_APEX_SUPABASE_URL` + `NEXT_PUBLIC_APEX_SUPABASE_ANON_KEY` are namespaced to avoid collision with cerniq's own `SUPABASE_URL` (unified KLYTICS auth)
- When unset, all `/apex/*` surfaces gracefully fall back to mocked data — dev / CI / preview deploys always work without Apex DB credentials
- Phase 6 wires the actual queries; Phase 3 only commits to the interface

## The contract-shim pattern

Every Phase 2–5 port uses the same three-file pattern:

1. **`frontend/lib/apex/<domain>-contracts.ts`** — narrowed types. The original Apex contracts often reach into 10+ lib modules; the shim narrows to *exactly what the view reads*. Phase 6 will widen these to the full contract surface.
2. **`frontend/components/apex/<panel>.tsx`** — verbatim port of the view component. Color constants, layout, copy preserved. Where the original binds to a hook duo (e.g., `useTradeJournal` + `useSessionDraft`), the Phase 5 variant narrows to a single view-model prop + local state.
3. **`frontend/app/apex/<route>/page.tsx`** — wraps the view in `ApexPageShell` + `ApexHero` with mocked data shaped byte-for-byte like production contracts.

The pattern creates **stable interfaces for Phase 4 + 6 to plug into without touching view code**. When the live fetcher returns a real `OperatorHubFirstPaintSummary`, the operator-hub view requires zero changes.

## Routes by Apex top-nav order

| Route | Phase | Original Apex path | Notes |
|---|---|---|---|
| `/apex/platform` | 5e stub | `/platform` | Runtime + infrastructure surface. Phase 6 targets: `runtime-health-strip.tsx` + `workspace-status-strip.tsx` + `system-health.tsx` |
| `/apex` | 1.1 | `/` | Start surface. Hero + metric strip + journey rail showing 8-phase roadmap |
| `/apex/hub` | 2 + 3 | `/hub` | Operator first-paint. Async server component, falls back to mock when Supabase unset |
| `/apex/research` | 5e stub | `/research` | Research-hub view. Phase 6 targets: `lib/research/contracts.ts` + ranked opportunity evidence aggregator |
| `/apex/war-room` | 5d | `/war-room` | Lobby + session list. Heavy panels (continuity card, overnight ops, runtime strip, shift-start console) deferred to Phase 6 |
| `/apex/journal` | 5a | `/journal` | Trade journal table with thesis detail + review actions (display-only) |
| `/apex/community` | 5e stub | `/community` | Collaboration / continuity. Shares deps with war-room's heavy panels |
| `/apex/cockpit` | 5b | `/cockpit` | 11-tab nav + status strip (IntradayPnL + RiskBudget live; tab content deferred) |
| `/apex/sovereign` | 5c | `/sovereign` | 4-quadrant console: regime + theme cards + signal stream + promotion lanes |

## Phase 6 dep cascade

The 25 heavy components from `apex/components/` form a directed dep graph. Phase 6 must port leaves first. Approximate cascade depth (1 = no apex-internal deps; higher = more):

| Component | Source LOC | Cascade depth | Hooks | Notes |
|---|---|---|---|---|
| `IntradayPnL` | 53 | 1 | none | Already ported (Phase 5b) |
| `RiskBudget` | 67 | 1 | none | Already ported (Phase 5b) |
| `OperatorHubSummary` | 244 | 1 | none | Already ported (Phase 2, renamed `operator-hub-summary-view.tsx`) |
| `TradeJournalPanel` | 261 | 1 (after narrowing) | useTradeJournal + useSessionDraft (shimmed to props) | Already ported (Phase 5a, display-only variant) |
| `RuntimeHealthStrip` | 169 | 3 | useOperatorTrust | Deps: `InlineStat`/`Strip` primitives, `tokens` module, `HealthCheckResult`/`RuntimeCapabilities` contracts. Used by both cockpit + war-room. |
| `WorkspaceStatusStrip` | unknown | 3 | useApexStore subset | Cockpit header. Apex Zustand store dep. |
| `ShiftStartConsole` | unknown | 4+ | useShiftStart | Continuity, recovery handoff, paper-operator verdict. Deep dep into shift-start contracts. |
| `OvernightOperationsPanel` | unknown | 4+ | internal state + API fetch | Deep dep into overnight-engine contracts. |
| `BetweenSessionContinuityCard` | unknown | 4+ | shared with war-room | |
| `ApexCockpit` (root) | 408 | — | 4 hooks + 24 Zustand selectors + 25 components | Top of cascade; ports last after all dependencies land |

**Recommended Phase 6 order:**

1. **Phase 6.0** — Design primitives port (`tokens`, `InlineStat`, `Strip`, `Spark`, `Badge`). These are leaves. ~1 commit.
2. **Phase 6.1** — Type contracts port (`HealthCheckResult`, `RuntimeCapabilities`, `OperatorTrust*`, full `OperatorHubFirstPaintSummary` contract surface). ~1 commit.
3. **Phase 6.2** — Hook ports starting with simplest: `useRuntimeSafety`, `useOperatorTrust`. Each wires against the Phase 3 fetcher path. ~2-3 commits.
4. **Phase 6.3** — `RuntimeHealthStrip` port (deps satisfied). Wires into both cockpit and war-room. ~1 commit.
5. **Phase 6.4+** — Continue chipping at depth-3 components.
6. **Phase 6.N** — Zustand store port (lib/store.ts, 24+ field selectors). Most invasive. Must land before ApexCockpit root.
7. **Phase 6.Final** — ApexCockpit root composition replaces the Phase 5b shell.

Parallel track: **262 API handlers** can be ported as NestJS controllers in `backend-node/src/apex/` (per Phase 6 scope), independent of the frontend cascade. Recommendation: port handlers grouped by domain (war-room, journal, sovereign, hub, runtime, ...) into per-domain modules. Each module brings KLYTICS verifier coverage with it (verify-tenant-scope, verify-auth-coverage, verify-rule-9-stamping, verify-rule-11-any-rationale, verify-rule-12-crypto-randomness all auto-scan `backend-node/src/apex/**`).

## Phase 4 — auth bridge (deferred)

Per operator decision 2026-05-16: deferred to Phase 5 (now landed); revisit before Phase 6 wires real data. The pending decision:

- **Option A**: Strip Apex's NextAuth 5-beta entirely. Cerniq's JWT becomes the only session. Translation layer maps cerniq claims (`userId`, `role`, `email`, `workspaceId`) → Apex's session shape (`actorId`, `email`, `role`, `groups`, `githubLogin`, sovereign flag). Preserves Apex's `APEX_SOVEREIGN_GITHUB_LOGINS` gate + stealth 404.
- **Option B**: Run NextAuth alongside cerniq's auth. Operators authenticate twice. Lowest porting effort; worst UX.

Phase 4 is the gate on real data + sovereign-role detection in `/apex/sovereign`.

## Phase 7 — verifier extension

KLYTICS canon rules already cover the absorbed surface where applicable:

- **Rule 11** (any-rationale): backend-only baseline; not relevant to `/apex/*` until Phase 6 backend handlers land.
- **Rule 12** (crypto randomness, frontend): already scans `frontend/app/**` + `components/**` + `lib/**` — automatically covers `frontend/app/apex/**` + `components/apex/**` + `lib/apex/**`. Verified at 629 src files / 0 violations on PR #66.
- **Rule 4, Rule 9, verify-auth-coverage, verify-body-trust, verify-tenant-scope, verify-institution-scope-guard**: backend-only, kick in when Phase 6 lands `backend-node/src/apex/*` controllers.

Phase 7 itself is largely automatic *after* Phase 6 backend code lands — the verifier scan globs already include `backend-node/src/**`. Phase 7's explicit work:

1. Run Apex's existing 3,414 vitest specs alongside cerniq's jest specs. Recommend a separate test runner config (`vitest --config frontend/vitest.apex.config.ts`) to avoid cross-contaminating cerniq's coverage threshold (60/52/55/62).
2. Audit any apex-specific rule exemptions that need explicit baseline entries (Rule 11 `as any` casts in Apex's SDK type-narrowing code, for example).
3. Document any KLYTICS-canon gaps the absorbed code exposes (e.g., Apex's React Error Boundaries in `/war-room` lobby — pattern worth promoting cross-product).

## Sources

- **Original Apex source** (snapshot): `~/Desktop/APEX-recovery-1/` (the `~/Desktop/apex/` directory was cold-storaged per `feedback_cold_storage_pivot`; recovery snapshot retained for ongoing absorption work).
- **PR #66 — Phase 1-3 + 5**: https://github.com/KLYTICS/cerniq/pull/66
- **PR #68 — a11y-sweep CI fix** (closes blocker on PR #66's only red check): https://github.com/KLYTICS/cerniq/pull/68
- **Original dev branch** (8 historical commits preserved): `claude/enterprise-quality-hardening` (commits `9741fdde`, `42935ae1`, `0bf4028a`, `3f579164`, `e1c2d1fa`, `37e3145a`, `2386a09d`, `1b5d296e`).

## Cross-doc references

- `docs/platform/KLYTICS_AUDIT_DISCIPLINE.md` — the 12-rule canon that gates `backend-node/src/apex/*` once Phase 6 lands.
- `docs/platform/STRATEGIC_SCOPE.md` — cerniq's product scope; clarifies how the absorbed FX command center fits alongside the bilingual ALM for PR cooperativas.
- `docs/SESSION_HANDOFF.md` §5 — per-commit landing log including Phase 1.0 entry from 2026-05-17.

## Maintenance contract

Future sessions picking up Apex work should:

1. **Read this doc first.** It saves a session of dep-graph rediscovery.
2. **Update the phase table** when a phase ships. Set ✅ on the row and link the PR.
3. **Don't pile multiple phases on one PR.** Each absorbed surface should be reviewable as a coherent unit. Phase 6's many sub-phases are independent PRs.
4. **Preserve the contract-shim pattern.** Narrow types in `lib/apex/*-contracts.ts` first; widen them only when Phase 6 brings the actual data fetchers.
5. **Update `~/Desktop/APEX-recovery-1/` references if the source moves.** This doc's "Sources" section is the single anchor — fix here, not in every commit message.
