# Repo Green Checklist

Date validated locally: 2026-04-08

## Purpose

This is the canonical release-integrity checklist for the CERNIQ repository. Use it as the source of truth for whether the repo is locally green and rerun-ready.

GitHub workflow wiring is centralized through:

- `.github/actions/setup-node-project/action.yml`
- `.github/actions/setup-python-project/action.yml`

The authoritative remote signals are:

- `CERNIQ CI/CD`
- `ALM Quality Gate`

`CI Quick Check` is a temporary compatibility shim and should stay green, but
it is not the long-term source of truth.

`CodeQL Security Analysis` should pass when repository code scanning is
enabled. If the repository feature is disabled, the workflow now emits a
notice and exits cleanly instead of failing the branch on SARIF upload.

Remote GitHub Actions may still appear red when billing is suspended. If a workflow reports:

`The job was not started because recent account payments have failed or your spending limit needs to be increased.`

that is an operational blocker, not a code regression.

## Required Validation

Backend:

- `cd backend-node && npx tsc --noEmit`
- `cd backend-node && npx prisma validate`
- `cd backend-node && npx eslint "{src,apps,libs,test}/**/*.ts"`
- `cd backend-node && npm run test -- --forceExit`
- `cd backend-node && npm run test -- --detectOpenHandles --runInBand`
- `cd backend-node && npm run build`

Backend E2E and security:

- `cd backend-node && REDIS_URL=redis://localhost:6380 npx jest --config ./test/jest-e2e.json --runInBand`

Frontend:

- `cd frontend && npm run lint`
- `cd frontend && npm run build`
- `cd frontend && npx vitest run`

Frontend browser validation:

- `cd frontend && npx playwright test --reporter=github`
- `cd frontend && npm run test:e2e:production`

Outbound:

- `python -m pytest services/outbound/tests -q`

Cleanliness:

- `npm run verify:clean`
- `git status --short` should remain empty after canonical local verification

Public production verification:

- `bash scripts/health-check.sh https://api.cerniq.io https://cerniq.io`
- `bash scripts/smoke-test.sh https://api.cerniq.io`

Production-authenticated or mutating smoke:

- Only run with explicit intent and safe credentials
- Use `ALLOW_PRODUCTION_MUTATIONS=1 bash scripts/smoke-test.sh https://api.cerniq.io`
- Success means public routes return `200`, while protected routes correctly reject with `401/403`

## Current Baseline

- Backend unit/build gates: pass
- Backend Prisma validation: pass
- Backend TypeScript: pass
- Backend non-mutating ESLint: pass
- Backend unit tests: `453` suites / `5705` tests
- Backend E2E/security: `4` suites / `64` tests
- Frontend lint/build/Vitest: pass
- Frontend Vitest: `67` files / `543` tests
- Frontend default Playwright: `51` passed / `2` preview-only skips
- Frontend production-critical Playwright: `5` tests
- Outbound pytest: `82` tests
- Public production gate (`scripts/health-check.sh`): `13/13` passed
- Public production smoke (`scripts/smoke-test.sh https://api.cerniq.io`): `31` passed, `0` failed, `4` intentional skips

## Release Gate Expectations

- CI release integrity requires `backend-test`, `backend-e2e`, `frontend-test`, `frontend-e2e`, and `outbound-test`.
- `CERNIQ CI/CD` is the full release-integrity pipeline.
- `ALM Quality Gate` is the path-scoped ALM/session guardrail pipeline.
- `frontend-e2e` must run on pull requests and on pushes to `main`.
- `deploy-backend` and `deploy-frontend` must both depend on `release-gate`.
- Public production validation is green when read-only public endpoints return `200` and protected/admin routes reject unauthenticated access with `401/403`.
- The CSV onboarding template is part of the public production gate through the frontend-hosted asset at `/templates/cerniq-balance-sheet-v1.csv`, not a backend API requirement.
- In read-only public-production mode, market-data quote/snapshot probes are advisory because upstream providers can transiently return `404` while the ALM wedge remains fully operational.
- Repo-level wrapper checks `npm run verify:backend`, `npm run verify:frontend`, and `npm run smoke:production` should all execute cleanly on a locally green worktree.
- Repo-level wrapper checks are only fully green when they also leave the tracked worktree clean.
- Volatile OMX runtime state and generated Playwright report/test output must never remain tracked source artifacts.
- If `ALM Quality Gate` fails on `Prisma Schema Drift`, generate and commit the missing Prisma migration instead of weakening the workflow.

## Known Non-Blocking Debt

- GitHub Actions can remain red until repository/account billing is restored, even when the repo is locally green.
