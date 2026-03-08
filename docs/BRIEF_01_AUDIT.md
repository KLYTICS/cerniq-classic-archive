# BRIEF 01 — FULL SYSTEM AUDIT & STRATEGIC GAP ANALYSIS
## CapexCycleOS | KLYTICS LLC | Technical Due Diligence
### Audit Date: 2026-03-05

---

# SYSTEM OVERVIEW

## Stack Map

| Layer | Technology | Status |
|-------|-----------|--------|
| **Frontend** | Next.js 15, React 19, Tailwind CSS 4, Zustand, Recharts, Plotly | Active |
| **Backend (Primary)** | NestJS (TypeScript), Prisma ORM, PostgreSQL | Active — ALM engine lives here |
| **Backend (Legacy)** | Rust/Axum, SQLx, PostgreSQL | Active — market data, valuation, SpendCheck |
| **Database** | PostgreSQL (port 5433), Redis (port 6379) | Active |
| **PDF Generation** | PDFKit (backend-node) + html2canvas/jsPDF (frontend fallback) | Both exist |
| **Auth** | bcrypt, @nestjs/jwt, Passport (Google + GitHub OAuth) | Active |
| **Deployment** | Fly.io (backend), Vercel (frontend), Docker Compose (local) | Configured |
| **CI/CD** | GitHub Actions | Configured |
| **i18n** | Custom hook-based EN/ES system | Active |

## Module Inventory

### NestJS Backend (backend-node/) — PRIMARY FOR ALM
```
src/
  alm/                          <-- CORE ALM ENGINE
    alm.service.ts              - Duration Gap, NII Simulation, EVE, LCR, BPV (pure calc)
    alm-enterprise.service.ts   - DB-backed ALM: institution CRUD, balance sheet import, summary generation
    alm.controller.ts           - 17 endpoints: enterprise (auth) + stateless (no auth)
    alm.module.ts               - Module wiring
    alm.dto.ts                  - Full DTO definitions
    stress-testing/
      stress-testing.service.ts - Monte Carlo (Vasicek model), 4 regulatory scenarios
    reports/
      reports.service.ts        - 6-page branded PDF report via PDFKit
    workspace-onboarding.service.ts - Demo data seeding
    dto/                        - CreateInstitution, BulkBalanceSheetImport DTOs
  auth/                         - JWT + bcrypt + OAuth (Google/GitHub)
  risk/                         - Advanced risk: VaR, stress tests, factor risk
  market-data/                  - Yahoo Finance, quotes, correlation
  valuation/                    - Cyclical, compounder, frontier engines
  jobs/                         - Daily pipeline (CRON), admin trigger, health
  options/                      - Options pricing, Greeks, strategies
  email/                        - Email service
  llm/                          - LLM integration
  organizations/                - Org management
  cache/                        - Global cache module
  common/                       - Data quality service
```

### Rust Backend (backend/) — SECONDARY
```
src/
  auth/       - JWT verification, middleware (Bearer only, no cookie support)
  routes/     - portfolios, risk (mock VaR), valuation (mock+cyclical), screener, insights,
                market_data, filings, findings, reports, reports_gen, websocket, etc.
  services/   - sec_filings, yahoo_finance, market_data, features, leak_detectors, mock_valuations
  valuation/  - cyclical.rs (real cycle detection engine)
  compute     - via crates/compute-core (Monte Carlo)
```

