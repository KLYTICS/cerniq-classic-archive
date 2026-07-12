# Production E2E Runbook — Platform + Wave 1 + Agents

**Version:** 1.0  
**Date:** 2026-07-11  
**Owner:** CerniQ Engineering  
**Status:** Canonical gate before live client engagement (complements [MP-OPS-03 billing gate](e2e_production_gate.md))

> **Claude Code pickup:** Read [docs/SESSION_HANDOFF.md](../SESSION_HANDOFF.md) first, then this file. Durable env + ritual facts live in [AGENTS.md](../../AGENTS.md) at repo root.

---

## Two-tier ladder

| Tier | Command | When | JWT required? |
|---|---|---|---|
| **A — Local preflight** | `npm run verify:local:e2e` | Every commit / pre-push | No |
| **B — Production platform** | `npm run verify:production:platform` | Pre-client, weekly, post-deploy | Yes (full mode) |
| **B-fast — Prod uptime** | `npm run verify:production:fast` | "Is prod up?" without secrets | No |
| **B-backend — API only** | `npm run verify:production:backend` | Frontend down (Vercel); Wave 1 + agents | Yes |

Tier A wraps `verify:local:critical` plus offline Wave 1 compute sanity (`cael:report --json`).

Tier B runs Phase 0–4 below against `https://api.cerniq.io` and `https://cerniq.io`.

---

## Prerequisites

Before Tier B (full mode):

- [ ] Railway CLI installed and linked to **cerniq-api** (`railway link`)
- [ ] `bash scripts/ops/railway-verify-prod.sh` passes
- [ ] `npx prisma migrate status` against prod `DATABASE_URL` shows **no pending migrations**
- [ ] `.env.production-e2e.local` sourced (copy from [`.env.production-e2e.example`](../../.env.production-e2e.example))
- [ ] QA JWT valid (see § JWT bootstrap)
- [ ] `CERNIQ_E2E_INSTITUTION_ID` set **or** resolvable via `GET /api/alm/institutions`
- [ ] Optional: `CERNIQ_E2E_CROSS_JWT` for RLS negative test

**Not tested by this gate (disclosed):**

- EWS alert email/notifier fan-out (alerts persist on snapshot row + logs only)
- EWS daily scheduler cron (`EwsSchedulerService` — not forced in smoke)
- Stripe checkout (manual [MP-OPS-03](e2e_production_gate.md) only)
- Wave 2 loan-tape ingestion (until landed on its own branch)

---

## Environment setup

```bash
cp .env.production-e2e.example .env.production-e2e.local
# Edit .env.production-e2e.local — never commit it (.gitignore covers .env.*)
set -a && source .env.production-e2e.local && set +a
```

| Variable | Required | Purpose |
|---|---|---|
| `CERNIQ_API_URL` | Yes | Default `https://api.cerniq.io` |
| `CERNIQ_FRONTEND_URL` | No | Default `https://cerniq.io` |
| `CERNIQ_E2E_JWT` | Full mode | Bearer token for QA workspace user |
| `CERNIQ_E2E_INSTITUTION_ID` | Recommended | Skip institution list resolution |
| `CERNIQ_E2E_CROSS_JWT` | Optional | Cross-tenant RLS negative test |
| `CERNIQ_E2E_WORKSPACE_ID` | Optional | Filter institution list |
| `ADMIN_KEY` | Optional | Enables health-check admin stats section |
| `DATABASE_URL` | Phase 0 | Prod Postgres for `prisma migrate status` (from Railway) |

---

## JWT bootstrap (one-time QA setup)

1. Open `https://cerniq.io/login` in a browser (use dedicated QA account, e.g. `qa@cerniq.io`).
2. Complete magic-link sign-in.
3. DevTools → **Application → Cookies** → copy the auth cookie value **or**  
   DevTools → **Network** → any `/api/` request → copy `Authorization: Bearer …` header.
4. Paste into `.env.production-e2e.local` as `CERNIQ_E2E_JWT` (token only, no `Bearer` prefix).
5. Auto-write env file (validates JWT + picks cooperativa institution):

```bash
node scripts/bootstrap-production-e2e.mjs --jwt '<token>' --write
# or after export CERNIQ_E2E_JWT=...
npm run bootstrap:production-e2e -- --write
```

