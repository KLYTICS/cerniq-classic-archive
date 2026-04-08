# Session Handoff

## Objective

Preserve the current enterprise-hardening worktree, keep local quality gates green, and hand off a PR-ready branch state that can be resumed safely across sessions.

## Current State

- Date: 2026-04-08
- Workspace: `/Users/money/Desktop/Cerniq`
- Active branch: `codex/full-green-rescue-2026-04-08`
- Base HEAD at pickup: `7d2c55731fe54d7944316050fc27bfa435eeb48f`
- Strategy: preserve the dirty worktree and harden in place

Current validated state on this branch:

- Backend Prisma validation: pass
- Backend TypeScript: pass
- Backend non-mutating ESLint: pass
- Backend build: pass
- Backend E2E/security: pass (`4` suites, `64` tests)
- Backend tests: pass (`453` suites, `5705` tests)
- Frontend lint: pass
- Frontend build: pass
- Frontend tests: pass (`67` files, `543` tests)
- Frontend default Playwright: pass (`51` passed, `2` preview-only skips)
- Frontend production-critical Playwright: pass (`5` tests against `cerniq.io`)
- Outbound pytest: pass (`82` tests)
- Public production gate: pass (`13/13` checks)
- Public production smoke: pass (`31` checks, `0` failures, `4` intentional production-safe skips)

## Gaps

- GitHub Actions is still blocked from reaching green because recent runs on PR `#24` are not starting due to repository/account Actions billing or spending-limit issues.
- Full authenticated production smoke is intentionally not part of the default live gate; it requires explicit opt-in and safe credentials.
- The remaining non-green state is operational, not code-related; the branch itself is locally validated and pushed.

## Affected Areas

- `backend-node`
- `frontend`
- `scripts`
- `docs`

## Current Gate Status

Validated locally on 2026-04-08 using:

- `docs/ops/REPO_GREEN_CHECKLIST.md`

Observed results:

- Backend non-mutating ESLint: pass
- Backend E2E/security: `4` suites passed, `64` tests passed
- Backend tests: `453` suites passed, `5705` tests passed
- Frontend tests: `67` files passed, `543` tests passed
- Frontend default Playwright: `51` passed, `2` skipped by design
- Frontend production-critical Playwright: `5` tests passed
- Outbound pytest: `82` tests passed
- Public production gate: `13/13` checks passed
- Public production smoke: `31` passed, `0` failed, `4` skipped by design

Additional validation:

- `npm run test -- --detectOpenHandles --runInBand` completed successfully with `453/453` suites passed
- `npm run verify:backend` completed successfully from the repo root
- `npm run verify:frontend` completed successfully from the repo root
- `npm run smoke:production` completed successfully from the repo root
- `cd frontend && npx playwright test --reporter=github` completed successfully with `51` passed and `2` preview-only skips
- `bash scripts/health-check.sh https://api.cerniq.io https://cerniq.io` completed successfully
- `bash scripts/smoke-test.sh https://api.cerniq.io` completed successfully in read-only production mode
- `cd frontend && npm run test:e2e:production` completed successfully against live production
- `cd frontend && npx vitest run` completed successfully with the portal auth-bootstrap guard tests included

## Planned Changes

| Area | Change | Risk |
|---|---|---|
| scripts | Keep production verification split between read-only public gate and opt-in authenticated smoke | Low |
| smoke contract | Preserve guarded routes as guarded and keep stale method/path checks out of the smoke matrix | Low |
| frontend portal auth | Keep protected portal content hidden until auth bootstrap finishes and unwrap malformed list payloads safely | Low |
| GitHub workflow | Provision backend dependencies/services/env in `frontend-e2e` so Playwright can boot the local backend it already expects | Medium |
| docs | Maintain the canonical production/public contract and next-session commands | Low |

## File Touch List

| File | Purpose |
|---|---|
| `docs/agent/SESSION_HANDOFF.md` | Canonical branch handoff and recovery log |
| `scripts/health-check.sh` | Read-only public production gate |
| `scripts/smoke-test.sh` | Contract-aligned smoke verification with production-safe defaults |
| `docs/ops/REPO_GREEN_CHECKLIST.md` | Canonical validation matrix for local and production gates |

## Files / Modules Being Stabilized

- Public-production verification in `scripts/`
- Smoke contract alignment with guarded ALM/auth/risk/options/execution routes
- Portal auth bootstrap and response normalization in `frontend/app/portal/` and `frontend/lib/api-response.ts`
- Release workflow integrity in `.github/workflows/ci-cd.yml`
- Cross-session documentation in `docs/agent/` and `docs/ops/`

