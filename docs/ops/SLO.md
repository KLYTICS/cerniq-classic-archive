# CERNIQ Service Level Objectives (SLOs)

**Version:** 1.0
**Date:** 2026-04-17
**Audience:** Operators, enterprise customers, procurement teams
**Review cadence:** Quarterly — Jan/Apr/Jul/Oct

This document defines the user-facing reliability contract for the CERNIQ
platform. It is the source of truth when discussing availability,
latency, and error rates with enterprise customers and regulators.

## Why SLOs, not SLAs

- **SLO** = the **target** we commit to internally. We measure, track, and
  burn error budget against it.
- **SLI** = the **indicator** — the specific metric that tracks an SLO.
- **SLA** = a **contractual** promise to customers (typically 1-2 nines
  lower than the SLO to give engineering room to operate).

CERNIQ publishes SLOs so customers know what to expect operationally.
Enterprise contracts MAY include SLA clauses with remediation credits,
but the SLA is always derived from the SLO with safety margin.

## Top-level SLOs

| Service | Availability SLO | Latency SLO (p95) | Error Budget / 30d |
|---|---|---|---|
| **API (backend)** | 99.5% | 500ms | 3h 36m downtime |
| **Frontend (Vercel)** | 99.9% | TTFB < 800ms | 43m 12s |
| **Agent Execution Layer** | 99.0% | p95 run < 30s | 7h 12m |
| **COSSEC PDF Parser** | 99.0% | p95 parse < 10s | 7h 12m |
| **Report Generation** | 99.5% | p95 generate < 60s | 3h 36m |
| **Database (Railway Postgres)** | 99.95% ⬆ | p99 query < 100ms | 21m 36s |
| **Email Delivery (Resend)** | 99.0% | Median delivery < 60s | 7h 12m |

⬆ = stricter than app tier because DB downtime cascades.

## SLIs (how we measure)

### API availability SLI

**Numerator:** successful responses (status 2xx, 3xx, 4xx — client errors
count as successes because the service is up).
**Denominator:** all responses (2xx + 3xx + 4xx + 5xx, excluding 429
which is rate-limit-by-design).

**Instrumentation:** `@sentry/nestjs` auto-captures HTTP transactions.
Custom `CorrelationInterceptor` in `src/common/interceptors/` emits
`X-Response-Time` header — scraped by Railway metrics + Sentry.

**Alert:** Pino logs `statusCode=5xx` at rate > 0.5% over 15 minutes →
PagerDuty SEV-2.

### API latency SLI

**Metric:** p95 response time across all authenticated endpoints in the
`/api/v1/**` namespace, excluding `/api/v1/agents/**/run` and `/copilot`
(those have their own latency SLO because LLM calls dominate).

**Measurement window:** rolling 1 hour.

**Instrumentation:** `PerformanceInterceptor` (src/common/interceptors/)
+ `Server-Timing` response header. OpenTelemetry spans emit latency
as `http.server.duration` histogram.

**Alert:** p95 > 500ms for 15 minutes → SEV-3 investigation. Hit rate
and origin (slow Prisma query? slow Anthropic call?) differentiate
next steps.

### Agent Execution Layer SLO

