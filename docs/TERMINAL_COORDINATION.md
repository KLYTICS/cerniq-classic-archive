# CERNIQ — First Gate Terminal Coordination
## March 30, 2026

> Purpose: coordinate a 3-terminal push to first gate without duplicating effort, inventing progress, or lowering standards.

---

## Mission

Get CERNIQ to a credible first gate for enterprise onboarding:

- coverage work is reproducible from a fresh clone
- core backend and frontend suites are green
- documentation reflects reality
- quant-facing outputs behave credibly under stress, including severe down-day scenarios
- contributors can work in parallel without stomping on each other

This document is an execution board, not a marketing page.

---

## Evidence Baseline

Last verified in-repo on March 30, 2026. This supersedes the earlier March 29 and earlier March 30 baselines:

| Metric | Current Verified State |
|--------|------------------------|
| Backend tests | 387 suites, 2,967 tests passing |
| Frontend tests | 50 files, 374 tests passing |
| Backend coverage | 80.94% statements, 61.67% branches, 81.84% functions, 81.03% lines |
| Frontend coverage | 98.67% statements, 90.53% branches, 98.89% functions, 98.77% lines |
| Coverage workflow | Working from fresh clone after Prisma + Vitest fixes, plus isolated per-run frontend coverage output |

Current state is still not first gate yet because the branch evidence is green but the combined repo release gate has to stay repeatable across concurrent terminal churn and then clear PR CI.

---

## First Gate Definition

CERNIQ reaches first gate only when all of the following are true:

1. Coverage
   - Backend and frontend coverage are enforced and reproducible.
   - Coverage gaps on revenue-critical, onboarding-critical, and quant-critical flows are closed first.
   - Coverage ratchets must come from real exercised behavior, not coverage-by-exclusion.

2. Enterprise Quality
   - Fresh-clone setup is deterministic.
   - Tests reflect actual user and operator workflows.
   - Docs do not overstate readiness.
   - Failure modes are explicit, observable, and recoverable.

3. Quant Credibility
   - Stress outputs remain coherent under sharp market moves.
   - A same-day `-7%` equity shock must have explicit test coverage across risk, VaR/stress narratives, portfolio outputs, and any user-visible recommendations that depend on market state.
   - No user-facing quant statement should survive if it is unsupported by code paths or tests.

4. Operator Usability
   - A day-2 operator can run tests, inspect failures, regenerate coverage, and understand where the system is trustworthy versus provisional.
   - Session recovery must rely on backend-backed truth; stale browser artifacts must not recreate operator trust or quant claims on their own.

---

## Terminal Ownership

Each terminal owns a lane. Do not edit outside your lane unless you announce a handoff.

`main` remains the production deployment branch, but terminal work should integrate on a dedicated captain branch and land through a PR to `main` after `make release-gate` passes.

### Terminal 1 — Coverage Backbone

Owns:

- test runner reliability
- coverage configuration
- thresholds and reporting
- bootstrap/module coverage gaps
- contributor docs for setup, test, and coverage

Primary targets:

- `backend-node/package.json`
- `frontend/package.json`
- `frontend/vitest.config.ts`
- `frontend/vitest.setup.ts`
- `README.md`
- `CONTRIBUTING.md`
- docs related to setup/testing/coordination

Definition of done:

- fresh clone runs backend and frontend coverage without hidden manual fixes
- coverage artifacts and commands are documented accurately

### Terminal 2 — Backend + Quant Stress Integrity

Owns:

- backend coverage lift on controllers, services, and wiring
- quant model validation under stress
- `-7%` same-day market shock scenarios
- enterprise-risk behavior for ALM, liquidity, portfolio, and market data flows

Primary targets:

- backend bootstrap and wiring: `src/main.ts`, `src/app.module.ts`, `src/prisma.service.ts`
- untested or low-confidence controllers/modules
- market shock, risk, valuation, portfolio, and ALM services

Definition of done:

- tests prove outputs remain internally consistent under severe market moves
- controllers and service integrations have meaningful assertions, not only snapshot-level smoke

### Terminal 3 — Frontend + Operator Correspondence

Owns:

- frontend coverage lift on user-facing pages and shared libs
- UI correctness for onboarding, pricing, contact, login, portal, and dashboard flows
- ensuring rendered copy and metrics correspond to backend-tested behavior

Primary targets:

- `frontend/lib/api.ts`
- `frontend/app/login/page.tsx`
- `frontend/app/contact/page.tsx`
- `frontend/app/pricing/page.tsx`
- shared UI primitives with low branch coverage

