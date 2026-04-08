# CerniQ CI/CD Pipeline — Architecture + Session Collaboration

> **Read this before editing any workflow.** The CerniQ repo has multiple
> parallel Claude sessions making concurrent changes. This document explains
> how the CI/CD pipeline is structured to catch cross-session conflicts,
> pin ALM math, and publish machine-readable status that the next session
> can read.

Last updated: 2026-04-08

---

## 1. Pipeline overview

Three workflows run on push/PR to main. They layer, they don't overlap.

### `ci-cd.yml` — the main pipeline (pre-existing, 393 lines)
The backbone. Runs everything: backend lint + unit + build, backend E2E,
frontend lint + build + vitest + Playwright, Python outbound tests, security
audit, release gate, Railway deploy (main branch), Vercel frontend (via
GitHub integration).

**Don't edit this file unless you need to change a release gate or deploy
target.** Its changes affect every session.

### `ci.yml` — the quick check (pre-existing, 52 lines)
Fast-path type-check + prisma validate. Runs before `ci-cd.yml` gets to its
heavy jobs. A trivial smoke test.

### `alm-quality-gate.yml` — session-aware guardrails (new, Phase 2 batch 5)
**This is the session-collab layer.** Adds five checks that the existing
pipeline doesn't have:

1. **Dedicated golden drift job** — ALM math immune system, rich annotations
2. **Prisma schema-drift detection** — catches cross-session schema conflicts
3. **Session handoff freshness warning** — non-blocking hygiene check
4. **Path-filtered targeted tests** — ~35s targeted jest, skips on unrelated changes
5. **`ci-status.json` artifact** — machine-readable verdict for next session

See §3 for details on each job.

---

## 2. What triggers what

| Trigger | `ci.yml` | `ci-cd.yml` | `alm-quality-gate.yml` |
|---|---|---|---|
| Push to main (any path) | ✅ | ✅ | only if paths match |
| PR to main (any path) | ✅ | ✅ | only if paths match |
| Push to develop | ❌ | ✅ | ❌ |
| Frontend-only change | ✅ | ✅ | ❌ (path-filtered out) |
| Backend ALM change | ✅ | ✅ | ✅ |
| `docs/SESSION_HANDOFF.md` only | ❌ | ❌ | ✅ (freshness audit only) |

**Path filters for `alm-quality-gate.yml`**:
- `backend-node/src/alm/**`
- `backend-node/src/actions/**`
- `backend-node/src/expenses/**`
- `backend-node/src/pipeline/**`
- `backend-node/prisma/**`
- `backend-node/test/golden/**`
- `backend-node/package.json` + `package-lock.json`
- `docs/SESSION_HANDOFF.md`
- `.github/workflows/alm-quality-gate.yml`
- `scripts/ci/**`

This is intentional: a frontend-only change doesn't rerun the ALM quality
gate (saves CI minutes). A docs-only change to `SESSION_HANDOFF.md` triggers
the gate so the freshness check runs, but everything else short-circuits via
cache.

---

## 3. Jobs in `alm-quality-gate.yml`

### `typecheck` — Backend Type Check
- **Purpose**: fail fast on TypeScript errors before any other job runs
- **Runs**: `npx tsc --noEmit --project tsconfig.json` in `backend-node/`
- **Duration**: ~30-60s (with cache)
- **On failure**: everything downstream is skipped

### `alm-tests` — Targeted Jest Subset
- **Purpose**: fast feedback on the Phase 1/2/3 code paths
- **Runs**: `npx jest src/alm src/actions src/expenses src/pipeline --no-coverage`
- **Duration**: ~35-60s
- **Depends on**: `typecheck`
- **Why targeted and not full suite?** The existing `ci-cd.yml` runs the full
  jest suite inside `backend-test`. Our targeted run is faster and scoped to
  the files the session is most likely to have touched. Both run in parallel.

### `golden-drift` — ALM Math Immune System
- **Purpose**: detect drift in canonical ALM calculations
- **Runs**: `bash scripts/ci/golden-drift-report.sh` which wraps
  `npx jest src/alm/golden-reconciliation.spec.ts`
- **Duration**: ~20s
- **Depends on**: `typecheck`
- **On failure**: emits `::error title=ALM Math Drift Detected::` with clear
  remediation steps. Locked decision D7: **NEVER auto-update golden files in
  CI.** The manual regen (`UPDATE_GOLDEN=1` locally + review + commit) is the
  gate. See `src/alm/golden-reconciliation.spec.ts` and
  `test/golden/pr-cooperativa-demo.*.json`.

