# CERNIQ

> **Intelligent ALM Reporting for Puerto Rico Financial Institutions**

---

## Overview

CERNIQ is a bilingual (ES/EN) Asset-Liability Management platform built for cooperativas, credit unions, and community banks. It automates the ALM analysis process that institutions currently perform manually or pay consultants $15K+ per engagement to produce.

**Core capability:** Upload a balance sheet CSV, get a 14+ page board-ready ALM report with Duration Gap, NII Sensitivity, EVE, LCR, Monte Carlo stress testing, and COSSEC compliance assessment.

---

## What CERNIQ Does

### ALM Analysis Engine
- **Duration Gap Analysis** -- interest rate risk profiling at +/-100, 200, 300 bps
- **NII Sensitivity** -- net interest income impact across multiple rate scenarios
- **Economic Value of Equity (EVE)** -- long-term equity sensitivity
- **Liquidity Coverage Ratio (LCR)** -- Basel III-aligned liquidity assessment
- **Basis Point Value (BPV)** -- portfolio rate sensitivity per 1bp move
- **Monte Carlo Stress Testing** -- 1,000 rate path simulations with 4 regulatory scenarios

### COSSEC Compliance
- Automated compliance checks against current Puerto Rico regulatory requirements
- Board-ready PDF reports in Spanish and English
- Regulatory exam documentation support

### Client Portal
- CSV upload with validation and dry-run preview
- One-click PDF report generation (bilingual)
- Analysis run history and ingestion logs
- Stripe-powered subscription billing

---

## Quick Start

### Prerequisites
- Node.js 20+
- Docker & Docker Compose

### Development Setup

```bash
# Clone and start infrastructure
git clone https://github.com/your-org/cerniq.git
cd cerniq
docker compose up -d postgres redis

# Backend (NestJS)
cd backend-node
cp ../.env.example .env    # Edit with your values
npm install
npx prisma migrate dev
npm run start:dev

# Frontend (Next.js + Bun) -- new terminal
cd frontend
bun install
bun run dev
```

### Using Make

```bash
make dev          # Start DB + backend + frontend
make prod         # Production Docker build
make test         # Backend unit tests
make test-e2e     # Playwright E2E tests
make migrate      # Run Prisma migrations
make health       # Check backend health
```

### Access
- **Frontend:** http://localhost:3001
- **Backend API:** http://localhost:3000
- **Health Check:** http://localhost:3000/health
- **API Status:** http://localhost:3000/api/status

---

## Architecture

```
                    Browser (cerniq.io)
                         |
              +----------+-----------+
              |                      |
     Vercel (Next.js 16)    API Rewrite (/api/*)
              |                      |
              +----------+-----------+
                         |
              Railway (NestJS 11)
              |          |         |
     +--------+    +-----+    +---+--------+
     |Prisma  |    |Redis|    |Stripe      |
     |Postgres|    |Cache|    |Resend      |
     +---------    +-----+    |Cloudflare  |
                              +------------+
```

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 16, React 19, Bun, Tailwind CSS, Recharts |
| Backend | NestJS 11, TypeScript, Prisma ORM, Socket.IO |
| Database | PostgreSQL (TimescaleDB image) |
| Cache | Redis 7 |
| Auth | Supabase + JWT + OAuth (Google, GitHub) |
| Billing | Stripe (checkout, subscriptions, webhooks) |
| Email | Resend (bilingual transactional emails) |
| Storage | Cloudflare R2 (report PDFs) |
| Deploy | Railway (backend) + Vercel (frontend) |

---

## API Surfaces

| Module | Endpoints | Auth | Description |
|--------|-----------|------|-------------|
| ALM Enterprise | 15 | JWT | Institutions, balance sheets, analysis runs, reports |
| ALM Stateless | 7 | Public | Stateless calculations (duration gap, NII, EVE, LCR, BPV) |
| Auth | 12 | Mixed | Register, login, OAuth, API keys, password reset |
| Billing | 5 | Mixed | Stripe checkout, webhooks, subscriptions, magic links |
| Risk | 8 | JWT | Monte Carlo, VaR, correlation, stress testing |
| Market Data | 5 | Public | Quotes, historical data, market health |
| Admin | 8 | Admin Key | Demo requests, prospects, pipeline, stats |

Full contract: [`docs/analysis/API_CONTRACT_REFERENCE.md`](docs/analysis/API_CONTRACT_REFERENCE.md)

---

## Testing

```bash
# Backend unit tests
cd backend-node && npm test

# E2E tests (Playwright -- 5 spec files, 38 tests)
cd frontend && bun run test:e2e

# Coverage report
cd backend-node && npm run test:cov
```

---

## Deployment

See [`docs/DEPLOYMENT_CHECKLIST.md`](docs/DEPLOYMENT_CHECKLIST.md) for the full production deploy guide.

```bash
# Backend to Railway
cd backend-node && railway up

# Frontend to Vercel
cd frontend && vercel --prod
```

---

## Documentation

| Document | Description |
|----------|-------------|
| [Deployment Checklist](docs/DEPLOYMENT_CHECKLIST.md) | Production deploy guide with all env vars |
| [API Contract Reference](docs/analysis/API_CONTRACT_REFERENCE.md) | 113 endpoints documented |
| [Drift Report](docs/analysis/DRIFT_REPORT.md) | Code vs. docs alignment analysis |
| [Demo Script](docs/demo/PABLO_DEMO_SCRIPT.md) | Sales demo walkthrough |
| [Pricing One-Pager](docs/demo/PRICING_ONE_PAGER.md) | Leave-behind for prospects |

---

## License

Proprietary -- KLYTICS LLC, San Juan, Puerto Rico.

---

**CERNIQ** -- ALM intelligence for the institutions that power Puerto Rico's economy.
