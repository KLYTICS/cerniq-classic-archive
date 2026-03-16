# Repo Intelligence Brief

**Repository:** CERNIQ (formerly CapexCycle)
**Snapshot Date:** 2026-03-15
**Analysis Method:** Source code inspection of all key files; docs treated as secondary evidence.

---

## Executive Summary

CERNIQ is a **bilingual ALM (Asset-Liability Management) reporting platform** purpose-built for Puerto Rico cooperativas and U.S. credit unions. It has evolved from an earlier quant/portfolio analytics product called CapexCycle. Today, the ALM vertical is the primary revenue-generating system and the only part with a complete end-to-end workflow (upload CSV, run analysis, generate bilingual PDF, deliver via client portal, bill via Stripe). The legacy quant analytics surfaces (portfolio tracking, options Greeks, VaR/Monte Carlo, market data charts) remain in the codebase as functioning UI pages backed by a mix of live market data and client-side mocks.

The codebase is a **multi-product monorepo in transition**, with ALM as the clear production focus and the quant analytics features serving as demo/prospect material. The Rust backend is dormant. An outbound sales automation service exists in Python. Deployment targets Railway (backend-node) and Vercel (frontend), with docker-compose for local and production self-hosting.

**Overall maturity: ALM vertical is production-leaning. Everything else ranges from partial build to scaffold.**

---

## Confirmed Implementation

### ALM Engine (Production-Leaning)

The core value proposition. Confirmed by reading actual service code:

- **Duration Gap Analysis** -- Macaulay and Modified Duration per instrument, weighted-average across balance sheet, leverage-adjusted gap calculation. Full mathematical implementation in `alm.service.ts` (700 lines).
- **NII Sensitivity Simulation** -- Parallel rate shock scenarios (-300 to +300 bps), with repricing beta differentiation (0.40 for demand deposits, 0.80 for time deposits, 1.00 for market-rate instruments). Handles fixed vs. floating correctly.
- **EVE (Economic Value of Equity)** -- PV-based EVE calculation under rate shocks, with floater repricing approximation.
- **LCR (Liquidity Coverage Ratio)** -- Basel III computation with Level 1/2A/2B HQLA haircuts, Level 2 cap at 40% of total HQLA.
- **BPV (Basis Point Value / DV01)** -- Per-instrument and net BPV calculation.
- **COSSEC Compliance Engine** -- 12-ratio compliance check with pass/warning/fail classification, exam readiness scoring, sector median benchmarking using Puerto Rico cooperativa data, and bilingual output (EN/ES). Located in `alm-enterprise.service.ts` (868 lines).
- **Monte Carlo Stress Testing** -- Vasicek interest rate model with configurable paths (default 1000), horizon, volatility, and mean reversion. NII distribution (p5/p25/median/p75/p95) and monthly fan charts. 480 lines in `stress-testing.service.ts`.
- **PDF Report Generation** -- PDFKit-based bilingual report generator with COSSEC compliance section, duration gap, NII sensitivity, stress test results, and recommendations. 940 lines in `reports.service.ts`. Supports partner white-labeling.
- **CSV Ingestion Pipeline** -- Balance sheet CSV upload with validation, dry-run mode, and ingestion logging. Supports cooperativa-specific and generic templates.
- **Analysis Runs** -- Persisted, versioned analysis runs with parameter snapshots and result summaries.
- **Ingestion Logs** -- Full audit trail of every data import (rows validated, imported, errors, dry-run status).

### Auth System (Functioning Core)

- Email/password registration and login with bcrypt (12 rounds).
- JWT access tokens (24h) and refresh tokens (7d) with DB-backed revocation.
- OAuth via Google and GitHub (Passport strategies implemented).
- Magic link authentication for post-payment onboarding.
- API key management (create, list, revoke, with SHA-256 hashed storage).
- Supabase integration for org-level auth (fallback path in frontend API client).
- Audit log interceptor recording all mutating operations to `audit_logs` table.

