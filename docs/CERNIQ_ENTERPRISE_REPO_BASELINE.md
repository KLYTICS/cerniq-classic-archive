# CERNIQ Enterprise Repo Baseline

## Executive Summary

CERNIQ already has a real ALM product core in the NestJS backend and Next.js frontend: institution setup, balance-sheet ingestion, ingestion audit logs, duration gap, NII sensitivity, liquidity metrics, Monte Carlo stress testing, bilingual PDF generation, a client portal, a Stripe-backed report workflow, and a first-class analysis-run persistence layer are all present in code.

The repo is also materially mixed. Active code paths still support at least four overlapping narratives:

- CERNIQ ALM reporting for cooperativas and credit unions
- broader quant and portfolio analytics
- SpendCheck AP / invoice intelligence
- older CapexCycle positioning

For the enterprise slow-cook strategy, the codebase currently supports a narrow private ALM design-partner motion more credibly than a broad public “financial intelligence platform” claim. The repo still does not support the full internal blueprint you pasted: there is no CLI, no full model registry, no scenario registry, and no institutional dataset platform.

### Runtime Audit

| Subsystem | Classification | Basis |
|---|---|---|
| `backend-node/` | production-leaning | Real ALM, billing, portal, auth, PDF, jobs, Prisma models |
| `frontend/` | partial build | Real ALM and portal flows, but mixed public product positioning and multiple non-ALM surfaces |
| `backend/` | partial build | Working Rust routes for risk, reports, SpendCheck, and market data, but not the main ALM engine |
| `crates/compute-core/` | partial build | WASM risk/options/Monte Carlo library exists, but is not the ALM compute core yet |
| `apps/api/` | scaffold only | Bun prototype still branded Capex Cycle and references missing local services |

## Confirmed Implementation

### ALM Core

Confirmed from code:

- `backend-node/src/alm/alm.controller.ts` exposes institution CRUD, balance-sheet import, CSV upload, duration gap, NII sensitivity, liquidity, stress testing, PDF report generation, and stateless ALM endpoints.
- `backend-node/src/alm/alm.service.ts` implements duration gap, NII simulation, EVE, LCR, BPV, and full analysis.
- `backend-node/src/alm/alm-enterprise.service.ts` persists institutions and balance-sheet items, builds DB-backed analyses, and computes ALM summary and COSSEC-oriented outputs.
- `backend-node/src/alm/csv-ingestion.service.ts` supports bilingual CSV headers and cooperativa-specific aliases, validates rows, and emits warnings and errors.
- `backend-node/src/alm/stress-testing/stress-testing.service.ts` runs Vasicek-style Monte Carlo and regulatory scenarios.
- `backend-node/src/alm/reports/reports.service.ts` generates bilingual PDF reports with executive summary, duration gap, NII, liquidity, stress testing, COSSEC compliance, and recommendations.

### Enterprise Workflow Surface

Confirmed from code:

- `backend-node/src/billing/billing.service.ts` creates Stripe checkout sessions, provisions subscriptions, opens report jobs, and triggers onboarding emails.
- `backend-node/src/portal/portal.controller.ts` lets authenticated users list jobs, inspect jobs, and upload CSV data for a paid report job.
- `backend-node/src/pipeline/pipeline.worker.ts` polls queued jobs, generates English and Spanish PDFs, uploads them to object storage, and notifies the customer.
- `backend-node/prisma/schema.prisma` contains `Institution`, `BalanceSheetItem`, `InterestRateScenario`, `LiquidityPosition`, `Subscription`, `ReportJob`, `MagicLink`, and lead pipeline models.
- `backend-node/src/alm/analysis-runs.service.ts` persists ALM analysis runs with parameter snapshots, balance-sheet snapshots, and result summaries.
- `backend-node/src/alm/ingestion-logs.service.ts` persists CSV ingestion outcomes with schema version, row counts, warnings, and validation errors.

### Frontend Product Surfaces

Confirmed from code:

- `frontend/app/page.tsx` markets CERNIQ as an ALM reporting product for cooperativas and credit unions.
- `frontend/app/alm/*` implements authenticated ALM dashboard, balance-sheet editing, liquidity, sensitivity, and stress-test views.
- `frontend/app/portal/*` implements client-facing report status, billing, and submission flows.

### Other Active Systems

Confirmed from code:

- SpendCheck remains active across `frontend/app/spendcheck/*`, `frontend/lib/spendcheck-api.ts`, Rust `backend/src/routes/workspaces.rs`, `backend/src/routes/findings.rs`, and `backend/src/routes/reports.rs`.
- Quant / portfolio analytics remain active across NestJS market data, valuation, options, risk, and execution modules plus Rust risk routes.
- Lead generation and outbound/admin ops remain active in `backend-node/src/leads/*`, admin pages, and email sequences.

## Inferred Architecture

Inferred from code structure:

- NestJS is the effective system of record for CERNIQ ALM. That is where the institution data model, billing lifecycle, portal, and report workflow live.
- Rust is currently a parallel analytics/reporting surface, not the ALM compute backbone described in the long-term plan.
- The frontend is serving multiple product stories from one shell rather than cleanly separating “private enterprise ALM” from other experiments.
- The report pipeline is queue-like but implemented via cron polling and Prisma state transitions rather than a dedicated worker queue with explicit job leasing.
- The repo is already close to a “design partner operations” workflow if public positioning is narrowed and non-ALM surfaces are hidden from prospects.

