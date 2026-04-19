# Part XII — Appendices

> API Fixtures · Environment Variables · Glossary · Tech Debt · Document History
> **Last updated:** April 2026

---

## Appendix A — API Fixture Reference

These JSON files live at `apple/Fixtures/` and are used by `CerniqContractsCheck` for deterministic API contract verification. They represent the exact response shapes the Swift client expects.

### auth-login.json
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "user_123",
      "email": "ana@coop.pr",
      "name": "Ana Rivera",
      "workspaceId": "ws_123",
      "workspaceName": "CoopAhorro Workspace",
      "subscriptionTier": "annual"
    },
    "accessToken": "at_123",
    "refreshToken": "rt_123"
  }
}
```

### auth-profile.json
```json
{
  "success": true,
  "data": {
    "id": "user_123",
    "email": "ana@coop.pr",
    "name": "Ana Rivera",
    "workspaceId": "ws_123",
    "workspaceName": "CoopAhorro Workspace",
    "subscriptionTier": "annual"
  }
}
```

### institutions.json
```json
{
  "success": true,
  "data": [
    {
      "id": "inst_123",
      "name": "CoopAhorro San Juan",
      "type": "cooperativa",
      "totalAssets": 250000000,
      "reportingDate": "Q1-2026"
    },
    {
      "id": "inst_456",
      "name": "CoopAhorro Ponce",
      "type": "cooperativa",
      "totalAssets": 180000000,
      "reportingDate": "Q1-2026"
    }
  ]
}
```

### alm-summary.json
```json
{
  "success": true,
  "data": {
    "institutionId": "inst_123",
    "durationGap": 1.8,
    "riskRating": "asset-sensitive",
    "liquidityCoverageRatio": 115.5,
    "netInterestMargin": 3.15
  }
}
```

### portal-settings.json
```json
{
  "success": true,
  "data": {
    "workspaceName": "CoopAhorro Workspace",
    "subscriptionTier": "annual",
    "institutionName": "CoopAhorro San Juan",
    "institutionType": "cooperativa"
  }
}
```

### Fixture Governance Rules
- **No real PII** — fixture user `ana@coop.pr` and institution `CoopAhorro San Juan` are fictional
- **No real tokens** — `at_123`, `rt_123` are synthetic placeholder values
- **Update protocol** — when API shape changes, regenerate fixture from staging env, review for PII, commit alongside contract check update
- **Naming convention** — `{api-resource}-{action}.json` (e.g., `alm-summary.json`, `auth-login.json`)

---

## Appendix B — Environment Variables — Complete Reference

### backend-node

| Variable | Required | Secret | Default | Description |
|----------|----------|--------|---------|-------------|
| `DATABASE_URL` | ✅ | 🔒 | — | PostgreSQL connection string |
| `REDIS_URL` | ✅ | 🔒 | — | Redis connection string |
| `JWT_SECRET` | ✅ | 🔒 | — | HS256 JWT signing secret (dev only; RS256 via Supabase in prod) |
| `JWT_EXPIRATION` | ✅ | — | `15m` | Access token expiry |
| `REFRESH_TOKEN_EXPIRATION` | ✅ | — | `7d` | Refresh token expiry |
| `SUPABASE_URL` | ✅ | 🔒 | — | Supabase project URL for JWT verification |
| `SUPABASE_ANON_KEY` | ✅ | 🔒 | — | Supabase anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | 🔒 | — | Supabase service role key — full DB access |
| `STRIPE_SECRET_KEY` | ✅ | 🔒 | — | `sk_test_...` (dev) / `sk_live_...` (prod) |
| `STRIPE_PUBLISHABLE_KEY` | ✅ | — | — | `pk_test_...` / `pk_live_...` |
| `STRIPE_WEBHOOK_SECRET` | ✅ | 🔒 | — | `whsec_...` — webhook signature verification |
| `OPENAI_API_KEY` | ✅ | 🔒 | — | OpenAI API key for GPT-4o |
| `OPENAI_MODEL` | — | — | `gpt-4o` | Model override |
| `OLLAMA_BASE_URL` | — | — | `http://localhost:11434` | Ollama fallback URL |
| `CLOUDFLARE_R2_ACCESS_KEY_ID` | ✅ | 🔒 | — | R2 access key ID |
| `CLOUDFLARE_R2_SECRET_ACCESS_KEY` | ✅ | 🔒 | — | R2 secret access key |
| `CLOUDFLARE_R2_BUCKET_NAME` | ✅ | — | `cerniq-reports` | R2 bucket name |
| `CLOUDFLARE_ACCOUNT_ID` | ✅ | — | — | Cloudflare account ID (for presigned URLs) |
| `CLOUDFLARE_R2_ENDPOINT` | ✅ | — | — | R2 S3-compatible endpoint URL |
| `RESEND_API_KEY` | ✅ | 🔒 | — | Resend transactional email API key |
| `RESEND_FROM_EMAIL` | ✅ | — | `noreply@cerniq.io` | Sender email address |
| `ADMIN_API_KEY` | ✅ | 🔒 | — | Admin endpoint auth — SHA-256 hashed in DB |
| `PORT` | — | — | `3000` | Server port |
| `NODE_ENV` | ✅ | — | `development` | `development` / `production` |
| `FRONTEND_URL` | ✅ | — | `http://localhost:3001` | CORS + redirect origin |
| `BCRYPT_ROUNDS` | — | — | `12` | bcrypt cost factor for password hashing |