### Billing (Functioning Core)

- Full Stripe integration: checkout sessions (one-time, monthly, annual, partner tiers), billing portal, webhook handling for `checkout.session.completed`, `invoice.paid`, `invoice.payment_failed`, `customer.subscription.created/updated/deleted`, `charge.dispute.created`.
- Subscription lifecycle management with auto-creation of report jobs on payment.
- Email sequences: welcome, data submission ack, monthly cycle, payment failed, cancellation, win-back (90-day scheduled).
- Revenue alerts to founder on every payment event.

### Client Portal (Functioning Core)

- Authenticated client-facing portal at `/portal/*` with: job list, job detail, CSV data submission, report download, billing management, settings.
- Job state machine: AWAITING_DATA -> VALIDATING -> VALIDATION_FAILED or QUEUED -> PROCESSING -> GENERATING_PDF -> UPLOADING -> COMPLETE or FAILED.
- Pipeline worker runs on a 2-minute cron, picks up QUEUED jobs, generates PDF, uploads to S3, emails delivery notification.

### Lead Pipeline (Functioning Core)

- Lead submission from landing page with duplicate detection (24h window).
- Auto-priority assignment by institution type.
- Business-day follow-up scheduling (9am AST).
- Internal notification + lead confirmation emails (bilingual for cooperativas).
- Admin lead CRM: list, filter, update status, add notes, mark report sent.
- Pipeline metrics: conversion rate, average close time, monthly revenue, pipeline value.
- Prospect pipeline: outbound cooperativa list with COSSEC benchmark data, outreach message generator (bilingual).

### Market Data (Functioning Core)

- Yahoo Finance provider for stocks/ETFs (quotes, fundamentals, historical prices, instrument profiles, news, ticker search).
- CoinGecko provider for crypto quotes and search.
- In-memory caching with TTLs (1min quotes, 24h fundamentals, 15min profiles, 5min news).
- Circuit breaker pattern (5 consecutive failures -> 30s open circuit).
- Provider health tracking with success rate and latency metrics.
- WebSocket realtime gateway for live quote streaming (Socket.IO).
- Technical indicator calculations (SMA, RSI, MACD, Bollinger Bands).

### Frontend (Partial Build to Functioning Core)

40+ route directories confirmed. Key pages:

| Route | Status |
|-------|--------|
| `/` (landing page) | Functioning -- bilingual, lead capture form, pricing CTA |
| `/alm/*` (dashboard, balance-sheet, liquidity, sensitivity, stress-test) | Functioning -- connected to backend ALM APIs |
| `/portal/*` (login, reports, submit, billing, settings) | Functioning -- client portal |
| `/login`, `/signup`, `/auth/*` | Functioning -- auth flow |
| `/admin/*` (leads, metrics, pipeline, prospects, checklist) | Functioning -- admin CRM |
| `/pricing` | Functioning -- pricing page |
| `/onboarding/*` | Functioning -- institution type selection |
| `/demo`, `/demo/embed` | Functioning -- interactive demo |
| `/dashboard/*` (ticker, valuation, upload, report) | Partial -- mix of live data and mocked responses |
| `/portfolios`, `/risk-analytics`, `/var-reports`, `/stress-test` | Partial -- mostly client-side mock data |
| `/options`, `/backtest`, `/execution-quality`, `/strategy` | Partial -- some mocked, some connected |
| `/volatility`, `/volatility-analytics`, `/factor-risk`, `/risk-parity` | Partial -- largely mock-driven |
| `/charts`, `/live-data` | Functioning -- live market data from Yahoo/CoinGecko |
| `/ai-insights` | Scaffold -- hardcoded mock insights |
| `/spendcheck/*` | Partial -- expense upload, findings, analytics pages exist |
| `/pablo` | Unknown -- single page, unclear purpose |
| `/roi` | Partial -- ROI calculator page |
| `/status` | Functioning -- system status |

### Data Model (Production-Leaning)

