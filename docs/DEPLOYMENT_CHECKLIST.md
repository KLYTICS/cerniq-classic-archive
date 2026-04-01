# CERNIQ Deployment Checklist

Production deployment guide for CERNIQ ALM reporting platform.

**Stack:** NestJS 11 backend, Next.js 16 frontend (Bun), PostgreSQL, Redis, Prisma ORM, Stripe billing, Supabase auth.

**Targets:** Backend on Railway, Frontend on Vercel, Database on Railway/Supabase Postgres, Redis on Railway/Upstash.

---

## Pre-Deploy Checklist

### 1. Environment Variables

All variables sourced from `.env.example` at project root. Set these in Railway (backend) and Vercel (frontend) dashboards respectively.

#### CRITICAL (app will not start without these)

| Variable | Example | Notes |
|----------|---------|-------|
| `DATABASE_URL` | `postgresql://user:pass@host:5432/cerniq` | `main.ts` exits if missing |
| `JWT_SECRET` | (cryptographically random, 32+ chars) | `main.ts` exits if < 32 chars |

#### AUTH (Supabase)

| Variable | Target | Notes |
|----------|--------|-------|
| `SUPABASE_URL` | Backend | `https://<PROJECT_REF>.supabase.co` |
| `SUPABASE_ANON_KEY` | Backend + Frontend | |
| `SUPABASE_SERVICE_ROLE_KEY` | Backend only | Never expose to client |
| `SUPABASE_JWT_SECRET` | Backend | Used for token verification |
| `SUPABASE_JWKS_URL` | Backend | `https://<PROJECT_REF>.supabase.co/auth/v1/.well-known/jwks.json` |
| `SUPABASE_JWT_AUDIENCE` | Backend | `authenticated` |
| `SUPABASE_JWT_ISSUER` | Backend | `https://<PROJECT_REF>.supabase.co/auth/v1` |
| `NEXT_PUBLIC_SUPABASE_URL` | Frontend | Same as `SUPABASE_URL` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Frontend | Same as `SUPABASE_ANON_KEY` |
| `KLYTICS_APP_ID` | Backend | `cerniq` |

#### BILLING (Stripe)

| Variable | Example | Notes |
|----------|---------|-------|
| `STRIPE_SECRET_KEY` | `sk_live_...` | Must be live key in production |
| `STRIPE_WEBHOOK_SECRET` | `whsec_...` | From Stripe webhook dashboard |
| `STRIPE_PRICE_ONE_TIME` | `price_...` | One-time analysis price ID |
| `STRIPE_PRICE_MONTHLY` | `price_...` | Monthly subscription price ID |
| `STRIPE_PRICE_ANNUAL` | `price_...` | Annual subscription price ID |
| `STRIPE_PRICE_PARTNER` | `price_...` | Partner/reseller price ID |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | `pk_live_...` | Frontend — must be live key |

#### EMAIL

| Variable | Example | Notes |
|----------|---------|-------|
| `RESEND_API_KEY` | `re_...` | Transactional email via Resend |
| `ERWIN_EMAIL` | `eskiessalfonso@gmail.com` | Notification recipient for demo requests |

#### STORAGE

| Variable | Notes |
|----------|-------|
| `R2_ENDPOINT` | `https://<ACCOUNT_ID>.r2.cloudflarestorage.com` |
| `R2_ACCESS_KEY_ID` | Cloudflare R2 access key |
| `R2_SECRET_ACCESS_KEY` | Cloudflare R2 secret key |
| `R2_BUCKET` | `cerniq-reports` (or your bucket name) |
| `AWS_ACCESS_KEY_ID` | For S3-compatible SpendCheck receipts |
| `AWS_SECRET_ACCESS_KEY` | |
| `AWS_REGION` | `us-east-1` |
| `AWS_S3_BUCKET` | `spendcheck-receipts` |
| `AWS_S3_ENDPOINT` | Leave blank for AWS, set for R2/MinIO |
| `S3_PRESIGNED_URL_EXPIRY` | `300` (seconds) |

