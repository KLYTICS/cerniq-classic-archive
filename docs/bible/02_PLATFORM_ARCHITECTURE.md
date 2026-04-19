# Part II — Platform Architecture

> **Audience:** Engineering (all), DevOps
> **Last updated:** April 2026

---

## 2.1 System Overview

CERNIQ is a three-tier distributed system with a separate Python microservice for autonomous outbound sales intelligence. The architecture enforces strict separation between ALM computation, web delivery, and native client concerns.

```
┌──────────────────────────────────────────────────────────────────┐
│                          CLIENTS                                 │
│                                                                  │
│   Browser (cerniq.io)    macOS App    iOS App                   │
│         │                    │            │                      │
│         └──────────┬─────────┘            │                      │
│                    │  (WKWebView for       │                      │
│                    │   web routes)         │                      │
└────────────────────┼─────────────────────-┘                      │
                     │
          ┌──────────▼────────────┐
          │   Vercel CDN           │
          │   Next.js 16           │
          │   React 19             │
          │   App Router           │
          │   100+ routes          │
          └──────────┬────────────┘
                     │  /api/* rewrite (Edge)
          ┌──────────▼────────────┐
          │   Railway              │
          │   NestJS 11            │
          │   TypeScript 5.9       │
          │   28+ modules          │
          └──────┬────────┬───────┘
                 │        │
       ┌─────────▼──┐  ┌──▼──────────┐  ┌─────────────────────┐
       │ PostgreSQL  │  │  Redis 7    │  │  External SaaS      │
       │ 15 (TS DB) │  │  Alpine     │  │                     │
       │ Prisma 7   │  │  Cache      │  │  Stripe  (billing)  │
       └────────────┘  └─────────────┘  │  Resend  (email)    │
                                        │  R2      (storage)  │
                                        │  Supabase (auth)    │
                                        │  OpenAI  (LLM)      │
                                        │  Yahoo   (market)   │
                                        └─────────────────────┘

┌─────────────────────────────────────┐
│  Outbound Sales Engine (separate)   │
│  Python 3 · FastAPI                 │
│  6 Autonomous Agents                │
│  YAML-orchestrated pipeline         │
└─────────────────────────────────────┘
```

---

## 2.2 Technology Stack — Complete Matrix

| Layer | Technology | Version | Role |
|-------|-----------|---------|------|
| **Frontend** | Next.js (App Router) | 16.2.1 | SSR + SSG + client-side routing |
| **Frontend** | React | 19.2.3 | UI rendering, Server Components |
| **Frontend** | Tailwind CSS | 4.x | Utility-first styling |
| **Frontend** | Zustand | latest | Global client state management |
| **Frontend** | Recharts / Plotly.js | latest | Financial chart visualization |
| **Frontend** | Socket.IO client | latest | Real-time market data streaming |
| **Frontend** | Framer Motion | latest | UI animations |
| **Backend** | NestJS | 11.x | Modular API framework (28+ modules) |
| **Backend** | TypeScript | 5.9 | Strict-mode type safety throughout |
| **Backend** | Prisma ORM | 7.x | Database access + schema management |
| **Backend** | Socket.IO | latest | WebSocket gateway for real-time |
| **Backend** | @nestjs/schedule | latest | Cron jobs + background job runner |
| **Backend** | @nestjs/throttler | latest | Rate limiting on auth endpoints |
| **Backend** | class-validator | latest | DTO validation pipeline |
| **Backend** | PDFKit | latest | Bilingual PDF report generation |
| **Database** | PostgreSQL | 15 (TimescaleDB) | Primary relational store |
| **Cache** | Redis | 7 Alpine | Sessions, rate limits, job queues |
| **Auth** | Supabase + JWT | latest | Auth orchestration + OAuth delegation |
| **Storage** | Cloudflare R2 | S3-compatible | Report PDF storage + presigned URLs |
| **Billing** | Stripe | latest | Checkout, subscriptions, webhooks |
| **Email** | Resend | latest | Bilingual transactional email |
| **AI/LLM** | OpenAI GPT-4o | latest | ALM narrative insight generation |
| **AI/LLM** | Ollama | local | Fallback when OpenAI unavailable |
| **macOS/iOS** | SwiftUI | Swift 6.3 | Native Apple platform UI |
| **macOS/iOS** | WKWebView | latest | Embedded web portal bridge |
| **macOS/iOS** | Security framework | latest | Keychain credential storage |
| **Sales Engine** | Python 3 + FastAPI | 3.11+ | Autonomous outbound sales agents |
| **DevOps** | GitHub Actions | latest | CI/CD (typecheck, build, validate) |
| **DevOps** | Railway | latest | Backend deployment + managed DB |
| **DevOps** | Vercel | latest | Frontend deployment + CDN + edge |
| **DevOps** | Docker Compose | 24+ | Local development environment |

---

## 2.3 Request Lifecycle

### Standard API Request

