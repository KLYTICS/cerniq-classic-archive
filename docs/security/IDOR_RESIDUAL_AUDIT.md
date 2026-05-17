# IDOR Residual Audit — Cross-Tenant Path Parameter Sweep

**Date:** 2026-05-15
**Scope:** Backend-node controllers carrying `:institutionId`, `:orgId`, `:cycleId`, or `:workspaceId` URL parameters.
**Trigger:** `8f69c148` (peer-1) closed 5 high-blast-radius `:institutionId` controllers; this audit verifies the residual surface and documents defense posture.

## Sweep Wave Coordination

Four parallel Claude sessions converged on the IDOR surface within a 30-minute window:

| Peer              | Scope                                                                                    | Outcome                                                                                 |
| ----------------- | ---------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| peer-1            | 5 `:institutionId` controllers (alm, alm-advisor, alm-advisor-v2, camel-cert, exam-prep) | Landed in `8f69c148` — class-level `@UseGuards(AuthTenantGuard, InstitutionScopeGuard)` |
| peer-2            | `realtime-alm/market-data.controller.ts` 3-route extension + supporting module wiring    | In flight at audit time                                                                 |
| peer-2 (residual) | `ai-advisor`, `ncua`, `cpa-client`, `report-artifact` controller/module sweep            | Unstaged at audit time                                                                  |
| peer-4            | `scripts/verify-institution-scope-guard.mjs` CI guard + frontend agents-contract-drift   | In flight                                                                               |
| peer-3 (this)     | `close` cockpit `OrgMembershipGuard`, residual audit doc                                 | This commit                                                                             |

Conway-style decomposition by path: each peer owns disjoint files. No collisions.

## Controller Matrix

Status legend: ✅ guarded · 🟡 partial · 🔴 gap · ➖ different threat model

### `:institutionId` controllers — 16 total

| Controller                                        | Status        | Guard Stack                                                                                                         | Notes                                                                                                                                                                                                                                                                                                                                                                                 |
| ------------------------------------------------- | ------------- | ------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `alm/alm.controller.ts`                           | ✅            | `AuthTenantGuard, InstitutionScopeGuard`                                                                            | peer-1 `8f69c148` (93 routes)                                                                                                                                                                                                                                                                                                                                                         |
| `alm/alm-advisor.controller.ts`                   | ✅            | `AuthTenantGuard, InstitutionScopeGuard`                                                                            | peer-1 `8f69c148`                                                                                                                                                                                                                                                                                                                                                                     |
| `alm/alm-advisor-v2.controller.ts`                | ✅            | `AuthTenantGuard, InstitutionScopeGuard`                                                                            | peer-1 `8f69c148`                                                                                                                                                                                                                                                                                                                                                                     |
| `alm/exam-prep/camel-certification.controller.ts` | ✅            | `AuthTenantGuard, InstitutionScopeGuard, RolesGuard`                                                                | peer-1 `8f69c148`                                                                                                                                                                                                                                                                                                                                                                     |
| `exam-prep/exam-prep.controller.ts`               | ✅            | `AuthTenantGuard, InstitutionScopeGuard`                                                                            | peer-1 `8f69c148` (was completely unauthenticated)                                                                                                                                                                                                                                                                                                                                    |
| `alm/alm-analyst.controller.ts`                   | ✅            | `AuthTenantGuard, InstitutionScopeGuard`                                                                            | originally `a6337c32`, the spark for the systemic sweep                                                                                                                                                                                                                                                                                                                               |
| `alm/reports/report-artifact.controller.ts`       | ✅ (post-fix) | `AuthGuard, InstitutionScopeGuard, RolesGuard` + inline `verifyOwnership(artifact.institutionId, …)` on `:id` route | **2026-05-16 correction:** earlier ✅ was a false clean — class-level guards were set, but the `GET /:id` route had no `:institutionId` in the URL for `InstitutionScopeGuard.canActivate` to scope on. Closed in the same commit by injecting the guard into the controller and switching the by-id handler to fetch-then-verify. See "Output-trust by-id audit (2026-05-16)" §below |
| `agent-api/copilot.controller.ts`                 | ✅            | `AuthGuard, InstitutionScopeGuard`                                                                                  | base path always supplies `:institutionId`                                                                                                                                                                                                                                                                                                                                            |
| `agent-api/agent-tenant-stream.controller.ts`     | ✅            | `AuthGuard, InstitutionScopeGuard`                                                                                  | + in-process event-bus filter on resolved institution                                                                                                                                                                                                                                                                                                                                 |
| `agent-api/alerts.controller.ts`                  | ✅            | `AuthGuard, InstitutionScopeGuard`                                                                                  | cursor validation also rejects cross-tenant cursor IDs                                                                                                                                                                                                                                                                                                                                |
| `agent-api/agent-export.controller.ts`            | ✅            | `AuthGuard, InstitutionScopeGuard`                                                                                  | + audit chain hash verification on export                                                                                                                                                                                                                                                                                                                                             |
| `agent-api/agent-runs.controller.ts`              | ✅            | `AuthGuard, InstitutionScopeGuard`                                                                                  | + cursor validation, defense-in-depth idempotency                                                                                                                                                                                                                                                                                                                                     |
| `ncua/ncua.controller.ts`                         | ✅            | `AuthTenantGuard, InstitutionScopeGuard`                                                                            | peer-2 unstaged tightens module providers                                                                                                                                                                                                                                                                                                                                             |
| `realtime-alm/market-data.controller.ts`          | 🟡            | `AuthGuard` + 3 method-level routes pending                                                                         | **peer-2 in flight** — not in this commit's scope                                                                                                                                                                                                                                                                                                                                     |
| `ai-advisor/ai-advisor.controller.ts`             | 🟡            | `AuthGuard, InstitutionScopeGuard`                                                                                  | peer-2 unstaged sweep — see follow-up below                                                                                                                                                                                                                                                                                                                                           |
| `cpa/cpa-client.controller.ts`                    | ➖            | `AuthGuard`                                                                                                         | **Different threat model** — internal CPA/firm context, not customer-tenant. peer-2 unstaged adds defense-in-depth comments.                                                                                                                                                                                                                                                          |

