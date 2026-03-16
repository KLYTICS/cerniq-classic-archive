# CERNIQ Architecture

> System architecture, data flows, and infrastructure layout for the CERNIQ ALM platform.

---

## System Overview

CERNIQ is a three-tier web application with a Python microservice for outbound sales:

```
┌─────────────────────────────────────────────────────────────────┐
│                        INTERNET                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   ┌──────────────┐         ┌──────────────┐                    │
│   │   Vercel      │         │   Railway     │                   │
│   │  (Frontend)   │────────▶│  (Backend)    │                   │
│   │  Next.js 16   │  /api/* │  NestJS 11    │                   │
│   │  React 19     │ rewrite │  TypeScript   │                   │
│   └──────────────┘         └──────┬───────┘                    │
│                                    │                            │
│                    ┌───────────────┼────────────┐              │
│                    │               │             │              │
│              ┌─────┴─────┐  ┌─────┴─────┐ ┌────┴──────┐      │
│              │ PostgreSQL│  │   Redis    │ │ External  │      │
│              │ Timescale │  │   7-alpine │ │ Services  │      │
│              │   DB 15   │  │   Cache    │ │           │      │
│              └───────────┘  └───────────┘ │• Stripe   │      │
│                                           │• Resend   │      │
│                                           │• R2       │      │
│                                           │• Supabase │      │
│                                           │• OpenAI   │      │
│                                           │• Yahoo    │      │
│                                           └───────────┘      │
│                                                                 │
│   ┌──────────────────────┐                                     │
│   │  Outbound Engine     │ (Python / FastAPI)                  │
│   │  6 Autonomous Agents │                                     │
│   └──────────────────────┘                                     │
└─────────────────────────────────────────────────────────────────┘
```

---

## Component Architecture

### Frontend (Vercel)

| Aspect | Detail |
|--------|--------|
| Framework | Next.js 16 (App Router) |
| Runtime | React 19 with Server Components |
| Styling | Tailwind CSS 4, Framer Motion |
| State | Zustand (client), React Query (server) |
| Charts | Recharts, Plotly.js |
| WebSocket | Socket.IO client (real-time market data) |
| i18n | Custom ES/EN bilingual system |
| Auth | Cookie-based JWT, OAuth redirect flows |

### Backend (Railway)

| Aspect | Detail |
|--------|--------|
| Framework | NestJS 11 |
| Language | TypeScript 5.9, strict mode |
| ORM | Prisma 7 (PostgreSQL adapter) |
| Auth | JWT + Supabase + OAuth + API keys |
| Real-time | Socket.IO (WebSocket gateway) |
| Jobs | @nestjs/schedule (cron jobs) |
| Rate Limit | @nestjs/throttler |
| Validation | class-validator, class-transformer |
| File Upload | Multer |
| PDF Gen | PDFKit |

### Data Layer

| Component | Detail |
|-----------|--------|
| Primary DB | PostgreSQL 15 (TimescaleDB image) |
| Cache | Redis 7 (Alpine) |
| ORM | Prisma 7 with 30+ models |
| Migrations | Prisma Migrate (auto-generated SQL) |
| Seeds | TypeScript seed scripts (general + ALM demo) |

---

## Request Lifecycle

### Standard API Request

```
Browser → Vercel Edge → /api/* rewrite → Railway NestJS
    → Auth Guard (JWT verify) → Controller → Service → Prisma → PostgreSQL
    → Response → JSON back to browser
```

### ALM Report Generation

```
1. User uploads CSV via Portal
2. POST /api/portal/balance-sheet/upload
3. CSV parsed → validated → dry-run preview returned
4. User confirms → data imported to BalanceSheetItem table
5. POST /api/portal/reports/generate
6. ReportJob created (AWAITING_DATA → PROCESSING → GENERATING_PDF)
7. ALM engine runs: Duration Gap, NII, EVE, LCR, BPV, Monte Carlo
8. PDFKit generates bilingual PDF
9. PDF uploaded to Cloudflare R2
10. Presigned URL returned to user
11. Email notification sent via Resend
```