### Frontend (frontend/)
```
app/
  alm/                  - Main ALM dashboard + sub-pages
    page.tsx            - ALM overview with risk score, duration gap, NII, LCR KPIs
    layout.tsx          - ALM layout with sidebar nav
    balance-sheet/      - Balance sheet input page
    sensitivity/        - NII sensitivity scenarios page
    liquidity/          - LCR analysis page
    stress-test/        - Stress testing page
  dashboard/            - Main dashboard, valuation, upload, report
  login/                - Login page
  demo/                 - Demo mode page
  pricing/              - Pricing page
  onboarding/           - Institution onboarding flow
  admin/                - Admin panel (checklist, prospects)
  status/               - System status page
  risk-analytics/       - Risk analytics
  live-data/            - Real-time market data
  ai-insights/          - AI insights
  [many more pages]
components/
  alm/                  - ALMProvider, RiskScoreGauge, RiskBadge, ScenarioChart, ALMKPICard
  risk/                 - VolatilityForecastChart, ComponentVaRChart
  layout/               - Sidebar
  valuation/            - CycleChart, MetricsGrid, UniversalTickerSearch
  options/              - GreeksCalculator, StrategyBuilder
hooks/
  usePDFExport.ts       - Client-side PDF export via html2canvas + jsPDF
lib/
  api.ts                - Axios client (Rust backend + NestJS getNode* methods)
  api-client.ts         - Fetch client (NestJS)
  spendcheck-api.ts     - SpendCheck-specific API client
  store.ts              - Zustand stores
  analytics.ts          - Segment/GA4/PostHog wrapper
  i18n/                 - EN/ES locale files + translation hook
  websocket.ts          - Socket.IO client
```

## Deployment State

| Component | Target | Status |
|-----------|--------|--------|
| Frontend | Vercel | Deployed (latest commit: 82d4f63) |
| NestJS Backend | Fly.io / Docker (port 3000 internal, 3002 external) | Configured |
| Rust Backend | Fly.io / Docker (port 8001) | Configured |
| PostgreSQL | Port 5433, user capexcycle | Local confirmed |
| Redis | Port 6379 | Local, graceful degradation |

---

# ALM ENGINE ASSESSMENT

## Existing Capabilities — WHAT WORKS

The ALM calculation engine is **substantially more complete than the briefs assumed.** Here is what already exists:

### Module 1: Duration Gap Analysis (COMPLETE)
- **Location**: `backend-node/src/alm/alm.service.ts`
- **Method**: Macaulay Duration per instrument → weighted average → Duration Gap = D_A - (L/A) × D_L
- **Handles**: Fixed-rate (annual coupon model), floating-rate (duration = time to repricing)
- **Modified Duration**: Calculated correctly (Macaulay / (1 + y))
- **BPV (DV01)**: Per-instrument and net BPV
- **Output**: Asset/liability durations, gap, leverage-adjusted gap, interpretation text
- **Assessment**: Mathematically correct for the simplified model used. Production-quality.

### Module 2: NII Sensitivity Simulation (COMPLETE)
- **Location**: `backend-node/src/alm/alm.service.ts`
- **Scenarios**: Configurable, defaults to [-300, -200, -100, -50, 0, +50, +100, +200, +300] bps
- **Method**: Base NII = Σ(asset income) - Σ(liability cost). Floating instruments reprice with shock; fixed stay constant.
- **Output**: Per-scenario NII, change ($), change (%), risk classification (low/medium/high/critical)
- **Assessment**: Correct repricing gap methodology. Missing deposit repricing betas (Brief 03 requirement) — currently assumes 100% beta for all floating instruments.

### Module 3: EVE Stress Test (COMPLETE)
- **Location**: `backend-node/src/alm/alm.service.ts`
- **Method**: PV of all cash flows under each rate shock. Fixed: annual coupon + par at maturity. Floating: par repricing model.
- **Scenarios**: Same configurable rate shocks as NII
- **Output**: Base EVE, per-scenario EVE, change ($), change (%)
- **Assessment**: Correct present value methodology. Could benefit from explicit risk flag thresholds per Brief 03 spec.

### Module 4: LCR (Liquidity Coverage Ratio) (COMPLETE)
- **Location**: `backend-node/src/alm/alm.service.ts`
- **Method**: Basel III tiered HQLA with haircuts (Level 1: 0%, Level 2A: 15%, Level 2B: 25%)
- **Cap**: Level 2 ≤ 40% of total HQLA correctly implemented
- **Derived LCR**: Can derive rough LCR from balance sheet when explicit HQLA data not provided
- **Output**: LCR %, HQLA breakdown, compliance status (compliant/warning/breach)
- **Assessment**: Production-quality Basel III implementation.

### Module 5: BPV (Basis Point Value / DV01) (COMPLETE)
- **Location**: `backend-node/src/alm/alm.service.ts`
- **Method**: BPV_i = amount × modifiedDuration × 0.0001. Net BPV = assets - liabilities.
- **Output**: Per-instrument BPVs, totals, interpretation text
- **Assessment**: Correct.

