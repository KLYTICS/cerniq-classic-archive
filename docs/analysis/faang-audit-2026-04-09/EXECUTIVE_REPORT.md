# CERNIQ Founder/Exec FAANG-Grade Audit

Date: 2026-04-09

Audience: Founder / executive team

Scope: Full visible monorepo, judged against the current canonical ALM wedge

## Executive Answer

CERNIQ is credible today as a focused ALM reporting product for cooperativas and adjacent credit-union workflows. It is not yet credible, based on repo evidence alone, as a world-class institutional asset analysis platform whose differentiation comes from the breadth of its model catalogue.

The repo shows a real ALM core, serious engineering effort, and meaningful verification discipline. The main blockers are not a lack of quant surfaces. They are:

1. narrative inflation beyond repo-backed truth
2. institutional-data governance gaps
3. incomplete model-governance and report-lineage controls
4. public-surface sprawl that dilutes the ALM wedge

## Four-Track Verdict

### Track 1 — Wedge / Narrative

Verdict: Strong wedge, weak discipline around public claims.

Repo-backed story: secure balance-sheet upload, ALM calculations, bilingual board-ready reporting, portal retrieval, and recurring job flow. That is supported in [`README.md`](../../../README.md), [`docs/strategy/value_proposition.md`](../../strategy/value_proposition.md), [`docs/strategy/problem_map.md`](../../strategy/problem_map.md), [`backend-node/src/alm/alm.service.ts`](../../../backend-node/src/alm/alm.service.ts), [`backend-node/src/alm/reports/reports.service.ts`](../../../backend-node/src/alm/reports/reports.service.ts), and [`backend-node/src/portal/portal.controller.ts`](../../../backend-node/src/portal/portal.controller.ts).

Public story drift: metadata and marketing pages claim a broader institutional platform with `200+` modules, `170+` quant models, Goldman-grade depth, and proof-heavy benchmark/AI claims not reconciled with the model inventory and strategy docs. See [`frontend/app/layout.tsx`](../../../frontend/app/layout.tsx), [`frontend/app/why-cerniq/page.tsx`](../../../frontend/app/why-cerniq/page.tsx), and [`docs/models/model_inventory.md`](../../models/model_inventory.md).

### Track 2 — Institutional Data

Verdict: Useful benchmark and curve inputs exist, but the repo does not yet show a governed institutional dataset platform.

Positive: CERNIQ has static PR benchmark assets, saved scenarios, yield-curve persistence, market-data connectors, and peer/cooperativa framing in [`backend-node/src/alm/benchmarks/pr-cooperativa-benchmarks.ts`](../../../backend-node/src/alm/benchmarks/pr-cooperativa-benchmarks.ts), [`backend-node/src/alm/data/pr-beta-benchmarks.json`](../../../backend-node/src/alm/data/pr-beta-benchmarks.json), [`backend-node/src/alm/scenarios/scenario-persistence.service.ts`](../../../backend-node/src/alm/scenarios/scenario-persistence.service.ts), and [`backend-node/src/alm/yield-curve.service.ts`](../../../backend-node/src/alm/yield-curve.service.ts).

Gap: the repo does not show governed dataset lineage, refresh policy enforcement, versioned scenario libraries, or external benchmark-validation packs. The problem map and model inventory explicitly call these missing or unverifiable in [`docs/strategy/problem_map.md`](../../strategy/problem_map.md) and [`docs/models/model_inventory.md`](../../models/model_inventory.md).

### Track 3 — Trust Layer

Verdict: Better than average internal controls; not yet enterprise-grade for immutable institutional evidence.

Positive: analysis runs, ingestion logs, audit logs, report jobs, drift tests, CI gates, and preflight checks are all real. See [`backend-node/prisma/schema.prisma`](../../../backend-node/prisma/schema.prisma), [`backend-node/src/alm/analysis-runs.service.ts`](../../../backend-node/src/alm/analysis-runs.service.ts), [`backend-node/src/alm/reports/report-preflight.service.ts`](../../../backend-node/src/alm/reports/report-preflight.service.ts), [`.github/workflows/ci-cd.yml`](../../../.github/workflows/ci-cd.yml), and [`.github/workflows/alm-quality-gate.yml`](../../../.github/workflows/alm-quality-gate.yml).

