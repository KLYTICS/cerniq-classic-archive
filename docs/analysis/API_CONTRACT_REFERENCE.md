# API Contract Reference

> Derived from implementation source code. Generated 2026-03-15.
> Source: `backend-node/src/` controllers, DTOs, guards, interceptors, Prisma schema.

## Executive Summary

The CERNIQ backend exposes **113 confirmed HTTP endpoints** across **22 controller files** organized into 16 functional modules. The API spans five product domains:

1. **Financial Analytics** -- Market data, valuation, options pricing, risk analytics, execution quality
2. **ALM (Asset-Liability Management)** -- Enterprise ALM for cooperativas and banks, with stateless and DB-backed modes
3. **Portfolio Management** -- CRUD portfolios with positions and analytics
4. **Expense Management** -- SpendCheck module with receipt OCR, approvals, and analytics
5. **Platform Infrastructure** -- Auth, billing, leads/CRM, admin pipeline, organizations, workspaces

**Auth model:** Three tiers -- `AuthGuard` (JWT/Supabase/API-key), `AdminKey` (x-admin-key header), and `None` (public). Auth is applied inconsistently across modules (see Drift and Gaps).

**Global middleware:**
- `GlobalExceptionFilter` -- Standardized `{ success: false, error: { code, message, details, timestamp, path } }` envelope
- `ResponseEnvelopeInterceptor` -- Wraps successful responses in `{ success: true, data, meta? }`
- `AuditLogInterceptor` -- Applied to ALM controller; persists POST/PUT/PATCH/DELETE operations to `audit_logs` table
- `DataValidationMiddleware` -- Ticker format, date range, numerical parameter validation (applied to market-data routes)
- `ThrottlerGuard` -- Rate limiting via `@nestjs/throttler` (configured per-endpoint where applied)

## API Surfaces

| Module | Controller File | Base Path | Endpoint Count | Auth Model |
|--------|----------------|-----------|----------------|------------|
| Root / App | `app.controller.ts` | `/` | 15 | Mixed (AuthGuard, AdminKey, None) |
| Auth | `auth/auth.controller.ts` | `/api/auth` | 14 | Mixed (None, AuthGuard, PassportAuthGuard) |
| Ticker | `ticker/ticker.controller.ts` | `/api/tickers` | 6 | **None** |
| Valuation | `valuation/valuation.controller.ts` | `/api/valuation` | 5 | **None** |
| Options | `options/options.controller.ts` | `/api/options` | 7 | **None** |
| Volatility | `risk/volatility.controller.ts` | `/api/risk/volatility` | 5 | **None** |
| Risk | `risk/risk.controller.ts` | `/risk` | 7 | AuthGuard (class-level) |
| Storage | `storage/storage.controller.ts` | `/api/storage` | 3 | **None** |
| Execution | `execution/execution.controller.ts` | `/api/execution` | 6 | **None** |
| Charts | `market-data/charts.controller.ts` | `/api/charts` | 2 | **None** |
| Market Data | `market-data/market-data.controller.ts` | `/api/market-data` | 11 | Mixed (None, AdminKey) |
| Pipeline Health | `jobs/pipeline-health.controller.ts` | `/api/health` | 1 | None |
| Admin Jobs | `jobs/admin.controller.ts` | `/api/admin` | 1 | AdminKey |
| Organizations | `organizations/organizations.controller.ts` | `/api/organizations` | 5 | AuthGuard (class-level) |
| Expenses | `expenses/expenses.controller.ts` | `/api/expenses` | 8 | AuthGuard (class-level) |
| Portfolio | `portfolio/portfolio.controller.ts` | `/api/portfolios` | 7 | AuthGuard (class-level) |
| Analytics | `analytics/analytics.controller.ts` | `/api/analytics` | 5 | AuthGuard (class-level) |
| Pipeline (Admin) | `pipeline/pipeline.controller.ts` | `admin/api/pipeline` + `api/jobs` | 7 | AdminKey + None (SSE) |
| Portal | `portal/portal.controller.ts` | `/api/portal` | 4 | AuthGuard (class-level) |
| ALM | `alm/alm.controller.ts` | `/api/alm` | 20 | Mixed (AuthGuard per-method, None for stateless) |
| Billing | `billing/billing.controller.ts` | `/api/billing` + `/auth/magic` | 6 | Mixed (None, AuthGuard, Stripe signature) |
| Leads | `leads/leads.controller.ts` | `api/v1/leads` + `admin/api/leads` + `admin/api/prospects` + `admin/api/benchmarks` | 10 | Mixed (None, AdminKey) |

## Auth Model

### AuthGuard (JWT / Supabase / API Key)

Defined in `auth/auth.guard.ts`. Extracts credentials in priority order:

1. **HttpOnly Cookie** `access_token` (preferred)
2. **Authorization** `Bearer <token>` header (fallback)
3. **API Key** via `x-api-key` header (read-only; GET/HEAD/OPTIONS only)

Token verification chain:
1. Decode claims; if `type=access|refresh`, try legacy JWT first
2. Verify against Supabase `/auth/v1/user` endpoint
3. Fall back to legacy JWT verification if `AUTH_ALLOW_LEGACY=true`

Org enforcement: Optional via `KLYTICS_REQUIRE_ORG` and `KLYTICS_REQUIRE_ENTITLEMENT` env vars. Org ID sourced from JWT claims `org_id`/`tenant_id` or `x-klytics-org-id` header.

### RolesGuard

Decorator-based RBAC via `@Roles(...)`. Currently **not applied** on any controller -- guard exists but is unused.

### AdminKey

Manual verification via `x-admin-key` header matched against `process.env.ADMIN_KEY`. Used in: AppController admin endpoints, AdminController, PipelineController admin endpoints, MarketDataController `clear-cache`, LeadsController admin endpoints.

### PassportAuthGuard

OAuth flows (Google, GitHub) use `@nestjs/passport` guards for redirect-based flows.

---

