# Part VIII — DevOps, CI/CD & Infrastructure

> **Audience:** DevOps, Platform Engineers, SRE
> **Last updated:** April 2026

---

## 8.1 CI/CD Pipeline Overview

All CI/CD runs on **GitHub Actions**. Two workflows:

```
.github/workflows/
├── ci.yml      ← Quick check on every push/PR to main
└── deploy.yml  ← Full verify + deploy on merge to main
```

---

## 8.2 ci.yml — Quick Check

**Trigger:** Every push to any branch + every PR targeting `main`
**Time target:** < 5 minutes

```yaml
jobs:
  backend-typecheck:
    - cd backend-node && npx tsc --noEmit

  frontend-build:
    - cd frontend && npx next build

  prisma-validate:
    - cd backend-node && npx prisma validate
```

**What this catches:**
- TypeScript compilation errors in backend (strict mode)
- Next.js SSR compilation failures (catches RSC import errors, missing types)
- Prisma schema violations (invalid model definitions, missing `@relation` fields)

---

## 8.3 deploy.yml — Full Verify + Deploy

**Trigger:** Merge to `main` branch
**Time target:** < 20 minutes

```yaml
jobs:
  verify-frontend:
    - cd frontend && npm run lint
    - cd frontend && npx vitest run
    - cd frontend && npm run test:coverage
    - cd frontend && npx next build
    - npm run verify:clean           # No uncommitted files

  verify-backend:
    - cd backend-node && npx eslint "{src,apps,libs,test}/**/*.ts" --quiet
    - cd backend-node && npx tsc --noEmit
    - cd backend-node && npx prisma validate
    - cd backend-node && npm test
    - cd backend-node && npm run build
    - npm run verify:clean

  e2e-critical:
    needs: [verify-frontend, verify-backend]
    - npm run deploy:prepare          # Clean .next, test artifacts
    - cd frontend && npm run test:e2e:critical

  deploy-backend:
    needs: [e2e-critical]
    - cd backend-node && railway up

  deploy-frontend:
    needs: [e2e-critical]
    - cd frontend && vercel --prod
```

**The `verify:clean` gate:**
```bash
# scripts/verify-clean-worktree.sh
if [ -n "$(git status --porcelain)" ]; then
  echo "ERROR: Uncommitted files detected before deploy"
  git status
  exit 1
fi
```
Prevents accidental `.env`, generated file, or build artifact leakage into production.

---

## 8.4 Apple Platform CI (Current + Next Phase)

### Current (Swift CLT only — no full Xcode)
```bash
# Runs in ci.yml as a job (macOS runner required)
- cd apple && swift build
- cd apple && swift run CerniqContractsCheck
```

Expected output: `"CerniqContractsCheck passed"`

### Next Phase (Full Xcode — requires macOS GitHub Actions runner)
```yaml
- xcodebuild -scheme "CERNIQ macOS"
              -destination "platform=macOS"
              -configuration Release
              build

- xcodebuild -scheme "CERNIQ iOS"
              -destination "platform=iOS Simulator,name=iPhone 16 Pro,OS=18.0"
              -configuration Debug
              test

# Notarize for direct distribution
- xcrun notarytool submit CERNIQ.app.zip
        --apple-id ${{ secrets.APPLE_ID }}
        --password ${{ secrets.APPLE_APP_PASSWORD }}
        --team-id ${{ secrets.TEAM_ID }}
        --wait
```

**Fastlane integration (recommended):**
```ruby
# Fastfile
lane :beta do
  match(type: "appstore")          # Fetch/create signing certs
  gym(scheme: "CERNIQ macOS")      # Build
  pilot(distribute_external: true) # TestFlight upload
end

lane :release do
  match(type: "appstore")
  gym(scheme: "CERNIQ macOS", configuration: "Release")
  deliver                          # App Store Connect upload
end
```

---

## 8.5 Production Infrastructure

### Topology

```
DNS (Cloudflare)
├── cerniq.io     → Vercel (Frontend CDN)
└── api.cerniq.io → Railway (Backend container)

Railway project: cerniq
├── Service: backend-node      → api.cerniq.io
│   ├── Addon: PostgreSQL 15   → internal DATABASE_URL
│   └── Addon: Redis 7         → internal REDIS_URL
└── (Future) Service: outbound-engine → internal

Cloudflare
└── R2 bucket: cerniq-reports  → presigned URLs for PDF delivery

Third-party SaaS
├── Supabase Project           → JWT signing + user auth
├── Stripe Account             → billing + webhooks
├── Resend                     → transactional email
└── OpenAI                     → GPT-4o API
```

### Service Configuration