### `schema-drift` — Prisma Schema Consistency
- **Purpose**: catches the cross-session failure mode where one session edits
  `schema.prisma` without generating a migration (or vice versa)
- **Runs**: `bash scripts/ci/check-schema-drift.sh` which runs
  `prisma migrate diff --from-migrations --to-schema --shadow-database-url`
- **Duration**: ~45s (needs postgres shadow DB)
- **Services**: `postgres:15-alpine` as a throwaway shadow DB
- **On failure**: emits `::error title=Schema Drift Detected::` with the
  generated drift SQL so you can see exactly which column/index/enum is
  mismatched. Remediation: `cd backend-node && npx prisma migrate dev --name
  <descriptive-name>`.
- **Local fallback**: when `SHADOW_DATABASE_URL` is unset (local dev), the
  script falls back to `npx prisma validate` which catches syntax/reference
  errors but not true drift.

### `session-freshness` — Handoff Doc Hygiene
- **Purpose**: warn when sensitive paths change without updating
  `docs/SESSION_HANDOFF.md`
- **Runs**: `bash scripts/ci/check-session-freshness.sh`
- **Duration**: ~5s
- **On failure**: NEVER fails. Soft gate. Emits
  `::warning title=Session Handoff Not Updated::` if sensitive paths changed
  without a handoff update. Shows as yellow in PR review UI and in the job
  summary. Next session sees it and backfills the doc.
- **Why non-blocking?** Docs hygiene shouldn't block deploys. The warning is
  enough to keep the feedback loop honest without creating friction.

### `quality-gate` — Aggregator + Artifact Publisher
- **Purpose**: final job that writes `ci-status.json` and sets the overall
  verdict
- **Runs**: `bash scripts/ci/session-ci-report.sh` then uploads the artifact
- **Depends on**: all five jobs above (`if: always()` so it runs even on
  failure)
- **Artifact**: `ci-status.json` at 30-day retention. Downloadable from the
  Actions run. Shape:
  ```json
  {
    "schemaVersion": 1,
    "commit": "<full SHA>",
    "shortCommit": "<7-char>",
    "branch": "main",
    "timestamp": "2026-04-08T13:03:32Z",
    "workflow": "alm-quality-gate",
    "runId": "<github run id>",
    "runUrl": "<clickable URL to the run>",
    "verdict": "green" | "red",
    "jobs": {
      "typecheck": "success" | "failure" | "skipped",
      "almTests": "...",
      "goldenDrift": "...",
      "schemaDrift": "...",
      "sessionFreshness": "..."
    },
    "sessionHandoff": {
      "path": "docs/SESSION_HANDOFF.md",
      "completedCheckboxes": 34,
      "totalCheckboxes": 48,
      "updatedInThisCommit": true
    },
    "sensitivePathsTouched": 45
  }
  ```
- **Verdict rule**: `green` ONLY if `typecheck + almTests + goldenDrift +
  schemaDrift` all succeed. `sessionFreshness` is soft and doesn't affect
  the verdict.
- **On failure**: the aggregator re-emits `::error title=Quality Gate Failed::`
  and exits 1 so the workflow is marked failed in the Actions UI.

---

## 4. Cross-session collaboration protocol

### The problem we're solving
The CerniQ repo has **multiple parallel Claude sessions** editing the same
working tree. Without care, they collide: two sessions edit `schema.prisma`,
or one commits code without updating the handoff doc, or a refactor changes
ALM math and the next session doesn't notice until production. This pipeline
is the guardrail.

### The protocol

1. **Before starting work**: read `docs/SESSION_HANDOFF.md`. The §9 right-now
   safety table tells you what's shippable. The §3 file cursors tell you
   where other sessions are working.

2. **During work**: make your changes in the normal way. Run the targeted
   suite locally: `cd backend-node && npx jest src/alm src/actions
   src/expenses src/pipeline --no-coverage`. Run the golden spec if you
   touched ALM math: `npx jest src/alm/golden-reconciliation.spec.ts`.

3. **Before committing**: stage only the files YOU touched. Use the surgical
   commit pattern from the 2026-04-07 session — restore shared files to HEAD,
   re-apply only your hunks, commit, then restore the working-tree WIP so
   other sessions aren't disturbed. See §5 of SESSION_HANDOFF.md for the
   full recipe.

