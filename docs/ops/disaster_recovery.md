# CERNIQ — Disaster Recovery Runbook

> **Classification:** Internal — Operations
> **Owner:** Engineering
> **Last Updated:** March 2026

---

## RPO / RTO Targets

| Metric | Target | Basis |
|--------|--------|-------|
| **RPO** (Recovery Point Objective) | **1 hour** | Maximum acceptable data loss |
| **RTO** (Recovery Time Objective) | **4 hours** | Maximum acceptable downtime |
| **Backup Frequency** | Daily full + continuous WAL | Railway Postgres automated |
| **Backup Retention** | 30 days | Railway plan default |

---

## Infrastructure Map

| Component | Provider | Region | Backup Method |
|-----------|----------|--------|---------------|
| PostgreSQL 15 | Railway | us-east-1 | Automated daily snapshots + WAL archiving |
| Redis 7 | Railway | us-east-1 | AOF persistence (append-only file) |
| Frontend (Next.js) | Vercel | Global edge | Git-based (redeploy from any commit) |
| Object Storage (PDFs) | Cloudflare R2 | Global | R2 built-in redundancy (3-AZ) |
| Email | Resend | N/A | Stateless (no backup needed) |
| Payments | Stripe | N/A | Stripe-managed (webhook replay available) |

---

## Scenario 1 — Database Corruption or Data Loss

**Symptoms:** Application errors, missing records, inconsistent data

**Recovery Steps:**

```bash
# 1. Assess damage scope
railway connect --service postgres
SELECT COUNT(*) FROM users;
SELECT COUNT(*) FROM institutions;
SELECT COUNT(*) FROM report_jobs WHERE status = 'PROCESSING';

# 2. Restore from Railway backup
#    Railway Dashboard → Project → Postgres → Backups → Select point-in-time
#    Click "Restore" → creates new database instance

# 3. Update DATABASE_URL to point to restored instance
railway variables set DATABASE_URL=<new_connection_string> --service backend-node

# 4. Verify data integrity
railway run --service backend-node npx prisma migrate status
railway run --service backend-node -- node -e "
  const { PrismaClient } = require('@prisma/client');
  const p = new PrismaClient();
  Promise.all([
    p.user.count(),
    p.institution.count(),
    p.reportJob.count(),
  ]).then(([u,i,r]) => console.log({users:u, institutions:i, jobs:r}));
"

# 5. Resume traffic
railway up --service backend-node
```

**Post-incident:** Run `bash scripts/health-check.sh` to verify all endpoints.

---

## Scenario 2 — Backend Service Down

**Symptoms:** API returning 5xx, health check fails, Railway shows crash loops

**Recovery Steps:**

```bash
# 1. Check Railway logs
railway logs --service backend-node --tail 200

# 2. Check if it's a deployment issue (rollback to last known good)
railway rollback --service backend-node

# 3. If rollback doesn't work, redeploy from known good commit
git log --oneline -10   # find last working commit
railway up --service backend-node --ref <commit_sha>

# 4. If database is the issue, check connectivity
railway run --service backend-node -- node -e "
  require('pg').Pool({connectionString: process.env.DATABASE_URL})
    .query('SELECT 1')
    .then(() => console.log('DB OK'))
    .catch(e => console.error('DB FAIL:', e.message));
"

# 5. Verify recovery
curl -sf https://api.cerniq.io/health | python3 -m json.tool
bash scripts/health-check.sh
```

---

## Scenario 3 — Frontend Down

**Symptoms:** cerniq.io returning errors, Vercel dashboard shows build failures

**Recovery Steps:**

```bash
# 1. Check Vercel deployment status
vercel ls --scope ekiess-projects | head -10

# 2. Rollback to previous deployment
vercel rollback --scope ekiess-projects

# 3. If rollback fails, redeploy from git
cd frontend && vercel --prod

# 4. Verify
curl -sI https://cerniq.io | head -5
```

