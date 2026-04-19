# Part X — Testing, Quality & Contract Governance

> **Audience:** QA, Engineering, Tech Leads
> **Last updated:** April 2026

---

## 10.1 Testing Pyramid

### Apple Platform

```
                        ┌─────────────┐
                        │  UI Tests   │  (future — XCUITest)
                        │  Playwright │  (E2E via web layer)
                    ┌───┴─────────────┴───┐
                    │  Integration        │
                    │  CerniqContracts    │
                    │  Check (3→10+ scen) │
               ┌────┴─────────────────────┴────┐
               │          Unit Tests            │
               │  CerniqAPITests    (95% cov)   │
               │  CerniqAuthTests   (95% cov)   │
               │  CerniqDomainTests (100% cov)  │
               │  CerniqFeaturesTests (90% cov) │
               └────────────────────────────────┘
```

### Web Platform

```
                    ┌────────────────────────┐
                    │   E2E — Playwright     │
                    │   5 spec files         │
                    │   38 critical tests    │
               ┌────┴────────────────────────┴────┐
               │      Integration                  │
               │      API client integration tests │
          ┌────┴──────────────────────────────────┴────┐
          │                Unit Tests                   │
          │  Vitest: lib/api (90%), stores (85%),       │
          │  utils (95%), hooks (80%)                   │
          └─────────────────────────────────────────────┘
```

### Backend

```
                    ┌────────────────────────┐
                    │   E2E — Playwright     │
                    │   (via frontend)       │
               ┌────┴────────────────────────┴────┐
               │      Integration                  │
               │      Module tests (NestJS)        │
          ┌────┴──────────────────────────────────┴────┐
          │                Unit Tests                   │
          │  Jest: ALM engine (80%), controllers (70%)  │
          │  Services (75%), DTOs (90%)                 │
          └─────────────────────────────────────────────┘
```

---

## 10.2 Unit Test Reference — Apple Platform

### CerniqDomainTests (target: 100%)
Every `Codable` type must have a round-trip test:
```swift
func testAuthUserCodableRoundTrip() throws {
    let json = """
    {"id":"user_123","email":"ana@coop.pr","workspaceId":"ws_123","subscriptionTier":"annual"}
    """
    let user = try JSONDecoder().decode(AuthUser.self, from: Data(json.utf8))
    XCTAssertEqual(user.id, "user_123")
    XCTAssertEqual(user.workspaceID, "ws_123")  // CodingKey: "workspaceId" → workspaceID
    XCTAssertEqual(user.subscriptionTier, "annual")
}

func testMetricStatusRawValues() {
    XCTAssertEqual(MetricStatus.healthy.rawValue, "healthy")
    XCTAssertEqual(MetricStatus.monitor.rawValue, "monitor")
    XCTAssertEqual(MetricStatus.critical.rawValue, "critical")
}

func testWorkspaceOverviewSnapshotSample() {
    let sample = WorkspaceOverviewSnapshot.sample
    XCTAssertEqual(sample.user.email, "ana@coop.pr")
    XCTAssertEqual(sample.institutions.count, 2)
    XCTAssertNotNil(sample.summary)
}
```

### CerniqAPITests (target: 95%)
```swift
func testLoginURLConstruction() throws {
    let client = CerniqAPIClient(environment: CerniqEnvironment(baseURL: URL(string: "https://api.cerniq.io")!))
    let urlRequest = try client.makeURLRequest(for: try AuthAPI.login(email: "ANA@COOP.PR", password: "secret"))
    XCTAssertEqual(urlRequest.url?.absoluteString, "https://api.cerniq.io/api/auth/login")
    XCTAssertEqual(urlRequest.httpMethod, "POST")
    let body = try JSONSerialization.jsonObject(with: urlRequest.httpBody!) as! [String: String]
    XCTAssertEqual(body["email"], "ana@coop.pr")  // Must be lowercased
}

func testAPIErrorEquality() {
    XCTAssertEqual(APIError.invalidURL, APIError.invalidURL)
    XCTAssertEqual(APIError.httpStatus(404, "Not Found"), APIError.httpStatus(404, "Not Found"))
    XCTAssertNotEqual(APIError.httpStatus(404, "Not Found"), APIError.httpStatus(500, "Error"))
}

func testDualDecodeEnvelopeFirst() async throws {
    // MockNetworkSession returns { "success": true, "data": { ... } }
    // Client should extract .data, not fail on envelope parse
    let mock = MockNetworkSession { _ in (envelopeJSON, http200) }
    let client = CerniqAPIClient(environment: testEnv, session: mock)
    let user: AuthUser = try await client.send(AuthAPI.profile())
    XCTAssertEqual(user.email, "ana@coop.pr")
}

func testDualDecodeDirectFallback() async throws {
    // MockNetworkSession returns direct { "id": "...", "email": "..." } (no envelope)
    let mock = MockNetworkSession { _ in (directJSON, http200) }
    let client = CerniqAPIClient(environment: testEnv, session: mock)
    let user: AuthUser = try await client.send(AuthAPI.profile())
    XCTAssertEqual(user.email, "ana@coop.pr")
}
```

