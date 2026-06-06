# CERNIQ Terminal Operations Handbook

> The definitive operating manual for engineers working in terminals on this
> repository — human or agent, one session or a fleet. If you read exactly one
> document before touching code, read this one; it links to everything else.
>
> **Companion documents:** [CLAUDE.md](../CLAUDE.md) (the operating contract,
> normative), [docs/SESSION_HANDOFF.md](SESSION_HANDOFF.md) (live phase
> status + landing log, read it at the start of EVERY session),
> [docs/CERNIQ_Vol6_TERMINAL_FLEET_OPS_BIBLE.md](CERNIQ_Vol6_TERMINAL_FLEET_OPS_BIBLE.md)
> (fleet-scale dispatch theory). This handbook is the practical synthesis:
> what to type, why it's safe, and what breaks when you don't.

---

## 0. How to use this handbook

| You are… | Start at |
|---|---|
| New to the repo, first session | §1 → §2 → §3, then skim §6 before any commit |
| Returning after time away | `docs/SESSION_HANDOFF.md` §1-5, then §8 here |
| About to commit | §6 (git protocol) + §8.3 (landing entry) |
| Debugging a failed gate | §4 (which gate) + §12 (known failure modes) |
| Working on the cooperativa compliance engine | §9 |
| Writing or fixing tests | §10 |
| Running multiple terminals / dispatching agents | §7 |

The repo's prime directive, worth internalizing before anything else:

> **Pre-existing landed work is the source of truth.** Read `git log` and
> SESSION_HANDOFF before assuming a feature is missing. Multiple sessions
> work this tree concurrently; the thing you're about to build may have
> landed an hour ago.

---

## 1. Platform context — what you are operating