4. **Commit message**: include a section that updates `SESSION_HANDOFF.md §5
   (Recent landings)`. The freshness check is soft but the handoff doc is
   the cross-session source of truth — keep it fresh.

5. **After push**: the `alm-quality-gate.yml` workflow runs within ~2 min.
   Check the run's `ci-status.json` artifact to see the verdict. If `red`,
   read the job logs and fix before starting new work.

6. **Next session starts**: reads `SESSION_HANDOFF.md` + fetches the latest
   `ci-status.json` from the last green run. Knows exactly what's shipped
   and what's open.

### When two sessions collide

If session A pushes a schema change and session B pushes a conflicting
schema change at the same time, GitHub's git layer will either fast-forward
(one wins) or reject the later push. In either case, the surviving push
goes through `alm-quality-gate.yml`. If the schema/migrations are now
inconsistent:
- `schema-drift` fires with `::error title=Schema Drift Detected::`
- The error includes the generated drift SQL
- Whoever's session is active fixes it by running
  `npx prisma migrate dev --name <name>` and pushing the new migration

If session A pushes ALM math changes that move the golden snapshot and
session B had already committed expected values:
- `golden-drift` fires with a diff
- Whoever is active regenerates locally (`UPDATE_GOLDEN=1`), reviews the
  diff, and decides whether the math change was intentional or a regression

---

## 5. Operating the pipeline

### Running scripts locally

All four CI scripts work locally (with limitations):

```bash
# Fast — runs against your local node_modules, no DB needed
bash scripts/ci/golden-drift-report.sh

# Local fallback — runs prisma validate only (no shadow DB)
bash scripts/ci/check-schema-drift.sh

# Compares against HEAD~1 locally, or against PR base in CI
bash scripts/ci/check-session-freshness.sh

# Works in any git repo — writes .ci-artifacts/ci-status.json
JOB_TYPECHECK=success JOB_ALM_TESTS=success JOB_GOLDEN_DRIFT=success \
  JOB_SCHEMA_DRIFT=success JOB_SESSION_FRESHNESS=success \
  bash scripts/ci/session-ci-report.sh
```

### Regenerating golden snapshots

**Only do this when ALM math changes intentionally.**

```bash
cd backend-node
UPDATE_GOLDEN=1 npx jest src/alm/golden-reconciliation.spec.ts
```

Review the diff in `test/golden/pr-cooperativa-demo.*.json`. Commit with a
message explaining what changed and why.

### Debugging a failed quality gate

1. Click the failed job in the Actions UI
2. Expand the step that's red
3. Look for `::error title=` annotations — they have structured fix steps
4. If it's `schema-drift`, read the generated SQL at the bottom of the log
5. If it's `golden-drift`, note which JSON file and which field — the jest
   output shows expected vs received

### Reading `ci-status.json` from the next session

```bash
# Latest successful run on main
gh run download --repo monykiss/cerniq \
  --name ci-status \
  --workflow alm-quality-gate.yml \
  --branch main

cat ci-status.json
# or
jq '.verdict, .jobs, .sessionHandoff' ci-status.json
```

---

## 6. What this pipeline does NOT do

Deliberate omissions — these are handled elsewhere or intentionally not
addressed:

- **Does not run the full jest suite.** The existing `ci-cd.yml:backend-test`
  already does that. Duplication would waste CI minutes.
- **Does not run lint.** The existing `ci-cd.yml:backend-test` does.
- **Does not deploy.** The existing `ci-cd.yml:deploy-backend` handles
  Railway, and Vercel handles the frontend via GitHub integration.
- **Does not enforce the session-freshness warning as a hard gate.** Docs
  hygiene is soft by design.
- **Does not auto-merge.** Out of scope.
- **Does not create PR comments.** The job summary surfaces everything
  important.

---

## 7. Evolution

When you add a new Phase (4, 5, 6, ...) or a new quality check, follow
the pattern:

1. Add a new shell script under `scripts/ci/` that emits GitHub Actions
   annotations (`::error title=...`, `::warning title=...`, `::notice
   title=...`) with structured remediation steps
2. Add a new job to `alm-quality-gate.yml` that runs it
3. Wire the job into `quality-gate.needs` and the `ci-status.json` shape
4. Document the job in this file (`§3 — Jobs in alm-quality-gate.yml`)
5. Update `SESSION_HANDOFF.md §2 — Phases & status` to reference the new gate

The scripts are the source of truth for the logic. The workflow YAML is
thin glue. This keeps the pipeline debuggable: you can run any script
locally with the same semantics as CI.