Gap: shipped report artifacts are not immutably bound to one analysis artifact; preflight says snapshot timing is informational only; retention/security claims are not fully aligned. See [`backend-node/src/alm/alm-document-exports.service.ts`](../../../backend-node/src/alm/alm-document-exports.service.ts), [`backend-node/src/jobs/data-retention.service.ts`](../../../backend-node/src/jobs/data-retention.service.ts), and [`frontend/app/security/layout.tsx`](../../../frontend/app/security/layout.tsx).

### Track 4 — Expansion Readiness

Verdict: Broad adjacent surfaces exist, but public expansion is ahead of trust maturity and wedge clarity.

The visible app surface contains 157 `page.tsx` routes and 235 route/layout/page files, spanning ALM plus `developers`, `options`, `risk-analytics`, `spendcheck`, `backtest`, `live-data`, `execution-quality`, and other families. The route inventory is in [`APPENDIX_INVENTORY.md`](./APPENDIX_INVENTORY.md). The repo baseline already says the narrow ALM design-partner motion is more credible than the broad platform story in [`docs/CERNIQ_ENTERPRISE_REPO_BASELINE.md`](../../CERNIQ_ENTERPRISE_REPO_BASELINE.md).

## Top Risks

1. Customer-facing overclaim risk: public positioning exceeds repo-backed product truth.
2. Institutional diligence risk: no full model registry, dataset governance layer, or external validation pack.
3. Audit/regulator evidence risk: report generation is not yet tied to one immutable analysis artifact.
4. Trust erosion risk: specific claims such as `7-year audit logs` conflict with code defaults.
5. Focus risk: route and product-surface sprawl weakens the ALM wedge that is actually strongest today.

## Severity-Ranked Findings

### Finding FA-01

- ID: `FA-01`
- Severity: `critical`
- Theme: `Wedge / Narrative`
- Claim: CERNIQ publicly presents itself as a broad institutional ALM intelligence platform with `200+` modules and `170+` quant models.
- Repo Truth: The repo strongly supports a narrower ALM upload-to-report wedge. It also contains conflicting counts: `62`, `101`, `142`, `170+`, and `200+`.
- Business Risk: Credibility loss during founder-led sales, diligence, and enterprise security/compliance review.
- Recommended Action: Collapse all public messaging to one wedge-first statement and one source of truth for counts before adding more platform language.
- Evidence:
  - [`README.md`](../../../README.md)
  - [`docs/strategy/value_proposition.md`](../../strategy/value_proposition.md)
  - [`frontend/app/layout.tsx`](../../../frontend/app/layout.tsx)
  - [`frontend/app/why-cerniq/page.tsx`](../../../frontend/app/why-cerniq/page.tsx)
  - [`frontend/lib/alm/registry.ts`](../../../frontend/lib/alm/registry.ts)
  - [`APPENDIX_INVENTORY.md`](./APPENDIX_INVENTORY.md)

### Finding FA-02

- ID: `FA-02`
- Severity: `high`
- Theme: `Wedge / Narrative`
- Claim: Pages market Goldman-grade depth, Moody's/QRM equivalence, a Claude-powered advisor, and a 94-institution / NOAA / FEMA evidence base as settled public proof.
- Repo Truth: Some underlying assets exist, but the repo does not prove these as fully validated public claims. The strategy docs explicitly advise against Bloomberg-style platform claims.
- Business Risk: Sales story can be attacked on proof, methodology, and validation, even when the core ALM workflow is real.
- Recommended Action: downgrade proof-heavy claims to internal roadmap or design-partner language unless and until evidence packs exist.
- Evidence:
  - [`frontend/app/why-cerniq/page.tsx`](../../../frontend/app/why-cerniq/page.tsx)
  - [`frontend/app/pricing/layout.tsx`](../../../frontend/app/pricing/layout.tsx)
  - [`docs/strategy/value_proposition.md`](../../strategy/value_proposition.md)
  - [`docs/models/model_inventory.md`](../../models/model_inventory.md)