## Confirmed Endpoints

### Root / App (`app.controller.ts`)

| Method | Path | Purpose | Auth | Request | Response |
|--------|------|---------|------|---------|----------|
| GET | `/` | Hello/ping | None | -- | `string` |
| GET | `/health` | Health check (API, DB, Redis, MarketData) | None | -- | `{ status, timestamp, version, services }` |
| GET | `/health/detailed` | Detailed health with latency metrics | None (hidden in prod unless `HEALTH_DETAILS_PUBLIC`) | -- | `{ status, timestamp, version, uptime, memory, services, marketData }` |
| GET | `/api/status` | API metadata and endpoint directory | None | -- | `{ name, version, environment, uptime, endpoints }` |
| POST | `/api/demo-request` | Submit demo request from landing page | None (throttled: 5/min) | `DemoRequestDto` | `{ id, message }` |
| GET | `/api/workspaces` | List user's workspaces | AuthGuard | -- | `Workspace[]` |
| POST | `/api/workspaces` | Create workspace | AuthGuard | `{ name: string }` | `Workspace` |
| GET | `/api/admin/demo-requests` | List all demo requests | AdminKey | -- | `DemoRequest[]` |
| DELETE | `/api/admin/demo-data` | Reset ALM demo data | AdminKey | -- | `{ message }` |
| GET | `/api/admin/stats` | Platform statistics | AdminKey | -- | `{ demoRequests, institutions, users, recentUsers, prospects }` |
| POST | `/api/admin/seed-prospects` | Seed prospect data from env | AdminKey | -- | `{ seeded, total }` |
| GET | `/api/admin/prospects` | List prospects (legacy CRM) | AdminKey | `?stage=` | `Prospect[]` |
| POST | `/api/admin/prospects` | Create prospect | AdminKey | `{ name, email?, company?, role?, stage?, source?, notes? }` | `Prospect` |
| PATCH | `/api/admin/prospects/:id` | Update prospect | AdminKey | `{ stage?, notes?, name?, email?, company?, role? }` | `Prospect` |
| DELETE | `/api/admin/prospects/:id` | Delete prospect | AdminKey | -- | `{ message }` |

### Auth (`auth/auth.controller.ts`)

Base path: `/api/auth`

| Method | Path | Purpose | Auth | Request | Response |
|--------|------|---------|------|---------|----------|
| POST | `/api/auth/register` | Register new user | None (throttled: 3/min) | `RegisterDto { email, password, name? }` | `{ user }` + Set-Cookie |
| POST | `/api/auth/login` | Login with credentials | None (throttled: 5/min) | `LoginDto { email, password }` | `{ user }` + Set-Cookie |
| POST | `/api/auth/refresh` | Refresh JWT tokens | None | `RefreshTokenDto { refreshToken }` or cookie | `{ user }` + Set-Cookie |
| POST | `/api/auth/logout` | Invalidate refresh token | None | -- (reads cookie) | `{ message }` + Clear-Cookie |
| GET | `/api/auth/profile` | Get user profile | AuthGuard | -- | `UserProfile` |
| GET | `/api/auth/whoami` | Token introspection + org memberships | AuthGuard | -- | `{ user_id, email, orgs, app, issuer_ok, aud_ok }` |
| PUT | `/api/auth/password` | Change password | AuthGuard | `ChangePasswordDto { currentPassword, newPassword }` | `{ message }` |
| GET | `/api/auth/api-keys` | List user's API keys | AuthGuard | -- | `{ keys: ApiKey[] }` |
| POST | `/api/auth/api-keys` | Create API key | AuthGuard (throttled: 10/min) | `CreateApiKeyDto { name, expiresInDays? }` | `{ apiKey, record }` |
| POST | `/api/auth/api-keys/:keyId/revoke` | Revoke API key | AuthGuard (throttled: 20/min) | -- | `{ revoked }` |
| POST | `/api/auth/password-reset` | Request password reset email | None (throttled: 3/hr) | `PasswordResetRequestDto { email }` | `{ message }` |
| POST | `/api/auth/password-reset/confirm` | Confirm password reset | None (throttled: 3/hr) | `PasswordResetConfirmDto { token, newPassword }` | `{ message }` |
| GET | `/api/auth/google` | Initiate Google OAuth | PassportAuthGuard('google') | -- | Redirect to Google |
| GET | `/api/auth/google/callback` | Google OAuth callback | PassportAuthGuard('google') | -- | Redirect to frontend + Set-Cookie |
| GET | `/api/auth/github` | Initiate GitHub OAuth | PassportAuthGuard('github') | -- | Redirect to GitHub |
| GET | `/api/auth/github/callback` | GitHub OAuth callback | PassportAuthGuard('github') | -- | Redirect to frontend + Set-Cookie |

### Ticker (`ticker/ticker.controller.ts`)

Base path: `/api/tickers`

| Method | Path | Purpose | Auth | Request | Response |
|--------|------|---------|------|---------|----------|
| GET | `/api/tickers` | List tickers with pagination/filters | **None** | `TickerListQueryDto { assetType?, sector?, isActive?, page?, limit?, search? }` | `{ items: TickerDto[], total, page, pageSize }` |
| GET | `/api/tickers/:symbol` | Get single ticker by symbol | **None** | -- | `TickerDto` |
| POST | `/api/tickers` | Create ticker | **None** | `CreateTickerDto { ticker, name, assetType, sector?, ... }` | `TickerDto` |
| PUT | `/api/tickers/:symbol` | Update ticker | **None** | `UpdateTickerDto { name?, sector?, isActive?, ... }` | `TickerDto` |
| DELETE | `/api/tickers/:symbol` | Soft-delete ticker | **None** | -- | `{ message }` |
| POST | `/api/tickers/:symbol/enrich` | Enrich from external sources | **None** | -- | `TickerDto` |

### Valuation (`valuation/valuation.controller.ts`)

Base path: `/api/valuation`

