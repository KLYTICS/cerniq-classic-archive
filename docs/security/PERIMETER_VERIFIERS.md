# CerniQ Backend Perimeter Verifiers — Single-Page Index

**Snapshot date:** 2026-05-16
**Live state:** all 8 verifiers + tsc + no-orphan-spec at **0 violations** under `--strict`; 6030/6030 jest tests pass.

---

## What's locked

`cd backend-node && npm run lint` chains a structural verifier stack between `eslint` and `tsc --noEmit`. Each verifier embeds a `--self-test` (D24 ratchet §4) so the rule itself is locked in CI.

| # | Verifier | What it catches | Live measure | Skip annotation | Commit of record | Audit doc |
|---|---|---|---|---|---|---|
| **R1** | `verify-institution-scope-guard.mjs` | Path-param IDOR — `:institutionId` / `:orgId` / `:cycleId` / `:workspaceId` routes without `InstitutionScopeGuard` / `OrgMembershipGuard` / `CloseCycleMembershipGuard` / `FirmOwnsClientGuard` at class or method level | 132/132 + 12/12 + 11/11 + 1/1 | `// verify:tenant-scope-skip — <reason>` (legacy: `// verify:institution-scope-skip`) | `8f69c148` + `b2a64c25` + `58651c54` | [`IDOR_RESIDUAL_AUDIT.md`](IDOR_RESIDUAL_AUDIT.md) |
| **R2** | `verify-auth-coverage.mjs` | Routes without one of 7 recognized auth guards (`AuthGuard`, `AuthTenantGuard`, `ApiKeyAuthGuard`, `AdminKeyGuard`, `RolesGuard`, `AuthAdminGuard`, `PassportAuthGuard`) | 60 ctrl / 512 routes / 453 guarded / 48 skip-exempt | `// verify:auth-skip — <reason>` (route) · `// verify:auth-skip-controller — <reason>` (class) | `d3fb17b5` (Phase B + C) | [`AUTH_COVERAGE_AUDIT.md`](AUTH_COVERAGE_AUDIT.md) |
| **R3 v3** | `verify-body-trust.mjs` | Body-tenancy IDOR — handlers that bind a tenancy-key-bearing schema/DTO (`institutionId` / `organizationId` / `orgId` / `clientInstitutionId` / `workspaceId`) without a paired `verify*Ownership` / `verify*Membership` / `assert*Access` call. Detects Zod `parseOrThrow` / `safeParse` / `parse` AND class-validator typed `@Body() / @MessageBody()` decorators. Walks `*.controller.ts` (HTTP) + `*.gateway.ts` (WebSocket) entries. | 64 entry-files / 512 handlers / 36 tenancy-bearing schemas | `// verify:body-trust-skip — <reason>` (6-line lookback above route decorator) | `c8c8a3c3` (R3 v3 + 3 alm IDOR closures) | [`AUTH_COVERAGE_AUDIT.md`](AUTH_COVERAGE_AUDIT.md) |
| **R5** | `verify-userid-chain.mjs` | Canonical `req.user` identity-extraction chain — any line that reads `req.user?.id` or `req.user?.sub` must also contain `req.user?.userId`, AND `userId` must appear textually BEFORE `id`/`sub` (so the `??` chain falls through in canonical order: `userId ?? id ?? sub`). Per `auth.guard.ts:271` `userId` is the canonical field; `id` is JWT-iat / Passport-strategy legacy, `sub` is JWT-subject legacy. | 60 ctrl | `// verify:userid-chain-skip — <reason>` (same line or previous line) | `053e1832` (verifier + 12 site normalizations) | [`IDOR_RESIDUAL_AUDIT.md`](IDOR_RESIDUAL_AUDIT.md) |
| **Rule 4** | `verify-rule-4-audit-immutable.mjs` | KLYTICS canon — `audit_log*` tables must be append-only (no UPDATE / DELETE in migrations or service code) | 37 migrations + 630 src files | (none — fail-closed) | (KLYTICS canon) | [`KLYTICS_AUDIT_DISCIPLINE.md`](../platform/KLYTICS_AUDIT_DISCIPLINE.md) |
| **Rule 9** | `verify-rule-9-stamping.mjs` | KLYTICS canon — every LLM-calling site must stamp prompt-version + cost provenance (input_tokens / output_tokens / costUsdCents) | 7 LLM files: 5 stamped + 2 baselined | (baseline list in script) | `9f5c6677` (ai-advisor) + `6892d7e6` (impact-extractor) + `11b4b94f` (llm-bridge) | [`KLYTICS_AUDIT_DISCIPLINE.md`](../platform/KLYTICS_AUDIT_DISCIPLINE.md) |
| **Rule 11** | `verify-rule-11-any-rationale.mjs` | KLYTICS canon — every `as any` / `: any` must carry a `// type-rationale:` comment within the preceding lines | 1247 files / 979 hits across 213 files (baseline ratchet, no regressions allowed) | `// type-rationale: <why>` (preceding line) | (KLYTICS canon) | [`KLYTICS_AUDIT_DISCIPLINE.md`](../platform/KLYTICS_AUDIT_DISCIPLINE.md) |
| **Rule 12** | `verify-rule-12-crypto-randomness.mjs` | KLYTICS canon — security-scope code paths must use `crypto.randomBytes` / `crypto.randomUUID`, never `Math.random()` | 630 files / 14 non-security PRNG hits (allowed) | (none — domain inferred from path) | (KLYTICS canon) | [`KLYTICS_AUDIT_DISCIPLINE.md`](../platform/KLYTICS_AUDIT_DISCIPLINE.md) |
| ★ | `verify-no-orphan-spec.mjs` | Spec discipline — every `*.spec.ts` must pair with a source file (or be in baseline). 8 pairing rules: co-located, `__tests__/`, integration, suffix-strip, dir-suite | 418 spec files / 0 orphans (15 baselined) | (baseline list in script) | (canonical) | (none — script-local) |

