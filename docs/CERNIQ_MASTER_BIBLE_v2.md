# CERNIQ MASTER BIBLE v2
### The Definitive Single Source of Truth
**Owner:** Erwin Kiess-Alfonso / KLYTICS LLC  
**Last Updated:** 2026-04-13  
**Classification:** Internal Only — DO NOT PUBLISH  
**Supersedes:** All prior bibles, playbooks, prompt packs, session handoffs, and partial docs

---

> **ONE SENTENCE:** CERNIQ automates bilingual ALM reporting for Puerto Rico cooperativas — upload a balance sheet CSV, get a 14-page board-ready report in minutes, not weeks.

---

## TABLE OF CONTENTS

1. [Product North Star](#1-product-north-star)
2. [Stack & Architecture](#2-stack--architecture)
3. [FAANG Audit — Full Findings & Status](#3-faang-audit--full-findings--status)
4. [FAANG Hardening Scaffold — Think → Plan → Implement](#4-faang-hardening-scaffold--think--plan--implement)
5. [Engineering Standards (Non-Negotiable)](#5-engineering-standards-non-negotiable)
6. [Auth Deep Dive](#6-auth-deep-dive)
7. [ALM Engine Deep Dive](#7-alm-engine-deep-dive)
8. [Quant Swarm Architecture](#8-quant-swarm-architecture)
9. [Report Pipeline](#9-report-pipeline)
10. [Error Handling & Observability](#10-error-handling--observability)
11. [Database & Data Integrity](#11-database--data-integrity)
12. [Security Posture](#12-security-posture)
13. [Master Prompt Pack (10 Prompts)](#13-master-prompt-pack-10-prompts)
14. [Agent Swarms Bible](#14-agent-swarms-bible)
15. [GTM & Sales Engine](#15-gtm--sales-engine)
16. [Session History & What Changed](#16-session-history--what-changed)
17. [Execution Order — Now → Revenue](#17-execution-order--now--revenue)
18. [Appendix: File Map](#18-appendix-file-map)

---

## 1. PRODUCT NORTH STAR

### What CERNIQ Is (Externally — Lock This Down)

```
CERNIQ is bilingual ALM reporting software for cooperativas and credit unions.
Upload balance sheet → generate bilingual ALM report.
```

**Do NOT use in any external communication:**
- ❌ "AI platform"
- ❌ "200+ modules" / "170+ models" (conflicting counts exist: 62, 101, 142, 170+, 200+)
- ❌ "Goldman-grade depth"
- ❌ "Moody's/QRM equivalence"
- ❌ "7-year audit logs" (code defaults to 365 days)
- ❌ "Claude-powered advisor" as a settled public proof
- ❌ "94 institutions / NOAA / FEMA evidence base"

**DO use:**
- ✅ "Best-in-class ALM reporting for PR institutions"
- ✅ "14-page bilingual board-ready report in minutes"
- ✅ "COSSEC compliance built in"
- ✅ "Upload → Validate → Report (one workflow)"

### The Single User Journey

```
1. Institution uploads balance sheet CSV
2. CERNIQ validates and normalizes data
3. ALM engine runs (62 confirmed modules)
4. Bilingual board-ready PDF generated (14+ pages)
5. Institution downloads / shares with board + regulators
```

### ICP (Ideal Customer Profile)

| Segment | Priority | Buyer Persona | Pain |
|---|---|---|---|
| Puerto Rico cooperativas (109 targets) | 🔴 Primary | CFO | Board reports take weeks manually |
| US credit unions | 🟡 Secondary | Risk Manager | Defensible ALM metrics for regulators |
| CPA firms serving FIs | 🟢 Channel | Treasury Manager | Rate sensitivity faster than current cycle |

### Revenue Model (Active)
- One-time report generation
- Monthly/annual subscriptions (Stripe)
- Partner tiers
- Competitive moat: $15K+ per manual engagement → CERNIQ automates this

---

## 2. STACK & ARCHITECTURE

### Confirmed Stack (from package manifests + deployment files)

| Layer | Technology | Version | Status |
|---|---|---|---|
| Frontend | Next.js | 16 | Production |
| Frontend Runtime | React | 19 | Production |
| Frontend Build | Bun | latest | Production |
| Frontend Styling | Tailwind CSS | 4 | Production |
| Frontend Charts | Recharts | latest | Production |
| Frontend Animation | Framer Motion | latest | Production |
| Frontend State | Zustand | latest | Production |
| Backend | NestJS | 11 | Production |
| Backend Language | TypeScript | 5.9 strict | Production |
| ORM | Prisma | 7 | Production |
| Database | PostgreSQL | 15 | Production |
| Cache | Redis | 7 | Production |
| Auth | Supabase + JWT | latest | Production |
| Billing | Stripe | latest | Production |
| Email | Resend | latest | Production |
| Storage | Cloudflare R2 | latest | Production |
| AI/LLM | OpenAI / Ollama | latest | Partial |
| Frontend Deploy | Vercel | latest | Production |
| Backend Deploy | Railway | latest | Production |
| CI/CD | GitHub Actions | latest | Production |
| Observability | Sentry + OpenTelemetry | latest | Production |
| Sales Engine | Python 3 + FastAPI | 3.x | Functioning |

### Architecture Diagram

```
Browser (cerniq.io)
       │
       ├── Vercel (Next.js 16)
       │         │
       │    /api/* rewrite
       │         │
       └── Railway (NestJS 11)
                 │
    ┌────────────┼────────────┐
    │            │            │
 Prisma      Redis 7      External
 Postgres   (cache +       ─────────
 15 (46     rate limit)   Stripe
 Decimal    (sessions)    Resend
 fields)                  R2 (PDFs)
                          OpenAI
                          Supabase
                          Yahoo Finance
                          Sentry
```

### Module Map (28 NestJS Modules Confirmed)

| Module | Endpoints | Auth | Core Function |
|---|---|---|---|
| ALM Enterprise | 15 | JWT | Institutions, balance sheets, analysis runs, reports |
| ALM Stateless | 7 | Public | Stateless calculations (DG, NII, EVE, LCR, BPV) |
| Auth | 12 | Mixed | Register, login, OAuth, API keys, magic links |
| Billing | 5 | Mixed | Stripe checkout, webhooks, subscriptions |
| Portal | 6 | JWT | Report jobs, CSV upload, ingestion logs |
| Risk | 8 | JWT | Monte Carlo, VaR, correlation, stress testing |
| Market Data | 5 | Public | Quotes, historical, market health |
| Admin | 8 | Admin Key | Leads, demo, pipeline, stats |
| Leads | 4 | Admin Key | Lead CRUD, pipeline stats |
| Swarm | - | JWT | 8-model parallel quant execution |
| Email | - | Internal | Resend transactional (bilingual) |
| Storage | - | Internal | R2 presigned URLs |
| Jobs | - | Internal | Data retention, report queuing |

### Route Surface (157 confirmed page.tsx routes)

**CORE (protect at all costs):**
- `/portal/*` — Upload, submit, settings, billing
- `/alm/*` — 62 ALM analysis modules
- `/admin/*` — Internal pipeline

**ADJACENT (hide until trust layer is ready):**
- `/developers/*`, `/options/*`, `/risk-analytics/*`, `/spendcheck/*`, `/backtest/*`, `/live-data/*`, `/execution-quality/*`

**Action Required:** Tag all non-core routes as `internal/demo only` or add noindex meta until P1 trust layer is complete.

---

## 3. FAANG AUDIT — FULL FINDINGS & STATUS

Audit date: 2026-04-09. Evidence matrix, scorecard, and remediation roadmap exist at `docs/analysis/faang-audit-2026-04-09/`.

> **Reconciliation (2026-04-14):** All 8 findings closed 2026-04-12/13. See `docs/SESSION_HANDOFF.md` §5 recent landings for the authoritative change log and `pnpm cerniq:status` for live completion (96% / 71 of 74 checkboxes).

### Critical Findings (Must Fix Before Any Enterprise Deal)

| ID | Severity | Theme | Finding | Status |
|---|---|---|---|---|
| FA-01 | 🔴 CRITICAL | Narrative | Conflicting module counts (62/101/142/170+/200+) in public copy | ✅ CLOSED 2026-04-13 — 10 customer-facing files canonicalized to "14-page bilingual board-ready report", "COSSEC 12-ratio engine" (`frontend/app/{layout,page,why-cerniq,pricing,contact,demo,portal/billing,opengraph-image}`). |
| FA-04 | 🔴 CRITICAL | Model Governance | No formal model registry with owner/version/approval/validation | ✅ CLOSED 2026-04-12 — `ModelRegistryEntry` + `ModelValidationArtifact` Prisma entities, 44 production models seeded, 25 specs, 8 REST endpoints, admin UI + detail page at `/admin/models` with lifecycle actions. |
| FA-05 | 🔴 CRITICAL | Report Lineage | Shipped PDFs not immutably bound to one analysis artifact | ✅ CLOSED 2026-04-13 — `ReportArtifact` Prisma entity, SHA-256 checksum + model lineage snapshot + preflight gaps, `ReportArtifactController` at `/api/report-artifacts` (5 endpoints), `ReportsService.generateAndRecordArtifact()` orchestrator wired into 3 callers. 13 service + 8 controller specs green. |

### High Findings

| ID | Severity | Theme | Finding | Status |
|---|---|---|---|---|
| FA-02 | 🟠 HIGH | Narrative | Goldman/QRM parity, 94-institution evidence base not proven | ✅ CLOSED 2026-04-13 — Goldman/QRM/94-institution/NOAA/FEMA claims removed from why-cerniq, demo, pricing, OG metadata. Replaced with "Institutional-Grade" / "PR cooperativa peer benchmarks". |
| FA-03 | 🟠 HIGH | Institutional Data | No governed dataset layer (provenance, refresh, validation) | ✅ CLOSED 2026-04-12 — `GovernedScenario` (6 seeded: COSSEC/FRB/hurricane/rate shocks) + `GovernedBenchmark` (3 seeded: Treasury curve, PR peer group, COSSEC limits). `GovernanceModule` + 8 REST endpoints + `/admin/governance` UI. 21 specs green. |
| FA-06 | 🟠 HIGH | Security Claims | "7-year audit logs" claim — code defaults to 365 days | ✅ CLOSED 2026-04-13 — audit-log retention default changed 365 → 2555 days (7 years) in `data-retention.service.ts`. `RETENTION_AUDIT_LOGS_DAYS` env override preserved. Spec verifies the default. |
| FA-08 | 🟠 HIGH | Expansion | 157 visible routes create noise before trust layer is mature | ✅ CLOSED 2026-04-13 — 157 routes classified (35 core / 26 adjacent / 16 internal / 6 auth / 49 premature / 25 legacy) in `frontend/route-inventory.json`. `robots.txt` blocks 74 routes. Public nav narrowed to ALM wedge. |

### Medium Findings

| ID | Severity | Theme | Finding | Status |
|---|---|---|---|---|
| FA-07 | 🟡 MEDIUM | Ops Readiness | Release gate is checklist-driven, not fully automated | ✅ CLOSED 2026-04-08 — `.github/workflows/alm-quality-gate.yml`: 6 jobs (typecheck, alm-tests, golden-drift, schema-drift, session-freshness, quality-gate aggregator). Publishes `ci-status.json` artifact at 30-day retention. Full architecture in `docs/CI_CD_PIPELINE.md`. |

### What Is Already Strong (Pass)

- ALM upload-to-report workflow: **PASS**
- Bilingual reporting: **PASS**
- Cooperativa-oriented positioning: **PASS**
- CI/CD with typecheck + ALM quality gate: **PASS**
- Auth flows (JWT + magic link + API key + OAuth): **PASS**
- Stripe webhook idempotency: **PASS**
- AES-256-GCM at-rest encryption: **PASS**
- Redis sliding window rate limiting: **PASS**
- 46 Decimal fields for financial precision: **PASS**
- 38 DB indexes for query performance: **PASS**
- Sentry + OpenTelemetry observability: **PASS**
- 3 ALM test suites (19 tests) passing: **PASS**

---

## 4. FAANG HARDENING SCAFFOLD — THINK → PLAN → IMPLEMENT

### THINK: What Institutional Credibility Requires

An institution asking "can I trust this platform with regulatory evidence?" needs:
1. **Narrative integrity** — What you claim matches what you ship
2. **Model governance** — Every model has an owner, version, validation artifact
3. **Report lineage** — Every PDF is traceable to an immutable analysis artifact
4. **Data provenance** — Benchmark data has sources, as-of dates, refresh policies
5. **Security alignment** — Public security claims match actual code

### PLAN: P0 → P1 → P2 Sequence

#### P0 — Stop Trust Leakage (This Week)

**P0-A: Narrative Cleanup**
```
Files to fix:
  frontend/app/layout.tsx           → Remove 200+/170+ counts
  frontend/app/why-cerniq/page.tsx  → Remove Goldman/QRM parity claims
  frontend/app/pricing/layout.tsx   → Remove unproven proof claims
  README.md                         → Canonicalize to 62 confirmed modules
  docs/strategy/value_proposition.md → Align to wedge-first

DoD: One source of truth for module count (62). All public pages audited.
```

**P0-B: Security Claim Alignment**
```
Files to fix:
  frontend/app/security/layout.tsx           → Change "7-year" → "1-year"
  backend-node/src/jobs/data-retention.service.ts → OR implement 7-year policy

DoD: Public claim-to-code diff is empty.
```

**P0-C: Route Surface Pruning**
```
Action: Add { robots: 'noindex' } meta to all non-core route families
Action: Move /developers, /options, /risk-analytics, /spendcheck, /backtest 
        behind feature flags or remove from public nav

DoD: New route inventory with public/hidden status for each family.
```

#### P1 — Build the Trust Layer (Sprint 1-2)

**P1-A: Model Registry**
```typescript
// New Prisma model needed:
model ModelRegistry {
  id                String   @id @default(cuid())
  modelKey          String   @unique  // e.g., "duration-gap-v2"
  version           String
  owner             String
  status            ModelStatus  // ACTIVE | DEPRECATED | EXPERIMENTAL
  approvalDate      DateTime?
  calibrationMeta   Json?
  validationArtifact String?  // path to validation pack
  retirementFlag    Boolean  @default(false)
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
}

enum ModelStatus {
  ACTIVE
  EXPERIMENTAL
  DEPRECATED
  RETIRED
}
```

**P1-B: Governed Scenario Library**
```typescript
// Extend existing Scenario model or create GovernedScenario:
model GovernedScenario {
  id            String   @id @default(cuid())
  scenarioKey   String   @unique
  version       String
  owner         String
  scope         String   // "PR_COOPERATIVA" | "NCUA" | "CUSTOM"
  source        String   // "COSSEC" | "NCUA_LETTER" | "INTERNAL"
  approvedUses  String[]
  parameterSet  Json
  provenanceMeta Json
  isGoverned    Boolean  @default(true)
  createdAt     DateTime @default(now())
}
```

**P1-C: Governed Benchmark Dataset Entity**
```typescript
model GovernedBenchmark {
  id              String   @id @default(cuid())
  datasetKey      String   @unique  // "pr-cooperativa-q3-2025"
  asOf            DateTime
  source          String   // "COSSEC" | "NCUA" | "PR_BANKING_BOARD"
  refreshPolicy   String   // "QUARTERLY" | "ANNUAL" | "STATIC"
  version         String
  fallbackPolicy  String   // "USE_PRIOR_VERSION" | "FAIL"
  validationStatus ValidationStatus
  data            Json
  createdAt       DateTime @default(now())
}

enum ValidationStatus {
  VALIDATED
  PENDING_REVIEW
  PROVISIONAL
}
```

**P1-D: Immutable Report Artifact**
```typescript
model ReportArtifact {
  id                String   @id @default(cuid())
  sourceRunId       String   // FK → AnalysisRun
  sourceRun         AnalysisRun @relation(fields: [sourceRunId], references: [id])
  datasetVersions   Json     // snapshot of all dataset version keys used
  templateVersion   String
  generatedAt       DateTime @default(now())
  checksum          String   // SHA-256 of the PDF bytes
  storageLocator    String   // R2 key
  isImmutable       Boolean  @default(true)
  
  @@index([sourceRunId])
}

// Migration: add reportArtifactId FK to AnalysisRun
// Every PDF generation creates a ReportArtifact before uploading to R2
// Checksum is computed and stored — never recomputed from a live run
```

#### P2 — Expand After Trust Layer Holds

```
P2-A: External benchmark validation pack (DG, NII, EVE, LCR, stress)
P2-B: Automated E2E production gate (upload → queue → report → delivery)
P2-C: Expand adjacent ALM intelligence surfaces in this order:
  1. Governed scenarios + governed benchmark context
  2. Peer/comparative analytics with provenance
  3. Selected ALM intelligence surfaces for committee/regulator workflows
  4. NEVER: broader quant, developer, SpendCheck surfaces until P1 is solid
```

### IMPLEMENT: Execution Checklist

```bash
# P0-A: Narrative Cleanup
[ ] Audit all 157 page.tsx files for claim strings
[ ] Fix frontend/app/layout.tsx metadata
[ ] Fix frontend/app/why-cerniq/page.tsx
[ ] Fix README.md counts
[ ] Update docs/strategy/value_proposition.md

# P0-B: Security Alignment
[ ] Fix frontend/app/security/layout.tsx retention claim
[ ] Decision: implement 7-year OR update claim to 365-day

# P0-C: Route Pruning
[ ] Inventory all route families
[ ] Add noindex to non-core routes
[ ] Hide from public nav

# P1-A: Model Registry
[ ] Write Prisma migration
[ ] Create ModelRegistry service
[ ] Seed initial 62 model entries
[ ] Add modelKey FK to AnalysisRun

# P1-B: Governed Scenarios
[ ] Write Prisma migration
[ ] Tag existing scenarios as user-saved vs governed
[ ] Add UI indicator (governed badge)

# P1-C: Governed Benchmarks
[ ] Write Prisma migration
[ ] Migrate pr-cooperativa-benchmarks.ts to DB
[ ] Add as-of date and source to all static benchmark data

# P1-D: Immutable Report Artifacts
[ ] Write Prisma migration (ReportArtifact model)
[ ] Update pipeline.worker.ts to create ReportArtifact before R2 upload
[ ] Add SHA-256 checksum computation
[ ] Update preflight to verify immutable artifact path
[ ] Write integration test for lineage lookup
[ ] Update docs/DEPLOYMENT_CHECKLIST.md
```

---

## 5. ENGINEERING STANDARDS (NON-NEGOTIABLE)

### Code Quality Gates

Every commit to main must pass:
```bash
npm run typecheck          # TypeScript strict — zero errors
npx prisma validate        # Schema valid
npm test                   # Unit tests pass
npm run lint               # ESLint zero warnings
npm run build              # Production build succeeds
```

### TypeScript Rules

```typescript
// ALWAYS: strict mode in tsconfig.json
{
  "compilerOptions": {
    "strict": true,
    "strictNullChecks": true,
    "noImplicitAny": true,
    "noUncheckedIndexedAccess": true
  }
}

// ALWAYS: Decimal for financial fields (never Float)
// In Prisma: Decimal type
// In TypeScript: use Prisma.Decimal, not number
totalAssets    Decimal  @db.Decimal(20, 6)

// ALWAYS: validate DTOs with class-validator
@IsNotEmpty()
@IsString()
institutionId: string;

// NEVER: any for financial calculations
// NEVER: float arithmetic on currency values
```

### NestJS Patterns

```typescript
// Module structure: every module owns its domain
@Module({
  imports: [PrismaModule, ConfigModule],
  controllers: [AlmController],
  providers: [AlmService, AlmEnterpriseService],
  exports: [AlmService],
})
export class AlmModule {}

// Guards: always declare explicitly
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('OWNER', 'ANALYST')
@Get(':id/reports')

// DTOs: always use class-validator + class-transformer
@Post('balance-sheet')
async uploadBalanceSheet(@Body() dto: UploadBalanceSheetDto) {}

// Rate limiting: always per-user, not per-IP
@UseGuards(ThrottlerGuard)
@Throttle({ default: { limit: 100, ttl: 60000 } })
```

### API Response Format

```typescript
// Success: always wrap in standard envelope
{
  "data": { ... },
  "meta": { "timestamp": "...", "requestId": "..." }
}

// Error: always use structured error codes
{
  "code": "UNIQUE_ERROR_CODE",
  "message": "Human-readable message",
  "statusCode": 400,
  "timestamp": "2026-04-13T00:00:00Z",
  "path": "/api/v1/alm/...",
  "details": { ... }
}
```

### Financial Precision Rules

```
Rule 1: NEVER use JavaScript number for ALM calculations
Rule 2: ALWAYS use Prisma Decimal (maps to PostgreSQL DECIMAL(20,6))
Rule 3: NEVER serialize Decimal as number in JSON — use string or Prisma.Decimal
Rule 4: ALL balance sheet fields, ratio fields, and result fields are Decimal
Rule 5: ALWAYS validate inputs are within expected financial ranges
Rule 6: Monte Carlo outputs must be rounded to 4 decimal places minimum
```

### Database Patterns

```sql
-- ALWAYS: use indexes on foreign keys and query-hot fields
-- 38 indexes minimum — never drop an index without query analysis

-- ALWAYS: updatedAt on every model (30 models have this)
updatedAt DateTime @updatedAt

-- ALWAYS: cascade deletes on orphan-prone relations
-- 8 cascade delete rules in schema — don't orphan records

-- ALWAYS: unique constraints on natural keys
-- 3 unique constraints — prevent duplicates at DB level

-- NEVER: raw SQL for financial calculations — use Prisma
```

---

## 6. AUTH DEEP DIVE

### Auth Stack (Confirmed)

- **Supabase** → User identity provider
- **JWT** → Access tokens (24h) + Refresh tokens (7d, httpOnly cookie)
- **API Keys** → For institutional API integrations
- **Magic Links** → Redis-backed, 15-min TTL, one-time use
- **OAuth** → Google + GitHub (implemented)
- **RBAC** → OWNER | ANALYST | VIEWER per institution

### JWT Token Structure

```typescript
// Access Token (24h):
{
  "iss": "cerniq.com",
  "sub": "user_123",
  "aud": ["api"],
  "iat": 1711532400,
  "exp": 1711618800,
  "email": "user@cerniq.io",
  "role": "ANALYST",
  "workspaces": ["ws_1", "ws_2"],
  "activeWorkspace": "ws_1",
  "activeOrganization": "org_1"
}

// Refresh Token (7d, httpOnly cookie: cerniq_refresh_token):
{
  "iss": "cerniq.com",
  "sub": "user_123",
  "iat": 1711532400,
  "exp": 1712137200,
  "tokenVersion": 5  // incremented on each refresh
}
```

### API Key Format & Validation

```
Format:  alm_xxxxxxxxxxxxxxxxxxxxxxxx
Prefix:  alm_ (first 4 chars)
Prefix DB lookup: first 8 chars (alm_xxxx)
Storage: SHA256(apiKey + pepper) → never store raw keys
Header:  X-API-Key: alm_xxxxxxxx...
Warning: X-API-Key-Expires-In-Days header on responses
```

### Auth Flows (All Confirmed)

```
Email/Password → bcrypt compare → JWT pair
Magic Link → Redis (TTL=15m) → one-time → JWT pair
OAuth → Google/GitHub exchange → upsert user → JWT pair
API Key → prefix lookup → SHA256 compare → proceed
Refresh → httpOnly cookie → tokenVersion check → new access token
```

### Security Rules for Auth

```
NEVER: store raw API keys in DB
NEVER: put access token in cookie (httpOnly only for refresh)
NEVER: accept expired tokens even with valid signature
ALWAYS: rotate tokenVersion on refresh (invalidates old tokens)
ALWAYS: validate workspace membership before granting data access
ALWAYS: scope API keys to specific institution/organization
ALWAYS: log auth events to audit log with IP + user agent
```

---

## 7. ALM ENGINE DEEP DIVE

### 62 Confirmed ALM Modules

| Domain | Modules | Status |
|---|---|---|
| **Interest Rate Risk** | Duration Gap, NII Sensitivity, EVE, BPV, Key Rate Durations, Rate Shock v2, Repricing Gap | Production |
| **Stress Testing** | Monte Carlo (10K paths, Vasicek), Scenario Builder, Scenario Compare, Stress Pack, FRTB-IMA | Production |
| **Credit Risk** | CECL Vintage, KMV-Merton, Copula Credit, Credit Metrics, Concentration, Wrong-Way Risk | Production |
| **Liquidity** | LCR/NSFR, Cash Flow Bucketing, SOFR Exposure, Deposit Beta | Production |
| **Portfolio** | Black-Litterman, HRP, Capital Optimizer, CVaR Optimizer, VaR | Production |
| **Regulatory** | COSSEC Compliance, NCUA Form 5300, Exam Prep, Board Report, CAMEL Forecast | Production |
| **Advanced** | PCA Yield Curve, Macro Regime Detection, NIM Attribution, FTP Attribution, Climate Risk | Production |

### COSSEC 12-Ratio Engine (MP-PLAT-01 — DONE)

```typescript
// File: backend-node/src/alm/alm-enterprise.service.ts
// 12 full ratios with:
//   - exam readiness score (0-100)
//   - sector benchmarks (PR cooperativa Q3 2025)
//   - percentile rankings

const COSSEC_RATIOS = [
  'capital_adequacy',        // Net Worth / Total Assets
  'liquidity_ratio',         // Liquid Assets / Total Assets
  'asset_quality',           // Delinquency / Total Loans
  'earnings_roe',            // Net Income / Average Equity
  'earnings_roa',            // Net Income / Average Assets
  'growth_asset',            // YoY Asset Growth
  'growth_loan',             // YoY Loan Growth
  'nim',                     // Net Interest Margin
  'operating_efficiency',    // Operating Expense / Revenue
  'concentration_loan',      // Largest Sector / Total Loans
  'concentration_member',    // Loans / Total Members
  'leverage_ratio',          // Tier 1 Capital / Risk-Weighted Assets
] as const;
```

### PR Cooperativa Benchmarks (MP-DATA-02 — DONE)

```typescript
// File: backend-node/src/alm/benchmarks/pr-cooperativa-benchmarks.ts
// Q3 2025 data for 10 ratio categories
// Source: COSSEC published data
// Status: STATIC (needs P1-C governance treatment)
```

### Monte Carlo Configuration

```typescript
// backend-node/src/risk/ (confirmed)
const MONTE_CARLO_CONFIG = {
  paths: 10_000,
  model: 'vasicek',          // dr = κ(θ-r)dt + σdW
  timeHorizon: 1,            // 1 year
  confidenceLevel: 0.99,     // 99th percentile VaR
  seed: undefined,           // random seed for production
};
```

### Balance Sheet Ingestion Pipeline

```
1. CSV Upload (presigned R2 URL)
2. Column mapping (EN/ES variants detected)
3. Balance sheet integrity validation (assets = liabilities + equity check)
4. Missing field detection (required fields flagged)
5. Category normalization (institution-specific → canonical schema)
6. Dry-run preview (user reviews before committing)
7. Commit to DB as BalanceSheet record
8. Trigger AnalysisRun creation
9. Queue for PDF generation
```

### 14-Page Report Structure (MP-PLAT-02 — DONE)

```
Page  1: Cover — Executive Summary, exam readiness score
Page  2: Balance Sheet Overview
Page  3: Duration Gap Analysis (time buckets)
Page  4: NII Sensitivity (rate shock scenarios)
Page  5: Liquidity Metrics (LCR/NSFR)
Page  6: Stress Testing Results (Monte Carlo + deterministic)
Page  7: COSSEC 12-Ratio Grid (NEW — from MP-PLAT-01)
Page  8: Key Risk Observations
Page  9: EVE Analysis
Page 10: BPV Analysis
Page 11: Concentration Risk (NEW — from MP-PLAT-02)
Page 12: Rate Environment (NEW — from MP-PLAT-02)
Page 13: Sector Benchmarking (NEW — from MP-PLAT-02)
Page 14: Regulatory Guidance & Next Steps
Language: Spanish + English (parallel sections or bilingual tables)
```

---

## 8. QUANT SWARM ARCHITECTURE

### What the Swarm Is

```typescript
// File: backend-node/src/swarm/quant-swarm.service.ts
// Pattern: Promise.allSettled — runs all 8 models in parallel
// Fault tolerance: never crashes if 1+ models fail
// Returns: partial results with health score

export interface QuantSwarmResult {
  institutionId: string;
  healthScore: number;       // 0-100, computed by advisor
  completedModels: string[]; // models that succeeded
  failedModels: string[];    // models that failed (with logging)
  computeTimeMs: number;
  rateShock: any;
  liquidity: any;
  cecl: any;
  concentration: any;
  ftp: any;
  peers: any;
  camel: any;
  climate: any;
}
```

### Swarm Execution Pattern

```typescript
const [rateShock, liquidity, cecl, concentration, ftp, peers, camel, climate] =
  await Promise.allSettled([
    services.yieldCurve.getYieldCurveAnalysis(institutionId),
    services.liquidity.getAdvancedLiquidity(institutionId),
    services.cecl.getCECLAnalysis(institutionId),
    services.concentration.getConcentrationAnalysis(institutionId),
    services.ftp.getFTPAnalysis(institutionId),
    services.peers.getPeerAnalytics(institutionId),
    services.camel.scoreInstitution(institutionId),
    services.climate.computeClimateRisk(institutionId),
  ]);
```

### Swarm Design Principles

```
1. FAULT ISOLATION: Promise.allSettled — one model failure never cascades
2. HEALTH SCORE: advisor.computeHealthScore runs after all 8 complete (fallback: 50)
3. PARTIAL RESULTS: always return whatever completed, never null the whole run
4. LOGGING: all failed models logged with logger.warn — never silently swallowed
5. TIMING: computeTimeMs tracked — alert if > 30s
6. IDEMPOTENCY: swarm run keyed by institutionId + runId — never double-run
```

### Extending the Swarm (Pattern)

```typescript
// To add a new model to the swarm:
// 1. Implement the service interface
// 2. Inject into runFullSwarm() services parameter
// 3. Add to Promise.allSettled array
// 4. Add model name to modelNames array
// 5. Add field to QuantSwarmResult interface
// 6. Extract result with extract() helper
// Never break the fault isolation — always use allSettled
```

### Outbound Sales Agent Swarm (Python)

```yaml
# services/outbound/
# 6 autonomous agents, YAML-orchestrated

agents:
  1. lead-research:     Scrapes COSSEC + cooperativa directories
  2. enrichment:        Adds contact info, LinkedIn, financial data
  3. messaging:         Generates personalized bilingual email copy
  4. outreach:          Sends via Resend API, tracks opens
  5. crm:               Updates lead pipeline in DB (leads table)
  6. follow-up:         Sequences follow-ups based on engagement

seed_data: 109 PR cooperativas
pipeline: pipelines/lead_ingestion.py + pipelines/daily_outreach.py
```

---

## 9. REPORT PIPELINE

### Current Flow (Confirmed)

```
User: POST /api/v1/portal/jobs (create report job)
           ↓
Portal controller: validate subscription active
           ↓
Queue: Bull queue → pipeline.worker.ts
           ↓
Worker: fetch BalanceSheet + AnalysisRun from DB
           ↓
Preflight: report-preflight.service.ts (snapshot timing = informational only)
           ↓
Run 62 ALM modules (synchronously in worker)
           ↓
Generate PDF (14 pages, bilingual)
           ↓
Upload to R2 → return presigned URL
           ↓
WebSocket: emit progress events via Socket.IO
           ↓
User: receives download link
```

### P1-D: Hardened Flow (Required)

```
... (same through ALM module run)
           ↓
SNAPSHOT: freeze all input data versions into snapshot JSON
           ↓
COMPUTE: run ALM modules against snapshot (not live DB reads)
           ↓
GENERATE: produce PDF from snapshot outputs
           ↓
ARTIFACT: create ReportArtifact record:
  - sourceRunId FK
  - datasetVersions (snapshot of all keys)
  - templateVersion
  - generatedAt
  - checksum (SHA-256 of PDF bytes)
  - storageLocator (R2 key)
           ↓
UPLOAD: PDF to R2
           ↓
LINK: AnalysisRun.reportArtifactId = artifact.id
           ↓
User: receives download link
```

---

## 10. ERROR HANDLING & OBSERVABILITY

### Global Exception Filter (Confirmed)

```typescript
// File: backend-node/src/common/filters/exception.filter.ts
@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    // Structured error response always
    // Sentry capture for status >= 500
    // Logging for all errors
  }
}
```

### Error Code Registry

```
Auth:
  INVALID_CREDENTIALS         401
  TOKEN_EXPIRED               401
  INVALID_API_KEY             401
  INSUFFICIENT_PERMISSIONS    403
  WORKSPACE_ACCESS_DENIED     403

Validation:
  INVALID_REQUEST_BODY        400
  MISSING_REQUIRED_FIELD      400
  INVALID_DATE_FORMAT         400

Resource:
  PORTFOLIO_NOT_FOUND         404
  ASSET_NOT_FOUND             404
  INSTITUTION_NOT_FOUND       404

Conflict:
  DUPLICATE_ASSET             409
  CONCURRENT_MODIFICATION     409

Rate Limit:
  RATE_LIMIT_EXCEEDED         429

Server:
  DATABASE_ERROR              500
  CALCULATION_FAILED          500
  PDF_GENERATION_FAILED       500
  SWARM_PARTIAL_FAILURE       207  (partial — new, add for swarm)
```

### Observability Stack

```typescript
// Sentry: error capture (>= 500 auto-captured)
// OpenTelemetry: distributed traces
// Structured logging: JSON logs with requestId, userId, path
// Health check: GET /health → DB + Redis + R2 connectivity
// Status: GET /api/status → version + uptime + environment

// Add to every service method:
this.logger.log({ action: 'alm_run', institutionId, runId, duration });

// Alert thresholds (operational):
// - PDF generation > 60s → alert
// - Swarm compute > 30s → warn
// - Queue depth > 50 → alert
// - Error rate > 1% → page
```

---

## 11. DATABASE & DATA INTEGRITY

### Prisma Schema Invariants (Never Break These)

```
1. 46 financial fields use Decimal (not Float) — enforce in all migrations
2. 38 indexes — always add index on new FK fields and hot query fields
3. 30 models have updatedAt @updatedAt — add to every new model
4. 8 cascade delete rules — document cascade intent in comments
5. 3 unique constraints on natural keys — prevent duplicates at DB level
6. All migrations are forward-only — never reverse a migration in prod
```

### Migration Discipline

```bash
# Always:
npx prisma migrate dev --name descriptive-name
npx prisma validate
npm test  # verify no test breakage

# Never:
# Drop columns without deprecation window
# Change Decimal to Float
# Remove indexes without query analysis
# Merge migrations from multiple branches without conflict review
```

### Key Models (Confirmed + Needed)

```
CONFIRMED:
  User, Organization, Workspace, Membership
  Institution, BalanceSheet, AnalysisRun, ReportJob
  Scenario (user-saved)
  AuditLog, IngestionLog
  Subscription, Invoice
  Lead, Prospect

P1 NEEDED (from this bible):
  ModelRegistry
  GovernedScenario
  GovernedBenchmark
  ReportArtifact
```

---

## 12. SECURITY POSTURE

### Implemented (Confirmed)

```
✅ Helmet CSP with per-request nonce
✅ HSTS preload
✅ X-Frame-Options: DENY
✅ XSS sanitization pipe (global)
✅ Redis sliding window rate limiting (per-user)
✅ AES-256-GCM data encryption for PII at rest
✅ Stripe webhook signature verification + event deduplication
✅ Open redirect prevention in checkout URLs
✅ API key expiry warnings (X-API-Key-Expires-In-Days header)
✅ GDPR/CCPA/PR-ACT-81 data deletion support
✅ bcrypt password hashing
✅ SHA-256 API key storage (never raw)
✅ httpOnly cookie for refresh tokens
✅ JWT tokenVersion rotation on refresh
```

### Gaps (From Audit) — CLOSED 2026-04-12/13

```
✅ Audit log retention: default 2555 days (7 years) — data-retention.service.ts (FA-06)
✅ Report lineage immutability: ReportArtifact + SHA-256 + model lineage snapshot (FA-05)
✅ Model validation artifacts: ModelValidationArtifact entity — 44 models, 4 golden-test SHA-256 links (FA-04)
✅ Dataset provenance: GovernedScenario (6) + GovernedBenchmark (3) seeded with SHA-256 (FA-03)
✅ Route surface: 157 routes classified in route-inventory.json; robots.txt blocks 74 (FA-08)
```

### Security Rules for All Developers

```
1. NEVER commit .env files (use .env.example only)
2. NEVER expose API keys in logs, errors, or responses
3. ALWAYS validate all request bodies with class-validator DTOs
4. ALWAYS use parameterized queries (Prisma handles this — never raw SQL with string interpolation)
5. ALWAYS sanitize file upload metadata before storage
6. ALWAYS verify Stripe webhook signatures before processing
7. NEVER trust client-provided institutionId without membership check
8. ALWAYS rate-limit unauthenticated endpoints
9. NEVER store sensitive data in JWT payload (only IDs and roles)
10. ALWAYS use presigned URLs for R2 access (never expose R2 bucket directly)
```

---

## 13. MASTER PROMPT PACK (10 PROMPTS)

These are the 10 prompts to use with any AI agent working on CERNIQ. They supersede the CODEX_PROMPT_PACK.md.

---

### MP-00: MASTER SYSTEM PROMPT (Always Load First)

```text
You are the principal software architect, product engineer, and institutional risk documentation lead for CERNIQ — bilingual ALM reporting software for Puerto Rico cooperativas.

RULES OF EVIDENCE:
1. Codebase is primary evidence. Docs are secondary and may be stale.
2. Never invent services, flows, or features not evidenced in the repository.
3. Always separate: [CONFIRMED from code] / [INFERRED from structure] / [CLAIMED by docs] / [MISSING or unverifiable]

STACK:
- Frontend: Next.js 16 + React 19 + Bun + Tailwind 4
- Backend: NestJS 11 + TypeScript 5.9 strict + Prisma 7
- DB: PostgreSQL 15 + Redis 7
- Auth: Supabase + JWT + API keys + Magic links
- Billing: Stripe
- Storage: Cloudflare R2
- Deploy: Railway (backend) + Vercel (frontend)
- Sales: Python 3 + FastAPI + 6-agent outbound pipeline

PRODUCT TRUTH:
- CERNIQ is bilingual ALM reporting for PR cooperativas
- Core: upload balance sheet → 14-page bilingual PDF
- 62 ALM modules (confirmed count)
- COSSEC 12-ratio engine with exam readiness score
- Quant swarm: 8 models, Promise.allSettled, fault-isolated

FINANCIAL PRECISION:
- ALL financial fields are Prisma Decimal (never Float)
- All calculations use Decimal arithmetic
- Monte Carlo: 10K paths, Vasicek model

FAANG AUDIT STATUS (reconciled 2026-04-14 — all 8 findings CLOSED):
- FA-01 CLOSED 2026-04-13: Narrative canonicalized to 14-page / COSSEC 12-ratio / wedge-first
- FA-02 CLOSED 2026-04-13: Goldman/QRM/94-institution/NOAA/FEMA claims removed
- FA-03 CLOSED 2026-04-12: GovernedScenario (6) + GovernedBenchmark (3) seeded
- FA-04 CLOSED 2026-04-12: ModelRegistry entity + 44 models + admin UI at /admin/models
- FA-05 CLOSED 2026-04-13: ReportArtifact + SHA-256 + lineage snapshot, 5 REST endpoints
- FA-06 CLOSED 2026-04-13: Audit-log retention default 365 → 2555 days (7 years)
- FA-07 CLOSED 2026-04-08: alm-quality-gate.yml — 6 automated jobs, ci-status.json artifact
- FA-08 CLOSED 2026-04-13: 157 routes classified, robots.txt blocks 74
Live completion board: `pnpm cerniq:status` (96% / 71 of 74 SESSION_HANDOFF checkboxes)

TONE: Calm. Precise. Technically elite. Execution-oriented.
```

---

### MP-01: REPO INTELLIGENCE BRIEF

```text
Inspect the CERNIQ repository and produce a repo intelligence brief.

Follow these rules:
- Codebase is primary evidence
- Docs are secondary and may be stale
- Separate confirmed / inferred / doc-claimed / missing
- Classify each system: scaffold only / partial build / functioning core / production-leaning / production-ready
- Report narrative drift (ALM vs quant vs SpendCheck vs multi-product) — do not unify unless code supports it

Cover:
1. What CERNIQ is implemented as today
2. Stack across all runtimes (frontend, backend-node, services/, infra/)
3. Major modules and apparent responsibilities
4. Primary user flows from routes, DTOs, schemas
5. Technical strengths
6. Risks, drift, dead paths, unclear ownership

Output structure:
# Repo Intelligence Brief
## Executive Summary
## Confirmed Implementation
## Inferred Architecture
## Major System Areas
## Product/User Flows
## Data/Auth/Infra
## Risks and Drift
## Recommended Next Steps
## Business Description Based on Implementation
```

---

### MP-02: FAANG AUDIT PROMPT

```text
Perform a FAANG-grade audit of the CERNIQ repository.

Audit dimensions:
1. NARRATIVE INTEGRITY: Do public claims match repo evidence?
   - Check: README.md, frontend/app/layout.tsx, why-cerniq/page.tsx, pricing/layout.tsx
   - Find: module count conflicts, unproven capability claims, Goldman/QRM parity
   
2. MODEL GOVERNANCE: Does a formal model registry exist?
   - Check: AnalysisRun schema, any ModelRegistry model
   - Find: owner field, version field, approval state, validation artifacts

3. REPORT LINEAGE: Is every PDF traceable to one immutable analysis artifact?
   - Check: pipeline.worker.ts, alm-document-exports.service.ts, report-preflight.service.ts
   - Find: snapshot binding, checksum, immutable FK chain

4. DATA PROVENANCE: Do benchmark datasets have governed provenance?
   - Check: pr-cooperativa-benchmarks.ts, pr-beta-benchmarks.json, yield-curve.service.ts
   - Find: as-of dates, sources, refresh policies, validation status

5. SECURITY ALIGNMENT: Do public security claims match code?
   - Check: frontend/app/security/layout.tsx vs backend-node/src/jobs/data-retention.service.ts
   - Find: retention period conflicts, unimplemented claims

Rate each dimension: PASS / WARN / FAIL with evidence file references.

Output:
# CERNIQ FAANG Audit
## Executive Verdict
## Narrative Integrity: [PASS/WARN/FAIL]
## Model Governance: [PASS/WARN/FAIL]
## Report Lineage: [PASS/WARN/FAIL]
## Data Provenance: [PASS/WARN/FAIL]
## Security Alignment: [PASS/WARN/FAIL]
## Critical Findings (severity + evidence + recommended fix)
## What Is Already Strong
## Remediation Priority Order
```

---

### MP-03: HARDENING EXECUTION PROMPT

```text
Based on the CERNIQ FAANG audit findings, generate a complete hardening execution plan.

Inputs (all CLOSED as of 2026-04-13 — use this prompt for future findings):
- FA-01: Conflicting module counts in public copy ✅ closed
- FA-04: No formal model registry ✅ closed
- FA-05: Report lineage not immutable ✅ closed
- FA-06: Security retention claim mismatch ✅ closed

For each finding, produce:
1. CURRENT STATE: What code shows today
2. TARGET STATE: What enterprise-ready looks like
3. FILE-BY-FILE TOUCH LIST: Every file that needs to change
4. MIGRATION NEEDED: Any Prisma schema changes
5. TESTS NEEDED: Unit + integration tests to prove the fix
6. ROLLOUT RISK: Low / Medium / High with reasoning
7. ROLLBACK NOTES: How to revert safely

Format each as P0 / P1 / P2 priority.
Include exact TypeScript / Prisma code for each change.
```

---

### MP-04: ALM ENGINE REVIEW PROMPT

```text
Review the CERNIQ ALM engine implementation for correctness, completeness, and regulatory compliance.

Inspect:
- backend-node/src/alm/ (all files)
- backend-node/src/risk/ (Monte Carlo, VaR)
- backend-node/src/alm/benchmarks/
- backend-node/src/alm/scenarios/
- backend-node/src/swarm/quant-swarm.service.ts

For each ALM module:
1. Is the formula implementation correct per COSSEC/NCUA standards?
2. Are inputs properly validated?
3. Are Decimal types used (not Float)?
4. Are edge cases handled (zero assets, negative equity, missing fields)?
5. Are results benchmarked against known test cases?

COSSEC 12 ratios to verify specifically:
capital_adequacy, liquidity_ratio, asset_quality, earnings_roe, earnings_roa,
growth_asset, growth_loan, nim, operating_efficiency, concentration_loan,
concentration_member, leverage_ratio

Output:
# ALM Engine Review
## Overall Assessment
## Module-by-Module Status
## Formula Correctness Findings
## Edge Case Gaps
## Benchmark Test Coverage
## Regulatory Alignment (COSSEC / NCUA)
## Recommended Fixes
```

---

### MP-05: SWARM ARCHITECTURE PROMPT

```text
Design and review the CERNIQ quant swarm architecture.

Current implementation: backend-node/src/swarm/quant-swarm.service.ts
Pattern: Promise.allSettled across 8 models (fault-isolated)

Review and extend for:
1. FAULT ISOLATION: Verify allSettled pattern prevents cascade failures
2. HEALTH SCORE: Verify advisor.computeHealthScore fallback (default: 50)
3. TIMEOUT HANDLING: Add AbortController timeout per model (suggested: 25s per model)
4. RETRY LOGIC: Should failed models retry? (max 1 retry for transient errors)
5. OBSERVABILITY: Add timing per model, structured logging
6. CIRCUIT BREAKING: After N consecutive failures, bypass model and log
7. RESULT CACHING: Cache swarm result by institutionId + dataVersion (Redis TTL = 1h)
8. PARTIAL RESULT HANDLING: How does the report behave with 2/8 failed models?

Also design:
- OUTBOUND SALES SWARM (Python, 6 agents) for daily execution
- REPORT GENERATION SWARM (parallel section generation for 14-page PDF)

Output:
# Swarm Architecture
## Quant Swarm (Current + Improvements)
## Fault Isolation Design
## Timeout + Retry + Circuit Breaking
## Caching Strategy
## Partial Result Handling
## Outbound Sales Swarm Design
## Report Generation Swarm Design
## Implementation Checklist
```

---

### MP-06: DRIFT REPORT PROMPT

```text
Generate a drift report for CERNIQ, comparing live code against all documentation.

Inspect in this order:
1. Live routes and controllers
2. DTOs and schemas
3. Prisma schema and migrations
4. deployment files
5. Then compare against: README.md, docs/ARCHITECTURE.md, docs/BACKEND.md, docs/FRONTEND.md

Report drift by category:
1. POSITIONING DRIFT: Claims vs implementation
2. ARCHITECTURE DRIFT: Docs say X, code shows Y
3. API DRIFT: Documented endpoints not implemented, or implemented endpoints not documented
4. AUTH DRIFT: Described auth flow vs actual guards/middleware
5. DATA DRIFT: Schema docs vs Prisma schema
6. DEPLOYMENT DRIFT: Deployment docs vs actual deployment config

For each drift item:
- Severity: CRITICAL / HIGH / MEDIUM / LOW
- Source: which doc claims what
- Reality: what code shows
- Action: fix doc vs fix code

Output:
# Drift Report — CERNIQ
## Summary
## Positioning Drift
## Architecture Drift
## API Drift
## Auth Drift
## Data Drift
## Deployment Drift
## Highest-Risk Drift Items
## Recommended Fix Order
```

---

### MP-07: REPORT ENGINE PROMPT

```text
You are responsible for the CERNIQ PDF report generation engine.

The report must be:
- 14+ pages minimum
- Bilingual (Spanish + English)
- Board-ready (CFO can hand this to a board of directors)
- COSSEC-aligned (matches Puerto Rico regulatory requirements)
- Immutably linked to one AnalysisRun (P1-D requirement)

Current implementation: backend-node/src/pipeline/pipeline.worker.ts

Page structure (REQUIRED):
1. Cover — logo, institution name, report date, exam readiness score (0-100)
2. Executive Summary — 5 key findings, bilingual
3. Balance Sheet Overview — asset/liability table
4. Duration Gap Analysis — by time bucket (overnight, 1m, 3m, 6m, 1y, 3y, 5y, 10y+)
5. NII Sensitivity — ±100bp, ±200bp, ±300bp scenarios
6. Liquidity Metrics — LCR, NSFR with COSSEC thresholds
7. COSSEC 12-Ratio Grid — all 12 ratios vs benchmark vs percentile
8. Stress Testing Results — Monte Carlo (P95, P99) + 3 deterministic scenarios
9. EVE Analysis
10. BPV Analysis
11. Concentration Risk
12. Rate Environment Context
13. Sector Benchmarking vs PR Cooperativa peers
14. Regulatory Guidance & Next Steps

Generate:
1. Updated pipeline.worker.ts with P1-D artifact binding
2. Each section as a composable generator function
3. ReportArtifact creation before R2 upload
4. SHA-256 checksum computation
```

---

### MP-08: GTM EXECUTION PROMPT

```text
You are the CERNIQ go-to-market execution agent.

ICP:
- Primary: Puerto Rico cooperativas (109 targets from COSSEC directory)
- Secondary: US credit unions
- Channel: CPA firms serving financial institutions

Buyer personas:
- CFO: needs board-ready reports without manual assembly ($15K/engagement saved)
- Risk Manager: needs defensible ALM metrics for regulators
- Treasury Manager: needs rate sensitivity faster
- Financial Consultant: needs a repeatable multi-institution tool

Current outbound engine:
- 6 Python agents (services/outbound/)
- 109 seed institutions
- Daily outreach pipeline
- Resend email delivery

Tasks:
1. Generate next 30 days of outbound sequence for cooperative CFOs
2. Write 3 cold email variants (bilingual) for each persona
3. Sequence: Day 1 (cold) → Day 4 (follow-up 1) → Day 8 (value add) → Day 14 (final)
4. Specify success metrics: open rate, demo request rate, conversion rate
5. Generate LinkedIn DM sequence (5 messages)
6. Write objection-handling scripts for top 5 objections

Output:
# GTM Execution Plan
## 30-Day Outbound Sequence
## Email Templates (EN/ES, all personas)
## LinkedIn DM Sequence
## Objection-Handling Scripts
## Success Metrics & Tracking
```

---

### MP-09: ARCHITECTURE EXTRACTION PROMPT

```text
Read the CERNIQ repository and generate a clean, current architecture document.

Follow this inspection order:
1. frontend/package.json
2. backend-node/package.json
3. backend-node/src/ (all modules)
4. frontend/app/ (all routes)
5. backend-node/prisma/schema.prisma
6. .github/workflows/
7. docker-compose.yml, docker-compose.prod.yml
8. Then: docs/ for drift analysis only

Cover:
- Product purpose (from code, not from README prose)
- Active runtimes and their boundaries
- Major modules and responsibilities
- Request lifecycle for each major surface (portal submit, ALM run, PDF generation)
- Auth model (confirmed from guards and middleware)
- Data model (confirmed from Prisma schema)
- Jobs and workers (confirmed from queue consumers)
- External integrations (confirmed from env usage and imports)
- Deployment topology (Railway + Vercel + R2 + Redis)
- Observability (Sentry + OTel + health endpoints)
- Known drift (docs vs code)
- Missing pieces
- Risks

Output format: repo-ready markdown, suitable for docs/ARCHITECTURE.md
Separate confirmed / inferred / doc-claimed sections.
```

---

### MP-10: DAILY AGENT PROMPT

```text
Analyze the CERNIQ repository using code as the primary source of truth.

Do:
- Inspect live implementation before trusting any README or doc
- Separate confirmed / inferred / doc-claimed / missing
- Report product, architecture, auth, API, and deployment drift explicitly
- Flag any security risks or financial precision issues
- Identify any claims in docs or frontend copy that conflict with code

Then answer: "What is the single most important thing to fix today for institutional credibility?"

Output format: repo-ready markdown.
Sections: Executive Summary / Today's Top Issue / Evidence / Recommended Action / Checklist
```

---

## 14. AGENT SWARMS BIBLE

### Swarm Taxonomy

CERNIQ uses three distinct swarm architectures:

#### Swarm Type 1: Quant Model Swarm (NestJS, TypeScript)

```
Purpose: Run all 8 ALM models in parallel for an institution
Pattern: Promise.allSettled (fault-isolated)
File: backend-node/src/swarm/quant-swarm.service.ts

Models:
  yieldCurve    → rate shock / yield curve analysis
  liquidity     → LCR/NSFR advanced
  cecl          → CECL vintage analysis
  concentration → concentration risk
  ftp           → FTP attribution
  peers         → peer analytics
  camel         → CAMEL score
  climate       → climate risk

Health Score: advisor.computeHealthScore(institutionId) — runs after all 8 settle
Fallback: if health score fails → return { overall: 50 }
```

#### Swarm Type 2: Outbound Sales Swarm (Python, FastAPI)

```
Purpose: Autonomous outbound targeting 109 PR cooperativas
Pattern: Sequential pipeline with parallel enrichment
Files: services/outbound/

Agents:
  1. lead-research    Finds targets from COSSEC directory
  2. enrichment       Adds CFO contacts, LinkedIn, financials
  3. messaging        Writes personalized bilingual email copy
  4. outreach         Sends via Resend, tracks opens/clicks
  5. crm              Updates lead DB (status, last_contact, score)
  6. follow-up        Sequences based on engagement signals

Orchestration: YAML pipeline configs
Daily run: pipelines/daily_outreach.py
Ingestion: pipelines/lead_ingestion.py
```

#### Swarm Type 3: Report Section Swarm (Proposed — P2)

```
Purpose: Parallel generation of 14 report pages for speed
Pattern: Promise.allSettled per page section
Priority: P2 — after P1 trust layer is complete

Sections (can parallelize):
  balance_sheet_overview     (data fetch only — fast)
  duration_gap               (depends on ALM run)
  nii_sensitivity            (depends on ALM run)
  liquidity_metrics          (depends on ALM run)
  cossec_12_ratio_grid       (depends on ALM run)
  stress_testing             (Monte Carlo — slowest)
  eve_analysis               (depends on ALM run)
  bpv_analysis               (depends on ALM run)
  concentration_risk         (depends on ALM run)
  rate_environment           (static context)
  sector_benchmarking        (benchmark fetch only)

Bottleneck: stress_testing (Monte Carlo 10K paths) — always on critical path
Parallelizable: all non-Monte-Carlo sections can run simultaneously after ALM run
```

### Agent Operating Rules (All Swarms)

```
1. NEVER crash the parent process — always catch and report failures
2. ALWAYS return partial results with failure metadata
3. ALWAYS log failed agents/models with: agent_name, error_message, duration_ms
4. NEVER exceed timeout limits (quant: 25s/model, outbound: 30s/agent)
5. ALWAYS use idempotency keys for operations that have side effects
6. ALWAYS deduplicate before writing to DB or sending emails
7. NEVER use the same API key across parallel agents (rate limit risk)
8. ALWAYS emit structured events for observability
```

### Agent-to-Agent Communication Pattern

```typescript
// Within quant swarm: via service injection (NestJS DI)
// Within sales swarm: via shared DB + YAML config
// Cross-swarm: via DB state (AnalysisRun status → triggers portal notification)

// Event emission pattern:
this.eventEmitter.emit('swarm.model.completed', {
  institutionId,
  runId,
  modelName: 'cecl',
  durationMs: 1240,
  status: 'success',
});

// WebSocket relay to client:
this.wsGateway.emitToUser(userId, 'report.progress', {
  step: 'liquidity',
  progress: 50,
  message: 'Liquidity analysis complete',
});
```

---

## 15. GTM & SALES ENGINE

### Mission (External)

```
Help Puerto Rico cooperativas produce their required ALM reports in minutes, not weeks.
Replace $15,000+ manual engagements with an automated, bilingual, COSSEC-compliant platform.
```

### Outbound Playbook

```
Week 1: Identify 10 CFOs from COSSEC member directory
Week 2: Send cold email sequence (template below)
Week 3: LinkedIn connection + DM sequence
Week 4: Demo meeting or follow-up sequence

Cold Email Template (English version):
Subject: COSSEC ALM reports in 10 minutes — not 3 weeks

Hi [Name],

I noticed [Institution] completed their Q4 COSSEC exam — congratulations.

We built CERNIQ specifically for PR cooperativas to automate the ALM report 
process your team does manually. Upload a balance sheet CSV, get a 14-page 
bilingual board-ready report with all 12 COSSEC ratios in minutes.

[Institution similar to yours] used it to cut their quarterly reporting 
cycle from 3 weeks to 45 minutes.

Would a 20-minute demo make sense this week?

[Demo link]
```

### Sales Engine Metrics

```
Leading indicators:
- Cold email open rate (target: > 30%)
- Demo request rate (target: > 5% of outreach)
- Demo-to-trial rate (target: > 40%)
- Trial-to-paid rate (target: > 25%)

Revenue targets:
- Month 1: 3 paid institutions
- Month 3: 15 paid institutions
- Month 6: 40 paid institutions
- Year 1: 80+ paid institutions (75% of addressable market)

Pricing (Stripe tiers):
- Starter: per-report pricing
- Monthly: unlimited reports
- Annual: discount + priority support
- Partner: CPA firm multi-seat
```

### LinkedIn Sequence

```
Day 1: Connect (no message)
Day 3: "Thanks for connecting — I noticed [Institution] is [COSSEC member / growing / recent exam]. 
        We help PR cooperativas automate their ALM reporting. Worth a quick chat?"
Day 7: Share insight: "Quick question — how long does your ALM report cycle take today?"
Day 14: Share demo: "We just released bilingual COSSEC 12-ratio reports. 
         Here's a sample output — happy to walk you through it."
Day 21: Final: "Last message — if timing isn't right now, I'll follow up in Q2."
```

---

## 16. SESSION HISTORY & WHAT CHANGED

### Complete Session History (Most Recent First)

| Session | Title | Key Output |
|---|---|---|
| 2026-04-13 | This session | CERNIQ MASTER BIBLE v2 (this doc) |
| 2026-04-09 | FAANG Audit | 5-file audit pack: EXECUTIVE_REPORT, SCORECARD, EVIDENCE_MATRIX, REMEDIATION_ROADMAP, APPENDIX_INVENTORY |
| ~2026-04 | Build enterprise AI agents | 32-agent FAANG-grade system in `claude-agent-system/` |
| ~2026-04 | Analyze Claude sessions + master prompts | FORGE MASTER PROMPTS SWARMS BIBLE (2,730 lines) |
| ~2026-04 | Platform documentation (NADIR) | 10 NADIR bibles (unrelated project — context contamination risk) |
| ~2026-03-28 | v1.0.0 release | 62 ALM modules, full billing, portal, 6-agent sales engine |
| 2026-03-15 | Enterprise Hardening Bible | MP-PLAT-01, MP-DATA-02, MP-PLAT-02, MP-UX-02 executed |

### Completed Master Prompts (from Enterprise Hardening Bible)

| ID | Name | Status | File Changed |
|---|---|---|---|
| MP-PLAT-01 | COSSEC 12-ratio engine | ✅ DONE | `backend-node/src/alm/alm-enterprise.service.ts` |
| MP-DATA-02 | PR cooperativa benchmarks | ✅ DONE | `backend-node/src/alm/benchmarks/pr-cooperativa-benchmarks.ts` |
| MP-PLAT-02 | PDF 14-page upgrade | ✅ DONE | `backend-node/src/pipeline/pipeline.worker.ts` |
| MP-UX-02 | Landing page rewrite | ✅ DONE | `frontend/app/page.tsx` |

### Completed Master Prompts (FAANG-gated)

| ID | Name | Priority | Blocks | Status |
|---|---|---|---|---|
| MP-SEC-01 | Security audit & claims alignment | P0 | FA-06 | ✅ CLOSED 2026-04-13 |
| MP-OPS-03 | E2E gate automation | P2 | FA-07 | ✅ CLOSED 2026-04-08 |
| MP-DATA-03 | Model registry | P1 | FA-04 | ✅ CLOSED 2026-04-12 |
| MP-PLAT-03 | Immutable report artifacts | P1 | FA-05 | ✅ CLOSED 2026-04-13 |
| MP-COPY-01 | Narrative cleanup | P0 | FA-01, FA-02 | ✅ CLOSED 2026-04-13 |

### Remaining Master Prompts (non-FAANG — customer experience)

| ID | Name | Priority | Blocks |
|---|---|---|---|
| MP-UX-01 | Dashboard redesign | P1 | UX trust |
| MP-UX-03 | Portal flow | P1 | Conversion |
| MP-COPY-02 | Email rewrites | P1 | Outbound |

---

## 17. EXECUTION ORDER — NOW → REVENUE

### This Week (P0 — Stop Trust Leakage) — ✅ CLOSED 2026-04-13

```bash
Day 1-2: NARRATIVE CLEANUP ✅
  [x] Audited all public-facing copy for conflicting counts
  [x] frontend/app/layout.tsx (removed 200+/170+)
  [x] frontend/app/why-cerniq/page.tsx (removed Goldman/QRM)
  [x] Canonicalized content to 14-page report + COSSEC 12-ratio engine
  [x] Audit retention default 365 → 2555 days (7 years)

Day 3-4: ROUTE PRUNING ✅
  [x] Inventoried 157 routes — frontend/route-inventory.json
  [x] robots.txt blocks 74 non-core routes
  [x] Public nav narrowed to ALM wedge

Day 5: OUTBOUND LAUNCH (non-engineering — status tracked in sales engine)
  [ ] Verify 109 cooperativa seed data is loaded
  [ ] Run lead ingestion pipeline
  [ ] Send first 10 cold emails
  [ ] Verify Resend delivery + tracking
```

### Sprint 1 (P1-A/B — Model Registry + Governed Scenarios) — ✅ CLOSED 2026-04-12

```bash
  [x] Prisma migration: 20260412180000_add_model_registry (ModelRegistryEntry + ModelValidationArtifact)
  [x] Prisma migration: 20260412190000_add_governed_scenarios_benchmarks (GovernedScenario + GovernedBenchmark)
  [x] Seeded 44 initial model registry entries via ModelRegistrySeeder (idempotent OnModuleInit)
  [x] Seeded 6 governed scenarios (COSSEC baseline/adverse, FRB severely adverse, hurricane Cat 4, rate shocks)
  [x] ModelRegistry admin UI — /admin/models with MetricStrip + DataTable + filters + detail page
  [x] 25 registry specs + 21 governance specs + 11 lifecycle specs green
```

### Sprint 2 (P1-C/D — Benchmarks + Report Lineage) — ✅ CLOSED 2026-04-13

```bash
  [x] Prisma migration: GovernedBenchmark seeded (Treasury curve Q1-2026, PR peer group $100M-$250M, COSSEC limits)
  [x] Benchmark datasets carry SHA-256 + source provenance + refresh policy
  [x] Prisma migration: 20260413080000_add_report_artifacts (ReportArtifact + 5 format enum)
  [x] generateAndRecordArtifact() orchestrator wired into 3 callers (portal, actions, document-exports)
  [x] SHA-256 checksum + model lineage snapshot + preflight gaps stored per artifact
  [x] Preflight returns modelLineage[] — every report traces to exact model versions + approval state
  [x] Integration test: ReportArtifactController — verify integrity by base64 checksum comparison
  [x] 13 service + 8 controller specs green
```

### Sprint 3 (Revenue Push)

```bash
  [ ] 15 active outbound sequences running
  [ ] Demo environment seeded with realistic cooperativa data
  [ ] Demo walkthrough script updated (docs/demo/PABLO_DEMO_SCRIPT.md)
  [ ] Stripe checkout tested end-to-end
  [ ] First paid customer target
```

---

## 18. APPENDIX: FILE MAP

### Most Important Files (Memorize These)

```
PRODUCT CORE:
  frontend/app/page.tsx                              Landing page (MP-UX-02 ✅)
  frontend/app/portal/submit/page.tsx                Core user workflow
  backend-node/src/pipeline/pipeline.worker.ts       PDF generation (14-page ✅)
  backend-node/src/alm/alm-enterprise.service.ts     COSSEC 12 ratios (✅)
  backend-node/src/alm/benchmarks/pr-cooperativa-benchmarks.ts  PR data (✅)

TRUST LAYER (Build These):
  backend-node/prisma/schema.prisma                  Add ModelRegistry, GovernedBenchmark, ReportArtifact
  backend-node/src/alm/reports/report-preflight.service.ts  Make snapshot-bound
  backend-node/src/alm/alm-document-exports.service.ts      Add artifact creation
  backend-node/src/jobs/data-retention.service.ts            Fix 7-year claim

SECURITY:
  frontend/app/security/layout.tsx                   Fix retention claim
  backend-node/src/auth/                             JWT + magic link + API key (all ✅)
  backend-node/src/common/filters/exception.filter.ts  Global error handler

SWARM:
  backend-node/src/swarm/quant-swarm.service.ts      8-model parallel execution
  services/outbound/                                 6-agent sales engine

DOCS (Source of Truth):
  docs/CERNIQ_MASTER_BIBLE_v2.md                    THIS FILE — single source of truth
  docs/analysis/faang-audit-2026-04-09/EXECUTIVE_REPORT.md  Full audit findings
  docs/analysis/faang-audit-2026-04-09/REMEDIATION_ROADMAP.md  Fix order
  docs/CODEX_PROMPT_PACK.md                          Agent prompts (superseded by Section 13)
  docs/agent/CODEX_OPERATING_GUIDE.md               Agent operating rules

CI/CD:
  .github/workflows/ci-cd.yml                        Main CI pipeline
  .github/workflows/alm-quality-gate.yml             ALM-specific quality gate
  Makefile                                            All dev commands
```

### Directory Reference

```
cerniq/
├── backend-node/src/
│   ├── alm/                 Core ALM engine (62 modules)
│   │   ├── alm-enterprise.service.ts     (COSSEC 12 ratios ✅)
│   │   ├── benchmarks/                  (PR cooperativa data)
│   │   ├── reports/                     (PDF generation)
│   │   ├── scenarios/                   (scenario persistence)
│   │   └── yield-curve.service.ts       (yield curve)
│   ├── auth/                Auth (JWT + magic + API key + OAuth)
│   ├── billing/             Stripe
│   ├── portal/              Client portal endpoints
│   ├── risk/                Monte Carlo, VaR
│   ├── swarm/               Quant swarm (8 models)
│   ├── pipeline/            Report generation worker
│   ├── jobs/                Data retention, scheduled jobs
│   ├── email/               Resend
│   ├── storage/             R2
│   └── leads/               Lead pipeline
├── frontend/app/
│   ├── portal/              Upload → submit → results
│   ├── alm/                 62 ALM analysis routes
│   ├── admin/               Internal pipeline
│   └── [HIDE THESE:]
│       ├── developers/
│       ├── options/
│       ├── risk-analytics/
│       └── spendcheck/
├── services/outbound/       6-agent Python sales engine
├── docs/
│   ├── CERNIQ_MASTER_BIBLE_v2.md        ← THIS FILE
│   ├── analysis/faang-audit-2026-04-09/ ← Latest audit
│   ├── prompts/                          ← Domain-specific prompts
│   ├── agent/                            ← Agent operating guides
│   └── [Other docs: may be stale — verify against code]
└── .github/workflows/       CI/CD (typecheck + ALM quality gate + deploy)
```

---

*CERNIQ MASTER BIBLE v2 — Written 2026-04-13*  
*Owner: Erwin Kiess-Alfonso / KLYTICS LLC*  
*Next review: After P1 trust layer is complete*  
*This document supersedes: ENGINEERING_BIBLE_PART2.md, ENGINEERING_BIBLE_PART3.md, GTM_PRODUCT_BIBLE.md, QUANT_MODELS_BIBLE.md, CERNIQ_MASTER_PLAYBOOK.md, CODEX_PROMPT_PACK.md, SESSION_HANDOFF.md, POST_SPRINT_STATUS.md*