6. Resolve institution manually if needed:
   ```bash
   source .env.production-e2e.local
   curl -sf -H "Authorization: Bearer $CERNIQ_E2E_JWT" \
     "$CERNIQ_API_URL/api/alm/institutions?limit=5" | python3 -m json.tool
   ```
   Pick a cooperativa demo institution UUID → `CERNIQ_E2E_INSTITUTION_ID`.

**If no institution exists:** seed **only** into a dedicated QA workspace (never a live client workspace):

```bash
cd backend-node
DATABASE_URL="<qa-database-url>" pnpm seed:institution -- \
  --workspace="$CERNIQ_E2E_WORKSPACE_ID" --fixture=pr-cooperativa-demo
```

---

## PR institution / cooperativa map (QA workspace)

CerniQ ships **fixture seed keys** for institution types in Puerto Rico. Production client cooperativas use real names; QA uses seeded demos.

| Fixture `seedKey` | Demo name | Type | Regulator | Wave 1 smoke |
|---|---|---|---|---|
| `pr-cooperativa-demo` | CoopAhorro San Juan | cooperativa | COSSEC | CAEL + EWS + CECL warm |
| `pr-credit-union-demo` | PR Credit Union Demo | credit_union | NCUA | Preflight + CECL (no COSSEC CAEL) |
| `pr-bank-demo` | PR Bank Demo | bank | OCC/FDIC | Preflight path differs |
| `pr-family-office-demo` | PR Family Office Demo | family_office | — | ALM subset |

**List live institution IDs** (after JWT bootstrap):

```bash
source .env.production-e2e.local
node scripts/e2e-list-institutions.mjs
node scripts/e2e-list-institutions.mjs --type cooperativa --json
```

Set `CERNIQ_E2E_INSTITUTION_ID` to the UUID for each cooperativa you want in Wave 1 smoke. To smoke **all cooperativas in a workspace**, run wave1 once per ID (or extend with a loop in your session).

**Apple fixture reference** (offline only): `CoopAhorro San Juan` + `CoopAhorro Ponce` in `apple/Fixtures/institutions.json` — not production IDs.

---

## Phase-by-phase commands

### Railway login (required for migrate status)

In your terminal (interactive — agent cannot complete this):

```bash
railway login
railway link    # select cerniq-api service
export DATABASE_URL="$(railway variables --kv | grep ^DATABASE_URL= | cut -d= -f2-)"
cd backend-node && npx prisma migrate status
```

If pending: `railway run -- npx prisma migrate deploy` (founder approval).

### Phase 0 — Preflight (infra)


```bash
bash scripts/ops/railway-verify-prod.sh
bash scripts/health-check.sh "$CERNIQ_API_URL" "$CERNIQ_FRONTEND_URL"
cd backend-node && npx prisma migrate status
```

**Pass:** Railway env vars present; health-check exit 0; migrate status shows database up to date.

**If pending migrations:** founder approval required, then:

```bash
railway run -- npx prisma migrate deploy
```

Critical for W1.3: migration `20260709220000_add_ews_snapshots` must be applied before `POST .../ews/snapshot`.

### Phase 1 — Public UI smoke

```bash
npm run smoke:production
```

**Pass:** Playwright `production-critical.spec.ts` + public footer links green against production URLs.

**Known prod deploy (2026-07-12):** deploy from **`frontend/`**, not repo root — root `vercel deploy --prod` fails with missing `routes-manifest.json` because build output is `frontend/.next`. Canonical:

```bash
npm run deploy:prod:frontend
# or: cd frontend && vercel deploy --prod --yes && vercel alias set <url> cerniq.io
```

**Skip frontend in orchestrator:** `bash scripts/verify-production-platform.sh --skip-frontend`

### Phase 2 — Wave 1 API smoke

```bash
npm run verify:production:wave1
# or with JSON log:
bash scripts/wave1-api-smoke.sh --json-out /tmp/cerniq-wave1.json
```