### `:orgId` / `:cycleId` controllers — 2 total

| Controller                        | Status  | Guard Stack                                                                       | Notes                                                                                                                                                                                                                                                                                                   |
| --------------------------------- | ------- | --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `close/close.controller.ts`       | 🔴 → ✅ | `AuthGuard` → **`AuthGuard, OrgMembershipGuard`**                                 | **Closed in this commit.** All 18 routes carry `:orgId` or `:cycleId`. New guard does direct membership lookup for `:orgId` and 1-hop `:cycleId → CloseCycle.organizationId → OrganizationMember` resolution.                                                                                           |
| `expenses/expenses.controller.ts` | ✅      | `AuthTenantGuard` + per-route `verifyOrgMembership(orgId, userId)` private helper | Different pattern (method-level membership check) but functionally equivalent — every URL-`:orgId` route calls `verifyOrgMembership` before service work. CSV upload escape paths (`auto`, `default`) resolve to caller's own org via `OrganizationMember.findFirst({where:{userId}})`, no IDOR vector. |

## Close Cockpit Closure Detail

### Why a new guard rather than reusing `InstitutionScopeGuard`

Close Cockpit ownership flows through **`OrganizationMember`** (multi-member, role-bearing) — institution ownership flows through **`Workspace.ownerId`** (single owner). Reusing `InstitutionScopeGuard` would conflate the two relationships and make peer-4's CI grep ambiguous about which guard applies where. A parallel `OrgMembershipGuard` keeps the contracts crisp.

### Guard contract

```
Caller authenticated?  →  no  → 401
Master CEO?            →  yes → pass
URL has :orgId?        →  yes → membership check on (orgId, userId)
URL has :cycleId?      →  yes → resolve CloseCycle.organizationId → membership check
Neither param?         →       → pass-through (mirrors InstitutionScopeGuard)
Member found?          →  no  → 403
Prisma exception?      →       → 403 (fail-closed; never silent allow)
```

The pass-through-when-absent rule lets the guard sit at the controller class level on a mixed-route controller — same shape that made peer-1's class-level move on `AlmController` safe.

### Surface coverage

All 18 routes on `CloseController` carry either `:orgId` (5 routes — cycles list/create + GL inspection) or `:cycleId` (13 routes — get/sign-off/reopen/tasks/recs/JEs/flux/activity/binder). No global routes on this controller, so coverage is 100%.

### Test coverage

10 unit tests in `org-membership.guard.spec.ts`:

1. 401 with no user
2. Master CEO bypass with no DB hit
3. Pass-through with neither param
4. 200 on valid `:orgId` membership
5. 403 on non-member `:orgId`
6. `:cycleId` → orgId resolution + membership pass
7. 404 on missing `:cycleId`
8. 403 on `:cycleId` lookup throw (fail-closed)
9. 403 on membership lookup throw (fail-closed)
10. Legacy `req.user.id` shape compatibility

## Defense-in-Depth Stack

| Layer           | Mechanism                                                | Status              |
| --------------- | -------------------------------------------------------- | ------------------- |
| L7 (controller) | Class-level guards (this audit)                          | ✅                  |
| L6 (service)    | Application-level filters in service queries             | ✅ existing         |
| L5 (Prisma)     | Tenant context middleware → RLS GUC                      | ✅ existing         |
| L4 (Postgres)   | Row-Level Security policies                              | ✅ existing         |
| L3 (CI)         | `scripts/verify-institution-scope-guard.mjs` enforcement | 🟡 peer-4 in flight |
| L2 (logging)    | Structured `denied` log lines per guard rejection        | ✅ all guards       |
| L1 (audit)      | This document                                            | ✅                  |

## Follow-Up Backlog (out of this commit's scope)

### `ai-advisor/ai-advisor.controller.ts` partial gap — CLOSED

Two routes the existing `InstitutionScopeGuard` did not catch because `:institutionId` was not in the URL:

1. **`POST /api/ai-advisor/ask`** — `institutionId` in request body. Service `AiAdvisorService.ask({institutionId, ...})` did not verify ownership before `getInstitutionContext(institutionId)`. **Closed in this commit (5dbd7880's successor)** by refactoring `InstitutionScopeGuard` to expose a public `verifyOwnership(institutionId, userId, isMasterCeo)` primitive, then calling it from the controller before `aiAdvisor.ask()`. The class-level guard still passes through (no URL param), but the explicit primitive call is the second-layer enforcement. Same lookup, same 403/404, same WARN denial logs as URL-scoped routes.
2. **`DELETE /api/ai-advisor/sessions/:sessionId`** — no scoped param at all. Session ownership not verified. **Closed by peer earlier in the wave** via userId-scoping in `ConversationHistoryService.deleteSession(sessionId, userId)`. The `deleteMany({where:{sessionId, userId}})` filter collapses "session not yours" and "session doesn't exist" onto the same 404 (anti-enumeration). Peer's commit body explicitly cited this audit doc as the spec — best peer-coordination outcome of the session.

### `ai-advisor` minor follow-ups

- **`GET /api/ai-advisor/sessions/:institutionId/:sessionId`** — institution-scoped (guard catches) but not user-filtered. A user in the same institution as another user could read that user's session history. Lower severity than the IDORs above (still institution-scoped) but real for multi-member-org futures. Tighten by adding `userId` filter to `getSessionHistory()` mirroring the `listSessions(institutionId, userId)` pattern.
- **userId extraction inconsistency** — `AuthGuard` canonically sets `req.user.userId` (per `auth.guard.ts:271`). The `ai-advisor.controller.ts` `deleteSession()` reads `req.user?.id ?? req.user?.sub ?? ''` — skipping the canonical field. The `ask()` method now widens the chain to `userId ?? id ?? sub`. Normalize the chain repo-wide as a small follow-up sweep so all controllers agree on the auth-source field order.
- **`AiAdvisorService.getInstitutionContext()` signature drift** — `ai-advisor.service.spec.ts` is mid-update to a 2-arg `(institutionId, userId)` signature pushing ownership checks INTO the service (a complementary defense-in-depth approach — service refuses to load context unless caller owns the institution). Spec is failing because implementation hasn't caught up. Either the spec change should be reverted (since the controller-layer fix in this commit closes the same IDOR), OR the implementation should be updated to match. Decide before next ai-advisor edit.

### `ai-advisor.gateway.ts` WebSocket auth bypass — CLOSED

Status: **CLOSED** (this commit). Was Critical at first audit — far worse than any HTTP IDOR found in the wave.

The `AiAdvisorGateway` (Socket.io, `@WebSocketGateway({namespace:'ai-advisor'})`) has **zero JWT verification**:

```typescript
handleConnection(client: Socket) {
  const userId =
    (client.handshake.auth as Record<string, string>)?.userId ||
    (client.handshake.query as Record<string, string>)?.userId ||
    'anonymous';
  (client as any)._userId = userId;
}
```

Any client who knows the WS endpoint URL can:

1. Connect with `?userId=anyone` query parameter — no token verification, just trust whatever string the client supplies.
2. Emit `ask` events with `payload.institutionId = anything` — gateway calls `aiAdvisor.streamAsk()` which loads institution context and bills Anthropic API calls **on your account on behalf of the impersonated user/institution**.
3. Emit `history` events with `payload.institutionId` + `payload.sessionId` — gateway calls `conversationHistory.getSessionHistory()` and emits the messages back. Reads any session.

Compounded vectors:

- WS bypass → can call `streamAsk` for any institution
- `streamAsk` has the same body-trust pattern as `ask` (no service-level ownership check yet — depends on the in-flight `getInstitutionContext` 2-arg signature decision above)
- WS bypass → can read any session's history

The HTTP `POST /ask` IDOR is now closed by this commit's `verifyOwnership` call, but the WS `ask` path bypasses the entire HTTP stack. Both paths invoke the same service.

**Closure (shipped this commit):**

1. **Handshake-time JWT verify.** `handleConnection` now extracts a bearer token from `client.handshake.auth.token` (preferred) or `Authorization: Bearer <token>` header (legacy). Verified via `JwtService.verify()` — same JwtModule the `AuthGuard` uses (re-exported from `AuthModule`, imported by `AiAdvisorModule`). The verified `userId` (from `payload.userId` or `payload.sub`) and `isMasterCeo` flag (from `payload.access.isMasterCeo`) land on `client.data.user`. Connections with missing/invalid/payload-shape-bad tokens get an `error` event with `code: 'UNAUTHENTICATED'` and `client.disconnect(true)`. Fail-closed; no anonymous fallback.
2. **Per-handler defense-in-depth user check.** `handleAsk` and `handleHistory` re-validate `client.data.user` and emit `code: 'UNAUTHENTICATED'` + return early if absent. A future regression on the connection path can't silently re-open the bypass — the handler still rejects.
3. **`verifyOwnership` before service call.** Same primitive as the HTTP path (e88ae20c controller fix). Single source of truth for the ownership contract across HTTP + WebSocket: `institutionScope.verifyOwnership(payload.institutionId, user.userId, user.isMasterCeo)` before `streamAsk` (in `handleAsk`) and before `getSessionHistory` (in `handleHistory`). On rejection, emits `code: 'FORBIDDEN'` with the underlying error message — same WARN logs as URL-path code paths.
4. **Spec coverage.** 16 tests in `ai-advisor.gateway.spec.ts` (NEW): 6 handshake-verify cases (no token in any source, JwtService throws, payload no userId/sub, valid `auth.token`, valid Bearer header, master-CEO flag forwarding), 6 `handleAsk` cases (unauthenticated rejection, INPUT_INVALID on bad payload, verifyOwnership-before-streamAsk ordering, FORBIDDEN propagation, master-CEO forwarding, happy-path event sequence), 4 `handleHistory` cases (parallel coverage of unauthenticated, malformed payload, ordering, FORBIDDEN propagation).

**Defense layering on the WS path now (post-fix):**

| Layer           | What                                                                                                                                     | Status         |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | -------------- |
| L8 (transport)  | CORS allowlist via `isAllowedOrigin`                                                                                                     | ✅ existing    |
| L7 (handshake)  | JWT verify in `handleConnection`                                                                                                         | ✅ this commit |
| L6 (event)      | `client.data.user` re-check in handlers                                                                                                  | ✅ this commit |
| L5 (event)      | `verifyOwnership(institutionId, userId, isMasterCeo)` before service                                                                     | ✅ this commit |
| L4 (service)    | `streamAsk` / `getSessionHistory` (unchanged — peer's mid-flight 2-arg `getInstitutionContext(id, userId)` would add another layer here) | 🟡 follow-up   |
| L3 (Prisma RLS) | Row-level security via TenantContext                                                                                                     | ✅ existing    |
| L2 (logging)    | Structured WARN on rejection (handshake fail, no userId, ownership denied)                                                               | ✅ this commit |

**Known follow-up:** Supabase JWT support is not in this commit — `JwtService.verify()` only handles legacy JWTs. If WS clients use Supabase tokens in production, add a fallback path that mirrors `AuthGuard.verifySupabaseToken()`. The HTTP `AuthGuard` already supports both; the gateway gives up the multi-source verification for simplicity. Track as a small follow-up if Supabase WS clients exist.

### CI enforcement — CLOSED

Status: **CLOSED** (commits `5b2c26af` design/handoff prose + `137ee765` code drop, both 2026-05-16).

`scripts/verify-institution-scope-guard.mjs` was generalized from a single hardcoded `InstitutionScopeGuard` checker into a config-driven framework with a `RULES` array at the top of the file. Three rules currently registered, all gating CI via `npm run lint` → `verify:tenant-scope`:

| Rule id                  | Canonical param  | Guard                                                        | Model                | Routes guarded |
| ------------------------ | ---------------- | ------------------------------------------------------------ | -------------------- | -------------- |
| `institution-scope`      | `:institutionId` | `InstitutionScopeGuard`                                      | `Workspace.ownerId`  | 132 / 132      |
| `org-membership`         | `:orgId`         | `OrgMembershipGuard`                                         | `OrganizationMember` | 12 / 12        |
| `close-cycle-membership` | `:cycleId`       | `OrgMembershipGuard` (1-hop via `CloseCycle.organizationId`) | `OrganizationMember` | 11 / 11        |

Total **155 routes provably guarded across 3 patterns, 0 violations**. Self-test 18 cases (was 11), all green.

Adding a new tenancy root (e.g. the planned `FirmOwnsClientGuard` for the CPA cross-tenant skip — peer `sid=8f694e66`'s in-flight commit 3 of 4) is a one-line `RULES` table entry + one self-test fixture. No parser changes. Each rule carries its own `canonicalParam`, `variants[]` (R1 detector for param-name typos), `guard` class name, `model` label, and `docRef` pointer back to this audit doc.

Skip keyword widened from `// verify:institution-scope-skip` to the generic `// verify:tenant-scope-skip — <reason>` (legacy keyword still accepted for backward compat — locked by a self-test case). Per-route skips require a non-empty reason; reason-less skips still fail R2. The `expenses.controller.ts` `:orgId` routes carry 5 such skip comments documenting the inline `verifyOrgMembership()` helper pattern (which supports the `:orgId='auto'/'default'` escape paths that `OrgMembershipGuard.canActivate` would 403).

CI wiring: `backend-node/package.json` chains `verify:tenant-scope` into `npm run lint` (the primary script `verify:tenant-scope` and the backward-compat alias `verify:institution-scope` both run the same node script). `.github/workflows/ci-cd.yml:217` invokes `npm run lint` from the backend job, so every PR is gated by the verifier.

Per-rule summary line surfaces regressions with the rule id, not buried in a global count:

```
verify-institution-scope-guard: 60 controller(s) scanned [institution-scope: 132/132, org-membership: 12/12, close-cycle-membership: 11/11], 0 violation(s).
```

### Cross-tenant cursor validation audit

`agent-api/alerts.controller.ts` and `agent-api/agent-runs.controller.ts` already validate that pagination cursors belong to the requesting institution (defense beyond RLS). Audit the rest of the keyset-paginated endpoints and apply the same pattern.

## Output-trust by-id audit (2026-05-16) — 1 real IDOR closed, 8 by-design legit

After R3 v3 (`verify-body-trust`) closed the input-side DTO surface and R5 (`verify-userid-chain`, `053e1832`) locked the canonical `req.user` identity chain, swept the residual output-trust surface — `findFirst`/`findUnique` by-id reads in service files that don't carry a tenant key in the `where` clause. Regex: `this\.prisma\.\w+\.(findFirst|findUnique)\(\s*\{\s*where:\s*\{\s*id\s*[:,}]` across `src/` excluding `*.spec.ts` → 9 sites.

Classifications (8 legit, 1 real):

| #     | Site                                                                                                                             | Classification                        | Why safe / what was fixed                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| ----- | -------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1     | `agent-api/alerts.controller.ts:167`                                                                                             | Legit — in-method tenant compare      | Same handler line 156 does `existing.institutionId !== institutionId` before this idempotency early-return                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| 2     | `portal/portal.controller.ts:760`                                                                                                | Legit — self-lookup                   | `findUnique({ where: { id: userId } })` where `userId` IS the authenticated user's canonical id (`req.user.userId`); the row IS the caller                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| 3     | `leads/lead-scoring.service.ts:39` (called from `leads.controller.ts:148`)                                                       | Legit — admin-only route              | Controller route `GET /admin/api/leads/:id/score` is `@UseGuards(AdminKeyGuard)`; lead is the marketing/waitlist row, no per-tenant scoping by design                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| 4     | `agents/runner/agent-run.service.ts:220` (`getById`, called from `agents.controller.ts:117-122` `getRun` + `124-134` `getAudit`) | Legit — fetch-then-verify             | Both controller handlers call `this.runs.getById(runId)` then `await this.assertRunOwnership(run, req)` BEFORE returning; the helper throws `Forbidden` if not authorized so the loaded row is never surfaced to unauthorized callers                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| 5     | `alm/reseller.service.ts:47` (called from `alm.controller.ts:2050`)                                                              | Legit — global catalog                | Resellers are the platform's CPA-firm catalog (multi-tenant by design — every tenant can see every reseller); `revenueSharePct` is reseller-platform contract data, not cross-tenant secrets. _Caveat:_ if reseller billing terms ever become sensitive, revisit this skip                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| 6     | `governance/governed-scenario.service.ts:35`                                                                                     | Legit — global catalog                | Governed-scenario catalog is shared across all tenants; the `scenarioKey` is intentionally globally unique                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| 7     | `governance/governed-benchmark.service.ts:39`                                                                                    | Legit — global catalog                | Same shape as #6 — global benchmark catalog                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| 8     | `feedback/feedback.controller.ts:104`                                                                                            | Legit — public auth-surface           | Route carries `// verify:auth-skip — public follow-up comment after NPS scoring; feedback row is the auth surface (must exist)`; the row IS the auth check (existence + matching id is the bearer-token equivalent for an anonymous-NPS surface)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| **9** | **`alm/reports/report-artifact.controller.ts:64-72` `getById`**                                                                  | **REAL IDOR — closed in same commit** | Class-level `@UseGuards(AuthGuard, InstitutionScopeGuard, RolesGuard)` is SET, but the by-id URL lacks `:institutionId` for `InstitutionScopeGuard.canActivate` to scope on. The earlier IDOR_RESIDUAL_AUDIT entry ("`alm/reports/report-artifact.controller.ts` ✅ — already class-level guarded") was a false clean — the guard had no tenancy key in the path. Cross-tenant artifact metadata (storage locator, checksum, format, institutionId) was readable by any authenticated `OWNER`/`ANALYST` who guessed an artifact UUID. **Fix (same commit):** inject `InstitutionScopeGuard` into the controller constructor, switch handler to fetch-then-verify (`artifact = service.getById(id)` → `await this.institutionScope.verifyOwnership(artifact.institutionId, userId, isMasterCeo)` → return). Paired 3 new spec tests in `report-artifact.controller.spec.ts`: (a) happy-path verifies ownership with the artifact's `institutionId`, (b) cross-tenant call propagates `ForbiddenException`, (c) master-CEO flag forwarded to allow platform-admin bypass. 10/10 tests pass. |

### Why no R4 verifier (yet)

The 9 sites + 8/9 legit classification means a static "by-id without tenant key in where" rule would generate 88% false-positive rate. Each legit case has a distinct semantic reason (global catalog, public auth-surface, fetch-then-verify, in-method compare, admin-only, self-lookup) — encoding all of those as detection patterns plus skip annotations is a high-noise / low-marginal-signal ratchet at current sample size. **Open follow-up:** if 2+ more real IDORs of this shape surface, building R4 with selective per-pattern detection becomes worth it. Until then, the audit-doc record + manual review at each new `findFirst({where:{id}})` introduction is the right shape.

### Routes intentionally NOT changed in this sweep

- `report-artifact.controller.ts:88-91` `findByChecksum` — reverse-lookup by content checksum is a verification feature ("did CerniQ produce this PDF?"); the checksum itself is content-derived, not a guessable id. Leaks the artifact's `institutionId` to anyone who already has the PDF, which is an acceptable threat-model trade for the verification UX. Separate ticket if marketing/legal flags it.
- `report-artifact.controller.ts:105-114` `verify` (POST `/verify/:id`) — accepts a content buffer + artifact id, returns valid=true/false. Confirmation oracle only matters if the caller already has the artifact content; not a metadata-leak surface.

## References

- Original analyst-only fix: `a6337c32`
- 5-controller systemic sweep: `8f69c148`
- Existing institution guard: `backend-node/src/agent-api/guards/institution-scope.guard.ts`
- New org-membership guard: `backend-node/src/close/guards/org-membership.guard.ts`