#### OAUTH (optional — leave blank to disable)

| Variable | Notes |
|----------|-------|
| `GOOGLE_CLIENT_ID` | Google OAuth app |
| `GOOGLE_CLIENT_SECRET` | |
| `GOOGLE_CALLBACK_URL` | `https://api.cerniq.io/api/auth/google/callback` |
| `GITHUB_CLIENT_ID` | GitHub OAuth app |
| `GITHUB_CLIENT_SECRET` | |
| `GITHUB_CALLBACK_URL` | `https://api.cerniq.io/api/auth/github/callback` |
| `NEXT_PUBLIC_ENABLE_GOOGLE_OAUTH` | `true` or `false` |
| `NEXT_PUBLIC_ENABLE_GITHUB_OAUTH` | `true` or `false` |

#### URLS

| Variable | Production Value | Target |
|----------|-----------------|--------|
| `FRONTEND_URL` | `https://cerniq.io` | Backend (CORS + redirects) |
| `NEXT_PUBLIC_NODE_API_URL` | `https://api.cerniq.io` | Frontend (rewrites proxy) |
| `NEXT_PUBLIC_APP_URL` | `https://cerniq.io` | Frontend |
| `NEXT_PUBLIC_API_URL` | `https://api.cerniq.io` | Frontend (legacy alias) |
| `API_URL` | `https://api.cerniq.io` | Backend (legacy alias) |
| `ALLOWED_ORIGINS` | `https://cerniq.io` | Backend CORS allowlist (CSV) |

#### SECURITY

| Variable | Production Value | Notes |
|----------|-----------------|-------|
| `ADMIN_KEY` | (unique random string) | Protects `/api/admin/*` endpoints |
| `AUTH_COOKIE_SECURE` | `true` | Cookies only over HTTPS |
| `AUTH_COOKIE_SAMESITE` | `lax` | CSRF protection |
| `AUTH_COOKIE_DOMAIN` | `.cerniq.io` | Shared across subdomains |
| `API_KEY_PEPPER` | (random string) | API key hashing pepper |
| `HEALTH_DETAILS_PUBLIC` | `false` | Hides `/health/detailed` in prod |
| `ALLOW_DEMO_MOCKS` | `false` | Disables synthetic data fallback |
| `NEXT_PUBLIC_ALLOW_DEMO_MOCKS` | `false` | Frontend mock toggle |
| `ALLOW_PREVIEW_ORIGINS` | `false` | Blocks Vercel preview CORS |

#### PERFORMANCE

| Variable | Default | Notes |
|----------|---------|-------|
| `DATABASE_POOL_SIZE` | `20` | Tune for Railway plan limits |
| `REDIS_POOL_SIZE` | `10` | |
| `RATE_LIMIT_PER_MINUTE` | `100` | Global throttle (ThrottlerModule) |
| `RATE_LIMIT_BURST` | `20` | |
| `WS_MAX_CONNECTIONS` | `1000` | WebSocket connection cap |
| `WS_HEARTBEAT_INTERVAL` | `30` | Seconds between pings |

#### AI / MARKET DATA (optional)

| Variable | Notes |
|----------|-------|
| `OPENAI_API_KEY` | For AI insights |
| `ANTHROPIC_API_KEY` | Alternative LLM |
| `USE_LOCAL_LLM` | `false` in production |
| `ALPHA_VANTAGE_API_KEY` | Market data |
| `COINGECKO_API_KEY` | Crypto data |
| `FED_FUNDS_RATE_BPS` | `450` (current Fed funds rate in basis points) |

#### ANALYTICS (optional)

| Variable | Notes |
|----------|-------|
| `NEXT_PUBLIC_SEGMENT_WRITE_KEY` | Segment analytics |
| `NEXT_PUBLIC_GA4_MEASUREMENT_ID` | Google Analytics 4 |
| `NEXT_PUBLIC_POSTHOG_KEY` | PostHog product analytics |