**Note:** Vercel has automatic rollback. Most frontend issues self-resolve within 2-3 minutes.

---

## Scenario 4 — Redis Cache Failure

**Symptoms:** Slow responses, rate limiting not working, cache misses

**Recovery Steps:**

```bash
# 1. Check Redis connectivity from backend
railway logs --service backend-node | grep -i redis

# 2. Redis is non-critical — backend degrades gracefully
#    Rate limiting falls back to in-memory
#    Cache misses hit database directly
#    No data loss — Redis is ephemeral cache only

# 3. If Redis needs restart
railway restart --service redis

# 4. Verify cache is working
curl -s https://api.cerniq.io/health | python3 -c "
import sys,json; d=json.load(sys.stdin).get('data',{}); print('Cache:', d.get('services',{}).get('cache','?'))
"
```

---

## Scenario 5 — Stripe Webhook Delivery Failure

**Symptoms:** Payments processed but subscriptions not provisioned

**Recovery Steps:**

```bash
# 1. Check Stripe Dashboard → Developers → Webhooks → Event attempts
#    Look for failed deliveries with HTTP != 200

# 2. Replay failed events from Stripe Dashboard
#    Stripe retries automatically for up to 72 hours

# 3. If idempotency table needs cleanup (stuck events):
railway connect --service postgres
SELECT * FROM processed_webhook_events ORDER BY processed_at DESC LIMIT 20;
-- Delete stuck event to allow reprocessing:
-- DELETE FROM processed_webhook_events WHERE id = 'evt_stuck_id';

# 4. Verify subscription state
ADMIN_KEY=<your_admin_key>
curl -H "x-admin-key: $ADMIN_KEY" https://api.cerniq.io/api/admin/stats | python3 -m json.tool
```

---

## Scenario 6 — Secret Compromise

**Symptoms:** Unauthorized access detected, suspicious audit logs

**Immediate Actions:**

```bash
# 1. Rotate JWT_SECRET (forces logout of all users)
railway variables set JWT_SECRET=$(openssl rand -base64 48) --service backend-node

# 2. Rotate ADMIN_KEY
railway variables set ADMIN_KEY=$(openssl rand -hex 32) --service backend-node

# 3. Rotate Stripe keys in Stripe Dashboard → roll API keys
#    Update STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET in Railway

# 4. Force redeploy
railway up --service backend-node

# 5. Review audit logs for unauthorized activity
ADMIN_KEY=<new_admin_key>
curl -H "x-admin-key: $ADMIN_KEY" \
  "https://api.cerniq.io/api/admin/audit-logs?limit=100" | python3 -m json.tool
```

---

## Backup Verification Schedule

| Task | Frequency | Owner |
|------|-----------|-------|
| Verify Railway backups exist | Weekly | Engineering |
| Test restore to staging | Monthly | Engineering |
| Review audit logs for anomalies | Weekly | Engineering |
| Rotate non-critical secrets | Quarterly | Engineering |
| Full DR drill (restore + verify) | Quarterly | Engineering + Ops |

---

## Escalation Contacts

| Role | Responsibility |
|------|---------------|
| Engineering Lead | First responder — all scenarios |
| Railway Support | Database restore, infrastructure issues |
| Vercel Support | Frontend deployment issues |
| Stripe Support | Payment processing, webhook issues |

---

## Post-Incident Template

After any incident, create a post-mortem with:

1. **Timeline:** When detected → when resolved
2. **Impact:** Users affected, data lost, revenue impact
3. **Root cause:** What failed and why
4. **Resolution:** What fixed it
5. **Prevention:** What changes prevent recurrence
6. **Action items:** With owners and deadlines

Store post-mortems in `docs/ops/incidents/YYYY-MM-DD-description.md`.

---

*Part of: CERNIQ Enterprise Operations Documentation*
*See also: deployment_runbook.md, schema_migration_policy.md, e2e_production_gate.md*
