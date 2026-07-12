# AGENTS.md — Durable workspace facts for Claude Code

> **Live status:** [docs/SESSION_HANDOFF.md](docs/SESSION_HANDOFF.md) (read first every session).  
> **Operating contract:** [CLAUDE.md](CLAUDE.md).

CerniQ is a bilingual ALM platform for Puerto Rico cooperativas. Production: **cerniq.io**, API: **api.cerniq.io** (Railway).

---

## Production E2E gate (Tier A / B)

| Tier | When | Command |
|---|---|---|
| **A — Local** | Pre-push, every session | `npm run verify:local:e2e` |
| **B — Production full** | Pre-client, post-deploy | `npm run verify:production:platform` |
| **B-fast** | Uptime check, no JWT | `npm run verify:production:fast` |
| **Wave 1 API only** | After JWT bootstrap | `npm run verify:production:wave1` |

**Runbook:** [docs/ops/PRODUCTION_E2E_RUNBOOK.md](docs/ops/PRODUCTION_E2E_RUNBOOK.md)  
**Env template:** [`.env.production-e2e.example`](.env.production-e2e.example) → copy to `.env.production-e2e.local` (never commit).

```bash
cp .env.production-e2e.example .env.production-e2e.local
# fill CERNIQ_E2E_JWT + CERNIQ_E2E_INSTITUTION_ID
set -a && source .env.production-e2e.local && set +a
npm run verify:production:platform
```

**Never** auto-run Stripe checkout in scripts. Billing funnel: manual [docs/ops/e2e_production_gate.md](docs/ops/e2e_production_gate.md).

---

## Session ritual (multi-terminal shared tree)

```bash
npm run session:status          # peer claims
npm run session:claim -- <lane> --paths <comma-separated-paths>
# … work …
npm run verify:local:e2e        # Tier A before commit
npm run session:handoff -- "Title" "Body with verification evidence."
npm run session:release
```

Commits use explicit pathspecs (`git commit --only <paths>`) — see CLAUDE.md shared-tree rules.

---

## Wave 1 HTTP surface (compliance layer)

Separate controllers (zero `AlmController` constructor slots):

| Feature | Controller | Key routes |
|---|---|---|
| W1.1 CAEL | `cael.controller.ts` | `GET/POST :id/cael`, `POST :id/cael/artifact` |
| W1.3 EWS | `ews.controller.ts` | `GET :id/ews`, `GET :id/ews/history`, `GET :id/ews/trend`, `POST :id/ews/snapshot` |
| Preflight | `alm.controller.ts` | `GET :id/preflight` |
| CECL (W1.2 indirect) | `alm.controller.ts` | `GET :id/cecl?method=warm` |

W1.4 capital glide-path: golden + `CapitalPlanningService` (no dedicated HTTP route in v1).

---

## D1 invariant (never silent zeros)

Missing inputs → `data_unavailable` + `gaps[]`. Never fabricate scores for EWS history. See `backend-node/src/alm/reports/data-gap.ts`.

---

## Agents layer smoke

```bash
bash scripts/agent-smoke.sh "$CERNIQ_API_URL" "$CERNIQ_E2E_JWT" "$CERNIQ_E2E_INSTITUTION_ID"
```

Checklist: [docs/ops/AGENT_GOING_LIVE.md](docs/ops/AGENT_GOING_LIVE.md).

---

## Pickup paths

| Need | File |
|---|---|
| Phase status + landings | `docs/SESSION_HANDOFF.md` |
| Terminal ops | `docs/TERMINAL_OPERATIONS_HANDBOOK.md` |
| Layer 2/3 roadmap | `docs/CERNIQ_LAYER2_3_ROADMAP.md` |
| Railway env | `docs/ops/railway_env_vars.md` |
