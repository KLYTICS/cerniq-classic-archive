# Drift Report

> **Generated:** 2026-03-15
> **Method:** Full filesystem analysis of `/Users/money/Desktop/Cerniq` -- code as source of truth, docs as secondary evidence.

---

## Summary

The CERNIQ codebase has undergone a significant identity transition from "CapexCycleOS" (a quantitative finance platform for tracking the AI capex cycle) to "CERNIQ" (bilingual ALM reporting software for Puerto Rico cooperativas and credit unions). The active backend is NestJS (`backend-node/`), the active frontend is Next.js (`frontend/`), and the Rust backend (`backend/`) and Bun API (`apps/api/`) are abandoned. Multiple root-level documentation files still describe the original CapexCycleOS product and tech stack, creating a persistent positioning and architecture drift.

**Drift severity:** High. An engineer or investor reading the repo top-down would encounter contradictory product descriptions, references to dead services, and stale architecture narratives within the first five files they open.

---

## Positioning Drift

| Surface | What It Says | What The Code Does |
|---------|-------------|-------------------|
| `README.md` | "Institutional-Grade Quantitative Finance Platform" for "quantitative analysts, portfolio managers, and options traders" | Landing page (`frontend/app/page.tsx`) is an ALM demo-request form for cooperativas and credit unions |
| `PRODUCT_SPEC.md` | "Capex Cycle OS" targeting hedge funds with $500M+ AUM | Pricing one-pager sells $299/mo ALM reports to PR financial institutions |
| `PROJECT_SUMMARY.md` | "CapexCycleOS -- Institutional-Grade Quantitative Research Platform for the AI/Defense/Compute Capital Expenditure Cycle" | No active code path serves capex-cycle screener data; the Bun API that would have done this is dead |
| `ARCHITECTURE.md` (root) | "Capex Cycle OS: Technical Architecture" -- microservices on Kubernetes, Bun.js APIs, Rust compute kernels | Actual production stack is NestJS + Next.js + Prisma on Railway/Vercel |
| `START_HERE.md` | "Your Quant Developer Portfolio" -- Streamlit apps for risk parity and VaR reports | No Streamlit apps are actively served or referenced by the NestJS backend |
| `frontend/app/layout.tsx` | "CERNIQ -- ALM Reports for Cooperativas and Credit Unions" | **Correct** -- this is the live product identity |
| `docs/prompts/POSITIONING.md` | Explicitly says to avoid "quant trading", "AI platform", "analytics platform" externally | Root `README.md` uses exactly those terms |

**Verdict:** The internal docs (`docs/prompts/POSITIONING.md`, `docs/demo/PRICING_ONE_PAGER.md`, `DEPLOYMENT_CHECKLIST.md`) are aligned with the actual product. The root-level docs (`README.md`, `PRODUCT_SPEC.md`, `PROJECT_SUMMARY.md`, `ARCHITECTURE.md`, `START_HERE.md`, `QUICKSTART.md`) are all stale CapexCycleOS-era artifacts.

---

## Architecture Drift

### Dead: Rust Backend (`backend/`)

- **Status:** Abandoned build artifact. Contains a compiled Cargo project with Axum, ndarray, openblas-static, and a `target/release/` directory with OpenBLAS build artifacts.
- **Evidence:** No reference to `backend/` in `docker-compose.prod.yml`. The production compose only builds `backend-node/` and `frontend/`. The dev `docker-compose.yml` still references a `backend` service on port 8001, but the NestJS backend has taken over port 3000 as the canonical API.
- **Docs claiming it is active:** `docs/ARCHITECTURE.md` (system overview includes "Backend Rust" box with Black-Scholes and Monte Carlo engines). `ARCHITECTURE.md` (root) describes "Rust compute kernels". `PROJECT_SUMMARY.md` lists "Rust (Axum)" as the API layer.
- **Code reality:** `backend-node/src/risk/` implements Monte Carlo and VaR in TypeScript. No import or HTTP call from `backend-node` to a Rust service exists.

### Dead: Bun API (`apps/api/`)

- **Status:** Abandoned scaffold. Contains `server.ts`, `router.ts`, and `package.json` (named `@capex-cycle/api`). No `node_modules/`, no lock file, no build artifacts.
- **Evidence:** Not referenced in any docker-compose file. Not referenced by the frontend. The `server.ts` imports `FeatureStore`, `ValuationEngine`, `RiskCalculator` from `./services/` -- a directory that does not exist inside `apps/api/`.
- **Docs claiming it is active:** `AGENTS.md` calls it "Bun-based API surface that appears lightweight or experimental". `ARCHITECTURE.md` (root) says "Bun.js APIs".

