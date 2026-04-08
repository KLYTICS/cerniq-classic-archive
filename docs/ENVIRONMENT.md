# CERNIQ Environment Variables

> Complete reference for all environment variables across all services.

---

## Quick Start

```bash
# Backend
cp backend-node/.env.example backend-node/.env

# Frontend
cp frontend/.env.example frontend/.env.local

# Outbound engine (optional)
cp services/outbound/.env.example services/outbound/.env
```

Each `.env.example` file contains all variables with sensible development defaults. Only a few **require** configuration for local dev. See the [Multi-Terminal Runbook](MULTI_TERMINAL_RUNBOOK.md) for full startup instructions.

---

## Database

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DATABASE_URL` | ✅ | `postgresql://cerniq:dev_password_change_in_prod@localhost:5433/cerniq` | Full PostgreSQL connection string |
| `DATABASE_PASSWORD` | ✅ | `dev_password_change_in_prod` | Database password (used by Docker Compose) |
| `DATABASE_POOL_SIZE` | ❌ | `20` | Connection pool size |

## Cache

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `REDIS_URL` | ✅ | `redis://localhost:6380` | Redis connection string (port 6380 = Docker external mapping) |
| `REDIS_POOL_SIZE` | ❌ | `10` | Redis connection pool size |

---

## Authentication

### JWT

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `JWT_SECRET` | ✅ | — | JWT signing key (min 32 chars) |
| `JWT_EXPIRATION` | ❌ | `24h` | Access token lifetime |
| `REFRESH_TOKEN_EXPIRATION` | ❌ | `7d` | Refresh token lifetime |

### Supabase

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `SUPABASE_URL` | ⚠️ | — | Supabase project URL |
| `SUPABASE_ANON_KEY` | ⚠️ | — | Supabase anonymous key |
| `SUPABASE_SERVICE_ROLE_KEY` | ⚠️ | — | Supabase service role key |
| `SUPABASE_JWT_SECRET` | ⚠️ | — | Supabase JWT secret |
| `SUPABASE_JWKS_URL` | ⚠️ | — | JWKS endpoint URL |
| `SUPABASE_JWT_AUDIENCE` | ❌ | `authenticated` | JWT audience claim |
| `SUPABASE_JWT_ISSUER` | ❌ | — | JWT issuer claim |
| `KLYTICS_APP_ID` | ❌ | `cerniq` | App ID for K-Lytics multi-tenant |
| `AUTH_ALLOW_LEGACY` | ❌ | `true` | Allow legacy auth paths |
| `API_KEY_PEPPER` | ❌ | — | Pepper for API key hashing |

### OAuth — Google

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `GOOGLE_CLIENT_ID` | ❌ | — | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | ❌ | — | Google OAuth client secret |
| `GOOGLE_CALLBACK_URL` | ❌ | `http://localhost:3000/api/auth/google/callback` | OAuth callback URL |

### OAuth — GitHub

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `GITHUB_CLIENT_ID` | ❌ | — | GitHub OAuth client ID |
| `GITHUB_CLIENT_SECRET` | ❌ | — | GitHub OAuth client secret |
| `GITHUB_CALLBACK_URL` | ❌ | `http://localhost:3000/api/auth/github/callback` | OAuth callback URL |

### Cookies

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `AUTH_COOKIE_SECURE` | ❌ | `false` (dev) | Set `true` in production |
| `AUTH_COOKIE_SAMESITE` | ❌ | `lax` | Cookie SameSite policy |
| `AUTH_COOKIE_DOMAIN` | ❌ | — | Cookie domain (e.g. `.cerniq.io`) |

---