| Method | Path | Purpose | Auth | Request | Response |
|--------|------|---------|------|---------|----------|
| POST | `/api/valuation/calculate` | Calculate valuation for ticker | **None** | `ValuationRequestDto { ticker, valuationType? }` | `CyclicalValuationDto \| CompounderValuationDto \| FrontierValuationDto` |
| GET | `/api/valuation/kpi/:ticker` | KPI score for ticker | **None** | -- | `KPIScoreDto` |
| GET | `/api/valuation/screener` | Run valuation screener | **None** | `ScreenerRequestDto { assetType?, sector?, minScore?, sortBy?, limit? }` | `ScreenerResultDto[]` |
| GET | `/api/valuation/cyclical/:ticker` | Cyclical valuation shortcut | **None** | -- | `CyclicalValuationDto` |
| GET | `/api/valuation/compounder/:ticker` | Compounder valuation shortcut | **None** | -- | `CompounderValuationDto` |
| GET | `/api/valuation/frontier/:ticker` | Frontier valuation shortcut | **None** | -- | `FrontierValuationDto` |

### Options (`options/options.controller.ts`)

Base path: `/api/options`

| Method | Path | Purpose | Auth | Request | Response |
|--------|------|---------|------|---------|----------|
| POST | `/api/options/calculate` | Calculate Black-Scholes Greeks | **None** | `CalculateGreeksDto { underlying, strike, timeToExpiry, riskFreeRate, volatility, optionType }` | `GreeksResponseDto` |
| GET | `/api/options/chain/:ticker` | Get options chain | **None** | `?maturity=YYYY-MM-DD` | `OptionsChainResponseDto` |
| POST | `/api/options/implied-volatility` | Calculate implied volatility | **None** | `ImpliedVolatilityRequestDto { ticker, strike, expiration, optionType, marketPrice }` | `ImpliedVolatilityResponseDto` |
| POST | `/api/options/strategy` | Calculate multi-leg strategy | **None** | `CalculateStrategyDto { legs[], underlyingPrice, volatility, riskFreeRate }` | `StrategyResponseDto` |
| GET | `/api/options/strategy-presets` | List strategy presets | **None** | -- | `{ presets: StrategyPresetDto[], count }` |
| GET | `/api/options/health` | Options service health | **None** | -- | `{ status, service, features, timestamp }` |
| GET | `/api/options/surface/:ticker` | Volatility surface | **None** | -- | Volatility surface data |

### Volatility Analytics (`risk/volatility.controller.ts`)

Base path: `/api/risk/volatility`

| Method | Path | Purpose | Auth | Request | Response |
|--------|------|---------|------|---------|----------|
| GET | `/api/risk/volatility/cone/:ticker` | Volatility cone with percentile bands | **None** | -- | `VolatilityConeResponseDto` |
| GET | `/api/risk/volatility/heatmap/:ticker` | IV surface heatmap | **None** | -- | `VolatilityHeatmapResponseDto` |
| GET | `/api/risk/volatility/rv-vs-iv/:ticker` | Realized vs implied vol comparison | **None** | `?days=90` | `RealizedVsImpliedResponseDto` |
| GET | `/api/risk/volatility/stats/:ticker` | Volatility statistics | **None** | `?period=30d` | `VolatilityStatsDto` |
| GET | `/api/risk/volatility/health` | Volatility service health | **None** | -- | `{ status, service, features, timestamp }` |

### Risk Analytics (`risk/risk.controller.ts`)

Base path: `/risk` (note: missing `/api` prefix)

| Method | Path | Purpose | Auth | Request | Response |
|--------|------|---------|------|---------|----------|
| POST | `/risk/monte-carlo` | Monte Carlo simulation | AuthGuard | `MonteCarloRequestDto` | `MonteCarloResultDto` |
| POST | `/risk/var` | Historical VaR calculation | AuthGuard | `VaRRequestDto` | `VaRResultDto` |
| POST | `/risk/correlation` | Correlation matrix | AuthGuard | `CorrelationMatrixRequestDto { tickers[], startDate?, endDate? }` | `CorrelationMatrixDto` |
| GET | `/risk/portfolio/:portfolioId` | Portfolio risk metrics | AuthGuard | -- | `PortfolioRiskDto` |
| POST | `/risk/stress-test/:portfolioId` | Portfolio stress test | AuthGuard | `StressTestScenarioDto[]` | `StressTestResultDto[]` |
| POST | `/risk/component-var` | Component VaR decomposition | AuthGuard | `ComponentVaRRequestDto` | `ComponentVaRResponseDto` |
| GET | `/risk/forecast-volatility/:ticker` | GARCH volatility forecast | AuthGuard | `?horizon=30` | `VolatilityForecastResponseDto` |
| POST | `/risk/parametric-var` | Parametric VaR | AuthGuard | `ParametricVaRRequestDto` | `ParametricVaRResponseDto` |

### Storage (`storage/storage.controller.ts`)

Base path: `/api/storage`

| Method | Path | Purpose | Auth | Request | Response |
|--------|------|---------|------|---------|----------|
| POST | `/api/storage/upload-url` | Generate pre-signed upload URL | **None** | `{ filename, contentType }` | `{ uploadUrl, fileKey }` |
| GET | `/api/storage/download-url/:fileKey` | Generate download URL | **None** | -- | `{ downloadUrl }` |
| DELETE | `/api/storage/file/:fileKey` | Delete file | **None** | -- | `{ message }` |

### Execution Quality (`execution/execution.controller.ts`)

Base path: `/api/execution`

| Method | Path | Purpose | Auth | Request | Response |
|--------|------|---------|------|---------|----------|
| POST | `/api/execution/slippage` | Analyze trade slippage | **None** | `any` (untyped) | Slippage analysis |
| POST | `/api/execution/vwap` | VWAP analysis | **None** | `any` (untyped) + `?period=60` | VWAP analysis |
| POST | `/api/execution/best-execution-report` | Best execution report | **None** | `{ executions[], startDate, endDate }` (untyped) | Best execution report |
| POST | `/api/execution/implementation-shortfall` | Implementation shortfall | **None** | `any` (untyped) | Implementation shortfall |
| POST | `/api/execution/backtest` | Run backtest | **None** | `any` (untyped) | Backtest results |
| GET | `/api/execution/strategies` | List available backtest strategies | **None** | -- | Strategy definitions array |