### Dead: `services/data-ingest/` and `services/risk-engine/`

- **Status:** Empty directories. No files inside either.

### Alive but secondary: `services/outbound/`

- **Status:** Python outbound email automation service. Contains `app.py`, `config.py`, agents, pipelines, templates. Not referenced in any docker-compose file. Appears to be an independent tool, not integrated into the main stack.

### Dead references in docs

- `PROJECT_SUMMARY.md` lists NATS JetStream as the message queue. No NATS dependency exists in `backend-node/package.json`. The only NATS reference is in the dead `apps/api/package.json`.
- `PROJECT_SUMMARY.md` lists Kubernetes + ArgoCD for orchestration. The `infra/` directory contains K8s manifests but there is no evidence of active K8s deployment. Production uses Railway + Vercel.
- `docs/ARCHITECTURE.md` lists "Polygon.io" as an external API. No Polygon integration exists in `backend-node/`. Market data comes from `yahoo-finance2`.
- `docs/ARCHITECTURE.md` describes TimescaleDB hypertable usage. The NestJS backend uses plain Prisma/PostgreSQL with no TimescaleDB-specific queries or hypertable creation. Docker-compose does use the `timescale/timescaledb` image, but TimescaleDB extensions are not exercised.

---

## API Drift

### Documented vs Actual Controller Prefixes

The `docs/API_REFERENCE.md` documents endpoints prefixed with `/api/` (e.g., `/api/market-data/quote/:ticker`, `/api/risk/component-var`).

The actual NestJS controllers use bare prefixes:
- `risk.controller.ts`: `@Controller('risk')` -- serves at `/risk/...`, not `/api/risk/...`
- However, the `app.controller.ts` handles many routes and `auth.controller.ts` uses `@Controller('api/auth')`.

This creates an inconsistency: some controllers are at `/api/...` (auth, admin endpoints via app.controller) and some are at bare paths (`/risk/...`, `/market-data/...`). The Next.js rewrite rule proxies `/api/:path*` to the backend, which means frontend calls to `/api/risk/component-var` would proxy to the backend at `/api/risk/component-var`, but the controller is mounted at `/risk/component-var`. This may work if the risk controller is also reachable via `/api/risk/...` through some routing, but it is a potential source of 404s.

### Endpoint Count Drift

`docs/ARCHITECTURE.md` claims 26+ endpoints across 5 categories (Market Data, Charts, Risk, Options, Execution). The actual backend now has at least 10 NestJS modules including ALM, Billing, Leads, Pipeline, Portal, Email, Jobs, and Analytics -- none of which appear in the API reference doc.

### Undocumented Endpoints

These controller surfaces exist in code but are absent from `docs/API_REFERENCE.md`:
- ALM module (`/api/alm/...`) -- institutions, balance sheets, analysis runs, reports
- Auth module (`/api/auth/...`) -- register, login, refresh, OAuth, API keys
- Billing module (`/api/billing/...`) -- Stripe checkout, webhooks, subscriptions
- Leads module -- prospect pipeline
- Portal module -- client portal
- Pipeline module -- report automation
- Email module
- Jobs module -- scheduled data ingestion

---

## Auth Drift

### Documented Architecture

`docs/platform/auth-unification/README.md` describes a phased migration:
- Phase 1-2 "in progress" (backend + frontend baseline)
- Phase 3-4 "pending"

### Actual Implementation

The auth system is more complete than the doc suggests:

1. **Primary path:** Supabase token verification via HTTP call to `/auth/v1/user` (in `auth.guard.ts` line 164-188).
2. **Legacy fallback:** Local JWT verification using `JWT_SECRET` (in `auth.guard.ts` line 134-148), gated by `AUTH_ALLOW_LEGACY=true`.
3. **API key auth:** SHA-256 hashed keys stored in Prisma `ApiKey` model, read-only access only.
4. **OAuth:** Google and GitHub via Passport strategies, minting local JWTs and setting HttpOnly cookies.
5. **Cookie-first extraction:** `access_token` cookie checked before `Authorization` header.

The auth doc should be updated to reflect that Phases 1-2 are effectively complete and the hybrid Supabase+legacy system is operational.

### Env Contract Drift

`docs/platform/auth-unification/ENV_CONTRACT.md` says `KLYTICS_APP_ID=capexcycle`. Every code path defaults to `cerniq`:
- `auth.guard.ts`: `process.env.KLYTICS_APP_ID || 'cerniq'`
- `auth.controller.ts`: `process.env.KLYTICS_APP_ID || 'cerniq'`
- `.env.example`: `KLYTICS_APP_ID=cerniq`
- `backend/src/auth/verify_supabase.rs`: `"cerniq".to_string()`

