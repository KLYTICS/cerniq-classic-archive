# Agent-Layer Going-Live Checklist

> 12-item master checklist for going live with the agent execution layer.
> Mirrors the format of `docs/ops/GETTING_LIVE.md` §13.
>
> Source: Vol3 §Appendix: Master Checklist — Going Live
>
> Last updated: 2026-04-15

---

## Pre-Flight Checklist

Every item must be checked before onboarding any client to the agent layer.

### Agent Core

- [ ] **ALM Decision Agent golden tests pass (score ≥ 85%)**
  ```bash
  cd backend-node
  npx jest test/agent-evals/alm-decision.eval.spec.ts --runInBand
  ```
  Gate: average weighted score ≥ 85%. No individual case < 80%.

- [ ] **Audit logs: every tool call has before + after entry**
  ```bash
  # After a test run:
  psql $DATABASE_URL -c "
    SELECT r.id, COUNT(*) AS steps
    FROM agent_runs r JOIN agent_audit_logs l ON l.run_id = r.id
    WHERE r.status = 'SUCCEEDED'
    GROUP BY r.id
    HAVING COUNT(*) < r.tool_call_count * 2
  "
  ```
  Gate: zero rows returned (every tool call has 2 audit entries).

- [ ] **Multi-tenant RLS tested with 2 institution IDs**
  ```bash
  # Attempt cross-tenant read — must return empty / 403:
  curl -sf -H "Authorization: Bearer $JWT_INST_A" \
    "$API_URL/api/v1/agents/$INST_B_ID/runs" | jq '.runs | length'
  ```
  Gate: returns 0 runs (RLS blocks cross-tenant access).

### Real-Time

- [ ] **SSE stream: progress events fire during run**
  ```bash
  # In one terminal:
  curl -N -H "Authorization: Bearer $JWT" "$API_URL/api/v1/agents/$INST_ID/stream"
  # In another terminal:
  curl -X POST -H "Authorization: Bearer $JWT" \
    -H "Content-Type: application/json" \
    -d '{"agentId":"ALM_DECISION","triggerKind":"API"}' \
    "$API_URL/api/v1/agents/$INST_ID/run"
  ```
  Gate: SSE terminal shows `agent:started`, `agent:step` (multiple), `agent:completed`.

### Risk Monitoring

- [ ] **Risk Monitor daily cron fires correctly**
  ```bash
  # Verify recent scheduled runs exist (cron is global @9am AST daily/weekly/monthly):
  curl -sf -H "Authorization: Bearer $JWT" \
    "$API_URL/api/v1/agents/$INST_ID/runs?agentId=RISK_MONITOR&limit=3" \
    | jq '.runs[] | {status, triggerKind, createdAt}'
  ```
  Gate: at least one run with `triggerKind: "SCHEDULE"` in the last 24h. If none: check `AGENT_SCHEDULER_DISABLED` env var is not set, and that the institution has a balance sheet uploaded (scheduler only dispatches to active institutions).

- [ ] **Alerts deduplicate within 24h window**
  ```bash
  # Run Risk Monitor twice in quick succession:
  curl -X POST ... '{"agentId":"RISK_MONITOR","triggerKind":"API"}' # run 1
  sleep 5
  curl -X POST ... '{"agentId":"RISK_MONITOR","triggerKind":"API"}' # run 2
  # Check alert count:
  curl -sf ... "$API_URL/api/v1/agents/$INST_ID/alerts?ack=false" | jq 'length'
  ```
  Gate: alert count from run 2 does NOT double. Dedup key collapses identical alerts.

### Reports

- [ ] **Committee Report bilingual PDF generates in < 2 minutes**
  ```bash
  time curl -X POST ... '{"agentId":"COMMITTEE_REPORT","triggerKind":"API","params":{"sourceRunId":"...","language":"bilingual"}}'
  ```
  Gate: response within 120s, PDF accessible at returned path.

### Performance

- [ ] **ALM Decision Agent p95 < 45 seconds on real balance sheet**
  ```bash
  # Check last 20 runs:
  psql $DATABASE_URL -c "
    SELECT percentile_cont(0.95) WITHIN GROUP (ORDER BY duration_ms)
    FROM agent_runs WHERE agent_id = 'ALM_DECISION' AND status = 'SUCCEEDED'
    ORDER BY created_at DESC LIMIT 20
  "
  ```
  Gate: p95 < 45000ms.

### Error Handling

- [ ] **Partial swarm failure does not crash the run**
  Gate: run with 1+ model failures still produces output with `confidence < 100` flag.

### Cost

- [ ] **LLM cost tracking populated on every run**
  ```bash
  psql $DATABASE_URL -c "
    SELECT COUNT(*) FROM agent_runs
    WHERE status = 'SUCCEEDED' AND cost_usd_cents IS NULL
  "
  ```
  Gate: zero rows (every completed run has cost).

### Migration Safety

- [ ] **Database migration can be reversed without data loss**
  Gate: `npx prisma migrate diff` shows no destructive operations on agent tables.

### Client Auth

- [ ] **Only institution data visible to matching JWT**
  Gate: same as RLS test above, verified from the UI with two different user accounts.

### Demo

- [ ] **CFO can upload → view results → ack alert → generate report (unassisted)**
  Gate: manual walkthrough with zero errors, zero confusion. Timed < 5 minutes.

---

## Smoke Script

After going live, run the automated smoke:

```bash
bash scripts/agent-smoke.sh $API_URL $JWT $INST_ID
```

This script:
1. Triggers `ALM_DECISION` run
2. Polls until `SUCCEEDED` (timeout 120s)
3. Asserts audit trace row count ≥ 12 (6 tools × before+after)
4. Asserts `cost_usd_cents > 0`
5. Attempts cross-tenant fetch with different JWT → asserts 403 or empty
6. Reports PASS/FAIL with timing