**Total locked surface:** `60 controllers · 512 routes · 36 tenancy-bearing schemas · 132 institution-scope sites · 12 org-membership sites · 11 close-cycle sites · 1 firm-owns-client site · 418 spec files`. Each verifier scope intersects but every dimension is independently failable.

---

## What was closed in this week's sweep

4 real cross-tenant IDORs closed within 24 hours by structural verifier-then-fix discipline (R3 v3 caught 3, R4 audit caught 1):

| SHA | IDOR class | Site | Root cause |
|---|---|---|---|
| `c8c8a3c3` | Body-tenancy (workspaceId) | `alm.controller.ts createInstitution` | DTO declared `workspaceId: string` but service did raw `prisma.institution.create({ data: { workspaceId } })` with zero authz. R3 v3 surfaced via class-validator DTO extension. |
| `c8c8a3c3` | Body-tenancy (institutionId) | `alm.controller.ts saveScenario` | `createdBy: userId` was metadata, not authz. Caller-supplied `dto.institutionId` flowed to `scenarioPersistence.saveScenario` with no preceding `verifyOwnership`. |
| `c8c8a3c3` | Body-tenancy (institutionId) | `alm.controller.ts saveCustomYieldCurve` | Service `saveCustomCurve(dto)` didn't receive `userId` so controller-boundary authz was the only structural option. |
| `8d8e81a7` | Output-trust (by-id read) | `report-artifact.controller.ts getById` | Class-level `@UseGuards(AuthGuard, InstitutionScopeGuard, RolesGuard)` was SET, but URL `:id` had no `:institutionId` param for the guard to scope on — guard-presence ≠ guard-effectiveness. **The earlier `IDOR_RESIDUAL_AUDIT` ✅ row was a false clean.** |

All four fix-patterns follow the same shape: inject the kernel ownership primitive into the controller constructor, extract `userId` via the R5 canonical chain, call `verifyOwnership(tenancyKey, userId, isMasterCeo)` BEFORE the service call (or fetch-then-verify for output-trust). Paired security spec uses `mock.invocationCallOrder` to lock guard-runs-before-service.

---

## What's deferred (and why)

| Deferral | Rationale | Trigger to revisit |
|---|---|---|
| **R4 verifier** (output-trust by-id static rule) | 8/9 of `findFirst/findUnique({where:{id}})` sites in services are by-design legit (global catalogs, fetch-then-verify, self-lookup, in-method compare, admin-only, public auth-surface). Static rule would emit ~88% false-positive rate. | 2+ more real IDORs of the shape surface. Until then: manual review at each new `findFirst({where:{id}})` introduction; audit-doc row is the artifact. See `IDOR_RESIDUAL_AUDIT.md` §"Output-trust by-id audit (2026-05-16)". |
| **R5b req.apiUser canonical chain** | All 9 `req.apiUser.*` read sites already canonical (`userId` everywhere). No live violations. Building the verifier as pure regression-lock has low marginal value when the surface is small (1 guard sets it; 2 controllers read it). | A divergent `req.apiUser.id` or `req.apiUser.sub` read appears. |
| **R6 mutation-audit coverage** | 211 mutation routes, 19 `audit_log*.create()` sites in services — coverage ratio ~9% if every mutation should emit. But many mutations are inherently audit-emitting (audit_log itself, admin tools) or non-state-changing (idempotent POST). Naive ratchet would require per-route classification across 211 routes — enormous surface; deserves its own session. | A SOC2 audit or operator request for traceability. |
| **R7 rate-limit coverage** | 39 `@Throttle` mentions across the tree vs 211 mutation routes (~18%). Real DoS / brute-force exposure on uncovered mutations, but ratchet shape is identical to R6 — 211-route classification. | A real DoS incident or pre-launch hardening sprint. |
| **R8 output presenter / response filtering** | No live recurrence pattern detected. Controllers tend to return either raw Prisma rows or hand-shaped objects — no `data: {...row}` mass-leak idiom found in this audit. | An incident where a controller returns more fields than the caller should see. |