### frontend

| Variable | Required | Secret | Default | Description |
|----------|----------|--------|---------|-------------|
| `NEXT_PUBLIC_API_URL` | ✅ | — | `http://localhost:3000` | Backend API URL (proxied via /api/* rewrite in prod) |
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ | — | — | Supabase URL for client-side auth |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ | — | — | Supabase anon key (safe for browser) |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | ✅ | — | — | Stripe publishable key for checkout |
| `NEXT_PUBLIC_SITE_URL` | ✅ | — | `http://localhost:3001` | Full site URL for OG tags, redirects |
| `SENTRY_DSN` | — | — | — | Sentry DSN for frontend error tracking |
| `NEXT_PUBLIC_POSTHOG_KEY` | — | — | — | PostHog analytics key |

### Apple App (no .env — managed via CerniqAppState + Keychain)

| Data | Storage | Notes |
|------|---------|-------|
| Selected environment | UserDefaults | `cerniq.apple.selected-environment` |
| Custom base URL | UserDefaults | `cerniq.apple.custom-base-url` |
| Access token | Keychain | Service: `io.cerniq.apple`, Account: `access-token` |
| Refresh token | Keychain | Service: `io.cerniq.apple`, Account: `refresh-token` |
| Bundle ID (macOS) | Info.plist | `io.cerniq.macos` |
| Bundle ID (iOS) | Info.plist | `io.cerniq.ios` |

---

## Appendix C — Glossary

| Term | Definition |
|------|-----------|
| **ALM** | Asset-Liability Management — the practice of managing financial institution risks arising from mismatches between assets and liabilities in terms of duration, rate sensitivity, and liquidity |
| **COSSEC** | Corporación de Supervisión y Seguro de Cooperativas de Puerto Rico — Puerto Rico's cooperativa regulatory and supervisory body |
| **NCUA** | National Credit Union Administration — US federal credit union regulator; Form 5300 is the quarterly call report |
| **Cooperativa** | Puerto Rico cooperative financial institution — member-owned credit cooperative regulated by COSSEC |
| **Duration Gap** | Asset duration minus liability duration; positive = asset-sensitive (benefits from rate increases), negative = liability-sensitive (benefits from rate decreases) |
| **NII Sensitivity** | Net Interest Income sensitivity to rate changes; measures income impact of parallel rate shocks |
| **EVE** | Economic Value of Equity — present value of assets minus present value of liabilities; measures long-term rate risk impact on institution net worth |
| **LCR** | Liquidity Coverage Ratio — Basel III metric; HQLA / Net Cash Outflows over 30-day stress period; regulatory minimum 100% |
| **NSFR** | Net Stable Funding Ratio — Available Stable Funding / Required Stable Funding; measures structural liquidity over 1 year |
| **BPV** | Basis Point Value — price change per 1bp (0.01%) rate movement; measures absolute interest rate exposure |
| **Monte Carlo** | Stochastic simulation generating 10,000 interest rate paths using the Vasicek model; used for distribution of ALM outcomes under uncertainty |
| **Vasicek Model** | Mean-reverting single-factor short-rate model: dr = κ(θ-r)dt + σdW; parameters calibrated quarterly |
| **CECL** | Current Expected Credit Loss — FASB ASC 326 accounting standard requiring forward-looking loan loss provisioning |
| **KMV-Merton** | Structural default model (Merton 1974) treating equity as a call option on assets; computes distance to default |
| **HRP** | Hierarchical Risk Parity — portfolio optimization using hierarchical clustering; avoids covariance matrix inversion; more robust for small sample sizes |
| **CVaR** | Conditional Value at Risk (also: Expected Shortfall) — expected loss beyond the VaR threshold; coherent risk measure |
| **CAMEL** | Capital, Assets, Management, Earnings, Liquidity — supervisory rating system used by COSSEC and NCUA |
| **FRTB** | Fundamental Review of the Trading Book — Basel IV market risk framework; IMA = Internal Models Approach |
| **SPM** | Swift Package Manager — Apple's dependency management and build system for Swift packages |
| **WKWebView** | WebKit-based web rendering component on Apple platforms; used to embed the CERNIQ Next.js web app in native shell |
| **ALMRouteStyle** | CERNIQ-specific enum tracking discrepancy between frontend-observed API routes and formally documented API routes; used in CerniqContractsCheck |
| **CerniqAppState** | The `@Observable` singleton managing environment, destination, and browser state in the macOS and iOS apps; backed by UserDefaults |
| **CredentialStore** | Swift protocol abstracting token persistence; `InMemoryCredentialStore` for tests, `KeychainCredentialStore` for production |
| **CerniqContractsCheck** | Executable Swift target that verifies API contracts against JSON fixtures; the primary CI verification entry point for the Apple platform |
| **ReportJob** | Backend Prisma model tracking the lifecycle of an ALM report generation: `AWAITING_DATA → PROCESSING → GENERATING_PDF → COMPLETE` |
| **Presigned URL** | Time-limited, pre-authenticated URL for direct access to a Cloudflare R2 object; 7-day expiry; no bucket credentials needed for download |
| **Session coordination** | CERNIQ multi-engineer session management system (`npm run session:*`) preventing simultaneous edits to the same module |
| **Swarm** | CERNIQ internal AI agent fleet (`npm run swarm:*`) for automated development, testing, and operations tasks |

---

## Appendix D — Tech Debt Registry

| Item | Severity | Effort | Description | Owner |
|------|----------|--------|-------------|-------|
| `LiveWorkspaceOverviewService` sequential awaits | Medium | S | 4 API calls run sequentially; should use `async let` or `TaskGroup` for concurrent fan-out | iOS team |
| `InMemoryCredentialStore` in SPM shell | Low | XS | `CerniqMacApp.swift` uses `InMemoryCredentialStore` — tokens not persisted across launches. Acceptable for shell; must use `KeychainCredentialStore` in Xcode targets | iOS team |
| `swift test` inconsistent on CLT-only | Low | M | XCTest not reliably available without full Xcode install; `CerniqContractsCheck` is a workaround; needs proper XCTest suites once Xcode installed | iOS team |
| Missing refresh token contract fixture | Medium | XS | `POST /api/auth/refresh` has no fixture in `apple/Fixtures/`; contract not verified | iOS + Backend |
| Missing report job fixtures | Medium | S | Portal report lifecycle (`/api/portal/reports/generate`, `/api/portal/reports`) not covered by `CerniqContractsCheck` | iOS + Backend |
| `any` types in backend | Medium | M | Several NestJS service methods use `any` for dynamic Prisma queries; should be replaced with discriminated unions | Backend team |
| Redis session TTL not set | High | S | Some session keys written to Redis without explicit TTL; could accumulate indefinitely | Backend team |
| Ollama fallback not tested in CI | Low | S | No automated test verifying Ollama fallback behavior when OpenAI is unavailable | AI team |
| No rate limit on WebSocket connections | Medium | M | Socket.IO gateway has no connection rate limit; susceptible to DoS | DevOps + Backend |
| Missing APM on Apple app | Low | M | No crash reporting or performance monitoring on macOS/iOS; Sentry not integrated yet | DevOps + iOS team |

---

## Appendix E — Key External Resources

| Resource | URL | Purpose |
|----------|-----|---------|
| COSSEC Official | cossec.gobierno.pr | Puerto Rico cooperativa regulatory authority |
| NCUA | ncua.gov | Form 5300 specifications, examination guidance |
| NestJS Docs | docs.nestjs.com | Backend framework reference |
| Prisma Docs | prisma.io/docs | ORM + schema reference |
| Next.js Docs | nextjs.org/docs | Frontend framework reference |
| SwiftUI Docs | developer.apple.com/documentation/swiftui | Apple UI framework |
| Swift Package Manager | swift.org/documentation/package-manager | SPM manifest reference |
| WKWebView Docs | developer.apple.com/documentation/webkit/wkwebview | WebKit integration |
| App Store Review Guidelines | developer.apple.com/app-store/review/guidelines | Submission requirements |
| Railway Docs | docs.railway.app | Backend deployment reference |
| Vercel Docs | vercel.com/docs | Frontend deployment + edge config |
| Cloudflare R2 Docs | developers.cloudflare.com/r2 | Object storage + presigned URLs |
| Stripe Docs | stripe.com/docs | Billing integration |
| Resend Docs | resend.com/docs | Email delivery |
| OpenAI API Docs | platform.openai.com/docs | LLM API + fine-tuning |

---

## Appendix F — Document History

| Version | Date | Author | Summary |
|---------|------|--------|---------|
| 1.0 | April 2026 | CERNIQ Engineering | Initial release — full codebase analysis. 12 parts covering macOS/iOS, backend, frontend, AI, DevOps, design, product roadmap, testing, onboarding, appendices. Path to $10M MRR strategy. |

---

*KLYTICS LLC · San Juan, Puerto Rico · Proprietary & Confidential · [cerniq.io](https://cerniq.io)*
