# CERNIQ Railway Environment Variables

All environment variables required for the CERNIQ NestJS backend (`cerniq-api`) deployed on Railway.

## Required Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string (Railway-managed) | `postgresql://user:pass@host:5432/railway` |
| `JWT_SECRET` | Secret for signing JWTs (min 32 chars) | `openssl rand -hex 32` |
| `FRONTEND_URL` | Frontend origin for CORS and email links | `https://app.cerniq.io` |

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

## Email (Resend)

| Variable | Description | Example |
|----------|-------------|---------|
| `RESEND_API_KEY` | Resend API key for transactional email | `re_...` |

## OAuth Providers

| Variable | Description |
|----------|-------------|
| `GITHUB_CLIENT_ID` | GitHub OAuth app client ID |
| `GITHUB_CLIENT_SECRET` | GitHub OAuth app client secret |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret |

OAuth callback URLs:
- GitHub: `https://api.cerniq.io/auth/github/callback`
- Google: `https://api.cerniq.io/auth/google/callback`

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