### Module 6: Monte Carlo / Vasicek Stress Testing (COMPLETE)
- **Location**: `backend-node/src/alm/stress-testing/stress-testing.service.ts`
- **Method**: Vasicek mean-reverting interest rate model (dr = κ(θ-r)dt + σ√dt·ε)
- **Features**: 1000 paths, 12-month horizon, NII distribution (P5/P25/P50/P75/P95), monthly NII bands, rate path visualization
- **Regulatory scenarios**: Rapid Rise (+300bps), Gradual Rise (+200bps), Yield Curve Inversion, Shock Down (-200bps)
- **Assessment**: Institutional-grade stochastic simulation. Uses Box-Muller transform for normal random numbers.

### Module 7: Full Analysis Pipeline (COMPLETE)
- **Location**: `backend-node/src/alm/alm.service.ts` → `fullAnalysis()`
- **Combines**: Duration Gap + NII Sim + EVE + BPV + LCR in a single call
- **Assessment**: Clean orchestration. Works.

### Module 8: Enterprise (DB-backed) ALM (COMPLETE)
- **Location**: `backend-node/src/alm/alm-enterprise.service.ts`
- **Features**: Institution CRUD, balance sheet import (bulk), liquidity position tracking
- **DB-backed calculations**: Reads BalanceSheetItem records, converts to InstrumentDto, runs through AlmService
- **ALM Summary**: Generates composite view with risk score, top risks, recommendations
- **Assessment**: Full enterprise data pipeline. Missing CSV upload endpoint.

### Module 9: PDF Report Generation (COMPLETE)
- **Location**: `backend-node/src/alm/reports/reports.service.ts`
- **Technology**: PDFKit (server-side)
- **Sections**: Cover page, Executive Summary, Interest Rate Risk, Liquidity Risk, Stress Testing, Recommendations
- **Branding**: CapexCycleOS + KLYTICS, amber/navy color scheme
- **Features**: Styled tables with color-coded values, section headers, footers, page breaks
- **Endpoint**: `GET /api/alm/:institutionId/report` (auth-protected, streams PDF)
- **Assessment**: **Already a client-presentable PDF.** Needs COSSEC-specific compliance checklist and bilingual content to match Brief 04 spec, but the core report engine is done.

### Module 10: Demo Balance Sheet (COMPLETE)
- **Location**: `backend-node/src/alm/alm.service.ts` → `getDemoBalanceSheet()`
- **Data**: $500M community bank with 5 asset types and 5 liability types
- **Endpoints**: `GET /api/alm/demo-balance-sheet` and `GET /api/alm/demo-analysis`
- **Assessment**: Good for demos. Needs a cooperativa-specific sample per Brief 02 spec.

## Critical Gaps — WHAT'S MISSING FOR THE $750 REPORT

| # | Gap | Severity | Brief |
|---|-----|----------|-------|
| G1 | **COSSEC Regulatory Compliance Checklist** — No capital ratio, loan-to-share, or COSSEC-specific benchmarks | P0 | Brief 03 |
| G2 | **Executive Risk Score** — Exists in enterprise service but scoring logic is ad-hoc, not the 100-point deduction model from Brief 03 | P1 | Brief 03 |
| G3 | **Deposit Repricing Betas** — NII simulation assumes 100% pass-through for all floating instruments. Brief 03 requires savings=0.4, CDs=0.8, borrowed=1.0 | P1 | Brief 03 |
| G4 | **Bilingual Report Content** — PDF is English-only. Brief 04 requires full EN/ES throughout | P1 | Brief 04 |
| G5 | **CSV Upload/Template** — No CSV ingestion endpoint exists. CFO data entry requires this | P0 | Brief 02 |
| G6 | **Cooperativa Sample Dataset** — Demo is a generic $500M bank. Need a ~$52M cooperativa per Brief 02 | P1 | Brief 02 |
| G7 | **Report Job Queue** — No async job management. Reports generate synchronously | P2 | Brief 02 |
| G8 | **Loan Prepayment Assumptions** — Not modeled. Brief 03 specifies 10% CPR mortgage, 15% CPR consumer | P2 | Brief 03 |
| G9 | **Dynamic Recommendations** — Current recommendations are partially hardcoded. Need flag-driven generation | P1 | Brief 04 |
| G10 | **Report ID / Traceability** — PDF doesn't include a unique report/job ID | P2 | Brief 04 |

