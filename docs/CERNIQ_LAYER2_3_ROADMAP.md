# CERNIQ Layer 2 / Layer 3 Build Roadmap — Market-Driven Sequencing

> **Provenance.** Synthesized 2026-06-06 from two inputs: (1) [docs/CERNIQ_MARKET_BIBLE.md](CERNIQ_MARKET_BIBLE.md)
> — the PR-cooperativa market intelligence compiled the same day; (2) a verified
> read of the Layer 1 codebase (schema + ALM services), not the handbook's prose.
> Every "what exists" claim below is cited to `file:line`. Every market claim is
> cited to a Market Bible section. **UNVERIFIED** items from the bible stay marked
> UNVERIFIED here — a strategy doc obeys D1 too: no unknown is laundered into a known.
>
> **Companion docs:** [CLAUDE.md](../CLAUDE.md) (operating contract),
> [docs/TERMINAL_OPERATIONS_HANDBOOK.md](TERMINAL_OPERATIONS_HANDBOOK.md) (§9 Layer 1
> deep dive), [docs/SESSION_HANDOFF.md](SESSION_HANDOFF.md) (live status).
>
> This is a **planning** artifact. It commits to a *sequence and a rationale*, not to
> line-level designs. Each initiative still earns its own ADR/spec before code.

---

## 0. The one decision that reorders everything: the granularity fork

The intuitive sequence is "Layer 1 → Layer 2 → Layer 3." That is the wrong axis.
The real axis is **data granularity**, because three different market-driven features
secretly share one prerequisite:

| Market-driven feature | Real prerequisite | Today |
|---|---|---|
| FHLBNY **COL-121** monthly collateral file (Bible §8.2–8.3) | **Loan-level** mortgage records | Aggregate only |
| Layer 2 **concentration-by-municipio** (Bible §1.2 regional, §5 Census) | **Loan-level + geography** | Aggregate, no geo field |
| Layer 3 **Member LTV** (product penetration, churn, profitability) | **Member-level** records | No member entity at all |

The entire engine operates at aggregate granularity — `LoanSegment`
([schema.prisma:372](../backend-node/prisma/schema.prisma:372)), `DepositTier`
([schema.prisma:392](../backend-node/prisma/schema.prisma:392)), `BalanceSheetItem`
([schema.prisma:274](../backend-node/prisma/schema.prisma:274)). There is **no
`Member`/`Socio`/`Borrower` model**, and `municipio`/`geography` exists only as a
*policy* `limitType` string in `ConcentrationLimit`
([schema.prisma:412](../backend-node/prisma/schema.prisma:412)) — a capability with
no data behind it.

This yields three build tiers, and the sequencing follows from them:

```
Tier A  ── features that need NO new granularity (aggregate data the engine already has)
            → cheap, high-leverage, ship first while Tier B is designed
Tier B  ── ONE loan-level ingestion investment, shared across THREE payoffs
            → unlocks the hottest wedge (COL-121) + the differentiator (municipio)
            → and is the stepping-stone toward Tier C
Tier C  ── member-level ingestion → Layer 3, the long-term moat
            → gated on a discovery question, not just a build question
```

**Thesis:** ship Tier A now (the engine already does ~80% of it), then make the
**single loan-level ingestion investment** that pays off three times, then commit to
member-level only after validating that cooperativas can actually export member tapes.

---

## 1. Prioritization rubric

Each initiative scored 1 (low) – 5 (high) on four axes. Wave assignment is the output,
not an input.

| Axis | Meaning |
|---|---|
| **Clock** | Regulatory/market deadline pressure — is the buyer feeling pain *now*? |
| **Wedge** | Deal-win / retention value — does it open or defend revenue? |
| **Leverage** | How much of it the Layer 1 engine already provides (less to build) |
| **Risk⁻¹** | Inverse external-dependency risk — *higher = fewer unknowns blocking us* |

