# CerniQ Incident Response Runbook

## Quick Reference

| Service | URL | Health Check |
|---------|-----|--------------|
| **Frontend** | https://cerniq.io | `curl https://cerniq.io` |
| **Backend API** | https://api.cerniq.io | `curl https://api.cerniq.io/health` |
| **Railway Dashboard** | https://railway.app | Backend + DB + Redis |
| **Vercel Dashboard** | https://vercel.com | Frontend deployments |
| **Sentry** | https://sentry.io | Error tracking |
| **Stripe Dashboard** | https://dashboard.stripe.com | Billing events |

---

## 1. Backend Down (api.cerniq.io unresponsive)

### Symptoms
- `/health` returns 5xx or timeout
- Frontend shows "Network Error" on all API calls
- Sentry shows connection errors

### Triage Steps
```bash
# 1. Check Railway service status
railway status --service backend-node

# 2. Check logs for crash reason
railway logs --service backend-node --tail 100

# 3. Check if DB is reachable from Railway
railway run --service backend-node -- node -e "
  const { PrismaClient } = require('@prisma/client');
  new PrismaClient().\$queryRaw\`SELECT 1\`.then(() => console.log('DB OK')).catch(e => console.error('DB FAIL', e.message))
"

# 4. Check Redis
railway run --service backend-node -- node -e "
  const Redis = require('ioredis');
  const r = new Redis(process.env.REDIS_URL);
  r.ping().then(p => { console.log('Redis:', p); r.quit() }).catch(e => console.error('Redis FAIL', e.message))
"
```

### Fix Actions
| Cause | Fix |
|-------|-----|
| OOM (memory limit exceeded) | Restart service: `railway up` or redeploy from dashboard |
| DB connection pool exhausted | Restart service. Check `DATABASE_POOL_SIZE` (default 20) |
| Bad deployment | Roll back: Railway Dashboard → Deployments → Previous → Redeploy |
| Missing env var | Railway Dashboard → Variables → verify all required vars exist |
| Prisma migration failed | `railway run -- npx prisma migrate deploy` |

---

## 2. Failed Report Job

### Symptoms
- Report job stuck in PROCESSING or FAILED status
- Client portal shows "Processing..." indefinitely
- No PDF in R2 storage

### Triage Steps
```bash
# 1. Check job status in DB
railway run --service backend-node -- npx prisma studio
# → Open report_jobs table, filter by status = FAILED

# 2. Check job error in logs
railway logs --service backend-node --tail 500 | grep -i "report\|pdf\|pipeline"

# 3. Check R2 connectivity
railway run --service backend-node -- node -e "
  console.log('R2_ENDPOINT:', process.env.R2_ENDPOINT ? 'SET' : 'MISSING');
  console.log('R2_ACCESS_KEY:', process.env.R2_ACCESS_KEY_ID ? 'SET' : 'MISSING');
"
```

### Fix Actions
| Cause | Fix |
|-------|-----|
| R2 credentials expired | Rotate in Cloudflare dashboard, update Railway env vars |
| PDF generation OOM | Increase Railway service memory limit |
| CSV parse error | Check ingestion_logs for the job's institution — fix CSV format |
| Job stuck in PROCESSING | Force-fail via admin API: `curl -X POST https://api.cerniq.io/admin/api/pipeline/{jobId}/force-fail -H "x-admin-key: $ADMIN_KEY"` |
| Resend email failed | Check RESEND_API_KEY, verify domain in Resend dashboard |

---

## 3. Stripe Webhook Failures

### Symptoms
- Stripe Dashboard → Webhooks → shows failed deliveries
- Customer paid but subscription not activated
- No welcome email sent

### Triage Steps
```bash
# 1. Check Stripe webhook logs
# Stripe Dashboard → Developers → Webhooks → Events

# 2. Check webhook signature
railway logs --service backend-node | grep "webhook.signature_failed"

# 3. Check processed events (dedup table)
railway run --service backend-node -- npx prisma studio
# → Open processed_webhook_events table
```

### Fix Actions
| Cause | Fix |
|-------|-----|
| Signature mismatch | Verify `STRIPE_WEBHOOK_SECRET` matches Stripe Dashboard endpoint secret |
| Endpoint URL wrong | Stripe Dashboard → Webhooks → verify URL is `https://api.cerniq.io/api/billing/webhook` |
| Duplicate event skipped | Check `processed_webhook_events` table — event already processed (expected behavior) |
| Missing subscription | Manually create: admin panel or Prisma Studio |

---

## 4. JWT Secret Rotation (Zero Downtime)

### Steps
```bash
# 1. Generate new secret
NEW_SECRET=$(openssl rand -hex 32)

# 2. Set new secret in Railway (does NOT restart yet)
railway variables set JWT_SECRET="$NEW_SECRET" --service backend-node

# 3. Deploy (will use new secret)
railway up --service backend-node

# 4. Existing tokens (signed with old secret) will fail on next request
# Users will need to re-login. Refresh tokens are rotated automatically.

# IMPORTANT: If you need true zero-downtime rotation,
# implement dual-key verification in auth.guard.ts first.
```

---

## 5. Database Backup & Restore

### Railway Automated Backups
```bash
# Railway provides automated daily backups (Pro plan)
# Railway Dashboard → Database → Backups → Download

# Manual backup via pg_dump
railway run --service postgres -- pg_dump -U cerniq cerniq > backup_$(date +%Y%m%d).sql
```

### Restore
```bash
# WARNING: This replaces all data
railway run --service postgres -- psql -U cerniq cerniq < backup_20260328.sql

# After restore, verify:
railway run --service backend-node -- npx prisma migrate deploy
curl https://api.cerniq.io/health
```

---

## 6. Common Error Codes

| Error Code | Meaning | Action |
|------------|---------|--------|
| `ALM_EMPTY_BALANCE_SHEET` | No balance sheet data provided | Client needs to upload CSV first |
| `ALM_NO_ASSETS` | Balance sheet has no asset items | Check CSV format — needs asset rows |
| `ALM_NO_LIABILITIES` | Balance sheet has no liability items | Check CSV format — needs liability rows |
| `UNAUTHORIZED` | JWT expired or invalid | Re-login or refresh token |
| `FORBIDDEN` | User lacks role for this action | Check RBAC (OWNER/ANALYST/VIEWER) |
| `TOO_MANY_REQUESTS` | Rate limit exceeded | Wait and retry. Per-user: 100 req/min |
| `CONFLICT` | Duplicate resource | Check unique constraints (e.g., same institution name) |

---

## 7. Escalation Matrix

| Severity | Response Time | Who |
|----------|---------------|-----|
| **P0** — Platform down | 15 min | Erwin (eskiessalfonso@gmail.com) |
| **P1** — Feature broken (billing, reports) | 1 hour | Erwin |
| **P2** — Degraded performance | 4 hours | Next business day |
| **P3** — Cosmetic / non-blocking | 24 hours | Sprint backlog |

---

## 8. Health Check Script

```bash
#!/bin/bash
# Run periodically via cron or monitoring
echo "=== CerniQ Health ==="
API=$(curl -s -o /dev/null -w '%{http_code}' https://api.cerniq.io/health)
FE=$(curl -s -o /dev/null -w '%{http_code}' https://cerniq.io)
echo "API: $API"
echo "Frontend: $FE"

if [ "$API" != "200" ] || [ "$FE" != "200" ]; then
  echo "ALERT: Service degraded"
  # Send alert via email/Slack
fi
```