#### RUNTIME

| Variable | Value | Notes |
|----------|-------|-------|
| `NODE_ENV` | `production` | |
| `PORT` | `3000` | Railway injects this automatically |
| `LOG_FORMAT` | `json` | Structured logging for Railway |
| `ENABLE_WEBSOCKET` | `true` | |
| `ENABLE_AI_INSIGHTS` | `true` | |
| `ENABLE_CRYPTO_DATA` | `true` | |

---

### 2. Database

- [ ] Provision PostgreSQL instance (Railway Postgres or Supabase managed)
- [ ] Confirm `DATABASE_URL` connection string is set and reachable from Railway
- [ ] Run `ALLOW_SCHEMA_MIGRATIONS=true npm run prisma:deploy` against production database from `backend-node/`
- [ ] Verify all 14 migrations applied:

| Migration | Description |
|-----------|-------------|
| `20260211232255` | Portfolio models (institutions, balance sheets, scenarios) |
| `20260219000000` | Pipeline and market prices |
| `20260220000000` | Auth fields (users, refresh tokens) |
| `20260220000000` | Demo request table |
| `20260220100000` | ALM enterprise models |
| `20260221000000` | Workspace owner relation |
| `20260221100000` | Prospect CRM |
| `20260305000000` | SaaS billing pipeline (subscriptions, invoices) |
| `20260310234500` | API keys |
| `20260312121135` | Leads / prospect pipeline |
| `20260315120000` | Analysis runs |
| `20260315124500` | Ingestion logs |
| `20260315180000` | Raw data encryption |
| `20260315190000` | Password reset tokens |

- [ ] Check migration status: `npm run prisma:status`
- [ ] Create initial admin user if needed (via Supabase dashboard or seed script)
- [ ] Configure connection pooling — Railway Postgres uses PgBouncer; set `DATABASE_POOL_SIZE` to stay within plan limits
- [ ] If using Supabase Postgres: use the pooled connection string (port 6543) for `DATABASE_URL`

---

### 3. Security Audit

- [ ] `JWT_SECRET` is cryptographically random, minimum 32 characters (`openssl rand -base64 48`)
- [ ] `ADMIN_KEY` is unique and **not** the default `your-admin-key-change-in-production`
- [ ] `API_KEY_PEPPER` is set to a unique random value
- [ ] No `.env` files in Docker image — `.dockerignore` excludes `.env*` (verified in `backend-node/.dockerignore`)
- [ ] CORS origins restricted to production domains only (`ALLOWED_ORIGINS=https://cerniq.io`, `ALLOW_PREVIEW_ORIGINS=false`)
- [ ] `FRONTEND_URL` set to `https://cerniq.io` (used by CORS callback in `origin-allowlist.ts`)
- [ ] Helmet CSP directives reviewed — current policy allows Segment, GA4, PostHog; remove any unused analytics
- [ ] Rate limiting active: ThrottlerModule configured at 100 requests/60s globally; demo-request endpoint at 5/60s
- [ ] Auth cookie settings: `AUTH_COOKIE_SECURE=true`, `AUTH_COOKIE_SAMESITE=lax`, `AUTH_COOKIE_DOMAIN=.cerniq.io`
- [ ] `HEALTH_DETAILS_PUBLIC=false` — `/health/detailed` returns 404 in production
- [ ] `ALLOW_DEMO_MOCKS=false` — no synthetic data served to users
- [ ] `SUPABASE_SERVICE_ROLE_KEY` is set only in backend, never in frontend env vars
- [ ] Backend Supabase table access uses `SUPABASE_SERVICE_ROLE_KEY`; no server-side path relies on `SUPABASE_ANON_KEY` for table CRUD
- [ ] `NEXT_PUBLIC_*` vars do not contain any secrets (they are bundled into client JS)
- [ ] Stripe webhook endpoint uses raw body parsing (already configured via `rawBody: true` in `main.ts`)
- [ ] `trust proxy` is set to `1` (already configured — correct for Railway single-proxy setup)
- [ ] Supabase Advisor is clean for `rls_disabled_in_public`, or the release log explicitly documents the remaining intentional exception

