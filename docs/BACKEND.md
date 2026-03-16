# CERNIQ Backend Reference

> Complete reference for all 28 NestJS backend modules in `backend-node/src/`.

---

## Overview

The backend is a **NestJS 11** application written in TypeScript 5.9. It uses Prisma 7 as the ORM, Redis for caching, and exposes both REST and WebSocket APIs.

**Entry point:** `src/main.ts`
**App module:** `src/app.module.ts`
**Base URL:** `http://localhost:3000` (dev) / `https://api.cerniq.io` (prod)

---

## Module Reference

### Core Application

#### `app.module.ts`
Root module that imports all feature modules. Configures:
- Global config (`@nestjs/config`)
- Throttler (rate limiting)
- Schedule (cron jobs)
- All feature modules

#### `app.controller.ts` (12 KB)
Root controller with top-level routes:
- `GET /health` — health check with DB/Redis status
- `GET /api/status` — detailed API status
- Admin endpoints for demo requests, prospects, pipeline stats

#### `prisma.module.ts` / `prisma.service.ts`
Global Prisma client with connection management and graceful shutdown.

---

### ALM Engine (`alm/`)

The core product — Asset-Liability Management calculations.

| Capability | Description |
|-----------|-------------|
| Duration Gap | Interest rate risk at ±100, ±200, ±300 bps shocks |
| NII Sensitivity | Net interest income impact modeling |
| EVE | Economic Value of Equity under rate scenarios |
| LCR | Liquidity Coverage Ratio (Basel III) |
| BPV | Basis Point Value per 1bp rate change |
| Monte Carlo | 1,000 rate-path simulations, 4 scenarios |
| COSSEC Compliance | Puerto Rico regulatory checks |

**Two API surfaces:**
1. **Enterprise** (JWT required) — institution-scoped, persisted analysis runs
2. **Stateless** (public) — pass data in, get calculations back

---

### Authentication (`auth/`)

Multi-provider authentication system supporting:

| Provider | Flow |
|----------|------|
| Email/Password | Register → bcrypt hash → JWT + refresh token |
| Google OAuth | `passport-google-oauth20` redirect flow |
| GitHub OAuth | `passport-github2` redirect flow |
| Supabase | Verify Supabase JWT → local user sync |
| API Keys | `X-API-Key` header → SHA-256 lookup |
| Magic Links | Token-based passwordless auth via email |
| Password Reset | Token → email → new password |

**Guards:** JwtAuthGuard, ApiKeyGuard, AdminKeyGuard
**Decorators:** `@CurrentUser()`, `@Public()`

---

### Billing (`billing/`)

Stripe integration for SaaS subscription management.

| Feature | Implementation |
|---------|---------------|
| Checkout | Stripe Checkout Sessions (one-time + recurring) |
| Subscriptions | 4 tiers: free, one_time, monthly, annual, partner |
| Webhooks | `checkout.session.completed`, subscription events |
| Magic Links | Post-payment auto-login via magic link |
| Paywall | Subscription tier checks before report generation |

---

### Portal (`portal/`)

Client-facing portal for institution management.

| Endpoint | Purpose |
|----------|---------|
| Institutions | CRUD for financial institutions |
| Balance Sheets | CSV upload, validate, dry-run, import |
| Reports | Generate, list, download ALM reports |
| Analysis Runs | Trigger and track analysis executions |
| Ingestion Logs | Audit trail of data imports |

---

### Risk Analytics (`risk/`)

Advanced risk calculation engine.

| Feature | Description |
|---------|-------------|
| Monte Carlo | 1,000 simulated rate paths with configurable parameters |
| VaR | Value at Risk (historical, parametric, Monte Carlo) |
| Correlation | Asset correlation matrices |
| Stress Testing | Predefined + custom stress scenarios |

---

### Market Data (`market-data/`)

Real-time and historical market data via Yahoo Finance.

| Feature | Tech |
|---------|------|
| Quotes | Yahoo Finance 2 API |
| Historical | OHLCV data with date ranges |
| Market Health | Aggregate market indicators |
| Caching | Redis (configurable TTL) |

---

### Email (`email/`)

Transactional email system via Resend.

| Template | Trigger |
|----------|---------|
| Welcome | Post-registration |
| Report Ready | Report generation complete |
| Magic Link | Passwordless / post-payment login |
| Password Reset | Password reset request |

All templates are **bilingual (ES/EN)** based on user's `preferredLanguage`.

---

### Storage (`storage/`)

File storage via Cloudflare R2 (S3-compatible).

| Operation | Use |
|-----------|-----|
| Upload | Generated PDF reports |
| Download | Presigned URL (5 min expiry) |
| Delete | Report lifecycle cleanup |

---

### Additional Modules

| Module | Purpose |
|--------|---------|
| `analytics/` | Usage analytics and metrics tracking |
| `audit/` | OCIF-compliant audit logging (all user actions) |
| `cache/` | Redis cache service (get/set/del with TTL) |
| `common/` | Shared utilities, decorators, filters |
| `crypto/` | AES-256-GCM encryption for CSV data at rest |
| `dto/` | Shared Data Transfer Objects |
| `execution/` | Background job execution engine |
| `expenses/` | SpendCheck expense tracking (legacy) |
| `feedback/` | NPS and user feedback collection |
| `jobs/` | Scheduled job management (@nestjs/schedule) |
| `leads/` | Sales lead pipeline CRUD and stats |
| `llm/` | OpenAI / Ollama integration for AI insights |
| `options/` | Options analytics calculations |
| `organizations/` | Multi-tenant organization management |
| `pipeline/` | Market data pipeline (batch ticker processing) |
| `portfolio/` | Investment portfolio management |
| `realtime/` | WebSocket gateway (Socket.IO) for live data |
| `security/` | Security middleware, helmet config |
| `ticker/` | Ticker/asset management |
| `valuation/` | Cyclical and DCF valuation models |

---

## Key Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `@nestjs/core` | 11.0 | Framework |
| `@prisma/client` | 7.3 | ORM |
| `stripe` | 20.4 | Billing |
| `resend` | 6.9 | Email |
| `@aws-sdk/client-s3` | 3.987 | R2 storage |
| `pdfkit` | 0.17 | PDF generation |
| `openai` | 6.21 | AI insights |
| `yahoo-finance2` | 3.13 | Market data |
| `ioredis` | 5.9 | Redis client |
| `bcrypt` | 6.0 | Password hashing |
| `passport` | 0.7 | Auth strategies |
| `csv-parser` | 3.2 | CSV parsing |

---

## Running the Backend

```bash
cd backend-node

# Development
npm run start:dev        # Watch mode
npm run start:debug      # Debug mode

# Production
npm run build
npm run start:prod

# Testing
npm test                 # Unit tests
npm run test:cov         # Coverage
npm run test:e2e         # Integration tests

# Database
npx prisma migrate dev   # Apply migrations
npx prisma studio        # Visual DB browser
npx prisma db seed       # Seed data
```