| Initiative | Clock | Wedge | Leverage | Risk⁻¹ | Wave |
|---|:--:|:--:|:--:|:--:|:--:|
| CAEL / dual incurred-loss + CECL filing | 5 | 4 | 4 | 3 | **1** |
| Data-driven PR macro overlay (FRED/BLS/Census) | 3 | 3 | 4 | 5 | **1** |
| Early-warning watchlist (persist + trend + alert) | 3 | 4 | 4 | 5 | **1** |
| Capital-indivisible planning analytics | 3 | 3 | 4 | 5 | **1** |
| **Loan-level ingestion path** (the linchpin) | 4 | 5 | 2 | 3 | **2** |
| FHLBNY COL-121 + borrowing-capacity | 5 | 5 | 2 | 3 | **2** |
| Concentration-by-municipio + single-borrower | 3 | 4 | 2 | 4 | **2** |
| Bilingual GAAP mapper + Reg 8665 pack | 4 | 4 | 3 | 2 | **2** |
| Member-level ingestion + Layer 3 LTV | 2 | 5 | 1 | 2 | **3** |
| AITSA integration ("the moat") | 4 | 5 | 3 | **1** | **parallel/unblock-first** |

AITSA scores highest wedge *and* highest blocker — it is a research/relationship task
before it is a build task (Bible §9 item 5: the spec needs a COSSEC contact). It runs as
a parallel unblock track, not inside a wave.

---

## 2. Wave 1 — Tier A: ship on the schema we already have

No migrations to member/loan granularity. Each builds on a verified Layer 1 surface.
Effort = rough T-shirt (S/M/L/XL); estimates are directional, not commitments.

### W1.1 — CAEL / dual incurred-loss + CECL filing  · effort **L**
- **Market driver (Bible §3.2):** since **March 2024**, every coop files **three parallel
  CAEL reports** quarterly in AITSA — CAEL per Reglamento 7790, CAEL-with-CECL, and "CAEL
  Piloto" (Net Equity Ratio). CECL is live via **Carta Circular 2023-01**; the legacy
  incurred-loss basis is **Reglamento 8665 §2.12.2.5**. The bible's explicit product
  implication: *"CERNIQ's CECL engine must output BOTH Reglamento 8665 incurred-loss AND
  ASU 2016-13 CECL through ~2028"* (Bible §3.2).
- **What exists:** the full CECL engine — WARM / Vintage / PD×LGD and the cooperativa-native
  `getCooperativaCECLAnalysis()` ([cecl.service.ts](../backend-node/src/alm/cecl.service.ts));
  the framework abstraction `IRegulatoryFramework` + `getFramework()`
  ([frameworks/index.ts](../backend-node/src/alm/frameworks/index.ts)); the immutable,
  checksummed `ReportArtifact` pipeline
  ([reports/report-artifact.service.ts](../backend-node/src/alm/reports/report-artifact.service.ts)).
- **The gap:** (a) an **incurred-loss method** (Reg 8665 §2.12.2.5) alongside the existing
  CECL methods — a known, bounded loss-rate calc; (b) a **CAEL framework** (`cael-pr.framework.ts`)
  modeling the three report variants' ratios; (c) the dual-output filing renderer; (d) extend
  the artifact `format` enum (`CAEL_JSON` / `CAEL_PDF`).
- **Data dependency:** none new — runs on existing `LoanSegment` + COSSEC compliance.
- **External risk:** CC-2023-01 is a **non-OCR scan**; exact CECL exceptions/phase-in are
  **UNVERIFIED** (Bible §9 item 3). Build the dual-output skeleton now; gate the exact
  exception logic behind a `data-gap`/config flag until the text is obtained.
- **D1 / Spanish-first:** filing renders in `es` by default; missing inputs → `data_unavailable`
  + gap manifest, never a fabricated ratio (the COSSEC examiner reading `0` concludes
  insolvency, not "no data").
- **Done =** specs + golden fixture + `ModelRegistryEntry` for the incurred-loss model
  (category `REGULATORY`, DRAFT→…) + SESSION_HANDOFF §5 landing.

### W1.2 — Data-driven PR macro overlay  · effort **M**
- **Market driver (Bible §5):** BLS, FRED (**925 PR-tagged series**), and Census (`api.census.gov`,
  FIPS 72) are **free + programmatic**. FHFA HPI for PR and municipio out-migration (PEP/PRCS)
  are exactly the inputs that justify a *harsher-than-mainland* overlay.
