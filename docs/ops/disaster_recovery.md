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

## Scenario 7 — Agent Execution Layer outage

**Symptoms:**
- `POST /api/v1/agents/:id/run` returns 5xx or times out
- Sentry shows `AgentRunnerService` errors or `LlmBridgeService` failures
- Agent queue depth climbs without draining (check `GET /api/v1/agents/:id/runs?status=QUEUED`)
- CFO Copilot responses time out or fallback to "data-only mode"

**Triage tree:**

1. **Anthropic API down?**
   ```bash
   curl -s https://status.anthropic.com/api/v2/status.json | jq '.status.indicator'
   # Expect: "none" (healthy). "minor"/"major"/"critical" → upstream issue.
   ```
   If yes, agents degrade gracefully — the LlmBridgeService logs
   `[DRY RUN]` and the Analyst falls back to data-only mode. No action
   required; monitor until upstream recovers. Consider posting a
   customer-facing status at status.cerniq.io.

2. **LLM cost cap tripped?** See `LLM_COST_INCIDENT.md` for the 3-state
   triage (OK → WARN → BLOCKED).

3. **Agent queue saturated?**
   ```bash
   curl -H "x-admin-key: $ADMIN_KEY" \
     "https://api.cerniq.io/api/admin/audit-logs?resource=agent_run&action=RUN_STARTED&limit=100" \
     | jq '[.[] | select(.metadata.status == "QUEUED")] | length'
   ```
   If queue depth > 50, agents are backing up. Check:
   ```sql
   SELECT agent_id, COUNT(*) AS queued
   FROM agent_runs
   WHERE status IN ('QUEUED', 'RUNNING')
   GROUP BY agent_id ORDER BY queued DESC;
   ```
   Bump `AGENT_WORKER_CONCURRENCY` (default 5, max 50 per Zod schema):
   ```bash
   railway variables --set AGENT_WORKER_CONCURRENCY=15 \
     --service cerniq-api --environment production
   ```
   Railway redeploys and drains faster.

4. **Tool registry error?** Errors like "tool X not found" mean the
   agent-tool registry has drifted. Run the agent-smoke script:
   ```bash
   ADMIN_KEY=$ADMIN_KEY API_BASE=https://api.cerniq.io \
     bash scripts/agent-smoke.sh
   ```
   If it fails on a specific tool, check `src/agents/registry/tools/`
   for that tool's registration.

5. **Audit chain tamper detected?** Regulator-grade tamper evidence
   fires at the DB level via RLS append-only guard
   (`20260415130000_agent_tables_rls`). If somehow UPDATE/DELETE hits
   `agent_audit_logs`, alerts fire. Response: **IMMEDIATE SEV-1 — do
   not proceed with any agent runs until the breach is understood.**
   Query:
   ```sql
   SELECT run_id, step_index, prev_hash, hash, step_kind
   FROM agent_audit_logs
   WHERE run_id = '<run>' ORDER BY step_index;
   -- Verify hash chain: each row's prev_hash must equal the prior row's hash.
   ```

**Recovery:** Agent layer is stateless between runs. Restart clears
in-memory queue state (pending runs resume from DB on boot). Already-
completed runs' audit chains are immutable by design.

---

## Scenario 8 — Data Subject Rights (GDPR / COSSEC Right-to-Erasure)

**Trigger:** Customer emails `privacy@cerniq.io` requesting deletion,
portable export, or access to their personal data.

**SLA:** GDPR requires response within **30 days**. COSSEC's analog
under PR Act 97-2024 is **45 days**. Practical internal target: **7
business days**.

**Procedure — Erasure request:**

1. **Verify identity.** The requester must prove they control the
   email associated with the user record. Send a confirmation link
   via Resend; require click-through before proceeding.

2. **Identify scope.** A single customer touches:
   - `users` (primary record)
   - `institutions` they own (may be shared with workspaces)
   - `workspaces` + `workspace_members` they're linked to
   - `audit_logs` (retained 7 years by `RETENTION_AUDIT_LOGS_DAYS` —
     see §4 below)
   - `agent_runs` + `agent_audit_logs` for their institutions
   - `leads` if they were a prospect
   - `conversation_history` for analyst chat
   - `report_artifacts` and uploaded balance sheets

3. **Dry-run the deletion** in a transaction on staging first:
   ```sql
   BEGIN;
   -- Dry run — use ROLLBACK at the end to verify cascade before commit
   DELETE FROM users WHERE id = '<userId>';
   -- Prisma ON DELETE CASCADE handles workspace_members, etc.
   -- Manually handle: reassign institutions to a sibling admin, or
   -- mark the institution as "offboarded" and anonymize.
   ROLLBACK;
   ```

4. **Audit logs CANNOT be deleted** (regulator requirement for 7-year
   retention). Instead, pseudonymize: replace `user_id` references in
   audit rows with a deterministic hash. This preserves the audit
   chain while satisfying the user's erasure right. Document the
   pseudonymization in the erasure response.

5. **Execute** against production in a 1-institution-at-a-time
   transaction so a partial failure doesn't leave orphaned data.

6. **Send confirmation** to the customer within 7 business days with:
   - Confirmation of deletion
   - Explanation of pseudonymized audit retention (required by law)
   - List of 3rd-party processors that received their data (Anthropic
     for LLM calls — request deletion; Resend for email delivery;
     Stripe for billing — Stripe has its own retention policy)

**Procedure — Portable export request:**

```bash
# Generates a tarball of all records owned by the user
ADMIN_KEY=$ADMIN_KEY ./scripts/export-user-data.sh <userId>
# Emails the tarball via Resend to the verified email on file
```

(TODO: `export-user-data.sh` doesn't exist yet — file as a follow-up
blocker for the first production GDPR request. The procedure is SQL
queries against the table list in step 2, formatted as JSON.)

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
