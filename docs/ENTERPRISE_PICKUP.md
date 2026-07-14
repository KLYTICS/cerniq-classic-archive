# CerniQ Enterprise Pickup — Moon Quality Ladder

> **Start here** after [docs/SESSION_HANDOFF.md](SESSION_HANDOFF.md). This doc is the operational map from “code landed” to “client-certifiable.”

Production: **cerniq.io** · API: **api.cerniq.io** · Branch: `claude/wave2-loan-level`

---

## Moon definition

| Gate | Command | Green means |
|---|---|---|
| **Tier A** | `npm run verify:local:e2e` | Lint + tests + coverage + build + critical e2e + cael + market self-test |
| **Tier B-fast** | `npm run verify:production:fast` | Health 13/13 + prod Playwright smoke (no JWT) |
| **Tier B-full** | `npm run verify:production:platform` | Tier B-fast + Wave 1 API + agents (JWT required) |
| **Prod migrate** | `npm run ops:railway:migrate` | EWS + loan_records migrations applied |
| **Auth cutover** | Railway + Vercel env | Supabase JWKS, `AUTH_ALLOW_LEGACY=false`, org headers |
| **Market scan** | `npm run market:quality-scan` | Scored snapshots + honest universe inventory (D1) |

---

## Current status (2026-07-13)

| Workstream | Status | Blocker |
|---|---|---|
| Wave 1 (CAEL/EWS/CECL/preflight) | Code complete | Prod migration `20260709220000_add_ews_snapshots` |
| Wave 2 loan-tape | HTTP + services landed | Prod migration `20260711150000_add_loan_records` |
| Supabase auth Ph 2–3 | Code complete | Prod env vars + Tier B JWT |
| Supabase auth Ph 4 | Pending | Legacy sunset + `KLYTICS_REQUIRE_*` |
| Market scan | 13/112 scored (~11.6%) | Expand COSSEC snapshots → [MARKET_SCAN_COVERAGE.md](ops/MARKET_SCAN_COVERAGE.md) |
| Tier B-full | Never certified | `.env.production-e2e.local` + `railway login` |

---

## Founder-critical path (do in order)

### 1. Railway database

```bash
railway login && railway link   # cerniq-api
npm run ops:railway:migrate
# if pending:
npm run ops:railway:migrate:deploy
```

Migrations: `20260709220000_add_ews_snapshots`, `20260711150000_add_loan_records`.

### 2. Supabase production env

**Vercel (`cerniq-frontend`):**

```
NEXT_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon>
```

**Railway (`cerniq-api`):** see [platform/auth-unification/ENV_CONTRACT.md](platform/auth-unification/ENV_CONTRACT.md)

```
SUPABASE_URL=...
SUPABASE_ANON_KEY=...
SUPABASE_JWKS_URL=https://<ref>.supabase.co/auth/v1/.well-known/jwks.json
SUPABASE_JWT_ISSUER=https://<ref>.supabase.co/auth/v1
SUPABASE_JWT_AUDIENCE=authenticated
AUTH_ALLOW_LEGACY=false
KLYTICS_APP_ID=cerniq
KLYTICS_REQUIRE_ORG=true        # only after org headers verified
KLYTICS_REQUIRE_ENTITLEMENT=true
```

Verify: `bash scripts/ops/railway-verify-prod.sh`

### 3. Tier B JWT bootstrap

```bash
cp .env.production-e2e.example .env.production-e2e.local
# login at cerniq.io → copy Supabase access token
npm run bootstrap:production-e2e -- --jwt '<token>' --write
set -a && source .env.production-e2e.local && set +a
npm run verify:production:platform -- --json-out /tmp/cerniq-e2e-full.json
```

### 4. Frontend deploy

```bash
npm run deploy:prod:frontend
bash scripts/health-check.sh https://api.cerniq.io https://cerniq.io
```

---

## Verification matrix

```bash
# Every session (no secrets)
npm run verify:local:e2e

# Uptime (no JWT)
npm run verify:production:fast

# Market intelligence
npm run market:quality-scan
npm run market:quality-scan -- --json=/tmp/market-scan.json --html=/tmp/market-scan.html

# Env template parity (CI-friendly)
node scripts/verify-env-template-parity.mjs

# Wave 1 API only (after JWT)
npm run verify:production:wave1
```

---

## Architecture pickup paths

| Need | Path |
|---|---|
| Auth verify util | `backend-node/src/auth/supabase-jwt.util.ts` |
| Frontend Supabase | `frontend/lib/supabase/` |
| Loan-tape API | `backend-node/src/alm/loan-tape/loan-tape.controller.ts` |
| EWS API | `backend-node/src/alm/ews/ews.controller.ts` |
| CAEL API | `backend-node/src/alm/cael.controller.ts` |
| Market scan | `backend-node/scripts/market-quality-scan.ts` |
| E2E runbook | `docs/ops/PRODUCTION_E2E_RUNBOOK.md` |
| Auth cutover | `docs/platform/auth-unification/CUTOVER_CHECKLIST.md` |
| Layer 2/3 roadmap | `docs/CERNIQ_LAYER2_3_ROADMAP.md` |

---

## Documentation corpus (read order)

1. [SESSION_HANDOFF.md](SESSION_HANDOFF.md) — phase status + landings
2. [ENTERPRISE_PICKUP.md](ENTERPRISE_PICKUP.md) — this file
3. [AGENTS.md](../AGENTS.md) — durable commands
4. [CLAUDE.md](../CLAUDE.md) — invariant suite + git rules
5. [ops/PRODUCTION_E2E_RUNBOOK.md](ops/PRODUCTION_E2E_RUNBOOK.md) — Tier A/B
6. [platform/auth-unification/README.md](platform/auth-unification/README.md) — Supabase
7. [ops/MARKET_SCAN_COVERAGE.md](ops/MARKET_SCAN_COVERAGE.md) — PR coop universe
8. [ops/railway_env_vars.md](ops/railway_env_vars.md) — Railway contract
9. [CERNIQ_LAYER2_3_ROADMAP.md](CERNIQ_LAYER2_3_ROADMAP.md) — Wave 2+

---

## What “no cutting corners” means here

- **D1:** missing data → `data_unavailable` + `gaps[]`, never silent zeros
- **D24:** gates only ratchet tighter; `--self-test` on new verifiers
- **Tier B:** not “moon” until `verify:production:platform` exit 0 with archived JSON
- **Migrations:** schema in repo ≠ prod until `prisma migrate deploy` evidence
- **Docs:** env templates must match `env.schema.ts` (`verify-env-template-parity.mjs`)
