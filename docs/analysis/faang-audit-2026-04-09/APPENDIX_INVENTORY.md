# CERNIQ FAANG Audit — Appendix Inventory

Date: 2026-04-09

## A. Count Reconciliation

Measured during this audit:

- `frontend/app` contains `157` `page.tsx` files.
- `frontend/app` contains `235` route/page/layout files when counting `page.tsx`, `layout.tsx`, and `route.ts`.
- `frontend/lib/alm/registry.ts` currently contains `101` `slug:` entries.

Observed published counts:

- `62 ALM modules` in [`README.md`](../../../README.md) and several marketing/sales surfaces
- `142 API endpoints` in [`frontend/app/pricing/page.tsx`](../../../frontend/app/pricing/page.tsx) and [`frontend/app/why-cerniq/page.tsx`](../../../frontend/app/why-cerniq/page.tsx)
- `170+ quant models` in [`frontend/app/layout.tsx`](../../../frontend/app/layout.tsx), [`frontend/app/page.tsx`](../../../frontend/app/page.tsx), and [`frontend/app/why-cerniq/page.tsx`](../../../frontend/app/why-cerniq/page.tsx)
- `200+ modules` in [`frontend/app/layout.tsx`](../../../frontend/app/layout.tsx) and [`frontend/app/page.tsx`](../../../frontend/app/page.tsx)

Conclusion: published numerics are not reconciled and should not be treated as canonical.

## B. Public Surface Inventory

Top-level visible route families under `frontend/app` during this audit:

- `(marketing)`
- `access-required`
- `admin`
- `ai-insights`
- `alm`
- `auth`
- `backtest`
- `case-studies`
- `changelog`
- `charts`
- `close`
- `compliance`
- `contact`
- `dashboard`
- `demo`
- `demo-video`
- `developers`
- `execution-quality`
- `expenses`
- `factor-risk`
- `get-started`
- `live-data`
- `login`
- `onboarding`
- `options`
- `pablo`
- `portal`
- `portfolios`
- `preview`
- `pricing`
- `privacy`
- `reseller`
- `reset-password`
- `risk-analytics`
- `risk-parity`
- `roi`
- `security`
- `settings`
- `signup`
- `spendcheck`
- `status`
- `strategy`
- `stress-test`
- `terms`
- `thank-you`
- `var-reports`
- `volatility`
- `volatility-analytics`
- `why-cerniq`

Recommended public classification:

### Core

- `alm`
- `portal`
- `pricing`
- `page.tsx` landing
- `demo`
- `onboarding`
- `login`
- `signup`
- `security`
- `status`

### Adjacent but Supportable

- `case-studies`
- `roi`
- `preview`
- `reseller`
- `compliance`

### Internal / Demo Only

- `admin`
- `dashboard`
- `close`
- `demo-video`
- `thank-you`
- `pablo`

### Premature Public Platform

- `developers`
- `backtest`
- `options`
- `risk-analytics`
- `risk-parity`
- `var-reports`
- `volatility`
- `volatility-analytics`
- `live-data`
- `execution-quality`
- `portfolios`
- `expenses`
- `spendcheck`
- `factor-risk`
- `ai-insights`

## C. Key Docs Inventory

### Canonical / High-Value for Current Wedge

- [`README.md`](../../../README.md)
- [`docs/strategy/value_proposition.md`](../../strategy/value_proposition.md)
- [`docs/strategy/problem_map.md`](../../strategy/problem_map.md)
- [`docs/models/model_inventory.md`](../../models/model_inventory.md)
- [`docs/CERNIQ_ENTERPRISE_REPO_BASELINE.md`](../../CERNIQ_ENTERPRISE_REPO_BASELINE.md)
- [`docs/ops/REPO_GREEN_CHECKLIST.md`](../../ops/REPO_GREEN_CHECKLIST.md)
- [`docs/ops/e2e_production_gate.md`](../../ops/e2e_production_gate.md)

### Useful But Drift-Prone or Broader Than Current Truth