### Frontend Token Storage Concern

`frontend/lib/api.ts` stores access tokens in `sessionStorage` (migrating from `localStorage`). However, the backend sets HttpOnly cookies for auth tokens via `auth.controller.ts`. This creates a dual-path: cookie-based auth for server-rendered flows and `sessionStorage`-based auth for SPA flows. The frontend `api.ts` client attaches a `Bearer` token from storage, while the backend `auth.guard.ts` checks cookies first. This works but is fragile -- if a user authenticates via OAuth (cookie path) and then the SPA tries to use `api.ts` (header path), the stored token may be stale or absent.

---

## Environment / Deployment Drift

### docker-compose.yml vs .env.example

| Issue | Detail |
|-------|--------|
| Database names diverge | `docker-compose.yml` creates database `capexcycle` with user `capexcycle`. `.env.example` uses `DATABASE_URL=postgresql://<user>@localhost:5433/cerniq`. A developer following `.env.example` will get a connection refused because the database/user do not match. |
| Container names | All containers are prefixed `capexcycle-` (e.g., `capexcycle-db`, `capexcycle-redis`, `capexcycle-backend-node`). Should be `cerniq-`. |
| Redis port | `docker-compose.yml` maps `6380:6379`. `.env.example` says `REDIS_URL=redis://localhost:6379`. A developer must use port 6380 locally, or the Redis connection will fail (or hit a different Redis instance). |
| Rust backend in dev compose | `docker-compose.yml` still includes the `backend` (Rust) service on port 8001. This will fail to build or serve no useful purpose. |
| Frontend API_URL in dev compose | `docker-compose.yml` sets `NEXT_PUBLIC_API_URL: http://localhost:8001` for the frontend, pointing at the dead Rust backend. Should point to `http://localhost:3000` (NestJS). |
| `BACKEND_PORT` confusion | `.env.example` sets `BACKEND_PORT=8001`. But `main.ts` uses `process.env.PORT || process.env.BACKEND_PORT || 3000`, and all production configs use port 3000. The 8001 value is a Rust-era artifact. |

### docker-compose.prod.yml vs .env.example

| Issue | Detail |
|-------|--------|
| Missing Supabase vars | `docker-compose.prod.yml` does not pass any `SUPABASE_*` env vars to `backend-node`. The Supabase auth path will silently fall back to legacy JWT. |
| Missing Stripe vars | `docker-compose.prod.yml` does not pass `STRIPE_*` env vars. Billing module will fail at runtime. |
| Missing `ADMIN_KEY` | Not passed in compose. Admin endpoints will be unprotected or reject all requests depending on implementation. |
| No Rust backend | Correctly omitted from prod compose. But dev compose still includes it. |

### Vercel OIDC Token in `.env.local`

`frontend/.env.local` contains a Vercel OIDC JWT token in plaintext. This file should be in `.gitignore` (it is listed in `frontend/.gitignore` as `.env*.local` -- confirmed present). However, the token appears committed to the repo based on its presence. If this file was committed at any point, the token is exposed in git history.

### Stripe Test Key in `.env.local`

`frontend/.env.local` contains `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_51T1T3r...`. This is a test-mode publishable key (low risk), but it should still be in `.env.local` only and never committed.

---

## Docs That Appear Stale