Definition of done:

- user-visible outputs match supported backend behavior
- onboarding and operator flows are covered by tests that reflect real navigation and state transitions

---

## Communication Contract

Communication is the primary job. Every terminal should keep a short running log with:

- files owned right now
- exact commands run
- test or coverage delta produced
- blockers created by another lane
- explicit handoffs when scope changes

Use this format in updates:

```text
[terminal-X]
Scope:
Owned files:
Forbidden shared files:
Command:
Result:
Shared state risks:
Last verified coverage command/result:
Next:
Blocker:
Resume here next session:
```

Rules:

- announce before broad refactors
- announce before changing shared config
- never silently “fix” another terminal's failures without a handoff
- do not rewrite docs to hide uncovered behavior
- if a change touches auth/session files, coverage config, or coordination docs, name the file and expected cross-lane impact in `Shared state risks`
- include the exact verification commands you ran before handing off
- include a concrete resume command or file so another terminal can continue without rediscovery

Shared state risk zones:

- auth/session state: `frontend/lib/api.ts`, `frontend/lib/store.ts`, login/auth initializer/admin key flows, backend auth controller/service tests
- coverage backbone: `frontend/package.json`, `frontend/vitest.config.ts`, `backend-node/package.json`, `Makefile`
- coordination docs: [docs/FIRST_GATE_COMMAND_CENTER.md](/Users/automation/Desktop/CERNIQ%20III-XXIX/docs/FIRST_GATE_COMMAND_CENTER.md) and this file

Hard-freeze shared files until backend coverage runs clean twice in a row:

- `scripts/release-gate.sh`
- `backend-node/src/realtime/realtime.gateway.spec.ts`
- `backend-node/src/market-data/market-stream-manager.service.spec.ts`

Only one terminal may own those files at a time. No terminal may delete, rename, or rewrite them during an active coverage run.

---

## Burn-Down Order

Do not chase random percentages. Burn down in this order:

1. Broken or misleading infrastructure
2. Bootstrap and wiring
3. Revenue-critical and onboarding-critical flows
4. Quant-critical stress and reporting flows
5. Shared libraries used by many surfaces
6. Long-tail modules

---

## Highest-Impact Gaps Right Now

### Backend

Lowest-value confidence areas include:

- `src/main.ts`
- `src/app.module.ts`
- `src/prisma.service.ts`
- bootstrap modules with 0% coverage
- low-confidence controller and module wiring paths

### Frontend

Lowest-coverage files currently include:

- `frontend/components/dashboard/StockInsightsPopup.tsx`
- `frontend/lib/store.ts`
- `frontend/lib/auth-session.ts`
- `frontend/hooks/useLocalStorage.ts`
- `frontend/hooks/useMediaQuery.ts`
- `frontend/components/SessionTimeoutWarning.tsx`

---

## Quant Stress Standard

For any quant-facing change, ask:

1. What happens on a same-day `-7%` market move?
2. What happens to VaR, drawdown, liquidity, concentration, and narrative outputs?
3. Do recommendations remain sane for a veteran operator?
4. Is the behavior tested, or merely plausible?

Minimum acceptable evidence for quant-sensitive code:

- deterministic unit tests for stress calculations
- edge cases for bad or sparse data
- tests that assert the narrative/output correspondence, not just the math helper
- reload or re-entry paths that prove stale browser state cannot become a source of truth for quant recommendations or operator-only access

---

## Red Lines

Do not:

- claim first gate or "100%" if it was achieved by excluding hard files
- label the system production-ready without current evidence
- merge broad behavior changes without tests
- let frontend copy imply regulatory or quant confidence the code cannot support
- push to `main` before `make release-gate` is green and both stacks meet the current ratcheted coverage floors

---

## Release Gate

Standard release sequence:

1. Work in your owned lane and announce shared-state risks before editing control files
2. Run `make release-gate`
3. Confirm backend and frontend both meet the current verified coverage floors and that active docs match the branch evidence
4. If Prisma schema changed, run the explicit migration procedure from [docs/ops/schema_migration_policy.md](/Users/automation/Desktop/CERNIQ%20III-XXIX/docs/ops/schema_migration_policy.md)
5. Run `make release-pr`
6. Monitor GitHub Actions, Railway, and Vercel
7. Run `make verify-production`

---

## Session Objective

Push toward first gate with discipline:

- truthful status
- parallel ownership
- measurable coverage gains
- stronger quant stress behavior
- cleaner onboarding docs

If a change does not improve one of those, it is not first-gate work.
