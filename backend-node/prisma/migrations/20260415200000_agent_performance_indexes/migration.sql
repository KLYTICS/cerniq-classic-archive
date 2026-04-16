-- Agent Performance Indexes (Terminal F3)
-- Optimizes the hot-path queries surfaced by the agent-api layer:
--   1. "Recent runs for this institution" (agent-runs.controller GET /runs)
--   2. "Open alerts by severity" (alerts.controller GET /alerts)
--   3. "Audit chain for a run" (export.controller GET /trace)
--   4. "Dedup check on alert creation" (risk-monitor agent)
--   5. "Cost rollup per institution per month" (cost-summary API)

-- ═══ agent_runs ═══════════════════════════════════════════════════════
-- Composite covering index for the runs-list endpoint filtered by agent
-- type and date range. INCLUDE output avoids a heap lookup for the list
-- view that only shows summary fields.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_agent_runs_inst_agent_created
  ON agent_runs (institution_id, agent_id, created_at DESC)
  INCLUDE (status, duration_ms, cost_usd_cents);

-- Partial index for active runs (QUEUED/RUNNING) — the queue poller
-- and SSE "is anything running?" check both hit this.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_agent_runs_active
  ON agent_runs (status, created_at)
  WHERE status IN ('QUEUED', 'RUNNING');

-- Cost rollup: monthly cost per institution, partitioned by agent.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_agent_runs_cost_rollup
  ON agent_runs (institution_id, agent_id, created_at)
  WHERE cost_usd_cents IS NOT NULL AND status = 'SUCCEEDED';

-- ═══ agent_audit_logs ═════════════════════════════════════════════════
-- The trace viewer and regulator export walk the chain in step_index order.
-- B-tree on (run_id, step_index) already exists via @@unique; add a
-- covering index that includes the hash for chain-verification reads
-- without touching the payload column (which can be large).
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_agent_audit_chain_verify
  ON agent_audit_logs (run_id, step_index)
  INCLUDE (prev_hash, hash, step_kind);

-- Tool-name index for "which runs called this tool?" analytics.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_agent_audit_tool
  ON agent_audit_logs (tool_name, created_at DESC)
  WHERE tool_name IS NOT NULL;

-- ═══ agent_alerts ═════════════════════════════════════════════════════
-- The alert feed shows open alerts sorted by severity + recency.
-- Partial index excludes resolved/suppressed alerts from the hot path.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_agent_alerts_open_feed
  ON agent_alerts (institution_id, severity, created_at DESC)
  WHERE status IN ('OPEN', 'ACKNOWLEDGED');

-- Dedup check: the risk-monitor agent checks for existing OPEN alerts
-- with the same dedup_key before creating a new one.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_agent_alerts_dedup
  ON agent_alerts (institution_id, dedup_key)
  WHERE status = 'OPEN';

-- ═══ Audit log retention (partial index for cleanup job) ═════════════
-- The data-retention cron job (src/jobs/data-retention.service.ts) needs
-- to find audit logs older than AUDIT_LOG_RETENTION_DAYS (default 2555 =
-- 7 years). Partial index on created_at < now() - interval scopes the
-- scan to the cold tail without touching recent hot data.
-- This is a static index; the cron job queries:
--   WHERE created_at < now() - interval '2555 days'
-- which only matches rows in the retention window.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_agent_audit_retention
  ON agent_audit_logs (created_at)
  WHERE created_at < (now() - interval '2555 days');
