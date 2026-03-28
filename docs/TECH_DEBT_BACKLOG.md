# CERNIQ — Technical Debt Backlog

> **Generated:** 2026-03-28
> **Baseline:** 461 tests, 0 TS errors, noImplicitAny + strictNullChecks enabled, production stable

---

## Priority 1 — Controller Test Coverage

**268 controller routes** across 13 controllers have no spec files. These represent the HTTP layer — request parsing, auth guard enforcement, response formatting.

| Controller | Routes | Risk | Notes |
|-----------|--------|------|-------|
| `alm.controller.ts` | 142 | CRITICAL | Core product — ALM analysis pipeline |
| `leads.controller.ts` | 18 | HIGH | Sales pipeline (but has admin key guards) |
| `expenses.controller.ts` | 15 | MEDIUM | SpendCheck product line |
| `market-data.controller.ts` | 11 | MEDIUM | Real-time data (public endpoints) |
| `portfolio.controller.ts` | 8 | MEDIUM | Portfolio management |
| `risk.controller.ts` | 8 | MEDIUM | Risk analytics |
| `options.controller.ts` | 7 | LOW | Has service-level tests |
| `organizations.controller.ts` | 6 | MEDIUM | Multi-tenant (has service spec) |
| `pipeline.controller.ts` | 6 | LOW | Admin-only |
| `execution.controller.ts` | 6 | LOW | Trading analytics |
| `ticker.controller.ts` | 6 | LOW | Ticker management |
| `api-v1.controller.ts` | 6 | LOW | Has API key guards |
| `valuation.controller.ts` | 6 | LOW | Valuation analytics |

**Recommendation:** Start with ALM controller — write specs for the top 10 routes (institution CRUD, CSV upload, analysis run, report generation). This covers the primary revenue flow.

---

## Priority 2 — Backend E2E Tests Not in CI

4 E2E spec files exist but are **not run in the CI pipeline**:

- `test/alm.e2e-spec.ts` — ALM flow end-to-end
- `test/auth.e2e-spec.ts` — Auth flow end-to-end
- `test/security.e2e-spec.ts` — Security boundary tests
- `test/app.e2e-spec.ts` — API integration tests

These require a running Postgres + Redis. Add a CI job that spins up services (like `backend-test` does) and runs E2E specs.

---

## Priority 3 — Frontend Unit Test Expansion

35 tests across 4 files for a 43-page app. Critical untested pages:

| Page | Lines | Why |
|------|-------|-----|
| `portal/submit/page.tsx` | 577 | CSV upload + validation — data integrity risk |
| `onboarding/page.tsx` | ~300 | Subscription check + routing — lost customers risk |
| `admin/leads/page.tsx` | ~400 | Pipeline management — sales operations |
| `demo/embed/page.tsx` | ~200 | Auto-register + analysis — first impression |

---

## Priority 4 — Enrichment API Integration

2 TODOs in outbound engine for external enrichment APIs:
- Hunter.io domain search — `services/outbound/agents/enrichment_agent.py:94`
- Apollo.io people search — `services/outbound/agents/enrichment_agent.py:105`

Currently falls back to pattern-based email generation. Works but has lower deliverability.

---

## Priority 5 — Enterprise Security (Future)

From Fortune 500 audit (March 2026):

| Gap | Status | Effort |
|-----|--------|--------|
| Mandatory PII encryption at DB level | Available (AES-256-GCM service exists) but not enforced | 2-3 weeks |
| JWT key versioning for zero-downtime rotation | Not implemented | 1-2 weeks |
| Immutable audit log (append-only storage) | Audit logs in regular table | 1 week |
| Input sanitization library upgrade | Custom pipe → DOMPurify | 2-3 days |
| Concurrent session limits | ✅ Done (max 5) | — |
| Audit trail failure logging | ✅ Done | — |
| GDPR SAR export complete | ✅ Done (institutions, subscriptions, expenses) | — |
| Disaster recovery runbook | ✅ Done (docs/ops/disaster_recovery.md) | — |

---

## Resolved This Session (March 28, 2026)

- ✅ noImplicitAny enabled (0 violations)
- ✅ strictNullChecks enabled (0 violations)
- ✅ 461 tests across 3 services (was 257)
- ✅ Webhook idempotency + all 8 event types tested
- ✅ Auth controller: 15 tests (register, login, refresh, logout, API keys)
- ✅ Outbound engine: 82 tests (was 0) — all 6 agents covered
- ✅ 7 error boundaries + 12 loading skeletons
- ✅ npm audit: 0 frontend vulnerabilities
- ✅ Console.log leaks cleaned
- ✅ Health-check.sh envelope parsing fixed
- ✅ Runbook fully audited and corrected
- ✅ 3 .env.example files created
- ✅ API Reference updated with ALM endpoints
- ✅ ENVIRONMENT.md updated (stale ports, new vars)
- ✅ DR runbook created
- ✅ Production 10/10 health, 22h uptime

---

*Next session: Start with ALM controller tests (Priority 1) or E2E CI integration (Priority 2).*