| Service | Provider | Scaling | SLA Target |
|---------|----------|---------|-----------|
| Frontend | Vercel Pro | Auto-scale (serverless) | 99.9% |
| Backend API | Railway | 1 vCPU / 512MB base; scale to 4 vCPU / 2GB on demand | 99.5% |
| PostgreSQL | Railway (TimescaleDB) | 1 vCPU / 1GB, 10GB storage | 99.5% |
| Redis | Railway (Alpine) | 256MB in-memory + AOF persistence | 99.5% |
| R2 Storage | Cloudflare | Auto-scale object storage; 0 egress fees | 99.9% |
| Supabase | Supabase | Managed; RS256 JWT | 99.9% |

---

## 8.6 Docker Compose — Local Development

```yaml
# docker-compose.yml
services:
  postgres:
    image: timescale/timescaledb:latest-pg15
    container_name: cerniq-db
    ports: ["5433:5432"]
    environment:
      POSTGRES_DB: cerniq
      POSTGRES_USER: cerniq
      POSTGRES_PASSWORD: cerniq_dev
    volumes: [postgres_data:/var/lib/postgresql/data]

  redis:
    image: redis:7-alpine
    container_name: cerniq-redis
    ports: ["6380:6379"]
    command: redis-server --appendonly yes

  backend:
    build: ./backend-node
    container_name: cerniq-backend-node
    ports: ["3000:3000"]
    depends_on: [postgres, redis]
    environment:
      DATABASE_URL: postgresql://<user>@postgres:5432/cerniq
      REDIS_URL: redis://redis:6379
    volumes: [./backend-node:/app, /app/node_modules]

  frontend:
    build: ./frontend/Dockerfile.dev
    container_name: cerniq-frontend
    ports: ["3001:3000"]
    depends_on: [backend]
    volumes: [./frontend:/app, /app/node_modules, /app/.next]
```

**Access points:**
| Service | Local URL |
|---------|-----------|
| Frontend | http://localhost:3001 |
| Backend API | http://localhost:3000 |
| Health check | http://localhost:3000/health |
| API status | http://localhost:3000/api/status |
| Prisma Studio | http://localhost:5555 |

---

## 8.7 Environment Variable Architecture

Three ENV tiers across all services:

| File | Committed | Purpose |
|------|-----------|---------|
| `.env` | ❌ (gitignored) | Developer-specific local values |
| `.env.example` | ✅ | Template with all required keys, no secrets |
| `.env.production.template` | ✅ | Production Railway/Vercel variable names |

### Critical Variables Reference

| Variable | Service | Required | Notes |
|----------|---------|----------|-------|
| `DATABASE_URL` | backend | ✅ SECRET | Railway internal PostgreSQL URL in prod |
| `REDIS_URL` | backend | ✅ SECRET | Railway internal Redis URL in prod |
| `JWT_SECRET` | backend | ✅ SECRET | HS256 for dev; RS256 via Supabase in prod |
| `SUPABASE_URL` | backend + frontend | ✅ SECRET | Project-specific Supabase URL |
| `SUPABASE_ANON_KEY` | frontend | ✅ SECRET | Supabase anon key (public-safe) |
| `SUPABASE_SERVICE_ROLE_KEY` | backend | ✅ SECRET | Full DB access — never expose to frontend |
| `STRIPE_SECRET_KEY` | backend | ✅ SECRET | `sk_test_...` dev; `sk_live_...` prod |
| `STRIPE_WEBHOOK_SECRET` | backend | ✅ SECRET | `whsec_...` — validate all webhook events |
| `OPENAI_API_KEY` | backend | ✅ SECRET | GPT-4o access |
| `CLOUDFLARE_R2_ACCESS_KEY_ID` | backend | ✅ SECRET | R2 bucket access |
| `CLOUDFLARE_R2_SECRET_ACCESS_KEY` | backend | ✅ SECRET | R2 bucket secret |
| `CLOUDFLARE_R2_BUCKET_NAME` | backend | ✅ | `cerniq-reports` |
| `CLOUDFLARE_ACCOUNT_ID` | backend | ✅ | For R2 presigned URL generation |
| `RESEND_API_KEY` | backend | ✅ SECRET | Transactional email |
| `RESEND_FROM_EMAIL` | backend | ✅ | `noreply@cerniq.io` |
| `ADMIN_API_KEY` | backend | ✅ SECRET | Admin endpoint auth — SHA-256 in DB |
| `NEXT_PUBLIC_API_URL` | frontend | ✅ | `https://api.cerniq.io` in prod |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | frontend | ✅ | `pk_test_...` or `pk_live_...` |

