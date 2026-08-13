# ADR: Member 360 — the first Layer 3 product surface, built decoupled from the ingestion gate

> **Status:** Accepted, shipped (fixture-first slice).
> **Companion docs:** [CERNIQ_LAYER2_3_ROADMAP.md](../CERNIQ_LAYER2_3_ROADMAP.md) §4 (W3.0/W3.1 —
> the wave this ADR belongs to), [SESSION_HANDOFF.md](../SESSION_HANDOFF.md) §5 (landing entries,
> commits `8f02188d` backend / `46dff75c` frontend), [CLAUDE.md](../../CLAUDE.md) (D1, KLYTICS,
> D24 — the contracts this build inherits and does not renegotiate).
> **Author's framing:** this is a real ADR (a decision + its rationale + its consequences), not a
> feature announcement. Section 6 states plainly what is *not* built yet.

---

## 1. Context

The founder's ask: make CerniQ "the operational hub for all cooperativas in Puerto Rico," starting
with a fully-fledged **Customer 360 / product lifecycle** view of a coop's own members (socios), in
time for sales demos and asset creation. Three constraints were set before any code:

1. **Stabilize first, then build.** Member 360 does not ship until the in-flight stabilization work
   is verified and closed (Task #1–#2 of this build; see SESSION_HANDOFF for the closure entries).
2. **Fixture/synthetic data first, not real core-system ingestion.** This is the load-bearing
   decision this ADR exists to record — see §2.
3. **No fixed deadline; get it solid, not fast.** Optimize for correctness and disclosure over
   shipping speed.

Per the Layer 2/3 roadmap (§4), member-level Layer 3 was previously gated behind a **discovery
question**: *"do PR cooperativa core systems (Fiserv DNA, Sharetec, legacy) actually export
member-level tapes, and will boards share socio-level data?"* That discovery item (roadmap §6 item
3) is still open — nobody has confirmed a Sharetec Velocity export spec or gotten a DNA coop to
agree to share a real member tape. Waiting on it would have blocked the entire product surface,
including the parts that don't need a real answer yet: the schema shape, the lifecycle
classification logic, the UI, and a demo-ready dataset for sales.

## 2. Decision

**Build the Member 360 product surface now, on disclosed synthetic fixtures, fully decoupled from
the member-tape ingestion discovery gate.** Real-core ingestion (a `MemberIngestionService` parallel
to `csv-ingestion.service.ts`, mapping an actual DNA/Sharetec/legacy export into the same `Member` /
`MemberAccount` tables) is an explicitly separate, future piece of work — see §6.

This is possible because of a schema design choice: `Member.source` is a required field, defaulted
to `"fixture"`. The distinction between demo data and a real ingested tape is a **column, not a
separate code path** — the lifecycle classifier, the risk scorer, the API routes, and the UI are
all written once and are ingestion-source-agnostic. When real ingestion ships, it writes rows with
`source: "ingested"` into the exact same tables; nothing above the ingestion boundary changes.

This lets the sales/demo motion (the founder's actual near-term goal) proceed in parallel with —
not blocked by — the unresolved core-system discovery question, while leaving an honest, visible
seam (`source`) so a demo institution's data is never confusable with a real book.

### Why not wait for the discovery answer

- The discovery question is a relationship/business-development task (getting a COSSEC or core-
  vendor contact), not an engineering one — it has no defined timeline, matching the roadmap's
  characterization of the AITSA track (§5) as "blocked on a relationship."
- The riskiest, highest-uncertainty part of Layer 3 was never "can we render a member profile" — it
  was always "will the classification logic hold up against real, messy core-system data." Fixtures
  can't answer that. But they *can* validate the schema, the lifecycle state machine, the RLS
  posture, and the UI against a large, varied synthetic population before a single real member
  record ever touches the system — which is strictly safer than developing all four against a real
  tape for the first time.
- The founder's immediate need (demoable, sellable Customer 360) is satisfied by a well-disclosed
  synthetic population, provided it is never presented as real institutional data. The `source`
  field plus the directory page's explicit "Seed 50 demo members" action (an opt-in, visible
  button — never an automatic seed) keep that boundary honest.

## 3. What was built

### 3.1 Schema (`backend-node/prisma/schema.prisma`, migration `20260812200000_add_member_360`)

Three new tables, RLS-protected with the codebase's standard two-policy pattern
(`tenant_isolation_<table>` + `admin_bypass_<table>`; see `CLAUDE.md`):

