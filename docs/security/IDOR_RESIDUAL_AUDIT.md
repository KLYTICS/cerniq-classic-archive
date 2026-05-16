# IDOR Residual Audit — Cross-Tenant Path Parameter Sweep

**Date:** 2026-05-15
**Scope:** Backend-node controllers carrying `:institutionId`, `:orgId`, `:cycleId`, or `:workspaceId` URL parameters.
**Trigger:** `8f69c148` (peer-1) closed 5 high-blast-radius `:institutionId` controllers; this audit verifies the residual surface and documents defense posture.

## Sweep Wave Coordination

Four parallel Claude sessions converged on the IDOR surface within a 30-minute window:

| Peer | Scope | Outcome |
| --- | --- | --- |
| peer-1 | 5 `:institutionId` controllers (alm, alm-advisor, alm-advisor-v2, camel-cert, exam-prep) | Landed in `8f69c148` — class-level `@UseGuards(AuthTenantGuard, InstitutionScopeGuard)` |
| peer-2 | `realtime-alm/market-data.controller.ts` 3-route extension + supporting module wiring | In flight at audit time |
| peer-2 (residual) | `ai-advisor`, `ncua`, `cpa-client`, `report-artifact` controller/module sweep | Unstaged at audit time |
| peer-4 | `scripts/verify-institution-scope-guard.mjs` CI guard + frontend agents-contract-drift | In flight |
| peer-3 (this) | `close` cockpit `OrgMembershipGuard`, residual audit doc | This commit |

Conway-style decomposition by path: each peer owns disjoint files. No collisions.

## Controller Matrix

Status legend: ✅ guarded · 🟡 partial · 🔴 gap · ➖ different threat model

### `:institutionId` controllers — 16 total

| Controller | Status | Guard Stack | Notes |
| --- | --- | --- | --- |
| `alm/alm.controller.ts` | ✅ | `AuthTenantGuard, InstitutionScopeGuard` | peer-1 `8f69c148` (93 routes) |
| `alm/alm-advisor.controller.ts` | ✅ | `AuthTenantGuard, InstitutionScopeGuard` | peer-1 `8f69c148` |
| `alm/alm-advisor-v2.controller.ts` | ✅ | `AuthTenantGuard, InstitutionScopeGuard` | peer-1 `8f69c148` |
| `alm/exam-prep/camel-certification.controller.ts` | ✅ | `AuthTenantGuard, InstitutionScopeGuard, RolesGuard` | peer-1 `8f69c148` |
| `exam-prep/exam-prep.controller.ts` | ✅ | `AuthTenantGuard, InstitutionScopeGuard` | peer-1 `8f69c148` (was completely unauthenticated) |
| `alm/alm-analyst.controller.ts` | ✅ | `AuthTenantGuard, InstitutionScopeGuard` | originally `a6337c32`, the spark for the systemic sweep |
| `alm/reports/report-artifact.controller.ts` | ✅ | `AuthGuard, InstitutionScopeGuard, RolesGuard` | already class-level guarded; peer-2 unstaged adds spec coverage |
| `agent-api/copilot.controller.ts` | ✅ | `AuthGuard, InstitutionScopeGuard` | base path always supplies `:institutionId` |
| `agent-api/agent-tenant-stream.controller.ts` | ✅ | `AuthGuard, InstitutionScopeGuard` | + in-process event-bus filter on resolved institution |
| `agent-api/alerts.controller.ts` | ✅ | `AuthGuard, InstitutionScopeGuard` | cursor validation also rejects cross-tenant cursor IDs |
| `agent-api/agent-export.controller.ts` | ✅ | `AuthGuard, InstitutionScopeGuard` | + audit chain hash verification on export |
| `agent-api/agent-runs.controller.ts` | ✅ | `AuthGuard, InstitutionScopeGuard` | + cursor validation, defense-in-depth idempotency |
| `ncua/ncua.controller.ts` | ✅ | `AuthTenantGuard, InstitutionScopeGuard` | peer-2 unstaged tightens module providers |
| `realtime-alm/market-data.controller.ts` | 🟡 | `AuthGuard` + 3 method-level routes pending | **peer-2 in flight** — not in this commit's scope |
| `ai-advisor/ai-advisor.controller.ts` | 🟡 | `AuthGuard, InstitutionScopeGuard` | peer-2 unstaged sweep — see follow-up below |
| `cpa/cpa-client.controller.ts` | ➖ | `AuthGuard` | **Different threat model** — internal CPA/firm context, not customer-tenant. peer-2 unstaged adds defense-in-depth comments. |