### Charts (`market-data/charts.controller.ts`)

Base path: `/api/charts`

| Method | Path | Purpose | Auth | Request | Response |
|--------|------|---------|------|---------|----------|
| GET | `/api/charts/technical/:ticker` | OHLCV + technical indicators | **None** | `?timeframe=1M&indicators=sma20,rsi,macd` | `TechnicalDataDto` |
| GET | `/api/charts/ohlcv/:ticker` | Raw OHLCV candle data | **None** | `?timeframe=1M` | `{ ticker, timeframe, data: OHLCVDataDto[] }` |

### Market Data (`market-data/market-data.controller.ts`)

Base path: `/api/market-data`

| Method | Path | Purpose | Auth | Request | Response |
|--------|------|---------|------|---------|----------|
| GET | `/api/market-data/insights` | AI-powered stock insights | **None** | `?ticker=AAPL` | `{ ticker, insight }` |
| GET | `/api/market-data/quote/:ticker` | Real-time quote | **None** | -- | `QuoteDto` |
| GET | `/api/market-data/history/:ticker` | Historical prices | **None** | `?start=YYYY-MM-DD&end=YYYY-MM-DD` | `HistoricalPriceDto[]` |
| GET | `/api/market-data/fundamentals/:ticker` | Fundamental data | **None** | -- | `FundamentalsDto` |
| GET | `/api/market-data/instrument/:ticker` | Instrument profile (incl. ETF metadata) | **None** | -- | `InstrumentProfileDto` |
| GET | `/api/market-data/news/:ticker` | Related news articles | **None** | `?limit=8` | `NewsArticleDto[]` |
| GET | `/api/market-data/snapshot/:ticker` | Complete market snapshot (quote+profile+news) | **None** | `?newsLimit=8` | `MarketSnapshotDto` |
| GET | `/api/market-data/search` | Search tickers | **None** | `?q=apple&assetType=stock` | `TickerSearchResultDto[]` |
| GET | `/api/market-data/health` | Market data provider health | **None** | -- | `MarketDataHealthDto` |
| GET | `/api/market-data/streams` | Active WebSocket stream status | **None** | -- | `StreamStatusDto[]` |
| GET | `/api/market-data/clear-cache` | Clear all caches | AdminKey | -- | `{ message }` |

### Pipeline Health (`jobs/pipeline-health.controller.ts`)

Base path: `/api/health`

| Method | Path | Purpose | Auth | Request | Response |
|--------|------|---------|------|---------|----------|
| GET | `/api/health/pipeline` | Pipeline health and schedule | None | -- | `{ lastSuccess, status, nextScheduled, tickersTracked }` |

### Admin Jobs (`jobs/admin.controller.ts`)

Base path: `/api/admin`

| Method | Path | Purpose | Auth | Request | Response |
|--------|------|---------|------|---------|----------|
| POST | `/api/admin/run-pipeline` | Manually trigger daily data pipeline | AdminKey | -- | `{ message, ...pipelineResult }` |

### Organizations (`organizations/organizations.controller.ts`)

Base path: `/api/organizations`

| Method | Path | Purpose | Auth | Request | Response |
|--------|------|---------|------|---------|----------|
| POST | `/api/organizations` | Create organization | AuthGuard | `{ name, slug, description? }` | `Organization` |
| GET | `/api/organizations` | List user's organizations | AuthGuard | -- | `Organization[]` |
| GET | `/api/organizations/:id` | Get organization detail | AuthGuard | -- | `Organization` |
| POST | `/api/organizations/:id/members` | Add member | AuthGuard | `{ userId, role }` | `OrganizationMember` |
| DELETE | `/api/organizations/:id/members/:userId` | Remove member | AuthGuard | -- | Success response |
| PATCH | `/api/organizations/:id/members/:userId/role` | Update member role | AuthGuard | `{ role }` | `OrganizationMember` |

### Expenses (`expenses/expenses.controller.ts`)

Base path: `/api/expenses`

| Method | Path | Purpose | Auth | Request | Response |
|--------|------|---------|------|---------|----------|
| POST | `/api/expenses/process-receipt` | OCR receipt processing | AuthGuard | `any` (untyped body) | Processed expense |
| POST | `/api/expenses` | Create expense | AuthGuard | `{ merchantName, amount, transactionDate, category?, description?, receiptUrl? }` | `Expense` |
| GET | `/api/expenses` | List expenses | AuthGuard | `?status=` | `Expense[]` |
| GET | `/api/expenses/:id` | Get expense detail | AuthGuard | -- | `Expense` |
| PATCH | `/api/expenses/:id` | Update expense | AuthGuard | `any` (untyped) | `Expense` |
| POST | `/api/expenses/:id/submit` | Submit for approval | AuthGuard | -- | `Expense` |
| POST | `/api/expenses/:id/approve` | Approve expense | AuthGuard | -- | `Expense` |
| POST | `/api/expenses/:id/reject` | Reject expense | AuthGuard | -- | `Expense` |
| DELETE | `/api/expenses/:id` | Delete expense | AuthGuard | -- | Success response |

### Portfolio (`portfolio/portfolio.controller.ts`)

Base path: `/api/portfolios`

