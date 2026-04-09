# CERNIQ FAANG Audit — Remediation Roadmap

Date: 2026-04-09

Roadmap goal: make CERNIQ publicly credible as an institution-ready ALM platform before broadening the platform narrative.

## P0 — Stop Trust Leakage

| Priority | Outcome | Owner Type | Dependencies | Definition of Done | Proof of Completion |
| --- | --- | --- | --- | --- | --- |
| P0 | Canonical public narrative is narrowed to the ALM wedge | Founder + product marketing + frontend | None | Landing, metadata, pricing, “why” pages, and README all use one wedge-first statement and one count source | Updated copy audit with all prior conflicts removed |
| P0 | Unsupported or proof-heavy public claims are removed or downgraded | Founder + product + compliance reviewer | Narrative baseline | Goldman/QRM parity, `200+` / `170+`, AI proof, and institutional-library claims are either evidenced or removed from customer-facing copy | Re-run evidence matrix and classify all public claims as supported or intentionally omitted |
| P0 | Public surface is classified and pruned | Product + frontend + growth | Narrative baseline | Every visible route family is tagged `core`, `adjacent but supportable`, `internal/demo only`, or `premature public platform`, and non-core surfaces are hidden or de-indexed | New route inventory with public status decisions |
| P0 | Security and retention claims match reality | Security owner + backend + marketing | None | Public security page and metadata exactly match implemented retention and controls | Claim-to-code diff is empty |

## P1 — Build The Trust Layer CERNIQ Actually Needs

| Priority | Outcome | Owner Type | Dependencies | Definition of Done | Proof of Completion |
| --- | --- | --- | --- | --- | --- |
| P1 | Formal model registry exists | Backend + platform + risk/model owner | Data model design | New registry entity tracks model key, version, owner, status, approval date, calibration metadata, validation artifact, and retirement state | Registry-backed model inventory and sample records in lower environments |
| P1 | Governed scenario library exists | Backend + product + risk owner | Model registry schema | Saved scenarios are separated from governed scenarios; governed entries carry source, owner, version, and approval state | API/UI can distinguish user-saved scenarios from approved institutional scenarios |
| P1 | Governed yield-curve and benchmark entities exist | Backend + data/platform | Model registry schema | Curves and benchmark packs carry as-of date, provenance, refresh policy, validation status, and version identifiers | Curve/benchmark provenance visible in admin/debug output and persisted in DB |
| P1 | Every shipped report is tied to one immutable analysis artifact | Backend + reporting + platform | Registry and dataset entities | A generated ALM PDF references exactly one `AnalysisRun` and one persisted export artifact with immutable input/version metadata | Report lineage lookup reproduces artifact ancestry without live recomputation |
| P1 | Report generation reads from a stable snapshot | Backend + platform | Immutable run artifacts | Preflight and final report generation no longer rely on multiple live reads; the snapshot boundary is explicit and persisted | Snapshot semantics documented and enforced in tests |

## P2 — Expand Only After The Wedge And Trust Layer Hold

| Priority | Outcome | Owner Type | Dependencies | Definition of Done | Proof of Completion |
| --- | --- | --- | --- | --- | --- |
| P2 | External benchmark validation pack for ALM core exists | Quant/risk owner + backend + QA | Registry + governed datasets | Duration gap, NII, EVE, LCR, and stress outputs are benchmarked against external or approved internal goldens with tolerances | Validation pack checked in or otherwise reproducibly published |
| P2 | Production gate is automated end-to-end | DevOps + QA + backend + frontend | Immutable artifacts | Upload -> queue -> report -> delivery path runs as a CI or scheduled staging gate, not only a runbook | Automated gate output attached to release evidence |
| P2 | Expansion order is explicit and enforced | Founder + product + engineering | P0 and P1 complete | Non-ALM families are reopened publicly only in this order: support adjacent ALM intelligence first, then governed peer/benchmarking, then carefully selected broader quant surfaces | Expansion tracker shows each family gated by trust-layer prerequisites |

## Recommended Expansion Order

1. Harden ALM core trust layer.
2. Expose governed scenarios and governed benchmark context.
3. Expose peer/comparative analytics only after provenance and caveats are productized.
4. Expose selected adjacent ALM intelligence surfaces that directly strengthen committee and regulator workflows.
5. Revisit broader quant, developer, and platform stories only after CERNIQ can prove institutional-grade governance and report lineage.

## Recommended Future Interface Additions

These are recommendations only. They are not implemented in this audit.

### 1. Model Registry Entity

Purpose: make every production-facing model discoverable, owned, versioned, and approvable.

Minimum fields:

- model key
- version
- owner
- status
- approval date
- calibration metadata
- validation artifact reference
- retirement flag

### 2. Governed Scenario Library Entity

Purpose: distinguish approved institutional scenarios from user-saved working scenarios.

Minimum fields:

- scenario key
- version
- owner
- scope
- source
- approved uses
- parameter set
- provenance metadata

### 3. Governed Yield-Curve / Benchmark Dataset Entity

Purpose: capture provenance, versioning, and refresh semantics for curves and benchmark packs.

Minimum fields:

- dataset key
- as-of timestamp
- source
- refresh policy
- version
- fallback policy
- validation status

### 4. Immutable Report Artifact Entity

Purpose: bind every distributed PDF to one persisted analysis artifact and one export artifact.

Minimum fields:

- artifact id
- source analysis run id
- source dataset versions
- report template version
- generated at
- checksum
- storage locator

## Roadmap Discipline

Do not spend the next cycle adding more visible models or adjacent public pages until P0 and the first half of P1 are complete. More breadth without trust-layer hardening will increase demo excitement while decreasing institutional credibility.