**Numerator:** runs where `status = 'SUCCEEDED'` AND `completed_at -
created_at < 30s`.
**Denominator:** all runs NOT in state `CANCELLED` (user cancellation
doesn't count against us).

**Why 99% not 99.5%:** LLM calls depend on Anthropic's API. Their
published SLA is 99.0% (production) — we can't do better than our
upstream. At 99.0% we're pass-through honest.

**Graceful degradation:** when Anthropic is unreachable, agents fall
back to local-only mode (reported in response as
`fallback: 'local_data_only'`). These are counted as SUCCEEDED against
the SLI because the user gets a usable response.

### Report generation SLO

**Numerator:** report artifacts with status `READY` in < 60s from job
enqueue.
**Denominator:** all report jobs NOT in state `CANCELLED`.

**Why stricter than Agent Layer:** reports are deterministic (no LLM),
and the 60s budget accommodates PDF rendering + Excel export + any
database reads. If a report exceeds 60s, it's almost always a slow
Prisma query.

### Database SLO

**Numerator:** query executions without 5xx Prisma errors AND with
duration < 100ms.
**Denominator:** all Prisma query executions.

**Why 99.95%:** Railway's managed Postgres targets 99.95% availability.
We inherit that ceiling; our SLO matches.

## Error budget math

Error budget = (1 − SLO) × time window.

| Service | SLO | 30d budget |
|---|---|---|
| API | 99.5% | 3h 36m 0s |
| Frontend | 99.9% | 43m 12s |
| Agent Layer | 99.0% | 7h 12m |
| Database | 99.95% | 21m 36s |

**Policy:** when 50% of the monthly budget is consumed (50% burn rate
over a week), freeze new feature deploys until budget stabilizes.
Security patches + CVE remediations ALWAYS deploy regardless of budget.

## Latency SLOs — agent endpoints (separate)

Agent endpoints have their own latency contract because LLM calls
dominate and vary by prompt complexity:

| Endpoint | Latency SLO (p95) | Budget basis |
|---|---|---|
| `POST /api/v1/agents/:id/run` (ALM_DECISION) | 30s | Full LLM loop + tool calls |
| `POST /api/v1/agents/:id/copilot` | 15s | Single-turn query |
| `POST /api/v1/agents/:id/stress-test` | 45s | Multi-scenario Monte Carlo |
| `POST /api/alm/:id/report` (PDF) | 60s | 7-section bilingual PDF |
| `GET /api/v1/agents/:id/runs` (list) | 300ms | Paginated DB read |
| `GET /api/v1/agents/:id/cost` | 200ms | Aggregation query |
| `SSE /api/v1/agents/:id/stream` | TTFB < 500ms | First event out the door |

## Error rate SLOs

| Category | Target | Alert threshold |
|---|---|---|
| 5xx errors | < 0.5% of requests | > 1% for 15min |
| 401/403 errors | < 3% | > 10% for 15min (auth config drift) |
| Agent run failures (FAILED status) | < 2% | > 5% over 1h |
| Webhook delivery failures (Stripe) | < 0.1% | > 1% over 1h |
| Email delivery failures (Resend) | < 0.5% | > 2% over 1h |

## Measurement windows

- **Fast window (ops):** 1 hour rolling — catches acute incidents
- **SLO window (reports):** 30 days rolling — what customers see
- **Budget window (policy):** calendar month — freeze/release decisions

## Observability stack mapping

| SLO | Primary source | Secondary |
|---|---|---|
| API availability | Sentry (HTTP transactions) | Railway service metrics |
| API latency | OTel `http.server.duration` | `X-Response-Time` header logs |
| Agent success rate | `agent_runs.status` DB aggregation | Sentry `agent_runner.*` breadcrumbs |
| DB query latency | Pino `SlowRequestInterceptor` (threshold 250ms) | Railway Postgres metrics |
| Email delivery | Resend dashboard | Pino `email.send` logs |
| Frontend TTFB | Vercel Analytics | Sentry browser SDK |

## Reporting

- **Internal weekly report:** auto-generated Monday 08:00 AST via
  `scripts/slo-report.mjs` (TODO — not yet built; first manual report
  scheduled for 2026-05-04). Content: all SLOs + burn rate + incidents.
- **Customer-facing status page:** status.cerniq.io (planned — currently
  using Railway's public status page as proxy).
- **Quarterly SLO review:** Jan/Apr/Jul/Oct. Adjust targets based on:
  - Customer feedback / escalations
  - Observed actual performance
  - Infrastructure changes (e.g., Railway region additions)

## Customer-facing SLA derivation

Enterprise contracts include SLAs ≥ 1 nine below the SLO for safety
margin. For example, if the API SLO is 99.5%, the customer SLA is
typically 99.0% with remediation credits:

| SLA tier | Credit per 0.1% below | Max credit / month |
|---|---|---|
| Uptime 99.0% | 5% of MRR | 50% of MRR |
| Uptime 99.5% | 10% of MRR | 100% of MRR |

(Per the master services agreement — engineering does not negotiate
these; sales + legal do. Engineering's job is to stay well above the
SLO so the SLA never triggers.)

## Incident → SLO mapping

When an incident fires (see [INCIDENT_RUNBOOK.md](INCIDENT_RUNBOOK.md)),
the post-mortem must include:

1. **SLOs impacted:** which targets were breached?
2. **Budget consumed:** how much of the monthly error budget did this
   incident burn?
3. **Remaining budget:** is there enough left to safely ship features
   this month, or do we freeze?
4. **Root cause vs SLO class:** was this an availability incident
   (5xx), latency incident (slow), or correctness incident (wrong
   data)?

## Known SLO-impacting dependencies

| Dependency | Impact | Mitigation |
|---|---|---|
| Anthropic API | 99.0% pass-through cap on Agent Layer | Graceful fallback to data-only mode |
| Railway DB | 99.95% inherited cap on DB SLO | 4h RTO via Railway PITR |
| Vercel edge | 99.99% pass-through for frontend | Static-first architecture |
| Resend | Email delivery only — no critical path dep | Retries + fallback logger |
| Stripe | Payment flow only | Webhook replay + idempotency |

## 📂 Related

- [INCIDENT_RUNBOOK.md](INCIDENT_RUNBOOK.md) — when an SLO burns
- [disaster_recovery.md](disaster_recovery.md) — when a service fails completely
- [LLM_COST_INCIDENT.md](LLM_COST_INCIDENT.md) — specific to Agent Layer cost breaches
- [deployment_runbook.md](deployment_runbook.md) — deployment freeze policy