## Correctness Flags — WHAT PRODUCES WRONG RESULTS

| # | Issue | Location | Impact |
|---|-------|----------|--------|
| C1 | **Rust risk calculations use mock data** — VaR, risk parity, Monte Carlo all derive volatility from hardcoded sector-based values (`get_mock_valuation()`), not actual price history | `backend/src/routes/risk.rs` | Demo-only quality, not institutional |
| C2 | **Flat 0.3 correlation** — Portfolio volatility assumes 30% correlation between all assets | `backend/src/routes/risk.rs:470` | Incorrect for real portfolios |
| C3 | **CVaR = VaR × 1.25** — Not a proper tail expectation calculation | `backend/src/routes/risk.rs:173` | Approximate, not institutional-grade |
| C4 | **Hardcoded shares_outstanding = 250M** — Cyclical valuation uses a fixed share count | `backend/src/valuation/cyclical.rs:298` | Wrong for any ticker except LRCX-like |
| C5 | **THETA_BPS = 525 (hardcoded)** — Vasicek model uses stale Fed Funds rate | `stress-testing.service.ts:77` | Should be configurable or fetched dynamically |

**Note**: C1-C4 are in the Rust backend and do not affect the ALM pipeline (which runs entirely in NestJS). C5 is in the NestJS stress testing service and should be parameterized.

---

# DATA INPUT ASSESSMENT

## Current Input Capabilities

| Method | Endpoint | Status |
|--------|----------|--------|
| JSON POST (stateless) | `POST /api/alm/full-analysis` | Working — accepts BalanceSheetDto |
| JSON POST (enterprise) | `POST /api/alm/institutions/:id/balance-sheet-items` | Working — bulk import |
| Demo endpoint | `GET /api/alm/demo-balance-sheet` | Working |
| Demo seed | `POST /api/alm/seed-demo` | Working — seeds bank/credit_union/family_office |
| CSV Upload | None | **MISSING** |

## BalanceSheetDto Schema (Current)

```typescript
interface BalanceSheetDto {
  assets: InstrumentDto[];
  liabilities: InstrumentDto[];
  equity: number;
}

interface InstrumentDto {
  name: string;
  amount: number;          // in dollars (not millions)
  rate: number;            // decimal (0.05 = 5%)
  maturityYears: number;   // 0 for overnight
  isFloating: boolean;
  repricingFrequencyMonths?: number; // 0 for overnight/daily
}
```

## Gap to Cooperativa CFO Reality

| What CFO Has | What System Expects | Gap |
|-------------|-------------------|-----|
| Excel/PDF with balance sheet totals | BalanceSheetDto JSON | Need CSV template + upload |
| Line items grouped by category | Individual InstrumentDto array | Need mapping guidance in template |
| Rates as percentages (5.5%) | Rates as decimals (0.055) | Need auto-conversion in validation |
| Asset totals and subtotals | Individual instrument amounts | Need clear template structure |
| AITSA quarterly filing format | Custom schema | Need AITSA-to-schema mapping |
| Spanish labels | English field names | Need bilingual CSV headers |

## Recommended: Brief 02 builds on existing InstrumentDto schema, adds CSV parsing and cooperativa-specific template.

---

# REPORT GENERATION ASSESSMENT

## Current State — BETTER THAN EXPECTED

Two PDF generation paths exist:

### Path 1: Server-side PDFKit (PRIMARY)
- **Location**: `backend-node/src/alm/reports/reports.service.ts`
- **Endpoint**: `GET /api/alm/:institutionId/report`
- **Quality**: 6-page branded report with cover page, tables, color-coding, footers
- **Libraries**: PDFKit (pure Node.js, no headless browser needed)
- **Content**: Executive summary, interest rate risk, liquidity, stress testing, recommendations

### Path 2: Client-side html2canvas + jsPDF (SECONDARY)
- **Location**: `frontend/hooks/usePDFExport.ts`
- **Quality**: Screenshot-to-PDF. Lower quality, captures dark theme.
- **Used from**: ALM overview page "Download PDF" button

