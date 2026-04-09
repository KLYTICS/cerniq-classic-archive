# CERNIQ FAANG Audit — Scorecard

Date: 2026-04-09

Scoring model:

- `0` = absent
- `1` = very weak
- `2` = partial / risky
- `3` = credible but materially incomplete
- `4` = strong
- `5` = enterprise-grade / durable

| Dimension | Score | Confidence | Rationale | Primary Evidence | Blockers |
| --- | --- | --- | --- | --- | --- |
| Wedge clarity | 4/5 | high | CERNIQ has a strong repo-backed ALM wedge with a real upload-to-report workflow and bilingual outputs. The problem is not the wedge itself; it is that the public story routinely outruns it. | [`README.md`](../../../README.md), [`docs/strategy/value_proposition.md`](../../strategy/value_proposition.md), [`backend-node/src/alm/reports/reports.service.ts`](../../../backend-node/src/alm/reports/reports.service.ts), [`frontend/app/page.tsx`](../../../frontend/app/page.tsx) | Public metadata and marketing pages still overclaim platform breadth and conflicting counts. |
| Institutional data readiness | 2/5 | high | Useful benchmark and yield-curve assets exist, but the repo does not demonstrate a governed institutional dataset layer with enforced provenance, refresh discipline, and validation status. | [`backend-node/src/alm/benchmarks/pr-cooperativa-benchmarks.ts`](../../../backend-node/src/alm/benchmarks/pr-cooperativa-benchmarks.ts), [`backend-node/src/alm/data/pr-beta-benchmarks.json`](../../../backend-node/src/alm/data/pr-beta-benchmarks.json), [`backend-node/src/alm/yield-curve.service.ts`](../../../backend-node/src/alm/yield-curve.service.ts), [`docs/strategy/problem_map.md`](../../strategy/problem_map.md) | No governed dataset entities, no validation packs, no dataset-version story. |
| Model governance | 1/5 | high | Analysis runs capture some versioning and snapshots, but the repo still lacks a true model registry and explicit validation controls. | [`backend-node/src/alm/analysis-runs.service.ts`](../../../backend-node/src/alm/analysis-runs.service.ts), [`backend-node/prisma/schema.prisma`](../../../backend-node/prisma/schema.prisma), [`docs/models/model_inventory.md`](../../models/model_inventory.md) | No registry with owner, approval status, calibration metadata, challenger/champion, or validation artifacts. |
| Verification / reproducibility | 3/5 | high | CI/CD, ALM quality gate, golden-drift tests, and targeted read-only verification are real strengths. Reproducibility falls short at the shipped report artifact layer. | [`.github/workflows/ci-cd.yml`](../../../.github/workflows/ci-cd.yml), [`.github/workflows/alm-quality-gate.yml`](../../../.github/workflows/alm-quality-gate.yml), [`backend-node/src/alm/golden-reconciliation.spec.ts`](../../../backend-node/src/alm/golden-reconciliation.spec.ts), [`backend-node/src/alm/reports/report-preflight.service.ts`](../../../backend-node/src/alm/reports/report-preflight.service.ts) | Preflight snapshot is informational only; distributed reports are not immutably tied to one persisted analysis artifact. |
| Public-surface discipline | 1/5 | high | The visible app and marketing surface are much broader than the current canonical wedge. Counts, proof claims, and route families are not tightly controlled. | [`frontend/app/layout.tsx`](../../../frontend/app/layout.tsx), [`frontend/app/why-cerniq/page.tsx`](../../../frontend/app/why-cerniq/page.tsx), [`APPENDIX_INVENTORY.md`](./APPENDIX_INVENTORY.md) | Conflicting public counts, proof-heavy unsupported claims, and many adjacent visible route families. |
| Operational readiness | 3/5 | medium | The repo has meaningful pipelines, tests, and a green checklist. Release evidence is still partially checklist-driven, and some remote signals depend on GitHub account health. | [`docs/ops/REPO_GREEN_CHECKLIST.md`](../../ops/REPO_GREEN_CHECKLIST.md), [`docs/ops/e2e_production_gate.md`](../../ops/e2e_production_gate.md), [`.github/workflows/ci-cd.yml`](../../../.github/workflows/ci-cd.yml) | Production gate is not fully automated; remote CI signals can be degraded by billing/account state; some trust claims remain mismatched. |

## Overall Assessment

Weighted qualitatively, CERNIQ is:

- strong on wedge and internal execution discipline
- moderate on operational readiness
- weak on institutional-data governance
- very weak on formal model governance
- very weak on public-surface discipline

## What The Score Means

### Credible Now

- focused ALM reporting product
- founder-led design-partner motion
- operationally serious team with meaningful verification habits

### Not Credible Now

- world-renowned institutional analysis platform based on breadth of quant modules
- governed institutional data platform
- enterprise-grade model control environment

### Minimum Threshold To Claim “Institution-Ready”

The lowest acceptable score profile for an institution-ready public claim should be:

- Wedge clarity: `4+`
- Institutional data readiness: `3+`
- Model governance: `3+`
- Verification / reproducibility: `4+`
- Public-surface discipline: `4+`
- Operational readiness: `4+`

CERNIQ does not yet meet that threshold.
