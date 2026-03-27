# CERNIQ — Master Playbook
## The In-House Super Quant

> **Version:** 3.0 — Full System Audit, March 2026
> **Classification:** Internal Operational Bible
> **Purpose:** Single source of truth for architecture, quantitative models, deployment, multi-terminal operation, hardening, and expansion roadmap.

---

## TABLE OF CONTENTS

1. [What CERNIQ Actually Is](#1-what-cerniq-actually-is)
2. [The Quant Edge — Why This Beats an Analyst](#2-the-quant-edge)
3. [True System Architecture (Code-Verified)](#3-true-system-architecture)
4. [Quantitative Model Inventory](#4-quantitative-model-inventory)
5. [API Surface — Complete Reference](#5-api-surface)
6. [Database Schema — Data Lineage](#6-database-schema)
7. [Multi-Terminal Enterprise Operation](#7-multi-terminal-enterprise-operation)
8. [Hardening Checklist — Security & Production](#8-hardening-checklist)
9. [Known Drift & Tech Debt](#9-known-drift--tech-debt)
10. [Expansion Roadmap — Quant Killer Features](#10-expansion-roadmap)
11. [Agent Prompting Guide — How to Work With AI Assistants](#11-agent-prompting-guide)

---

## 1. What CERNIQ Actually Is

CERNIQ is a **bilingual, institution-grade Asset-Liability Management (ALM) reporting platform** built for Puerto Rico cooperativas, credit unions, and community banks. It is not a quant terminal, not a hedge fund OS, not CapexCycleOS — those are dead prior identities.

**The wedge:** Upload a balance sheet CSV. Get a bilingual, board-ready, COSSEC-compliant risk report in minutes. Do in 10 minutes what cost $5K–$15K in consulting fees.

**The quant killer angle:** The same quantitative models used by multi-billion-dollar financial institutions (duration gap, Monte Carlo, EVE stress testing, LCR, Black-Scholes Greeks) are fully implemented in the backend — available to Erwin on-demand, infinitely scalable, never tired, never wrong on arithmetic.

### What CERNIQ Can Do Right Now

| Capability | Status | Location |
|---|---|---|
| Duration Gap Analysis (Macaulay/Modified) | ✅ Production | `backend-node/src/alm/alm.service.ts` |
| Net Interest Income (NII) Simulation | ✅ Production | `alm.service.ts` |
| Economic Value of Equity (EVE) | ✅ Production | `alm.service.ts` |
| Liquidity Coverage Ratio (LCR/NSFR) | ✅ Production | `alm.service.ts` |
| Monte Carlo Stress Testing (1,000 paths) | ✅ Production | `monte-carlo.service.ts` |
| Value at Risk (VaR) — Historical & Parametric | ✅ Production | `risk.service.ts` |
| CVaR / Expected Shortfall | ✅ Production | `risk.service.ts` |
| Black-Scholes Greeks (Delta/Gamma/Vega/Theta/Rho) | ✅ Production | `options.service.ts` |
| Implied Volatility (Newton-Raphson) | ✅ Production | `options.service.ts` |
| Execution Quality (Slippage/VWAP/MiFID II) | ✅ Production | `execution.service.ts` |
| Black-Litterman Portfolio Optimization | ✅ In codebase | `black-litterman.service.ts` |
| Hierarchical Risk Parity (HRP) | ✅ In codebase | ALM module |
| CECL Loan Loss (Credit Risk) | ✅ Production | `credit-risk-quant.service.ts` |
| Concentration Risk Analysis | ✅ Production | `concentration.service.ts` |
| Behavioral Duration (Deposit Betas) | ✅ Production | `behavioral-duration.service.ts` |
| Funds Transfer Pricing (FTP) | ✅ Production | `ftp-attribution.service.ts` |
| Bilingual PDF Report Generation | ✅ Production | `reports.service.ts` |
| Autonomous Outbound Sales Engine | ✅ Standalone | `services/outbound/` |
| Stripe Billing + Subscription Lifecycle | ✅ Production | `billing.service.ts` |
| Multi-Tenant RBAC | ✅ Production | `organizations/`, auth guards |
| Regulatory Scenario Library | ✅ Production | `stress-testing.service.ts` |
| COSSEC Compliance Outputs | ✅ Production | `reports.service.ts` |

---

## 2. The Quant Edge

### Why CERNIQ Is Your In-House Super Quant

A traditional quant analyst at a financial firm:
- Costs $150K–$400K/year
- Runs models in Excel or Python, manually
- Makes arithmetic mistakes
- Takes days to turnaround a report
- Doesn't speak Spanish
- Can't run 1,000 Monte Carlo simulations in 2 seconds

CERNIQ does all of this automatically, on-demand, in English and Spanish.

### The Models That Matter

**Duration Gap** is the single most important metric for a cooperativa's survival in a rising-rate environment. A positive duration gap means equity erodes when rates rise. CERNIQ calculates this in milliseconds from a CSV upload, then explains it in plain language on a board-ready PDF.

**Monte Carlo Stress Testing** runs 1,000 stochastic interest rate paths using Vasicek-style dynamics (mean-reverting). It computes VaR at 95% confidence, CVaR (the loss if VaR is breached), best-case, and worst-case NII outcomes. A typical quant shop charges $20K for this in a one-off engagement.

**Black-Scholes Greeks** with Newton-Raphson implied volatility is the same tooling used by options market makers on Wall Street. Available via API in CERNIQ with a single POST call.

**Black-Litterman** combines market equilibrium returns with analyst views to produce optimal portfolio weights. This is used by sovereign wealth funds and pension managers. CERNIQ has it built in.

### The Data Moat

CERNIQ holds two proprietary datasets:
1. **Q3 2025 COSSEC cooperativa benchmark data** — sector averages for capital ratios, LCR, NII, duration gaps across Puerto Rico cooperativas.
2. **109-institution Puerto Rico cooperativa seed dataset** — names, assets, contacts, for outbound engine targeting.

No quant terminal, Bloomberg, or analytics vendor has these pre-loaded.

---

## 3. True System Architecture (Code-Verified)

> This section reflects what actually runs in production — not legacy docs.

```
┌─────────────────────────────────────────────────────────────┐
│  USER                                                        │
│  Browser → cerniq.io (Vercel, Next.js 16, React 19)         │
└────────────────────────┬────────────────────────────────────┘
                         │ HTTPS / Next.js /api/* rewrite
                         ▼
┌─────────────────────────────────────────────────────────────┐
│  API SERVER                                                  │
│  api.cerniq.io (Railway, NestJS 11, TypeScript 5.9)         │
│  28 modules, port 3000                                       │
│                                                              │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────┐   │
│  │  ALM     │ │  Risk    │ │ Options  │ │  Billing     │   │
│  │ Engine   │ │ Engine   │ │ Greeks   │ │  (Stripe)    │   │
│  └──────────┘ └──────────┘ └──────────┘ └──────────────┘   │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────┐   │
│  │  Auth    │ │  Leads   │ │  Portal  │ │  Pipeline    │   │
│  │ (JWT/    │ │  CRM     │ │  Client  │ │  (PDF jobs)  │   │
│  │ Supabase)│ │          │ │          │ │              │   │
│  └──────────┘ └──────────┘ └──────────┘ └──────────────┘   │
└────────┬──────────────────────────┬────────────────────────┘
         │                          │
         ▼                          ▼
┌────────────────┐       ┌───────────────────┐
│  PostgreSQL 15 │       │  Redis 7          │
│  (Prisma ORM)  │       │  (Cache/Sessions) │
│  30+ models    │       │                   │
│  21 migrations │       │                   │
└────────────────┘       └───────────────────┘
         │
         ▼
┌────────────────────────────────────────────┐
│  External Services                          │
│  Stripe (billing)    Resend (email)         │
│  Cloudflare R2 (PDF storage)               │
│  Supabase (auth federation)                │
│  OpenAI / Anthropic (AI features)          │
│  Yahoo Finance (market data)               │
│  Alpha Vantage / CoinGecko                 │
└────────────────────────────────────────────┘

SEPARATE (not integrated into main stack):
┌────────────────────────────────────────────┐
│  Python Outbound Engine                    │
│  services/outbound/ (FastAPI)              │
│  6 autonomous sales agents                 │
│  109 PR cooperativa targets                │
└────────────────────────────────────────────┘
```

### Active Stack (Production Truth)

| Layer | Technology | Version | Host |
|---|---|---|---|
| Frontend | Next.js + React | 16 / 19 | Vercel |
| Backend API | NestJS + TypeScript | 11 / 5.9 | Railway |
| Database | PostgreSQL (Prisma ORM) | 15 / 7.6 | Railway/Supabase |
| Cache | Redis | 7-alpine | Railway |
| File Storage | Cloudflare R2 (S3-compatible) | — | Cloudflare |
| Auth Federation | Supabase JWT | — | Supabase |
| Billing | Stripe | — | Stripe |
| Email | Resend | — | Resend |
| Sales Engine | Python FastAPI | 3.x | Standalone/Docker |
| Package Manager (FE) | Bun | — | Local/CI |
| Package Manager (BE) | npm | — | Local/CI |

### Dead Code Paths (Do Not Reference)

| Path | Status | Reason |
|---|---|---|
| `backend/` | DEAD | Rust/Axum backend, abandoned. 20GB+ build artifacts. |
| `apps/api/` | DEAD | Bun scaffold, missing dependencies, never deployed. |
| `services/data-ingest/` | EMPTY | No files. Delete. |
| `services/risk-engine/` | EMPTY | No files. Delete. |
| NATS JetStream | NEVER EXISTED | Referenced in old docs only. |
| ArgoCD / K8s (active) | NEVER DEPLOYED | Manifests exist in `infra/k8s/` but no active cluster. |
| TimescaleDB hypertables | NOT USED | Image runs timescale but no hypertable queries. |
| Polygon.io | NOT INTEGRATED | Referenced in docs only. Uses yahoo-finance2. |
| Streamlit apps | NEVER BUILT | Referenced in `START_HERE.md`. No Streamlit in codebase. |

---

## 4. Quantitative Model Inventory

### 4.1 ALM Core Models

#### Duration Gap
```
Duration Gap = D_A − (L/A) × D_L

Where:
  D_A = Asset duration (Macaulay weighted average)
  D_L = Liability duration (Macaulay weighted average)
  L/A = Leverage ratio (total liabilities / total assets)

Modified Duration = Macaulay Duration / (1 + yield/compounding_frequency)

Interpretation:
  Gap > 0: Asset-sensitive. Rising rates HURT equity value.
  Gap < 0: Liability-sensitive. Rising rates HELP equity value.
  Gap ≈ 0: Immunized position. Rates have minimal equity impact.
```

#### Net Interest Income (NII) Simulation
```
Base NII = Σ(asset_i × rate_i) − Σ(liab_j × rate_j)

For each shock scenario s in {±300, ±200, ±100, ±50, 0, +50, +100, +200, +300 bps}:
  Shocked_NII_s = Σ(asset_i × (rate_i + β_i × shock_s))
                − Σ(liab_j × (rate_j + β_j × shock_s))

  Where β = repricing sensitivity (0 = fixed, 1 = fully floating)

NII_Change_pct = (Shocked_NII_s − Base_NII) / |Base_NII| × 100
```

#### Economic Value of Equity (EVE)
```
EVE = PV(Asset Cash Flows) − PV(Liability Cash Flows)

PV(CF) = Σ [ CF_t / (1 + r_t)^t ]   for all t in maturity buckets

Stressed EVE = Recalculate with shocked discount rates r_t + shock_s

EVE_Change = (Stressed_EVE − Base_EVE) / |Base_EVE| × 100
```

#### Liquidity Coverage Ratio (LCR)
```
LCR = HQLA / Total_Net_Cash_Outflows_30d

HQLA = Level_1_Assets × 1.0 + Level_2A × 0.85 + Level_2B × 0.75

Net Outflows = Outflows_30d − min(Inflows_30d, 75% × Outflows_30d)

Regulatory threshold: LCR ≥ 100%
COSSEC cooperativa threshold: Tracked and reported
```

#### Basis Point Value (BPV)
```
BPV = Modified_Duration × Portfolio_Value × 0.0001

Represents the dollar change in portfolio value per 1 basis point move.
```

### 4.2 Risk Engine Models

#### Monte Carlo Simulation (Vasicek Rate Paths)
```
Interest Rate Process (Vasicek):
  dr_t = κ(θ − r_t)dt + σ√dt × ε_t

Where:
  κ = mean reversion speed
  θ = long-run mean rate
  σ = rate volatility
  ε_t ~ N(0,1) via Box-Muller transform

Simulation: 1,000+ paths × T time steps
Output: Distribution of NII/EVE outcomes
```

#### Value at Risk (VaR)
```
Historical VaR:
  Sort return series → Take 5th percentile (95% confidence)
  VaR_95 = −percentile(returns, 5%)

Parametric VaR:
  VaR_95 = μ − 1.645 × σ

CVaR (Expected Shortfall):
  CVaR_95 = E[Loss | Loss > VaR_95]
           = mean of losses in worst 5% tail
```

#### Correlation Matrix
```
ρ_ij = Cov(r_i, r_j) / (σ_i × σ_j)

Computed for asset pairs in portfolio.
Used in portfolio optimization and stress testing.
```

### 4.3 Options & Derivatives Models

#### Black-Scholes Pricing
```
Call = S × N(d₁) − K × e^(−rT) × N(d₂)
Put  = K × e^(−rT) × N(−d₂) − S × N(−d₁)

d₁ = [ln(S/K) + (r + σ²/2)T] / (σ√T)
d₂ = d₁ − σ√T

Where:
  S = Spot price
  K = Strike price
  r = Risk-free rate
  T = Time to expiry (years)
  σ = Implied volatility
  N() = Cumulative normal distribution
```

#### Option Greeks
```
Delta:   ∂V/∂S    = N(d₁) for call, N(d₁)−1 for put
Gamma:   ∂²V/∂S²  = N'(d₁) / (S × σ × √T)
Vega:    ∂V/∂σ    = S × N'(d₁) × √T
Theta:   ∂V/∂t    = −[S×N'(d₁)×σ/(2√T)] − rKe^(−rT)×N(d₂) (for call)
Rho:     ∂V/∂r    = KTe^(−rT) × N(d₂) for call
```

#### Implied Volatility (Newton-Raphson)
```
Solve: BlackScholes(S, K, r, T, σ) = Market_Price

Iteration:
  σ_{n+1} = σ_n − [BS(σ_n) − Market_Price] / Vega(σ_n)

Converges in ~5 iterations to machine precision.
```

### 4.4 Portfolio Construction Models

#### Black-Litterman
```
Combined Return Vector:
  μ_BL = [(τΣ)^(−1) + P'Ω^(−1)P]^(−1) × [(τΣ)^(−1)π + P'Ω^(−1)Q]

Where:
  π = Market equilibrium returns (CAPM implied)
  Q = Vector of analyst views
  P = View matrix (which assets each view applies to)
  Ω = Uncertainty in views (diagonal covariance)
  τ = Confidence scaling factor
```

#### Hierarchical Risk Parity (HRP)
```
1. Compute correlation matrix
2. Build dendrogram via hierarchical clustering (Ward linkage)
3. Quasi-diagonalize correlation matrix (recursive bisection)
4. Allocate risk inversely to volatility across clusters

Result: Diversified weights that don't rely on inverting covariance matrix
        (more robust than mean-variance optimization)
```

### 4.5 Credit Risk Models

#### CECL Allowance (Simplified)
```
Expected Credit Loss = PD × LGD × EAD

Where:
  PD  = Probability of Default (cohort-level, vintage-based)
  LGD = Loss Given Default (collateral recovery)
  EAD = Exposure at Default (current balance)

Vintage analysis: Track each loan cohort's performance over time
CECL allowance = forward-looking lifetime expected loss
```

---

## 5. API Surface

### Base URLs
- **Production API:** `https://api.cerniq.io`
- **Local API (dev):** `http://localhost:3000`
- **Frontend rewrite:** All `/api/*` calls from cerniq.io proxy to api.cerniq.io

### Auth Headers
```
Authorization: Bearer <jwt_token>
# OR
Cookie: access_token=<jwt_token>
# OR (API key)
X-API-Key: cerniq_<prefix>_<secret>
# Admin endpoints
X-Admin-Key: <ADMIN_KEY_env_var>
```

### 5.1 Health & Status

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/health` | None | Service status + DB + memory |
| GET | `/health/detailed` | None (warn if exposed) | Latency breakdown |
| GET | `/ready` | None | Readiness probe |
| GET | `/api/status` | None | API version info |

### 5.2 Authentication

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/auth/register` | None | Email/password signup |
| POST | `/api/auth/login` | None | Email/password login |
| POST | `/api/auth/refresh` | Cookie | Refresh JWT token |
| POST | `/api/auth/logout` | JWT | Clear session |
| GET | `/api/auth/google` | None | OAuth2 redirect |
| GET | `/api/auth/google/callback` | None | OAuth2 callback |
| GET | `/api/auth/github` | None | OAuth2 redirect |
| GET | `/api/auth/github/callback` | None | OAuth2 callback |
| POST | `/api/auth/api-keys` | JWT | Create API key |
| GET | `/api/auth/api-keys` | JWT | List API keys |
| DELETE | `/api/auth/api-keys/:id` | JWT | Revoke API key |
| POST | `/api/auth/password-reset/request` | None | Send reset email |
| POST | `/api/auth/password-reset/confirm` | None | Confirm reset |

**Rate limits:** Auth endpoints 3–5 req/min. Password reset 3 req/hour.

### 5.3 ALM Engine

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/alm/institutions` | JWT | Create institution profile |
| GET | `/api/alm/institutions` | JWT | List institutions |
| GET | `/api/alm/institutions/:id` | JWT | Get institution detail |
| POST | `/api/alm/institutions/:id/balance-sheet` | JWT | Import balance sheet CSV |
| GET | `/api/alm/institutions/:id/balance-sheet` | JWT | Get balance sheet items |
| POST | `/api/alm/analysis/run` | JWT | Run full ALM analysis |
| GET | `/api/alm/analysis-runs/:runId` | JWT | Get analysis run result |
| GET | `/api/alm/institutions/:id/analysis-runs` | JWT | List runs for institution |
| POST | `/api/alm/duration-gap` | JWT | Calculate duration gap |
| POST | `/api/alm/nii-sensitivity` | JWT | Run NII scenario analysis |
| POST | `/api/alm/eve` | JWT | Calculate EVE |
| POST | `/api/alm/lcr` | JWT | Calculate LCR |
| POST | `/api/alm/stress-test` | JWT | Run Monte Carlo stress test |
| GET | `/api/alm/institutions/:id/report` | JWT | Download bilingual PDF |
| POST | `/api/alm/csv-preview` | JWT | Preview/validate CSV before import |

### 5.4 Risk Engine

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/risk/var` | JWT | Calculate VaR (historical/parametric) |
| POST | `/risk/component-var` | JWT | Component VaR per position |
| POST | `/risk/monte-carlo` | JWT | Run Monte Carlo portfolio simulation |
| POST | `/risk/stress-test` | JWT | Apply stress scenarios |
| POST | `/risk/correlation` | JWT | Compute correlation matrix |
| POST | `/risk/cvar` | JWT | Calculate CVaR / Expected Shortfall |

**Note:** Risk controller uses bare `/risk/...` prefix (not `/api/risk/...`). Verify proxy configuration ensures both paths work.

### 5.5 Options & Derivatives

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/options/greeks` | JWT | Calculate all Greeks (B-S) |
| POST | `/api/options/implied-vol` | JWT | Newton-Raphson IV solver |
| GET | `/api/options/chain/:ticker` | JWT | Fetch option chain |
| POST | `/api/options/strategy` | JWT | Multi-leg strategy P&L |
| POST | `/api/options/payoff` | JWT | Payoff diagram at expiry |

### 5.6 Market Data

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/market-data/quote/:ticker` | JWT | Real-time quote (Yahoo Finance) |
| GET | `/api/market-data/historical/:ticker` | JWT | Historical OHLCV data |
| GET | `/api/market-data/search?q=` | JWT | Ticker search |
| DELETE | `/api/market-data/clear-cache` | Admin | Clear market data cache (DoS-protected) |

### 5.7 Portfolio & Execution

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/portfolio` | JWT | List portfolios |
| POST | `/api/portfolio` | JWT | Create portfolio |
| POST | `/api/portfolio/:id/positions` | JWT | Add position |
| GET | `/api/portfolio/:id/analysis` | JWT | Portfolio analytics |
| POST | `/api/execution/slippage` | JWT | Slippage analysis |
| POST | `/api/execution/vwap` | JWT | VWAP comparison |
| GET | `/api/execution/best-execution-report` | JWT | MiFID II best execution |

### 5.8 Billing & Portal

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/billing/checkout` | JWT | Create Stripe checkout |
| POST | `/api/billing/webhook` | Stripe sig | Stripe webhook handler |
| GET | `/api/billing/subscription` | JWT | Get subscription status |
| POST | `/api/billing/subscription/cancel` | JWT | Cancel subscription |
| POST | `/api/billing/magic-link/request` | None | Request magic link |
| POST | `/api/billing/magic-link/verify` | None | Verify magic link |
| GET | `/api/portal/jobs` | JWT | List report jobs |
| GET | `/api/portal/jobs/:id` | JWT | Get report job detail |
| POST | `/api/portal/jobs/:id/upload` | JWT | Upload CSV to report job |

### 5.9 Admin (ADMIN_KEY Protected)

| Method | Path | Header | Description |
|---|---|---|---|
| GET | `/api/admin/stats` | X-Admin-Key | System statistics |
| GET | `/api/admin/leads` | X-Admin-Key | CRM lead pipeline |
| PATCH | `/api/admin/leads/:id` | X-Admin-Key | Update lead status |
| POST | `/api/admin/prospects/seed` | X-Admin-Key | Seed PR cooperativa prospects |
| GET | `/api/admin/prospects/:id/outreach` | X-Admin-Key | Generate outreach message |
| GET | `/api/admin/jobs` | X-Admin-Key | View report job queue |

### 5.10 Leads (Public, Rate-Limited)

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/leads/submit` | None (20/hr) | Public lead capture form |

---

## 6. Database Schema

### Core Tables

```sql
-- Users & Auth
users                    -- accounts (email, name, provider, role)
refresh_tokens           -- 7-day rotating JWT refresh
api_keys                 -- SHA-256 hashed, prefix-identifiable
password_reset_tokens    -- time-limited reset
magic_links             -- passwordless email login

-- Multi-Tenancy
organizations            -- company/team container
organization_members     -- user↔org junction (ADMIN/MEMBER/VIEWER)
workspaces              -- data isolation boundary per org

-- ALM Enterprise (Core Product)
institutions             -- financial institution profile
balance_sheet_items      -- assets & liabilities (rate, duration, repricing)
interest_rate_scenarios  -- stress test scenario results
liquidity_positions      -- HQLA tiers, cash flows, LCR/NSFR
analysis_runs            -- each ALM run (snapshot of inputs + outputs)
ingestion_logs           -- CSV upload audit trail (warnings, errors, schema)

-- Report Lifecycle
subscriptions            -- Stripe-linked (free/one_time/monthly/annual/partner)
report_jobs              -- 9-stage pipeline (AWAITING_DATA → COMPLETE)

-- Sales & CRM
leads                    -- full CRM pipeline (9 statuses, 3 priorities)
prospect_institutions    -- 12 cooperativa GTM targets
cooperativa_benchmarks   -- Q3 2025 COSSEC sector benchmark data
demo_requests            -- landing page form submissions

-- Market Data & Portfolio
tickers                  -- asset reference (stock/crypto/ETF/future)
market_prices            -- OHLCV data
portfolios               -- user portfolio containers
positions               -- individual holdings

-- Compliance & Audit
audit_logs              -- COSSEC-compliant event trail
board_reports           -- regulatory report artifacts
policy_breach_logs      -- IRR/concentration limit violations

-- Advanced ALM
loan_cohorts            -- credit risk cohort segmentation
deposit_tiers           -- behavioral deposit modeling
concentration_limits    -- single-name/sector/geo limits
cecl_vintage_allowances -- CECL loan loss estimates
irr_policy_limits       -- interest rate risk policy thresholds
yield_curves            -- interest rate term structure snapshots
saved_scenarios         -- ALM scenario parameter snapshots
```

### Report Job State Machine

```
AWAITING_DATA
    ↓ (CSV uploaded)
VALIDATING
    ↓ (validation passed)
PROCESSING
    ↓ (ALM analysis complete)
GENERATING_PDF
    ↓ (PDF created)
UPLOADING
    ↓ (PDF stored in R2)
NOTIFYING
    ↓ (email sent)
COMPLETE
    ↓ (any error)
FAILED
```

### Key Indexes (for query performance)

```sql
-- High-traffic lookups
INDEX institutions(workspace_id)
INDEX balance_sheet_items(institution_id, item_type)
INDEX analysis_runs(institution_id, created_at DESC)
INDEX leads(status, priority, created_at)
INDEX market_prices(ticker_id, timestamp DESC)
INDEX audit_logs(user_id, created_at DESC)
INDEX api_keys(key_prefix, expires_at)
```

---

## 7. Multi-Terminal Enterprise Operation

> For 5+ terminal setup: development, testing, monitoring, and production management.

### Terminal Layout Overview

```
┌──────────────────┬──────────────────┬──────────────────┐
│  TERMINAL 1      │  TERMINAL 2      │  TERMINAL 3      │
│  Backend NestJS  │  Frontend Next   │  DB + Redis      │
│  (API Server)    │  (UI Server)     │  (Data Layer)    │
├──────────────────┼──────────────────┼──────────────────┤
│  TERMINAL 4      │  TERMINAL 5      │  TERMINAL 6      │
│  Outbound Engine │  Health/Logs     │  DB Studio/Tests │
│  (Python FastAPI)│  (Monitoring)    │  (Dev Tools)     │
└──────────────────┴──────────────────┴──────────────────┘
```

---

### TERMINAL 1 — Backend API (NestJS)

**Purpose:** The core ALM and risk computation API server.

```bash
# Navigate to backend
cd /path/to/Cerniq/backend-node

# Install dependencies (first time)
npm ci --legacy-peer-deps

# Generate Prisma client (after schema changes)
npx prisma generate

# Run database migrations
npx prisma migrate deploy

# Start development server (hot reload)
npm run start:dev

# OR start production server
npm run build && npm run start:prod

# Health check (new terminal tab)
curl http://localhost:3000/health | python3 -m json.tool
```

**Expected output:**
```
[Nest] LOG [NestApplication] Nest application successfully started +Xms
[Nest] LOG [NestApplication] Listening on port 3000
```

**Key env vars required:**
```env
DATABASE_URL=postgresql://cerniq:password@localhost:5433/cerniq
JWT_SECRET=<32+ chars>
REDIS_URL=redis://localhost:6380
FRONTEND_URL=http://localhost:3001
ADMIN_KEY=<secure secret>
```

**Verify it's working:**
```bash
# Health
curl http://localhost:3000/health

# Protected endpoint test (should 401)
curl http://localhost:3000/api/alm/institutions

# Admin test
curl -H "x-admin-key: $ADMIN_KEY" http://localhost:3000/api/admin/stats
```

---

### TERMINAL 2 — Frontend (Next.js)

**Purpose:** The UI portal, demo flow, pricing, and ALM dashboard.

```bash
# Navigate to frontend
cd /path/to/Cerniq/frontend

# Install dependencies (first time, uses Bun or npm)
bun install   # preferred
# or: npm ci

# Set environment
cp .env.example .env.local
# Edit .env.local:
# NEXT_PUBLIC_NODE_API_URL=http://localhost:3000
# NEXT_PUBLIC_APP_URL=http://localhost:3001

# Start development server
npm run dev
# or: bun dev

# Expected: http://localhost:3001
```

**Verify it's working:**
```bash
curl -s http://localhost:3001 | grep -o '<title>[^<]*'
# Should return: <title>CERNIQ — ALM Reports...
```

**Key routes:**
| URL | Purpose |
|---|---|
| `http://localhost:3001` | Landing page |
| `http://localhost:3001/alm` | ALM dashboard (auth required) |
| `http://localhost:3001/demo` | Interactive demo |
| `http://localhost:3001/demo?type=cooperativa` | Auto-start cooperativa demo |
| `http://localhost:3001/admin` | Admin panel (ADMIN_KEY) |
| `http://localhost:3001/pricing` | Pricing page |
| `http://localhost:3001/portal` | Client portal |

---

### TERMINAL 3 — Data Layer (PostgreSQL + Redis)

**Purpose:** Database and cache services. Run these first before everything else.

```bash
# Navigate to project root
cd /path/to/Cerniq

# Start ONLY database + redis (not all services)
docker compose up -d postgres redis

# Monitor startup
docker compose logs -f postgres redis

# Verify PostgreSQL
docker exec -it cerniq-db psql -U cerniq -c "SELECT version();"

# Verify Redis
docker exec -it cerniq-redis redis-cli ping  # Should return PONG

# Run initial migrations (from backend-node)
cd backend-node && npx prisma migrate deploy && cd ..

# Seed demo data (optional)
cd backend-node && npx prisma db seed && cd ..
```

**Port reference:**
| Service | Internal Port | External Port | URL |
|---|---|---|---|
| PostgreSQL | 5432 | 5433 | `localhost:5433` |
| Redis | 6379 | 6380 | `localhost:6380` |

**Database quick checks:**
```bash
# Count institutions
docker exec cerniq-db psql -U cerniq -c "SELECT COUNT(*) FROM institutions;"

# Check report jobs
docker exec cerniq-db psql -U cerniq -c "SELECT status, COUNT(*) FROM report_jobs GROUP BY status;"

# Check leads pipeline
docker exec cerniq-db psql -U cerniq -c "SELECT status, COUNT(*) FROM leads GROUP BY status;"

# Redis cache status
docker exec cerniq-redis redis-cli info keyspace
```

**⚠ CRITICAL — Docker Compose DB Name Fix:**
Current `docker-compose.yml` creates database `capexcycle` but `.env.example` points to `cerniq`.
Until this is fixed, manually align:
```bash
# Option A: Change compose to match .env.example (preferred)
# Edit docker-compose.yml:
#   POSTGRES_DB: cerniq
#   POSTGRES_USER: cerniq

# Option B: Change .env DATABASE_URL to match compose
#   DATABASE_URL=postgresql://capexcycle:password@localhost:5433/capexcycle
```

---

### TERMINAL 4 — Outbound Sales Engine (Python)

**Purpose:** Autonomous outbound email pipeline for PR cooperativa prospecting.

```bash
# Navigate to outbound service
cd /path/to/Cerniq/services/outbound

# Create and activate virtual environment
python3 -m venv venv
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Configure environment
cp .env.example .env
# Set: OPENAI_API_KEY, SENDGRID_API_KEY or SMTP credentials

# Start FastAPI server
uvicorn app:app --host 0.0.0.0 --port 8002 --reload

# OR run one-off daily pipeline
python3 pipelines/daily_outreach_pipeline.py

# OR run lead ingestion
python3 pipelines/lead_ingestion_pipeline.py

# View API docs
open http://localhost:8002/docs
```

**Agent architecture:**
```
Lead Research Agent  → Identifies cooperativa targets from seed CSV
Enrichment Agent    → Adds contact info, firmographics
Messaging Agent     → Generates bilingual email (ES/EN via OpenAI)
Outreach Agent      → Dispatches via SMTP/SendGrid/SES
CRM Agent          → Logs outcomes to database
Followup Agent     → Schedules 3-day and 7-day follow-ups
```

**Daily automation schedule:**
```
09:00 AST — Lead ingestion + enrichment
10:00 AST — New prospect outreach
14:00 AST — 3-day follow-up wave
16:00 AST — 7-day final follow-up wave
```

---

### TERMINAL 5 — Monitoring & Health

**Purpose:** Real-time log watching, health monitoring, and production telemetry.

```bash
# ─── Local Development Monitoring ───

# Watch backend logs (real-time)
cd backend-node && npm run start:dev 2>&1 | tee /tmp/cerniq-backend.log

# Watch Docker logs (all services)
docker compose logs -f --tail=100

# Watch specific service logs
docker compose logs -f backend-node
docker compose logs -f postgres

# ─── Health Checks ───

# Quick health check
curl -s http://localhost:3000/health | python3 -m json.tool

# Full production health check
bash scripts/health-check.sh https://api.cerniq.io https://cerniq.io

# Local health check
bash scripts/health-check.sh http://localhost:3000 http://localhost:3001

# ─── Production Log Streaming (Railway) ───
railway logs --service backend-node --tail 200

# ─── Continuous monitoring loop ───
while true; do
  echo "=== $(date -u) ==="
  curl -s http://localhost:3000/health | python3 -c "
import sys, json
d=json.load(sys.stdin)
print(f\"Status: {d.get('status')} | DB: {d.get('db')} | Mem: {d.get('memoryPercent')}%\")
" 2>/dev/null || echo "Backend unreachable"
  sleep 30
done
```

**Key metrics to watch:**
| Metric | Warning Threshold | Critical Threshold |
|---|---|---|
| Memory usage | >70% | >85% |
| DB connection errors | Any | Any |
| Report job failures | >1/hour | >5/hour |
| API response time | >2s | >10s |
| Redis connectivity | Degraded | Down |

---

### TERMINAL 6 — Development Tools

**Purpose:** Database GUI, test runner, code quality.

```bash
# ─── Prisma Studio (visual DB browser) ───
cd backend-node && npx prisma studio
# Opens at http://localhost:5555

# ─── Run backend tests ───
cd backend-node && npm test
# or with coverage:
npm run test:cov

# ─── Run E2E tests (frontend) ───
cd frontend && npm run test:e2e
# Interactive mode:
npm run test:e2e:ui

# ─── Lint all code ───
cd backend-node && npm run lint
cd frontend && npm run lint

# ─── TypeScript type-check ───
cd backend-node && npm run typecheck
cd frontend && npx tsc --noEmit

# ─── Prisma operations ───
cd backend-node
npx prisma migrate dev --name "describe_change"  # new migration
npx prisma db pull                                # sync from live DB
npx prisma validate                               # validate schema
npx prisma format                                 # format schema.prisma
```

---

### TERMINAL 7 (Optional) — Quant Research Terminal

**Purpose:** Ad-hoc quantitative analysis, model testing, data exploration.

```bash
# ─── Test ALM calculations directly ───
# Quick NII sensitivity test
curl -s -X POST http://localhost:3000/api/alm/nii-sensitivity \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "assets": [
      {"balance": 50000000, "rate": 0.06, "repricing_sensitivity": 0.5, "duration_years": 3}
    ],
    "liabilities": [
      {"balance": 40000000, "rate": 0.02, "repricing_sensitivity": 0.8, "duration_years": 1}
    ],
    "scenarios": [-200, -100, 0, 100, 200, 300]
  }' | python3 -m json.tool

# ─── Test Black-Scholes Greeks ───
curl -s -X POST http://localhost:3000/api/options/greeks \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "underlying": 450.00,
    "strike": 460.00,
    "timeToExpiry": 0.0833,
    "riskFreeRate": 0.045,
    "volatility": 0.22,
    "optionType": "call"
  }' | python3 -m json.tool

# ─── Test VaR calculation ───
curl -s -X POST http://localhost:3000/risk/var \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "returns": [-0.02, 0.01, -0.015, 0.008, -0.03, 0.025, -0.01, 0.005],
    "confidence": 0.95,
    "method": "historical"
  }' | python3 -m json.tool

# ─── Demo cooperativa flow ───
# 1. Register test user
curl -s -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@cerniq.io","password":"TestPass123!","name":"Test User"}' \
  | python3 -m json.tool

# 2. Login and get token
TOKEN=$(curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@cerniq.io","password":"TestPass123!"}' \
  | python3 -c "import sys,json; print(json.load(sys.stdin).get('accessToken',''))")
echo "Token: ${TOKEN:0:50}..."

# 3. Create institution
curl -s -X POST http://localhost:3000/api/alm/institutions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"name":"CoopAhorro San Juan","type":"cooperativa","totalAssets":250000000}' \
  | python3 -m json.tool
```

---

### Production Deployment Commands

```bash
# ─── Deploy Backend to Railway ───
cd backend-node && railway up

# ─── Deploy Frontend to Vercel ───
cd frontend && vercel --prod

# ─── Full deploy (Makefile) ───
make deploy

# ─── Run migrations on production Railway DB ───
railway run --service backend-node npx prisma migrate deploy

# ─── Production health gate ───
bash scripts/health-check.sh https://api.cerniq.io https://cerniq.io
# Must show: PRODUCTION GATE: INFRASTRUCTURE OK

# ─── Full E2E production verification ───
# See: docs/ops/e2e_production_gate.md
```

---

## 8. Hardening Checklist

### 8.1 Immediate (Pre-Client) — Critical

- [ ] **Fix docker-compose.yml DB name mismatch** — Change `POSTGRES_DB: capexcycle` to `POSTGRES_DB: cerniq` and `POSTGRES_USER: capexcycle` to `cerniq`. Container names `capexcycle-*` → `cerniq-*`.
- [ ] **Fix docker-compose.yml Redis port** — `.env.example` says `REDIS_URL=redis://localhost:6379` but compose maps `6380:6379`. Either align `.env.example` to use 6380, or expose Redis on 6379.
- [ ] **Fix docker-compose.yml frontend API URL** — `NEXT_PUBLIC_API_URL: http://localhost:8001` points to dead Rust backend. Change to `http://localhost:3000`.
- [ ] **Fix docker-compose.yml Rust service** — Remove the `backend` (Rust) service from dev compose entirely.
- [ ] **Add missing vars to docker-compose.prod.yml** — `SUPABASE_*`, `STRIPE_*`, `ADMIN_KEY`, `RESEND_API_KEY`, `R2_*` are all missing and cause silent production failures.
- [ ] **Verify frontend/.env.local not committed** — Check git log for the file. If exposed, rotate the Vercel OIDC token and Stripe test key immediately.
- [ ] **Fix BACKEND_PORT in .env.example** — Change from `8001` (Rust-era) to `3000` (NestJS).
- [ ] **Audit dual token storage** — Frontend stores JWT in `sessionStorage` AND backend sets HttpOnly cookies. OAuth flow uses cookies; direct login uses sessionStorage. Reconcile to one path to avoid race conditions.

### 8.2 Security Hardening (Already Done in Wave 02)

- [x] CORS: explicit origins, no wildcard exposure
- [x] Rate limiting: global 100/min, auth 3–5/min, PW reset 3/hour
- [x] Admin endpoints: all protected with `x-admin-key` header
- [x] `$queryRawUnsafe` → `$queryRaw` tagged template
- [x] DTO validation: class-validator on risk, portfolio, valuation, ticker DTOs
- [x] Sensitive data removed from logs (password reset tokens)
- [x] 26 endpoints migrated from `x-user-id` header to `@UseGuards(AuthGuard)`
- [x] Hardcoded prospect emails moved to `PROSPECT_SEED_DATA` env var
- [x] Market data cache-clear endpoint secured (was DoS vector)
- [x] AES-256-GCM encryption for sensitive data at rest

### 8.3 Security Hardening (Still Needed)

- [ ] **Implement per-user rate limits** — Current limiting is global IP-based. A single authenticated user can still hammer the API.
- [ ] **Add HMAC request signing** for sensitive admin operations.
- [ ] **Set up secrets manager** — HashiCorp Vault, AWS Secrets Manager, or Railway's secret store for all env vars. Never in `.env` files in production.
- [ ] **Database encryption at rest** — Enable PostgreSQL `pgcrypto` for PII fields (user emails, institution names).
- [ ] **API key rotation policy** — Document and enforce 90-day rotation for all production API keys.
- [ ] **Certificate pinning** for external API calls (Stripe, Supabase, Resend).
- [ ] **WAF + DDoS protection** — CloudFlare WAF rules for all production domains.
- [ ] **Dependency vulnerability scanning** — Add Snyk or OWASP Dependency-Check to CI/CD pipeline.
- [ ] **Remove `/health/detailed` from public access in prod** — Set `HEALTH_DETAILS_PUBLIC=false` env var.

### 8.4 Operational Hardening

- [ ] **Archive stale root docs** — Move `ARCHITECTURE.md` (root), `ARCHITECTURE_PART2.md`, `PRODUCT_SPEC.md`, `PROJECT_SUMMARY.md`, `START_HERE.md`, `QUICKSTART.md` to `docs/archive/capexcycle-era/`. These contain false architecture claims.
- [ ] **Rewrite README.md** — Replace CapexCycleOS identity with CERNIQ ALM positioning. Use `docs/prompts/POSITIONING.md` as source.
- [ ] **Delete dead code paths** — `apps/api/`, empty `services/data-ingest/`, empty `services/risk-engine/`, optionally `backend/` (20GB Rust artifacts).
- [ ] **Update `docs/ARCHITECTURE.md`** — Remove Rust backend box, TimescaleDB claims, Polygon.io reference.
- [ ] **Fix auth unification doc** — `docs/platform/auth-unification/ENV_CONTRACT.md` says `KLYTICS_APP_ID=capexcycle`. Change to `cerniq`.
- [ ] **Set up automated backup verification** — Daily backup, weekly restore test.
- [ ] **Monitoring alerts** — PagerDuty or equivalent for backend down, DB connection errors, failed report jobs >3/hour.

### 8.5 API Contract Fixes

- [ ] **Standardize controller prefixes** — Risk controller at `/risk/...` should be `/api/risk/...` to match all other modules and avoid proxy ambiguity.
- [ ] **Update API_REFERENCE.md** — Add all ALM, auth, billing, leads, portal, pipeline endpoints (currently absent from docs).
- [ ] **Version the API** — Introduce `/api/v1/` prefix for all enterprise endpoints to enable non-breaking evolution.

### 8.6 Performance Hardening

- [ ] **Add Redis caching to ALM calculations** — Cache analysis runs by `{institutionId + balanceSheetHash}`. TTL 1 hour. Prevent redundant computation.
- [ ] **Add database query optimization** — Add missing indexes (see schema section above).
- [ ] **Implement job queue with explicit leasing** — Current report pipeline uses cron polling + Prisma state transitions. Replace with Bull/BullMQ for proper job leasing, retry, and dead-letter queue.
- [ ] **Add response compression** — Enable NestJS `compression()` middleware for API responses >1KB.

---

## 9. Known Drift & Tech Debt

### Critical Drifts

| Item | Expected | Actual | Fix |
|---|---|---|---|
| docker-compose.yml DB name | `cerniq` | `capexcycle` | Edit docker-compose.yml |
| docker-compose.yml Redis port | 6380 | 6380→6379 | Align .env.example to 6380 |
| docker-compose.yml frontend API URL | `localhost:3000` | `localhost:8001` | Edit docker-compose.yml |
| docker-compose.prod.yml env vars | Full set | Missing Supabase/Stripe/Admin | Edit docker-compose.prod.yml |
| README.md product identity | CERNIQ ALM | CapexCycleOS | Rewrite README |
| Risk controller URL prefix | `/api/risk/` | `/risk/` | Update controller decorator |
| AUTH_ALLOW_LEGACY env | `false` (prod) | Not set → undefined | Explicitly set in prod |
| KLYTICS_APP_ID env doc | `cerniq` | Doc says `capexcycle` | Fix ENV_CONTRACT.md |

### Known Limitations

| Limitation | Impact | Mitigation |
|---|---|---|
| Report pipeline uses cron polling, not true job queue | Risk of missed jobs on restart | Add BullMQ in next sprint |
| No model registry | Can't compare results across model versions | Add `model_version` field to analysis_runs |
| No scenario dataset library | Must re-enter scenarios each run | Add SavedScenario persistence (schema exists, need API) |
| ALM models in TypeScript, not Rust | Slower for 10K+ line items | Acceptable for cooperativa scale; revisit at $500K ARR |
| TimescaleDB image running but no hypertables used | TimescaleDB license cost with no benefit | Switch to `postgres:15` in docker-compose |
| Dual token storage (sessionStorage + HttpOnly cookie) | Potential auth race condition | Standardize to HttpOnly cookies only |
| SpendCheck + quant routes publicly accessible | Dilutes CERNIQ ALM focus | Gate behind feature flag or hide routes |

---

## 10. Expansion Roadmap — Quant Killer Features

### Phase 1 — Solidify ALM Core (Now → Q2 2026)
**Goal:** 3 paying cooperativa design partners

1. **Fix all critical drifts** from Section 9 hardening list
2. **Model registry** — Persist model version, parameters, and calibration metadata per analysis run
3. **Scenario library** — Named, reusable rate scenarios (NCUA Base, NCUA Shock, Custom)
4. **COSSEC parser** — Ingest public COSSEC PDFs and benchmark against sector averages automatically
5. **NCUA API integration** — Pull Call Report data for targeted institutions
6. **Report versioning** — Track v1/v2/v3 of reports for the same institution over time
7. **Automated email reports** — Monthly ALM report delivery via cron + Resend
8. **Richer audit trail** — Full lineage: CSV upload → analysis run → report artifact → user download

### Phase 2 — Enterprise ALM Platform (Q3 2026)
**Goal:** $50K ARR, enterprise contracts

1. **Multi-institution dashboard** — CPA firms manage 10+ cooperativa clients from one view
2. **Policy breach alerting** — Push notifications when IRR/concentration limits are breached
3. **Board report automation** — Generate COSSEC board packet format on schedule
4. **API access tier** — Enterprise customers call ALM API directly from their systems
5. **SSO (SAML/OIDC)** — Enterprise SSO for large credit unions
6. **White-label reports** — CPA firm branding on PDF reports
7. **Yield curve live feed** — Auto-refresh from FRED/Treasury API instead of manual input
8. **Historical analysis** — Time-series of institution ALM metrics across quarters

### Phase 3 — Super Quant Expansion (Q4 2026+)
**Goal:** Become the institutional analytics OS for PR financial sector

1. **PR sector intelligence** — Real-time cooperativa sector health dashboard (aggregate, anonymized)
2. **Predictive default early warning** — ML model on COSSEC data to flag at-risk institutions 12 months early
3. **Macro factor integration** — Fed FOMC decision simulation, Puerto Rico economic indicators
4. **Derivatives hedging recommendations** — "Your duration gap is +2.3 years. Consider selling $10M in interest rate swaps." With Black-Scholes pricing attached.
5. **Algorithmic deposit pricing** — ML-optimized deposit rate recommendations by tier
6. **Regulatory submission automation** — Generate DGEAC/COSSEC-ready filing packages directly from dashboard
7. **Rust compute migration** — Move Monte Carlo and Black-Scholes to WASM/Rust for 100x speed on large portfolios
8. **Mobile app** — CFO-facing mobile dashboard for real-time institution risk snapshot

---

## 11. Agent Prompting Guide

### How to Work With AI Assistants on CERNIQ

When using Claude or any AI agent to build, fix, or expand CERNIQ:

#### Context to Always Provide

```
CERNIQ is a bilingual ALM reporting platform for Puerto Rico cooperativas and credit unions.

Active stack: NestJS 11 (backend-node/), Next.js 16 (frontend/), PostgreSQL 15 (Prisma ORM), Redis 7.

Dead/ignore: backend/ (Rust), apps/api/ (Bun), services/data-ingest/, services/risk-engine/.

Key files:
- backend-node/src/alm/alm.service.ts — core ALM calculations
- backend-node/src/alm/alm-enterprise.service.ts — DB-persisted ALM operations
- backend-node/src/alm/reports/reports.service.ts — bilingual PDF generation
- backend-node/prisma/schema.prisma — canonical data model
- docs/CERNIQ_MASTER_PLAYBOOK.md — full architecture reference

Deployment: Railway (backend), Vercel (frontend). Port 3000 (backend), 3001 (frontend dev).
```

#### Effective Prompting Patterns

**For new features:**
```
"Add [feature] to CERNIQ. The backend is NestJS 11 at backend-node/.
Follow the existing pattern in backend-node/src/alm/[similar-module].
Add DTO validation with class-validator. Add the endpoint to the ALM controller.
Update schema.prisma if DB changes are needed and provide the migration."
```

**For debugging:**
```
"CERNIQ backend error: [paste error].
Stack: NestJS 11, Prisma 7, PostgreSQL 15.
Relevant file: backend-node/src/[module]/[file].ts
Current code: [paste relevant section]"
```

**For documentation:**
```
"Update docs/CERNIQ_MASTER_PLAYBOOK.md to reflect [change].
Source of truth is always the code, not old docs."
```

**For quantitative model changes:**
```
"Modify the [model name] calculation in backend-node/src/alm/alm.service.ts.
Current implementation: [describe]
Required change: [describe]
Provide unit test in backend-node/src/alm/alm.service.spec.ts"
```

#### Rules for AI Agents Working on CERNIQ

1. **Never reference the Rust backend** as if it's active. It is dead.
2. **Never reference CapexCycleOS**. That was a prior identity.
3. **Always validate DTOs** with class-validator decorators on every new endpoint.
4. **Always protect new admin endpoints** with `@UseGuards(AdminKeyGuard)`.
5. **Always update analysis_runs** when new ALM calculations are persisted.
6. **Never add Streamlit, NATS, ArgoCD** or other services not in the active stack.
7. **Bilingual by default** — all user-facing strings use `t()` translation hook. All PDF content in both EN and ES.
8. **Code is truth** — if docs say one thing and code says another, code wins.

---

## Appendix A — Environment Variable Master List

See `docs/ENVIRONMENT.md` and `.env.example` for full 172-variable reference.

**Minimum viable set to start locally:**

```env
# Database
DATABASE_URL=postgresql://cerniq:dev_password@localhost:5433/cerniq

# Auth
JWT_SECRET=your_32_char_minimum_secret_here_change_me
JWT_EXPIRATION=24h
JWT_REFRESH_EXPIRATION=7d

# Redis
REDIS_URL=redis://localhost:6380

# App
PORT=3000
FRONTEND_URL=http://localhost:3001
NODE_ENV=development
ADMIN_KEY=your_admin_key_here

# Email (development: use Resend test mode)
RESEND_API_KEY=re_test_...
ERWIN_EMAIL=eskiessalfonso@gmail.com

# Feature flags
ALLOW_DEMO_MOCKS=true
AUTH_ALLOW_LEGACY=true
HEALTH_DETAILS_PUBLIC=true
```

---

## Appendix B — Quick Command Reference

```bash
# ─── One-line startup (all services) ───
make dev

# ─── Health check ───
bash scripts/health-check.sh

# ─── Deploy to production ───
make deploy

# ─── Run all tests ───
make test && make test-e2e

# ─── Database studio ───
make db-studio

# ─── View logs ───
make logs

# ─── Run migrations ───
make migrate

# ─── Seed demo data ───
make db-seed

# ─── Full lint ───
make lint
```

---

*Last updated: March 27, 2026 — Full system audit by Claude (Cowork Mode)*
*Source of truth: Code in `backend-node/`, `frontend/`, `services/outbound/`*
*Supersedes: CERNIQ_ENTERPRISE_REPO_BASELINE.md, DRIFT_REPORT.md (partially)*
