# Migration Rollback Runbook

**Version:** 1.0
**Date:** 2026-04-17
**Audience:** On-call operator, engineering lead
**SLA:** Decide rollback-vs-forward within 15 min of detection

Prisma's standard flow is forward-only. When a migration fails mid-deploy
or deploys but breaks production behavior, there's no `prisma migrate
rollback` command — you must choose between a forward-fix and a manual
SQL rollback. This runbook documents both paths.

## Decision tree (first 15 minutes)

```
Migration just deployed and something is broken
    ├─ Is the migration a PURE additive (CREATE TABLE / ADD COLUMN / CREATE INDEX)?
    │      ├─ YES → Forward-fix preferred. New migration that patches the break.
    │      │       Migration stays applied. Less risk of data loss.
    │      └─ NO → Evaluate destructive rollback (see below)
    │
    ├─ Did the migration complete OR fail mid-deploy?
    │      ├─ Failed mid-deploy → `_prisma_migrations.finished_at = NULL`
    │      │       Prisma will retry on next boot. Fix underlying cause FIRST.
    │      │       If the cause is in the migration SQL itself, see "Resolve-as-rolled-back"
    │      └─ Completed but breaks app logic → Forward-fix in almost all cases
    │
    └─ Is customer data at risk?
           ├─ YES → STOP. Escalate to engineering lead. No auto-action.
           └─ NO → Continue with rollback path below
```

**General rule: forward-fix is 10× safer than rollback.** A forward-fix
only adds to the schema (new column, new index, new table). A rollback
DROPs — and if any data wrote to the dropped object in the intervening
minutes, that data is gone.

## Path A — Forward-fix (preferred)

Example: `20260415200000_agent_performance_indexes` failed because a
partial-index predicate used `now()` (non-IMMUTABLE — PG rejects).

1. Identify the specific SQL statement that failed:
   ```bash
   railway logs --service cerniq-api --environment production \
     | grep -A 3 "ERROR" | head -40
   ```

2. Write a new migration that patches the problem. For the indexes
   example:
   ```bash
   cd backend-node
   npx prisma migrate dev --name fix_agent_perf_index_predicate --create-only
   # Edit the generated migration.sql to DROP the broken index + CREATE the fixed one
   ```

3. Commit + push — the next deploy picks up both the original
   (marked finished) AND the new fix migration.

4. Verify:
   ```sql
   SELECT * FROM _prisma_migrations
   WHERE migration_name LIKE 'fix_%'
   ORDER BY finished_at DESC LIMIT 1;
   -- finished_at should be populated, rolled_back_at should be NULL
   ```

## Path B — Resolve-as-rolled-back (migration failed, needs to be retried)

Example: migration started on prod, ran half the statements, then
errored. `_prisma_migrations` shows:
- `finished_at = NULL`
- `logs` contains the error
- `rolled_back_at = NULL`

Prisma refuses to proceed past a failed migration, so subsequent
deploys loop-fail. Two exit paths:

### B1 — Mark failed migration as resolved (if partial state is OK)

```bash
railway run --service cerniq-api --environment production -- \
  npx prisma migrate resolve --applied 20260417010000_wave03_models
```

Use when: the migration's partial state is acceptable (e.g., 8 of 10
CREATE TABLEs applied, and the app can live with 8 tables until a
follow-up migration adds the remaining 2).

### B2 — Mark failed migration as rolled back + re-apply

```bash
# 1. Manually revert any partial DDL via psql
railway run --service cerniq-api --environment production -- \
  psql $DATABASE_URL -f /app/prisma/migrations/20260417010000_wave03_models/rollback.sql

# 2. Mark as rolled back in Prisma's history
railway run --service cerniq-api --environment production -- \
  npx prisma migrate resolve --rolled-back 20260417010000_wave03_models

# 3. Fix the migration SQL in a new commit
# 4. Deploy — Prisma retries the migration fresh
```

Use when: the migration's partial state breaks invariants (e.g.,
foreign keys point at non-existent tables).

## Path C — Full rollback (destructive, last resort)

For each of the 3 new migrations landed this session, the rollback
procedures differ. ALWAYS take a database snapshot BEFORE attempting:

```bash
railway run --service cerniq-api --environment production -- \
  pg_dump $DATABASE_URL --format=custom --file=/tmp/pre-rollback-$(date -u +%Y%m%dT%H%M%SZ).dump