- **`members`** — `id`, `institutionId`, `memberNumber` (core-system socio number; `@@unique([institutionId, memberNumber])`, the natural re-ingestion key — mirrors `LoanRecord.externalLoanId`'s convention), `fullName`, `taxIdEncrypted` (nullable, AES-256-GCM via `DataCryptoService` when configured), `memberSince`, `lifecycleStage` (`MemberLifecycleStage`, default `ONBOARDING`), `riskScore` (nullable Int, D1: null until actually scored, never a phantom 0), `ceclStage` (nullable Int), **`source`** (`String`, default `"fixture"` — the ingestion-provenance column described in §2).
- **`member_accounts`** — `id`, `memberId`, `institutionId`, `productType` (free text, same convention as `LoanSegment.segmentName`; rolls up into the canonical product taxonomy in `cooperativa/product-registry.ts` rather than duplicating it as a second enum), `category` (`MemberAccountCategory`: `SHARE` / `DEPOSIT` / `LOAN`), `balance` (`Decimal(18,2)`), `interestRate` (nullable `Decimal(8,6)`), `delinquencyDays` (nullable Int — **never defaulted to 0**, because 0 is itself a valid "current" value and collapsing null into 0 would erase that distinction), `maturityDate`, `openedDate`, `cossecClassification` (nullable String: pass/special_mention/substandard/doubtful/loss — never defaulted to "pass," the same silent-pass hazard the roadmap flagged for the geography concentration limit in §7 of the roadmap doc).
- **`member_lifecycle_events`** — append-only audit trail (KLYTICS Rule 4: no `updatedAt`, no update/delete path anywhere in the service layer — a correction is a new event, never an edit of history). `eventType`, `severity` (`MemberEventSeverity`: INFO/WARNING/CRITICAL), `metadata` (Json, scoped to what the event concerns — never a dump of member financial totals). RLS here is INSERT+SELECT only (`tenant_insert_member_lifecycle_events` + `tenant_isolation_member_lifecycle_events` + `admin_bypass_member_lifecycle_events`), matching the append-only-table RLS variant used elsewhere in this schema.

### 3.2 Backend module (`backend-node/src/alm/member360/`)

Three services, wired into `AlmModule` as a **separate controller** (`Member360Controller`,
`@Controller('api/alm')`) rather than new methods on `AlmController` — deliberately avoiding the
"AlmController slot-map trap" (positional-arg spec brittleness) documented in the Terminal
Operations Handbook.

- **`MemberLifecycleService`** — disclosed, rule-based classification, not an LLM call. `classifyStage()` returns a `LifecycleStage` (ONBOARDING → ACTIVE → AT_RISK → DELINQUENT → WORKOUT → CHURNED, using named DPD thresholds: `DPD_AT_RISK=1`, `DPD_DELINQUENT=30`, `DPD_WORKOUT=90`) plus a `reasons: string[]` — a stage is never an unexplained label. **`CHARGED_OFF` is deliberately never assigned by the classifier** — it is a back-office decision with accounting consequences, reachable only through a future explicit admin action, not an inference from delinquency days. `assessRisk()` computes a disclosed 0-100 composite (named weights: delinquency penalty capped at 60pts by 100 DPD, leverage penalty capped at 25pts, tenure/diversity credits) plus a `loanToDepositRatio` that **substitutes for a true DTI ratio** because the schema has no income field — this substitution is itself disclosed in the code comment and in this ADR, not silently presented as DTI. Every numeric branch that touches a Prisma `Decimal` field is `Number()`-coerced at the arithmetic site per `verify:decimal-coercion`. `computeNextBestActions()` derives a small, explainable action list (CD-maturity renewal, refinance-eligibility, pre-approved-credit-line, delinquency outreach) from account signals — again rule-based and disclosed, no model call.
- **`MemberFixtureService`** — generates a deterministic synthetic member population from a seeded PRNG (mulberry32). "Deterministic" is load-bearing: two `generateMembers()` calls on the same day produce byte-identical output, which required truncating the time anchor used for relative-date math (memberSince, openedDate) to the UTC day boundary rather than raw `Date.now()` — millisecond-resolution anchoring produced different output between calls a millisecond apart even with the anchor frozen once per call. Exposed via `POST /api/alm/:institutionId/members/seed-demo`, which the directory page's frontend only calls from an explicit, visible "Seed 50 demo members" button — never automatically.
- **`Member360Service`** — the read path. `listMembers()` → `GET /api/alm/:institutionId/members` (paginated directory). `getMemberProfile()` → `GET /api/alm/:institutionId/members/:memberId` (full profile: financial overview, regulatory health, accounts, lifecycle timeline, next-best-actions, `gaps[]`). Both routes assemble their `DataGap[]` from the same `dataGap()` helper used across `src/alm/reports/`, so a missing risk score or an all-loan-no-deposit relationship surfaces as a structured gap with `field`/`reason`/`severity`/`action`/`context` — never a silent zero.

### 3.3 Frontend (`frontend/app/alm/member-360/`)

- **Directory page** (`page.tsx`) — registry-driven (`ALM_MODULES` entry, `endpoint: '/api/alm/{id}/members'`), `MetricStrip` + `DataTable` of the institution's socios with lifecycle-stage badges, pagination, and the seed-demo empty-state action described above.
- **Profile page** (`[memberId]/page.tsx`) — the **first dynamic-route ALM detail page in the codebase** (every existing ALM page scopes to an institution only via the `?id=` query param on `ALMProvider`; this is the first per-entity drill-down). Stacked `<section>` cards, not tabs — there is no shared tab primitive in this codebase (confirmed by grep across `components/` before writing this), so this follows the same stacked-card convention as `admin/intelligence/[accountId]/page.tsx` and `admin/prospects/[id]/page.tsx`. Renders the KPI strip, a `DataGapBanner` via `useReportDataGaps` whenever `gaps.length > 0`, recommended actions, the accounts table, and the lifecycle timeline.
- Both pages are bilingual: UI chrome inline `{en, es}` (the dominant pattern for ALM domain content in this codebase) plus 18 new keys added to `lib/alm/labels.ts` for backend-field-derived labels, routed through `label()`/`labelUnit()` per the TS-name-leak guard in `verify-alm-registry.mjs`.

## 4. Alternatives considered

- **Wait for real ingestion before building anything member-level.** Rejected — this blocks the
  founder's near-term sales/demo need on an open-ended, relationship-gated discovery task with no
  defined timeline (see §2).
- **Add member data as new methods on the existing `AlmController`.** Rejected — this is the
  documented "slot-map trap": `AlmController`'s constructor-injected services are consumed
  positionally in `alm.controller.spec.ts`, so any new dependency shifts every downstream index.
  A separate `Member360Controller` avoids this entirely and costs nothing.
- **Represent fixture vs. real data as a separate table or a separate institution flag** instead of
  a per-row `source` column. Rejected — a separate table would require the lifecycle/risk/UI code to
  branch on data source, defeating the point (§2); a separate *institution*-level flag would force
  an institution to be all-fixture or all-real, which doesn't match how a sales demo actually
  evolves (a coop may want to see their own real book *and* a populated demo book side by side
  during a pilot). A row-level column is the minimal correct grain.
- **Give the risk composite a fabricated DTI using an assumed income proxy.** Rejected outright — D1
  forbids fabricating a number to fill a schema gap. `loanToDepositRatio` is named for what it
  actually measures and documented as a DTI substitute, not relabeled as DTI.

## 5. Consequences

- **Positive:** the founder's demo/sales need is unblocked today, independent of the ingestion
  discovery timeline. The schema, lifecycle logic, RLS posture, and UI are all validated against a
  large synthetic population (deterministic fixtures make this reproducible) before any real member
  data is at risk. When real ingestion lands, zero changes are needed above the ingestion boundary.
- **Negative / accepted risk:** the lifecycle classifier's thresholds (`DPD_AT_RISK=1`,
  `DPD_DELINQUENT=30`, `DPD_WORKOUT=90`) and the risk composite's weights are **PROVISIONAL**,
  calibrated against synthetic data, not a real book — same caveat the roadmap already carries for
  the PR macro overlay's PD multipliers pre-W1.2 calibration. They must be revisited once real
  member data exists.
