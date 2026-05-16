# KLYTICS Audit Discipline

> Cross-product engineering canon for KLYTICS LLC products: **ComplyKit**, **AEGIS**, **CerniQ**, **Apex**.

Status: **Canon** (2026-05-15). Authoritative when in conflict with individual product `CLAUDE.md` files for cross-cutting governance concerns; product files retain authority over product-specific implementation choices.

Classification: **KLYTICS RESTRICTED**.

---

## Why this doc exists

KLYTICS ships four products that all touch regulated workflows:

- **ComplyKit** — AI-native compliance readiness for B2B SaaS (SOC 2, PDPA, GDPR)
- **AEGIS** — agent verification + behavioral attestation layer
- **CerniQ** — bilingual ALM analytics for PR cooperativas (COSSEC, NCUA)
- **Apex** — FX command center with real broker flow

A 2026-05-15 cross-product audit revealed that all four independently invented the same disciplines: never silent-fail, sign your artifacts, pin lineage, append-only audit. Different domains forced different vocabularies (CerniQ's `DataGap`, ComplyKit's `GapControl`, AEGIS's `ManifestVerifyFailure`), but the underlying discipline is identical.

This doc codifies the discipline so:

1. **New code paths** in any product satisfy the rules by default
2. **Converging existing paths** doesn't require re-discovering the same lessons
3. **Cross-product reviews** have a shared vocabulary for what "good" looks like

It deliberately **does not define shared TypeScript types**. The audit demonstrated that forcing a unified type shape across compliance/agent-verification/ALM/FX is a leaky abstraction — `DataGap` (missing inputs), `GapControl` (missing security control), and `ManifestVerifyFailure` (broken crypto chain) are three different problem domains that share surface vocabulary, not deep structure. Each product keeps its own domain shapes.

---

## How to use this doc

- **New code paths** in any KLYTICS product satisfy every rule that applies to the path's classification (see §4).
- **Existing code paths** are graded against the maturity matrix in §3. Gaps tracked per-product.
- **Cross-product reviews** cite rules from this doc; product `CLAUDE.md` files link here.
- **Conflicts**: this doc wins for cross-cutting governance; product files win for product-specific implementation.
- **Updates**: rules change only via PR that updates the maturity matrix and all four product CLAUDE.md references in the same commit.

---

## §1. The Discipline — 12 Rules

### Rule 1 — No silent zeros

**Normative:** When a calculation has missing or invalid inputs, return a typed marker. Never substitute `0`, `NaN`, an empty array, a hardcoded fallback, or `null` without a corresponding gap manifest entry.

**Why this matters:** A regulator reading a CerniQ report with `lcr: 0, status: 'breach'` concludes the cooperativa is in regulatory breach when the actual situation is "no liquidity data has been loaded yet." That misreading is a legal exposure CerniQ exists to eliminate. The same failure mode applies to ComplyKit compliance scores, AEGIS denial reasons, and Apex P&L reports — every regulator-bound output is a contract that says "this is what we observed," not "this is a default."

**Current state:**

| Product | Implementation | Path |
|---|---|---|
| CerniQ | `DataGap` type (`field` / `reason` / `severity` / `action`); 14 services migrated; smoking-gun `lcr: 0` killed | `backend-node/src/alm/reports/data-gap.ts` |
| ComplyKit | `GapAssessment` schema (critical_blockers + quick_wins + per-control status); dev-stub raises in prod | `packages/shared/src/artifacts.ts` |
| AEGIS | Typed denial reasons with stable precedence (`AGENT_NOT_FOUND` → `AGENT_REVOKED` → `INVALID_SIGNATURE` → ...) | `apps/api/CLAUDE.md` §6 |
| Apex | Math.random sweep done (Round 4, 18 files); no gap manifest type yet | **adoption gap** |

**Adoption checklist:**
1. Define the product-specific gap type (severity enum, reason codes, field path convention).
2. Every numeric field that can be missing becomes `T \| null`, never `T` with a `0` default.
3. Every status union grows a `data_unavailable` / equivalent variant.
4. Every `catch` becomes either a typed surface error OR a gap entry. Logging is not a substitute.
5. Add one keystone test: feed empty inputs, assert null + gap rather than zero.

---

### Rule 2 — Structured gap manifests on every regulator-bound artifact

**Normative:** PDFs, Excel exports, JSON binders, signed manifests, and any output bound for an external auditor/regulator must carry an explicit "what's missing" section. The presenter — not the producer — decides whether to block emission, watermark, or render with markers.

**Why this matters:** A board PDF that silently omits the LCR section when liquidity data is missing reads as "no liquidity concerns." A board PDF that renders the section with `—` and a one-line gap manifest reads as "liquidity data was not loaded for this period." The first is misleading; the second is accurate.

**Current state:**

| Product | Implementation | Path |
|---|---|---|
| CerniQ | Excel export has a "Data Gaps" sheet at index 0 (first thing reviewer sees); preview PDF watermarked at 35% opacity | `backend-node/src/alm/excel-export.service.ts:36-43`, `preview-report.service.ts:405-419` |
| ComplyKit | `GapAssessment` includes `critical_blockers[]` + `quick_wins[]` rendered in every framework PDF | `apps/api/app/agents/gap_assessor.py:154-172` |
| AEGIS | Verify-failure responses carry typed reason codes that propagate to dashboard | `apps/api/CLAUDE.md` |
| Apex | **adoption gap** |

**Adoption checklist:**
1. Every artifact-producing service accepts a `gaps[]` array and renders it in a fixed location.
2. `criticalCount > 0` either blocks artifact emission or stamps a watermark — the producer doesn't decide silently.
3. Frontend gap banners + per-cell markers (`—` with tooltip explaining the gap).

---

### Rule 3 — Immutable artifacts with SHA-256 + lineage

**Normative:** Any artifact that names "what was computed when" must be checksum-locked at write time. Re-computing the same inputs must produce byte-identical output. The lineage (model versions, dataset versions, prompt fingerprints, source code commit if applicable) is captured inline.

**Why this matters:** When an examiner asks "show me the LCR you reported on 2026-Q1 and prove it hasn't been edited," the answer is a checksum + reproducible inputs. When ComplyKit ships a policy PDF, the founder needs to prove the version submitted to the auditor is the version on file. When AEGIS verifies an agent, the audit log entry must be tamper-evident.

**Current state:**

| Product | Implementation | Path |
|---|---|---|
| CerniQ | `ReportArtifact` Prisma model with SHA-256, size, storage locator, model lineage snapshot, dataset versions, preflight gaps; 13 specs green | `backend-node/src/alm/reports/report-artifact.service.ts` |
| ComplyKit | `VaultArtifact` with file_url, checksum, version, file_format, size_bytes; `on_conflict_do_nothing` for immutability | `apps/api/app/agents/gap_assessor.py:140-144` |
| AEGIS | `SignedAuditCompressionManifest` with Ed25519 over canonical JSON, Parquet SHA-256, hash-chained predecessors | `packages/audit-verifier/src/manifest.ts` |
| Apex | **adoption gap** — paper-trade reconciliation outputs not checksum-locked |

**Adoption checklist:**
1. Pick an immutable storage model (Postgres + checksum column, or object store with content-addressed keys).
2. Every artifact write produces SHA-256 of canonical bytes (Rule 5) at write time.
3. Re-computation of the same inputs must produce the same checksum — if it doesn't, your producer is non-deterministic (timestamps, ordering, floating-point) and that bug ships before the artifact does.
4. Lineage fields are captured at write time, never derived from "current model registry state" at read time.

---

### Rule 4 — Append-only audit trail

**Normative:** No production path may UPDATE or DELETE rows in an audit/log table. New events append. The chain (hash-linked, sequence-numbered, or monotonic-timestamped) survives the lifetime of the data retention window.

**Why this matters:** Compliance frameworks (SOC 2 CC7.2, NCUA examiner-level review, COSSEC reporting) require evidence that operational events were not modified after the fact. The cheapest defense is "the schema doesn't permit it."

**Current state:**

| Product | Implementation | Path |
|---|---|---|
| AEGIS | `AuditEvent` hash-chained, Ed25519-signed, no UPDATE/DELETE permitted | `CLAUDE.md` invariant #3 |
| CerniQ | `audit_logs` Prisma table, append-only (Phase 3 D6); 7-year retention (`RETENTION_AUDIT_LOGS_DAYS=2555`) | `backend-node/prisma/schema.prisma:1400` |
| ComplyKit | `agent_runs` appends; `VaultArtifact` uses `on_conflict_do_nothing` (immutable on first write) | `apps/api/app/agents/_shared.py` |
| Apex | **adoption gap** — broker reconciliation logs append, but no chain integrity check |

**Adoption checklist:**
1. Audit tables have NO `updated_at`, NO `deleted_at` — those are signals the table isn't actually append-only.
2. Retention window matches your strictest claim (CerniQ matched security page's 7-year claim by raising `RETENTION_AUDIT_LOGS_DAYS` from 365 → 2555 — security claims must match implementation).
3. CI test asserts no production code path issues `UPDATE` or `DELETE` against the audit table (grep + AST check).

---

### Rule 5 — Canonical JSON for signing and hashing

**Normative:** Anything that gets signed or checksummed goes through a canonical-JSON serializer first (sorted keys, no whitespace, deterministic Unicode handling, no floating-point ambiguity). When two implementations of the same canonical-JSON exist (different languages, different packages), their byte output is parity-tested in CI.

**Why this matters:** `JSON.stringify(obj)` is non-deterministic across runtimes (key ordering, whitespace, Unicode escaping). Signing `JSON.stringify(x)` and re-verifying with `JSON.stringify(x)` in a different process / different Node version / different SDK silently fails. Canonical JSON is the only way SHA-256(obj) === SHA-256(obj') for semantically-equal objects.

**Current state:**

| Product | Implementation | Path |
|---|---|---|
| AEGIS | `canonicalize()` in `@aegis/audit-verifier`; cross-package parity test against `apps/api/src/modules/audit/compression/manifest.canonical.ts` | `packages/audit-verifier/src/canonical.ts` + `tests/cross-package/audit-manifest-parity.spec.ts` |
| CerniQ | `ReportArtifactService.record()` checksums raw `Buffer` bytes (byte-deterministic by construction); golden spec normalizes via `JSON.parse(JSON.stringify(...))` then asserts with `toEqual` (structural deep-equality, robust to write-side serializer drift) | `backend-node/src/alm/reports/report-artifact.service.ts:59`, `backend-node/src/alm/golden-reconciliation.spec.ts:121-153` |
| ComplyKit | Uses Pydantic for serialization stability; SHA-256 over PDF bytes (PDF is byte-canonical, lower risk) | `apps/api/app/services/storage.py` |
| Apex | **adoption gap** |

**Adoption checklist:**
1. Pick one canonical-JSON spec (JCS RFC 8785, or AEGIS's `canonicalize()` flavor).
2. Implement it as a tiny utility in the product (~80 LOC); don't take a dependency for this.
3. If your product has both a TS and a Python implementation, add a cross-package parity test that asserts both produce the same bytes for a shared corpus.

---

### Rule 6 — Tenant isolation at every layer

**Normative:** Every query carries the tenant boundary (`orgId` / `workspaceId` / `principalId`). The application layer filters explicitly, the database layer enforces via Row-Level Security. Both layers are required; neither is sufficient alone.

**Why this matters:** App-only isolation fails on developer-mistake (forgotten WHERE clause) or SQL injection. DB-only RLS fails on connection-pool mis-configuration (forgetting to `SET app.current_org = ...`). Defense-in-depth means both checks are present and both fail closed.

**Current state:**

| Product | Implementation | Path |
|---|---|---|
| ComplyKit | App-layer `org_id` filter on every query + Supabase RLS; `test_schema_drift.py` enforces RLS presence in CI | `apps/api/CLAUDE.md` rule #1 |
| CerniQ | `workspaceId` on every Prisma query + `InstitutionScopeGuard` at controller level; 106-route IDOR closure 2026-05-12 | `backend-node/src/auth/institution-scope.guard.ts` |
| AEGIS | `principalId` boundary all the way to Prisma + cache keys + queues + webhooks | `CLAUDE.md` invariant #5 |
| Apex | App-layer `userId` filter; RLS posture unclear post-cold-storage | **partial adoption** |

**Adoption checklist:**
1. Schema has a tenant column on every multi-tenant table.
2. RLS policies enabled for every tenant table; schema-drift test asserts presence.
3. Controller-level guard verifies the authenticated user has access to the tenant before service-layer code runs.
4. IDOR test suite — for every route accepting `:tenantId`, prove that a foreign-tenant user receives `403` / `404` (anti-enumeration), not `200`.

---

### Rule 7 — Lineage in regulator-bound outputs

**Normative:** Any output that goes to an auditor/regulator must carry: model versions used, dataset versions, prompt fingerprints (for LLM-generated artifacts), and the snapshot timestamp of computation. Computation reads from a pinned snapshot — never "now."

**Why this matters:** "We computed this LCR using model `cossec-v2.3.1` against the balance sheet snapshot of 2026-03-31 at 23:59 UTC" is reproducible. "We computed this LCR" is not. When the model is later deprecated, the artifact still verifies because the lineage is captured inline.

**Current state:**

| Product | Implementation | Path |
|---|---|---|
| CerniQ | `ReportPreflightService.check()` returns `modelLineage: ModelLineageEntry[]`; `getALMSummary` reads in pinned `RepeatableRead` transaction; 44 models in registry with approval lineage | `backend-node/src/alm/reports/report-preflight.service.ts` + `backend-node/src/model-registry/` |
| ComplyKit | Every `agent_runs` row carries `cost_cents_total` + `prompt_version` (12-char SHA); 10/10 agents migrated | `apps/api/app/agents/_shared.py` |
| AEGIS | `signingKeyId` committed to signed manifest bytes; `payloadVersionMin/Max` recorded per manifest | `packages/audit-verifier/src/manifest.ts:67-92` |
| Apex | **adoption gap** |

**Adoption checklist:**
1. Reads for regulator-bound outputs happen inside a snapshot transaction (`RepeatableRead` in Postgres) — not `READ COMMITTED`.
2. For LLM-using paths, every result row stamps `prompt_version` (SHA of the system prompt + model id + temperature).
3. For computation-using paths, every result row stamps `model_version` + `dataset_version`.
4. Lineage is denormalized into the artifact at write time — never resolved from "current registry state" at read time.

---

### Rule 8 — Golden tests with drift detection (manual update IS the gate)

**Normative:** Critical outputs have golden fixtures checked into git. Drift fails CI. Manual regeneration requires explicit env var (`UPDATE_GOLDEN=1` or equivalent). Auto-update on assertion failure is forbidden.

**Why this matters:** The whole point of a golden test is "this output has been reviewed and signed off." Auto-regenerating the golden on assertion failure destroys that signal. The manual `UPDATE_GOLDEN=1` step IS the gate — it forces the engineer to look at the diff in their PR and the reviewer to look at the diff in code review.

**Current state:**

| Product | Implementation | Path |
|---|---|---|
| CerniQ | `test/golden/pr-cooperativa-demo.{cossec,lcr,duration-gap,nii-sensitivity}.json`; `UPDATE_GOLDEN=1` gate; mutation-tested (mutated the golden, spec failed loudly, restored, spec passed) | `backend-node/src/alm/golden-reconciliation.spec.ts` |
| AEGIS | Cross-package parity tests via `pnpm test:parity`; OpenAPI/Zod/Prisma parity gated | `tests/cross-package/audit-manifest-parity.spec.ts` |
| ComplyKit | `test_schema_drift.py`, `test_agent_registry_parity.py` enforce schema + agent registry stability | `apps/api/tests/test_schema_drift.py` |
| Apex | **adoption gap** |

**Adoption checklist:**
1. Identify the "if this changes, a regulator/customer would notice" outputs. Those need golden fixtures.
2. Spec reads `process.env.UPDATE_GOLDEN === '1'` (or equivalent) to regenerate.
3. CI never sets that env var. Local regeneration is explicit.
4. Mutation-test the spec at least once: change a golden value, prove CI fails. Then restore.

---

### Rule 9 — Cost and prompt provenance on every LLM call

**Normative:** For any product path that calls an LLM, every result row carries `cost_cents_total` (stringified `Decimal` — never float) and `prompt_version` (SHA fingerprint of system prompt + model id + temperature). Aggregated to per-batch / per-tenant ledger.

**Why this matters:** LLM cost is a P&L line item, and a leaking prompt version is the difference between "the model is bad" and "we shipped a regression in the prompt." Without per-row provenance, you can't grep for "which batch used the broken prompt" or "which tenant generated the cost spike."

**Current state:**

| Product | Implementation | Path |
|---|---|---|
| ComplyKit | 10/10 agents migrated; `audit_batch_cost()` aggregates + emits `cost.budget_exceeded` structured log when total > 150% of `VAULT_COST_TARGET_CENTS` | `apps/api/app/agents/_shared.py::audit_batch_cost` |
| CerniQ | **Analyst panel path fully covered** (2026-05-15): `prompt_version` + four-class `usage` (input/output/cache-create/cache-read) + `cost_cents_total` (stringified Decimal, integer-centi-cent math) + `pricing_version` stamp on `done` events and persisted via `saveInsight()` metadata. **Discipline-grade fallback**: unknown model → `costCents: null + reason: NO_PRICING_DATA`, never silent-zero (Rule 1 compounded). `ai-advisor.service.ts` LLM path still bare — separate from analyst panel | `backend-node/src/alm/analyst/{prompt-version,llm-usage}.ts`, `backend-node/src/alm/alm-analyst.service.ts:425-509` |
| AEGIS | No LLM-using audit-relevant paths currently | N/A |
| Apex | **adoption gap** — Claude agents in Lane A don't stamp prompt fingerprint | TBD |

**Adoption checklist:**
1. LLM client returns `(text, CostBreakdown)` not just `text`.
2. Caller writes `cost_cents_total` (stringified Decimal) + `prompt_version` (12-char SHA) to the result row.
3. Per-batch ledger aggregates; alerts fire when total exceeds budget threshold.
4. Ops dashboard exposes `cost-rollup?days=7` and `prompt-versions` endpoints.

---

### Rule 10 — Migrations append-only after merge

**Normative:** Forward-only migrations. Never edit a migration that has been merged. Generate a new one to undo or amend.

**Why this matters:** Once a migration has run in any environment (CI, staging, prod, or even a teammate's local), editing it desynchronizes Prisma's migration ledger and is a recipe for "migration X is dirty" errors that block deploys. New migrations are cheap; editing applied migrations is expensive.

**Current state:** All four products comply implicitly. CerniQ documents this in `SESSION_HANDOFF.md` §4 ("Migrations are forward-only. Never edit a migration that's been applied. Generate a new one."). AEGIS encodes it as invariant in `CLAUDE.md` ("Migrations are append-only after merge.").

**Adoption checklist:** Pre-commit hook or CI check that diffs `prisma/migrations/` against the merge base and rejects modifications to pre-existing migration directories.

---

### Rule 11 — No `any` without a `// type-rationale:` comment

**Normative:** TypeScript `any` is forbidden in production code unless preceded by a `// type-rationale: <reason>` comment explaining why a precise type isn't feasible. ESLint rule enforces.

**Why this matters:** `any` is a hole in the type system. Holes are fine when justified ("third-party library with no types"), unacceptable when accidental ("I'll type this later"). The comment requirement forces the engineer to admit the hole and the reviewer to evaluate it.

**Current state:**

| Product | Implementation |
|---|---|
| AEGIS | Encoded in `CLAUDE.md` quality bar; enforced via eslint-config |
| CerniQ | Not currently enforced |
| ComplyKit | Uses Python (mypy strict on 115 files clean); not directly applicable |
| Apex | Not currently enforced |

**Adoption checklist:**
1. Add `@typescript-eslint/no-explicit-any: error` with override for comments matching `// type-rationale:`.
2. Sweep existing `any`s; either type them or add rationale comments.
3. CI fails on new `any` without rationale.

---

### Rule 12 — Cryptographic randomness only in security paths

**Normative:** `Math.random()` is forbidden in production security, identity, billing, policy, audit, and trading-decision paths. Use `crypto.randomBytes()` / `crypto.getRandomValues()` for any randomness that an adversary should not be able to predict.

**Why this matters:** `Math.random()` is fast but predictable. A predictable session token, audit nonce, billing idempotency key, or trading entropy is a vulnerability. The cost of `crypto.randomBytes(16)` is microseconds; the cost of a predictable nonce is a breach.

**Current state:**

| Product | Implementation |
|---|---|
| AEGIS | Encoded in `CLAUDE.md` quality bar; sweep enforced |
| Apex | Round 4 swept 18 files for `Math.random` fabrication (L-17a-d) | `apex_session_20260409_pm_round4.md` |
| CerniQ | Sweep done; spot-checks in security path | |
| ComplyKit | Uses Python `secrets` module; spot-checks done | |

**Adoption checklist:**
1. Grep for `Math.random` in security/billing/identity/audit paths.
2. Replace with `crypto.randomUUID()` / `crypto.getRandomValues()` / Python `secrets`.
3. ESLint rule `no-restricted-syntax` blocks new occurrences in tagged paths.

---

## §2. The Disciplines That Are NOT in This Doc

These are common audit-shaped concerns that DON'T belong in cross-product canon because their implementation is too domain-specific:

- **What constitutes a "gap" semantically** — `DataGap` (CerniQ) is missing inputs; `GapControl` (ComplyKit) is missing security control; `ManifestVerifyFailure` (AEGIS) is broken crypto chain. The shape of the type is product-specific.
- **What constitutes a "model" in a registry** — CerniQ has quant models (44 entries, 12 categories); ComplyKit has agent prompts (10 agents); AEGIS has MCP tools + signing keys. Lifecycle FSMs differ.
- **What constitutes a "regulator-bound artifact"** — varies by product domain. The rules above describe the *properties* such artifacts must have; the products define which artifacts qualify.

These are not gaps in this doc; they are deliberate exclusions.

---

## §3. Maturity Matrix (as of 2026-05-15)

Status legend: ✅ implemented · 🟡 partial · ❌ adoption gap · — not applicable

| Rule | ComplyKit | AEGIS | CerniQ | Apex |
|---|---|---|---|---|
| 1. No silent zeros | ✅ | ✅ | ✅ | ❌ |
| 2. Gap manifests on artifacts | ✅ | ✅ | ✅ | ❌ |
| 3. Immutable artifacts + SHA-256 + lineage | ✅ | ✅ | ✅ | ❌ |
| 4. Append-only audit trail | ✅ | ✅ | ✅ | 🟡 |
| 5. Canonical JSON for signing | 🟡 | ✅ | ✅ | ❌ |
| 6. Tenant isolation (app + DB) | ✅ | ✅ | ✅ | 🟡 |
| 7. Lineage in regulator-bound outputs | ✅ | ✅ | ✅ | ❌ |
| 8. Golden tests with drift detection | ✅ | ✅ | ✅ | ❌ |
| 9. Cost + prompt provenance | ✅ | — | 🟡 | ❌ |
| 10. Append-only migrations | ✅ | ✅ | ✅ | ✅ |
| 11. No `any` without rationale | — | ✅ | 🟡 | 🟡 |
| 12. Crypto randomness in security paths | ✅ | ✅ | ✅ | ✅ |

Score (count of ✅ + 0.5×🟡, treating — as full credit):

- **AEGIS**: 11/11 (the discipline reference implementation)
- **ComplyKit**: 10.5/11
- **CerniQ**: 10/11
- **Apex**: 3.5/11 (largest adoption gap; expected — earliest-stage product)

---

## §4. Path Classification

Not every code path needs every rule. Classification:

**Class A — Regulator-bound output paths.** Every rule applies. Examples: CerniQ COSSEC/NCUA report generation, ComplyKit gap assessment PDF, AEGIS audit-event signing.

**Class B — Tenant-data paths.** Rules 1, 4, 6, 7, 8, 10, 11, 12 apply. Rules 2, 3, 5, 9 conditional. Examples: CerniQ balance-sheet upload, ComplyKit org settings, AEGIS agent registration.

**Class C — Internal observability / ops paths.** Rules 4, 6, 10, 11, 12 apply. Examples: cost dashboards, internal admin pages.

**Class D — Marketing / public-facing static paths.** Rules 11, 12 apply. Examples: pricing pages, landing pages.

When in doubt, choose the higher class. The cost of an over-applied rule is engineering time; the cost of an under-applied rule on a regulator-bound output is a compliance finding.

---

## §5. Adoption Pattern for New Products

For a new KLYTICS product joining the platform, land rules in this order:

1. **Rule 6** (tenant isolation) — pre-requisite for everything else; retrofit is painful.
2. **Rule 10** (append-only migrations) — habit-forming, costless to start.
3. **Rule 12** (crypto randomness) — sweep at the beginning, cheap.
4. **Rule 11** (`any` discipline) — ESLint rule + initial sweep.
5. **Rule 1** (no silent zeros) — establishes the gap-type vocabulary.
6. **Rule 4** (append-only audit) — schema decision; choose before scaling.
7. **Rule 5** (canonical JSON) — pre-requisite for Rule 3.
8. **Rule 3** (immutable artifacts) — once you have something worth checksumming.
9. **Rule 7** (lineage) — once you have a model registry / prompt fingerprints.
10. **Rule 2** (gap manifests on artifacts) — once Rule 1 + Rule 3 are in place.
11. **Rule 8** (golden tests) — once outputs are stable enough to freeze.
12. **Rule 9** (cost + prompt provenance) — only when LLM cost is a P&L line item.

---

## §6. Migration Paths for Existing Products

### Apex (largest gap, expected — cold-stored, pre-resurrection)

If/when Apex thaws, land rules in adoption-pattern order (§5), starting from Rule 1 (no silent zeros — needed for the matte-black-star UI's `—` markers to actually mean what they say). Estimated effort: 2-3 weeks for full discipline adoption.

### CerniQ

Remaining gaps:
- **Rule 9** (cost half) — `cost_cents_total` derivation from `response.usage` not yet stamped. `prompt_version` half landed 2026-05-15. ~half day for the cost half.
- **Rule 11** — sweep `any` and add rationale comments. ~1 day.

Initial assessment claimed a Rule 5 gap; inspection showed `ReportArtifactService` already checksums raw `Buffer` bytes and golden specs assert structurally via `toEqual` rather than byte-comparing serialized JSON. Rule 5 is GREEN for CerniQ as of 2026-05-15.

Rule 9 prompt-half landed 2026-05-15: `computePromptVersion()` helper at `backend-node/src/alm/analyst/prompt-version.ts` (9 specs green); wired into `AlmAnalystService` streaming `done` event + `saveInsight()` metadata. Cost half remains.

### ComplyKit

Remaining gap:
- **Rule 5** — currently relies on Pydantic + PDF-byte stability. Add explicit canonical JSON for any JSON-bound checksum surface. ~half day.

### AEGIS

No adoption gaps. AEGIS is the reference implementation for cross-product discipline.

---

## §7. Relationship to Other Docs

- **Product CLAUDE.md files**: own product-specific implementation; link to this doc for cross-cutting rules.
- **`cerniq/docs/platform/STRATEGIC_SCOPE.md`**: governs product scope (Fork A vs Fork B). Orthogonal to this doc.
- **`AEGIS/docs/SECURITY.md`**: deepest implementation reference for Rules 3, 4, 5, 6. Cite when implementing in other products.
- **`AEGIS/docs/spec/03_TECHNICAL_SPEC.md`**: the canonical reference for signed-artifact + tenant-isolation patterns.

When in conflict, this doc wins for **cross-cutting governance** rules. Product CLAUDE.md files win for **product-specific implementation**.

### Mirror pointers in the other three products

This file is the canonical source. To improve in-repo discoverability without duplicating content, a thin pointer file lives in each of the other three products' `docs/` trees:

- `AEGIS/docs/KLYTICS_AUDIT_DISCIPLINE.md` (~65 lines) — frames AEGIS as 11/11 reference implementation, cites the canonical AEGIS-side impls of Rules 3/4/5/6/7/11/12.
- `ComplianceKit/docs/KLYTICS_AUDIT_DISCIPLINE.md` (~70 lines) — frames ComplianceKit as the Rule-9 reference impl, calls out the Rule-5 follow-up.
- `apex/docs/KLYTICS_AUDIT_DISCIPLINE.md` (~80 lines) — frames Apex as 3.5/11 cold-stored, embeds the §5 resurrection adoption order.

Each mirror references this canon by repo + path + as-of commit SHA. The SHA will rot on main-branch rebase/squash; mirrors warn future readers to re-resolve via `git log --diff-filter=A` if the reference goes stale. Mirrors are pointer-only — they do NOT define normative text and they MUST stay in sync with the canon:

1. Substantive rule changes (normative text, severity grades, new rules) edit the canon, then bump the as-of SHA in all three mirrors as part of the same PR.
2. Maturity matrix corrections in canon §3 do NOT require mirror bumps unless they change the product's score; the mirrors quote their own product's score and adoption gaps, so a score change in canon §3 requires the affected mirror to update.
3. New mirrors (a fifth product joining the platform) require a §7 entry here too.

---

## §8. Change log

| Date | Change | Rationale |
|---|---|---|
| 2026-05-15 | Initial canon | Audit revealed 4 products had independently invented same disciplines with different vocabularies. Codified to prevent re-discovery and to give new products a starting checklist. Replaced abandoned `@klytics/audit-primitives` package plan (the audit demonstrated the type unification would be a leaky abstraction). |