## Product/User Flows

### ALM Paid Report Flow

Confirmed from code:

1. Prospect submits demo request from `frontend/app/page.tsx`.
2. Lead enters NestJS lead/billing flow through `frontend/lib/api.ts` and `backend-node/src/leads/*`.
3. Stripe checkout provisions a `ReportJob` in `backend-node/src/billing/billing.service.ts`.
4. User accesses portal in `frontend/app/portal/*`.
5. User uploads balance-sheet CSV through `backend-node/src/portal/portal.controller.ts`.
6. CSV is validated and imported by `backend-node/src/alm/csv-ingestion.service.ts` and `backend-node/src/alm/alm-enterprise.service.ts`.
7. Pipeline worker generates bilingual PDFs and sends report-ready email.

### ALM Dashboard Flow

Confirmed from code:

1. Authenticated user creates or seeds an institution.
2. User imports balance-sheet items manually or by CSV.
3. Frontend ALM pages call ALM summary, duration gap, NII sensitivity, liquidity, and stress-test endpoints.
4. User can directly download PDF reports.

### Non-ALM Flows

Confirmed from code:

- SpendCheck upload-to-findings flow is still present.
- Portfolio/risk/options/valuation flows are still present.

This means CERNIQ is not yet isolated as a single enterprise product surface.

## Data/Auth/Infra

### Data

Confirmed from code:

- Prisma/PostgreSQL is the main data layer for NestJS.
- ALM persistence currently covers institutions, balance-sheet items, liquidity positions, scenarios, subscriptions, and report jobs.
- There is no full model registry table, scenario library table, or institutional dataset layer.

Missing or unverifiable from code:

- Historical institutional dataset storage
- Yield curve registry
- Macroeconomic scenario library
- full model governance beyond per-run parameter snapshots

### Auth

Confirmed from code:

- NestJS has JWT auth, API keys, Google/GitHub OAuth, and optional Supabase-oriented auth unification docs.
- `docs/platform/auth-unification/*` indicates a partial migration toward Supabase verification.

Risk:

- Auth posture is still mixed across runtimes and product surfaces.

### Infra

Confirmed from code:

- `docker-compose.yml` runs Postgres, Redis, Rust backend, NestJS backend, and frontend.
- `.github/workflows/ci-cd.yml` runs frontend, NestJS, and Rust checks and deploys NestJS to Railway, while frontend deploy is handled by Vercel integration.
- `backend-node/src/pipeline/report-storage.service.ts` supports S3/R2-compatible storage for report PDFs.

Docs drift:

- Existing docs still describe Next.js 14 / React 18 and CapexCycle terminology, while manifests show Next.js 16 and React 19.

## Risks and Drift

### Product Positioning Drift

Confirmed drift:

- CERNIQ ALM wedge is visible in `frontend/app/page.tsx`.
- SpendCheck is still publicly routable.
- quant/risk/valuation pages are still publicly routable.
- `docs/ARCHITECTURE.md` and `apps/api/package.json` still use CapexCycle branding.

Impact:

- Public narrative is broader and noisier than the enterprise slow-cook strategy.

### Architecture Drift

Confirmed drift:

- The stated long-term plan wants Rust as the core institutional analytics engine.
- Current ALM logic is primarily in NestJS TypeScript, not Rust.

### API Contract Drift

Partially addressed in code:

- `POST /api/alm/analysis/run`
- `GET /api/alm/analysis-runs/:runId`
- `GET /api/alm/institutions/:institutionId/analysis-runs`

Still missing from code as dedicated top-level institutional contracts:

- `POST /api/alm/institutions`
- `POST /api/alm/institutions/:institutionId/balance-sheet-items`
- `GET /api/alm/:institutionId/report`
- portal upload and queued report flows

### Enterprise Readiness Gaps

Missing from code:

- CLI tool
- full model registry
- scenario dataset registry
- richer audit trail tying runs, datasets, and generated report artifacts together
- dedicated institutional partner workflow docs
- ALM-heavy test coverage

### Testing Drift

Confirmed from code:

- The test suite is much heavier around market data, technical indicators, and broader risk analytics than ALM.
- ALM has some service tests but not the kind of validation coverage expected for enterprise model confidence.

## Recommended Next Steps

### Immediate Q2 Focus

1. Treat NestJS ALM as the canonical product core and stop framing Rust as the current ALM engine.
2. Hide or gate public non-ALM surfaces so the repo and product story match the quiet enterprise motion.
3. Add the next missing enterprise primitives before launch: model registry, scenario registry, and richer artifact lineage between ingestion, analysis runs, and reports.
4. Create a narrow institutional API surface on top of the existing ALM services rather than inventing a separate product path.
5. Expand ALM test coverage around CSV ingestion, duration gap, NII, liquidity, stress testing, and report reproducibility.

### Q3 Preparation

1. Move model execution metadata into persistent storage per report run.
2. Decide whether Rust will actually become the ALM compute core or remain adjacent quant infrastructure.
3. Build internal-only design-partner workflows and sample institutional artifacts instead of broad public marketing.
4. Consolidate docs and repo naming around one CERNIQ enterprise story.
