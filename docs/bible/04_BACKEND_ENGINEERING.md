# Part IV — Backend Engineering Reference

> **Audience:** Backend Engineers, Tech Leads
> **Last updated:** April 2026

---

## 4.1 Overview

The CERNIQ backend is a **NestJS 11 monolith** with 28+ domain modules. It follows strict SOLID principles, TypeScript strict mode (`tsconfig.strict.json`), Prisma 7 as the ORM, and Socket.IO for real-time capabilities.

**Entry point:** `backend-node/src/main.ts`
**App module:** `backend-node/src/app.module.ts` (wires all 28+ modules)

---

## 4.2 Module Catalog

| Module | Directory | Auth | Primary Function |
|--------|-----------|------|-----------------|
| `auth` | `src/auth/` | Mixed | JWT login, OAuth (Google/GitHub), Supabase JWT, API keys, magic links, password reset |
| `alm` | `src/alm/` | JWT | ALM enterprise: institutions, balance sheets, analysis runs, board reports — 62 calculation modules |
| `portal` | `src/portal/` | JWT | Client portal: CSV upload, report job management, ingestion logs, presigned URL delivery |
| `risk` | `src/risk/` | JWT | Monte Carlo (10K paths, Vasicek), VaR, correlation matrix, stress testing, FRTB-IMA |
| `billing` | `src/billing/` | Mixed | Stripe checkout sessions, subscription webhooks, plan management |
| `market-data` | `src/market-data/` | Public | Yahoo Finance quotes, historical data, market health status |
| `email` | `src/email/` | Internal | Resend bilingual transactional email delivery (ES/EN templates) |
| `storage` | `src/storage/` | Internal | Cloudflare R2 file storage, presigned URL generation |
| `leads` | `src/leads/` | Admin Key | Lead CRUD, pipeline stage management, pipeline stats |
| `admin` | `src/admin/` | Admin Key | Demo requests, prospects, pipeline management, aggregate metrics |
| `realtime` | `src/realtime/` | JWT | Socket.IO gateway for live market data streaming |
| `realtime-alm` | `src/realtime-alm/` | JWT | Socket.IO for ALM pipeline progress updates |
| `swarm` | `src/swarm/` | Internal | AI agent orchestration infrastructure |
| `intelligence` | `src/intelligence/` | JWT | LLM-powered workspace intelligence runs and actions |
| `compliance` | `src/compliance/` | JWT | COSSEC compliance registry + exam prep |
| `compliance-registry` | `src/compliance-registry/` | JWT | Compliance rule versioning and registry |
| `cossec` | `src/cossec/` | JWT | COSSEC-specific regulatory automation for PR cooperativas |
| `ncua` | `src/ncua/` | JWT | NCUA Form 5300 automation |
| `organizations` | `src/organizations/` | JWT | Multi-tenant organization management, member roles |
| `portfolio` | `src/portfolio/` | JWT | Black-Litterman, HRP, Capital Optimizer, CVaR, VaR analytics |
| `telemetry` | `src/telemetry.ts` | Internal | OpenTelemetry tracing setup |
| `observability` | `src/observability/` | Internal | OTEL agent, observability pipeline |
| `jobs` | `src/jobs/` | Internal | Background job processor |
| `queue` | `src/queue/` | Internal | Queue management |
| `analytics` | `src/analytics/` | JWT | Usage analytics, feature adoption metrics |
| `growth` | `src/growth/` | Admin Key | Growth metrics, conversion funnel analytics |
| `ai` | `src/ai/` | JWT | OpenAI integration layer |
| `ai-advisor` | `src/ai-advisor/` | JWT | Conversational ALM advisor |
| `llm` | `src/llm/` | JWT | LLM client + routing (OpenAI → Ollama fallback) |
| `model-registry` | `src/model-registry/` | Internal | Version-controlled ALM model registry |
| `fine-tune` | `src/fine-tune/` | Internal | OpenAI fine-tuning pipeline |
| `security` | `src/security/` | Admin | Security audit logging + threat monitoring |
| `notifications` | `src/notifications/` | JWT | Cross-channel notification delivery |
| `valuation` | `src/valuation/` | JWT | Instrument valuation, options pricing, ticker data |
| `ticker` | `src/ticker/` | Public | Ticker data access |
| `enterprise` | `src/enterprise/` | JWT | Enterprise-tier feature management |
| `governance` | `src/governance/` | JWT | Governance audit trail |
| `audit` | `src/audit/` | Admin | Audit log access |
| `expenses` | `src/expenses/` | JWT | Expense tracking (SpendCheck module) |
| `close` | `src/close/` | JWT | Period close cycle management |