| Method | Path | Purpose | Auth | Request | Response |
|--------|------|---------|------|---------|----------|
| GET | `/api/portfolios` | List user's portfolios | AuthGuard | -- | `PortfolioDto[]` |
| GET | `/api/portfolios/:id` | Get portfolio detail | AuthGuard | -- | `PortfolioDto` |
| POST | `/api/portfolios` | Create portfolio | AuthGuard | `CreatePortfolioDto { name, description?, currency?, initialCash? }` | `PortfolioDto` |
| PUT | `/api/portfolios/:id` | Update portfolio | AuthGuard | `UpdatePortfolioDto { name?, description?, currentCash? }` | `PortfolioDto` |
| DELETE | `/api/portfolios/:id` | Delete portfolio | AuthGuard | -- | `{ message }` |
| POST | `/api/portfolios/:id/positions` | Add position to portfolio | AuthGuard | `AddPositionDto { ticker, quantity, price }` | Position data |
| DELETE | `/api/portfolios/:id/positions/:ticker` | Remove/reduce position | AuthGuard | `{ quantity, sellPrice }` (body on DELETE) | `{ message }` |
| GET | `/api/portfolios/:id/analytics` | Portfolio analytics | AuthGuard | -- | `PortfolioAnalyticsDto` |

### Analytics / SpendCheck (`analytics/analytics.controller.ts`)

Base path: `/api/analytics`

| Method | Path | Purpose | Auth | Request | Response |
|--------|------|---------|------|---------|----------|
| GET | `/api/analytics/summary` | Expense analytics summary | AuthGuard | -- | Analytics summary |
| GET | `/api/analytics/trends` | Spending trends over time | AuthGuard | `?startDate=&endDate=` | Trend data |
| GET | `/api/analytics/categories` | Category breakdown | AuthGuard | `?startDate=&endDate=` | Category data |
| GET | `/api/analytics/team` | Team comparison | AuthGuard | `?startDate=&endDate=` | Team data |
| GET | `/api/analytics/export` | Export expenses (JSON or CSV) | AuthGuard | `?startDate=&endDate=&format=csv` | JSON array or CSV file |

### Pipeline Admin (`pipeline/pipeline.controller.ts`)

Base path: `admin/api/pipeline` (note: no leading `/api`)

| Method | Path | Purpose | Auth | Request | Response |
|--------|------|---------|------|---------|----------|
| GET | `/admin/api/pipeline` | List pipeline jobs with health metrics | AdminKey | `?status=` | `{ jobs[], health: { awaitingData, processing, complete, failed } }` |
| GET | `/admin/api/pipeline/:jobId` | Get job detail | AdminKey | -- | `ReportJob` |
| POST | `/admin/api/pipeline/:jobId/force-advance` | Force-advance job to QUEUED | AdminKey | -- | `{ message }` |
| POST | `/admin/api/pipeline/:jobId/force-fail` | Force-fail job | AdminKey | `{ reason }` | `{ message }` |
| POST | `/admin/api/pipeline/:jobId/force-regenerate` | Re-queue job for regeneration | AdminKey | -- | `{ message }` |
| GET | `/admin/api/revenue` | Revenue metrics (MRR, ARR, subscriptions) | AdminKey | -- | `{ revenueToday, revenueMonth, revenueYear, mrr, arr, activeSubscriptions }` |
| SSE | `/api/jobs/:jobId/status` | Server-Sent Events for job status | **None** | -- | SSE stream: `{ status, completedAt, errorMessage }` |

### Portal (`portal/portal.controller.ts`)

Base path: `/api/portal`

| Method | Path | Purpose | Auth | Request | Response |
|--------|------|---------|------|---------|----------|
| GET | `/api/portal/jobs` | List user's report jobs | AuthGuard | -- | `ReportJob[]` (selected fields) |
| GET | `/api/portal/jobs/:jobId` | Get job detail | AuthGuard | -- | `ReportJob` |
| GET | `/api/portal/jobs/:jobId/ingestion-logs` | Job ingestion logs | AuthGuard | -- | `IngestionLog[]` |
| POST | `/api/portal/jobs/:jobId/submit` | Submit CSV data for a job | AuthGuard | `multipart/form-data: file (.csv), institutionName?` | `{ valid, status, itemsImported?, errors? }` |

### ALM (`alm/alm.controller.ts`)

Base path: `/api/alm`

**Enterprise Endpoints (DB-backed, auth-protected):**

| Method | Path | Purpose | Auth | Request | Response |
|--------|------|---------|------|---------|----------|
| POST | `/api/alm/institutions` | Create institution | AuthGuard | `CreateInstitutionDto { name, type, totalAssets, reportingDate, workspaceId, currency? }` | `Institution` |
| GET | `/api/alm/institutions` | List institutions | AuthGuard | `PaginationQueryDto + ?workspaceId=` | Paginated `Institution[]` |
| GET | `/api/alm/institutions/:institutionId` | Get institution detail | AuthGuard | -- | `Institution` |
| POST | `/api/alm/institutions/:institutionId/balance-sheet-items` | Import balance sheet items | AuthGuard | `BulkBalanceSheetImportDto { items: BalanceSheetItemDto[] }` | `{ count }` |
| GET | `/api/alm/institutions/:institutionId/balance-sheet-items` | List balance sheet items | AuthGuard | `PaginationQueryDto` | Paginated `BalanceSheetItem[]` |
| GET | `/api/alm/:institutionId/summary` | ALM summary dashboard | AuthGuard | -- | ALM summary with risk scores |
| GET | `/api/alm/:institutionId/cossec-compliance` | COSSEC regulatory compliance | AuthGuard | -- | Compliance report |
| GET | `/api/alm/:institutionId/duration-gap` | Duration gap analysis | AuthGuard | -- | Duration gap data |
| GET | `/api/alm/:institutionId/nii-sensitivity` | NII sensitivity analysis | AuthGuard | -- | NII sensitivity data |
| GET | `/api/alm/:institutionId/liquidity` | Liquidity coverage ratio | AuthGuard | -- | LCR data |
| POST | `/api/alm/analysis/run` | Create analysis run | AuthGuard | `CreateAnalysisRunDto { institutionId, analysisType?, rateShocks?, stressTesting? }` | `AnalysisRun` |
| GET | `/api/alm/analysis-runs/:runId` | Get analysis run | AuthGuard | -- | `AnalysisRun` |
| GET | `/api/alm/institutions/:institutionId/analysis-runs` | List analysis runs for institution | AuthGuard | `PaginationQueryDto` | Paginated `AnalysisRun[]` |
| GET | `/api/alm/institutions/:institutionId/ingestion-logs` | List ingestion logs | AuthGuard | `PaginationQueryDto` | Paginated `IngestionLog[]` |
| POST | `/api/alm/institutions/:institutionId/upload-csv` | Upload balance sheet CSV | AuthGuard | `multipart/form-data: file (.csv), ?dryRun=true` | `{ valid, items, imported, errors?, ingestionLogId }` |
| GET | `/api/alm/templates/:type` | Download CSV template | **None** | `:type = cooperativa \| generic` | CSV file download |
| POST | `/api/alm/seed-demo` | Seed demo data for workspace | AuthGuard | `{ workspaceId, type }` | `{ institution, balanceSheetItems }` |
| POST | `/api/alm/:institutionId/stress-test` | Run Monte Carlo stress test | AuthGuard | `{ paths?, horizon?, volatility?, meanReversion? }` | Stress test results |
| GET | `/api/alm/:institutionId/report` | Download PDF report | AuthGuard | `?lang=en\|es` | `application/pdf` file |