```
Client (browser or native app)
  │
  ├─ HTTPS request to cerniq.io
  │
  ▼
Vercel Edge
  │
  ├─ Static assets served directly from CDN
  │
  ├─ /api/* paths → proxy to api.cerniq.io (Railway)
  │
  ▼
NestJS Global Pipes
  │
  ├─ ValidationPipe (class-validator) → validates + transforms DTO
  │
  ▼
Auth Guards
  │
  ├─ JWT Guard → verify RS256 signature, extract user context
  ├─ Supabase Guard → verify Supabase JWT claims
  ├─ API Key Guard → SHA-256 hash lookup in api_keys table
  │
  ▼
Controller
  │
  ├─ Delegates to Service layer
  │
  ▼
Service Layer
  │
  ├─ Prisma → PostgreSQL (read/write)
  ├─ Redis → Cache read (hit) or write (miss)
  ├─ External SaaS calls (Stripe, R2, OpenAI, Resend)
  │
  ▼
Response
  │
  └─ JSON envelope: { success: true, data: {...} }
               or: { success: false, error: { message: "..." } }
```

---

### ALM Report Generation Pipeline (10 steps)

```
Step 1  User uploads balance-sheet CSV via /portal/submit
Step 2  POST /api/portal/balance-sheet/upload
          → CSV parsed with Papaparse-equivalent
          → rows validated (required columns, numeric ranges)
          → dry-run preview returned (no DB write yet)
Step 3  User reviews preview, confirms submission
          → balance sheet data imported to BalanceSheetItem table
          → IngestionLog record created
Step 4  POST /api/portal/reports/generate
          → ReportJob created { status: AWAITING_DATA }
Step 5  Background job runner picks up task
          → status transitions: AWAITING_DATA → PROCESSING
Step 6  ALM Engine runs 62 modules:
          → Duration Gap, NII Sensitivity, EVE, LCR, BPV
          → Monte Carlo (10,000 paths, Vasicek model)
          → COSSEC compliance assessment
          → All results stored in AnalysisRun records (JSON)
Step 7  PDFKit renders bilingual (ES/EN) 14-page PDF
          → status transitions: PROCESSING → GENERATING_PDF
Step 8  PDF uploaded to Cloudflare R2 (cerniq-reports bucket)
          → r2Key stored on ReportJob
          → 7-day presigned URL generated
Step 9  ReportJob updated:
          → status: GENERATING_PDF → COMPLETE
          → presignedUrl + expiresAt stored
Step 10 Notifications dispatched:
          → Resend: bilingual email to institution user
          → WebSocket (Socket.IO): push to connected browser/app session
          → APNs (future): push notification to iOS app
```

---

### Authentication Flow Reference

```
Email/Password:
  POST /api/auth/login
  → bcrypt.compare(password, passwordHash)
  → issue JWT (access, 15min) + refresh token (7 days)
  → store RefreshToken in DB

OAuth (Google / GitHub):
  GET /api/auth/google → redirect to provider
  → callback: verify provider token
  → upsert User (provider + providerId unique)
  → issue JWT + refresh token

Supabase JWT:
  X-Supabase-JWT header
  → verify RS256 signature against Supabase public key
  → extract sub claim → match/create local User

API Key:
  X-API-Key header
  → SHA-256 hash → lookup api_keys table (keyHash)
  → verify not revoked + not expired
  → attach User context

Magic Link:
  POST /api/auth/magic-link → generate secure token
  → store MagicLink { tokenHash, expiresAt }
  → Resend delivers link to email
  → GET /api/auth/magic-link/verify?token=...
  → tokenHash match → mark usedAt → issue JWT

Cookie Session (WKWebView):
  Browser session cookie from web login
  → WKWebView inherits cookie automatically
  → no explicit token management needed in Swift
```

---

## 2.4 Production Infrastructure

| Service | Provider | Domain | Scaling Model |
|---------|----------|--------|---------------|
| Frontend | Vercel | cerniq.io | Serverless auto-scaling; global CDN |
| Backend API | Railway | api.cerniq.io | Container; vertical + horizontal replicas |
| PostgreSQL | Railway (TimescaleDB 15) | Internal | Managed; point-in-time recovery |
| Redis | Railway (Redis 7 Alpine) | Internal | Managed; AOF persistence |
| Report Storage | Cloudflare R2 | cerniq-reports bucket | S3-compatible; no egress fees |
| Auth | Supabase | Project-specific | Managed; RS256 JWT signing |
| Payments | Stripe | stripe.com | Webhook-driven; test → live via ENV |
| Email | Resend | resend.com | SPF/DKIM on cerniq.io domain |
| AI/LLM | OpenAI API | api.openai.com | Pay-per-token; GPT-4o; Ollama fallback |

---

## 2.5 Data Flow — CSV to Report

```
┌──────────┐    ┌───────────┐    ┌──────────────┐    ┌───────────┐
│  Upload  │───▶│ Validate  │───▶│  ALM Engine  │───▶│ PDF Gen   │
│  CSV     │    │ Parse     │    │              │    │ (PDFKit)  │
└──────────┘    │ Dry-run   │    │ Duration Gap │    └─────┬─────┘
                └───────────┘    │ NII Sens.    │          │
                                 │ EVE          │    ┌─────▼─────┐
                                 │ LCR / NSFR   │    │  R2 Upload│
                                 │ BPV          │    │  Presigned│
                                 │ Monte Carlo  │    └─────┬─────┘
                                 │ COSSEC Check │          │
                                 └──────────────┘    ┌─────▼─────┐
                                                     │  Resend   │
                                                     │  Email    │
                                                     │  + APNs   │
                                                     └───────────┘
```

---

*KLYTICS LLC · Proprietary & Confidential · cerniq.io*