---

## 4.3 API Surface

| Module | Endpoints | Auth | Key Routes |
|--------|-----------|------|-----------|
| ALM Enterprise | 15 | JWT | `GET /api/alm/institutions`, `POST /api/alm/institutions`, `GET /api/alm/:id/summary`, `POST /api/alm/runs` |
| ALM Stateless | 7 | Public | `POST /api/alm/stateless/duration-gap`, `/nii`, `/eve`, `/lcr`, `/bpv` |
| Auth | 12 | Mixed | `POST /api/auth/login`, `/register`, `/refresh`, `/logout`, `/magic-link`, `/password-reset`, `GET /api/auth/profile`, `/api/auth/google`, `/api/auth/github` |
| Billing | 5 | Mixed | `POST /api/billing/checkout`, `GET /api/billing/portal`, `POST /api/billing/webhook`, `GET /api/billing/subscription` |
| Portal | 6 | JWT | `POST /api/portal/balance-sheet/upload`, `POST /api/portal/reports/generate`, `GET /api/portal/reports`, `GET /api/portal/settings`, `GET /api/portal/ingestion-logs` |
| Risk | 8 | JWT | `POST /api/risk/monte-carlo`, `/var`, `/correlation`, `/stress-test`, `/scenario` |
| Market Data | 5 | Public | `GET /api/market-data/quote/:ticker`, `/historical/:ticker`, `/health` |
| Admin | 8 | Admin Key | `GET /api/admin/leads`, `/prospects`, `/pipeline`, `/metrics`, `/demo-requests` |
| Leads | 4 | Admin Key | `GET /api/leads`, `POST /api/leads`, `PATCH /api/leads/:id`, `GET /api/leads/stats` |

Full API contract: `docs/analysis/API_CONTRACT_REFERENCE.md`

---

## 4.4 Response Envelope Standard

All API responses must conform to:
```json
// Success
{ "success": true, "data": { ... } }

// Error
{ "success": false, "error": { "message": "Human-readable error" } }
```

The Swift `CerniqAPIClient` handles both wrapped and direct-payload responses via two-pass decoding.

---

## 4.5 Authentication Architecture

| Method | Flow | Session Type | Guard |
|--------|------|-------------|-------|
| Email/Password | POST /api/auth/login → bcrypt verify → JWT + refresh | Token-backed | `JwtAuthGuard` |
| OAuth Google | GET /api/auth/google → provider callback → upsert User → JWT | Token-backed | `GoogleOAuthGuard` |
| OAuth GitHub | GET /api/auth/github → provider callback → upsert User → JWT | Token-backed | `GithubOAuthGuard` |
| Supabase JWT | `X-Supabase-JWT` header → RS256 verify → match User | Token-backed | `SupabaseAuthGuard` |
| API Key | `X-API-Key` header → SHA-256 hash → api_keys lookup | Stateless | `ApiKeyGuard` |
| Magic Link | Email token → verify → issue JWT | Token-backed | `MagicLinkGuard` |
| Cookie Session | WKWebView / browser cookie — no explicit token | Cookie-backed | `SessionGuard` |

**JWT configuration:**
- Access token: short-lived (15 minutes)
- Refresh token: long-lived (7 days), stored in `refresh_tokens` table, revocable
- Algorithm: RS256 via Supabase (production), HS256 via `JWT_SECRET` (development)

---

## 4.6 Database Schema — Core Models

All models in `backend-node/prisma/schema.prisma`. Using Prisma 7 with PostgreSQL 15.