Prisma schema: 753 lines, 28 models. Well-normalized with proper indexes, cascading deletes, and enum types. 12 migrations deployed. Key model groups:

- **ALM Enterprise:** Institution, BalanceSheetItem, InterestRateScenario, LiquidityPosition, AnalysisRun, IngestionLog
- **SpendCheck:** Organization, OrganizationMember, Expense (with AI extraction fields)
- **Market/Portfolio:** Ticker, Portfolio, Position, MarketPrice, PipelineRun
- **Auth/Billing:** User, RefreshToken, ApiKey, Subscription, MagicLink, EmailSequence
- **CRM/Sales:** Lead, ProspectInstitution, CooperativaBenchmark, DemoRequest, Prospect, PartnerConfig
- **Pipeline:** ReportJob (9-state FSM)
- **Compliance:** AuditLog

---

## Inferred Architecture

```
Frontend (Next.js 16 / Vercel)
  |
  |-- Vercel rewrite /api/* -> api.cerniq.io
  |
Backend-Node (NestJS 11 / Railway)
  |-- Prisma ORM -> TimescaleDB/Postgres (port 5433)
  |-- Redis (caching, rate limiting)
  |-- Stripe (billing)
  |-- Resend (transactional email)
  |-- S3 (report PDF storage)
  |-- Yahoo Finance + CoinGecko (market data)
  |-- OpenAI (LLM for receipt parsing)
  |-- Socket.IO (realtime quotes)
  |
Backend-Rust (Axum / Dormant)
  |-- sqlx -> same Postgres
  |-- ndarray for numerical computing
  |
Outbound Engine (FastAPI / Python / Standalone)
  |-- Lead research, enrichment, messaging agents
  |-- Cooperativa seed data
```

**Deployment:**
- Frontend: Vercel (confirmed by `.vercel/`, `vercel.json`)
- Backend-Node: Railway (confirmed by `railway.toml`, `railway.json`, `Procfile`). Fly.io config also present (likely previous deployment target).
- Docker: `docker-compose.yml` for dev, `docker-compose.prod.yml` for production self-hosting. Container names still use `capexcycle-*` prefix.
- Domain: `cerniq.io` (confirmed in metadata, CORS, email signatures). API: `api.cerniq.io`.
- Database: TimescaleDB on Postgres 15.

---

## Major System Areas

### 1. ALM Vertical -- Production-Leaning

**Responsibility:** End-to-end ALM reporting for financial institutions with COSSEC compliance focus.
**Files:** `backend-node/src/alm/` (8 files), `backend-node/src/pipeline/` (4 files), `backend-node/src/portal/` (2 files), `frontend/app/alm/` (5 pages), `frontend/app/portal/` (6 pages).
**Classification:** **Production-leaning.** Full backend calculation engine, DB persistence, PDF generation, Stripe billing, client portal, email delivery. The only vertical with a complete payment-to-delivery loop.

### 2. Auth & Billing -- Functioning Core

**Responsibility:** User authentication, subscription management, magic links, API keys.
**Files:** `backend-node/src/auth/` (7 files), `backend-node/src/billing/` (4 files), `backend-node/src/email/` (3 files).
**Classification:** **Functioning core.** Full auth flow, Stripe webhooks, email sequences. Password reset is partially implemented (placeholder for email delivery).

### 3. Market Data & Quant Analytics -- Partial Build

**Responsibility:** Real-time quotes, historical prices, portfolio tracking, risk analytics, options pricing, valuation models.
**Files:** `backend-node/src/market-data/` (8 files), `backend-node/src/risk/` (7 files), `backend-node/src/valuation/` (6 files), `backend-node/src/options/` (7 files), `backend-node/src/portfolio/` (3 files), `backend-node/src/execution/` (3 files), `backend-node/src/ticker/` (3 files).
**Classification:** **Partial build.** Market data fetching from Yahoo/CoinGecko is fully functional. Risk calculations (Monte Carlo, VaR, correlation) are implemented in TypeScript but portfolio risk uses mock daily returns. Valuation engines (cyclical, compounder, frontier) have real calculation logic. Options has Black-Scholes Greeks implementation but the data provider for live chains is a TODO. Many frontend pages use hardcoded mock data in the API client rather than calling backend endpoints.

