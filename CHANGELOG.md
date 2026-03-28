# Changelog

All notable changes to CerniQ are documented in this file.

## [1.0.0] — 2026-03-28

### Added
- **62 ALM analysis modules** — Duration Gap, NII Sensitivity, EVE, LCR/NSFR, Monte Carlo (Vasicek), VaR/CVaR, Black-Scholes Greeks, Black-Litterman, HRP, CECL, Concentration Risk, FRTB-IMA, KMV-Merton, PCA Yield Curve, Copula Credit, and 47 more
- **Bilingual platform** (EN/ES) with context-based translation provider
- **Multi-tenant RBAC** — OWNER, ANALYST, VIEWER roles per institution
- **Stripe billing** — one-time, monthly, annual, partner tiers with webhook idempotency
- **Board-ready PDF reports** with print stylesheet
- **Outbound sales engine** — 6 autonomous agents targeting 109 PR cooperativas
- **Client portal** — upload balance sheets, track report progress via WebSocket
- **API v1** with OpenAPI/Swagger docs, API key auth, rate limit headers
- **COSSEC/NCUA regulatory compliance** built into ALM calculations
- **Real-time data** — Socket.IO for live pricing and report progress

### Security
- Helmet CSP with per-request nonce, HSTS preload, X-Frame-Options: DENY
- XSS sanitization pipe (global)
- Per-user rate limiting (Redis sliding window)
- AES-256-GCM data encryption for PII at rest
- Stripe webhook signature verification + event deduplication
- Open redirect prevention in checkout URLs
- API key expiry warnings (X-API-Key-Expires-In-Days header)
- GDPR/CCPA/PR-ACT-81 data deletion support

### Infrastructure
- NestJS 11 + TypeScript 5.9 (strict mode: strictNullChecks + noImplicitAny)
- Next.js 16 + React 19 frontend
- PostgreSQL 15 with Prisma 7 ORM (Decimal precision for all financial fields)
- Redis 7 with graceful degradation
- Sentry + OpenTelemetry observability
- Docker multi-stage builds with health checks
- Railway (backend) + Vercel (frontend) deployment
- GitHub Actions CI/CD with typecheck, test, and audit gates

### Data Integrity
- 46 financial fields use Decimal (not Float) for IEEE 754 precision
- 38 database indexes for query performance
- 30 models have updatedAt audit trail
- 8 cascade delete rules prevent orphaned records
- 3 unique constraints on natural keys prevent duplicates

---

## [0.1.0] — 2026-01-15

### Added
- Initial NestJS backend with ALM core (Duration Gap, NII, EVE, LCR)
- Next.js frontend with ALM dashboard
- Supabase JWT authentication
- CSV balance sheet ingestion
