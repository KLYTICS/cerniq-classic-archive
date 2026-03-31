# Latest Session Status

Date: 2026-03-31

## Summary

- Local code-quality and build gates are green for the current working tree.
- Public production verification is green on `cerniq.io` and `api.cerniq.io`.
- Backend Jest open-handle leakage has been diagnosed and fixed in code.
- Frontend production runtime is now live and verified on webpack-backed `next build`, avoiding the Turbopack chunk-path breakage seen earlier.
- Portal auth bootstrap no longer allows protected portal content to flash briefly before redirecting unauthenticated users to `/portal/login`.
- The `frontend-e2e` GitHub workflow now provisions the backend dependencies, Postgres, Redis, Prisma schema, and env vars that Playwright already depends on.
- Live local stack is running and healthy on backend `4010` and frontend `4011`.
- Active recovery branch is `codex/enterprise-green-recovery`.
- GitHub Actions runs for PR `#24` are still blocked, but the failures are external to the codebase.
- Root blocker: GitHub is refusing to start jobs because of an account billing or spending-limit problem.

## GitHub Actions Blocker

Recent blocked runs on PR `#24` / branch `codex/enterprise-green-recovery` continue to affect all three GitHub Actions workflows:

- `CodeQL Security Analysis`
- `CERNIQ CI/CD`
- `CI Quick Check`

Each run reports the same annotation:

`The job was not started because recent account payments have failed or your spending limit needs to be increased.`

Job metadata also shows `steps: []` and `runner_id: 0`, which means GitHub never assigned a runner. On 2026-03-31, `gh run view` still showed the newest branch runs as the blocked March 30, 2026 executions, so repository code changes alone cannot turn GitHub green until Actions billing is restored.

## Local Validation Completed

Canonical repo-green checklist:

- `docs/ops/REPO_GREEN_CHECKLIST.md`

Backend:

- `npx tsc --noEmit`
- `npx prisma validate`
- `npx eslint "{src,apps,libs,test}/**/*.ts"`
- `npx jest --config ./test/jest-e2e.json --runInBand`
- `npm run test -- --detectOpenHandles --runInBand`
- `npm run test -- --forceExit`
- `npm run build`

Backend results:

- TypeScript check passed
- Prisma schema valid
- Non-mutating ESLint passed
- Backend E2E/security passed: `4` suites, `64` tests
- Jest passed cleanly with open-handle diagnostics: `367` suites, `2643` tests
- Jest passed with CI-style force exit: `367` suites, `2643` tests
- Nest build passed
- Root `npm run verify:backend` wrapper passed end to end

Frontend:

- `npm run lint`
- `npm run build`
- `npx vitest run`
- `npm run test:e2e:production`

Frontend results:

- ESLint passed
- Next production build passed on webpack
- Vitest passed: `47` files, `257` tests
- Default Playwright suite passed locally against booted frontend/backend: `55` passed, `2` preview-only skips
- Production-critical Playwright passed: `5` tests against `cerniq.io`
- Root `npm run verify:frontend` wrapper passed end to end

Outbound:

- `python -m pytest services/outbound/tests -q`

Outbound results:

- Pytest passed: `82` tests

Production public gates:

- `bash scripts/health-check.sh https://api.cerniq.io https://cerniq.io`
- `bash scripts/smoke-test.sh https://api.cerniq.io`

Production results:

- Public production gate passed: `12/12`
- Public production smoke passed: `31` checks, `0` failures
- Production-safe skips: `4` sections intentionally skipped because read-only mode is the default on `api.cerniq.io`
- Root `npm run smoke:production` wrapper passed end to end

## Engineering Audit Summary

Residual risks found and fixed in this session:

- Cleared leaked timeout and interval handles in backend runtime services so Jest no longer reports open resources after the full suite.
- Fixed a backend test flake in treasury-rates fallback caching so repeated approximation calls remain deterministic under `--runInBand`.
- Replaced the frontend production build path with webpack because Turbopack was generating chunk filenames containing `..`, which `next start` refused to serve and which broke `/login` and `/alm` hydration in live mode.
- Fixed a Next.js App Router client-page typing error in `frontend/app/dashboard/ticker/[symbol]/page.tsx` that blocked clean webpack production builds.
- Hardened auth/accessibility Playwright coverage so tests wait for hydrated login UI instead of asserting against the transient Suspense fallback shell.
- Added portal layout coverage so wrapped profile/subscription responses render the portal shell correctly and unauthenticated portal hits stay behind the loading guard until redirect completes.
- Fixed a remote-only CI risk in `.github/workflows/ci-cd.yml`: the Playwright job now boots against a real local backend instead of assuming backend services and deps already exist.
- Preserved public APIs and route contracts; changes stayed inside teardown, timer lifecycle, cache behavior, and test hygiene.

Live verification completed:

- `curl -sf http://localhost:4010/health` -> `success:true`, `status:"ok"`
- `curl -sf http://localhost:4010/api/v1/health` -> `success:true`, `status:"ok"`
- `curl -sf http://localhost:4011/api/status` -> frontend proxy confirmed against backend `4010`
- `curl -sf http://localhost:4011/api/health` -> `status:"healthy"`
- `bash scripts/health-check.sh https://api.cerniq.io https://cerniq.io` -> `12/12` passed
- `bash scripts/smoke-test.sh https://api.cerniq.io` -> `31` passed, `0` failed, `4` intentional skips
- `cd frontend && npm run test:e2e:production` -> `5/5` passed
- Browser-verified `/login` hydration succeeds with no chunk 404s
- Browser-verified `/alm` no longer hangs on a missing static-chunk startup failure

What must be rechecked immediately after Actions billing is restored:

- Re-run `CI Quick Check`
- Re-run `CERNIQ CI/CD`
- Re-run `CodeQL Security Analysis`
- Confirm jobs start successfully and that no remote-only environment drift appears

## Notes For Next Session

- Use `docs/ops/REPO_GREEN_CHECKLIST.md` as the canonical validation source instead of duplicating the command matrix in new handoff notes.
- Use `npx eslint "{src,apps,libs,test}/**/*.ts"` in `backend-node` when you need a non-mutating lint pass on a dirty worktree.
- Treat `bash scripts/smoke-test.sh https://api.cerniq.io` as read-only by default. Use `ALLOW_PRODUCTION_MUTATIONS=1` only with explicit intent and safe credentials.
- If GitHub Actions billing is restored, the next high-value step is to re-run the blocked workflows immediately to verify remote green status.
- Current acceptance state: backend health is `ok`, frontend health is `healthy`, public production gate is `12/12`, production smoke is `31/31` with `4` intentional skips, frontend production-critical Playwright is `5/5`, frontend Vitest is `257/257`, outbound pytest is `82/82`, and the remaining non-green status is operational on GitHub Actions billing.
