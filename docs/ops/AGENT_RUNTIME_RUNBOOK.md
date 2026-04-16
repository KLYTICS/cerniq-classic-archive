# Agent Runtime Operations Runbook

> Source of truth for agent-layer infrastructure: provisioning, scaling, monitoring, and incident response.
>
> Last updated: 2026-04-15

---

## 1. Architecture Summary

```
Browser → Vercel (frontend) → Railway (NestJS API + Agent Workers)
                                         │
                       ┌─────────────────┼──────────────────┐
                       │                 │                  │
                   Bull Queue       PostgreSQL (Neon)    Anthropic API
                   (Redis)          agent_runs            Claude opus/sonnet/haiku
                                    agent_audit_logs
                                    agent_alerts
                                    agent_schedules
```

All agent execution happens inside the NestJS process. For MVP, the Bull queue and agent workers run in the same Railway service. At scale (>50 concurrent runs), split workers to a dedicated Railway service.

---

## 2. Environment Variables

| Variable | Default | Required | Purpose |
|----------|---------|----------|---------|
| `ANTHROPIC_API_KEY` | — | YES | Claude API key |
| `ANTHROPIC_BETA_HEADER` | `tools-2024-04-04` | YES | Tool-use beta flag |
| `REDIS_URL` | — | YES (for queue) | Bull job queue backend |
| `DATABASE_URL` | — | YES | Prisma / agent tables |
| `AGENT_WORKER_CONCURRENCY` | `5` | NO | Parallel agent runs per worker |
| `MAX_AGENT_TOKENS` | `8192` | NO | Per-turn token limit sent to Claude |
| `LLM_COST_ALERT_THRESHOLD_USD` | `100` | NO | Monthly cost ceiling before ops alert |
| `AUDIT_LOG_RETENTION_DAYS` | `2555` (7yr) | NO | Append-only audit log TTL |
| `SSE_HEARTBEAT_INTERVAL_MS` | `30000` | NO | SSE keepalive ping interval |

---

## 3. Redis / Bull Queue Topology

**Queue name:** `agent-jobs`

**Priority mapping (Vol2 §ADR-003):**
- Priority 10: CRITICAL alerts (Risk Monitor finds breach)
- Priority 5: User-triggered queries (CFO Copilot, manual run)
- Priority 1: Scheduled runs (daily Risk Monitor, weekly Peer Intel)

**Dead-letter queue:** `agent-jobs-failed` — jobs that exhaust 3 retries land here. Check daily.

**Monitoring commands:**
```bash
# Queue depth
redis-cli -u $REDIS_URL LLEN bull:agent-jobs:wait

# Failed jobs
redis-cli -u $REDIS_URL LLEN bull:agent-jobs:failed

# Active workers
redis-cli -u $REDIS_URL SCARD bull:agent-jobs:active
```

**Alert threshold:** queue depth > 200 jobs → page oncall.

---

## 4. SSE Event Stream

**Endpoint:** `GET /api/v1/agents/:institutionId/stream`

**Keepalive:** Server sends `:heartbeat\n\n` every `SSE_HEARTBEAT_INTERVAL_MS` to prevent proxy/LB timeout.

**Event types:** `agent:queued`, `agent:started`, `agent:step`, `agent:completed`, `agent:failed`, `alert:new`, `alert:acknowledged`, `copilot:response`.

**Proxy config:** If behind Cloudflare/nginx, ensure:
- `proxy_buffering off;`
- `X-Accel-Buffering: no` header
- Connection timeout ≥ 120s

---

## 5. Cost Monitoring

**Target:** LLM cost < 10% of revenue at scale ($32K/mo at 200 institutions).

**Per-run tracking:** Every `agent_runs` row stores `cost_usd_cents`, `input_tokens`, `output_tokens`.

**Monthly rollup:** `GET /api/v1/agents/:institutionId/cost?month=2026-04`

**Alert flow:**
1. After each run, check cumulative monthly cost for institution.
2. If > `LLM_COST_ALERT_THRESHOLD_USD` → emit `cost:threshold` SSE event.
3. Dashboard surfaces warning badge.

---

## 6. Incident Severity Matrix (Vol3 §Incident Response)

| SEV | Definition | Response | Timeline |
|-----|-----------|----------|----------|
| 1 | Production down / data loss | All hands, rollback | Fix in 15min, RCA in 2h, postmortem in 24h |
| 2 | Agent producing wrong output / false positive alerts | Disable agent trigger, investigate | Fix + re-eval in 8h |
| 3 | Performance degradation (p95 > 2× target) | Engineer investigates | Fix in 24h |
| 4 | Minor bugs / UI issues | Backlog | Next sprint |

**Special rule — Audit log integrity (Vol2 §ADR-004):**
If any `agent_audit_logs` record appears modified or deleted:
→ Treat as SEV-1 immediately.
→ Notify legal counsel.
→ Preserve all database logs.
→ Do NOT attempt to "fix" audit records.

---

## 7. Performance Targets (Vol2 §Performance)

| Metric | Target | Alert At |
|--------|--------|----------|
| ALM Decision Agent p95 | < 45s | > 90s |
| Risk Monitor p95 | < 8s | > 20s |
| CFO Copilot p95 | < 6s | > 12s |
| Swarm model failure rate | < 2% | > 10% |
| Audit log write success | 100% | Any failure |
| Queue depth | < 50 | > 200 |
| LLM cost/institution/month | < $5 | > $10 |

---

## 8. Scaling Playbook

**Phase 1 (1–10 institutions):** Single Railway service, `AGENT_WORKER_CONCURRENCY=5`.

**Phase 2 (10–50 institutions):** Separate worker Railway service. Dockerfile worker stage:
```dockerfile
FROM node:20-alpine AS worker
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
CMD ["node", "dist/src/agents/worker.entrypoint.js"]
```

**Phase 3 (50+):** Horizontal worker scaling via Railway replicas. Redis Cluster for queue HA.

---

## 9. Rollback Procedure

1. Identify the broken deploy via `railway logs --tail 100`.
2. Revert via `railway rollback` to previous deployment.
3. If schema migration caused the issue: run `npx prisma migrate deploy` on the rollback version. Agent tables are additive-only; no destructive migrations allowed.
4. Verify: `curl -sf $API_URL/health` → `status:"ok"`.
5. Post-incident: update this runbook with what broke.
