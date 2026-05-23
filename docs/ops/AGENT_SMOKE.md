# Agent-Layer Smoke Test — Operator Runbook

> The fast ship-gate for the agent execution layer. Run this before
> onboarding the first paying customer to confirm the agent runner, audit
> chain, cost tracking, and tenant isolation are all wired correctly on
> live infrastructure.

**When to run:**

- Right after every Railway prod deploy that touches `backend-node/src/agents/**`, `backend-node/src/agent-api/**`, or `prisma/migrations/*agent*`.
- Before flipping any institution from internal-test to paying-customer status.
- As a one-shot after rotating `ANTHROPIC_API_KEY` or after a Redis incident.

**What it costs:** one ALM_DECISION run (≈ $0.10–$1.00 in Anthropic charges, ≈ 30–60s wall clock).

**What it leaves behind:** one `agent_runs` row + its audit chain in the DB. The summary prints the `runId` and the SQL to remove it.

---

## Prerequisites

| Requirement | Why | Where to get it |
|---|---|---|
| `API_URL` reachable | Steps 0–4 hit live endpoints | `https://api.cerniq.io` for prod |
| Backend running with Redis | Agent runner queues work via Redis | Railway healthcheck green |
| `ANTHROPIC_API_KEY` configured | Step 1 triggers a real LLM call | Railway env var |
| Database migrated | `agent_runs`, `agent_audit_logs`, `agent_alerts` tables | `npm run prisma:status` (no pending migrations) |
| User JWT | Authorize the trigger + reads | Log in via `/api/auth/login`, copy the bearer token |
| Institution UUID | Target for the smoke run | Already-seeded institution the JWT user belongs to |
| (optional) Cross-tenant JWT | Step 5 tenant-isolation assertion | A second user from a different institution |

To get a JWT quickly for your own account:

```bash
curl -sf -X POST -H "Content-Type: application/json" \
  -d '{"email":"erwin@cerniq.io","password":"…"}' \
  "$API_URL/api/auth/login" | jq -r '.access_token'
```

---

## Run

```bash
cd ~/Desktop/Cerniq
bash scripts/agent-smoke.sh \
  https://api.cerniq.io \
  "$JWT" \
  "$INST_ID" \
  "$CROSS_JWT"   # optional — Step 5 skipped if omitted
```

You'll see six `── n. <title> ──` sections (Pre-flight + Steps 1–5), each
with `✓` / `✗` lines, finishing with:

```
── Summary ──
  PASS: 5  FAIL: 0
  runId: cmexxxxxxxxx  (delete via: DELETE FROM agent_runs WHERE id='cmexxxxxxxxx';)
  ✓ AGENT SMOKE PASSED
```

Exit codes: `0` pass, `1` any step failed, `2` API unreachable.

---

## What each step asserts

| # | Step | API call | Pass criterion | Common failure mode |
|---|---|---|---|---|
| 0 | Pre-flight | `GET /health` | HTTP 200 | Wrong API_URL, backend not running |
| 1 | Trigger | `POST /api/v1/agents/:inst/run` | Response has `runId` | AuthGuard 401 (bad JWT), InstitutionScopeGuard 403 (wrong inst), throttle 429 |
| 2 | Poll | `GET /api/v1/agents/:inst/runs/:runId` | Status reaches `SUCCEEDED` within 120 s | Worker not consuming queue (Redis down, `AGENT_WORKER_CONCURRENCY` unset), ANTHROPIC_API_KEY missing, LLM_COST_CAP_USD_CENTS too low |
| 3 | Audit trace | `GET /api/v1/agents/:inst/runs/:runId/trace` | ≥ 12 audit steps | AgentAuditService not wired into runner, hash-chain init missing |
| 4 | LLM cost tracked | `costUsdCents` on the run record | `> 0` | LlmBridgeService not setting `inputTokens` / `outputTokens` on the run, or the runner not persisting cost |
| 5 | RLS tenant isolation | `GET /api/v1/agents/:inst/runs?limit=1` with `CROSS_JWT` | HTTP 403/404, OR HTTP 200 with empty `runs[]` | **RLS LEAK** — fix immediately, do not ship |

---

## Triage cheat-sheet

**Step 2 hangs at QUEUED → TIMED_OUT after 120 s:**
The worker isn't picking work off Redis. Check Railway logs for `agent-worker` exits, confirm `AGENT_SCHEDULER_DISABLED` is not set to `1`, confirm Redis URL is correct, restart the worker pod.

**Step 2 reaches `FAILED`:**
Fetch the trace anyway with `curl -sf -H "$auth_header" "$API_URL/api/v1/agents/$INST_ID/runs/$RUN_ID/trace"` — the failure mode is captured in the last audit step's `output_json`. Common: invalid `ANTHROPIC_API_KEY`, Zod-rejected agent output, tool call to a non-existent tool name.

**Step 3 reports < 12 steps:**
Either the audit interceptor isn't wired (check `AgentRunnerService` constructor — `audit` must be injected and `audit.append` called before/after each tool call) or the agent gave up after 1–2 turns (check `maxTurns` in the definition).

**Step 4 reports `costUsdCents=0`:**
`LlmBridgeService.turn()` returns `inputTokens` / `outputTokens` from the SDK response; `AgentRunService.markSucceeded` is supposed to compute `costUsdCents` from those + the per-model rate. Either the bridge is silently returning zeros, or the runner isn't passing tokens to `markSucceeded`. Grep `LLM_COST_USD_CENTS_PER_*` env vars / `cost-pricing.ts`.

**Step 5 reports `RLS LEAK`:**
**This is a P0.** A cross-tenant JWT was able to read runs scoped to another institution. Likely cause: a Prisma query in `AgentRunsController.listRuns` is missing the `institutionId` filter, or `TenantContextMiddleware` isn't installed for the agent-api routes. Roll back immediately, then audit `src/agent-api/agent-runs.controller.ts` against `src/agents/agents.controller.ts:assertRunOwnership` for the cross-check pattern.

---

## After a pass

1. Mark T10 closed in `docs/SESSION_HANDOFF.md` §4.7 (or via a handoff-incoming entry).
2. Delete the smoke run row:

   ```sql
   DELETE FROM agent_audit_logs WHERE run_id = '<runId>';
   DELETE FROM agent_runs       WHERE id     = '<runId>';
   ```

3. (Optional) Schedule the smoke to run nightly against staging via the cron in `scripts/ci/`. Production should remain on-demand to keep Anthropic spend zero on idle nights.

---

## Related

- `docs/ops/AGENT_GOING_LIVE.md` — full 12-item going-live checklist (this smoke is the fast subset)
- `scripts/agent-smoke.sh` — the script itself
- `backend-node/src/agent-api/agent-runs.controller.ts` — the controller whose endpoints the smoke probes
- `backend-node/scripts/verify-agent-smoke-endpoints.mjs` — static drift guard that fails CI if the script references an endpoint that no longer exists in the controller