---

### 4. DNS & SSL

- [ ] `cerniq.io` A/CNAME record pointing to Vercel (frontend)
- [ ] `api.cerniq.io` CNAME pointing to Railway backend (e.g., `<app>.up.railway.app`)
- [ ] SSL certificates auto-provisioned by Vercel and Railway
- [ ] Verify HTTPS redirect works for both domains
- [ ] Update OAuth callback URLs to production:
  - Google: `https://api.cerniq.io/api/auth/google/callback`
  - GitHub: `https://api.cerniq.io/api/auth/github/callback`
- [ ] Update Supabase project redirect URLs to include `https://cerniq.io`

---

### 5. Stripe Setup

- [ ] Switch from test keys (`sk_test_`, `pk_test_`) to live keys (`sk_live_`, `pk_live_`)
- [ ] Create webhook endpoint in Stripe dashboard: `https://api.cerniq.io/api/billing/webhook`
- [ ] Subscribe webhook to events: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_succeeded`, `invoice.payment_failed`
- [ ] Copy `whsec_...` signing secret to `STRIPE_WEBHOOK_SECRET`
- [ ] Verify 4 price IDs exist in live mode:
  - `STRIPE_PRICE_ONE_TIME` — one-time analysis
  - `STRIPE_PRICE_MONTHLY` — monthly subscription
  - `STRIPE_PRICE_ANNUAL` — annual subscription
  - `STRIPE_PRICE_PARTNER` — partner/reseller tier
- [ ] Test checkout with Stripe test clock before going live

---

### 6. Redis

- [ ] Provision Redis instance (Railway Redis or Upstash)
- [ ] Set `REDIS_URL` in backend environment (e.g., `redis://default:password@host:port`)
- [ ] Health endpoint treats Redis as non-critical — app runs degraded without it but market data caching and WebSocket features are affected

---

## Deploy Steps

### Backend (Railway)

```bash
# Link project (first time)
railway login
railway link

# Deploy
railway up
```

Or configure auto-deploy from `main` branch in Railway dashboard.

The Dockerfile (`backend-node/Dockerfile`) handles everything:
1. Installs dependencies (`npm ci`)
2. Generates Prisma client
3. Builds NestJS (`nest build`)
4. Starts `node dist/src/main.js`

Schema migrations are explicit and should be run before deploy, not on container
startup.

**Post-deploy backend checks:**

```bash
# Health check (should return {"status":"healthy","version":"2.0.0",...})
curl https://api.cerniq.io/health

# Status endpoint
curl https://api.cerniq.io/api/status

# Verify detailed health is hidden
curl -s -o /dev/null -w "%{http_code}" https://api.cerniq.io/health/detailed
# Expected: 404
```

### Frontend (Vercel)

```bash
vercel --prod
```

Or connect the repo and configure auto-deploy in Vercel dashboard.

**Vercel settings:**
- Framework: Next.js
- Root directory: `frontend/`
- Build command: `npm run build`
- Output directory: `.next`
- Node.js version: 20.x

**Required Vercel environment variables:**

```
NEXT_PUBLIC_NODE_API_URL=https://api.cerniq.io
NEXT_PUBLIC_APP_URL=https://cerniq.io
NEXT_PUBLIC_API_URL=https://api.cerniq.io
NEXT_PUBLIC_SUPABASE_URL=https://<PROJECT_REF>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon_key>
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...
NEXT_PUBLIC_ENABLE_GOOGLE_OAUTH=true
NEXT_PUBLIC_ENABLE_GITHUB_OAUTH=false
NEXT_PUBLIC_ALLOW_DEMO_MOCKS=false
```