### 4. SpendCheck (Expense Management) -- Partial Build

**Responsibility:** Organization expense tracking with receipt parsing via AI.
**Files:** `backend-node/src/expenses/` (3 files), `backend-node/src/organizations/` (3 files), `backend-node/src/llm/` (3 files), `backend-node/src/storage/` (3 files), `frontend/app/spendcheck/` (7 pages).
**Classification:** **Partial build.** Schema exists, CRUD endpoints exist, LLM receipt parsing service exists. Frontend pages exist. But this product line appears to have been deprioritized in favor of ALM. The Prisma schema still labels these as "SpendCheck Models."

### 5. Lead/Sales Pipeline -- Functioning Core

**Responsibility:** Lead capture, CRM, outbound sales automation, prospect management.
**Files:** `backend-node/src/leads/` (4 files), `backend-node/src/jobs/` (3 files), `services/outbound/` (Python service with 6 agents).
**Classification:** **Functioning core.** Lead pipeline is actively used (landing page submits to it). Admin CRM is functional. Python outbound engine has lead research, enrichment, messaging, CRM, and follow-up agents with template-based email generation.

### 6. Rust Backend -- Scaffold / Dormant

**Responsibility:** Originally the primary backend for CapexCycle (portfolio analytics, market data, valuation).
**Files:** `backend/src/` (20+ source files), `backend/migrations/` (9 SQL migrations).
**Classification:** **Scaffold / dormant.** Has auth, routes, services, and valuation code, but the NestJS backend-node has fully replaced it. Docker-compose still builds it but it runs on port 8001 while backend-node runs on 3000. The frontend's `NEXT_PUBLIC_API_URL` pointed to the Rust backend originally but now routes through the Node backend.

### 7. Outbound Engine (Python) -- Partial Build

**Responsibility:** Automated outbound sales pipeline targeting cooperativas.
**Files:** `services/outbound/` (6 agents, 2 pipelines, scheduler, templates).
**Classification:** **Partial build.** Has the structure for daily outreach, lead ingestion from CSV, and multi-agent orchestration. Includes cooperativa seed data. Compiled `.pyc` files suggest it has been run, but there is no deployment config (no Dockerfile, no Procfile).

### 8. Infrastructure -- Partial Build

**Files:** `docker-compose.yml`, `docker-compose.prod.yml`, `infra/k8s/` (empty).
**Classification:** **Partial build.** Docker compose works for local and production. K8s directory is empty. No Terraform, no Helm charts. Deployment relies on Railway + Vercel PaaS.

---

## Product/User Flows

### Primary Flow: ALM Report Purchase (Confirmed)

1. Prospect visits `cerniq.io` landing page (bilingual).
2. Fills out lead form (institution type, asset range, contact info).
3. Lead is created in pipeline, internal notification sent to founder.
4. Prospect receives confirmation email with sample report offer.
5. After sales engagement, prospect goes to `/pricing` and selects tier.
6. Stripe checkout -> payment complete webhook fires.
7. System auto-creates user (if new), subscription, and report job.
8. Magic link emailed to client.
9. Client logs in via `/auth/magic`, lands on `/portal`.
10. Client uploads balance sheet CSV via `/portal/submit`.
11. System validates CSV, creates institution, imports balance sheet items.
12. Job transitions to QUEUED -> PROCESSING -> GENERATING_PDF -> COMPLETE.
13. Bilingual PDF generated, uploaded to S3.
14. Client notified by email, downloads from portal.

### Secondary Flow: Interactive ALM Demo (Confirmed)

1. User accesses `/alm` or `/demo`.
2. System loads demo institution data or seeds demo balance sheet.
3. User views duration gap, NII sensitivity, LCR, risk score.
4. User can navigate to `/alm/stress-test` for Monte Carlo simulation.
5. User can download PDF report for demo institution.

