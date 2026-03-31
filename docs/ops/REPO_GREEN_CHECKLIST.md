# Repo Green Checklist

Date validated locally: 2026-03-30

## Purpose

This is the canonical release-integrity checklist for the CERNIQ repository. Use it as the source of truth for whether the repo is locally green and rerun-ready.

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

Public production verification:

- `bash scripts/health-check.sh https://api.cerniq.io https://cerniq.io`
- `bash scripts/smoke-test.sh https://api.cerniq.io`

Production-authenticated or mutating smoke:

- Only run with explicit intent and safe credentials
- Use `ALLOW_PRODUCTION_MUTATIONS=1 bash scripts/smoke-test.sh https://api.cerniq.io`
- Success means public routes return `200`, while protected routes correctly reject with `401/403`
