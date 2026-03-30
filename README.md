<p align="center">
  <strong>CERNIQ</strong><br/>
  <em>Intelligent ALM Reporting for Puerto Rico Financial Institutions</em><br/>
  <a href="https://cerniq.io">cerniq.io</a> &bull; <a href="https://cerniqtech.com">cerniqtech.com</a>
</p>

<p align="center">
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-5.9-blue?logo=typescript&logoColor=white"/>
  <img alt="NestJS" src="https://img.shields.io/badge/NestJS-11-e0234e?logo=nestjs&logoColor=white"/>
  <img alt="Next.js" src="https://img.shields.io/badge/Next.js-16-black?logo=next.js&logoColor=white"/>
  <img alt="Prisma" src="https://img.shields.io/badge/Prisma-7-2D3748?logo=prisma&logoColor=white"/>
  <img alt="PostgreSQL" src="https://img.shields.io/badge/PostgreSQL-15-336791?logo=postgresql&logoColor=white"/>
  <img alt="License" src="https://img.shields.io/badge/License-Proprietary-red"/>
</p>

---

## What is CERNIQ?

CERNIQ is a bilingual (ES/EN) **Asset-Liability Management (ALM)** platform built specifically for **cooperativas, credit unions, and community banks** in Puerto Rico.

It automates the ALM analysis process that institutions currently perform manually or pay consultants **$15K+ per engagement** to produce.

**Core capability:** Upload a balance sheet CSV → get a **14+ page board-ready ALM report** with Duration Gap, NII Sensitivity, EVE, LCR, Monte Carlo stress testing, and COSSEC compliance assessment — in minutes, not weeks.

---

## Key Features

### 62 ALM Analysis Modules
| Domain | Modules |
|--------|---------|
| **Interest Rate Risk** | Duration Gap, NII Sensitivity, EVE, BPV, Key Rate Durations, Rate Shock v2, Repricing Gap |
| **Stress Testing** | Monte Carlo (10K paths, Vasicek), Scenario Builder, Scenario Compare, Stress Pack, FRTB-IMA |
| **Credit Risk** | CECL Vintage, KMV-Merton, Copula Credit, Credit Metrics, Concentration, Wrong-Way Risk |
| **Liquidity** | LCR/NSFR, Cash Flow Bucketing, SOFR Exposure, Deposit Beta |
| **Portfolio** | Black-Litterman, HRP, Capital Optimizer, CVaR Optimizer, VaR |
| **Regulatory** | COSSEC Compliance, NCUA Form 5300, Exam Prep, Board Report, CAMEL Forecast |
| **Advanced** | PCA Yield Curve, Macro Regime Detection, NIM Attribution, FTP Attribution, Climate Risk |

### COSSEC Compliance
- Automated compliance checks against current PR regulatory requirements
- Board-ready PDF reports in **Spanish and English**
- Regulatory exam documentation support

### Client Portal
- CSV upload with validation and dry-run preview
- One-click PDF report generation (bilingual)
- Analysis run history and ingestion logs
- Stripe-powered subscription billing

### Outbound Sales Engine
- 6-agent autonomous pipeline (Lead Research, Enrichment, Messaging, Outreach, CRM, Follow-up)
- Automated cold outreach with personalized email sequences
- Puerto Rico cooperativa seed data

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | Next.js 16, React 19, Bun, Tailwind CSS 4, Recharts, Framer Motion, Zustand |
| **Backend** | NestJS 11, TypeScript 5.9, Prisma 7 ORM, Socket.IO |
| **Database** | PostgreSQL 15, Redis 7 |
| **Auth** | Supabase + JWT + OAuth (Google, GitHub) + API keys + Magic links |
| **Billing** | Stripe (checkout, subscriptions, webhooks) |
| **Email** | Resend (bilingual transactional emails) |
| **Storage** | Cloudflare R2 (report PDFs, presigned URLs) |
| **AI/LLM** | OpenAI (insights), Ollama (local fallback) |
| **Deploy** | Railway (backend) + Vercel (frontend) |
| **CI/CD** | GitHub Actions (tests, coverage, build, Railway deploy) + Vercel GitHub integration |
| **Sales Engine** | Python 3, FastAPI, YAML-orchestrated agents |

---