> **Rule:** Any variable with `SECRET` in notes must NEVER be committed. The `verify:clean` script does not scan for secrets, but the pre-commit hook (`husky`) runs lint-staged on all staged `.ts` files.

---

## 8.8 Security Architecture

### Transport Security
- All production traffic: HTTPS only (TLS 1.2+)
- Vercel enforces HTTPS redirect on all routes
- Railway terminates TLS at load balancer
- WKWebView: App Transport Security (ATS) enabled; `localhost` exemption for `.local` environment only
- HSTS: enabled on cerniq.io via Vercel headers

### Authentication Security
- JWT access tokens: 15-minute expiry (short to limit breach window)
- Refresh tokens: 7-day expiry, stored hashed in DB (`refresh_tokens.token`), revocable per session
- API keys: stored as SHA-256 hash in `api_keys.keyHash`; full key shown only at creation time; prefix stored for display
- Password hashing: bcrypt with cost factor 12
- Magic links: SHA-256 tokenHash; single-use (`usedAt` timestamp); 15-minute expiry

### Rate Limiting (@nestjs/throttler)
| Endpoint Group | Limit | Window |
|---------------|-------|--------|
| Auth endpoints (login, register, magic-link, password-reset) | 5 requests | 1 minute |
| ALM calculation endpoints | 20 requests | 1 minute |
| File upload endpoints | 10 requests | 5 minutes |
| Public API (market data, stateless ALM) | 60 requests | 1 minute |

### CORS Configuration
```typescript
// main.ts
app.enableCors({
  origin: ['https://cerniq.io', 'http://localhost:3001'],
  credentials: true,
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
})
```

WKWebView uses the `/api/*` Vercel rewrite — it never hits `api.cerniq.io` directly, so CORS is not an issue for the native app.

### Cloudflare R2 Security
- Bucket is **private** — no public access
- All report PDFs accessed via presigned URLs (7-day expiry)
- R2 credentials rotated quarterly
- Object names: `reports/{userId}/{reportId}/{timestamp}.pdf` — non-guessable

### Stripe Webhook Security
```typescript
// billing.controller.ts
const event = stripe.webhooks.constructEvent(
  rawBody,
  signature,
  process.env.STRIPE_WEBHOOK_SECRET
)
// If signature verification fails → 400 Bad Request
// Never process unverified webhook events
```

---

## 8.9 Monitoring & Observability

### Current
- Railway dashboard: CPU, memory, request rate, error rate
- Vercel Analytics: Core Web Vitals, page views, edge latency
- OpenTelemetry (`src/telemetry.ts`): backend traces to OTEL collector

### Recommended Additions (Next 90 Days)
- **Sentry** on both app targets (macOS + iOS): crash reporting, performance monitoring
- **Railway metrics alerts**: alert on CPU > 80%, memory > 85%, error rate > 1%
- **Uptime monitoring**: Betterstack or UptimeRobot on `https://api.cerniq.io/health`
- **Custom KPIs dashboard** (Grafana or Metabase):
  - Report jobs created per day
  - Report generation time (P50, P95, P99)
  - WebSocket active connections
  - Stripe MRR (via Stripe API)
  - ALM module usage by type

### Health Endpoint
```
GET /health → 200 OK
{
  "status": "ok",
  "database": "connected",
  "redis": "connected",
  "timestamp": "2026-04-18T14:00:00Z"
}
```

---

## 8.10 Deployment Runbook

### Backend Deploy (Railway)
```bash
cd backend-node
railway up                # Push to Railway; Railway builds Dockerfile + restarts container
railway logs              # Stream deployment logs
curl https://api.cerniq.io/health  # Verify deployment
```

### Frontend Deploy (Vercel)
```bash
cd frontend
vercel --prod             # Deploy to production
vercel logs               # View deployment logs
```

### Full Deploy (from repo root)
```bash
# Production deploy checklist
npm run deploy:prepare               # Clean artifacts
npm run verify:frontend              # Full frontend verify
npm run verify:backend               # Full backend verify
npm run verify:local:critical        # Critical E2E
cd backend-node && railway up        # Deploy backend
cd frontend && vercel --prod         # Deploy frontend
npm run smoke:production             # Smoke test live URLs
```

### Smoke Test — Production
```bash
npm run smoke:production
# Checks:
# curl -fsS https://cerniq.io         → 200
# curl -fsS https://cerniq.io/login   → 200
# curl -fsS https://cerniq.io/pricing → 200
# curl -fsS https://api.cerniq.io/health → 200
# Playwright: critical E2E against production
```

---

*KLYTICS LLC · Proprietary & Confidential · cerniq.io*