- **What exists:** `PR_PD_MULTIPLIERS` = 1.0/2.1/3.6 and `PR_SCENARIO_WEIGHTS` = 45/35/20 in
  [product-registry.ts](../backend-node/src/alm/cooperativa/product-registry.ts), already
  *disclosed configuration* that emits a WARNING gap on use; the `LoanCohort` vintage table
  ([schema.prisma:429](../backend-node/prisma/schema.prisma:429)) supplies real
  origination-quarter loss data for **cohort calibration** — no new tables.
- **The gap:** a small macro-feed service (FRED/BLS/Census clients, cached, with a scraping
  fallback for COSSEC's PDF-only quarterly — Bible §5) that *derives* the multipliers from
  PR unemployment + HPI + out-migration, and a cohort-fitting routine over `LoanCohort` to
  replace cold-start PDs where history exists.
- **Why it matters:** turns "harsher because we said so" into "harsher because here's the
  sourced PR data" — the credibility difference between a vendor and a defensible model under
  a NASCUS-accredited examiner (Bible §3.4).
- **External risk:** low — APIs are documented and free. Keys + rate limits known (Bible §5).
- **Done =** macro-feed service with `--self-test` on cached fixtures, ratchet that the overlay
  *never* silently falls back to hardcoded values without a WARNING gap, registry entries for
  the calibrated PD models.

### W1.3 — Early-warning watchlist: persist + trend + alert  · effort **M**
- **Market driver (Bible §3.4, §1.2):** rising examiner expectations (NASCUS accreditation,
  NCUA MOU) + system morosidad 2.40%→2.32% means boards want *leading* signals, not lagging
  ratios. CAEL ratings (48 "1", 40 "2", 3 "4") are public per-coop — a watchlist that explains
  *why* a coop is trending toward "2" is board-meeting gold.
- **What exists:** `asset-ews.service.ts` — a **12-indicator composite** (30/90-day delinquency,
  NPL, charge-off, LTV, DSCR, classified-asset, allowance coverage, peer gap) with
  GREEN/YELLOW/RED bands and anomaly heuristic; registered as `risk.early-warning`. But it is
  **computed on-demand and never persisted** — no history, no trend, no alert.
- **The gap:** a `Watchlist`/`EwsSnapshot` table (institution-scoped, RLS), scheduled
  recomputation, threshold-crossing detection, and a trend delta vs prior period. This is the
  difference between a *number* and a *product surface*.
- **Data dependency:** none new — aggregate indicators already feed it.
- **D1 note:** when an indicator's input is missing the row is `data_unavailable`, and the
  composite must *not* score the coop GREEN by omission (a silent-pass hazard).
- **Done =** new table + migration (append-only), scheduled job, specs, registry update,
  landing entry.

### W1.4 — Capital-indivisible planning analytics  · effort **S–M**
- **Market driver (Bible §3.5):** capital indivisible is **$412M = 3.25% of assets (Q1 2026)**,
  phasing toward a **4%** floor and an **8% indivisible-capital-over-RWA** index; **35% of the
  reserve must be liquid**. Many coops are *still building toward the floor* → "capital-planning
  analytics sell" (bible's words).
- **What exists:** the 12-ratio COSSEC engine (`getCOSSECCompliance()` in
  [alm-enterprise.service.ts](../backend-node/src/alm/alm-enterprise.service.ts)) and NCUA RBC2
  ([ncua-rbc2.service.ts](../backend-node/src/alm/ncua-rbc2.service.ts)) already compute
  capital ratios on a real balance sheet with D1 guards.
- **The gap:** a forward-looking projector — "given 10% of net surplus → reserves and your
  growth, when do you cross 4%? what does a stress scenario do to the timeline?" — wiring the
  existing stress scenarios (Bible-aligned `pr_*` scenarios) to a capital glide-path.
- **Done =** projection service + specs + golden fixture + registry entry (`CAPITAL`) + landing.

---

## 3. Wave 2 — Tier B: the loan-level ingestion linchpin and what it unlocks

This is the **one big investment**. It is sequenced *after* Wave 1 deliberately: Wave 1 keeps
value shipping while this is designed, and the FHLBNY application window (Bible §8.1: first
member admitted **Apr 30 2026**, LarCoop second, 57+ coops in the pipeline) is a *months-long*
wave, not a single date — we can be in-market for it without rushing the data layer.

### W2.0 — Loan-level ingestion path  · effort **XL** · *prerequisite for W2.1–W2.2*
- **Why it's the linchpin:** COL-121 needs per-loan mortgage records; municipio concentration
  needs per-loan-with-geography; and member-level (Tier C) is the same machinery one relation
  deeper. Build the loan tape once.
- **What exists to reuse:** `csv-ingestion.service.ts` is **segment-level aggregate** today
  (bilingual headers, 50K-row cap, strict `parseFinancialField` with no phantom zeros) — its
  *parsing/validation/D1-gap* spine is reusable; the *schema target* is what changes. The
  industry-standard integration pattern is exactly this: **quarterly/monthly instrument-level
  flat files** (Bible §4.2 finding 4, §6.1) — Fiserv DNA even sells an "ALM-CECL Extract"
  producing instrument-level CSVs (Bible §6.1). We are *matching* the market's existing export
  pattern, which lowers switching friction.
- **The build:** new `LoanRecord` table (loan-level: balance, rate, maturity, collateral ref,
  delinquency status, **municipio**, origination date), a loan-tape ingestion variant, and an
  **aggregation view** so the existing aggregate services keep working unchanged (loan-level
  rolls *up* into `LoanSegment`-shaped reads — no rewrite of Layer 1).
- **Core-system adapters (Bible §6.1):** (1) Fiserv DNA (Oracle/AppMarket extract), (2) Sharetec,
  (3) generic CSV/Excel for the legacy long tail — *that ordering matches confirmed install base*.
- **External risk:** Sharetec Velocity export spec is **UNVERIFIED** (Bible §9 item 11); the
  generic CSV adapter de-risks the long tail regardless.
- **D1:** loan-level ingestion must surface per-field gaps (missing collateral value, missing
  municipio) and never impute geography — an imputed municipio would silently corrupt a
  concentration metric.

### W2.1 — FHLBNY COL-121 collateral file + borrowing-capacity  · effort **L** · *the wedge*
- **Market driver (Bible §8):** the single hottest opportunity. 57+ of 91 coops (~63%) hold
  mortgages; coops >$100M hold **89% of the $2.05B** book. FHLBNY membership requires **monthly
  loan-level COL-121** collateral files, collateral valuation/haircuts/excess tracking, and
  advances → wholesale funding the coops never modeled when deposit-only. COSSEC committed
  *"acompañamiento técnico y regulatorio"* — regulator-aligned tailwind (Bible §8.3).
- **What exists:** once W2.0 lands, the loan-level book is in place; `ReportArtifact` records the
  monthly file with checksum + lineage (extend enum: `COL_121_CSV`); the framework pattern hosts
  FHLBNY collateral rules.
- **The gap:** COL-121 **exact layout** (FHLBNY publishes a COL-012 getting-started guide; the
  precise field schema is **UNVERIFIED** — Bible §9 item 13 + §8.2), a haircut/eligibility engine
  (1-4 family, HELOC, multifamily, CRE), curing-status tracking, and monthly secure-transfer
  assembly.
- **Sequence:** ship the *modeled* collateral file + borrowing-capacity what-ifs first (high value
  for the IRR/advances decision); wire the exact COL-121 byte layout once obtained from FHLBNY.

### W2.2 — Concentration-by-municipio + single-borrower exposure  · effort **M** · *the differentiator*
- **Market driver (Bible §1.2, §5):** PR risk *is* geographic — regional asset clusters (Caguas
  $3.3B, Arecibo $3.0B…), hurricane/migration/tourism stress are municipio-shaped (the `pr_*`
  scenarios already encode this). Census municipio data is free and programmatic (Bible §5).
- **What exists:** `concentration.service.ts` already computes **HHI**, single-name limits, sector
  limits, and a diversification score — but **only by product/sector**, because there is no
  geographic data field (`ConcentrationLimit.limitType` lists `geography`
  [schema.prisma:412](../backend-node/prisma/schema.prisma:412) with nothing to measure).
- **The gap:** with W2.0's per-loan `municipio`, light up the geography branch of the *existing*
  concentration engine + true single-borrower aggregation; overlay Census/economic data per
  municipio (Bible §5 feeds) for an exposure-weighted risk view.
- **D1 hazard (flagged):** today the geography limit type can read "compliant" because there is
  nothing to evaluate — a silent pass. The build must convert that to `data_unavailable` until
  loan-level geography exists.

### W2.3 — Bilingual GAAP mapper + Reg 8665 attestation pack  · effort **M–L**
- **Market driver (Bible §8.2):** FHLBNY membership requires **two years of audited GAAP
  statements in Spanish AND English** and an **annual Reg 8665 Art. 2.18.2 attestation**
  (peer-reviewed, "pass"-rated by the Colegio de CPA). The RAP→GAAP transition (~2028, deadline
  **in flux** — Bible §3.2, §9 item 2) makes a RAP↔GAAP mapper broadly valuable beyond FHLBNY.
- **What exists:** bilingual PDF rendering + the artifact/lineage pipeline; the COSSEC report
  proves the conclusion-first bilingual rendering contract.
- **The gap:** a RAP→GAAP statement mapper (Ley 220-2015 RAP divergences — PR-bond amortized
  cost, 15-yr loss amortization — Bible §3.1) and an attestation evidence pack.
- **External risk:** the operative RAP→GAAP deadline is genuinely contested (Ley 99-2024 vs FOMB,
  Bible §9 item 2) — build the *mapper* (useful now), defer hard-coding any transition date.

---

## 4. Wave 3 — Tier C: member-level Layer 3 (the long-term moat)

### W3.0 / W3.1 — Member-level ingestion → Member LTV  · effort **XL** · *gated on discovery*
- **Market driver (Handbook §1 Layer 3):** product penetration per socio, churn/**desvinculación**
  risk, profitability per member, balance migration — "the long-term differentiator." No mainland
  vendor is even at Layer 1 in Spanish (Bible §4.2), so Layer 3 is a category of one.
- **What exists:** **nothing at member granularity.** No `Member`/`Socio` entity; `DepositTier`
  and `LoanSegment` are aggregate; `ahorros_socios` in the CSV map folds to aggregate
  `savings_deposits`. Layer 3 requires ~5 new tables (`Member`, `MemberLoan`, `MemberDeposit`,
  `MemberProduct`, `MemberChurn`) and a member-tape ETL — a fundamental ingestion change on top
  of W2.0's loan-level work.
- **The gating question is not "can we build it" — it's "can the data be sourced":** do PR
  cooperativa cores (Fiserv DNA, Sharetec, legacy) export **member-level tapes**, and will boards
  share socio-level data? This is a **discovery task** (see §6) that must return "yes" before
  W3.0 is funded. DNA's open Oracle DB (Bible §6.1) suggests *yes* for the DNA coops; the long
  tail is unknown.
- **D1 / privacy:** member-level data is PII-adjacent (socio identity, balances). Inherit the
  existing AES-256-GCM-at-rest + 90-day purge ingestion posture (Handbook §11) and RLS tenant
  isolation; this is a security-scope path (KLYTICS Rule 12 randomness, Rule 4 audit-immutability
  apply).

---

## 5. Parallel track — AITSA integration (the moat, blocked on a relationship)

- **Why it's the moat (Bible §3.3, §4.2):** *all* COSSEC filings flow through **AITSA**
  (aitsa.cossec.pr.gov); **no third-party vendor produces AITSA/COSSEC output today**; and AITSA
  *can interface directly with a coop's core system*. Whoever produces AITSA-shaped output owns the
  quarterly workflow.
- **Why it's not in a wave:** the **AITSA technical spec (file format/schema) is UNVERIFIED and
  needs a COSSEC contact** (Bible §9 item 5). It is a business-development/relationship task before
  it is an engineering task. Run it in parallel: the moment the spec is obtained, AITSA output is a
  *renderer* over data Wave 1/2 already produces (CAEL, liquidity, quarterly financials) — high
  leverage, fast build, *once unblocked*.

---

## 6. Discovery / external-dependency queue (mirrors Market Bible §9)

Each item blocks a specific wave. These are *learn-before-build* tasks, owned outside this repo.

| # | Unknown | Blocks | Source to pursue (Bible ref) |
|---|---|---|---|
| 1 | **AITSA file format/schema** | AITSA track | COSSEC contact (§9.5, §3.3) |
| 2 | **COL-121 exact field layout** | W2.1 byte-exact output | FHLBNY COL-012 guide / Member Relations (§8.2, §9.13) |
| 3 | **Member-tape export feasibility** per core | W3.0 funding decision | Fiserv DNA Oracle / Sharetec / coop pilots (§6.1) |
| 4 | **CC-2023-01 exact CECL exceptions** (non-OCR scan) | W1.1 exception logic | Request OCR/text from COSSEC (§3.2, §9.3) |
| 5 | **Operative RAP→GAAP deadline** (Jan vs Jun 2028; FOMB status) | W2.3 transition date | Monitor Ley 99-2024 / FOMB (§3.2, §9.2) |
| 6 | **Reglamento 6758 calendar** (exact monthly/quarterly content) | filing scheduler | COSSEC reglamento PDF (§3.3, §9.4) |
| 7 | Sharetec Velocity export spec | W2.0 Sharetec adapter | Sharetec / client coop (§6.1, §9.11) |

**Principle:** none of these block *all* of Wave 1. Wave 1 is deliberately chosen to be the work
we can do with zero new external information.

---

## 7. What this roadmap does NOT change (the discipline still binds)

Every initiative above inherits the existing contracts — none are renegotiated here:

- **D1 — never silent zeros.** New surfaces return `data_unavailable` + `gaps[]`, never `0`.
  Two new D1 *hazards* are explicitly called out above: the geography limit reading "compliant"
  with no data (W2.2), and the EWS composite scoring GREEN by omission (W1.3).
- **Spanish-first.** New user-facing surfaces default to `lang=es` with PR cooperativa register
  (socio, junta, razón de capital, desvinculación).
- **D24 ratchets.** Every new gate/feed ships a `--self-test`; coverage floors only raise; the PD
  overlay gets a ratchet that it never silently falls back to hardcoded constants.
- **KLYTICS rules.** Rule 4 (audit-immutable) for member/filing audit trails; Rule 9 (LLM
  stamping) if any analytic calls an LLM; Rule 11 (`any` rationale); Rule 12 (crypto randomness)
  on the member-data/PII paths.
- **Model governance.** Each new analytic registers a `ModelRegistryEntry`
  (DRAFT→CANDIDATE→APPROVED) with validation artifacts — the incurred-loss method, the calibrated
  PD models, the capital projector, the collateral/haircut engine all need entries.
- **The `AlmController` slot-map trap (Handbook §10.2).** Any new service wired into
  `AlmController` shifts the positional arg array in `alm.controller.spec.ts` — update it in the
  same commit or watch dozens of unrelated tests fail.
- **Landing discipline.** Code + spec + SESSION_HANDOFF §5 entry + explicit-pathspec commit, per
  initiative.

---

## 8. Sequencing at a glance

```
NOW ──────────────────────────────────────────────────────────────────────► LATER

Wave 1 (Tier A · existing schema)        Wave 2 (Tier B · loan-level)      Wave 3 (Tier C)
  W1.1 CAEL / dual CECL  ───────┐          W2.0 loan-level ingestion ──┐      W3.0 member tape
  W1.2 macro overlay (FRED) ────┤            │ (linchpin)              │        │ (gated on §6.3)
  W1.3 EWS watchlist ───────────┤            ├─► W2.1 COL-121 (wedge)  │        ▼
  W1.4 capital planning ────────┘            ├─► W2.2 municipio concn  └─►   W3.1 Member LTV
                                             └─► W2.3 GAAP / Reg 8665

  ┌─ parallel ───────────────────────────────────────────────────────────────────────┐
  │  AITSA track: obtain spec (§6.1) → render AITSA output over Wave1/2 data           │
  └───────────────────────────────────────────────────────────────────────────────────┘
```

**The single most important call:** do **not** start Wave 2 by building COL-121 directly. Build
**W2.0 (loan-level ingestion)** first — it is the prerequisite that makes COL-121, municipio
concentration, *and* the path to Layer 3 possible, instead of three separate one-off ingestion
hacks.

---

*Compiled 2026-06-06 from the Market Bible + verified Layer 1 code recon. Refresh when (a) the
COSSEC quarterly statistics publish (~75 days post-quarter), (b) any §6 discovery item resolves,
or (c) a wave lands. Subject to the same landing discipline it documents.*