# Download the dump locally:
railway shell --service cerniq-api --environment production \
  -- cat /tmp/pre-rollback-*.dump > ./local-snapshot.dump
```

### Rollback: `20260415130000_agent_tables_rls`

A `rollback.sql` already exists — run it via psql:

```bash
railway run --service cerniq-api --environment production -- \
  psql $DATABASE_URL -f /app/prisma/migrations/20260415130000_agent_tables_rls/rollback.sql
```

**Impact:** RLS policies dropped, audit_log UPDATE/DELETE restored.
Tenant isolation is NOW GONE at the DB layer — enforce at app layer or
put the app in maintenance mode before proceeding.

**Verification:** the rollback script ends with a `DO $$ ... RAISE
EXCEPTION ... RAISE NOTICE` block that verifies all three agent tables
have `rowsecurity = FALSE`.

Then mark Prisma:
```bash
railway run ... -- npx prisma migrate resolve --rolled-back 20260415130000_agent_tables_rls
```

### Rollback: `20260415200000_agent_performance_indexes`

No pre-written rollback.sql. Indexes are non-destructive to drop:

```sql
DROP INDEX IF EXISTS idx_agent_runs_inst_agent_created;
DROP INDEX IF EXISTS idx_agent_runs_active;
DROP INDEX IF EXISTS idx_agent_runs_cost_rollup;
DROP INDEX IF EXISTS idx_agent_audit_chain_verify;
DROP INDEX IF EXISTS idx_agent_audit_tool;
DROP INDEX IF EXISTS idx_agent_alerts_open_feed;
DROP INDEX IF EXISTS idx_agent_alerts_dedup;
DROP INDEX IF EXISTS idx_agent_audit_created_at;
```

**Impact:** query performance degrades (back to full-table scans on
audit + alerts). No data loss. App continues functioning.

### Rollback: `20260417010000_wave03_models`

**⚠️ MOST DESTRUCTIVE.** Drops 9+ tables + 8 enums + column adds on
existing tables. If any customer data wrote to these tables AFTER
deploy, this rollback **WILL LOSE THAT DATA**.

Pre-flight check — is it safe?
```sql
SELECT
  (SELECT COUNT(*) FROM cossec_exam_findings) AS cossec_rows,
  (SELECT COUNT(*) FROM cpa_firms) AS cpa_rows,
  (SELECT COUNT(*) FROM exam_readiness_assessments) AS exam_rows,
  (SELECT COUNT(*) FROM conversation_history) AS convo_rows,
  (SELECT COUNT(*) FROM rate_alert_thresholds) AS rate_rows;
-- If all are 0, rollback is safe. If any >0, engage engineering lead
-- before proceeding.
```

Rollback SQL (write to a new file before running):
```sql
-- DANGER: drops Wave-03 tables + enums. Only run if row counts above are 0.
BEGIN;

-- Drop foreign keys first
ALTER TABLE "cpa_client_relationships" DROP CONSTRAINT IF EXISTS "cpa_client_relationships_institution_id_fkey";
ALTER TABLE "cpa_firm_users" DROP CONSTRAINT IF EXISTS "cpa_firm_users_cpa_firm_id_fkey";
ALTER TABLE "cpa_firm_users" DROP CONSTRAINT IF EXISTS "cpa_firm_users_user_id_fkey";
ALTER TABLE "conversation_history" DROP CONSTRAINT IF EXISTS "conversation_history_institution_id_fkey";
ALTER TABLE "exam_readiness_assessments" DROP CONSTRAINT IF EXISTS "exam_readiness_assessments_institution_id_fkey";
ALTER TABLE "exam_category_scores" DROP CONSTRAINT IF EXISTS "exam_category_scores_assessment_id_fkey";
ALTER TABLE "webhook_delivery_logs" DROP CONSTRAINT IF EXISTS "webhook_delivery_logs_batch_id_fkey";
ALTER TABLE "rate_alert_thresholds" DROP CONSTRAINT IF EXISTS "rate_alert_thresholds_institution_id_fkey";