**Stateless Endpoints (no auth, POST-based, pure computation):**

| Method | Path | Purpose | Auth | Request | Response |
|--------|------|---------|------|---------|----------|
| POST | `/api/alm/duration-gap` | Stateless duration gap | **None** | `ScenarioRequestDto { balanceSheet, rateShocks? }` | `DurationGapResult` |
| POST | `/api/alm/nii-simulation` | Stateless NII simulation | **None** | `ScenarioRequestDto` | `NIIResult` |
| POST | `/api/alm/eve` | Stateless EVE analysis | **None** | `ScenarioRequestDto` | `EVEResult` |
| POST | `/api/alm/lcr` | Stateless LCR computation | **None** | `LCRRequestDto { hqla, totalNetOutflows }` | `LCRResult` |
| POST | `/api/alm/bpv` | Stateless BPV analysis | **None** | `ScenarioRequestDto` | `BPVResult` |
| POST | `/api/alm/full-analysis` | Stateless full analysis | **None** | `FullAnalysisRequestDto { balanceSheet, rateShocks?, lcr? }` | `FullAnalysisResult` |
| GET | `/api/alm/demo-balance-sheet` | Demo balance sheet data | **None** | -- | `BalanceSheetDto` |
| GET | `/api/alm/demo-analysis` | Demo full analysis | **None** | -- | `FullAnalysisResult` |

### Billing (`billing/billing.controller.ts`)

| Method | Path | Purpose | Auth | Request | Response |
|--------|------|---------|------|---------|----------|
| POST | `/api/billing/checkout` | Create Stripe checkout session | None (throttled: 10/hr) | `CheckoutRequestDto { tier, customerEmail?, successUrl, cancelUrl, ... }` | Stripe session |
| POST | `/api/billing/portal` | Create Stripe billing portal session | AuthGuard | -- | `{ url }` |
| POST | `/api/billing/webhook` | Stripe webhook handler | Stripe signature verification | Raw body + `stripe-signature` header | `{ received: true }` |
| GET | `/api/billing/subscription` | Get user's subscription | AuthGuard | -- | `Subscription \| { tier: 'free', status: 'active' }` |
| GET | `/auth/magic` | Verify magic link and set auth cookie | None (throttled: 10/15min) | `?token=` | Redirect to `/portal` or `/auth/expired` |
| POST | `/auth/magic/request` | Request magic link email | None (throttled: 3/hr) | `{ email }` | `{ message }` |

### Leads (`leads/leads.controller.ts`)

| Method | Path | Purpose | Auth | Request | Response |
|--------|------|---------|------|---------|----------|
| POST | `/api/v1/leads/submit` | Submit inbound lead | None (throttled: 20/hr) | `SubmitLeadDto { name, email, institutionName, institutionType, ... }` | Lead record |
| GET | `/admin/api/leads` | List leads | AdminKey | `?status=&priority=` | `Lead[]` |
| GET | `/admin/api/leads/metrics` | Pipeline metrics | AdminKey | -- | Pipeline metrics |
| GET | `/admin/api/leads/:id` | Get lead detail | AdminKey | -- | `Lead` |
| PUT | `/admin/api/leads/:id` | Update lead | AdminKey | `UpdateLeadDto { status?, priority?, notes?, assignedTo?, ... }` | `Lead` |
| POST | `/admin/api/leads/:id/note` | Add note to lead | AdminKey | `{ note }` (body field) | `Lead` |
| POST | `/admin/api/leads/:id/mark-report-sent` | Mark report as sent | AdminKey | -- | `Lead` |
| POST | `/admin/api/prospects/seed` | Seed prospect pipeline | AdminKey | -- | Seed result |
| GET | `/admin/api/prospects` | List prospect institutions | AdminKey | -- | `ProspectInstitution[]` |
| GET | `/admin/api/benchmarks` | Get cooperativa benchmarks | AdminKey | -- | `CooperativaBenchmark[]` |
| GET | `/admin/api/prospects/:id/outreach` | Generate outreach email | AdminKey | `?lang=en\|es` | Outreach template |

---

## DTO / Schema Notes

### Validated DTOs (class-validator decorators)