## Frontend URLs

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `FRONTEND_URL` | ✅ | `http://localhost:3001` | Frontend URL (CORS, redirects) |
| `NEXT_PUBLIC_NODE_API_URL` | ✅ | `http://localhost:3000` | Backend API URL |
| `NEXT_PUBLIC_APP_URL` | ❌ | `http://localhost:3001` | Public app URL |
| `NEXT_PUBLIC_API_URL` | ❌ | `http://localhost:3000` | Legacy API URL alias |
| `API_URL` | ❌ | — | **Deprecated** — was Rust backend (port 8001). Use `NEXT_PUBLIC_NODE_API_URL` instead |
| `NEXT_PUBLIC_ENABLE_GOOGLE_OAUTH` | ❌ | `true` | Show Google OAuth button |
| `NEXT_PUBLIC_ENABLE_GITHUB_OAUTH` | ❌ | `false` | Show GitHub OAuth button |

---

## Billing (Stripe)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `STRIPE_SECRET_KEY` | ⚠️ | — | Stripe secret key |
| `STRIPE_WEBHOOK_SECRET` | ⚠️ | — | Stripe webhook signing secret |
| `STRIPE_PRICE_ONE_TIME` | ⚠️ | — | Price ID for one-time report |
| `STRIPE_PRICE_MONTHLY` | ⚠️ | — | Price ID for monthly subscription |
| `STRIPE_PRICE_ANNUAL` | ⚠️ | — | Price ID for annual subscription |
| `STRIPE_PRICE_PARTNER` | ⚠️ | — | Price ID for partner tier |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | ⚠️ | — | Stripe publishable key (frontend) |
| `NEXT_PUBLIC_SENTRY_DSN` | ⚠️ | — | Client-side Sentry DSN for browser error tracking |

---

## Email (Resend)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `RESEND_API_KEY` | ⚠️ | — | Resend API key |
| `ERWIN_EMAIL` | ❌ | `eskiessalfonso@gmail.com` | Admin notification email |
| `SLACK_WEBHOOK_URL` | ❌ | — | Slack incoming webhook for sales alerts |

---

## Storage (Cloudflare R2)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `R2_ENDPOINT` | ⚠️ | — | R2 S3-compatible endpoint |
| `R2_ACCESS_KEY_ID` | ⚠️ | — | R2 access key |
| `R2_SECRET_ACCESS_KEY` | ⚠️ | — | R2 secret key |
| `R2_BUCKET` | ⚠️ | `cerniq-reports` | R2 bucket name |

### Legacy S3 (SpendCheck)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `AWS_ACCESS_KEY_ID` | ❌ | — | AWS access key |
| `AWS_SECRET_ACCESS_KEY` | ❌ | — | AWS secret key |
| `AWS_S3_ENDPOINT` | ❌ | — | S3 endpoint (custom) |
| `AWS_REGION` | ❌ | `us-east-1` | AWS region |
| `AWS_S3_BUCKET` | ❌ | `spendcheck-receipts` | S3 bucket |
| `S3_PRESIGNED_URL_EXPIRY` | ❌ | `300` | Presigned URL TTL (seconds) |

---

## Market Data APIs

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `ALPHA_VANTAGE_API_KEY` | ❌ | — | Alpha Vantage API key |
| `COINGECKO_API_KEY` | ❌ | — | CoinGecko API key |
| `YAHOO_FINANCE_API_KEY` | ❌ | — | Yahoo Finance API key (optional) |

---

## AI / LLM

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `OPENAI_API_KEY` | ❌ | — | OpenAI API key |
| `ANTHROPIC_API_KEY` | ❌ | — | Anthropic API key |
| `USE_LOCAL_LLM` | ❌ | `false` | Use Ollama instead of cloud |
| `OLLAMA_BASE_URL` | ❌ | `http://localhost:11434` | Ollama server URL |

---

## Analytics (Frontend)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `NEXT_PUBLIC_SEGMENT_WRITE_KEY` | ❌ | — | Segment analytics key |
| `NEXT_PUBLIC_GA4_MEASUREMENT_ID` | ❌ | — | Google Analytics 4 |
| `NEXT_PUBLIC_POSTHOG_KEY` | ❌ | — | PostHog analytics key |

---