## Gap to Brief 04 Deliverable

| Requirement | Current | Gap |
|-------------|---------|-----|
| Cover page | Yes — institution name, date, branding | Needs report ID, confidential watermark |
| Executive Summary | Yes — risk score, key metrics, narrative | Needs bilingual, "What This Means" section |
| Balance Sheet Snapshot | No | Need to add Section 2 |
| NII Sensitivity | Yes — table with color-coded scenarios | Good, needs bilingual headers |
| EVE Stress Test | Included in Interest Rate Risk section | Already there |
| Duration Gap | Mentioned in narrative | Needs dedicated visual section |
| COSSEC Compliance Checklist | **No** | **Must build** (requires Module 4 from Brief 03) |
| Recommendations | Yes — dynamically generated, priority-tagged | Needs bilingual, better flag-driven logic |
| Bilingual content | **No** | **Must add EN/ES throughout** |
| Charts/visualizations | No (PDFKit text/tables only) | Could add basic chart rendering |

## Recommended Approach
The existing PDFKit infrastructure is solid. Brief 04 work is **incremental**, not greenfield:
1. Add COSSEC compliance checklist section
2. Add balance sheet snapshot section
3. Add bilingual content (EN/ES mirroring)
4. Add report ID and watermark
5. Improve recommendations with flag-driven generation

---

# AUTH AUDIT

## BUG-001: SameSite Cookie Misconfiguration

### Root Cause Analysis

**Two separate CORS/cookie issues identified:**

#### Issue A: Rust Backend CORS (CRITICAL)
- **Location**: `backend/src/main.rs:66-69`
- **Problem**: `CorsLayer::new().allow_origin(Any)` — when `Access-Control-Allow-Origin: *` is sent, browsers **refuse to include cookies** even with `credentials: 'include'`. The CORS spec forbids `Access-Control-Allow-Credentials: true` with a wildcard origin.
- **Impact**: All authenticated requests from Vercel frontend to Fly.io Rust backend will fail.
- **Fix**: Replace `Any` with a dynamic origin callback (like the NestJS backend does).

#### Issue B: NestJS Backend Cookies (CORRECTLY CONFIGURED)
- **Location**: `backend-node/src/auth/auth.controller.ts:28-33`
```typescript
const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: isProduction,               // true in prod (HTTPS)
  sameSite: isProduction ? 'none' : 'lax',  // 'none' for cross-origin
  path: '/',
};
```
- **Assessment**: This is correctly configured for cross-origin deployment. `SameSite=None` + `Secure=true` in production is the correct combination.

#### Issue C: NestJS CORS (CORRECTLY CONFIGURED)
- **Location**: `backend-node/src/main.ts:81-116`
- Uses dynamic origin callback with `credentials: true`
- Whitelists localhost, FRONTEND_URL, *.vercel.app, *.railway.app, *.fly.dev, *.capexcycleos.com
- **Assessment**: Correct.

#### Issue D: Frontend Axios (CORRECTLY CONFIGURED)
- **Location**: `frontend/lib/api.ts:18` — `withCredentials: true`
- **Location**: `frontend/lib/spendcheck-api.ts:81` — `withCredentials: true`
- **Assessment**: Correct. Both API clients send cookies.

### BUG-001 Resolution

The actual bug is **only in the Rust backend CORS** (Issue A). The NestJS backend, which is the primary backend for ALM, is correctly configured.

**Fix required**: In `backend/src/main.rs`, replace:
```rust
let cors = CorsLayer::new()
    .allow_origin(Any)
    .allow_methods(Any)
    .allow_headers(Any);
```
With a dynamic origin policy matching the NestJS approach, and add `.allow_credentials(true)`.

**However**: For the ALM product specifically, the Rust backend may not be needed at all. All ALM endpoints are on the NestJS backend. If the Rust backend is only used for market data/valuation (public endpoints), the wildcard CORS may be acceptable for those routes.

### Other Auth Risks

