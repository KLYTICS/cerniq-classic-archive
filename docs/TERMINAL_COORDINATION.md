# CerniQ — Platform Status
## March 29, 2026

## PRODUCTION READY — 150+ Quant Models

| Metric | Value |
|--------|-------|
| **Tests** | **1,630 passing, 225 suites** |
| **TypeScript** | **0 errors (strict mode)** |
| **Services** | **282** |
| **Quant Models** | **170+** |
| **ALM Services** | **220+** |
| **Git Commits** | **329** |
| **Production** | **Live — cerniq.io + api.cerniq.io** |

## Session Achievements

- Started at 248 tests → **1,630 tests** (+1,382)
- Started at 17 suites → **225 suites** (+208)
- Started at 9.58% coverage → **~36% coverage**
- Started at 41 TS errors → **0 errors**
- Started at ~46 quant models → **170+ quant models**
- Fixed 2 HIGH security findings → **0 findings**
- Found and fixed VaR NaN bug, SwapValuation recursion bug
- Built: Earnings Simulation, Liquidity Survival, P&L Attribution, Data Quality Monitor, Regulatory Deadline Tracker
- Full Prisma migration (Float→Decimal, indexes, cascades, updatedAt)
- Production verified live with all endpoints responding

## Available Work

1. Wire new quant models to frontend pages
2. Build multi-institution CPA dashboard (Phase 2)
3. COSSEC regulatory report parser
4. Model registry for version tracking
5. Additional E2E Playwright tests

---

## Cross-Session Handoff
### March 30, 2026

Canonical repo-green checklist:

- See `docs/ops/REPO_GREEN_CHECKLIST.md` for the current release-integrity baseline and command set.

**Latest validated results**

- Backend unit/build gates: pass
- Backend unit tests: **2,643 tests, 367 suites passing**
- Backend E2E/security: **64 tests, 4 suites passing**
- Frontend lint/build/Vitest: pass
- Frontend component tests: **257 tests passing**
- Outbound tests: **82 tests passing**

**Current blocker to GitHub greens**

- GitHub Actions is not executing jobs because repository Actions billing is suspended.
- Latest failed runs on `main`, including the post-merge push for commit `c559a78e21e487c86ad3e05eb4a54a8034032784` on March 30, 2026, do **not** indicate code regressions; they fail before jobs start with:
  `The job was not started because recent account payments have failed or your spending limit needs to be increased.`

**Operator notes**

- Actual checked-out branch is `codex/enterprise-green-recovery`, currently **8 commits ahead of `main`** with a large dirty worktree. Treat those edits as active session state; do not reset blindly or switch branches without reconciling them first.
- Local Docker services available during verification:
  - Postgres: `localhost:5433`
  - Redis: `localhost:6380`
- For backend local verification, the passing env was:
  - `DATABASE_URL=postgresql://cerniq:cerniq@localhost:5433/cerniq`
  - `REDIS_URL=redis://localhost:6380`
  - `JWT_SECRET=ci-test-secret-must-be-at-least-32-characters-long`

**Live incident note — March 30, 2026**

- User-reported symptom: CERNIQ page appeared to refresh every ~2 seconds.
- Frontend diagnosis: portal and billing flows were reading wrapped API responses (`{ success, data }`) as raw payloads, which could corrupt auth/subscription/job state and create redirect churn.
- Hotfix release status:
  - PR `#25` merged to `main` at commit `c559a78e21e487c86ad3e05eb4a54a8034032784`
  - direct Vercel production deploy `dpl_47yYrrVkEkNkbaehyQtSqB9VVuqq` is `READY`
  - production aliases now point at the hotfix deploy: `cerniq.io`, `www.cerniq.io`
- Fix landed in frontend response normalization:
  - added `frontend/lib/api-response.ts`
  - updated portal layout, portal jobs/report pages, submit flow, billing portal action, and progress fallback polling to unwrap the standard envelope consistently
  - added a portal auth-bootstrap guard so protected portal content stays hidden until `/api/auth/profile` resolves or redirects
  - updated billing helper tests and added dedicated response-helper tests
- Validation after fix:
  - `frontend`: lint pass
  - clean hotfix branch Vitest: `253/253` tests pass
  - production build pass
- Live verification after production deploy:
  - `PLAYWRIGHT_SKIP_WEBSERVER=1 PLAYWRIGHT_BASE_URL=https://cerniq.io PLAYWRIGHT_BACKEND_URL=https://api.cerniq.io npx playwright test e2e/production-critical.spec.ts --reporter=line`
  - result: `5 passed, 2 skipped`
  - confirmed: homepage, login, pricing, portal login, and API health all passed on live production
  - unauthenticated `GET /api/auth/profile` returns a clean `401 UNAUTHORIZED` JSON payload on production
  - live portal login submission with reserved dummy email `nobody+smoke@invalid.example` stayed on `/portal/login`, rendered the "Check your email" success state, and produced no browser console or page errors
- If the user still sees a live-site refresh loop after this deploy, reproduce next with browser tooling against `https://cerniq.io/portal` while authenticated and inspect network redirects/401s before changing unrelated code.

**Next action once billing is restored**

1. Push or commit the intended worktree state.
2. Re-run GitHub Actions on `main`.
3. If any workflow still fails after billing is fixed, reproduce only the failing job locally using `docs/ops/REPO_GREEN_CHECKLIST.md`.