## Server & CORS

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `PORT` | ❌ | `3000` | Backend server port |
| `BACKEND_PORT` | ❌ | `3000` | Backend server port (alternative to PORT) |
| `FRONTEND_PORT` | ❌ | `3001` | Frontend port |
| `NODE_ENV` | ❌ | `development` | Environment |
| `ALLOWED_ORIGINS` | ❌ | `http://localhost:3000,http://localhost:3001` | CORS allowed origins |
| `CORS_ORIGIN` | ❌ | — | Legacy CORS alias |
| `ALLOW_PREVIEW_ORIGINS` | ❌ | `false` | Allow Vercel preview origins |

---

## Security & Rate Limiting

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `ADMIN_KEY` | ✅ | — | Admin API key for protected endpoints |
| `RATE_LIMIT_PER_MINUTE` | ❌ | `100` | Requests per minute per IP |
| `RATE_LIMIT_BURST` | ❌ | `20` | Burst allowance |
| `HEALTH_DETAILS_PUBLIC` | ❌ | `false` | Expose detailed health info |

---

## WebSockets

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `WS_MAX_CONNECTIONS` | ❌ | `1000` | Max WebSocket connections |
| `WS_HEARTBEAT_INTERVAL` | ❌ | `30` | Heartbeat interval (seconds) |
| `NEXT_PUBLIC_SOCKET_URL` | ❌ | — | WebSocket URL (frontend) |
| `NEXT_PUBLIC_WS_URL` | ❌ | — | Legacy WebSocket URL |

---

## Feature Flags

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `ENABLE_WEBSOCKET` | ❌ | `true` | Enable WebSocket features |
| `ENABLE_AI_INSIGHTS` | ❌ | `true` | Enable AI insights |
| `ENABLE_CRYPTO_DATA` | ❌ | `true` | Enable crypto market data |
| `ALLOW_DEMO_MOCKS` | ❌ | `false` | Allow mock data in demo mode |
| `NEXT_PUBLIC_ALLOW_DEMO_MOCKS` | ❌ | `false` | Frontend demo mock toggle |

---

## ALM Defaults

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `FED_FUNDS_RATE_BPS` | ❌ | `450` | Federal funds rate (basis points) |

---

## Logging & Observability

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `LOG_LEVEL` | ❌ | `info` | Pino log level (debug, info, warn, error) |
| `SENTRY_DSN` | ⚠️ | — | Server-side Sentry DSN (backend + Next server runtime) |
| `NEXT_PUBLIC_SENTRY_DSN` | ⚠️ | — | Client-side Sentry DSN (browser runtime) |
| `SENTRY_ORG` | ❌ | — | Sentry organization slug for source map upload |
| `SENTRY_PROJECT` | ❌ | — | Sentry project slug for source map upload |
| `SENTRY_AUTH_TOKEN` | ❌ | — | Sentry auth token for release + sourcemap upload |
| `SENTRY_RELEASE` | ❌ | — | Optional explicit frontend release identifier |
| `SENTRY_ORG` | ❌ | — | Sentry organization slug |
| `SENTRY_PROJECT` | ❌ | — | Sentry project slug |
| `SENTRY_AUTH_TOKEN` | ❌ | — | Sentry auth token (for source maps) |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | ❌ | — | OpenTelemetry OTLP endpoint |
| `OTEL_EXPORTER_OTLP_HEADERS` | ❌ | — | OTLP auth headers |

---

## Data Encryption

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DATA_ENCRYPTION_KEY` | ⚠️ | — | AES-256-GCM key for PII encryption at rest |

---

## Maintenance

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `MAINTENANCE_MODE` | ❌ | `false` | Enable maintenance mode (returns 503) |
| `MAINTENANCE_MESSAGE` | ❌ | `System maintenance in progress` | Custom maintenance message |

---

## Legend

| Symbol | Meaning |
|--------|---------|
| ✅ | Required for the app to start |
| ⚠️ | Required for the feature to work (app starts without it) |
| ❌ | Optional, has sensible default |