## Data / Migration Impact

- No schema changes required
- No migration work required

## API Impact

- No intentional public REST contract changes
- No intentional DTO shape changes
- No websocket event name or payload shape changes

## Auth Impact

- Portal auth bootstrap now keeps protected portal children hidden until profile resolution completes, preventing unauthorized content flash during redirect to `/portal/login`

## Config / Env Impact

- No new repo-tracked env variables introduced
- Production note: `ALLOW_PRODUCTION_MUTATIONS=1` is now the explicit opt-in for authenticated or mutating smoke coverage against `api.cerniq.io`

## Unresolved Risks

- GitHub Actions cannot be made green until Actions billing/spending is restored
- Once billing is restored, remote-only environment drift is still possible and should be checked before any additional broad cleanup
- Full authenticated production smoke still requires safe non-destructive credentials and explicit operator intent

## Remote GitHub Status

- Branch/PR context: `codex/full-green-rescue-2026-04-08`
- As of 2026-03-31, the most recent branch runs are still the 2026-03-30 push-triggered failures across:
  - `CERNIQ CI/CD`
  - `CI Quick Check`
  - `CodeQL Security Analysis`
- Each run reports the same annotation:
  - `The job was not started because recent account payments have failed or your spending limit needs to be increased.`
- Additional evidence:
  - Actions job metadata shows `steps: []`
  - Actions job metadata shows `runner_id: 0`

## Tests

Primary acceptance source:

- `docs/ops/REPO_GREEN_CHECKLIST.md`

Secondary diagnostic command:

```bash
cd backend-node && npm run test -- --detectOpenHandles
```

Live production verification:

```bash
npm run smoke:production
bash scripts/health-check.sh https://api.cerniq.io https://cerniq.io
bash scripts/smoke-test.sh https://api.cerniq.io
cd frontend && npm run test:e2e:production
```

## Deployment Plan

- Not in scope for this branch
- Stop at branch push and PR-ready GitHub state

## Rollback Plan

- Continue from the preserved branch rather than `main`
- If any future edit regresses local gates, revert only the new delta on top of this branch and keep the pre-existing dirty-tree recovery work intact

## Exact Next Commands

If resuming from this state, use:

```bash
cd /Users/money/Desktop/Cerniq
git status --short --branch

cd backend-node
npx prisma validate
npx tsc --noEmit
npx eslint "{src,apps,libs,test}/**/*.ts"
npm run build
npx jest --config ./test/jest-e2e.json --runInBand
npm run test -- --detectOpenHandles --runInBand
npm run test -- --forceExit

cd ../frontend
npm run lint
npm run build
npx vitest run
npm run test:e2e:production

cd ..
bash scripts/health-check.sh https://api.cerniq.io https://cerniq.io
bash scripts/smoke-test.sh https://api.cerniq.io
cd frontend && npx playwright test --reporter=github
gh run list --branch codex/full-green-rescue-2026-04-08 --limit 10
# After billing is restored, rerun the newest blocked runs shown above
```

## Open Questions

- When GitHub Actions billing is restored, do any workflow jobs fail for code reasons, or does the repo return to green without further changes?

## 2026-04-06 Export Platform Update

- Added a backend-first unified export layer for `alm_report`, `sample_report`, `alco_pack`, and `preview_report`.
- Added manifest endpoints for institution exports, sample exports, preview exports, and portal job exports.
- Migrated primary product download surfaces onto the shared frontend manifest/download client.
- Added repo-tracked spec/checklist documents:
  - `docs/ops/EXPORT_PLATFORM_SPEC.md`
  - `docs/ops/EXPORT_ACCEPTANCE_CHECKLIST.md`

Current rendering owners:

- ALM report: `backend-node/src/alm/reports/reports.service.ts`
- Sample report: `backend-node/src/alm/sample-report-factory.service.ts`
- Preview report: `backend-node/src/alm/preview-report.service.ts`
- ALCO pack: `backend-node/src/pipeline/alco-pack.service.ts`

Known remaining gaps:

- Portal WebSocket completion events still emit URLs instead of full manifest payloads.
- Prospect dossier sample-report downloads are not yet migrated onto the shared manifest contract.
- CSV/Excel/JSON exports remain intentionally outside the V1 document-standardization scope.

Verification recorded for this export pass:

- Backend typecheck: pass
- Targeted backend export/controller Jest suite: pass
- Frontend targeted Vitest suite: pass
- Frontend lint: pending rerun after latest cleanup