| Document | Age Signal | Issue |
|----------|-----------|-------|
| `README.md` | References "version 2.0.0", describes quant platform | Entire framing is CapexCycleOS, not CERNIQ ALM |
| `ARCHITECTURE.md` (root, 69KB) | "Capex Cycle OS: Technical Architecture", Bun.js + Rust + K8s | Describes a system that does not exist in running code |
| `ARCHITECTURE_PART2.md` (root, 34KB) | Continuation of above | Same issues |
| `PRODUCT_SPEC.md` (root, 16KB) | "Capex Cycle OS: Product Specification", targets hedge funds | Product is now ALM for cooperativas |
| `PROJECT_SUMMARY.md` (14KB) | Lists NATS, K8s, ArgoCD, Rust, Bun, Streamlit | None of these are in the active stack |
| `START_HERE.md` (8.6KB) | "Your Quant Developer Portfolio" | Portfolio project framing, not product docs |
| `QUICKSTART.md` (5.3KB) | References `apps/api` Bun server and Rust backend | Dead code paths |
| `QUICKSTART_MARKET_DATA.md` | Market data API setup | May still be partially relevant for the quant features, but not for ALM |
| `EXECUTION_PLAN.md` (16KB) | CapexCycleOS phases | Pre-pivot planning doc |
| `PROCESS_CHECK.md` (18KB) | CapexCycleOS process check | Pre-pivot |
| `NEXT_STEPS.md` (9.3KB) | CapexCycleOS next steps | Pre-pivot |
| `DEPLOYMENT.md` (3.1KB) | Older deployment doc | Superseded by `docs/DEPLOYMENT_CHECKLIST.md` |
| `VALUATION_TESTING_GUIDE.md` | Tests cyclical valuation against Rust backend | Rust backend is dead |
| `SPENDCHECK_SETUP.md` | SpendCheck-specific setup | SpendCheck modules exist in code but are secondary to ALM |
| `LOGIN_CREDENTIALS.md` | Demo login credentials | May contain real credentials -- should be verified and potentially removed |
| `docs/platform/auth-unification/ENV_CONTRACT.md` | `KLYTICS_APP_ID=capexcycle` | Should be `cerniq` |
| `docs/ARCHITECTURE.md` (in docs/) | "CapexCycleOS Architecture", includes Rust backend box | Stale architecture diagram |
| `docs/architecture/system_map.md` | Likely CapexCycleOS era | Should be verified and updated |

---

## Highest-Risk Drift Items

1. **`docker-compose.yml` database name mismatch** -- A developer running `docker-compose up` and then connecting with the `.env.example` DATABASE_URL will get an authentication failure. The database is `capexcycle`, not `cerniq`. This blocks onboarding.

2. **`README.md` identity confusion** -- The first file any developer, investor, or customer reads says "Institutional-Grade Quantitative Finance Platform". This directly contradicts the actual product, the pricing page, and the SEO metadata.

3. **`docker-compose.yml` Redis port mismatch** -- `.env.example` says port 6379, compose maps to 6380. Silent cache failures in development.

4. **`docker-compose.prod.yml` missing env vars** -- No Supabase, Stripe, or admin key vars passed. Production Docker deployment would have broken auth and billing.

5. **Dual token storage** -- Frontend stores tokens in `sessionStorage` AND the backend sets HttpOnly cookies. Race conditions possible when mixing OAuth and direct-login flows.

6. **`frontend/.env.local` potentially committed** -- Contains Vercel OIDC token and Stripe test key. Should be verified as gitignored.

---

## Recommended Remediation Order

1. **Rewrite `README.md`** -- Replace the CapexCycleOS quant platform description with the CERNIQ ALM positioning. Use `docs/prompts/POSITIONING.md` as the source of truth. This is the single highest-leverage change for external credibility.

2. **Fix `docker-compose.yml`** -- (a) Change database name/user from `capexcycle` to `cerniq`, (b) remove the dead Rust `backend` service, (c) fix `NEXT_PUBLIC_API_URL` from `http://localhost:8001` to `http://localhost:3000`, (d) update container names from `capexcycle-*` to `cerniq-*`.

3. **Fix `docker-compose.prod.yml`** -- Add Supabase, Stripe, and admin key env vars. Rename containers.

4. **Align `.env.example`** -- Set `BACKEND_PORT=3000`, `REDIS_URL=redis://localhost:6380` (matching compose), `DATABASE_URL` user/db to match compose.

5. **Archive or delete stale root docs** -- Move `ARCHITECTURE.md`, `ARCHITECTURE_PART2.md`, `PRODUCT_SPEC.md`, `PROJECT_SUMMARY.md`, `START_HERE.md`, `QUICKSTART.md`, `EXECUTION_PLAN.md`, `NEXT_STEPS.md`, `PROCESS_CHECK.md` to a `docs/archive/capexcycle-era/` directory.

6. **Fix `docs/platform/auth-unification/ENV_CONTRACT.md`** -- Change `KLYTICS_APP_ID=capexcycle` to `KLYTICS_APP_ID=cerniq`.

7. **Decide Rust backend fate** -- Either delete `backend/` entirely (recommended -- it is 20GB+ of build artifacts with no active callers) or add a clear `DEPRECATED.md` at its root.

8. **Delete `apps/api/`** -- Dead Bun scaffold with missing dependencies. No value.

9. **Delete empty `services/data-ingest/` and `services/risk-engine/`** -- Empty directories create false expectations.

10. **Audit `frontend/.env.local`** -- Ensure it is not committed. If it is in git history, rotate the Vercel OIDC token and Stripe key.