| Step | Endpoint | Pass criteria |
|---|---|---|
| Resolve institution | `GET /api/alm/institutions` | UUID resolved |
| Preflight | `GET /api/alm/:id/preflight` | `success: true`, `gaps` is array |
| CAEL W1.1 | `GET /api/alm/:id/cael` | HTTP 200; ≥3 filing variants in `data` |
| EWS compute | `GET /api/alm/:id/ews` | HTTP 200; D1 shell OK (`compositeScore` null or number) |
| EWS capture | `POST /api/alm/:id/ews/snapshot` | HTTP 200; idempotent same UTC day |
| EWS history | `GET /api/alm/:id/ews/history?limit=7` | ≥1 row after capture |
| EWS trend | `GET /api/alm/:id/ews/trend` | `latest` non-null after capture |
| CECL / macro W1.2 | `GET /api/alm/:id/cecl?method=warm` | HTTP 200 |
| RLS (optional) | `GET .../ews` with `CROSS_JWT` | 401/403 or empty/forbidden |

**Trend delta across days:** run capture on two UTC calendar days, or accept day-1 empty `alerts` array.

### Phase 3 — Agent smoke

```bash
bash scripts/agent-smoke.sh \
  "$CERNIQ_API_URL" \
  "$CERNIQ_E2E_JWT" \
  "$CERNIQ_E2E_INSTITUTION_ID" \
  "${CERNIQ_E2E_CROSS_JWT:-}"
```

See [AGENT_GOING_LIVE.md](AGENT_GOING_LIVE.md).

### Phase 4 — Manual billing (founder only)

Walk [MP-OPS-03 — E2E Production Gate](e2e_production_gate.md) steps 1–13.  
**Never** auto-run Stripe checkout from scripts unless `CERNIQ_E2E_RUN_BILLING=1` (founder explicit).

---

## One-command orchestrator

```bash
source .env.production-e2e.local
npm run verify:production:platform

# Fast (no JWT):
npm run verify:production:fast

# Options:
bash scripts/verify-production-platform.sh --fast
bash scripts/verify-production-platform.sh --skip-agents
bash scripts/verify-production-platform.sh --json-out /tmp/cerniq-e2e.json
```

Exit code 0 only when all non-skipped phases pass. JSON summary is paste-ready for SESSION_HANDOFF §5.

---

## Failure triage

| Symptom | Likely cause | Fix |
|---|---|---|
| `POST .../ews/snapshot` → 500 | `ews_snapshots` table missing | `prisma migrate deploy` on Railway |
| 401 on Wave 1 endpoints | Expired JWT | Re-bootstrap JWT (§ above) |
| `GET .../ews/trend` → `data_unavailable` before capture | No snapshots yet | Run `POST .../ews/snapshot` first |
| History length 0 after capture | Migration not applied / wrong DB | Check migrate status + institutionId |
| Playwright fails on `/dashboard` | Auth redirect expected in prod | Check test mocks; re-run with stable network |
| Agent smoke timeout | LLM/API load | Retry; check Railway logs |
| RLS test fails open | Cross JWT can read tenant data | **Stop** — investigate RLS policies |

---

## Result log

| Date | Tester | Tier | Phases passed | Failed step | Notes |
|---|---|---|---|---|---|
| | | A / B | /5 | | |
| | | A / B | /5 | | |

Archive JSON output from `--json-out` alongside this table.

---

## SESSION_HANDOFF landing template

After a green Tier B run, append to §5:

```
- YYYY-MM-DD — **chore(ops): production platform E2E gate green.** Tier B
  `verify:production:platform` exit 0 (phase0–3 pass, billing manual deferred).
  Wave 1: CAEL + EWS capture/history/trend 200 on QA institution; RLS negative OK.
  Evidence: /tmp/cerniq-e2e.json (N phases, migrate status clean). — scripts/*,
  docs/ops/PRODUCTION_E2E_RUNBOOK.md, AGENTS.md
```

---

## Related docs

- [e2e_production_gate.md](e2e_production_gate.md) — MP-OPS-03 billing funnel (manual)
- [AGENT_GOING_LIVE.md](AGENT_GOING_LIVE.md) — agent layer checklist
- [railway_env_vars.md](railway_env_vars.md) — Railway env reference
- [SESSION_HANDOFF.md](../SESSION_HANDOFF.md) — live phase status