## Quick Start

### Prerequisites
- **Node.js 20+** and **npm** (or Bun)
- **Docker & Docker Compose** (for PostgreSQL + Redis)

### 1. Clone & Configure

```bash
git clone https://github.com/monykiss/cerniq.git
cd cerniq
cp .env.example .env    # Edit with your values
```

### 2. Start Infrastructure

```bash
docker compose up -d postgres redis
```

### 3. Backend (NestJS)

```bash
cd backend-node
npm install --legacy-peer-deps
npx prisma migrate dev
npm run start:dev
# → http://localhost:3000
```

### 4. Frontend (Next.js)

```bash
cd frontend
npm install
npm run dev
# → http://localhost:3001
```

### Using Make

```bash
make dev            # Start DB + backend + frontend
make prod           # Production Docker build
make test           # Backend unit tests
make test-e2e       # Playwright E2E tests
make migrate        # Run Prisma migrations
make health         # Check backend health
make lint           # Lint backend + frontend
make db-studio      # Open Prisma Studio
make deploy         # Deploy backend + frontend
make clean          # Remove build artifacts
```

### Access Points

| Service | URL |
|---------|-----|
| Frontend | http://localhost:3001 |
| Backend API | http://localhost:3000 |
| Health Check | http://localhost:3000/health |
| API Status | http://localhost:3000/api/status |
| Prisma Studio | http://localhost:5555 |

---

## Architecture

```
                   Browser  (cerniq.io)
                        │
             ┌──────────┴───────────┐
             │                      │
    Vercel (Next.js 16)    API Rewrite (/api/*)
             │                      │
             └──────────┬───────────┘
                        │
              Railway (NestJS 11)
             ┌──────────┼──────────┐
             │          │          │
        ┌────┴────┐ ┌───┴───┐ ┌───┴────────┐
        │ Prisma  │ │ Redis │ │ Stripe     │
        │Postgres │ │ Cache │ │ Resend     │
        └─────────┘ └───────┘ │ R2         │
                              │ OpenAI     │
                              └────────────┘
```

