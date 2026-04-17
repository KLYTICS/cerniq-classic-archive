# Agent Queue Runbook

## Current Architecture (In-Memory)

The agent queue (`src/queue/agent/agent-queue.service.ts`) uses an in-memory priority queue with the same pattern as the existing ALM compute queue (`src/queue/alm-compute.processor.ts`). This is intentional — Bull requires Redis, which is not yet in the Railway deployment stack.

### Priority Map

| Priority | Value | Trigger |
|----------|-------|---------|
| CRITICAL | 10 | Reserved for future escalation |
| HIGH | 7 | RISK_MONITOR agents |
| USER_QUERY | 5 | Copilot and manual triggers |
| API | 3 | Default for programmatic triggers |
| SCHEDULE | 1 | Cron-scheduled scans |

### Concurrency

Controlled by `AGENT_WORKER_CONCURRENCY` (default: 5). Each concurrent slot runs one agent execution end-to-end.

### Queue Depth

Hard cap at 200 (Vol.2 alert threshold). When full, new enqueues return `{ accepted: false, rejectedReason: 'QUEUE_FULL' }`.

## Migration to Bull (When Redis Deploys)

1. Add Redis to Railway via `railway add redis`
2. Set `REDIS_URL` env var
3. Install `@nestjs/bullmq bullmq` (peer deps)
4. In `agent-queue.module.ts`:
   - Add `BullModule.forRoot({ connection: { url: process.env.REDIS_URL } })`
   - Add `BullModule.registerQueue({ name: 'agent-runs' })`
5. Replace `AgentQueueService` with a `@Processor('agent-runs')` class
6. Priority map, concurrency, and cost-gate logic stay identical
7. Add dead-letter queue: `{ removeOnFail: { count: 50 } }`
8. Add Bull Board for operator visibility: `@bull-board/nestjs`

## Cost Circuit Breaker

The `AgentCostCircuitBreakerService` queries month-to-date `costUsdCents` from `agent_runs` before every enqueue. It's intentionally per-institution, not global, because different clients have different budgets.

### Troubleshooting

**Q: Agent runs are being rejected with BUDGET_EXCEEDED**
- Check `LLM_COST_CAP_USD_CENTS` env var
- Query: `SELECT SUM(cost_usd_cents) FROM agent_runs WHERE institution_id = ? AND created_at >= date_trunc('month', now())`
- Override: set `LLM_COST_CAP_USD_CENTS=0` to disable the breaker (0 = null = no cap)

**Q: Queue appears stuck (pending > 0, processing = 0)**
- The in-memory queue has no persistence. A process restart clears all pending jobs.
- Runs that were mid-flight will be in `RUNNING` status in the DB with no worker.
- Recovery: update stale `RUNNING` runs to `FAILED` with `errorCode=PROCESS_RESTART`