The decision to NOT ratchet is itself a structural quality move — premature verifiers carry maintenance cost without catching value. The "audit-doc row + manual review at each new introduction" pattern is the disciplined alternative when the FP rate is high or the surface is small.

---

## How to add a new verifier (D24 ratchet pattern)

Per [`CLAUDE.md`](../../CLAUDE.md) §"D24 ratchet pattern":

1. **Measure** — grep / static scan the current floor (or ceiling).
2. **Lock** — set threshold at integer-below-current (for floors: coverage, test counts) or integer-above-current (for ceilings: bundle size, latency).
3. **Ratchet** — coverage thresholds only RAISE; bundle ceilings only LOWER. Loosening requires explicit decision + `SESSION_HANDOFF` §5 entry naming the reason.
4. **Self-test** — embed `--self-test` fixture cases so the rule itself is verified in CI. 12-16 cases per rule is typical (canonical OK / each VIOLATION shape / skip-with-reason OK / skip-empty-reason VIOLATION / edge cases).

Mechanical checklist for a new `verify-X.mjs`:

- [ ] Walk the right entry-set (`*.controller.ts`, `*.service.ts`, etc.).
- [ ] Strip comments / string-literals as appropriate (text-based verifiers tolerate noise; AST-based ones don't).
- [ ] Define skip annotation: `// verify:<rule-name>-skip — <reason>` (non-empty reason required).
- [ ] Emit summary line in this shape: `verify-X: <N> entries scanned, <K> sites found, <V> violation(s).`
- [ ] On `--strict` flag, exit 1 on violations; otherwise exit 0 (lets the script land report-only).
- [ ] Wire into `backend-node/package.json` `lint` script between existing R2/R3 and rule-4-* (alphabetical order on the rule prefix).
- [ ] Add a SESSION_HANDOFF §5 entry naming the commit + the live measure.
- [ ] Update this index doc with the new row.

---

## Kernel primitives recap

Three mirrored kernel guards (mirrored shapes, exact same contract on three tenancy roots) drive R1 + the structural fixes:

| Primitive | Tenancy root | Hops | Use when |
|---|---|---|---|
| `InstitutionScopeGuard.verifyOwnership(institutionId, userId, isMasterCeo)` | `Institution → workspace → ownerId` (two-hop) | 2 | URL or body has `institutionId` |
| `OrgMembershipGuard.verifyMembership(orgId, userId, isMasterCeo)` | `OrganizationMember` | 1 | URL or body has `organizationId` |
| `InstitutionScopeGuard.verifyWorkspaceOwnership(workspaceId, userId, isMasterCeo)` | `Workspace.ownerId` (one-hop) | 1 | URL or body has raw `workspaceId` (NCUA imports, ALM institution-create) |

All three throw `ForbiddenException` on denial, `NotFoundException` for missing rows, fail-closed on Prisma exceptions, master-CEO bypass via the third arg. Verifier alphabet recognizes `verify\w*Ownership` and `verify\w*Membership` — future variants (`verifyFirmOwnership`, `verifyClientOwnership`, etc.) pass without further script edits.

---

## Related canonical docs

- [`CLAUDE.md`](../../CLAUDE.md) — operating instructions + D24 ratchet pattern + shared-tree git rules
- [`AUTH_COVERAGE_AUDIT.md`](AUTH_COVERAGE_AUDIT.md) — R2 + R3 details, 5 auth patterns
- [`IDOR_RESIDUAL_AUDIT.md`](IDOR_RESIDUAL_AUDIT.md) — R1 controller matrix + R4 output-trust audit
- [`KLYTICS_AUDIT_DISCIPLINE.md`](../platform/KLYTICS_AUDIT_DISCIPLINE.md) — 12-rule cross-product canon (Rule 1 / 4 / 9 / 11 / 12 verifiers)
- [`LEGACY_JWT_SUNSET.md`](LEGACY_JWT_SUNSET.md) — Auth0 migration end-state + legacy field deprecation timeline