### CerniqAuthTests (target: 95%)
```swift
func testTokenBackedLoginStoresTokens() async throws {
    let store = InMemoryCredentialStore()
    let mock = MockNetworkSession { _ in (loginJSON, http200) }
    let manager = AuthSessionManager(client: client(mock), credentialStore: store)
    let session = try await manager.login(email: "ana@coop.pr", password: "secret")
    XCTAssertEqual(session.authenticationMode, .tokenBacked)
    XCTAssertEqual(try store.loadAccessToken(), "at_123")
    XCTAssertEqual(try store.loadRefreshToken(), "rt_123")
}

func testCookieBackedSessionNoTokens() async throws {
    // Login response has no accessToken or refreshToken
    let mock = MockNetworkSession { _ in (cookieLoginJSON, http200) }
    let manager = AuthSessionManager(client: client(mock))
    let session = try await manager.login(email: "ana@coop.pr", password: "secret")
    XCTAssertEqual(session.authenticationMode, .cookieBacked)
}

func testLogoutClearsSession() async throws {
    let store = InMemoryCredentialStore(accessToken: "at_123", refreshToken: "rt_123")
    let manager = AuthSessionManager(client: mockClient, credentialStore: store)
    manager.session = AuthSession(...)  // Inject test session
    try manager.logout()
    XCTAssertNil(manager.session)
    XCTAssertNil(try store.loadAccessToken())
    XCTAssertNil(try store.loadRefreshToken())
}
```

### CerniqFeaturesTests (target: 90%)
```swift
func testHighlightsHealthyLCR() async throws {
    // LCR = 115.5 → should be .healthy
    let service = PreviewWorkspaceOverviewService(snapshot: .sample)
    let vm = await WorkspaceOverviewViewModel(service: service)
    await vm.load()
    let lcrMetric = vm.snapshot?.highlights.first(where: { $0.id == "liquidity" })
    XCTAssertEqual(lcrMetric?.status, .healthy)
}

func testHighlightsCriticalLCR() async throws {
    // LCR = 80.0 → should be .critical
    var modified = WorkspaceOverviewSnapshot.sample
    // Inject low LCR summary...
    let service = PreviewWorkspaceOverviewService(snapshot: modified)
    let vm = await WorkspaceOverviewViewModel(service: service)
    await vm.load()
    let lcrMetric = vm.snapshot?.highlights.first(where: { $0.id == "liquidity" })
    XCTAssertEqual(lcrMetric?.status, .critical)
}

func testDoubleLoadGuard() async throws {
    var callCount = 0
    let service = CountingService { callCount += 1; return .sample }
    let vm = await WorkspaceOverviewViewModel(service: service)
    async let load1: Void = vm.load()
    async let load2: Void = vm.load()  // Should be ignored if isLoading
    await (load1, load2)
    XCTAssertEqual(callCount, 1)  // Only one actual fetch
}
```

---

## 10.3 E2E Tests — Playwright (Frontend)

### Critical Path Spec Files

```
frontend/e2e/
├── auth.spec.ts           # Register, login (email + OAuth), magic link, logout
├── portal-submit.spec.ts  # CSV upload wizard (the #1 Apple app workflow)
├── report-download.spec.ts # Report job polling, presigned URL download
├── billing.spec.ts        # Pricing → Stripe checkout → subscription active
└── alm-module.spec.ts     # Duration gap calculation, chart rendered, PDF export
```

### portal-submit.spec.ts — Most Critical
```typescript
test('portal submit full flow', async ({ page }) => {
  // 1. Authenticate
  await page.goto('/login')
  await page.fill('[name="email"]', testUser.email)
  await page.fill('[name="password"]', testUser.password)
  await page.click('[type="submit"]')
  await page.waitForURL('/dashboard')

  // 2. Navigate to portal submit
  await page.goto('/portal/submit')
  await expect(page.locator('h1')).toContainText('Submit ALM Data')

  // 3. Upload CSV
  await page.setInputFiles('[data-testid="csv-upload"]', 'test-data/sample-balance-sheet.csv')
  await expect(page.locator('[data-testid="dry-run-preview"]')).toBeVisible({ timeout: 10_000 })

  // 4. Confirm submission
  await page.click('[data-testid="confirm-submit"]')
  await expect(page.locator('[data-testid="report-job-status"]')).toContainText('Processing')

  // 5. Wait for completion (max 60s in test environment)
  await expect(page.locator('[data-testid="report-job-status"]')).toContainText('Complete', { timeout: 60_000 })

  // 6. Verify download link
  await expect(page.locator('[data-testid="download-report"]')).toBeVisible()
})
```

