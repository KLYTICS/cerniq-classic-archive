# CERNIQ Deployment Runbook

**Version:** 1.0
**Date:** 2026-03-16
**Stack:** NestJS 11 (Railway) + Next.js 16 (Vercel) + PostgreSQL (Railway) + Stripe + Resend

---

## Table of Contents

1. [Pre-Deployment Checklist](#1-pre-deployment-checklist)
2. [Railway Deployment (Backend)](#2-railway-deployment-backend)
3. [Vercel Deployment (Frontend)](#3-vercel-deployment-frontend)
4. [Database Migration](#4-database-migration)
5. [Post-Deployment Verification](#5-post-deployment-verification)
6. [Rollback Procedure](#6-rollback-procedure)
7. [Common Issues and Fixes](#7-common-issues-and-fixes)
8. [Emergency Contacts](#8-emergency-contacts)

---

## 1. Pre-Deployment Checklist

Complete every item before deploying. Do not skip items even for "small" changes.

### Code Readiness

- [ ] All changes committed and pushed to `main`
- [ ] No TypeScript compilation errors: `cd backend-node && npx tsc --noEmit`
- [ ] No frontend build errors: `cd frontend && npm run build`
- [ ] Prisma schema matches migrations: `cd backend-node && DATABASE_URL="postgresql://..." npm run prisma:status`
- [ ] If schema changed: new migration created with `npx prisma migrate dev --name <description>`

### Environment Variables

- [ ] Review `docs/ops/railway_env_vars.md` -- all required vars set in Railway
- [ ] Review `docs/DEPLOYMENT_CHECKLIST.md` Section 1 -- all Vercel env vars set
- [ ] No secrets in `NEXT_PUBLIC_*` variables (they are bundled into client JS)
- [ ] `STRIPE_WEBHOOK_SECRET` matches the Stripe dashboard endpoint

### Database

- [ ] Check pending migrations: `DATABASE_URL="..." npx prisma migrate status`
- [ ] If destructive migration: take a database backup first
- [ ] Connection pool size appropriate for Railway plan (`DATABASE_POOL_SIZE`)

### Third-Party Services

- [ ] Stripe webhook endpoint active: `https://api.cerniq.io/api/billing/webhook`
- [ ] Resend domain verified for `hello@cerniq.io`
- [ ] R2 bucket exists and credentials valid (for PDF storage)

---

## 2. Railway Deployment (Backend)

### Option A: Auto-Deploy via GitHub Actions (Recommended)

The `CERNIQ CI/CD > Deploy Backend` job runs on every push to `main`.
It executes `railway up --ci --service <service-id> --environment production --project <project-id>`.

```bash
git push origin main
```

Monitor in the Railway dashboard: https://railway.app/dashboard

### RAILWAY_TOKEN rotation (every ~90 days)

Railway access tokens have a finite lifetime. When they expire, the
`Deploy Backend > Deploy to Railway` CI step fails with:

```
Unauthorized. Please check that your RAILWAY_TOKEN is valid and has
access to the resource you're trying to use.
```

This is an **ops-only** issue — no code change required. All prior CI
gates (Backend Tests, Frontend Build, E2E, Security, ALM Quality Gate,
CodeQL) stay green; only the final deploy step blocks.

**Rotation procedure (5 minutes):**

1. Generate a new token at https://railway.app/account/tokens
   - Click "Create Token"
   - Name: `github-actions-cerniq-YYYY-MM-DD`
   - Scope: project-level access to `cerniq-api`
     (project `0a09d7c9-a960-49df-a71d-12d06d7c8bcd`,
     service `809be713-9a24-4d2e-82d1-ee3860c76c85`)
2. Copy the token value (shown only once).
3. Update the GitHub secret:
   - Visit https://github.com/monykiss/cerniq/settings/secrets/actions
   - Click `RAILWAY_TOKEN` → "Update value"
   - Paste the new token, save.
4. Re-run the failed workflow:
   ```bash
   gh run list --branch main --limit 1  # get the run ID
   gh run rerun <RUN_ID> --failed
   ```
5. Verify success: `gh run view <RUN_ID>` should show all 8 jobs green.
6. Revoke any other tokens > 90 days old at the same tokens page.

**Calendar reminder:** set a 75-day rotation alert so rotation never
blocks a live deploy. Tokens don't warn before expiring — they just
stop authorizing.

### Option B: Manual Deploy via CLI

```bash
# Login (first time only)
railway login

# Link to project (first time only)
railway link

# Deploy
cd backend-node
railway up
```

### Option B: Manual Deploy via CLI

```bash
# Login (first time only)
railway login

# Link to project (first time only)
railway link

# Deploy
cd backend-node
railway up
```

### Option C: Deploy a Specific Commit

Use the Railway dashboard:
1. Go to the service > Deployments
2. Click "Deploy" and select the commit SHA

### What Happens on Deploy

The `backend-node/Dockerfile` executes:
1. `npm ci` -- installs dependencies
2. `npx prisma generate` -- generates Prisma client
3. `npx nest build` -- compiles TypeScript
4. On container start: `node dist/src/main.js` -- starts the NestJS server

Schema migrations are not run automatically at boot. Run them explicitly before
deploying schema-dependent code. See [schema migration policy](/Users/money/Desktop/Cerniq/docs/ops/schema_migration_policy.md).

### Monitoring the Deploy

```bash
# Stream Railway logs
railway logs --follow

# Or watch in the dashboard for:
# - "Nest application successfully started"
# - Health check passes on /health
```

Typical deploy time: 2-4 minutes.

---

## 3. Vercel Deployment (Frontend)

### Option A: Auto-Deploy (Recommended)

Vercel is connected to the repo and auto-deploys on push to `main`.

```bash
git push origin main
```

Monitor at: https://vercel.com/dashboard

### Option B: Manual Deploy via CLI

```bash
cd frontend
vercel --prod
```

### Vercel Project Settings

| Setting | Value |
|---------|-------|
| Framework | Next.js |
| Root Directory | `frontend/` |
| Build Command | `npm run build` |
| Output Directory | `.next` |
| Node.js Version | 20.x |

### Required Vercel Environment Variables

```
NEXT_PUBLIC_NODE_API_URL=https://api.cerniq.io
NEXT_PUBLIC_APP_URL=https://cerniq.io
NEXT_PUBLIC_API_URL=https://api.cerniq.io
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...  (or pk_test_...)
NEXT_PUBLIC_ALLOW_DEMO_MOCKS=false
```

Typical deploy time: 1-2 minutes.

---

## 4. Database Migration

### Explicit Production Step

```bash
cd backend-node

# Check current status
DATABASE_URL="postgresql://..." npm run prisma:status

# Apply pending migrations from a controlled release step
DATABASE_URL="postgresql://..." ALLOW_SCHEMA_MIGRATIONS=true npm run prisma:deploy

# Verify
DATABASE_URL="postgresql://..." npm run prisma:status
```

Do not run schema changes during app startup. The backend must boot against an
already-prepared database.

### Before Destructive Migrations

If a migration drops columns, tables, or changes types:

1. **Backup the database** via Railway dashboard (Settings > Backups > Create Backup)
2. Test the migration locally against a copy of production data
3. Schedule a maintenance window if data transformation is slow
4. Run the explicit migration step first, then deploy backend, then frontend

---

## 5. Post-Deployment Verification

### Automated Check

```bash
bash scripts/health-check.sh https://api.cerniq.io https://cerniq.io
```

All checks should show PASS. See `scripts/health-check.sh` for details.

### Manual Spot Checks

```bash
# 1. Backend health
curl https://api.cerniq.io/api/v1/health
# Expected: {"success":true,"data":{"status":"ok"|"degraded",...}}

# 2. Backend readiness
curl https://api.cerniq.io/ready
# Expected: {"success":true,"data":{"ready":true,"checks":{"database":"ok"},...}}

# 3. API status
curl https://api.cerniq.io/api/status
# Expected: {"name":"CERNIQ API","version":"2.0.0",...}

# 4. Frontend loads
curl -s -o /dev/null -w "%{http_code}" https://cerniq.io
# Expected: 200

# 5. Pricing page loads
curl -s -o /dev/null -w "%{http_code}" https://cerniq.io/pricing
# Expected: 200

# 6. Admin endpoint rejects unauthenticated
curl -s -o /dev/null -w "%{http_code}" https://api.cerniq.io/api/admin/stats
# Expected: 401

# 7. Admin endpoint works with key
curl -H "x-admin-key: <admin-key>" https://api.cerniq.io/api/admin/stats
# Expected: 200 with JSON payload
```

### Stripe Webhook Verification

1. Go to https://dashboard.stripe.com/webhooks
2. Find the `api.cerniq.io` endpoint
3. Confirm "Recent deliveries" show no failures
4. If needed, click "Send test webhook" for `checkout.session.completed`

### Smoke Test the Full Flow

After deployment, run through the first 3 steps of the E2E Production Gate (`docs/ops/e2e_production_gate.md`):
1. Visit /pricing, click a tier
2. Complete Stripe checkout with test card `4242 4242 4242 4242`
3. Confirm webhook fires and portal redirect works

---

## 6. Rollback Procedure

### Backend Rollback (Railway)

**Option A: Railway Dashboard (Fastest)**
1. Go to the service > Deployments
2. Find the last known-good deployment
3. Click the three-dot menu > "Rollback"

**Option B: Railway CLI**
```bash
railway rollback
```

**Option C: Git Revert + Redeploy**
```bash
git revert HEAD
git push origin main
# Railway auto-deploys the revert
```

### Frontend Rollback (Vercel)

**Instant -- no rebuild required:**
1. Go to Vercel dashboard > Deployments
2. Find the last known-good deployment
3. Click three-dot menu > "Promote to Production"

### Database Rollback

Prisma does not support automatic migration rollback. If a migration must be reversed:

1. **Do NOT run `prisma migrate reset` in production** -- it drops all data
2. Create a backup before attempting any fix
3. Write a manual SQL script to reverse the specific migration changes
4. Remove the migration record:
   ```sql
   DELETE FROM _prisma_migrations WHERE migration_name = '<migration_name>';
   ```
5. Apply the reversal SQL
6. Redeploy the backend with the migration removed from the codebase

For data corruption, restore from the most recent Railway backup:
- Railway dashboard > Database service > Settings > Backups

### Rollback Decision Matrix

| Symptom | Action |
|---------|--------|
| Frontend broken, backend fine | Vercel rollback only |
| Backend 500s, no DB migration | Railway rollback only |
| Backend 500s after migration | Railway rollback + DB manual reversal |
| Both broken after deploy | Rollback both; investigate locally |
| Stripe webhooks failing | Check `STRIPE_WEBHOOK_SECRET`; may need re-deploy with correct value |

---

## 7. Common Issues and Fixes

### Backend Will Not Start

**Symptom:** Railway deploy fails or container exits immediately.

| Cause | Fix |
|-------|-----|
| `DATABASE_URL` not set | Add it in Railway service variables |
| `JWT_SECRET` missing or < 32 chars | Generate with `openssl rand -base64 48` |
| Prisma migration fails | Check logs for SQL error; fix migration or DB state |
| Port conflict | Railway injects `PORT` automatically; ensure `main.ts` uses `process.env.PORT` |
| Out of memory | Upgrade Railway plan or optimize queries |

### Frontend Build Fails on Vercel

**Symptom:** Vercel build log shows errors.

| Cause | Fix |
|-------|-----|
| TypeScript errors | Fix locally with `bun run build`, push fix |
| Missing env vars | Add `NEXT_PUBLIC_*` vars in Vercel dashboard |
| Dependency issue | Delete `node_modules` and `bun.lockb`, reinstall |
| Root directory wrong | Ensure Vercel root is set to `frontend/` |

### CORS Errors

**Symptom:** Browser console shows `Access-Control-Allow-Origin` errors.

| Cause | Fix |
|-------|-----|
| `FRONTEND_URL` not set in Railway | Set to `https://cerniq.io` |
| `ALLOWED_ORIGINS` missing | Set to `https://cerniq.io` (CSV for multiple) |
| Preview deploys blocked | Set `ALLOW_PREVIEW_ORIGINS=true` temporarily for testing |

### Stripe Webhooks Failing

**Symptom:** Stripe dashboard shows failed webhook deliveries.

| Cause | Fix |
|-------|-----|
| Wrong `STRIPE_WEBHOOK_SECRET` | Copy the correct `whsec_...` from Stripe dashboard |
| Endpoint URL wrong | Must be `https://api.cerniq.io/api/billing/webhook` |
| Backend not running | Check Railway deployment status |
| Raw body parsing | Verify `main.ts` has `rawBody: true` in NestFactory.create options |

### Magic Link / Auth Issues

**Symptom:** Users cannot log in via magic link.

| Cause | Fix |
|-------|-----|
| JWT_SECRET mismatch | Ensure same value across all Railway services |
| Cookie domain wrong | Set `AUTH_COOKIE_DOMAIN=.cerniq.io` |
| Token expired | Default TTL may be too short; check implementation |
| HTTPS not enforced | Set `AUTH_COOKIE_SECURE=true` |

### Pipeline Not Processing Jobs

**Symptom:** Report jobs stay in `QUEUED` status.

| Cause | Fix |
|-------|-----|
| Cron not running | Verify `ScheduleModule` is imported in `app.module.ts` |
| R2 credentials invalid | Check `R2_ENDPOINT`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` |
| PDF generation crash | Check Railway logs for stack trace; common: missing fonts |
| Job stuck in PROCESSING | Stalled job detector resets after 30 min (max 3 retries) |

### Email Not Sending

**Symptom:** Welcome/report emails never arrive.

| Cause | Fix |
|-------|-----|
| `RESEND_API_KEY` not set | Add in Railway env vars |
| Domain not verified | Verify `cerniq.io` in Resend dashboard |
| Rate limited | Check Resend dashboard for quota/errors |
| Spam folder | Check spam; add SPF/DKIM records for `cerniq.io` |

### API Custom Domain / TLS Issues

**Symptom:** `https://api.cerniq.io/api/v1/health` returns 404, shows
`x-railway-fallback`, or presents a certificate for `*.up.railway.app`.

| Cause | Fix |
|-------|-----|
| `api.cerniq.io` CNAME points at a deleted Railway target | In Spaceship, point `api.cerniq.io` to the current Railway custom-domain target. As of 2026-05-18 the valid target is `lnybhd8b.up.railway.app.` |
| Railway verification TXT is stale | In Spaceship, update `_railway-verify.api.cerniq.io` to the current TXT value from Railway's custom-domain screen |
| Cert issuance still pending | Wait 5-30 minutes after Railway sees the correct CNAME/TXT, then verify SAN includes `DNS:api.cerniq.io` |
| Wrong health path | Use `/api/v1/health`; `/api/health` on `cerniq.io` is a frontend route and does not prove backend reachability |

Verification:

```bash
dig +short api.cerniq.io CNAME
curl -sS https://api.cerniq.io/api/v1/health
curl -sS https://cerniq.io/api/v1/health
echo | openssl s_client -servername api.cerniq.io -connect api.cerniq.io:443 2>/dev/null \
  | openssl x509 -noout -subject -ext subjectAltName -dates
```

---

## 8. Emergency Contacts

| Service | URL | Purpose |
|---------|-----|---------|
| Railway | https://railway.app/dashboard | Backend hosting, database |
| Vercel | https://vercel.com/dashboard | Frontend hosting |
| Stripe | https://dashboard.stripe.com | Payments, webhooks |
| Resend | https://resend.com/overview | Transactional email |
| Cloudflare | https://dash.cloudflare.com | DNS, R2 storage |
| Spaceship | https://spaceship.com | Domain registrar (cerniq.io) |

---

## Deployment Log

| Date | Deployer | What Changed | Railway OK | Vercel OK | Notes |
|------|----------|--------------|------------|-----------|-------|
| 2026-05-18 | Codex | Re-pointed `api.cerniq.io` from dangling Railway target to `lnybhd8b.up.railway.app`; added `cerniq.io` CAA pins plus `klytics.io` CAA/report auth | Yes | Yes | Direct and Vercel-proxied `/api/v1/health` return `service: cerniq-api-v1`; cert SAN includes `api.cerniq.io` |
| | | | | | |
| | | | | | |
| | | | | | |