### Authentication Flow

```
Email/Password:
  Register → hash bcrypt → store User → issue JWT + refresh token

OAuth (Google/GitHub):
  Redirect → callback → verify with provider → upsert User → issue JWT

Supabase:
  Verify Supabase JWT → extract claims → match/create local User

API Key:
  X-API-Key header → SHA-256 hash → lookup in api_keys → attach User

Magic Link:
  Email → generate token → store MagicLink → user clicks → verify → issue JWT
```

---

## Data Flow Diagrams

### CSV → Report Pipeline

```
┌──────────┐    ┌───────────┐    ┌──────────────┐    ┌───────────┐
│  Upload  │───▶│ Validate  │───▶│  ALM Engine  │───▶│ PDF Gen   │
│  CSV     │    │ Parse     │    │              │    │ (PDFKit)  │
└──────────┘    │ Dry-run   │    │ Duration Gap │    └─────┬─────┘
                └───────────┘    │ NII Sens.    │          │
                                 │ EVE          │    ┌─────┴─────┐
                                 │ LCR          │    │  R2 Upload │
                                 │ BPV          │    │  (S3 API) │
                                 │ Monte Carlo  │    └─────┬─────┘
                                 └──────────────┘          │
                                                     ┌─────┴─────┐
                                                     │  Resend   │
                                                     │  Email    │
                                                     └───────────┘
```

### Billing Flow

```
┌──────────┐    ┌───────────┐    ┌───────────┐    ┌───────────┐
│ Pricing  │───▶│ Stripe    │───▶│ Webhook   │───▶│ Activate  │
│ Page     │    │ Checkout  │    │ Verify    │    │ Sub       │
└──────────┘    └───────────┘    └───────────┘    └───────────┘
```

---

## Infrastructure Layout

### Production

| Service | Host | Domain |
|---------|------|--------|
| Frontend | Vercel | cerniq.io |
| Backend | Railway | api.cerniq.io |
| Database | Railway (addon) | Internal connection |
| Redis | Railway (addon) | Internal connection |
| Storage | Cloudflare R2 | cerniq-reports bucket |
| Auth | Supabase | Project-specific |
| Payments | Stripe | Dashboard |
| Email | Resend | Dashboard |

### Development (Docker Compose)

| Service | Container | Port |
|---------|-----------|------|
| PostgreSQL | cerniq-db | 5433:5432 |
| Redis | cerniq-redis | 6380:6379 |
| Backend | cerniq-backend-node | 3000:3000 |
| Frontend | cerniq-frontend | 3001:3000 |

---

## CI/CD Pipeline

### GitHub Actions Workflows

#### `ci.yml` — Quick Check (on push/PR to main)
1. **Backend Typecheck** — `npx tsc --noEmit`
2. **Frontend Build** — `npx next build`
3. **Prisma Validate** — `npx prisma validate`

#### `ci-cd.yml` — Full Pipeline
- Extended checks, build, deploy triggers

### Deploy Commands
```bash
# Backend → Railway
cd backend-node && railway up

# Frontend → Vercel
cd frontend && vercel --prod

# Full deploy
make deploy
```

---

## Security Architecture

| Layer | Implementation |
|-------|---------------|
| Transport | HTTPS everywhere (Vercel/Railway TLS) |
| Auth | JWT (HS256, 24h expiry) + refresh tokens (7d) |
| Password | bcrypt (10 rounds) |
| API Keys | SHA-256 hashing, pepper |
| CORS | Strict origin allowlist |
| Rate Limiting | @nestjs/throttler (100/min, 20 burst) |
| Cookies | httpOnly, secure, sameSite=lax |
| CSV Data | AES-256-GCM encryption at rest, purged after 90 days |
| Headers | Helmet middleware |
| Audit | Full audit log (OCIF compliant) |

See [security/security_audit_v1.md](security/security_audit_v1.md) for the detailed security review.