| DTO | Location | Validation |
|-----|----------|------------|
| `DemoRequestDto` | `dto/demo-request.dto.ts` | `@IsEmail`, `@IsIn` for institutionType, `@MaxLength` |
| `RegisterDto` | `auth/dto/auth.dto.ts` | `@IsEmail`, `@MinLength(8)` for password |
| `LoginDto` | `auth/dto/auth.dto.ts` | `@IsEmail`, `@IsString` |
| `ChangePasswordDto` | `auth/dto/auth.dto.ts` | `@MinLength(8)` for newPassword |
| `RefreshTokenDto` | `auth/dto/auth.dto.ts` | `@IsString` |
| `PasswordResetRequestDto` | `auth/dto/auth.dto.ts` | `@IsEmail` |
| `PasswordResetConfirmDto` | `auth/dto/auth.dto.ts` | `@IsString` token, `@MinLength(8)` password |
| `CreateApiKeyDto` | `auth/dto/api-key.dto.ts` | `@MaxLength(80)`, `@Min(1)/@Max(3650)` for expiry |
| `CreateTickerDto` | `ticker/dto/ticker.dto.ts` | `@MaxLength(10)`, `@IsIn` for assetType |
| `UpdateTickerDto` | `ticker/dto/ticker.dto.ts` | All optional, validated |
| `TickerListQueryDto` | `ticker/dto/ticker.dto.ts` | Pagination + filter validation |
| `ValuationRequestDto` | `valuation/dto/valuation.dto.ts` | `@IsIn(['auto','cyclical','compounder','frontier'])` |
| `ScreenerRequestDto` | `valuation/dto/valuation.dto.ts` | Full filter validation |
| `CalculateGreeksDto` | `options/dto/options.dto.ts` | Numeric ranges, `@IsEnum(OptionType)` |
| `ImpliedVolatilityRequestDto` | `options/dto/options.dto.ts` | Full validation |
| `CalculateStrategyDto` | `options/dto/strategy.dto.ts` | Nested `@ValidateNested` for legs |
| `MonteCarloRequestDto` | `risk/dto/risk.dto.ts` | Numeric ranges for all params |
| `VaRRequestDto` | `risk/dto/risk.dto.ts` | `@ArrayMinSize(1)` for returns |
| `CorrelationMatrixRequestDto` | `risk/dto/risk.dto.ts` | `@ArrayMinSize(2)` for tickers |
| `StressTestScenarioDto` | `risk/dto/risk.dto.ts` | Name, description, marketShock |
| `ComponentVaRRequestDto` | `risk/dto/advanced-risk.dto.ts` | Nested position validation |
| `ParametricVaRRequestDto` | `risk/dto/advanced-risk.dto.ts` | Nested position validation |
| `CreatePortfolioDto` | `portfolio/dto/portfolio.dto.ts` | `@MaxLength(100)`, `@Min(0)` |
| `AddPositionDto` | `portfolio/dto/portfolio.dto.ts` | `@Min(0.0001)` quantity, `@Min(0)` price |
| `ScenarioRequestDto` | `alm/alm.dto.ts` | Nested `BalanceSheetDto` with `InstrumentDto[]` |
| `LCRRequestDto` | `alm/alm.dto.ts` | Nested `HQLADto` |
| `FullAnalysisRequestDto` | `alm/alm.dto.ts` | Combined balance sheet + optional LCR |
| `CreateInstitutionDto` | `alm/dto/create-institution.dto.ts` | `@IsIn` for type, `@IsDateString` |
| `BulkBalanceSheetImportDto` | `alm/dto/create-balance-sheet-item.dto.ts` | Nested `@ValidateNested` array |
| `CreateAnalysisRunDto` | `alm/dto/create-analysis-run.dto.ts` | Nested `StressTestingParamsDto` |
| `PaginationQueryDto` | `common/dto/pagination.dto.ts` | `@Min(1)/@Max(100)` for pageSize |
| `CheckoutRequestDto` | `billing/billing.dto.ts` | `@IsIn` for tier, `@IsEmail`, URLs required |
| `SubmitLeadDto` | `leads/leads.dto.ts` | `@IsEmail`, `@IsIn` for institutionType |
| `UpdateLeadDto` | `leads/leads.dto.ts` | `@IsIn` for status/priority/dealType |

### Untyped Request Bodies (missing DTOs)

| Endpoint | Controller | Issue |
|----------|-----------|-------|
| `POST /api/execution/slippage` | ExecutionController | Body typed as `any` |
| `POST /api/execution/vwap` | ExecutionController | Body typed as `any` |
| `POST /api/execution/best-execution-report` | ExecutionController | Inline type, no DTO class |
| `POST /api/execution/implementation-shortfall` | ExecutionController | Body typed as `any` |
| `POST /api/execution/backtest` | ExecutionController | Body typed as `any` |
| `POST /api/expenses/process-receipt` | ExpensesController | Body typed as `any` |
| `PATCH /api/expenses/:id` | ExpensesController | Body typed as `any` |
| `POST /api/storage/upload-url` | StorageController | Inline interface, no class-validator |
| `POST /api/workspaces` | AppController | Inline `{ name: string }`, no DTO |
| `POST /api/admin/prospects` | AppController | Inline type, no DTO |
| `PATCH /api/admin/prospects/:id` | AppController | Inline type, no DTO |
| `POST /api/organizations` | OrganizationsController | Inline `{ name, slug, description? }`, no DTO |
| `POST /api/organizations/:id/members` | OrganizationsController | Inline `{ userId, role }`, no DTO |
| `PATCH /api/organizations/:id/members/:userId/role` | OrganizationsController | Inline `{ role }`, no DTO |

---

## Drift and Gaps

### 1. Path Prefix Inconsistency

**Critical:** The RiskController uses base path `/risk` (no `/api` prefix), while all other controllers use `/api/...`. This breaks the convention and means risk endpoints live at `/risk/monte-carlo` rather than `/api/risk/monte-carlo`.

The volatility sub-controller correctly uses `/api/risk/volatility`, creating a split where:
- `/api/risk/volatility/*` -- public, no auth
- `/risk/*` -- auth required

This is confusing for consumers and breaks proxy/gateway assumptions.

### 2. Auth Inconsistency Across Financial Analytics

