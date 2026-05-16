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
| ✅ ~~Authenticated via inline `validateApiKey()` (x-api-key)~~ — **CLOSED** | 0 | Pattern #4 fully extracted to `ApiKeyAuthGuard`: enterprise (5 routes, migrated `e602c1d7`); api-v1/analyze* (3 routes, predates this audit). See "Pattern #4 Closure" §below. |
| ✅ Intentionally public — health/auth/marketing/charts | ~25 | health, changelog, auth (signup/login), free-report, market-data feeds, risk volatility, charts, Stripe webhook |
| ✅ **CRITICAL — unauthenticated privileged surface** | **0** | **~~agents.controller (3)~~ CLOSED this wave + ~~agent-trust.controller (1)~~ CLOSED this wave + ~~agent-eval.controller (2)~~ CLOSED in commit `9f445813`** |

The CRITICAL row is this audit's deliverable. Everything else is documented for the future auth-coverage verifier.

## The 5 Auth Patterns Found

CerniQ's controller surface uses five distinct authentication mechanisms:

1. **Canonical class-level `@UseGuards(AuthGuard|AuthTenantGuard, ...)`** — the modern pattern locked into the verifier framework (commits `8f69c148`, `5b2c26af`).
2. **Method-level `@UseGuards(...)` per route** — used when a controller mixes auth-required and public routes (e.g. `market-data.controller.ts` public market feeds + scoped alert handlers).
3. **Inline `verifyAdmin(headerKey)` helper + `x-admin-key` constant-time compare** — admin endpoints (`AdminController`, `CossecIngestController`, `ComplianceController`, `PipelineController` admin/* routes, `LeadsController` admin/* routes). Functionally equivalent to a guard; verifier-invisible until extracted to a real `AdminKeyGuard` class.
4. ~~Inline `validateApiKey()` helper + `x-api-key` lookup~~ — **CLOSED 2026-05-16.** External API surface now uses `@UseGuards(ApiKeyAuthGuard)`. EnterpriseController migrated in commits `97e588da` (dual-source scaffold) + `e602c1d7` (callsite migration). ApiV1Controller predates the audit on the guard. The guard accepts BOTH `Authorization: Bearer <api-key>` (canonical) AND `X-Api-Key: <api-key>` (legacy Enterprise convention) via `extractApiKey()`. AuthZ on body/path-supplied tenant IDs landed in `ff1ce9e4` (createBatch org-membership) + `cf8c72ac` (4 batchId-routes via `assertBatchAccess()`).
5. **Public by design** — health, marketing, Stripe webhook (signature-verified inline), magic-link request (pre-auth flow), generic market-data feeds, free-report lead capture.

Patterns 3 and 4 are CerniQ-specific divergences from the NestJS guard idiom. They predate the InstitutionScopeGuard sweep and survive in legacy admin/external-API surfaces.

## Critical Findings (Real Gaps)

### `backend-node/src/agents/agents.controller.ts` — 3 routes — CLOSED

Status: **CLOSED** in the agents auth-close commit (this wave).

This was the highest-blast-radius gap of the three: a **two-tenant body-IDOR**.
`POST /agents/run` accepted both `institutionId` AND `organizationId` from
the body with zero auth, so a single unauthenticated request could pick
either tenancy root and the runner would execute against it. The two
`runId` routes leaked any run's audit chain by guessed id.

Closure shape (mirrors ai-advisor `POST /ask` from `e88ae20c` / `4f9e2728`,
extended for the second tenancy root):

1. **Kernel extension**: extracted `OrgMembershipGuard.verifyMembership(orgId, userId, isMasterCeo)` as a public primitive — mirror of peer-2's `InstitutionScopeGuard.verifyOwnership` extraction in `b2a64c25`. The existing `canActivate` now delegates to `verifyMembership` after orgId resolution; master-CEO fast-path preserved. 5 new unit tests in `org-membership.guard.spec.ts` (total: 15/15 green).
2. **Module wiring**: `AgentsModule` imports `AuthModule` and adds both `InstitutionScopeGuard` + `OrgMembershipGuard` to providers (DI shape matches `AiAdvisorModule`).
3. **Controller**: class-level `@UseGuards(AuthGuard)`.
4. **`run()` handler**:
   - Switched to `safeParse` (already in place) so malformed body returns `BadRequestException`.
   - Added a `TENANCY_REQUIRED` check — bodies with neither `institutionId` nor `organizationId` are rejected at the controller boundary with 400; the runner cannot be invoked against zero tenancy.
   - Reads `userId` via canonical chain `req.user?.userId ?? req.user?.id ?? req.user?.sub ?? ''` (matches `9dbf57df` repo-wide normalization).
   - If `institutionId` is present: calls `this.institutionScope.verifyOwnership(institutionId, userId, isMasterCeo)` BEFORE `runner.run()`.
   - If `organizationId` is present: calls `this.orgMembership.verifyMembership(organizationId, userId, isMasterCeo)` BEFORE `runner.run()`.
5. **`getRun` / `getAudit` handlers**: fetch the run row, then dispatch its `institutionId` / `organizationId` keys into the same kernel primitives. Tenantless runs (both keys null) collapse to `NotFoundException` (anti-leak — never reveal an unattributed run exists to an authenticated tenant user). `getAudit` runs the ownership check BEFORE the audit chain hash-replay so an unauthorized caller cannot waste hash-verify cycles.

**Spec coverage:** 17 unit tests in `agents.controller.security.spec.ts` (NEW): both verifyOwnership-before-runner AND verifyMembership-before-runner ordering (via `mock.invocationCallOrder` with two separate ordering assertions), Forbidden propagation from either primitive skipping the runner, TENANCY_REQUIRED rejection, BadRequest on Zod failure before any auth check, master-CEO bypass forwarding to both primitives, canonical/legacy userId chain, run-row tenancy dispatch (institutionId-only, organizationId-only, tenantless = 404), `getAudit` ownership check fires before audit chain replay. Direct-construction style (no NestJS DI), mirrors `ai-advisor.controller.security.spec.ts`.

### `backend-node/src/agent-trust/agent-trust.controller.ts` — 1 route — CLOSED

Status: **CLOSED** in the agent-trust auth-close commit (this wave).

Closure shape (mirrors ai-advisor `POST /ask` from `e88ae20c` / `4f9e2728`):

1. Class-level `@UseGuards(AuthGuard)` — every route now requires a valid bearer token. AppModule's "aspirational global guard" docstring was deleted; the actual enforcement is local and explicit.
2. `AgentTrustModule` imports `PrismaModule` + `AuthModule` and adds `InstitutionScopeGuard` to providers (DI shape matches `AiAdvisorModule`).
3. The `validate()` handler:
   - Switched to `safeParse` so malformed body returns `BadRequestException` instead of throwing a raw ZodError.
   - Reads `userId` via the canonical chain `req.user?.userId ?? req.user?.id ?? req.user?.sub ?? 'anonymous'` (matches `9dbf57df` repo-wide normalization).
   - Calls `this.institutionScope.verifyOwnership(institutionId, userId, !!req.user?.access?.isMasterCeo)` BEFORE `trust.evaluate()` — second-layer enforcement, same shape as the URL-param routes' first-layer `canActivate`.
   - Emits a structured `logger.log` line with `institution`/`run`/`agent`/`user` for the auth-passed audit trail (matches `ai-advisor.controller` and `alm-analyst.controller` style).

**Spec coverage:** 7 unit tests in `agent-trust.controller.security.spec.ts` (NEW): verifyOwnership-before-evaluate ordering (via `mock.invocationCallOrder`), Forbidden propagation skipping the service, canonical `req.user.userId` read, fallback to `req.user.id`, fallback to `req.user.sub`, master-CEO bypass forwarding, malformed-body BadRequest before any auth check. Direct-construction style (no NestJS DI), mirrors `ai-advisor.controller.security.spec.ts`.

### `backend-node/src/agent-eval/agent-eval.controller.ts` — 2 routes — CLOSED

Status: **CLOSED** in commit `9f445813` (separate peer wave).

Closure shape (mirrors `e88ae20c` ai-advisor + `b2a64c25` WS-gateway):
1. Class-level `@UseGuards(AuthGuard)` for JWT auth.
2. Per-handler `InstitutionScopeGuard.verifyOwnership()` on `body.institutionId` BEFORE service call — same multi-context primitive across all entry surfaces.
3. Master-CEO bypass forwarded for platform support.

The "Protected by admin guard in production" docstring was aspirational —
fix chose user-scope ownership over admin-key gating because the routes
are tenant-scoped (run evaluations against a specific institution), not
platform-admin. `AgentEvalModule` now imports `AuthModule` + `PrismaModule`
and provides `InstitutionScopeGuard`. 7 new tests in
`agent-eval.controller.security.spec.ts` cover ordering, Forbidden/NotFound
propagation, master-CEO forwarding, GOLDEN_CASES symbol export lock.

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
| `enterprise/enterprise.controller.ts` | (1) `@UseGuards(ApiKeyAuthGuard)` at class level + AuthZ via `OrgMembershipGuard.verifyMembership` | Migrated `e602c1d7`. AuthZ: `createBatch` verifies body `organizationId` (`ff1ce9e4`); 4 batchId routes (`getBatch`, `getBatchStatus`, `cancelBatch`, `getWebhookLog`) use `assertBatchAccess()` helper that fetches the batch then runs `verifyMembership(batch.organizationId)` (`cf8c72ac`). The migration ALSO fixed 2 latent bugs: hash divergence (plain SHA-256 vs canonical HMAC-with-pepper — keys never authenticated pre-fix) + comment-confessed raw-key leak (`requestedBy: apiKey`). |
| `feedback/feedback.controller.ts` | (2+5) mixed | NPS submit is public; admin/stats has its own guard |
| `jobs/admin.controller.ts` | (3) verifyAdmin | `@Post('run-pipeline')` + `verifyAdmin` inline |
| `jobs/pipeline-health.controller.ts` | (5) public | Public health |
| `leads/free-report.controller.ts` | (5) public | Marketing free-report |
| `leads/leads.controller.ts` | (3+5) mixed | Submit is public; admin/api/* uses `verifyAdmin` |
| `market-data/charts.controller.ts` | (5) public | Public charts |
| `market-data/market-data.controller.ts` | (3+5) mixed | Market feeds public; `clear-cache` uses `verifyAdmin` |
| `api-v1/api-v1.controller.ts` | (2+5) mixed | Health/frameworks/benchmarks public (verify:auth-skip with rationale comments); 3 analyze*/analyses* routes have method-level `@UseGuards(ApiKeyAuthGuard, ApiRateLimitGuard)`. AuthZ: `analyzeFromRows` + `analyzeFromCSV` create user-owned resources (no body-supplied tenant ID → no IDOR vector); `getAnalysis(userId, analysisId)` uses canonical `findFirst({ where: { id, createdByUserId } })` ownership-filter pattern — combines existence + ownership in one Prisma round-trip, returns 404 on cross-user reads (anti-enumeration correct: 404 not 403, since UUID side channel doesn't leak). Verified 2026-05-16, no IDOR present pre-audit. |
| `pipeline/pipeline.controller.ts` | (3+5) mixed | Admin pipeline ops use `verifyAdmin`; `Sse('api/jobs/:jobId/status')` is the public SSE stream |
| `realtime-alm/market-data.controller.ts` | (2+5) mixed | Method-level guard on alert routes; market feeds public |
| `realtime-alm/alm-realtime.gateway.ts` | (1) JWT+verifyOwnership | **WS gateway, NOT a controller.** `handleConnection` verifies JWT (dual-source: legacy + Supabase) and binds `client.data.user`; `handleSubscribe`/`handleUnsubscribe` call `InstitutionScopeGuard.verifyOwnership` before `client.join`/`client.leave`. CRITICAL body-trust IDOR closed in this wave — pre-fix accepted ANY truthy token + arbitrary `institutionId` from `@MessageBody`, allowing cross-tenant room joins. |
| `risk/volatility.controller.ts` | (5) public | Public volatility indicator (read-only, ticker-keyed not tenant-keyed) |

## Pattern #4 Closure — 2026-05-16

Pattern #4 (the external `x-api-key` surface) was extracted to `ApiKeyAuthGuard` across this session. Three sub-closures landed:

1. **Dual-source scaffold** (`97e588da`) — `api-v1/guards/api-key-auth.guard.ts` `extractBearerToken()` renamed to `extractApiKey()` and extended to fall back to `X-Api-Key` header when `Authorization: Bearer` is absent. Backward-compatible: the existing 16 Bearer-path specs untouched; 3 new specs lock the X-Api-Key fallback + Bearer-precedence + empty-X-Api-Key rejection. Bearer wins when both are present.

2. **EnterpriseController migration** (`e602c1d7`) — dropped the 27-line `validateApiKey()` private helper, 5× `@Headers('x-api-key') apiKey: string` parameters, and 5× `await this.validateApiKey(apiKey)` calls. Added class-level `@UseGuards(ApiKeyAuthGuard)`. Closed two latent bugs in the same commit:
   - **Hash divergence (functional defect)** — pre-migration `validateApiKey()` used `crypto.createHash('sha256')` (plain SHA-256, no pepper), but the rest of the system stores keys via `hashApiKey()` from `auth/api-key.util.ts` (HMAC-SHA256 with `API_KEY_PEPPER` ≥32 chars). Three of four consumers (`auth.service.ts:916` issuance, `auth.guard.ts:421`, `api-v1/guards/api-key-auth.guard.ts:51`) use HMAC; only EnterpriseController used plain SHA-256. Net result: **any canonically-issued customer API key could NEVER authenticate** against the Enterprise tier surface — keys hashed to a different value than what's stored.
   - **Raw-key leak (security defect)** — `enterprise.controller.ts:90` was passing the raw API key string into `EnterpriseBatch.requestedBy` with the comment-confessed TODO `// In production, resolve to user from API key`. Post-migration: `req.apiUser.userId` (resolved by the guard) flows through. Negative test assertion (`not.toHaveBeenCalledWith requestedBy matching /^(ck_live_|sk-|Bearer\s)/`) locks the regression.

3. **AuthZ closures on EnterpriseController** (`ff1ce9e4` + `cf8c72ac`) — the auth migration resolved the caller identity but didn't yet enforce per-resource ownership:
   - `ff1ce9e4` closed the body-org IDOR on `createBatch`: `OrgMembershipGuard.verifyMembership(dto.organizationId, req.apiUser.userId, isMasterCeo)` runs BEFORE `batchService.createBatch`. Without this, any valid Enterprise API key could submit batches against any guessed `organizationId`.
   - `cf8c72ac` closed the batchId-route IDORs on `getBatch`, `getBatchStatus`, `cancelBatch`, `getWebhookLog` via a private `assertBatchAccess(batchId, req)` helper that fetches the batch (`NotFound`-propagates as 404) then verifies membership against `batch.organizationId` (`Forbidden`-propagates as 403). 8 new lock tests including the side-effect-order lock on `cancelBatch` (Forbidden must NOT cancel) and information-leak lock on `getWebhookLog` (Forbidden must NOT read webhook URLs).

**ApiV1Controller AuthZ was already correct** (audited 2026-05-16, no work needed): `getAnalysis(userId, analysisId)` uses `findFirst({ where: { id, createdByUserId } })` — combines existence + ownership in a single Prisma round-trip with canonical 404-on-cross-user response. `analyzeFromRows` and `analyzeFromCSV` create user-owned resources (no body-supplied tenant ID).

**Test coverage delivered (Pattern #4 lane):** 19 ApiKeyAuthGuard specs (16 existing + 3 new for dual-source), 18 EnterpriseController specs (NEW spec file, 0 prior coverage). All locked to current commits.

## Recommended Primitive-Consolidation Work

These items would simplify the auth surface AND make a future `verify-auth-coverage.mjs` lint check viable.

1. **Extract `AdminKeyGuard`** — **SCAFFOLDED + SWEEP NEARLY COMPLETE (this wave + 2026-05-16 follow-up).** Pilot landed in `f323b3fb` (jobs/admin), Migration #2 `ef2de825` (compliance), #3 `4f930014` (audit), #4 `d18b3880` (market-data, method-level), #5 `d8a86d82` (cossec/sample-report, method-level mixed), #6 `0e5edc70` (cossec-ingest). Migration #7 (app.controller, 10 routes — biggest, peer 5b0c0175's lane) was in flight as of 2026-05-16 evening and remains the only outstanding callsite. Guard class lives at `backend-node/src/auth/admin-key.guard.ts`; registered in `@Global() AuthModule` providers + exports so any controller can `@UseGuards(AdminKeyGuard)` without per-module DI wiring. 10 unit tests in `admin-key.guard.spec.ts` lock the byte-for-byte contract of the existing inline helpers: missing header / empty / env-key-unset / length-mismatch / wrong-content all → 401 `"Invalid admin key"` (same message in every failure mode — no oracle leak). Re-survey on actual call sites: the `verifyAdmin` pattern lives in **two physical files** (not the six logical controllers originally listed): `app.controller.ts:763` private helper used by 10 routes (rows 520, 530, 540, 558, 644, 658, 686, 712, 721, 758) AND `market-data/market-data.controller.ts:253` inline block for the `clear-cache` route. Total 11 routes to migrate. **Migration recipe** (per call site): (a) replace `@Headers('x-admin-key') adminKey: string` parameter and the `this.verifyAdmin(adminKey)` first-line call with a class- or method-level `@UseGuards(AdminKeyGuard)`; (b) once all 10 `app.controller.ts` call sites are migrated, delete the private `verifyAdmin` helper at line 763; (c) for `market-data.controller.ts`, also remove the inline `timingSafeStringEqual` block and the unused `UnauthorizedException` import. Migration is per-handler reviewable; safest order is one controller at a time with a green test run between each. Once shipped, the future `verify-auth-coverage.mjs` linter can enforce that admin routes carry `AdminKeyGuard` in their `@UseGuards` decorator.
2. **Extract `OrgMembershipGuard.verifyMembership(orgId, userId)` public primitive** — mirrors what peer-2 did to `InstitutionScopeGuard.verifyOwnership` in `b2a64c25`. Unblocks the agents-controller fix where `organizationId` arrives via body.
3. **Build `verify-auth-coverage.mjs`** parallel to `verify-institution-scope-guard.mjs`. Per-controller rule: "every route must be reachable only through one of {AuthGuard, AuthTenantGuard, ApiKeyAuthGuard, AdminKeyGuard, InstitutionScopeGuard, OrgMembershipGuard, FirmOwnsClientGuard}". Skip mechanism: `// verify:auth-skip — <reason>` for documented public routes. The 25 intentional-public routes in the matrix above all get skip comments with their pattern label.

## Cursor IDOR Sub-Audit — CLOSED, no gaps

A parallel sweep for cursor-based pagination IDOR (per the IDOR_RESIDUAL_AUDIT.md flagged follow-up):
- Only TWO controllers use cursor pagination: `agent-api/agent-runs.controller.ts` and `agent-api/alerts.controller.ts`. **Both already validate** that the cursor row's `institutionId` matches the request's institutionId before using it.
- ~~`cossec/cossec.dto.ts:61` declares a `cursor` field in a Zod schema but no controller consumes it — **dead code**, cleanup opportunity.~~ **CLOSED** in `dbd6e80f` (single-line removal; latent-IDOR vector eliminated before being wired).
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