### User
```prisma
model User {
  id            String          @id @default(uuid()) @db.Uuid
  email         String          @unique
  name          String?
  passwordHash  String?
  emailVerified Boolean         @default(false)
  provider      String          @default("email")
  providerId    String?
  role          InstitutionRole @default(OWNER) // OWNER | ANALYST | VIEWER
  lastLoginAt   DateTime?
  createdAt     DateTime        @default(now())
  updatedAt     DateTime        @updatedAt
  
  // Relations
  subscription  Subscription?
  reportJobs    ReportJob[]
  apiKeys       ApiKey[]
  magicLinks    MagicLink[]
  refreshTokens RefreshToken[]
  workspaces    Workspace[]
  analysisRuns  AnalysisRun[]
  ingestionLogs IngestionLog[]
  // ... more

  @@unique([provider, providerId])
  @@map("users")
}
```

### ReportJob (critical for Apple push notification flow)
```prisma
model ReportJob {
  id            String   @id @default(uuid()) @db.Uuid
  userId        String   @db.Uuid
  institutionId String   @db.Uuid
  status        ReportJobStatus  // AWAITING_DATA | PROCESSING | GENERATING_PDF | COMPLETE | FAILED
  r2Key         String?          // Cloudflare R2 object key
  presignedUrl  String?          // 7-day signed URL
  expiresAt     DateTime?
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  
  user        User        @relation(...)
  institution Institution @relation(...)
}
```

### ApiKey (used by iOS app API key auth mode)
```prisma
model ApiKey {
  id         String    @id @default(cuid())
  userId     String    @db.Uuid
  name       String
  keyPrefix  String    // First 8 chars (shown in UI for identification)
  keyHash    String    @unique // SHA-256 hash of full key
  lastUsedAt DateTime?
  revokedAt  DateTime?
  expiresAt  DateTime?
  createdAt  DateTime  @default(now())
}
```

---

## 4.7 Code Quality Standards

### TypeScript Strict Mode
Every file must pass `tsc --noEmit` with:
```json
{
  "strict": true,
  "noImplicitAny": true,
  "strictNullChecks": true,
  "noUncheckedIndexedAccess": true
}
```

No `any` without `// @ts-expect-error` with justification. All function params + return types explicitly typed.

### Module Design Pattern
```typescript
@Module({
  imports: [PrismaModule, ConfigModule],
  providers: [AlmService, AlmCalculationService],
  controllers: [AlmController],
  exports: [AlmService], // Only export public service
})
export class AlmModule {}
```

Each module owns one business domain. Two modules needing the same service → create a shared module.

### Prisma Migration Protocol
1. Schema changes start in `prisma/schema.prisma`
2. `npx prisma migrate dev --name <feature_name>` → generates SQL migration
3. Migrations are **immutable** — never edit existing migration files
4. `npx prisma validate` in CI catches schema errors before deploy
5. `npx prisma generate` regenerates TypeScript types from schema

---

## 4.8 Key Scripts

```bash
# Development
cd backend-node
npm run start:dev                    # Hot-reload NestJS server on :3000

# Database
npx prisma migrate dev               # Apply migrations + generate client
npx prisma studio                    # GUI on :5555
npm run seed:portal-submit           # Provision test user, sub, report job, magic link, CSV fixture

# Testing
npm test                             # Jest unit tests
npm run test:cov                     # Coverage report → coverage/

# Build & Verify
npm run build                        # Compile TypeScript to dist/
npx tsc --noEmit                     # Type check only (no emit)
npx prisma validate                  # Schema integrity check
npx eslint "{src,apps,libs,test}/**/*.ts"  # Lint

# Deploy
railway up                           # Deploy to Railway
```

---

## 4.9 Error Handling Contract

All errors thrown in services must propagate as NestJS HTTP exceptions:
```typescript
throw new NotFoundException('Institution not found')
throw new UnauthorizedException('Invalid credentials')
throw new BadRequestException('CSV validation failed: missing column "assets"')
throw new InternalServerErrorException('R2 upload failed')
```

Global exception filter formats all errors into the standard envelope:
```json
{ "success": false, "error": { "message": "...", "statusCode": 404 } }
```

---

*KLYTICS LLC · Proprietary & Confidential · cerniq.io*