For detailed architecture diagrams and data flow, see [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

---

## Project Structure

```
cerniq/
├── backend-node/          # NestJS 11 API (28 modules)
│   ├── prisma/            #   Prisma schema, migrations, seeds
│   └── src/
│       ├── alm/           #   ALM calculation engine
│       ├── auth/          #   JWT + OAuth + Supabase auth
│       ├── billing/       #   Stripe billing integration
│       ├── portal/        #   Client portal endpoints
│       ├── risk/          #   Monte Carlo, VaR, stress testing
│       ├── market-data/   #   Yahoo Finance integration
│       ├── email/         #   Resend transactional emails
│       ├── storage/       #   Cloudflare R2 file storage
│       ├── leads/         #   Lead pipeline management
│       └── ...            #   18 more modules
├── frontend/              # Next.js 16 app (100+ routes)
│   ├── app/               #   App Router pages
│   │   ├── alm/           #     62 ALM analysis modules
│   │   ├── portal/        #     Client portal (submit, settings, billing)
│   │   ├── admin/         #     Admin panel (leads, pipeline, metrics)
│   │   ├── demo/          #     Interactive demo
│   │   └── ...            #     40+ more routes
│   ├── components/        #   React components (16 directories)
│   ├── lib/               #   API client, stores, utils, i18n (EN/ES)
│   └── e2e/               #   Playwright E2E tests
├── services/
│   └── outbound/          # Python outbound sales engine
│       ├── agents/        #   6 autonomous agents
│       ├── pipelines/     #   Lead ingestion + daily outreach
│       └── templates/     #   Email templates
├── docs/                  # Comprehensive documentation
│   ├── ARCHITECTURE.md    #   System architecture
│   ├── BACKEND.md         #   Backend module reference
│   ├── FRONTEND.md        #   Frontend route & component map
│   ├── DATABASE.md        #   Data model & schema reference
│   ├── SERVICES.md        #   Outbound engine docs
│   ├── ENVIRONMENT.md     #   All env vars documented
│   ├── analysis/          #   API contract, drift reports
│   ├── demo/              #   Demo scripts, pricing one-pager
│   ├── ops/               #   Deployment runbook, env vars
│   ├── security/          #   Security audit
│   └── strategy/          #   ICP, value prop, problem map
├── .github/workflows/     # CI/CD (typecheck, validate, build)
├── infrastructure/        # Terraform (AWS ECS, RDS, ElastiCache)
├── archive/               # Archived dead code (Rust backend, experiments)
├── docker-compose.yml     # Dev environment
├── docker-compose.prod.yml# Production environment
├── Makefile               # Dev workflow automation
├── CONTRIBUTING.md        # Developer onboarding guide
└── .env.example           # All environment variables
```

---

## API Surface

| Module | Endpoints | Auth | Description |
|--------|-----------|------|-------------|
| ALM Enterprise | 15 | JWT | Institutions, balance sheets, analysis runs, reports |
| ALM Stateless | 7 | Public | Stateless calculations (duration gap, NII, EVE, LCR, BPV) |
| Auth | 12 | Mixed | Register, login, OAuth, API keys, password reset, magic links |
| Billing | 5 | Mixed | Stripe checkout, webhooks, subscriptions |
| Portal | 6 | JWT | Report jobs, CSV upload, ingestion logs |
| Risk | 8 | JWT | Monte Carlo, VaR, correlation, stress testing |
| Market Data | 5 | Public | Quotes, historical data, market health |
| Admin | 8 | Admin Key | Demo requests, prospects, pipeline, stats |
| Leads | 4 | Admin Key | Lead CRUD, pipeline stats |

Full API contract: [docs/analysis/API_CONTRACT_REFERENCE.md](docs/analysis/API_CONTRACT_REFERENCE.md)

---

## Testing

```bash
# Shared live status snapshot
make first-gate-status

# Full PR-gated release gate
make release-gate

# Captain branch commit/push/PR helper
make release-pr

# Production verification
make verify-production

# Backend unit tests
cd backend-node && npm test

# Backend coverage
cd backend-node && npm run test:cov

# Frontend unit/component tests
cd frontend && npm test

# Frontend coverage
cd frontend && npm run test:cov

# E2E tests (Playwright)
cd frontend && npm run test:e2e
```

---

## Deployment

See [docs/DEPLOYMENT_CHECKLIST.md](docs/DEPLOYMENT_CHECKLIST.md) for the full production deploy guide.

```bash
# PR-gated release path
make release-gate
make release-pr
# release-pr runs the gate, stages changes, commits the captain branch,
# pushes the branch, and opens a PR to main.
# Railway and Vercel deploy from main only after merge and green GitHub Actions.

# Manual fallback only: Backend → Railway
cd backend-node && railway up

# Manual fallback only: Frontend → Vercel
cd frontend && vercel --prod
```

---

## Documentation Index

| Document | Description |
|----------|-------------|
| [Architecture](docs/ARCHITECTURE.md) | System architecture, data flow, infrastructure |
| [Backend Reference](docs/BACKEND.md) | All 28 NestJS modules documented |
| [Frontend Reference](docs/FRONTEND.md) | All 34 routes and 16 component directories |
| [Database Schema](docs/DATABASE.md) | Prisma models, relations, enums, migrations |
| [Services](docs/SERVICES.md) | Outbound sales engine documentation |
| [Environment Vars](docs/ENVIRONMENT.md) | All env vars across all services |
| [API Contract](docs/analysis/API_CONTRACT_REFERENCE.md) | Full API endpoint reference |
| [Deployment Checklist](docs/DEPLOYMENT_CHECKLIST.md) | Production deploy guide |
| [Deployment Runbook](docs/ops/deployment_runbook.md) | Step-by-step deployment ops |
| [Security Audit](docs/security/security_audit_v1.md) | Security review and recommendations |
| [Demo Script](docs/demo/PABLO_DEMO_SCRIPT.md) | 20-min sales demo walkthrough |
| [Pricing One-Pager](docs/demo/PRICING_ONE_PAGER.md) | Leave-behind for prospects |
| [Contributing](CONTRIBUTING.md) | Developer onboarding guide |

---

## License

**Proprietary** — KLYTICS LLC, San Juan, Puerto Rico.

---

<p align="center">
  <strong>CERNIQ</strong> — ALM intelligence for the institutions that power Puerto Rico's economy.
</p>