The `next.config.ts` rewrites all `/api/*` requests to `NEXT_PUBLIC_NODE_API_URL`, so the frontend proxies API calls to the Railway backend.

### Database Migration

```bash
cd backend-node
DATABASE_URL="postgresql://..." npm run prisma:status
DATABASE_URL="postgresql://..." ALLOW_SCHEMA_MIGRATIONS=true npm run prisma:deploy
DATABASE_URL="postgresql://..." npm run prisma:status
```

---

## Post-Deploy Verification

### Critical Path

- [ ] `GET /health` returns `{"status":"healthy"}` with database `up`
- [ ] `GET /api/status` returns `{"name":"CERNIQ API","version":"2.0.0"}`
- [ ] Login flow works end-to-end (Supabase email/password or OAuth)
- [ ] Auth cookie set with `Secure`, `HttpOnly`, `SameSite=Lax`
- [ ] Create institution via UI
- [ ] Import balance sheet (CSV upload)
- [ ] Run ALM analysis on uploaded data
- [ ] CSV dry run (validation without commit)
- [ ] PDF report generation (verify R2 upload)
- [ ] Stripe checkout flow — use `4242 4242 4242 4242` test card first if in test mode
- [ ] Webhook delivery confirmed in Stripe dashboard (no failures)
- [ ] Supabase Advisor recheck passes after the release SQL step
- [ ] An anonymous probe against a previously exposed Supabase table is denied by RLS

### Secondary

- [ ] WebSocket connection established (market data streaming)
- [ ] Demo request form submits successfully (`POST /api/demo-request`)
- [ ] Demo request notification email received
- [ ] Admin endpoints work with correct `x-admin-key` header
- [ ] Admin endpoints reject requests without valid key (401)
- [ ] Rate limiting triggers on rapid requests (429 response)
- [ ] Workspace creation works for authenticated users
- [ ] Audit log entries being created for user actions

---

## Monitoring

- [ ] Railway logs accessible and streaming (`railway logs`)
- [ ] Log format is JSON (`LOG_FORMAT=json`) for structured parsing
- [ ] Error alerting configured (Railway notifications or external like PagerDuty/Slack)
- [ ] Uptime monitoring on `https://api.cerniq.io/health` (BetterUptime, UptimeRobot, or similar)
- [ ] Uptime monitoring on `https://cerniq.io` (frontend)
- [ ] Database backup schedule verified:
  - Railway: automatic daily backups on Pro plan
  - Supabase: automatic daily backups, point-in-time recovery on Pro plan
- [ ] Redis persistence configured if using Railway Redis (or accept ephemeral with Upstash)
- [ ] Stripe webhook failure alerts enabled in Stripe dashboard
- [ ] Vercel deployment notifications configured

---

## Rollback Plan

### Backend (Railway)

```bash
# Roll back to previous deployment
railway rollback
```

Or redeploy a specific commit from the Railway dashboard.

### Frontend (Vercel)

Instant rollback via Vercel dashboard — click "Promote to Production" on any previous deployment.

### Database

Prisma does not support automatic rollback of applied migrations. If a migration must be reversed:

1. **Do not** run `prisma migrate reset` in production (it drops all data).
2. Write a manual SQL script to reverse the specific migration.
3. Remove the migration record from `_prisma_migrations` table:
   ```sql
   DELETE FROM _prisma_migrations WHERE migration_name = '<migration_name>';
   ```
4. Apply the reversal SQL.
5. Test thoroughly in staging first.

For data-only issues, restore from the most recent database backup.

### Emergency Contacts

| Service | Dashboard |
|---------|-----------|
| Railway | https://railway.app/dashboard |
| Vercel | https://vercel.com/dashboard |
| Supabase | https://supabase.com/dashboard |
| Stripe | https://dashboard.stripe.com |
| Cloudflare (DNS/R2) | https://dash.cloudflare.com |