| Module | Auth | Risk Level |
|--------|------|------------|
| Tickers (CRUD including create/delete) | **None** | **HIGH** -- write operations unprotected |
| Valuation | None | Medium -- read-only analytics |
| Options | None | Low -- pure computation |
| Volatility Analytics | None | Low -- read-only |
| Risk Analytics | AuthGuard | Correct |
| Execution | None | Medium -- no PII but unprotected |
| Charts | None | Low -- read-only |
| Market Data | None | Low -- read-only |
| Storage (upload/delete) | **None** | **HIGH** -- file operations unprotected |
| Portfolios | AuthGuard | Correct |

**Recommendation:** Ticker write endpoints (POST, PUT, DELETE) and all Storage endpoints should require AuthGuard at minimum. The execution POST endpoints process user-submitted data and should be auth-gated.

### 3. Admin Path Inconsistency

Admin endpoints use three different path patterns:
- `/api/admin/*` (AppController, AdminController)
- `/admin/api/*` (PipelineController, LeadsController)
- No consistent namespace

This makes it difficult to apply blanket gateway rules for admin endpoints.

### 4. Duplicate Prospect Endpoints

Two independent prospect systems exist:
- **Legacy CRM** in `AppController`: `/api/admin/prospects` -- uses `Prospect` model (simple stage-based)
- **Outbound Pipeline** in `LeadsController`: `/admin/api/prospects` -- uses `ProspectInstitution` model (enriched with outreach status)

Both `POST /api/admin/seed-prospects` (AppController) and `POST /admin/api/prospects/seed` (LeadsController) seed different prospect tables.

### 5. Naming Drift: KLYTICS vs CERNIQ

Legacy naming persists:
- `x-klytics-org-id` header in AuthGuard
- `KLYTICS_APP_ID`, `KLYTICS_REQUIRE_ORG`, `KLYTICS_REQUIRE_ENTITLEMENT` env vars
- `capex_access_token` key in frontend sessionStorage/localStorage
- `CAPEX_ACCESS_TOKEN_KEY` constant in frontend API client

Product has been renamed to CERNIQ but these internal references remain.

### 6. Response Envelope Inconsistency

The `ResponseEnvelopeInterceptor` exists but is **not applied globally** or consistently. Some controllers return raw data, others return enveloped data. The `GlobalExceptionFilter` wraps errors in `{ success: false, error: {...} }` but success responses vary.

The `AuditLogInterceptor` is only applied to the ALM controller (`@UseInterceptors(AuditLogInterceptor)`), meaning write operations in other controllers (portfolios, expenses, organizations) are not audit-logged.

### 7. Rate Limiting Gaps

Rate limiting (`@Throttle`) is applied selectively:
- Auth endpoints: register (3/min), login (5/min), password-reset (3/hr) -- good
- Demo request: 5/min -- good
- Billing checkout: 10/hr -- good
- Lead submission: 20/hr -- good
- All financial analytics endpoints: **no rate limiting**
- All admin endpoints: **no rate limiting** (relies on AdminKey secrecy)

### 8. DELETE with Body Anti-pattern

`DELETE /api/portfolios/:id/positions/:ticker` accepts `{ quantity, sellPrice }` in the request body. Many HTTP clients and proxies strip bodies from DELETE requests. This should be redesigned as a POST or PATCH.

### 9. SSE Endpoint Unprotected

`SSE /api/jobs/:jobId/status` has no authentication. Job IDs are CUIDs (not UUIDs), so enumeration is unlikely but the endpoint leaks job status to any caller who knows a job ID.

### 10. Missing CORS/Security Headers Documentation

No controller-level CORS configuration is visible. This is likely handled at the NestJS app level (`main.ts`) but is not documented in the controller layer.

### 11. `RolesGuard` Defined but Never Applied

The `RolesGuard` and `@Roles()` decorator are implemented in `auth.guard.ts` but no controller or endpoint applies `@UseGuards(RolesGuard)` or `@Roles(...)`. Role-based authorization is effectively unused despite the infrastructure being in place.

---

## Recommended Documentation Fixes

1. **Standardize path prefixes.** Move `RiskController` from `/risk` to `/api/risk`. This is a breaking change that requires frontend/client updates but is necessary for consistency.

2. **Add AuthGuard to unprotected write endpoints.** At minimum: `TickerController` (POST/PUT/DELETE), `StorageController` (all), `ExecutionController` (all POST). Consider auth for stateless ALM endpoints if they will be publicly exposed.

3. **Unify admin paths.** Choose either `/api/admin/*` or `/admin/api/*` and migrate all admin endpoints to the chosen pattern.

4. **Create DTOs for all untyped bodies.** The 13 endpoints listed in "Untyped Request Bodies" above need proper DTO classes with class-validator decorators.

5. **Apply ResponseEnvelopeInterceptor globally.** Register it in `main.ts` as a global interceptor so all endpoints return consistent `{ success, data, meta? }` shape.

6. **Extend AuditLogInterceptor.** Apply to portfolio, expense, organization, and auth controllers -- any module that performs write operations on user data.

7. **Rename KLYTICS/CAPEX references.** Update header names, env vars, and storage keys to use CERNIQ naming.

8. **Resolve duplicate prospect systems.** Either merge the legacy `Prospect` model into the `ProspectInstitution`/`Lead` pipeline or deprecate the legacy endpoints explicitly.

9. **Protect SSE endpoint.** Add AuthGuard or at minimum validate that the requesting user owns the job.

10. **Refactor DELETE-with-body.** Replace `DELETE /api/portfolios/:id/positions/:ticker` with `POST /api/portfolios/:id/positions/:ticker/sell` or similar.

11. **Apply rate limiting to financial analytics.** Options calculation and Monte Carlo endpoints are computationally expensive and should have throttle guards.

12. **Activate RolesGuard.** The guard infrastructure exists; define roles for admin operations (approve expenses, manage org members) and apply the guard.

13. **Generate OpenAPI spec.** Consider adding `@nestjs/swagger` decorators to auto-generate an OpenAPI 3.0 specification from these controllers and DTOs.
