# Auth Coverage Audit — Controller-Surface Sweep

**Date:** 2026-05-16
**Scope:** Every `*.controller.ts` under `backend-node/src/`. Asks: "does every route require authentication before reaching service logic?"
**Methodology:** Static scan for `@UseGuards(...)` at class or method level + inline `verify*()` helper calls + inline header-based authentication patterns, classified per controller.
**Trigger:** Tail of the IDOR sweep wave (commits `8f69c148` / `b2a64c25` / `5b2c26af`). With path-param IDOR comprehensively locked (132 routes via `InstitutionScopeGuard`, 12 via `OrgMembershipGuard`, 11 via close-cycle 1-hop), the next-tier invariant is "every controller's authentication story is explicit and enforced."

## TL;DR

| | Routes | Status |
| --- | --- | --- |
| ✅ Authenticated via canonical `@UseGuards(Auth*)` | ~415 | Locked by `verify-institution-scope-guard.mjs` |
| ✅ Authenticated via inline `verifyAdmin()` admin-key | 11 | jobs/admin (1), cossec-ingest (5), compliance (1), pipeline/api/admin/* (3+), market-data/clear-cache (1) |
| ✅ Authenticated via inline `validateApiKey()` (x-api-key) | ~7 | enterprise (5 routes), api-v1/analyze* (3 routes) |
| ✅ Intentionally public — health/auth/marketing/charts | ~25 | health, changelog, auth (signup/login), free-report, market-data feeds, risk volatility, charts, Stripe webhook |
| 🔴 **CRITICAL — unauthenticated privileged surface** | **6** | **agents.controller (3) + agent-trust.controller (1) + agent-eval.controller (2)** |

The CRITICAL row is this audit's deliverable. Everything else is documented for the future auth-coverage verifier.

## The 5 Auth Patterns Found

CerniQ's controller surface uses five distinct authentication mechanisms:

1. **Canonical class-level `@UseGuards(AuthGuard|AuthTenantGuard, ...)`** — the modern pattern locked into the verifier framework (commits `8f69c148`, `5b2c26af`).
2. **Method-level `@UseGuards(...)` per route** — used when a controller mixes auth-required and public routes (e.g. `market-data.controller.ts` public market feeds + scoped alert handlers).
3. **Inline `verifyAdmin(headerKey)` helper + `x-admin-key` constant-time compare** — admin endpoints (`AdminController`, `CossecIngestController`, `ComplianceController`, `PipelineController` admin/* routes, `LeadsController` admin/* routes). Functionally equivalent to a guard; verifier-invisible until extracted to a real `AdminKeyGuard` class.
4. **Inline `validateApiKey()` helper + `x-api-key` lookup** — the external API surface (`EnterpriseController`, `ApiV1Controller` /analyze*).
5. **Public by design** — health, marketing, Stripe webhook (signature-verified inline), magic-link request (pre-auth flow), generic market-data feeds, free-report lead capture.

Patterns 3 and 4 are CerniQ-specific divergences from the NestJS guard idiom. They predate the InstitutionScopeGuard sweep and survive in legacy admin/external-API surfaces.

## Critical Findings (Real Gaps)

### `backend-node/src/agents/agents.controller.ts` — 3 routes UNAUTHENTICATED

```ts
@Controller('agents')
export class AgentsController {
  @Post('run')           // accepts {agentId, institutionId, organizationId, ...} in body
  @Get('runs/:runId')
  @Get('runs/:runId/audit')
}
```

**Attack:** any caller with knowledge of the URL can `POST /agents/run` with an `institutionId` and `organizationId` of their choice. The runner trusts both. They can also read any run's audit chain by id.

**Compare to:** `agent-api/agent-runs.controller.ts` is the modern equivalent at `@Controller('api/v1/agents/:institutionId')` with `@UseGuards(AuthGuard, InstitutionScopeGuard)` at class level. `AgentsController` looks like its older, unprotected sibling — likely predates the agent-api module and was never migrated.

**Fix (mirrors ai-advisor pattern, commit `e88ae20c`/`4f9e2728`):**
1. Add `@UseGuards(AuthGuard)` at class level.
2. Inject `InstitutionScopeGuard`.
3. In `run()`, after Zod parse, call `await this.institutionScope.verifyOwnership(institutionId, userId, isMasterCeo)` before invoking the runner.
4. For the `runId` routes, add a service-layer ownership check on the run (`run.institutionId === req.user.institutionId` or equivalent).
5. `organizationId` from body needs a parallel `OrgMembershipGuard.verifyMembership(orgId, userId)` primitive — that primitive does not exist yet. Extracting it from `OrgMembershipGuard.canActivate` (mirroring how peer-2 extracted `verifyOwnership` from `InstitutionScopeGuard.canActivate` in `b2a64c25`) closes this and unblocks the agent-runner fix.

### `backend-node/src/agent-trust/agent-trust.controller.ts` — 1 route UNAUTHENTICATED

```ts
@Controller('api/v1/trust')
export class AgentTrustController {
  @Post('validate')      // accepts {institutionId, runId, agentText, ...} in body
}
```

**Docstring claims:** "Protected by AuthGuard in production (added at AppModule level)." This is **aspirational, not factual** — `AppModule.providers` only registers `APP_GUARD: UserThrottleGuard` (rate-limit). No global AuthGuard.

**Attack:** any caller can `POST /api/v1/trust/validate` with any `institutionId` + `runId` and receive a trust verdict containing data about agent runs on that institution.

**Fix:** mirror the agents-controller pattern. Add `@UseGuards(AuthGuard)` + body-param ownership check via `verifyOwnership`.

### `backend-node/src/agent-eval/agent-eval.controller.ts` — 2 routes UNAUTHENTICATED

```ts
@Controller('api/v1/eval')
export class AgentEvalController {
  @Post('golden')        // accepts {institutionId, only?, baselineAverage?}
  @Post('replay')        // accepts {institutionId, runId, narrative, output, trace, ...}
}
```

**Docstring claims:** "Protected by admin guard in production." Also aspirational — no admin guard in the controller, no AppModule wiring.

**Attack:** any caller can trigger golden-case runs against any institution (billing AI cost, generating noise in eval reports) OR replay a fake trace against any run (poisoning the trust-verdict audit trail).

**Fix:** since this is admin-scoped per the docstring, add `verifyAdmin()` inline (matches `CompliancController` / `AdminController` pattern) OR extract a proper `AdminKeyGuard` class.

## Verified-Authenticated Controllers (No Action Needed)

The following appear "unguarded" to a naïve `@UseGuards`-only scan but are actually authenticated via one of patterns 2-5 above. Recording them so the future `verify-auth-coverage.mjs` verifier knows about the legitimate divergences.

| Controller | Pattern | Notes |
| --- | --- | --- |
| `actions/action.controller.ts` | (2) method-level | All routes have method-level `@UseGuards(AuthGuard)` |
| `auth/auth.controller.ts` | (5) public-by-design | Login/signup/magic-link request — must be pre-auth |
| `billing/billing.controller.ts` | (2+5) mixed | Customer-portal/subscription have `@UseGuards(AuthGuard)`; webhook is signature-verified inline; magic-link routes are pre-auth |
| `common/controllers/changelog.controller.ts` | (5) public | Public docs |
| `common/controllers/health.controller.ts` | (5) public | Public health |
| `compliance/compliance.controller.ts` | (3) verifyAdmin | `@Controller('api/admin/compliance')` + `verifyAdmin(adminKey)` per route |
| `cossec/cossec-ingest.controller.ts` | (3) verifyAdmin | `@Controller('admin/api/cossec')` + `verifyAdmin(adminKey)` per route |
| `cossec/sample-report.controller.ts` | (5) public | Marketing sample report |
| `enterprise/enterprise.controller.ts` | (4) validateApiKey | All routes call `validateApiKey(apiKey)` |
| `feedback/feedback.controller.ts` | (2+5) mixed | NPS submit is public; admin/stats has its own guard |
| `jobs/admin.controller.ts` | (3) verifyAdmin | `@Post('run-pipeline')` + `verifyAdmin` inline |
| `jobs/pipeline-health.controller.ts` | (5) public | Public health |
| `leads/free-report.controller.ts` | (5) public | Marketing free-report |
| `leads/leads.controller.ts` | (3+5) mixed | Submit is public; admin/api/* uses `verifyAdmin` |
| `market-data/charts.controller.ts` | (5) public | Public charts |
| `market-data/market-data.controller.ts` | (3+5) mixed | Market feeds public; `clear-cache` uses `verifyAdmin` |
| `api-v1/api-v1.controller.ts` | (4+5) mixed | Health/frameworks/benchmarks public; analyze* routes have `@UseGuards(ApiKeyAuthGuard)` |
| `pipeline/pipeline.controller.ts` | (3+5) mixed | Admin pipeline ops use `verifyAdmin`; `Sse('api/jobs/:jobId/status')` is the public SSE stream |
| `realtime-alm/market-data.controller.ts` | (2+5) mixed | Method-level guard on alert routes; market feeds public |
| `risk/volatility.controller.ts` | (5) public | Public volatility indicator (read-only, ticker-keyed not tenant-keyed) |

## Recommended Primitive-Consolidation Work

These items would simplify the auth surface AND make a future `verify-auth-coverage.mjs` lint check viable.

1. **Extract `AdminKeyGuard`** from the inline `verifyAdmin(adminKey)` helper duplicated in `AdminController`, `CossecIngestController`, `ComplianceController`, `PipelineController`, `LeadsController`, `MarketDataController`. Single class, same `timingSafeStringEqual` + `ADMIN_KEY` env lookup, applied via `@UseGuards(AdminKeyGuard)`. Each existing helper becomes a delete + import + guard application.
2. **Extract `OrgMembershipGuard.verifyMembership(orgId, userId)` public primitive** — mirrors what peer-2 did to `InstitutionScopeGuard.verifyOwnership` in `b2a64c25`. Unblocks the agents-controller fix where `organizationId` arrives via body.
3. **Build `verify-auth-coverage.mjs`** parallel to `verify-institution-scope-guard.mjs`. Per-controller rule: "every route must be reachable only through one of {AuthGuard, AuthTenantGuard, ApiKeyAuthGuard, AdminKeyGuard, InstitutionScopeGuard, OrgMembershipGuard, FirmOwnsClientGuard}". Skip mechanism: `// verify:auth-skip — <reason>` for documented public routes. The 25 intentional-public routes in the matrix above all get skip comments with their pattern label.

## Cursor IDOR Sub-Audit — CLOSED, no gaps

A parallel sweep for cursor-based pagination IDOR (per the IDOR_RESIDUAL_AUDIT.md flagged follow-up):
- Only TWO controllers use cursor pagination: `agent-api/agent-runs.controller.ts` and `agent-api/alerts.controller.ts`. **Both already validate** that the cursor row's `institutionId` matches the request's institutionId before using it.
- `cossec/cossec.dto.ts:61` declares a `cursor` field in a Zod schema but no controller consumes it — **dead code**, cleanup opportunity.
- All other paginated endpoints use offset/limit/take, where the tenant key arrives via the URL path (`:institutionId` / `:orgId`) and is already gated by the canonical guard. Cursor-IDOR class is not reachable on those.

## Sweep Coordination

- Audit doc co-exists with `IDOR_RESIDUAL_AUDIT.md` (peer-2 claimed that one for the ai-advisor + cpa + WS-gateway follow-up wave). This is a separate file so peer-2's claim doesn't block.
- The 3 critical gaps + the primitive-consolidation work are open scope for any peer to pick up. Each is independent (no cross-controller deps).

## References

- Original 5-controller IDOR sweep: `8f69c148`
- Body-IDOR closure on ai-advisor: `e88ae20c` / `4f9e2728`
- WS-gateway auth bypass closure: `b2a64c25`
- Multi-rule tenant-scope verifier: `5b2c26af` (pending peer landing of the `.mjs` file)
- `verifyOwnership` primitive: `backend-node/src/agent-api/guards/institution-scope.guard.ts:83`
- `OrgMembershipGuard`: `backend-node/src/close/guards/org-membership.guard.ts`