### Finding FA-03

- ID: `FA-03`
- Severity: `high`
- Theme: `Institutional Data`
- Claim: CERNIQ behaves like a governed institutional dataset platform.
- Repo Truth: The repo shows useful static benchmark assets, saved scenarios, and custom curves, but not a governed dataset layer with controlled provenance, refresh enforcement, or validation status.
- Business Risk: Institutional buyers will treat static or fallback data as operationally weaker than implied by the platform story.
- Recommended Action: explicitly separate `static benchmark library`, `saved user scenario`, and `governed institutional dataset` in product language and architecture docs.
- Evidence:
  - [`backend-node/src/alm/benchmarks/pr-cooperativa-benchmarks.ts`](../../../backend-node/src/alm/benchmarks/pr-cooperativa-benchmarks.ts)
  - [`backend-node/src/alm/data/pr-beta-benchmarks.json`](../../../backend-node/src/alm/data/pr-beta-benchmarks.json)
  - [`backend-node/src/alm/scenarios/scenario-persistence.service.ts`](../../../backend-node/src/alm/scenarios/scenario-persistence.service.ts)
  - [`backend-node/src/alm/yield-curve.service.ts`](../../../backend-node/src/alm/yield-curve.service.ts)
  - [`docs/strategy/problem_map.md`](../../strategy/problem_map.md)

### Finding FA-04

- ID: `FA-04`
- Severity: `critical`
- Theme: `Trust Layer / Model Governance`
- Claim: CERNIQ has enterprise-grade model governance.
- Repo Truth: `AnalysisRun.modelVersion` exists, but there is no full model registry with owner, approval state, calibration metadata, benchmark validation artifact, or retirement policy.
- Business Risk: Cannot credibly answer institutional diligence questions about model ownership, validation, or replayability.
- Recommended Action: make a model registry the first trust-layer buildout, before expanding public model breadth claims.
- Evidence:
  - [`backend-node/prisma/schema.prisma`](../../../backend-node/prisma/schema.prisma)
  - [`backend-node/src/alm/analysis-runs.service.ts`](../../../backend-node/src/alm/analysis-runs.service.ts)
  - [`docs/models/model_inventory.md`](../../models/model_inventory.md)
  - [`docs/CERNIQ_ENTERPRISE_REPO_BASELINE.md`](../../CERNIQ_ENTERPRISE_REPO_BASELINE.md)

### Finding FA-05

- ID: `FA-05`
- Severity: `critical`
- Theme: `Trust Layer / Report Lineage`
- Claim: A shipped ALM PDF can be traced back to one immutable, reproducible analysis artifact.
- Repo Truth: Report generation is real and tested, but export manifests are generated on demand and report preflight explicitly says snapshot timing is informational only. The current path does not prove immutable run-bound report artifacts.
- Business Risk: Weakens committee, audit, and regulator confidence in “show me exactly what was seen on that date.”
- Recommended Action: bind every distributed report to one persisted analysis artifact and one export artifact with immutable lineage.
- Evidence:
  - [`backend-node/src/alm/reports/report-preflight.service.ts`](../../../backend-node/src/alm/reports/report-preflight.service.ts)
  - [`backend-node/src/alm/alm-document-exports.service.ts`](../../../backend-node/src/alm/alm-document-exports.service.ts)
  - [`backend-node/src/alm/analysis-runs.service.ts`](../../../backend-node/src/alm/analysis-runs.service.ts)

### Finding FA-06

