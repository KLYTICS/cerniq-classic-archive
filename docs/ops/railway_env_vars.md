# CERNIQ Railway Environment Variables

All environment variables required for the CERNIQ NestJS backend (`cerniq-api`) deployed on Railway.

## Required Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string (Railway-managed) | `postgresql://<user>@host:5432/railway` |
| `JWT_SECRET` | Secret for signing JWTs (min 32 chars) | `openssl rand -hex 32` |
| `FRONTEND_URL` | Frontend origin for CORS and email links | `https://cerniq.io` |
| `ALLOWED_ORIGINS` | Comma-separated CORS allowlist | `https://cerniq.io` |
| `REDIS_URL` | Redis connection for queues/cache | `redis://default:...@host:6379` |

## Data Encryption

| Variable | Description | Example |
|----------|-------------|---------|
| `DATA_ENCRYPTION_KEY` | AES-256 key (hex-encoded, 64 chars) for encrypting balance sheet data at rest | See generation below |

### Generating DATA_ENCRYPTION_KEY

```bash
openssl rand -hex 32
```

This produces a 64-character hex string (256 bits). Store it in Railway as a service variable.

### Key Rotation Procedure

1. Generate a new key: `openssl rand -hex 32`
2. Set `DATA_ENCRYPTION_KEY_NEW` to the new key in Railway
3. Deploy a migration script that:
   - Reads each `rawData` field with the old key
   - Re-encrypts with the new key
   - Updates the row
4. Swap `DATA_ENCRYPTION_KEY` to the new value
5. Remove `DATA_ENCRYPTION_KEY_NEW`
6. Verify decryption works by checking a known job

### Graceful Degradation

If `DATA_ENCRYPTION_KEY` is not set, the service logs a warning and stores/returns data unencrypted. This allows development and staging environments to run without encryption configured.

## Payments (Stripe)

| Variable | Description | Example |
|----------|-------------|---------|
| `STRIPE_SECRET_KEY` | Stripe API secret key | `sk_live_...` or `sk_test_...` |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret | `whsec_...` |
| `STRIPE_PRICE_ONE_TIME` | Price ID for one-time ALM report | `price_...` |
| `STRIPE_PRICE_MONTHLY` | Price ID for monthly platform plan | `price_...` |
| `STRIPE_PRICE_ANNUAL` | Price ID for annual compliance package | `price_...` |
| `STRIPE_PRICE_PARTNER` | Price ID for partner access plan | `price_...` |

## Email (Resend)

| Variable | Description | Example |
|----------|-------------|---------|
| `RESEND_API_KEY` | Resend API key for transactional email | `re_...` |
| `SLACK_WEBHOOK_URL` | Slack incoming webhook for sales alerts | `https://hooks.slack.com/...` |

## AI / Observability

| Variable | Description | Example |
|----------|-------------|---------|
| `ANTHROPIC_API_KEY` | Anthropic API key for AI advisor features | `sk-ant-...` |
| `SENTRY_DSN` | Sentry DSN for backend runtime reporting | `https://...@sentry.io/...` |

## OAuth Providers

| Variable | Description |
|----------|-------------|
| `GITHUB_CLIENT_ID` | GitHub OAuth app client ID |
| `GITHUB_CLIENT_SECRET` | GitHub OAuth app client secret |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret |

## Supabase Auth (Phase 4 cutover)

| Variable | Required at cutover | Description |
|----------|---------------------|-------------|
| `SUPABASE_URL` | Yes | Supabase project URL |
| `SUPABASE_ANON_KEY` | Yes | Public anon key (also used for HTTP token introspection fallback) |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Service role for admin operations |
| `SUPABASE_JWKS_URL` | Yes | JWKS endpoint — `https://<ref>.supabase.co/auth/v1/.well-known/jwks.json` |
| `SUPABASE_JWT_ISSUER` | Yes | Issuer — `https://<ref>.supabase.co/auth/v1` |
| `SUPABASE_JWT_AUDIENCE` | Yes | Typically `authenticated` |
| `SUPABASE_JWT_SECRET` | Optional | HS256 fallback when JWKS unavailable |
| `AUTH_ALLOW_LEGACY` | Yes | `false` after Supabase login verified in prod (governs *verification* of existing legacy tokens) |
| `AUTH_LEGACY_DEPRECATION_WARN` | Optional | Log legacy JWT usage |
| `AUTH_DISABLE_LEGACY_MINT` | Phase 4 | `true` after Supabase login live → Nest password mint returns 410 Gone (stops *issuing* new legacy sessions). Default `false`. Set this before `AUTH_ALLOW_LEGACY=false`. |
| `PLATFORM_RECOVERY_OWNER_BYPASS` | Optional | Must stay unset/`false` in normal prod. Opt-in (`true`) only for temporary OWNER recovery — unpaid OWNERs otherwise hit the pay gate. |
| `KLYTICS_APP_ID` | Yes | App identifier for entitlement checks (`cerniq`) |
| `KLYTICS_REQUIRE_ORG` | Cutover | `true` only after frontend sends `x-organization-id` |
| `KLYTICS_REQUIRE_ENTITLEMENT` | Cutover | `true` when org entitlements enforced |

**Vercel (frontend only):** `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`

Verify presence: `bash scripts/ops/railway-verify-prod.sh`

Docs: [docs/platform/auth-unification/ENV_CONTRACT.md](../platform/auth-unification/ENV_CONTRACT.md)

OAuth callback URLs (must include `/api`):
- GitHub: `https://api.cerniq.io/api/auth/github/callback`
- Google: `https://api.cerniq.io/api/auth/google/callback`

## Market Data

| Variable | Description |
|----------|-------------|
| `ALPHA_VANTAGE_API_KEY` | Alpha Vantage API key for market data |

## Data Retention Policy

Per the Data Processing Agreement (DPA):

- **Balance sheet data** (CSV uploads) is encrypted with AES-256-GCM before storage in the `raw_data` column of `report_jobs`
- **Automatic deletion**: A daily cron job (2:00 AM UTC) purges `raw_data` from completed jobs older than 90 days
- **Audit trail**: The `raw_data_purged_at` timestamp records when data was deleted
- **Railway PostgreSQL** provides encryption at rest (disk-level) as a baseline; application-level AES-256-GCM adds defense-in-depth

## Pipeline Operations

- **Stalled job detection**: Every 5 minutes, jobs stuck in `PROCESSING` for >30 minutes are auto-reset to `QUEUED` (max 3 retries, then `FAILED`)
- **Alerts**: Erwin receives an email alert for every stalled or failed job via the `sendJobFailedAlert` email template