| Risk | Severity | Notes |
|------|----------|-------|
| Rust backend auth is Bearer-only (no cookie support) | Low | Not blocking — ALM uses NestJS |
| OAuth callbacks redirect to hardcoded `FRONTEND_URL` default `localhost:3001` | Medium | Must set FRONTEND_URL in Fly.io env |
| No rate limiting visible on NestJS ALM endpoints | Medium | ThrottlerModule is configured globally but ALM-specific limits may be needed |
| JWT secret validated at startup (min 32 chars) | Good | Secure practice |

---

# FRONTEND AUDIT

## Demo-Readiness Score: 7/10

### What Works Well
- **ALM Overview page** (`/alm`): Professional dark-theme dashboard with risk score gauge, duration gap visualization, KPI strip, navigation cards, recommendations. Uses real data from NestJS backend.
- **i18n system**: Full EN/ES translations exist in `lib/i18n/locales/`. Toggle works.
- **ALM sub-pages**: Balance sheet, sensitivity, liquidity, stress testing pages all exist with dedicated routes.
- **Component quality**: Custom ALMProvider context, RiskScoreGauge, RiskBadge, ScenarioChart components.
- **Analytics**: Segment integration tracking ALM events.
- **PDF download button**: Works from ALM page (client-side capture).

### Blocking Issues for Client Demo

| Issue | Page | Severity |
|-------|------|----------|
| No public landing page — current `/` may be a generic dashboard | Root | P0 for Brief 05 |
| Login required for ALM — cooperativa CFO can't see demo without account | /alm | P0 — need public demo mode |
| No report request form — no lead capture | None exists | P0 for Brief 05 |
| Pricing page exists but content TBD | /pricing | P1 |

### Non-Blocking Improvements
- Dark theme is developer-focused, not CFO-focused (Brief 05 addresses this)
- Some pages (charts, backtest, strategy) are feature-rich but not relevant to ALM product
- Multiple API clients (3 separate files) create maintenance complexity

### Navigation Structure
```
/ (root)
/login
/dashboard (+ /upload, /valuation, /report/:id)
/alm (+ /balance-sheet, /sensitivity, /liquidity, /stress-test)
/demo
/pricing
/onboarding (+ /institution-type)
/admin (+ /checklist, /prospects)
/status
/risk-analytics
/live-data
/ai-insights
/var-reports
/stress-test
/volatility
/charts
/backtest
/strategy
/spendcheck (+ /login, /findings, /report)
```

---

# DEPLOYMENT AUDIT

## Current Live State

| Component | Status | Last Known State |
|-----------|--------|-----------------|
| Vercel Frontend | Deployed | Latest commit 82d4f63 (2026-02-28) |
| Fly.io NestJS | Configured | Needs verification — docker-compose maps 3002:3000 |
| Fly.io Rust | Configured | Needs verification |
| Database (Fly.io) | Configured | Needs migration verification |

## Blockers to Clean Production Deploy

1. **FRONTEND_URL env var**: Must be set on Fly.io to the exact Vercel URL
2. **DATABASE_URL**: Must point to Fly.io PostgreSQL
3. **JWT_SECRET**: Must be set (min 32 chars) on Fly.io
4. **Prisma migrations**: Must be run against production database
5. **Docker port conflict**: NestJS on 3002:3000 externally, Rust on 8001 — documented in memory

---

# PRIORITIZED REMEDIATION ROADMAP

## P0: Must Fix Before First Client Engagement

| Item | Description | Effort | Brief |
|------|-------------|--------|-------|
| P0-1 | **CSV Upload Template + Parser** — Create cooperativa-specific CSV template, upload endpoint with validation | M | 02 |
| P0-2 | **COSSEC Compliance Checklist** — Capital ratio, liquidity ratio, loan-to-share, delinquency, NIM calculations with COSSEC thresholds | M | 03 |
| P0-3 | **Cooperativa Sample Dataset** — ~$52M cooperativa with realistic balance sheet | S | 02 |
| P0-4 | **Landing Page** — Public-facing consultancy page with report request form | L | 05 |
| P0-5 | **Demo Mode** — Public accessible demo that runs sample cooperativa through full pipeline | M | 06 |
| P0-6 | **Lead Capture Form** — Submit to backend, store lead record | S | 05 |
| P0-7 | **Fix Rust CORS** (if Rust backend stays in production) | S | 06 |

## P1: Must Fix Before First Paid SaaS User