- ID: `FA-06`
- Severity: `high`
- Theme: `Trust Layer / Security Claims`
- Claim: CERNIQ advertises `7-year audit logs`.
- Repo Truth: the retention service defaults audit-log retention to `365` days.
- Business Risk: Specific trust claims that contradict code are particularly damaging in security and compliance reviews.
- Recommended Action: align public claims to implemented retention, or implement the advertised policy before publishing it.
- Evidence:
  - [`frontend/app/security/layout.tsx`](../../../frontend/app/security/layout.tsx)
  - [`backend-node/src/jobs/data-retention.service.ts`](../../../backend-node/src/jobs/data-retention.service.ts)

### Finding FA-07

- ID: `FA-07`
- Severity: `medium`
- Theme: `Operational Readiness`
- Claim: Release integrity is fully automated and stable.
- Repo Truth: CI/CD and the ALM quality gate are meaningful strengths, but the release gate is still light-touch, the production gate remains checklist-driven, and repo docs acknowledge GitHub billing can block remote signals before jobs start.
- Business Risk: Readiness evidence is stronger than average, but not yet the kind of sealed operational story expected for enterprise claims.
- Recommended Action: automate the upload-to-report-to-delivery production gate and treat account/billing workflow blockers as ops risk, not code health.
- Evidence:
  - [`.github/workflows/ci-cd.yml`](../../../.github/workflows/ci-cd.yml)
  - [`.github/workflows/alm-quality-gate.yml`](../../../.github/workflows/alm-quality-gate.yml)
  - [`docs/ops/e2e_production_gate.md`](../../ops/e2e_production_gate.md)
  - [`docs/ops/REPO_GREEN_CHECKLIST.md`](../../ops/REPO_GREEN_CHECKLIST.md)

### Finding FA-08

- ID: `FA-08`
- Severity: `high`
- Theme: `Expansion Readiness`
- Claim: Broad adjacent product surfaces strengthen CERNIQ’s current wedge.
- Repo Truth: The route inventory shows a large set of public or visible families beyond the ALM core. This breadth creates discovery noise before the trust layer is mature.
- Business Risk: The product can look impressive but unfocused, making the strongest part of the business harder to trust and sell.
- Recommended Action: classify all visible surfaces into `core`, `adjacent but supportable`, `internal/demo only`, and `premature public platform`, then reduce public exposure accordingly.
- Evidence:
  - [`APPENDIX_INVENTORY.md`](./APPENDIX_INVENTORY.md)
  - [`docs/CERNIQ_ENTERPRISE_REPO_BASELINE.md`](../../CERNIQ_ENTERPRISE_REPO_BASELINE.md)
  - [`frontend/app`](../../../frontend/app)

## Decision Summary

### Credible Now

- ALM upload-to-report workflow
- bilingual board-ready reporting
- cooperativa-oriented ALM positioning
- serious internal engineering and test discipline

### Not Credible Now

- world-class institutional analysis platform based on model breadth
- fully governed institutional dataset platform
- enterprise-grade model governance and immutable report lineage
- broad public claim set around depth, proof libraries, and platform maturity

### Credible After Remediation

- “best-in-class ALM reporting workflow for Puerto Rico institutions and advisors”
- “governed ALM analytics platform with reproducible board and audit artifacts”
- “institution-ready trust layer first, broader analytics second”

## Verification Notes

Read-only verification run during this audit:

- Backend targeted ALM trust-layer spot check passed:
  - `npx jest src/alm/golden-reconciliation.spec.ts src/alm/reports/report-preflight.service.spec.ts src/alm/analysis-runs.service.spec.ts --runInBand`
  - Result: `3` suites passed, `19` tests passed.
- Frontend spot check from repo root was not reliable as an audit signal:
  - `npx vitest run frontend/lib/api.test.ts frontend/app/portal/page.test.tsx`
  - Result: failed due root-level test discovery across `.omx` worktrees and browser-environment assumptions, which reinforces that canonical frontend validation should follow [`docs/ops/REPO_GREEN_CHECKLIST.md`](../../ops/REPO_GREEN_CHECKLIST.md).