### Seed for E2E Tests
```bash
cd backend-node && npm run seed:portal-submit
# Provisions:
# - Test user: portal-test@cerniq.io / TestPass123!
# - Active subscription (annual tier)
# - One AWAITING_DATA ReportJob
# - Valid magic link for that user
# - Sample balance sheet CSV at test_data/portal-submit-fixture.csv
```

---

## 10.4 API Contract Governance

### Protocol

When a backend endpoint changes its response shape:

1. **Generate new fixture:**
   ```bash
   curl -H "Authorization: Bearer $TEST_TOKEN" https://api.cerniq.io/api/alm/institutions \
     | jq '.' > apple/Fixtures/institutions.json
   ```

2. **Update CerniqContractsCheck** to assert new shape fields

3. **Update Swift types** if new fields require domain model changes

4. **Verify the chain passes:**
   ```bash
   cd apple && swift run CerniqContractsCheck
   # → "CerniqContractsCheck passed"
   ```

5. **PR gate:** CerniqContractsCheck must pass before merging any PR that touches `Sources/CerniqAPI/`, `Sources/CerniqDomain/`, or `Fixtures/`

### API Contract Expansion Plan

| API | Fixture | Current Coverage | Target Coverage |
|-----|---------|-----------------|----------------|
| `POST /api/auth/login` | `auth-login.json` | ✅ URL, method, email normalization, token storage | Stable |
| `GET /api/auth/profile` | `auth-profile.json` | ✅ Full decode, composition | Stable |
| `GET /api/alm/institutions` | `institutions.json` | ✅ Array decode, field mapping | Stable |
| `GET /api/alm/{id}/summary` | `alm-summary.json` | ✅ ALMSummary decode, route style | Stable |
| `GET /api/portal/settings` | `portal-settings.json` | ✅ PortalSettingsSnapshot decode | Stable |
| `POST /api/auth/refresh` | ❌ Missing | — | Q2 2026 |
| `GET /api/portal/reports` | ❌ Missing | — | Q2 2026 |
| `POST /api/portal/balance-sheet/upload` | ❌ Missing | — | Q3 2026 (v2.0) |
| `POST /api/portal/reports/generate` | ❌ Missing | — | Q3 2026 (v2.0) |
| `GET /api/billing/subscription` | ❌ Missing | — | Q3 2026 |

---

## 10.5 Code Quality Gates

| Gate | Tool | Enforced At | Failure Action |
|------|------|-------------|---------------|
| TypeScript strict mode (backend) | `npx tsc --noEmit` | CI + pre-push | Blocks merge |
| TypeScript strict mode (frontend) | `npx tsc --noEmit` | CI | Blocks merge |
| Backend linting | ESLint (`eslint.config.mjs`) | Pre-commit (lint-staged) | Blocks commit |
| Frontend linting | ESLint | Pre-commit (lint-staged) | Blocks commit |
| Prisma schema integrity | `npx prisma validate` | CI | Blocks deploy |
| Apple contract verification | `swift run CerniqContractsCheck` | PR requirement | Must print "passed" |
| Clean worktree | `scripts/verify-clean-worktree.sh` | Post-test in deploy | Blocks deploy |
| Frontend build | `npx next build` | CI | Blocks deploy |
| Backend unit tests | `npm test` | CI | Blocks deploy |
| Frontend unit tests | `npx vitest run` | CI | Blocks deploy |
| E2E critical path | Playwright (`test:e2e:critical`) | Deploy gate | Blocks deploy |

---

## 10.6 Coverage Targets

| Target | Tool | Minimum | Measurement |
|--------|------|---------|-------------|
| Backend — ALM engine | Jest | 80% | `npm run test:cov` → `coverage/lcov-report/` |
| Backend — Controllers | Jest | 70% | Same |
| Backend — Services | Jest | 75% | Same |
| Frontend — API client | Vitest | 90% | `npm run test:coverage` |
| Frontend — Stores | Vitest | 85% | Same |
| Frontend — Utils | Vitest | 95% | Same |
| Apple — CerniqDomain | XCTest | 100% | Xcode Coverage Report |
| Apple — CerniqAPI | XCTest | 95% | Same |
| Apple — CerniqAuth | XCTest | 95% | Same |
| Apple — CerniqFeatures | XCTest | 90% | Same |

---

## 10.7 Test Data Management

### Backend seed scripts
```bash
# General development seed
cd backend-node && npx prisma db seed

# Portal submit E2E seed (creates test user + active subscription + AWAITING_DATA job)
cd backend-node && npm run seed:portal-submit

# ALM demo data seed (creates sample institutions + analysis runs for demo/preview)
cd backend-node && npm run seed:alm-demo
```

### Apple fixture management
- All fixtures in `apple/Fixtures/*.json`
- Generated from live API calls against development or staging environment
- Reviewed manually before commit — check for PII (no real user emails, no real institution names in fixtures)
- Sample fixture user: `ana@coop.pr` (fictional), institution: `CoopAhorro San Juan` (fictional)

---

*KLYTICS LLC · Proprietary & Confidential · cerniq.io*
