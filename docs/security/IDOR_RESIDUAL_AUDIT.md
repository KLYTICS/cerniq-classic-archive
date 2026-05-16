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

### `ai-advisor/ai-advisor.controller.ts` partial gap (peer-2 sweep area)

Two routes the existing `InstitutionScopeGuard` does not catch because `:institutionId` is not in the URL:

1. `POST /api/ai-advisor/ask` — `institutionId` in request body. Service `AiAdvisorService.ask({institutionId, ...})` does not verify ownership before `getInstitutionContext(institutionId)`.
2. `DELETE /api/ai-advisor/sessions/:sessionId` — no scoped param at all. Session ownership not verified.

Fix sketch: either (a) move `institutionId` into the URL path so the existing guard catches it, or (b) add a service-level ownership check in `AiAdvisorService.ask` and a session-ownership check in `ConversationHistoryService.deleteSession`. Peer-2's unstaged changes appear to be approaching this — verify before adding more work.

### CI enforcement (peer-4 in flight)

Once `scripts/verify-institution-scope-guard.mjs` is wired into CI, extend the same pattern to enforce `OrgMembershipGuard` on any controller that imports `OrganizationMember` Prisma access. Locks the close-cockpit invariant the way peer-4's check locks the institution-scope invariant.

### Cross-tenant cursor validation audit

`agent-api/alerts.controller.ts` and `agent-api/agent-runs.controller.ts` already validate that pagination cursors belong to the requesting institution (defense beyond RLS). Audit the rest of the keyset-paginated endpoints and apply the same pattern.

## References

- Original analyst-only fix: `a6337c32`
- 5-controller systemic sweep: `8f69c148`
- Existing institution guard: `backend-node/src/agent-api/guards/institution-scope.guard.ts`
- New org-membership guard: `backend-node/src/close/guards/org-membership.guard.ts`