### Tertiary Flows (Partial / Mock-Driven)

- **Portfolio Analytics:** User creates portfolio, adds positions, views VaR/Monte Carlo risk. Mostly mock data on frontend; backend has real calculation logic.
- **Market Data:** User searches tickers, views live quotes and charts. Functional via Yahoo Finance.
- **SpendCheck:** User creates organization, uploads receipts, views findings. Backend functional, frontend partial.

---

## Data/Auth/Infra

### Data Layer

| Component | Technology | Status |
|-----------|-----------|--------|
| Primary DB | TimescaleDB (Postgres 15) | Production -- Railway hosted |
| ORM | Prisma 7.3 | Production -- 12 migrations |
| Cache | Redis 7 | Production -- quote caching, rate limiting |
| Object Storage | AWS S3 | Production -- report PDF storage |
| Market Data | Yahoo Finance, CoinGecko | Production -- live APIs |

### Auth Layer

| Mechanism | Status |
|-----------|--------|
| Email/Password (bcrypt) | Production |
| JWT (access + refresh) | Production |
| OAuth (Google, GitHub) | Implemented, likely functional |
| Magic Links | Production -- used in billing flow |
| API Keys | Implemented |
| Supabase (optional) | Fallback path in frontend |
| Rate Limiting | Production -- 100 req/min global (Throttler) |
| CORS | Production -- origin allowlist |
| Helmet CSP | Production |

### Deployment

| Target | Technology | Status |
|--------|-----------|--------|
| Frontend | Vercel | Production -- `cerniq.io` |
| Backend-Node | Railway | Production -- `api.cerniq.io` |
| Database | Railway (Postgres) | Production |
| Email | Resend | Production |
| Billing | Stripe | Production (test keys in .env.local) |
| Analytics | Segment, GA4, PostHog | Configured (optional) |
| Docker | compose v3.8 | Dev + prod self-host |

---

## Risks and Drift

### Naming Drift

- **Docker containers** still named `capexcycle-*` (capexcycle-db, capexcycle-redis, capexcycle-backend, capexcycle-backend-node, capexcycle-frontend).
- **Database** still named `capexcycle` with user `capexcycle`.
- **Fly.io config** references `capexcycleos-api` as the app name.
- **Token storage key** in frontend is `capex_access_token`.
- **Email footer** references "KLYTICS LLC" while product branding is "CERNIQ."

### Dormant / Dead Code

- **Rust backend** (`backend/`) is fully superseded by NestJS but still present. Docker-compose builds it. Nobody appears to call it. Its 9 SQL migrations are separate from Prisma migrations and likely unmaintained.
- **`services/data-ingest/`** -- empty directory.
- **`services/risk-engine/`** -- empty directory.
- **Frontend mock data** -- Many API client methods return `Promise.resolve({...hardcoded data...})` rather than calling backend endpoints. This means: `getPortfolios`, `getALMSummary` (partial), `getInstitution`, `getInstitutions`, `getVolatilityForecast`, `calculateCorrelation`, `calculateComponentVaR`, `searchTickers`, `getKPIScore` (via valuation screener), `getNodeValuation`, `getNodeValuationScreener`, `seedDemoInstitution`, `getMyWorkspaces`, `runStressTest` (frontend), `getInsights`. These will silently return fake data regardless of backend state.
- **`/pablo`** route -- unclear purpose, no obvious connection to any backend module.

### Security Concerns

- **`.env.local` committed** with a Vercel OIDC JWT and Stripe test publishable key. While .env.local is likely gitignored in production, it contains a real OIDC token.
- **`backend-node/.env`** exists (1.7KB) -- likely contains secrets. Needs to be verified it is in `.gitignore`.
- **`backend/.env`** exists (1.2KB) -- same concern.
- **Admin endpoints** guarded by `x-admin-key` header stored in sessionStorage -- no RBAC, no audit differentiation from regular users.
- **Password reset** returns a placeholder error ("not yet configured") -- users cannot recover accounts via email.