- [`docs/CERNIQ_LIVE_AUDIT.md`](../../CERNIQ_LIVE_AUDIT.md)
- [`docs/QUANT_MODELS_BIBLE.md`](../../QUANT_MODELS_BIBLE.md)
- [`docs/GTM_PRODUCT_BIBLE.md`](../../GTM_PRODUCT_BIBLE.md)
- [`docs/ALM_ARCHITECTURE.md`](../../ALM_ARCHITECTURE.md)
- [`docs/analysis/API_CONTRACT_REFERENCE.md`](../../analysis/API_CONTRACT_REFERENCE.md)

## D. Trust-Layer Controls Inventory

Existing repo-backed controls:

- `AnalysisRun` persistence in [`backend-node/prisma/schema.prisma`](../../../backend-node/prisma/schema.prisma)
- `IngestionLog` persistence in [`backend-node/prisma/schema.prisma`](../../../backend-node/prisma/schema.prisma)
- `ReportJob` persistence in [`backend-node/prisma/schema.prisma`](../../../backend-node/prisma/schema.prisma)
- `AuditLog` persistence in [`backend-node/prisma/schema.prisma`](../../../backend-node/prisma/schema.prisma)
- ALM drift test in [`backend-node/src/alm/golden-reconciliation.spec.ts`](../../../backend-node/src/alm/golden-reconciliation.spec.ts)
- report preflight in [`backend-node/src/alm/reports/report-preflight.service.ts`](../../../backend-node/src/alm/reports/report-preflight.service.ts)
- CI/CD release workflow in [`.github/workflows/ci-cd.yml`](../../../.github/workflows/ci-cd.yml)
- ALM quality gate in [`.github/workflows/alm-quality-gate.yml`](../../../.github/workflows/alm-quality-gate.yml)

Missing or incomplete controls:

- formal model registry
- governed scenario library
- governed curve / benchmark dataset entities
- immutable report artifact bound to one analysis run
- stable snapshot semantics for report generation

## E. Institutional Data Inventory

| Dataset / Input | Where Found | Mode | As-Of / Refresh Semantics | Governance Readiness |
| --- | --- | --- | --- | --- |
| PR cooperativa sector benchmarks | [`backend-node/src/alm/benchmarks/pr-cooperativa-benchmarks.ts`](../../../backend-node/src/alm/benchmarks/pr-cooperativa-benchmarks.ts) | static code constant | `lastUpdated: 2025-Q3`, quarterly update comment | low |
| PR beta benchmarks | [`backend-node/src/alm/data/pr-beta-benchmarks.json`](../../../backend-node/src/alm/data/pr-beta-benchmarks.json) | static JSON | metadata includes period and `lastUpdated` | low |
| Saved scenarios | [`backend-node/src/alm/scenarios/scenario-persistence.service.ts`](../../../backend-node/src/alm/scenarios/scenario-persistence.service.ts) | persisted app records | created-at based, user/application saved | medium for app utility, low for governance |
| Base yield curve | [`backend-node/src/alm/yield-curve.service.ts`](../../../backend-node/src/alm/yield-curve.service.ts) | hard-coded fallback plus DB lookup | default curve is approximate March 2026; custom base curves can be saved | low |
| Analysis-run parameter snapshots | [`backend-node/src/alm/analysis-runs.service.ts`](../../../backend-node/src/alm/analysis-runs.service.ts) | persisted run metadata | saved at run creation | medium |
| Market data / quotes | [`docs/ARCHITECTURE.md`](../../ARCHITECTURE.md), [`docs/CERNIQ_LIVE_AUDIT.md`](../../CERNIQ_LIVE_AUDIT.md) | external provider backed | provider-dependent with graceful degradation | medium operational utility, low governance |

## F. Verification Notes

Backend trust-layer verification run during this audit:

```bash
cd backend-node && npx jest \
  src/alm/golden-reconciliation.spec.ts \
  src/alm/reports/report-preflight.service.spec.ts \
  src/alm/analysis-runs.service.spec.ts \
  --runInBand
```

Result:

- `3` suites passed
- `19` tests passed

Frontend root-level spot-check note:

```bash
npx vitest run frontend/lib/api.test.ts frontend/app/portal/page.test.tsx
```

This was not a reliable repo-wide audit signal from root because it discovered `.omx` worktree duplicates and hit browser-environment assumptions. Canonical frontend verification should follow [`docs/ops/REPO_GREEN_CHECKLIST.md`](../../ops/REPO_GREEN_CHECKLIST.md) and run from the intended working directory.