CERNIQ is a bilingual (Spanish-first) ALM and compliance platform for
**Puerto Rico cooperativas** — COSSEC-regulated credit unions, ~120 on the
island, $0–$500M assets each. Production: [cerniq.io](https://cerniq.io),
API at `api.cerniq.io`.

The product is organized as **three layers**:

| Layer | What | Status |
|---|---|---|
| **1 — Compliance Engine** | CECL allowance (PR-calibrated), push-button COSSEC report PDF, ALM stress testing (±100/200/300bps, NEV, PR scenarios) | Landed (first wave 2026-06-06, `f7b498a`) |
| **2 — Credit Intelligence** | PR-calibrated PD models, concentration by municipio, early-warning watchlists | Roadmap |
| **3 — Member LTV** | Product penetration per socio, churn risk (desvinculación), profitability per member, balance migration | Roadmap — the long-term differentiator |

Two product-design contracts govern everything user-facing:

1. **D1 — never silent zeros.** When inputs are missing, computations return
   a `data_unavailable` shell plus a structured `gaps[]` manifest
   (`backend-node/src/alm/reports/data-gap.ts`). A report that renders `0`
   for missing data is a regulatory hazard: a COSSEC examiner reading
   `capitalRatio: 0` concludes insolvency, not "no data uploaded yet."
2. **Spanish-FIRST.** Not translated — designed in PR cooperativa Spanish
   (socio, junta, razón de capital, tasa de morosidad, Club de Navidad).
   English is the secondary variant. New user-facing surfaces default to
   `lang=es`.

---

## 2. Workspace topology

```
Desktop/Cerniq/                  ← this repo (klytics/cerniq-classic-archive lineage)
├── backend-node/                ← NestJS 11 API · Prisma 7 · ALM math · COSSEC reporting
│   ├── src/alm/                 ← the 49K-line ALM engine (see §9)
│   ├── prisma/                  ← AUTHORITATIVE schema + migrations (append-only)
│   └── scripts/verify-*.mjs     ← the invariant verifiers (see §4)
├── frontend/                    ← Next.js 16 · Tailwind 4 · vitest + playwright · dev port 3001
├── apple/                       ← Swift package + Xcode shell (see SESSION_HANDOFF §Apple)
├── services/                    ← Python: cossec-parser (exam PDF→JSON), outbound (sales agents)
├── docs/                        ← architecture, bibles, SESSION_HANDOFF, security audits
├── scripts/
│   ├── ci/                      ← commit/push gates (landing-entry, claim-conflicts, schema-drift…)
│   ├── session/                 ← cross-session register/claim/release/handoff
│   └── swarm/                   ← multi-terminal dispatch (boot/dispatch/gate/audit/fleet…)
├── migrations/                  ← DEAD pre-Prisma SQL. Do not touch; prisma/ is authoritative.
└── aegis/                       ← SIBLING repo (agent identity/verification platform, klytics/cerniq).
                                   Untracked here via .git/info/exclude. Different product. Do not
                                   stage anything under aegis/ from this repo.
```

Key facts that trip people up:

- **`Desktop/cerniq` ≡ `Desktop/Cerniq`** on case-insensitive APFS. Multiple
  sessions share one working tree and one `.git/index`. This is why §6 exists.
- **Two `migrations/` directories.** Root `migrations/` is legacy dead code;
  `backend-node/prisma/migrations/` is the only authoritative one, and it is
  **append-only** — never edit an applied migration.
- **`aegis/` is a different product** that happens to live inside this folder
  for workspace convenience. It has its own `.git`. Nothing in this handbook
  applies to it.
- Node version is pinned by `.nvmrc` → **Node 20**.

---

## 3. Terminal bootstrap

From zero to a verifiable working state:

```sh
# 1. Toolchain
nvm use                                  # respects .nvmrc → Node 20

# 2. Dependencies (each package is independent)
cd backend-node && npm ci && cd ..
cd frontend     && npm ci && cd ..

# 3. Prisma client (required before tsc/jest will pass)
cd backend-node && npm run prisma:generate && cd ..

# 4. Environment
cp .env.example .env                     # then fill: DATABASE_URL, REDIS_URL,
                                         # JWT_SECRET, SUPABASE_*, STRIPE_* …

# 5. Sanity: the status dashboards
npm run cerniq:status                    # phase status, gate summary
npm run cerniq:cross                     # worktree/lane/collision overview

# 6. Dev servers
cd backend-node && npm run start:dev     # NestJS, watches
cd frontend     && npm run dev           # Next.js on :3001
```

**Before any meaningful work** (CLAUDE.md normative):

```sh
claude-peers status        # who else is active, what paths they claim
npm run session:register   # announce your session
npm run session:claim      # claim your lane (advisory, warns on overlap)
```

`claude-peers` lives at `~/.claude/peers/bin/claude-peers` on the host
machine (not vendored in-repo). If it's absent, the session scripts under
`scripts/session/` provide the same register/claim/release/status surface
via `npm run session:*`.

---

## 4. The verification lattice

Every commit is gated by a chain of verifiers. Know the chain; run it before
you push, because CI runs exactly the same scripts.

### 4.1 Backend — `cd backend-node && npm run lint`

Runs, **in order** (a failure stops the chain):

```
eslint "{src,apps,libs,test}/**/*.ts"
→ verify:tenant-scope          scripts/verify-institution-scope-guard.mjs
→ verify:no-orphan-spec        scripts/verify-no-orphan-spec.mjs
→ verify:auth-coverage         scripts/verify-auth-coverage.mjs --strict
→ verify:body-trust            scripts/verify-body-trust.mjs --strict
→ verify:rule-4-audit-immutable
→ verify:rule-9-stamping
→ verify:rule-11-any-rationale
→ verify:rule-12-crypto-randomness
→ tsc --noEmit
```

Plus, for a full local verification: `npx prisma validate`, `npm run test`
(jest, coverage floor **86/70/81/86** statements/branches/functions/lines),
`npm run build` (nest build).

### 4.2 Frontend — `cd frontend && npm run lint`

```
eslint (NODE_OPTIONS=--max-old-space-size=8192)
→ verify-alm-registry          scripts/verify-alm-registry.mjs
→ verify-no-orphan-tests       scripts/verify-no-orphan-tests.mjs
→ verify-rule-12-crypto-randomness
→ tsc --noEmit
```

Plus `npm run test:coverage` (vitest, floor **60/52/55/62**), `npm run build`,
and optionally `npm run verify:bundle-budget` (ceiling **1.25 MB**
single-route / **154.5 MB** summed first-load).

### 4.3 Root orchestrations

```sh
npm run verify:backend          # backend lint + prisma validate + tests + cov + build + clean-tree
npm run verify:frontend         # frontend lint + tests + cov + build + clean-tree
npm run verify:local:critical   # both + critical e2e — the full pre-push chain
npm run smoke:production        # curls production URLs + production e2e
```

### 4.4 Pre-commit (husky) — staged-file checks only

1. Backend tsc incremental (warn-only)
2. Staged-file clean-worktree check
3. Backend prettier `--check` (BLOCKING — fix drift with `npx prettier --write <files>`)
4. **Landing gate** — `scripts/ci/check-landing-entry.mjs`: any commit touching
   `backend-node/{src,prisma}/` or `frontend/{app,components,lib,e2e}/` must
   also stage a **new same-day bullet** in SESSION_HANDOFF §5. Bypass only
   for genuinely non-landing commits: `SKIP_LANDING=1 git commit …`
5. Claim-conflict advisory — `scripts/ci/check-claim-conflicts.mjs`
6. Secret scan (BLOCKING; bypass `SKIP_SECRET_SCAN=1` only with a named reason)

### 4.5 The KLYTICS rules (4 / 9 / 11 / 12)

Normative text: `docs/platform/KLYTICS_AUDIT_DISCIPLINE.md`. Operational
summary:

| Rule | Enforces | Verifier behavior |
|---|---|---|
| **4** | `audit_log*` tables are append-only | Scans for UPDATE/DELETE paths against audit tables |
| **9** | LLM calls carry prompt-version + cost provenance stamps | Flags unstamped LLM invocations; `BASELINE_UNSTAMPED` chip-away list |
| **11** | Every `any` carries a `// type-rationale:` comment | Per-file baseline in `verify-rule-11-baseline.json` (212-file chip-away). **Regex trap:** the rationale must be on a standalone line — `/^\s*\/\/\s*type-rationale\s*:\s*\S+/` — placed immediately above the line containing the `as any`. Inline placement after a ternary `?` does NOT match. |
| **12** | Crypto-grade randomness (`randomBytes`, `getRandomValues`) in security paths | Security-scope by path segments (auth/login/billing/webhook/…); zero-baseline on frontend |

Every verifier supports `--self-test`. A gate change is not done until its
self-test passes (see §5).

### 4.6 D24 ratchet discipline

Every quality gate follows the same four moves:

1. **Measure** the current floor (or ceiling).
2. **Lock** the threshold at integer-below-current (floors) or
   integer-above-current (ceilings).
3. **Ratchet one direction only** — coverage floors only RAISE; bundle/latency
   ceilings only LOWER. Loosening requires an explicit decision + a
   SESSION_HANDOFF §5 entry naming the reason.
4. **Embed `--self-test`** in any new gate script so the rules themselves are
   CI-verified.

And the definition of done for any ratchet: self-test green, live invocation
green, wired into `npm run`, §5 landing entry with the commit SHA, and a
commit message that quotes the measured floor/ceiling so future ratcheting
has a baseline. Anything less is WIP.

---

## 5. What "done" means (all work, not just ratchets)

1. Tests green — including new specs for new behavior, written to the
   conventions in §10.
2. The relevant lint chain (§4.1/§4.2) passes locally.
3. SESSION_HANDOFF §5 carries a same-day landing entry naming the SHA.
4. The commit message explains **why**, not just what — constraints honored,
   alternatives rejected, confidence level, scope risks.
5. Nothing staged or committed from a peer's lane (§6, §7).

---

## 6. Shared-tree git protocol (CRITICAL)

Multiple sessions share this working tree and its `.git/index`. Three
observed failure modes, one canonical mitigation.

### 6.1 Failure modes

1. **`git add -A` / `git add .` / `git add :/`** — sweeps a peer's unstaged
   files into your commit. **Never use these. No exceptions.**
2. **`git add <file> && git commit -m`** — the commit picks up the entire
   index at commit time, including anything a peer staged between your `add`
   and your `commit`. Your commit message then misattributes their work.
3. **`git update-index --cacheinfo <blob>`** — partial mitigation only;
   protects against peer-disk-content sweeps but not peer-commits absorbing
   your staged blob.

### 6.2 The canonical pattern — explicit pathspec at commit time

```sh
# Tracked files (modified, not new):
git commit -m "..." -- frontend/app/foo.tsx frontend/lib/bar.ts

# Untracked-new + tracked together (commit -- pathspec rejects untracked):
git add path/to/new-file.ts path/to/modified.ts
git commit --only path/to/new-file.ts --only path/to/modified.ts -m "..."
```

`git commit --only <paths>` re-asserts the file set at commit time and
survives index churn from peer activity. **This is the canonical pattern.**

### 6.3 Rules

- Work branches: `claude/<topic>`. **Never commit directly to `main`.**
- Before commit: `claude-peers conflict-check` (or
  `node scripts/ci/check-claim-conflicts.mjs`).
- If a stage race slips through anyway: ship a docs-only follow-up commit
  naming the misattributed SHA (precedent: SESSION_HANDOFF 2026-05-16
  entries).
- Never raise a threshold without justification. Never disable a verifier.
  Never skip hooks without naming why in the commit message.

### 6.4 Identity

Commits need explicit identity in fresh environments:

```sh
git config user.name  "Your Name"
git config user.email "you@example.com"   # repo-local, not --global
```

---

## 7. Multi-terminal coordination

### 7.1 Session registry — `scripts/session/`

```sh
npm run session:register   # announce this session (writes to the session registry)
npm run session:claim      # claim a lane: paths you intend to touch
npm run session:release    # release your claim when done
npm run session:list       # all registered sessions
npm run session:status     # registry health
npm run session:handoff    # structured handoff for the next session
npm run test:session       # unit tests for the registry lib itself
```

### 7.2 Peers CLI — `~/.claude/peers/bin/claude-peers` (host machine)

```sh
claude-peers status                      # active claims: project + paths + age
claude-peers claim <name> --paths a,b   # register your lane (advisory)
claude-peers claim <name> --read-only   # observe without overlap warnings
claude-peers msg <sid> "..."            # peer-to-peer message
claude-peers inbox                       # unread messages
claude-peers conflict-check              # pre-commit overlap scan
claude-peers install-post-commit         # auto-record commits as peer-visible decisions
```

### 7.3 Swarm dispatch — `scripts/swarm/` (Vol.3/Vol.4 infrastructure)

For fleet-scale work across many terminals:

```sh
npm run swarm:boot        # bring up the swarm registry (registry.json)
npm run swarm:dispatch    # hand a work packet to a terminal
npm run swarm:gate        # gate a terminal's output before merge
npm run audit             # post-hoc audit of swarm output (scripts/swarm/audit.mjs)
npm run swarm:health      # liveness across the fleet
npm run swarm:escalate    # escalate a blocked packet
npm run swarm:fleet       # fleet overview
npm run swarm:metrics     # throughput/latency metrics
npm run swarm:doctor      # diagnose a sick swarm
npm run swarm:orient      # orientation packet for a fresh terminal
npm run swarm:handoff     # structured swarm-level handoff
npm run swarm:landing     # landing-entry helper
npm run swarm:cross       # cross-worktree collision view
npm run scope:check       # verify a packet stays in its claimed scope
npm run approval          # human approval queue (approval:auto for auto-approvals)
```

### 7.4 Spawn pattern (from CLAUDE.md, normative)

- **Research fans out**: when a task spans many read surfaces, spawn 3–5
  parallel read-only Explore agents with focused recon prompts and
  synthesize yourself.
- **Implementation stays serial**: code edits in a shared tree compound
  stage-race surface. One writer per lane.

### 7.5 Worktree hygiene

`npm run cerniq:cross` parses `git worktree list --porcelain`, classifies
each worktree into a lane (auth, billing, portal, alm, pipeline, ai, admin,
schema, frontend-pages, frontend-ui, e2e, docs, ops, ci), and **exits 1 on
path collisions** — the same file modified in two live worktrees. Run it when
you suspect parallel activity.

---

## 8. Session lifecycle

### 8.1 Pickup (start of EVERY session)

1. Read `docs/SESSION_HANDOFF.md` — §1-4 for phase status and live
   decisions, §5 for what landed recently.
2. `git log --oneline -15` — what actually shipped.
3. `claude-peers status` / `npm run session:list` — who else is active.
4. `npm run cerniq:status` — gate summary.

### 8.2 Work

- Branch `claude/<topic>`; claim your lane; serial implementation.
- New behavior ⇒ new specs (conventions in §10).
- Prettier early and often: `npx prettier --write <files>` — the pre-commit
  check is block-only.

### 8.3 Landing

A landing = code + spec + SESSION_HANDOFF §5 entry + explicit-pathspec
commit, in ONE commit (the landing gate checks the same commit). The §5
entry format, by convention:

```
- YYYY-MM-DD — **type(scope): one-line summary.** Narrative: what + why +
  constraints honored + what was rejected + verification evidence (suite
  counts, gate outputs) + not-tested disclosure + next steps. — `path/one.ts`,
  `path/two.ts` NEW, `path/three.spec.ts`
```

Then: `npm run session:release` and, if you're handing work mid-flight,
`npm run session:handoff`.

---

## 9. Layer 1 — the cooperativa compliance engine (deep dive)

The heart of the product. All paths relative to `backend-node/src/alm/`.

### 9.1 Product registry — `cooperativa/product-registry.ts`

The canonical taxonomy of the 8 cooperativa product types:

| `productType` | Spanish-first label | Side | CECL? |
|---|---|---|---|
| `PRESTAMO_PERSONAL` | Préstamos personales | asset | ✓ |
| `PRESTAMO_AUTO` | Préstamos de auto | asset | ✓ |
| `HIPOTECA` | Hipotecas | asset | ✓ |
| `PRESTAMO_COMERCIAL` | Préstamos comerciales (MBL) | asset | ✓ |
| `PRESTAMO_GARANTIA_ACCIONES` | Préstamos con garantía de acciones | asset | ✓ |
| `CLUB_NAVIDAD` | Club de Navidad | liability | ✗ |
| `CUENTA_AHORRO` | Cuentas de ahorro (acciones) | liability | ✗ |
| `CERTIFICADO_DEPOSITO` | Certificados de depósito | liability | ✗ |

Each asset product carries provisional PD/LGD cold-start defaults with
documented provenance (NCUA 5300 aggregates adjusted for post-María
delinquency cycles, sustained out-migration, PR foreclosure timelines).
**These are disclosed configuration, not data** — when the CECL engine uses
a default it emits a WARNING `DataGap` naming the product and the action
("cargue el historial de pérdidas…"). Final calibration is flagged
`OPERATOR-INPUT-NEEDED` in the file's provenance notes.

`matchProductType(segmentName)` maps free-form ES/EN segment names to the
taxonomy, **returning `null` rather than guessing** when no confident match
exists (D1 — callers surface a WARNING gap). Order of match patterns
matters: share-secured before generic savings, Club de Navidad before
generic deposits.

The PR macro overlay constants:

- `PR_PD_MULTIPLIERS` = 1.0 / **2.1** / **3.6** (baseline/adverse/severe) —
  deliberately harsher than mainland CCAR 1.0/1.8/3.0.
- `PR_SCENARIO_WEIGHTS` = **45/35/20** — vs FASB community default 50/30/20;
  shifts probability mass toward adverse because PR has spent more of the
  last two decades in contraction than the mainland.

### 9.2 CECL — `cecl.service.ts`

Three methodologies: WARM (PV-discounted, default), Vintage (loss-emergence
pattern), PD×LGD (scenario-weighted). The PD×LGD path accepts an optional
overlay `{ pdMultipliers, scenarioWeights, overlayLabel }`; **omitting it
preserves pre-existing behavior exactly** (mainland CCAR + FASB weights).

`getCooperativaCECLAnalysis(institutionId)` is the cooperativa-native
entrypoint: classify segments via the registry → drop liability-side
products from the allowance (but report their classification) → fill
missing PD/LGD/maturity from registry defaults (WARNING gap each) → run
PD×LGD with the PR overlay → return summary + `productClassification[]` +
concatenated gaps. Methodology string: `PD×LGD (PR)`.

Endpoints:

```
GET  /api/alm/:institutionId/cecl                  ?methodology=warm|vintage|pdlgd
GET  /api/alm/:institutionId/cecl/cooperativa      ← PR-native (Layer 1)
GET  /api/alm/:institutionId/cecl/forecast
POST /api/alm/:institutionId/cecl/segments
POST /api/alm/cecl/warm
GET  /api/alm/:institutionId/cecl/vintage
GET  /api/alm/:institutionId/cecl/cohorts
```

### 9.3 COSSEC report — `reports/cossec-report.service.ts`

The push-button regulatory PDF — the #1 sales artifact. One call:

```
GET /api/alm/:institutionId/cossec-report/pdf?lang=es   (es is the default)
```

audited via `@AuditAction('cossec_report_download')`. The render contract:

1. **Conclusion-first.** Page one leads with sentences a Presidente
   Ejecutivo reads without training: "Su razón de capital es 12.3% — sobre
   el mínimo de 8% que requiere COSSEC."
2. **Traffic lights everywhere.** Overall banner (CUMPLE green / CUMPLE CON
   OBSERVACIONES yellow / NO CUMPLE red / DATOS INSUFICIENTES gray) and a
   per-ratio semáforo band in the 12-ratio matrix.
3. **The 12-ratio matrix** is grouped: suficiencia de capital → calidad de
   la cartera → liquidez → sensibilidad a tasas → rendimiento. Ratio
   metadata comes from `frameworks/cossec-pr.framework.ts`; values from
   `alm-enterprise.service.ts::getCOSSECCompliance()`.
4. **D1 rendering.** `data_unavailable` ratios print `—` and the report ends
   with a "Datos pendientes" section enumerating every gap. The PDF always
   renders; it never fabricates.

The compliance engine itself (12 ratios, thresholds, exam-readiness score)
predates the PDF and lives in `alm-enterprise.service.ts` (~line 744).

### 9.4 Stress testing — `stress-testing/stress-testing.service.ts`

- **Monte Carlo**: Vasicek short-rate, antithetic variates, Kahan-summed
  NII; params clamped (≤50K paths, ≤120mo horizon). HJM multi-factor lives
  in `quant/hjm-monte-carlo.service.ts` with a worker thread.
- **Named scenarios** (`scenarios/cossec-scenarios.ts`): full parallel
  ladder ±100/200/300bps, steepening, and **three PR-specific scenarios** —
  `pr_hurricane_stress` (rates +150, deposits −5%, defaults +2%),
  `pr_migration_stress` (deposits −8%, defaults +1.5%; Census out-migration
  trend), `pr_tourism_stress` (rates −50, deposits −3%, defaults +2.5%
  commercial-concentrated).
- **NEV** — `getNEVAnalysis()`: formal Net Economic Value revaluation under
  ±100/200/300bps via duration+convexity, classified against NCUA NEV
  Supervisory Test bands (>7% low / 4–7 moderate / 2–4 high / <2 extreme),
  Spanish labels included, worst-case identified.

```
POST /api/alm/:institutionId/stress-test            (throttled 5/min — heavy compute)
GET  /api/alm/:institutionId/stress-test/nev
POST /api/alm/:institutionId/stress/custom
```

### 9.5 Cross-cutting machinery

- **Multi-tenancy:** Postgres RLS via
  `prisma/migrations/20260417020000_rls_tenant_isolation/` —
  `app.current_institution_id` session GUC set by
  `common/middleware/tenant-context.middleware.ts`; guards
  `AuthTenantGuard`, `TenantScopeGuard`, `InstitutionScopeGuard`.
- **Audit trail:** `AuditLog` (append-only, RLS-enforced) +
  `@AuditAction(...)` decorator + hash-chained `AgentAuditLog` for agent
  runs. Retention default 7 years.
- **Report artifacts:** `ReportArtifact` — SHA-256 checksum, model lineage,
  preflight gaps, storage locator. PDFs that matter get recorded.
- **Model governance:** `ModelRegistryEntry` — 44+ registered models with
  lifecycle (DRAFT→CANDIDATE→APPROVED→DEPRECATED/RETIRED) and validation
  artifacts.

---

## 10. Testing conventions

### 10.1 The constructor-injection idiom

ALM specs do **not** use NestJS `TestingModule`. They instantiate services
directly with mock objects:

```ts
const mockPrisma = { loanSegment: { findMany: jest.fn() } } as any;
const svc = new CECLService(mockPrisma);
```

Fast, deterministic, zero DI overhead. Follow it.

### 10.2 The AlmController positional slot map (TRAP)

`alm.controller.spec.ts` builds the controller with a positional args array
sized by `AlmController.length`. **If you add a constructor parameter to
`AlmController`, you MUST update the slot map in the spec** — every slot at
or after your insertion shifts. Precedents documented inline in the spec:
InstitutionSeedService (Phase 1), ReportPreflightService (Phase 2 batch 4),
CossecReportService at slot 2 (Layer 1, 2026-06-06, +1 shift downstream).
Symptom of forgetting: dozens of unrelated controller tests fail with
mock-routing errors.

### 10.3 Spec pairing

`verify:no-orphan-spec` enforces 8 pairing rules + a 15-entry baseline.
A new spec without a source pairing must either pair up or be justified in
`BASELINE_ORPHANS` with a reason. New source files should ship with specs —
the coverage floor (86% statements) makes unspecced code a chain-breaker.

### 10.4 Golden + agent tests

- `test/golden/` — golden reconciliation fixtures (e.g.
  `pr-cooperativa-demo.*.json`), checksummed into the model registry.
- `test/agent-golden/` — 12 agent families' golden outputs;
  `test/agent-evals/` — scoring harness. LLM goldens need deterministic
  replay scripts (T6, in flight).

### 10.5 Running tests fast

```sh
cd backend-node
npx jest src/alm/cecl.service.spec.ts          # one suite
npx jest src/alm --silent --maxWorkers=4       # whole ALM module (~116 suites)
npm run test:cov                               # full suite with coverage floors
```

---

## 11. API surface quick reference (ALM core)

All under `/api/alm`, JWT + tenant-guarded (`AuthTenantGuard` +
`InstitutionScopeGuard` at class level):

| Endpoint | Purpose |
|---|---|
| `GET  /:id/summary` (via `getALMSummary`) | Full ALM analysis with gap manifest |
| `GET  /:id/cossec-compliance` | 12-ratio JSON |
| `GET  /:id/cossec-report/pdf?lang=es\|en` | **Push-button COSSEC PDF** |
| `GET  /:id/cecl` / `GET /:id/cecl/cooperativa` | CECL (generic / PR-native) |
| `POST /:id/stress-test` | Monte Carlo + regulatory + COSSEC scenarios |
| `GET  /:id/stress-test/nev` | NEV supervisory table |
| `GET  /:id/export/excel` | Excel workbook (Data Gaps sheet at index 0) |
| `GET  /:id/report?lang=` | Full ALM PDF |
| `GET  /:id/board-report` | Board package data (PDF export via document-exports manifest) |
| `POST /:id/cecl/segments`, `POST /institutions/:id/upload-csv` | Data ingestion |

CSV ingestion (`csv-ingestion.service.ts`) accepts bilingual headers
(`prestamos_personales` → `consumer_loans`), validates 7 required columns,
caps 50K rows, and runs dry-run validation before import. Raw uploads are
AES-256-GCM encrypted and purged 90 days post-completion.

---

## 12. Troubleshooting field guide

| Symptom | Cause | Fix |
|---|---|---|
| `could not lock config file .git/config: File exists` or stale `.git/index.lock` | Crashed git process left a lock; some sandboxed mounts also block unlink | Confirm no live git process, then `rm -f .git/index.lock`. In Cowork sandboxes, enable file deletion first. |
| `tsc` floods with `Module '"@prisma/client"' has no exported member` | Prisma client not generated | `cd backend-node && npm run prisma:generate` |
| Dozens of AlmController spec failures after a constructor change | Positional slot map out of date | §10.2 — update the slot map, document the shift inline |
| Commit blocked: "landing entry required" | Touched src/prisma/app paths without a same-day §5 bullet | Add the §5 entry to the SAME commit; `SKIP_LANDING=1` only for non-landing work |
| Commit blocked: prettier | Formatting drift | `npx prettier --write <staged files>` and re-stage |
| `verify:rule-11` regression: "N new offenders" | New `as any` without rationale, or rationale on the wrong line | Standalone `// type-rationale: …` line directly above the cast (§4.5) |
| `verify:no-orphan-spec` failure | Spec without source pairing | Pair it or justify in `BASELINE_ORPHANS` |
| Your staged file shows up in a peer's commit | Stage race (§6.1 mode 2) | Docs-only follow-up commit naming the misattributed SHA; switch to `git commit --only` |
| `npm ci` dies silently on a network-mounted tree | Mount I/O too slow / process killed | Copy the package dir to local disk (`/tmp`), install there, run gates there against synced sources |
| Author identity unknown on commit | Fresh environment | §6.4 |
| CECL/COSSEC returns all zeros | It won't — if you see `overallStatus: 'data_unavailable'` + gaps, that IS the answer: upload balance sheet / loan segments | Seed via `npm run seed:institution` or the portal CSV flow |

---

## 13. Glossary (domain ES ⇄ EN)

| Español (canonical in-product) | English | Notes |
|---|---|---|
| socio | member | NEVER "customer" |
| junta (directiva) | board (of directors) | |
| asamblea | (member) assembly/meeting | |
| razón de capital | capital ratio | COSSEC minimum 8% |
| tasa de morosidad | delinquency rate | |
| provisión para pérdidas | loss allowance (CECL) | |
| acciones | shares (member share savings) | the cooperativa's capital base |
| Club de Navidad | Christmas club account | seasonal liability; LCR-relevant, never CECL |
| garantía de acciones | share-secured | near-zero LGD |
| préstamos comerciales / MBL | member business loans | |
| semáforo | traffic light (status) | green/yellow/red UI contract |
| COSSEC | PR cooperativa regulator | Corporación Pública para la Supervisión y Seguro de Cooperativas |
| NEV / Valor Económico Neto | Net Economic Value | NCUA supervisory test bands |

---

## Appendix A — Command card

```sh
# Pickup
npm run cerniq:status && npm run cerniq:cross
claude-peers status && npm run session:register && npm run session:claim

# Verify (backend / frontend / everything)
cd backend-node && npm run lint && npm run test:cov
cd frontend && npm run lint && npm run test:coverage
npm run verify:local:critical

# Land
npx prettier --write <files>
git add <explicit files…>
git commit --only <each file…> -m "type(scope): why, not just what"

# Wrap
npm run session:release && npm run session:handoff
```

---

*Maintained alongside the Layer 1 compliance engine. When a section drifts
from reality, fix the section in the same commit that moved reality — this
handbook is subject to the same landing discipline it documents.*