| Item | Description | Effort | Brief |
|------|-------------|--------|-------|
| P1-1 | **Bilingual PDF Report** — EN/ES content throughout all sections | M | 04 |
| P1-2 | **Executive Risk Score** — Implement 100-point deduction scoring model per Brief 03 | M | 03 |
| P1-3 | **Deposit Repricing Betas** — Add configurable betas to NII simulation | S | 03 |
| P1-4 | **Balance Sheet Snapshot in PDF** — Add Section 2 to report | S | 04 |
| P1-5 | **Dynamic Recommendations** — Flag-driven bilingual recommendations | M | 04 |
| P1-6 | **Report Job Queue** — Async job management with status tracking | M | 02 |
| P1-7 | **Admin Panel** — List report requests, trigger generation, download PDFs | M | 06 |

## P2: Should Fix Within 30 Days

| Item | Description | Effort | Brief |
|------|-------------|--------|-------|
| P2-1 | **THETA_BPS configurable** — Fed Funds rate should be env var or fetched | S | 03 |
| P2-2 | **Loan Prepayment Assumptions** — Add CPR modeling to NII simulation | M | 03 |
| P2-3 | **Report ID/Watermark** — Unique ID on cover page, traceability | S | 04 |
| P2-4 | **OpenAPI/Swagger** — Document all ALM endpoints | M | 02 |
| P2-5 | **Email notification on report completion** | S | 06 |
| P2-6 | **End-to-end integration test** | M | 06 |

## P3: Backlog

| Item | Description | Effort | Brief |
|------|-------------|--------|-------|
| P3-1 | Full unit test suite for ALM calculations | L | 03 |
| P3-2 | Chart rendering in PDF (bar charts, gauges) | M | 04 |
| P3-3 | AITSA filing format mapping | L | 02 |
| P3-4 | White-label report theming (for CPA channel) | M | 04 |
| P3-5 | Rate environment auto-fetch (FRED API or similar) | M | 03 |
| P3-6 | Retire/deprecate Rust risk endpoints in favor of NestJS | L | N/A |

---

# EFFORT ESTIMATE

## P0 + P1 Combined

| Category | Hours |
|----------|-------|
| Brief 02 (Data Input) — CSV template, cooperativa sample, validation, job queue | 16-20 |
| Brief 03 (ALM Engine) — COSSEC checklist, risk score, betas, flag logic | 12-16 |
| Brief 04 (PDF Report) — bilingual, COSSEC section, balance sheet, watermark | 12-16 |
| Brief 05 (Frontend) — landing page, pricing, form, i18n, demo mode | 20-28 |
| Brief 06 (Integration) — CORS fix, admin panel, pipeline wiring, deployment verification | 16-20 |
| **Total P0 + P1** | **76-100 hours** |

## Recommended Build Sequence

```
Brief 02 (Data Input)     ████████░░ 2 days — CSV template + cooperativa sample + validation
Brief 03 (ALM Engine)     ██████░░░░ 2 days — COSSEC checklist + risk score + betas
Brief 04 (PDF Report)     ██████░░░░ 2 days — bilingual + new sections + watermark
Brief 05 (Frontend)       ████████████ 3 days — landing page + form + demo mode + pricing
Brief 06 (Integration)    ████████░░ 2 days — wiring + auth fix + admin + deploy
                          ─────────────────
                          ~11 working days for P0 + P1
```

---

# KEY STRATEGIC FINDING

**The briefs significantly underestimated the current state of the system.** The ALM calculation engine, enterprise data pipeline, stress testing, and PDF report generation are all substantially complete. The existing codebase is **not a prototype** — it's a functional ALM platform missing the last mile of COSSEC-specific compliance logic, bilingual output, and a public-facing sales surface.

The path to the first $750 client engagement is:
1. Add COSSEC compliance checklist (the regulatory-specific piece cooperativas need)
2. Build the cooperativa CSV template (how data gets in)
3. Make the PDF bilingual (their board needs Spanish)
4. Build the landing page (how clients find you)
5. Wire the demo mode (how you sell it)

Everything else is already built. This is a finishing sprint, not a rebuild.

---

*Audit conducted by Claude Opus 4.6 | Principal Architect Role | KLYTICS LLC*
*Classification: Internal Build Ops*
