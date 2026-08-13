# AGENTS.md — Durable workspace facts for Claude Code

> **Live status:** [docs/SESSION_HANDOFF.md](SESSION_HANDOFF.md) (read first every session). 
> **Moon ladder:** [docs/ENTERPRISE_PICKUP.md](ENTERPRISE_PICKUP.md).
> **Operating contract:** [CLAUDE.md](CLAUDE.md).

CerniQ is a bilingual ALM platform for Puerto Rico cooperativas. Production: **cerniq.io**, API: **api.cerniq.io** (Railway).

---

## Production E2E gate (Tier A / B)

| Tier | When | Command |
|---|---|---|
| **A — Local** | Pre-push, every session | `npm run verify:local:e2e` |
| **B — Production full** | Pre-client, post-deploy | `npm run verify:production:platform` |
| **B-fast** | Uptime check, no JWT | `npm run verify:production:fast` |
| **Deploy frontend** | Post-merge to cerniq.io | `npm run deploy:prod:frontend` |
| **Railway migrate** | After `railway login` | `npm run ops:railway:migrate` |
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

## Auth unification (Supabase)

| Phase | Status | Pickup |
|---|---|---|
| Backend accept + JWKS util | Done | `backend-node/src/auth/supabase-jwt.util.ts` |
| Frontend Supabase login path | Done (env-gated) | `frontend/lib/supabase/` — needs `NEXT_PUBLIC_SUPABASE_*` |
| Frontend org header | Done | `frontend/lib/org-context.ts` → `x-organization-id` on API client |
| Prod cutover | Pending | Railway: `AUTH_ALLOW_LEGACY=false`, JWKS URL, `KLYTICS_REQUIRE_*` |

Docs: [docs/platform/auth-unification/README.md](docs/platform/auth-unification/README.md)

## PR cooperativa market quality scan

```bash
cd backend-node && npm run market:quality-scan
cd backend-node && npm run market:quality-scan -- --json=/tmp/market-scan.json --html=/tmp/market-scan.html
cd backend-node && npm run market:quality-scan -- --self-test
```

Scores 13 curated COSSEC snapshots; inventories full outbound universe (~111). Uncovered = `data_unavailable` (D1).

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

## Wave 2 loan-tape HTTP (W2.0)

| Route | Controller | Notes |
|---|---|---|
| `POST :id/loan-tape` | `loan-tape.controller.ts` | CSV ingest (all-or-nothing) |
| `GET :id/loan-tape/rollup?asOfDate=` | same | Segment-shaped rollup |
| `GET :id/loan-tape/reconcile?asOfDate=` | same | Tape vs LoanSegment book |

Requires prod migration `20260711150000_add_loan_records`.

## Wave 3 Member 360 HTTP surface (fixture-first)

Separate controller (`Member360Controller`), not new `AlmController` methods:

| Route | Notes |
|---|---|
| `GET :institutionId/members` | Paginated member directory |
| `GET :institutionId/members/:memberId` | Full profile — financial overview, regulatory health, accounts, lifecycle timeline, next-best-actions, `gaps[]` |
| `POST :institutionId/members/seed-demo` | Seeds 50 deterministic fixture members (`MemberFixtureService`); frontend only calls this from an explicit "Seed 50 demo members" button, never automatically |

`Member.source` (default `"fixture"`) is the **only** fixture/real-ingestion seam — lifecycle
classification, risk scoring, routes, and UI are all source-agnostic. No real core-system
ingestion adapter exists yet; requires migration `20260812200000_add_member_360`. See
[docs/architecture/ADR-member-360-layer3.md](docs/architecture/ADR-member-360-layer3.md).

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
| Moon ladder | `docs/ENTERPRISE_PICKUP.md` |
| Phase status + landings | `docs/SESSION_HANDOFF.md` |
| Market scan coverage | `docs/ops/MARKET_SCAN_COVERAGE.md` |
| Terminal ops | `docs/TERMINAL_OPERATIONS_HANDBOOK.md` |
| Layer 2/3 roadmap | `docs/CERNIQ_LAYER2_3_ROADMAP.md` |
| Member 360 ADR (Wave 3) | `docs/architecture/ADR-member-360-layer3.md` |
| Railway env | `docs/ops/railway_env_vars.md` |

---

## Learned User Preferences

- Prefers enterprise-quality, end-to-end, production-demoable work; often asks to continue until the full ladder is closed rather than stopping at partial bring-up.
- Claude Code is the main engineer; Cursor sessions should leave reproducible handoffs and explicit artifacts Claude Code can pick up.
- Interactive `railway login` and pasting OAuth/client secrets are founder-run; agents should stage non-interactive scripts and checklists around that.
- Prefer finishing Supabase auth unification over adding Clerk for this project.
- Do not edit attached plan files when implementing from a plan; use existing todos rather than recreating them.
- GTM target is all 91 COSSEC-insured PR cooperativas for pitching — CRM registry plus optional product ALM shells, never fabricated balance sheets.

## Learned Workspace Facts

- Google Sign-In is Nest/Passport on `api.cerniq.io`; set `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` on Railway only (never `NEXT_PUBLIC_*`); callback is `https://api.cerniq.io/api/auth/google/callback`.
- Missing Google OAuth env fails closed with HTTP 503 (not a `not-configured` redirect); bring-up via `docs/ops/GOOGLE_OAUTH_BRINGUP.md` and `scripts/ops/google-oauth-bringup.sh`.
- Cross-subdomain auth cookies use `AUTH_COOKIE_DOMAIN=.cerniq.io` with `FRONTEND_URL=https://cerniq.io`; never set `AUTH_COOKIE_SAMESITE=lax` in production (BUG-001 breaks cerniq.io ↔ api.cerniq.io).
- Production `DATABASE_URL` uses Railway private networking; run Prisma migrate status/deploy via `railway ssh`, not from the laptop.
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` and `NEXT_PUBLIC_SUPABASE_*` belong on Vercel (frontend), not Railway API env.
- Authoritative coop registry: 91 rows in `backend-node/src/alm/data/registry/pr-cooperativas-q2-2025.json` (COSSEC Anejo 9); ICP tiers tier1 ≥$100M, tier2 $50–100M, tier3 <$50M; exclude dissolved Aguada.
- Pickup hub is `docs/SESSION_HANDOFF.md`; multi-session coordination uses `claude-peers` with explicit pathspec commits.
- Member 360 (Wave 3, `member360/`) ships on synthetic fixtures deliberately, decoupled from the real member-tape ingestion discovery gate in the roadmap's §6 — `Member.source` (`"fixture"` default) is the seam, not a separate table or code path. Real ingestion is unbuilt; see the ADR before assuming any `Member` row is a real socio.
- Some sandbox/CI environments block `unlink` on `.git/*.lock` and `.git/objects/**/tmp_obj_*` (EPERM) after a git process creates them, even though the git operation itself still completes successfully — `mv` the stale lock aside (never blindly `rm -f`; confirm via timestamp + `ps aux | grep git` first) rather than assuming the repo is corrupted.