- **Negative / accepted risk:** `taxIdEncrypted` and other PII-shaped fields exist in the schema now
  but are never populated by the fixture generator (fixture members carry no tax ID — itself the
  honest state, not a gap). The encryption plumbing (`DataCryptoService`, AES-256-GCM,
  graceful-plaintext-degradation) is wired but **has not been exercised end-to-end with real PII**,
  because there is none yet. This should be explicitly tested once real ingestion is designed, not
  assumed to work because the code path exists.
- **Deferred:** real member-tape ingestion (`MemberIngestionService`), per-core adapters (Fiserv
  DNA / Sharetec / generic CSV, matching W2.0's adapter ordering), and calibration of the lifecycle
  thresholds and risk weights against a real book. None of this is scheduled — it remains gated on
  the roadmap §6 item 3 discovery question, exactly as before. This ADR does not resolve that
  question; it routes around it for the product-surface work only.

## 6. What is explicitly NOT done (read before assuming this is production-ready for real books)

1. **No real core-system ingestion path exists.** Every `Member` row in the system today has
   `source: "fixture"` unless a future session builds the ingestion adapter described in §5/§6.
2. **Lifecycle thresholds and risk weights are uncalibrated** against real PR cooperativa member
   data — see §5.
3. **Frontend `vitest` and `next build` could not be run to completion in the sandbox this was
   built in**, due to what reproduces as a pre-existing, unrelated environment gap (missing native
   `@rolldown`/`@next/swc` ARM64-Linux bindings; see the frontend landing commit `46dff75c` for the
   exact repro). `eslint`, `tsc --noEmit`, and the full custom verifier chain (`verify-alm-registry`,
   `verify-d1-no-silent-fallback`, `verify-no-orphan-tests`, `verify-rule-12-crypto-randomness`,
   `verify-i18n-parity`) all pass clean. A session with a working `next build`/`vitest` toolchain
   should confirm both before this ships to production traffic.
4. **No `ModelRegistryEntry`** has been created for the lifecycle classifier or risk composite.
   Per the roadmap's §7 model-governance contract ("each new analytic registers a
   `ModelRegistryEntry`"), this is outstanding — tracked as follow-up, not silently skipped.
5. **The encryption path for `taxIdEncrypted` is unexercised** — see §5.

---

*Written 2026-08-12 alongside the Member 360 backend (`8f02188d`) and frontend (`46dff75c`)
landings. Update this ADR's status when real ingestion is designed — that is a new decision, not an
amendment to this one.*