### Test Coverage

- **Backend-Node:** 10 spec files (alm, auth guard, auth service, analytics, organizations, expenses, options, ingestion-logs, analysis-runs, app controller). No test for billing, leads, pipeline, portal, market-data, risk, valuation, email, or execution.
- **Frontend E2E:** 5 Playwright specs (accessibility, ALM dashboard, API health, auth, navigation).
- **No CI pipeline** visible in the repo (no `.github/workflows/`, no `Jenkinsfile`).

### Frontend/Backend Coupling

- The frontend API client (`lib/api.ts`, 1037 lines) is a monolithic class with ~80 methods mixing real API calls and hardcoded mocks. The mock responses drift from actual backend responses as the backend evolves. Several methods have a `try/catch` pattern that falls through to a different URL, suggesting historical endpoint migration that is not fully resolved.

### Scalability Concerns

- All caching is in-memory (Map objects). No Redis-backed quote cache. A server restart loses all cached data. This is fine for a single-instance deployment but will not work with horizontal scaling.
- Pipeline worker runs as a NestJS cron job inside the main process. Heavy PDF generation during a report batch could block the API event loop.
- No queue (Redis, SQS, etc.) for report generation -- just a DB-polled cron.

---

## Recommended Next Steps

### Immediate (Pre-Sales Meeting)

1. **Remove committed secrets** from `.env.local` and verify `.env` files in `backend/` and `backend-node/` are gitignored.
2. **Fix password reset** -- it currently throws an error. Either implement via Resend or remove the UI path.
3. **Rename Docker artifacts** from `capexcycle-*` to `cerniq-*` for brand consistency during any demo that touches infrastructure.

### Short-Term (1-2 Weeks)

4. **Purge or isolate the Rust backend** -- it adds confusion and build time with no runtime value.
5. **Replace frontend mock responses** with real backend calls for the pages you intend to demo. At minimum: institutions list, ALM summary, stress test, portfolios.
6. **Add billing integration tests** -- Stripe is the revenue path and has zero test coverage.
7. **Add CI** -- at minimum a lint + test + build check on PRs.

### Medium-Term (1-2 Months)

8. **Extract pipeline worker** into a separate process or use a proper job queue (BullMQ/Redis) to avoid blocking the API.
9. **Move quote cache to Redis** for horizontal scaling readiness.
10. **Consolidate auth** -- the dual Supabase/NestJS auth path in the frontend is confusing. Pick one.
11. **Test the outbound engine** -- it has Python agents but no deployment or integration path. Either wire it into the main system or document it as standalone.

---

## Business Description Based on Implementation

**What CERNIQ actually is today, based on the code:**

CERNIQ is a **vertical SaaS platform for ALM (Asset-Liability Management) reporting**, targeting Puerto Rico cooperativas and U.S. credit unions. Its core product is a bilingual (Spanish/English) compliance report generated from uploaded balance sheet data. The platform computes duration gap, NII sensitivity, EVE, LCR (Basel III), BPV, and COSSEC-specific compliance ratios, packages them into a PDF with recommendations, and delivers them through a client portal.

The business model is a micro-SaaS with four tiers: one-time report ($X), monthly subscription, annual subscription, and partner/white-label. Payment flows through Stripe with automated onboarding via magic links.

The platform also contains a **secondary product surface** -- a quant analytics dashboard with real-time market data, portfolio risk analytics, options pricing, and equity valuation models. This surface is functional for market data display but many analytical features still return mock data. It likely serves as a demo/prospect engagement tool rather than a standalone product.

A **third product surface** -- SpendCheck (organizational expense management with AI receipt parsing) -- exists in the schema and backend but appears deprioritized.

**The revenue-generating core is the ALM reporting pipeline. Everything else is supporting infrastructure, demo material, or legacy code from the platform's earlier identity as a quant analytics tool.**
