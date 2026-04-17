# Agent API Contract — Operations Reference

> Authoritative API reference for the per-tenant agent HTTP surface.
> See `backend-node/src/agent-api/` for source, `backend-node/src/agents/` for runtime.

## Endpoints

| Method | Route | Module | Description |
|--------|-------|--------|-------------|
| POST | `/agents/run` | AgentsModule | Trigger an agent run (peer's controller) |
| GET | `/agents/runs/:runId` | AgentsModule | Fetch single run (peer's controller) |
| GET | `/agents/runs/:runId/audit` | AgentsModule | Full audit chain + verification |
| SSE | `/agents/runs/:runId/stream` | AgentsModule | Per-run lifecycle SSE |
| GET | `/agents/catalog` | AgentsModule | Agent catalog listing |
| GET | `/api/v1/agents/:institutionId/runs` | AgentApiModule | Paginated run list |
| GET | `/api/v1/agents/:institutionId/cost` | AgentApiModule | Month rollup + budget gate |
| GET | `/api/v1/agents/:institutionId/alerts` | AgentApiModule | Alert list + severity summary |
| PATCH | `/api/v1/agents/:institutionId/alerts/:alertId` | AgentApiModule | Acknowledge / resolve / suppress |
| POST | `/api/v1/agents/:institutionId/copilot` | AgentApiModule | CFO Copilot Q&A |
| SSE | `/api/v1/agents/:institutionId/stream` | AgentApiModule | Per-tenant activity feed |
| GET | `/api/v1/agents/:institutionId/runs/:runId/trace/export` | AgentApiModule | Regulator trace export (JSON; PDF pending) |

## Authentication

All `AgentApiModule` endpoints require:
1. **AuthGuard** — JWT or API key verification
2. **InstitutionScopeGuard** — verifies caller owns the institution via `Institution → Workspace → ownerId`

The guard populates `req.user.institutionId` which the TenantContextMiddleware uses to set `app.current_institution_id` for RLS enforcement.

## Pagination

Keyset pagination on `(createdAt DESC, id DESC)`. Pass `?cursor=<lastItemId>` to fetch the next page. The response includes `nextCursor: string | null`.

## Trace Export Hash Verification

The `exportHash` field in JSON trace exports is computed as:

```
sha256(canonical_json(payload_with_exportHash_set_to_empty_string))
```

Where `canonical_json` sorts object keys recursively. Regulators verify by:
1. Download the JSON file
2. Set `exportHash` to `""`
3. Canonical-JSON-serialize with sorted keys
4. Compute SHA-256 of the resulting string
5. Compare to the original `exportHash` value

## Cost Circuit Breaker

Configured via `LLM_COST_CAP_USD_CENTS` env var (default: 10000 = $100/month).

| State | Condition | Effect |
|-------|-----------|--------|
| OK | spend < 80% of cap | Runs proceed normally |
| WARN | 80% ≤ spend < 100% | Runs proceed; UI shows amber banner |
| BLOCKED | spend ≥ 100% | New runs rejected with `BUDGET_EXCEEDED` |

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `LLM_COST_CAP_USD_CENTS` | 10000 | Monthly cost cap per institution |
| `AGENT_WORKER_CONCURRENCY` | 5 | Max parallel agent executions |

## Known Gaps

- **PDF trace export**: 501 stub. Pending integration with `AlmDocumentExportsService`.
- **Agent schedule CRUD**: Vol.2 specifies `GET/PUT /schedule` — not yet implemented.
- **Copilot session persistence**: Sessions are idempotency-key based; no dedicated session store.