-- Drop tables in reverse dependency order
DROP TABLE IF EXISTS "rate_alert_thresholds";
DROP TABLE IF EXISTS "webhook_delivery_logs";
DROP TABLE IF EXISTS "enterprise_batches";
DROP TABLE IF EXISTS "exam_category_scores";
DROP TABLE IF EXISTS "exam_readiness_assessments";
DROP TABLE IF EXISTS "conversation_history";
DROP TABLE IF EXISTS "cpa_client_relationships";
DROP TABLE IF EXISTS "cpa_firm_users";
DROP TABLE IF EXISTS "cpa_firms";
DROP TABLE IF EXISTS "cossec_exam_findings";

-- Revert column additions
ALTER TABLE "institutions" DROP COLUMN IF EXISTS "last_ncua_sync_at";
ALTER TABLE "prospect_institutions" DROP COLUMN IF EXISTS "alm_risk_score";

-- Revert index rename
ALTER INDEX IF EXISTS "camel_certifications_institution_id_period_key"
  RENAME TO "institution_period_cert";

-- Drop enums
DROP TYPE IF EXISTS "CossecFindingSeverity";
DROP TYPE IF EXISTS "CpaTier";
DROP TYPE IF EXISTS "CpaUserRole";
DROP TYPE IF EXISTS "ConversationRole";
DROP TYPE IF EXISTS "ExamCategoryStatus";
DROP TYPE IF EXISTS "EnterpriseBatchStatus";
DROP TYPE IF EXISTS "EnterprisePriority";
DROP TYPE IF EXISTS "AlertDirection";

COMMIT;
```

After rollback:
```bash
railway run ... -- npx prisma migrate resolve --rolled-back 20260417010000_wave03_models
```

## Prevention — what to do BEFORE deploying a risky migration

1. **Shadow DB test.** `scripts/ci/check-schema-drift.sh` runs
   `prisma migrate diff` against an ephemeral shadow DB. If this
   passes, the migration applies cleanly on an empty DB. (This caught
   the CONCURRENTLY-inside-transaction bug on 2026-04-17.)

2. **Staging dry-run.** Apply the migration to a staging Postgres
   with production-like row counts. Measure time — if > 30s, split
   into multiple migrations or use `CREATE INDEX CONCURRENTLY`
   (requires Prisma workaround, see
   `20260415200000_agent_performance_indexes/migration.sql` header).

3. **Write the rollback.sql ALONGSIDE the migration.** Every
   destructive migration (DROP, RENAME, ALTER) should ship with a
   paired `rollback.sql` in the same directory.

4. **Require `--force` only for pure additives.** Rule of thumb: if
   `npm run prisma:status` shows the migration as adding a new
   CREATE-only object and no ALTER/DROP, it's safe to auto-apply.
   Anything else goes through the staging dry-run.

## Verification after rollback

```bash
# 1. App health
curl -sf https://api.cerniq.io/health | jq '.status'
# Expect: "healthy"

# 2. Prisma migration state
railway run ... -- npx prisma migrate status
# Expect: "Database schema is up to date"

# 3. Smoke the critical endpoints
bash scripts/agent-smoke.sh

# 4. Tail logs for 10 min looking for 5xx rate spikes
railway logs --service cerniq-api | grep '"statusCode":5' | wc -l
# Sample 3 times, 60s apart — rate should be < 1/min after rollback settles
```

## Post-incident requirements

Every rollback triggers a blameless post-mortem. Required sections:

1. **Timeline** — deploy time → detection → decision → rollback complete
2. **Which path** (A/B1/B2/C) and why
3. **Customer impact** — data lost? requests failed?
4. **Why the pre-deploy gates missed it** (shadow DB? staging?
   reviewer missed a clause?)
5. **Prevention** — what CI/process change prevents recurrence?

Store at `docs/ops/incidents/YYYY-MM-DD-migration-rollback-<name>.md`.

## 📂 Related

- [deployment_runbook.md](deployment_runbook.md) — production deploy procedure
- [schema_migration_policy.md](schema_migration_policy.md) — when migrations can auto-apply
- [disaster_recovery.md](disaster_recovery.md) — if the DB is CORRUPTED (different problem)
- Prisma docs: https://www.prisma.io/docs/orm/prisma-migrate/workflows/patching-and-hotfixing
