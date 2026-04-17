# Row-Level Security — Agent Tables

## Migration

File: `prisma/migrations/20260415130000_agent_tables_rls/migration.sql`

## Tables Protected

| Table | RLS Column | Policy Pattern |
|-------|-----------|----------------|
| `agent_runs` | `institution_id` | Direct match on GUC |
| `agent_audit_logs` | (via FK to `agent_runs`) | Sub-select through `agent_runs.institution_id` |
| `agent_alerts` | `institution_id` | Direct match on GUC |

## GUC Variables

| Variable | Set By | Scope |
|----------|--------|-------|
| `app.current_institution_id` | `TenantContextMiddleware` | `SET LOCAL` (per-transaction) |
| `app.admin_mode` | `TenantContextMiddleware` (admin routes) | `SET LOCAL` |

## Policies

Each table has:
1. **tenant_isolation_*** — `FOR ALL USING (institution_id = current_setting('app.current_institution_id', TRUE)::text)`
2. **admin_bypass_*** — `FOR ALL USING (current_setting('app.admin_mode', TRUE) = 'true')`

`agent_audit_logs` additionally has:
3. **allow_insert_agent_audit_logs** — `FOR INSERT WITH CHECK (TRUE)` (runner needs write access)
4. **REVOKE UPDATE, DELETE** from the application role (Vol.2 ADR-004 immutability)

## Verification

The migration includes a verification block that fails if RLS is not enabled on all three tables. To verify manually:

```sql
SELECT tablename, rowsecurity
FROM pg_tables
WHERE tablename IN ('agent_runs', 'agent_audit_logs', 'agent_alerts');
```

All three must show `rowsecurity = true`.

## Cross-Tenant Test

```sql
-- Set tenant A
SET LOCAL app.current_institution_id = 'inst-aaa';
SELECT count(*) FROM agent_runs;  -- Should only show inst-aaa rows

-- Set tenant B
SET LOCAL app.current_institution_id = 'inst-bbb';
SELECT count(*) FROM agent_runs;  -- Should only show inst-bbb rows

-- Verify audit immutability
UPDATE agent_audit_logs SET payload = '{}' WHERE id = 'any-id';
-- Expected: ERROR: permission denied for table agent_audit_logs
```
