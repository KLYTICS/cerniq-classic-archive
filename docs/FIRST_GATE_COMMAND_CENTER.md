# CERNIQ — First Gate Command Center
## Shared board for 3-terminal execution

This file is the live command center for first-gate work.

Use it with:

- [docs/TERMINAL_COORDINATION.md](/Users/automation/Desktop/CERNIQ%20III-XXIX/docs/TERMINAL_COORDINATION.md)
- `make first-gate-status`
- `make test-all`
- `make test-cov-all`
- `make release-gate`
- `make release-pr`
- `make verify-production`

---

## Shared Commands

```bash
# Quick status for all terminals
make first-gate-status

# Run both suites
make test-all

# Run both coverage flows
make test-cov-all

# PR-gated release gate
make release-gate

# Commit, push, and open the PR from the captain branch
make release-pr

# Production health verification after merge to main
make verify-production
```

Release policy:

- terminals coordinate on a dedicated captain branch, then merge through a PR to `main`
- `main` deploys only after `make release-gate` passes locally and the PR is green in GitHub
- `CI Quick Check` and `CERNIQ CI/CD` remain the post-push protection signals
- Railway and Vercel deploy from `main` after merge

---

## Reporting Format

Every terminal should append updates in this structure to chat or a shared note:

```text
[terminal-X]
Scope: what files / subsystem are owned right now
Owned files: exact files actively being changed
Forbidden shared files: shared frozen files this lane must not touch
Command: exact command run
Result: tests, coverage, or behavior delta
Shared state risks: auth/session files, coverage config, or docs another terminal could collide with
Risk: what could regress
Last verified coverage command/result: exact coverage command and the observed totals
Next: next concrete move
Handoff: who needs to know
Resume here next session: first command or file to pick up without rediscovery
```

---

## Latest Verified Baseline

- Backend tests: `387/387` suites, `2967/2967` tests passing
- Frontend tests: `50/50` files, `374/374` tests passing
- Backend coverage: `80.94%` statements, `61.67%` branches, `81.84%` functions, `81.03%` lines
- Frontend coverage: `98.67%` statements, `90.53%` branches, `98.89%` functions, `98.77%` lines

These are the numbers to carry forward until a terminal posts a newly verified replacement from `make first-gate-status`.

---

## Active Lanes

### Terminal 1 — Coverage Backbone

Target outcomes:

- deterministic coverage commands
- no hidden install or generation steps
- unified reporting
- doc accuracy

Suggested queue:

1. bootstrap/module coverage
2. shared scripts and make targets
3. onboarding docs

### Terminal 2 — Backend / Quant Integrity

Target outcomes:

- backend wiring coverage lift
- controller coverage on primary revenue and onboarding routes
- hard stress-path tests for `-7%` same-day market moves

Suggested queue:

1. `backend-node/src/main.ts`
2. `backend-node/src/app.module.ts`
3. quant/risk/controller gaps tied to shock behavior
4. backend auth/session evidence and continuity docs

### Terminal 3 — Frontend / Operator Correspondence

Target outcomes:

- user-visible claims backed by tests
- stronger onboarding and operator flow coverage
- lower drift between UI copy and backend evidence

Suggested queue:

1. `frontend/lib/api.ts`
2. `frontend/app/login/page.tsx`
3. `frontend/app/contact/page.tsx`
4. `frontend/app/pricing/page.tsx`

Shared state ownership note:

- Terminal 2 may update backend auth/session evidence, controller tests, and shared continuity docs.
- Terminal 3 owns frontend auth/session implementation files unless there is an explicit handoff logged here.

---

## Shared State Risks

Call these out before editing or merging:

- auth/session files: `frontend/lib/api.ts`, `frontend/lib/store.ts`, login/admin/auth initializer flows, backend auth controller/service tests
- coverage config: `frontend/package.json`, `frontend/vitest.config.ts`, `backend-node/package.json`, `Makefile`
- coordination docs: this file plus [docs/TERMINAL_COORDINATION.md](/Users/automation/Desktop/CERNIQ%20III-XXIX/docs/TERMINAL_COORDINATION.md)

If a change touches one of these, the terminal update must name the file and the expected cross-lane effect.