### `:orgId` / `:cycleId` controllers — 2 total

| Controller | Status | Guard Stack | Notes |
| --- | --- | --- | --- |
| `close/close.controller.ts` | 🔴 → ✅ | `AuthGuard` → **`AuthGuard, OrgMembershipGuard`** | **Closed in this commit.** All 18 routes carry `:orgId` or `:cycleId`. New guard does direct membership lookup for `:orgId` and 1-hop `:cycleId → CloseCycle.organizationId → OrganizationMember` resolution. |
| `expenses/expenses.controller.ts` | ✅ | `AuthTenantGuard` + per-route `verifyOrgMembership(orgId, userId)` private helper | Different pattern (method-level membership check) but functionally equivalent — every URL-`:orgId` route calls `verifyOrgMembership` before service work. CSV upload escape paths (`auto`, `default`) resolve to caller's own org via `OrganizationMember.findFirst({where:{userId}})`, no IDOR vector. |

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

| Layer | Mechanism | Status |
| --- | --- | --- |
| L7 (controller) | Class-level guards (this audit) | ✅ |
| L6 (service) | Application-level filters in service queries | ✅ existing |
| L5 (Prisma) | Tenant context middleware → RLS GUC | ✅ existing |
| L4 (Postgres) | Row-Level Security policies | ✅ existing |
| L3 (CI) | `scripts/verify-institution-scope-guard.mjs` enforcement | 🟡 peer-4 in flight |
| L2 (logging) | Structured `denied` log lines per guard rejection | ✅ all guards |
| L1 (audit) | This document | ✅ |

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

| Layer | What | Status |
| --- | --- | --- |
| L8 (transport) | CORS allowlist via `isAllowedOrigin` | ✅ existing |
| L7 (handshake) | JWT verify in `handleConnection` | ✅ this commit |
| L6 (event) | `client.data.user` re-check in handlers | ✅ this commit |
| L5 (event) | `verifyOwnership(institutionId, userId, isMasterCeo)` before service | ✅ this commit |
| L4 (service) | `streamAsk` / `getSessionHistory` (unchanged — peer's mid-flight 2-arg `getInstitutionContext(id, userId)` would add another layer here) | 🟡 follow-up |
| L3 (Prisma RLS) | Row-level security via TenantContext | ✅ existing |
| L2 (logging) | Structured WARN on rejection (handshake fail, no userId, ownership denied) | ✅ this commit |

**Known follow-up:** Supabase JWT support is not in this commit — `JwtService.verify()` only handles legacy JWTs. If WS clients use Supabase tokens in production, add a fallback path that mirrors `AuthGuard.verifySupabaseToken()`. The HTTP `AuthGuard` already supports both; the gateway gives up the multi-source verification for simplicity. Track as a small follow-up if Supabase WS clients exist.

### CI enforcement (peer-4 in flight)

Once `scripts/verify-institution-scope-guard.mjs` is wired into CI, extend the same pattern to enforce `OrgMembershipGuard` on any controller that imports `OrganizationMember` Prisma access. Locks the close-cockpit invariant the way peer-4's check locks the institution-scope invariant.

### Cross-tenant cursor validation audit

`agent-api/alerts.controller.ts` and `agent-api/agent-runs.controller.ts` already validate that pagination cursors belong to the requesting institution (defense beyond RLS). Audit the rest of the keyset-paginated endpoints and apply the same pattern.

## References

- Original analyst-only fix: `a6337c32`
- 5-controller systemic sweep: `8f69c148`
- Existing institution guard: `backend-node/src/agent-api/guards/institution-scope.guard.ts`
- New org-membership guard: `backend-node/src/close/guards/org-membership.guard.ts`