Hard-freeze shared files until backend coverage runs clean twice in a row:

- `scripts/release-gate.sh`
- `backend-node/src/realtime/realtime.gateway.spec.ts`
- `backend-node/src/market-data/market-stream-manager.service.spec.ts`

The release captain lane owns those files, the shared status docs, and `make release-gate` until the backend full coverage run is repeatable.

---

## First-Gate KPIs

The team should report these numbers, and only these numbers, when discussing progress:

- backend tests passing
- frontend tests passing
- backend coverage totals
- frontend coverage totals
- specific high-risk files improved
- quant stress scenarios newly covered

Avoid vague claims like "enterprise-ready" unless tied to these artifacts.

---

## Quant Gate Questions

Before marking a quant-sensitive task complete, answer:

1. Does the test prove behavior under a severe same-day drawdown?
2. Do output narratives still make sense to a risk operator?
3. Is the UI displaying something the backend cannot justify?
4. Did coverage go up on the file that actually carries the risk?

If the answer to any is no, the task is not done.

---

## Live Updates

Entries below are chronological. Later March 29 and March 30, 2026 entries supersede earlier baselines when numbers conflict.

```text
[terminal-2]
Scope: backend reliability + quant integrity; owned files include backend-node/src/prisma.service.ts, backend-node/src/auth/auth.service.spec.ts, backend-node/src/common/interceptors/idempotency-response.interceptor.ts, backend-node/src/common/middleware/request-dedup.middleware.ts, backend-node/src/common/services/graceful-shutdown.service.ts, backend-node/src/swarm/pipeline-orchestrator.service.ts, backend-node/src/execution/backtest.service.ts, backend-node/src/execution/backtest.service.spec.ts
Command: cd backend-node && npm run test:cov -- --coverageReporters=json-summary --coverageReporters=text-summary
Result: backend now runs green at 367/367 suites and 2640/2640 tests with verified coverage 64.67% statements, 49.17% branches, 65.76% functions, 64.57% lines; prior coverage blockers in Prisma import behavior and auth bcrypt test timeouts were removed
Shared state risks: backend auth evidence and shared coverage baselines now affect terminal-1 docs and any terminal consuming shared status numbers
Risk: backend still needs more true coverage on alm-enterprise, reports, ALM controller orchestration, stress-testing, and yield-curve paths before first gate
Next: lift coverage on quant-critical orchestration and severe market-stress behavior, especially same-day -7% shock correspondence
Handoff: terminal-1 should know backend coverage flow is stable; terminal-3 should know shared status script currently reports frontend at 80.30% statements / 81.09% lines
Resume here next session: start with reports/ALM orchestration files that turn backend stress math into operator-visible narratives

[terminal-2]
Scope: backend day-2 shutdown hygiene + quant auditability
Command: cd backend-node && npx jest --detectOpenHandles --runInBand src/common/interceptors/idempotency-response.interceptor.spec.ts src/common/middleware/request-dedup.middleware.spec.ts src/swarm/pipeline-orchestrator.service.spec.ts src/common/services/graceful-shutdown.service.spec.ts
Result: targeted open-handle offenders now pass clean after timer hardening (`unref` + timeout cleanup); backtest engine now stamps trades with simulated market dates instead of wall-clock timestamps, covered by src/execution/backtest.service.spec.ts
Shared state risks: timer cleanup touched shared infrastructure files that other terminals should not refactor casually while coverage baselines are stabilizing
Risk: full-suite detectOpenHandles should be rerun once more after any concurrent lane merges to confirm no new timer leaks were introduced elsewhere
Next: extend quant-facing tests where operator-visible narratives or stress outputs can drift from underlying model behavior
Handoff: all terminals should avoid reworking the timer-cleanup files above unless coordinating explicitly
Resume here next session: rerun the focused detect-open-handles command before widening scope if any merged change touches timers or interceptors

[terminal-2]
Scope: explicit severe down-day quant evidence in backend risk layer
Command: cd backend-node && npx jest src/risk/risk.service.spec.ts --runInBand
Result: added direct same-day `-7%` tests for historical VaR/CVaR sensitivity and portfolio stress-loss correspondence; verified exact 7% portfolio loss math and worst-position attribution under a single-session shock
Shared state risks: frontend or reporting layers must not paraphrase this stress evidence into user-visible claims without matching backend-backed assertions
Risk: additional user-facing narrative layers can still drift if frontend or reporting surfaces paraphrase stress outputs without backend-backed assertions
Next: carry the same-day `-7%` standard upward into report/narrative/orchestration layers, not just raw risk math
Handoff: terminal-3 should avoid UI claims about drawdown resilience unless they map cleanly to these backend-tested stress paths
Resume here next session: move from raw risk math into report and ALM narrative layers, starting with files that summarize stress results for operators

[terminal-3]
Scope: frontend literal-100 closeout on deterministic operator-facing files; owned files include frontend/app/contact/page.tsx, frontend/app/contact/page.test.tsx, frontend/app/login/page.test.tsx, frontend/components/alm/ALMProvider.tsx, frontend/components/alm/ALMProvider.test.tsx, frontend/components/alm/ScenarioChart.tsx, frontend/components/alm/ScenarioChart.test.tsx, frontend/components/auth/AuthInitializer.tsx, frontend/components/auth/AuthInitializer.test.tsx, frontend/components/ui/Avatar.tsx, frontend/components/ui/Avatar.test.tsx, frontend/hooks/useKeyPress.test.ts, frontend/hooks/useLocalStorage.ts, frontend/hooks/useLocalStorage.test.ts, frontend/lib/billing.test.ts, frontend/lib/store.ts, frontend/lib/store.test.ts, frontend/lib/url-params.test.ts
Owned files: the files listed in Scope plus docs/FIRST_GATE_COMMAND_CENTER.md and docs/TERMINAL_COORDINATION.md for baseline sync
Forbidden shared files: scripts/release-gate.sh, backend-node/src/realtime/realtime.gateway.spec.ts, backend-node/src/market-data/market-stream-manager.service.spec.ts
Command: cd frontend && npx vitest run app/contact/page.test.tsx app/login/page.test.tsx components/alm/ALMProvider.test.tsx components/alm/ScenarioChart.test.tsx components/auth/AuthInitializer.test.tsx components/ui/Avatar.test.tsx hooks/useKeyPress.test.ts hooks/useLocalStorage.test.ts lib/billing.test.ts lib/store.test.ts lib/url-params.test.ts && npm run test:cov
Result: frontend is now repeatably green at 50/50 files and 374/374 tests with verified coverage 98.67% statements, 90.53% branches, 98.89% functions, 98.77% lines. Contact, ALMProvider, ScenarioChart, Avatar, billing, keypress, and url-params are fully covered, and the previous one-off worker timeout on useCopyToClipboard proved to be transient because the isolated file and the repeated full coverage rerun both passed cleanly.
Shared state risks: frontend/lib/store.ts remains a shared auth/session file and must stay aligned with auth-session/login behavior; shared docs now quote the new frontend baseline and should not regress to 358-test / 98.07% figures
Risk: literal 100 is still blocked by remaining branch-heavy files such as frontend/lib/api.ts, frontend/app/login/page.tsx, frontend/app/pricing/page.tsx, frontend/components/ui/Modal.tsx, frontend/components/ui/Tabs.tsx, frontend/hooks/useLocalStorage.ts, frontend/hooks/useSSEStream.ts, and small utility files with uncovered branch-only paths
Last verified coverage command/result: cd frontend && npm run test:cov -> 50/50 files, 374/374 tests, 98.67% statements, 90.53% branches, 98.89% functions, 98.77% lines
Next: keep burning down the remaining frontend branch-only misses before reopening unstable backend full-coverage work
Handoff: all terminals should now quote the 374/374 frontend and 98.67/90.53/98.89/98.77 frontend baseline; backend numbers remain unchanged until a new repeatable full backend pass lands
Resume here next session: cd frontend && npm run test:cov, then target frontend/lib/api.ts and frontend/app/login/page.tsx first

[terminal-2]
Scope: backend core first-gate reconciliation; owned files include backend-node/src/main.ts, backend-node/src/main.spec.ts, backend-node/src/app.controller.ts, backend-node/src/app.controller.spec.ts, backend-node/src/prisma.service.ts, backend-node/src/prisma.service.spec.ts, backend-node/src/alm/reports/reports.service.spec.ts, docs/TERMINAL_COORDINATION.md, docs/analysis/POST_SPRINT_STATUS.md
Command: cd backend-node && npm run test:cov -- --coverageReporters=json-summary --coverageReporters=text-summary --runInBand; cd ../frontend && npm run test:cov; cd .. && make first-gate-status
Result: backend core/platform verification is now 369/369 suites and 2673/2673 tests with 68.32% statements, 51.23% branches, 66.74% functions, 68.19% lines. Core files improved to 91.20% statements for src/main.ts, 71.42% for src/app.controller.ts, and 100% for src/prisma.service.ts. Frontend verification is now 49/49 files and 309/309 tests with 92.00% statements, 80.17% branches, 91.49% functions, 92.97% lines. Added explicit same-day `-7%` report-generation correspondence coverage so stressed losses and downstream recommendations stay aligned in backend-produced artifacts.
Shared state risks: repo-wide first gate is still blocked by backend long-tail coverage, and the backend suite still emits a post-run open-handle warning that should be investigated before any production-readiness claim
Risk: active docs must stop quoting the older backend 64.67% and frontend 80.30% baselines as current state
Next: burn down remaining backend orchestration and ALM long-tail files, then rerun the full suite with detect-open-handles discipline
Handoff: all terminals should use the March 29 numbers above or `make first-gate-status`; historical numbers belong only in time-boxed documents

[terminal-2]
Scope: backend ALM long-tail execution coverage plus status reconciliation; owned files include backend-node/src/alm/passthrough-quant-models.spec.ts, backend-node/src/alm/yield-curve.service.spec.ts, backend-node/src/alm/trend-analysis.service.spec.ts, backend-node/src/alm/data-export.service.spec.ts, backend-node/src/alm/excel-export.service.spec.ts, backend-node/src/alm/comprehensive-alm-score.service.spec.ts, docs/TERMINAL_COORDINATION.md, docs/FIRST_GATE_COMMAND_CENTER.md, README.md
Command: cd backend-node && npx jest src/alm/passthrough-quant-models.spec.ts src/alm/yield-curve.service.spec.ts src/alm/trend-analysis.service.spec.ts src/alm/data-export.service.spec.ts src/alm/excel-export.service.spec.ts src/alm/comprehensive-alm-score.service.spec.ts --runInBand; cd backend-node && npm run test:cov -- --coverageReporters=json-summary --coverageReporters=text-summary --runInBand; cd .. && make first-gate-status
Result: backend verification is now 370/370 suites and 2821/2821 tests with 74.26% statements, 55.79% branches, 75.02% functions, 74.09% lines. Core/backend-operator files now sit at 91.20% statements for src/main.ts, 100% for src/app.controller.ts, 100% for src/prisma.service.ts, 92.10% for src/alm/yield-curve.service.ts, 94.36% for src/alm/trend-analysis.service.ts, 92.85% for src/alm/data-export.service.ts, 91.86% for src/alm/excel-export.service.ts, and 100% for src/alm/comprehensive-alm-score.service.ts. Added an executable contract suite for 53 passthrough ALM quant models so those enterprise-facing narratives are now backed by real service execution under stressed inputs instead of placeholder assertions.
Shared state risks: backend ALM specs are now materially denser, so concurrent terminals should avoid renaming or deleting backend ALM spec files without rerunning full coverage; shared docs now carry March 30 verified numbers, not the older March 29-only backend baseline
Risk: repo-wide first gate is still blocked by backend long-tail coverage outside this slice, and the full coverage run still ends with Jest's generic post-run async warning even after the known timeout leak was fixed
Next: target remaining orchestration/controller files with high statement volume or weak branch coverage, then rerun detect-open-handles against the full coverage path if we want to clear the lingering post-run warning completely
Handoff: all terminals should use the March 30 backend baseline above or `make first-gate-status`; do not quote 68.32% as current backend coverage anymore

[terminal-2]
Scope: backend enterprise day-2 correspondence; owned files include backend-node/src/email/email.service.spec.ts, backend-node/src/market-data/market-data.service.spec.ts, backend-node/src/common/controllers/health.controller.ts, backend-node/src/common/controllers/health.controller.spec.ts, backend-node/src/common/controllers/changelog.controller.ts, backend-node/src/common/controllers/changelog.controller.spec.ts, docs/TERMINAL_COORDINATION.md, docs/FIRST_GATE_COMMAND_CENTER.md
Command: cd backend-node && npx jest src/email/email.service.spec.ts src/market-data/market-data.service.spec.ts src/common/controllers/health.controller.spec.ts src/common/controllers/changelog.controller.spec.ts --runInBand; cd backend-node && npm run test:cov -- --coverageReporters=json-summary --coverageReporters=text-summary --runInBand; cd .. && make first-gate-status
Result: backend verification is now 380/380 suites and 2894/2894 tests with 77.63% statements, 58.92% branches, 79.20% functions, 77.56% lines. Added real payload assertions for onboarding, renewal, NPS, demo, and operator alert emails; widened market-data coverage around cache fallback, provider health degradation, and operator snapshot composition; and tightened health/changelog controller behavior so absent optional dependencies degrade status instead of reading as fully healthy, while invalid changelog limits clamp to the documented floor.
Shared state risks: backend operator-health semantics and changelog limit behavior are now stricter, so terminals consuming those endpoints or docs should not assume missing dependencies report `ok` or that a `limit=0` query falls back to the default page size
Risk: repo-wide first gate is still blocked by backend long-tail coverage, and the full coverage run still emits Jest's generic post-run async warning
Next: keep burning down high-miss backend services such as pipeline orchestration, market-data long-tail, and auth/runtime seams with the same evidence-first discipline
Handoff: all terminals should now quote the 380-suite March 30 backend baseline; prior 370-suite figures are historical only

[terminal-2]
Scope: enterprise CI/CD hardening on the existing workflow plus frontend auth/store coverage lift; owned files include .github/workflows/ci-cd.yml, scripts/check-coverage-thresholds.mjs, frontend/lib/store.test.ts, frontend/lib/auth-session.test.ts, frontend/components/SessionTimeoutWarning.test.tsx, docs/FIRST_GATE_COMMAND_CENTER.md
Command: cd frontend && npx vitest run lib/store.test.ts lib/auth-session.test.ts components/SessionTimeoutWarning.test.tsx; cd frontend && npm run test:cov; cd backend-node && npx jest src/instrument.spec.ts src/telemetry.spec.ts src/auth/rbac.guard.spec.ts src/billing/stripe-metering.interceptor.spec.ts src/common/controllers/health.controller.spec.ts src/common/controllers/changelog.controller.spec.ts src/common/filters/database-connection.filter.spec.ts src/common/filters/http-exception.filter.spec.ts src/common/common-literal-coverage.spec.ts --runInBand; cd backend-node && npm run test:cov -- --runInBand --coverageReporters=json-summary --coverageReporters=text-summary; node scripts/check-coverage-thresholds.mjs frontend/coverage/coverage-summary.json frontend 95.93 84.30 95.86 96.78; node scripts/check-coverage-thresholds.mjs backend-node/coverage/coverage-summary.json backend 77.63 58.92 79.20 77.56
Result: frontend verification is now 49/49 files and 331/331 tests with 95.93% statements, 84.30% branches, 95.86% functions, 96.78% lines after direct store/auth/session closeout tests. The existing GitHub workflow now runs coverage in both app jobs, uploads coverage artifacts, and enforces ratcheted minimums through scripts/check-coverage-thresholds.mjs. Backend infra/wrapper coverage additions also pass cleanly, and the full backend verified baseline remains 380/380 suites, 2894/2894 tests, 77.63% statements, 58.92% branches, 79.20% functions, 77.56% lines.
Shared state risks: .github/workflows/ci-cd.yml is now the active shared coverage gate, so other terminals should not add parallel threshold logic elsewhere without coordinating; docs and workflow floors now need to move together after every verified baseline lift
Risk: literal 100% is still blocked by remaining frontend page/component branches and backend long-pole files such as pipeline.worker.ts, alco-pack.service.ts, alm-enterprise.service.ts, email.service.ts, realtime.gateway.ts, and market-data services; full backend coverage still ends with Jest's generic async post-run warning
Next: continue the literal-100 burn-down from the biggest remaining uncovered files, starting with frontend app/pricing/page.tsx and components/dashboard/StockInsightsPopup.tsx or backend src/pipeline/pipeline.worker.ts
Handoff: all terminals should use the 380/2894 backend and 331/331 frontend baselines above; enterprise CI/CD coverage enforcement now lives in .github/workflows/ci-cd.yml
Resume here next session: run `make first-gate-status`, then target `frontend/app/pricing/page.tsx` and `frontend/components/dashboard/StockInsightsPopup.tsx` for the fastest next frontend lift or `backend-node/src/pipeline/pipeline.worker.ts` for the next backend long-pole tranche

[terminal-1]
Scope: release discipline, PR-gated main documentation, and shared release commands; owned files include Makefile, scripts/release-gate.sh, README.md, CONTRIBUTING.md, docs/TERMINAL_COORDINATION.md, docs/FIRST_GATE_COMMAND_CENTER.md, docs/ops/deployment_runbook.md, docs/ops/schema_migration_policy.md
Command: bash scripts/release-gate.sh; make first-gate-status
Result: repo now has a single pre-merge command (`make release-gate`) that runs tests, coverage, and the shared status snapshot before PR merge. Docs now standardize PR-gated `main`, name `CI Quick Check` and `CERNIQ CI/CD` as the merge gate, and align release flow with Railway/Vercel auto-deploy plus explicit Prisma migration control.
Shared state risks: Makefile, release scripts, coordination docs, and deploy runbooks are all shared control points; terminals should not introduce alternative release commands or contradictory deploy guidance without logging the cross-lane effect
Risk: GitHub branch protection itself is an external setting and still must be configured outside the repo to make the documented PR gate mandatory
Next: keep the docs and workflow thresholds in lockstep as verified baselines rise, and burn down the remaining uncovered frontend/backend long poles before claiming first gate
Handoff: all terminals should use `make release-gate` before opening or updating a PR to `main`
Resume here next session: run `make release-gate`, confirm both workflows are green on the PR, then continue the next coverage tranche from the current top uncovered files

[terminal-1]
Scope: shared-main release enforcement, PR-gated release wiring, and production verification commands; owned files include scripts/check-coverage-thresholds.mjs, scripts/release-gate.sh, scripts/release-pr.sh, scripts/release-main.sh, scripts/verify-production.sh, Makefile, README.md, CONTRIBUTING.md, docs/TERMINAL_COORDINATION.md, docs/FIRST_GATE_COMMAND_CENTER.md, docs/ops/deployment_runbook.md
Command: bash scripts/release-gate.sh; make first-gate-status; bash scripts/verify-production.sh
Result: release plumbing now matches the shared-main policy. `make release-gate` runs status, lint, builds, unit/component suites, Playwright, full coverage, and ratcheted coverage-floor enforcement sourced from `.github/workflows/ci-cd.yml`. `make release-pr` stages, commits, pushes the captain branch, and opens the PR to `main`. Coverage-threshold parsing now falls back to `coverage-final.json` when Jest writes `Unknown` totals in `coverage-summary.json`.
Shared state risks: release scripts, Makefile targets, and control docs are now coupled; terminals must not reintroduce PR-gated wording or alternate ship commands without an explicit handoff
Risk: the repo is still below the literal-100 long-term target, so coverage burn-down remains the primary first-gate work even though the current release gate now validates the ratcheted CI floors
Next: continue the literal-100 burn-down from the largest uncovered backend and frontend files, then raise the GitHub coverage floors as new verified baselines land

[terminal-1]
Scope: release-captain integration on the dedicated branch; owned files include .github/workflows/ci-cd.yml, docs/TERMINAL_COORDINATION.md, docs/FIRST_GATE_COMMAND_CENTER.md, docs/ops/deployment_runbook.md, frontend/playwright.config.ts, frontend/e2e/api-health.spec.ts, frontend/app/status/page.tsx, frontend/app/status/page.test.tsx, backend-node/src/instrument.ts, backend-node/src/instrument.spec.ts, backend-node/src/alm/treasury-rates.service.ts
Command: cd backend-node && npm run lint && npm run test:cov -- --runInBand --coverageReporters=text-summary --coverageReporters=json-summary && npm run build; cd ../frontend && npm run lint && npm run test:cov && npm run test:e2e; cd ../services/outbound && python3 -m pytest tests/ -q; cd ../.. && make first-gate-status
Result: release-captain verification is now 382/382 suites and 2921/2921 backend tests with shared-status coverage at 80.17% statements, 61.14% branches, 80.96% functions, and 80.24% lines. Frontend verification is now 50/50 files and 358/358 tests with shared-status coverage at 98.07% statements, 88.69% branches, 97.56% functions, and 98.70% lines. Outbound remains green at 82 passing tests. Playwright is wired to the backend health envelope and status page semantics that the backend actually returns, Sentry profiling now degrades safely when native bindings are unavailable, fallback treasury snapshots are cached consistently, and CI coverage floors have been ratcheted to the latest captain-verified branch state.
Shared state risks: `.github/workflows/ci-cd.yml`, release docs, and `frontend/playwright.config.ts` are active shared control points; do not lower thresholds, change ship commands, or rewrite frontend/backend test server wiring without logging the cross-lane effect first
Risk: repo-wide literal 100 is still not met, and backend long-tail coverage plus the generic Jest post-run async warning remain residual release risks that must be called out honestly in the PR
Next: finish the release-captain PR flow on `codex/first-gate-release`, attach the exact commands and verified totals, and let GitHub Actions re-run the same gate on the branch
Handoff: all terminals should now quote the 2921-backend / 358-frontend / 82-outbound captain baseline or `make first-gate-status`; earlier 2906/331 and 78.46/95.93 figures are historical only
Resume here next session: run `make first-gate-status`, then continue the next backend long-pole tranche only after the release PR is open
Handoff: all terminals should now use `make release-gate`, `make release-pr`, and `make verify-production` as the only supported ship path around `main`
Resume here next session: run `make first-gate-status`, then attack the next highest uncovered risk-bearing files before attempting `make release-gate`

[terminal-1]
Scope: release-captain rerun after frontend coverage flake triage; owned files include .github/workflows/ci-cd.yml, docs/TERMINAL_COORDINATION.md, docs/FIRST_GATE_COMMAND_CENTER.md, frontend/vitest.config.ts, frontend/package.json, frontend/next.config.ts, scripts/run-frontend-coverage.sh
Command: make release-gate; cd frontend && NEXT_PUBLIC_NODE_API_URL=http://127.0.0.1:3000 npm run build; cd frontend && npm run test:cov
Result: backend rerun is now 387/387 suites and 2967/2967 tests with 80.94% statements, 61.67% branches, 81.84% functions, and 81.03% lines. Frontend rerun is now 50/50 files and 374/374 tests with 98.67% statements, 90.53% branches, 98.89% functions, and 98.77% lines. The combined release gate exposed a real flake in Vitest's shared `frontend/coverage/.tmp` handling, so frontend coverage now writes to a unique per-run directory and only atomically replaces `frontend/coverage` after success. The noisy Next workspace-root warning is also gone after pinning `turbopack.root` to the frontend workspace.
Shared state risks: `.github/workflows/ci-cd.yml`, `frontend/package.json`, `frontend/vitest.config.ts`, `frontend/next.config.ts`, and `scripts/run-frontend-coverage.sh` are active shared control points; do not reintroduce shared coverage paths or root autodetection drift without rerunning the captain gate
Risk: the full `make release-gate` run still needs one clean end-to-end pass after the frontend coverage isolation fix, and the backend generic post-run async warning remains a PR residual risk if it reappears under the full combined gate
Next: rerun `make release-gate`, then stage, commit, push, and open the PR if the branch stays green
Handoff: all terminals should now quote the 2967-backend / 374-frontend / 82-outbound captain baseline or `make first-gate-status`; earlier 2921/358 figures are historical only
Resume here next session: run `make release-gate` from `codex/first-gate-release`, then continue git/PR flow only if the combined gate is green
```
