# Part III — Apple Platform Engineering

> **Audience:** iOS/macOS Engineers, Tech Leads
> **Last updated:** April 2026

This is the single authoritative reference for everything native Apple in CERNIQ. Read this before touching any Swift file.

---

## 3.1 Architecture Philosophy

The CERNIQ Apple platform uses a **dual-layer architecture**:

1. **Swift Package (`apple/`)** — Domain models, HTTP client, auth manager, SwiftUI feature components. This is the brain. Business logic, contracts, and testable code live here. SPM-only, no Xcode required to build or verify.

2. **Xcode Project (`apple/CerniqApple/`)** — Thin platform shells for macOS and iOS. These targets are pure wiring: lifecycle management, scene configuration, entitlements, and app icons. They import the Swift Package and add no business logic.

**Core principle:** The app intentionally reuses the existing CERNIQ web product via WKWebView rather than forking business logic into native code. Native = navigation chrome, auth session management, environment switching, and critical workflow acceleration. Web = all ALM analysis surfaces, dashboard, portal, billing.

---

## 3.2 Repository Layout

```
apple/
├── Package.swift                    # SPM manifest (Swift 6.3, iOS 17+, macOS 14+)
├── Sources/
│   ├── CerniqDomain/
│   │   └── Models.swift             # All shared value types
│   ├── CerniqAPI/
│   │   └── CerniqAPI.swift          # HTTP client, request builders, API namespaces
│   ├── CerniqAuth/
│   │   └── AuthSessionManager.swift # Session management, credential stores
│   ├── CerniqFeatures/
│   │   └── WorkspaceOverview.swift  # SwiftUI feature: view, viewmodel, services
│   ├── CerniqMacApp/
│   │   └── CerniqMacApp.swift       # Package-first macOS executable shell
│   └── CerniqContractsCheck/
│       └── main.swift               # Contract verification executable
├── Fixtures/
│   ├── auth-login.json
│   ├── auth-profile.json
│   ├── institutions.json
│   ├── alm-summary.json
│   └── portal-settings.json
├── Tests/
│   ├── CerniqAPITests/
│   ├── CerniqAuthTests/
│   ├── CerniqDomainTests/
│   └── CerniqFeaturesTests/
└── CerniqApple/                     # Full Xcode project
    ├── CerniqApple.xcodeproj/
    │   └── xcshareddata/xcschemes/
    │       ├── CERNIQ macOS.xcscheme
    │       └── CERNIQ iOS.xcscheme
    ├── CerniqmacOS/
    │   ├── CerniqmacOSApp.swift     # @main macOS entry point
    │   └── Info.plist
    ├── CerniqiOS/
    │   ├── CerniqiOSApp.swift       # @main iOS entry point
    │   └── Info.plist
    ├── Shared/
    │   ├── Models/
    │   │   ├── CerniqDestination.swift
    │   │   └── CerniqEnvironment.swift
    │   ├── Services/
    │   │   └── CerniqAppState.swift
    │   └── Views/
    │       ├── CerniqMacRootView.swift
    │       ├── CerniqIOSRootView.swift
    │       ├── CerniqHomeView.swift
    │       ├── CerniqBrowserScene.swift
    │       ├── CerniqWebView.swift
    │       └── CerniqSettingsView.swift
    └── README.md
```

---

## 3.3 Module Dependency Graph

Strict layering — no module imports from a module above it in the DAG:

```
CerniqDomain          ← no dependencies (pure value types)
     ▲
CerniqAPI             ← CerniqDomain
     ▲
CerniqAuth            ← CerniqAPI, CerniqDomain
     ▲
CerniqFeatures        ← CerniqAPI, CerniqAuth, CerniqDomain
     ▲
CerniqMacApp          ← CerniqFeatures  (executable)
CerniqContractsCheck  ← CerniqAPI, CerniqAuth, CerniqFeatures, CerniqDomain (executable)
```

**Package.swift targets:**
```swift
// swift-tools-version: 6.3
platforms: [.iOS(.v17), .macOS(.v14)]
swiftLanguageModes: [.v6]
```

All types are `Sendable` + Swift 6 strict concurrency compliant.

---

## 3.4 CerniqDomain — Value Type Catalog

All types: `public`, `Codable`, `Equatable`, `Sendable`. No mutable state. No UIKit/AppKit imports.

### AuthUser
```swift
public struct AuthUser: Codable, Equatable, Identifiable, Sendable {
    public let id: String
    public let email: String
    public let name: String?
    public let workspaceID: String?
    public let workspaceName: String?
    public let subscriptionTier: String?
    // CodingKeys: workspaceID → "workspaceId" (camelCase → snake_case bridge)
}
```

### AuthSession
```swift
public struct AuthSession: Codable, Equatable, Sendable {
    public let user: AuthUser
    public let accessToken: String?
    public let refreshToken: String?
    public let authenticationMode: AuthenticationMode  // .cookieBacked | .tokenBacked
}
```

### InstitutionSummary
```swift
public struct InstitutionSummary: Codable, Equatable, Identifiable, Sendable {
    public let id: String
    public let name: String
    public let type: String           // "cooperativa" | "credit_union" | "community_bank"
    public let totalAssets: Double?
    public let reportingDate: String? // e.g. "Q1-2026"
}
```

### ALMSummary
```swift
public struct ALMSummary: Codable, Equatable, Sendable {
    public let institutionID: String  // CodingKey: "institutionId"
    public let durationGap: Double?
    public let riskRating: String?    // "asset-sensitive" | "liability-sensitive" | "neutral"
    public let liquidityCoverageRatio: Double?
    public let netInterestMargin: Double?
}
```

### MetricStatus
```swift
public enum MetricStatus: String, Codable, Equatable, Sendable {
    case healthy   // green — within regulatory bounds
    case monitor   // orange — approaching threshold
    case critical  // red — threshold breached
}
```

### WorkspaceOverviewSnapshot
The complete data payload for the WorkspaceOverviewView. Carries a `.sample` static for Xcode Previews:

```swift
public struct WorkspaceOverviewSnapshot: Codable, Equatable, Sendable {
    public let user: AuthUser
    public let settings: PortalSettingsSnapshot
    public let institutions: [InstitutionSummary]
    public let summary: ALMSummary?
    public let highlights: [OverviewMetric]
}
```

**Sample fixture:** `ana@coop.pr` / `CoopAhorro San Juan` / `inst_123` / `LCR: 115.5%` / `Duration Gap: 1.8`

---

## 3.5 CerniqAPI — HTTP Client Architecture

### CerniqAPIClient
Value type, `Sendable`, thread-safe. Core generic method:

```swift
public func send<Response: Decodable>(
    _ request: APIRequest<Response>,
    accessToken: String? = nil
) async throws -> Response
```

**Dual-decode strategy:**
1. Try `ResponseEnvelope<Response>` first (extracts `.data` from `{ success, data, error }`)
2. Fall back to direct `Response` decode if envelope parse fails
3. On non-2xx: decode `ErrorEnvelope.error.message` → throw `APIError.httpStatus(statusCode, message)`

**APIError cases:**
```swift
public enum APIError: Error, Equatable {
    case invalidURL
    case invalidResponse
    case httpStatus(Int, String)
    case decoding(String)
}
```

**NetworkSession protocol** (enables mock injection for testing):
```swift
public protocol NetworkSession: Sendable {
    func data(for request: URLRequest) async throws -> (Data, URLResponse)
}
extension URLSession: NetworkSession {} // production default
```

### API Namespaces

| Namespace | Method | Auth | Endpoint |
|-----------|--------|------|----------|
| `AuthAPI` | `login(email:password:)` | None | `POST /api/auth/login` |
| `AuthAPI` | `refresh(refreshToken:)` | None | `POST /api/auth/refresh` |
| `AuthAPI` | `profile()` | Bearer | `GET /api/auth/profile` |
| `PortalAPI` | `settings()` | Bearer | `GET /api/portal/settings` |
| `ALMAPI` | `listInstitutions()` | Bearer | `GET /api/alm/institutions` |
| `ALMAPI` | `summary(institutionID:routeStyle:)` | Bearer | `GET /api/alm/{id}/summary` (frontendObserved) OR `GET /api/alm/institutions/{id}/summary` (documented) |

### ALMRouteStyle
```swift
public enum ALMRouteStyle: String, Equatable, Sendable {
    case frontendObserved  // Route actually used by the web frontend
    case documented        // Route in the API documentation
}
```
This enum tracks discrepancy between frontend-observed routes and formally documented paths. CerniqContractsCheck can test both simultaneously to detect drift early.

### CerniqEnvironment (API Layer)
```swift
public struct CerniqEnvironment: Equatable, Sendable {
    public let baseURL: URL
    public let almRouteStyle: ALMRouteStyle
}
```

---

## 3.6 CerniqAuth — Session & Credential Management

### CredentialStore Protocol
```swift
public protocol CredentialStore: Sendable {
    func loadAccessToken() throws -> String?
    func loadRefreshToken() throws -> String?
    func store(accessToken: String?, refreshToken: String?) throws
    func clear() throws
}
```

### Implementations

**InMemoryCredentialStore** — Tests and SPM shell:
- `@unchecked Sendable` (internal var mutation)
- No persistence — tokens live in heap only
- Used by `CerniqContractsCheck` and `CerniqMacApp` (SPM shell)

**KeychainCredentialStore** — Production app targets:
- Service: `"io.cerniq.apple"` (default)
- Accounts: `"access-token"` and `"refresh-token"`
- Uses `SecItemAdd` / `SecItemCopyMatching` / `SecItemDelete`
- `errSecItemNotFound` → returns `nil` (not an error)
- Any other non-success status → throws `AuthError.keychain(OSStatus)`

### AuthSessionManager — Token Lifecycle

```swift
// Login
login(email:password:) async throws -> AuthSession
  → POST /api/auth/login
  → apply(response:) → store tokens → set self.session
  → authenticationMode = .tokenBacked if tokens present, .cookieBacked otherwise

// Refresh
refreshSession() async throws -> AuthSession
  → if refresh token available: POST /api/auth/refresh
  → else: GET /api/auth/profile (cookie-backed fallback)

// Profile
loadProfile() async throws -> AuthUser
  → GET /api/auth/profile with stored access token

// Logout
logout() throws
  → self.session = nil
  → credentialStore.clear()
```

**Auth mode detection logic:**
```
hasTokenContract = (accessToken != nil || refreshToken != nil)
mode = hasTokenContract ? .tokenBacked : .cookieBacked
```

WKWebView sessions are always `.cookieBacked` — the web session cookie handles auth transparently. No token management needed in Swift for embedded web flows.

---

## 3.7 CerniqFeatures — SwiftUI MVVM

### Protocol
```swift
@MainActor
public protocol WorkspaceOverviewServing {
    func fetchOverview() async throws -> WorkspaceOverviewSnapshot
}
```

### Implementations

**PreviewWorkspaceOverviewService** — Xcode Previews + SPM shell:
```swift
// Returns WorkspaceOverviewSnapshot.sample synchronously
// Zero network calls — enables instant canvas preview
```

**LiveWorkspaceOverviewService** — Production app targets:
```swift
func fetchOverview() async throws -> WorkspaceOverviewSnapshot {
    let token = try authManager.accessToken()
    // Fan-out (sequential awaits — upgrade to TaskGroup for concurrency):
    let user = try await authManager.loadProfile()
    let institutions = try await client.send(ALMAPI.listInstitutions(), accessToken: token)
    let settings = (try? await client.send(PortalAPI.settings(), accessToken: token))
        ?? fallbackSettings
        ?? PortalSettingsSnapshot.fallback(user: user, institutions: institutions)
    let summary = try? await client.send(
        ALMAPI.summary(institutionID: institutions.first!.id, routeStyle: almRouteStyle),
        accessToken: token
    )
    return WorkspaceOverviewSnapshot(user, settings, institutions, summary, buildHighlights(...))
}
```

**Highlights business logic:**

| Metric ID | Source | `.healthy` | `.monitor` | `.critical` |
|-----------|--------|-----------|-----------|------------|
| `plan` | `settings.subscriptionTier` | always | — | — |
| `institutions` | `institutions.count` | count > 0 | — | count == 0 |
| `duration-gap` | `summary.durationGap` | — | gap present, < 2.0 | gap ≥ 2.0 |
| `liquidity` | `summary.liquidityCoverageRatio` | LCR ≥ 100 | LCR absent | LCR < 100 |

### WorkspaceOverviewViewModel
```swift
@MainActor @Observable
public final class WorkspaceOverviewViewModel {
    public private(set) var snapshot: WorkspaceOverviewSnapshot?
    public private(set) var isLoading = false
    public private(set) var errorMessage: String?

    // load() guards against double-fetch via isLoading check
    // .task modifier in view calls load() when snapshot == nil
}
```

### WorkspaceOverviewView
Three sections rendered in a ScrollView:

1. **Header card** — workspace name (largeTitle.semibold), institution description, HStack of subscription tier badge / institution count / risk rating. Background: `.regularMaterial`, corner radius 20.

2. **Metrics grid** — `LazyVGrid(columns: [GridItem(.adaptive(minimum: 180))])`. Each card: `.thinMaterial`, 18pt corner radius, title (headline) / value (title2.semibold) / status (caption, color-coded green/orange/red).

3. **Institution list** — ForEach over `institutions`. Each: `.ultraThinMaterial`, 16pt corner radius, name (headline) + HStack of type / reportingDate / currency(totalAssets).

**States handled:**
- `snapshot != nil` → full content
- `isLoading == true` → `ContentUnavailableView("Loading CERNIQ", ...)`
- `errorMessage != nil` → `ContentUnavailableView("Unable to load workspace", ..., description: errorMessage)`
- else → `ContentUnavailableView("CERNIQ Apple", systemImage: "building.columns")`

---

## 3.8 macOS App — CerniqmacOSApp

### Entry Point
```swift
@main
struct CerniqmacOSApp: App {
    @NSApplicationDelegateAdaptor(CerniqMacAppDelegate.self) private var appDelegate
    @State private var appState = CerniqAppState(platform: .macOS)
    // WindowGroup min: 1120 × 760
    // Settings scene → CerniqSettingsView (width: 540)
}
```

**CerniqMacAppDelegate:**
```swift
func applicationDidFinishLaunching(_ notification: Notification) {
    NSApp.setActivationPolicy(.regular)
    NSApp.activate(ignoringOtherApps: true)
}
```

### CerniqMacRootView — NavigationSplitView (balanced)

```
NavigationSplitView {
    Sidebar
} detail: {
    if selectedDestination == .home → CerniqHomeView
    else                            → CerniqBrowserScene
}
```

**Sidebar sections:**
- "Workspace" — all 9 `CerniqDestination` cases as `Label(title, systemImage)` rows
- "Utilities" — "Open Current Page in Browser" button + `SettingsLink`

### CerniqHomeView — Native Launchpad

Three visual zones:

**Hero:**
```
CERNIQ ON APPLE PLATFORMS         ← caption.semibold.uppercase, navy tint
Board-ready ALM workflows,
wrapped in native Apple navigation  ← system 34pt bold rounded
```

**Environment Card** (`.regularMaterial`, corner radius 24):
- Segmented picker: Production | Local | Custom
- Monospaced callout showing resolved base URL
- Conditional custom URL `TextField` when `.custom` selected
- Toggle: "Open off-domain links in the system browser"
- Button: "Reset to production defaults"

**Quick Launch Grid** (`LazyVGrid`, adaptive min 220):
- 8 destination cards for all non-home destinations
- Each card: white 82% opacity, 1px stroke, 22pt corners, min height 180pt
- Card layout: icon (title2.semibold, navy) → headline title → subheadline summary → Spacer → "Open →" footer row

---

## 3.9 iOS App — CerniqiOSApp

### Entry Point
```swift
@main
struct CerniqiOSApp: App {
    @State private var appState = CerniqAppState(platform: .iOS)
    // No NSApplicationDelegate — iOS handles lifecycle automatically
}
```

### CerniqIOSRootView — TabView

| Tab | Icon | Content | Default for |
|-----|------|---------|-------------|
| Home | `house` | CerniqHomeView (launchpad, same as macOS) | — |
| Portal | `building.2` | CerniqBrowserScene(.portal) | — |
| Workspace | `rectangle.split.3x1` | CerniqBrowserScene(appState.selectedDestination) | All analysis routes |
| Account | `person.crop.circle` | CerniqSettingsView | .settings destination |

**Tab routing from home launchpad:**
```swift
func open(_ destination: CerniqDestination) {
    appState.select(destination)
    switch destination {
    case .portal:   selectedTab = .portal
    case .settings: selectedTab = .account
    case .home:     selectedTab = .home
    default:        selectedTab = .workspace
    }
}
```

---

## 3.10 CerniqWebView — WKWebView Bridge

Cross-platform `UIViewRepresentable` (iOS) / `NSViewRepresentable` (macOS) wrapping `WKWebView`.

### Configuration
```swift
let configuration = WKWebViewConfiguration()
configuration.defaultWebpagePreferences.allowsContentJavaScript = true
// iOS only:
webView.allowsBackForwardNavigationGestures = true
```

### CerniqNavigationDelegate behaviors

| Event | Action |
|-------|--------|
| `didStartProvisionalNavigation` | `appState.browserIsLoading = true` |
| `didFinish` | `appState.browserIsLoading = false`, `appState.browserTitle = webView.title` |
| `didFail` / `didFailProvisionalNavigation` | `appState.browserIsLoading = false` |
| Link activated to off-domain URL (when toggle is ON) | `appState.open(url:)` → `NSWorkspace.shared.open()` / `UIApplication.shared.open()` |

### Reload mechanism
`updateNSView` / `updateUIView` compares `coordinator.lastURL != url || coordinator.lastReloadToken != appState.reloadToken`. If either changed → `webView.load(URLRequest(url:))`. This enables programmatic reload via `appState.reloadCurrentPage()` (sets `reloadToken = UUID()`).

**ProgressView overlay:** top-trailing corner of the web view during loads.

---

## 3.11 CerniqAppState — Observable State Machine

`@MainActor @Observable final class` — single source of truth for both apps.

### Persisted state (UserDefaults)

| Property | Type | Default | Key |
|----------|------|---------|-----|
| `selectedEnvironment` | `CerniqEnvironment` | `.production` | `cerniq.apple.selected-environment` |
| `customBaseURL` | `String` | `""` | `cerniq.apple.custom-base-url` |
| `selectedDestination` | `CerniqDestination` | `.home` (mac) / `.reports` (iOS) | `cerniq.apple.selected-destination` |
| `openExternalLinksInBrowser` | `Bool` | `false` | `cerniq.apple.open-external-links` |

### Transient state (not persisted)

| Property | Initial | Purpose |
|----------|---------|---------|
| `browserIsLoading` | `false` | Drives ProgressView overlay in WKWebView |
| `browserTitle` | `"CERNIQ"` | Window/tab title from page title |
| `reloadToken` | `UUID()` | Changes to trigger WKWebView reload |

### Key computed properties

```swift
var currentURL: URL {
    resolvedURL(for: selectedDestination.isNativeHome ? .portal : selectedDestination)
}

func resolvedURL(for destination: CerniqDestination) -> URL {
    guard let path = destination.path else { return resolvedBaseURL() }
    return resolvedBaseURL().appending(path: trimmedPath(path))
}

func resetEnvironment() {
    selectedEnvironment = .production
    customBaseURL = ""
    openExternalLinksInBrowser = false
    reloadCurrentPage()
}
```

---

## 3.12 CerniqDestination — Navigation Manifest

Complete enum for all navigable states:

| Case | Title | SF Symbol | Web Path | isNativeHome |
|------|-------|-----------|----------|--------------|
| `.home` | Launchpad | `sparkles.rectangle.stack` | nil | ✅ |
| `.portal` | Portal | `building.2.crop.circle` | `/portal` | ❌ |
| `.submitData` | Submit Data | `square.and.arrow.up` | `/portal/submit` | ❌ |
| `.reports` | Reports | `doc.text.magnifyingglass` | `/portal` | ❌ |
| `.dashboard` | Dashboard | `chart.line.uptrend.xyaxis` | `/dashboard` | ❌ |
| `.billing` | Billing | `creditcard` | `/portal/billing` | ❌ |
| `.settings` | Settings | `slider.horizontal.3` | `/portal/settings` | ❌ |
| `.login` | Login | `person.crop.circle.badge.checkmark` | `/login` | ❌ |
| `.status` | Status | `waveform.path.ecg` | `/status` | ❌ |

`launchpadDestinations`: all cases except `.home` — rendered in the Quick Launch grid.

---

## 3.13 CerniqEnvironment — App Layer

```swift
enum CerniqEnvironment: String, CaseIterable, Identifiable {
    case production  // https://cerniq.io
    case local       // http://localhost:3001
    case custom      // user-specified URL
}
```

**Custom URL sanitization:**
1. Trim whitespace
2. Strip trailing slashes (`/+$` regex)
3. Validate scheme present via `URL(string:)` + `url.scheme != nil`
4. Fall back to `https://cerniq.io` if malformed

---

## 3.14 CerniqContractsCheck — Contract Verification

Executable target. Run from `apple/`:
```bash
swift run CerniqContractsCheck
# Expected: "CerniqContractsCheck passed"
# On failure: exits non-zero with message identifying which contract drifted
```

### Three verification scenarios

**1. verifyLoginRequest()**
- Builds `URLRequest` from `AuthAPI.login(email: "ANA@COOP.PR", password: "secret")`
- Asserts: URL = `https://api.cerniq.io/api/auth/login`
- Asserts: method = `POST`
- Asserts: body decodes to `{ email: "ana@coop.pr", password: "secret" }` (email lowercased)

**2. verifyTokenBackedLogin()**
- MockNetworkSession serves `auth-login.json` fixture
- Runs `AuthSessionManager.login()`
- Asserts: `result.authenticationMode == .tokenBacked`
- Asserts: `store.loadAccessToken() == "at_123"`
- Asserts: `store.loadRefreshToken() == "rt_123"`

**3. verifyLiveOverviewComposition()**
- MockNetworkSession routes by URL path to 4 fixtures: `auth-profile.json`, `institutions.json`, `portal-settings.json`, `alm-summary.json`
- Runs `LiveWorkspaceOverviewService.fetchOverview()`
- Asserts: `snapshot.user.email == "ana@coop.pr"`
- Asserts: `snapshot.settings.subscriptionTier == "annual"`
- Asserts: `snapshot.highlights` contains `{ id: "duration-gap", value: "1.80" }`
- Asserts: `snapshot.summary?.liquidityCoverageRatio == 115.5`

---

## 3.15 Build Commands Reference

```bash
# From apple/
swift build                          # Build all SPM targets
swift run CerniqContractsCheck       # Run contract verification
swift test                           # Unit tests (requires full Xcode for XCTest)

# From apple/CerniqApple/ (requires Xcode 16+)
xcodebuild -scheme "CERNIQ macOS" -destination "platform=macOS" build
xcodebuild -scheme "CERNIQ iOS" -destination "platform=iOS Simulator,name=iPhone 16 Pro" build
xcodebuild -scheme "CERNIQ macOS" test

# App Store / notarization
xcrun notarytool submit CERNIQ.app.zip --apple-id ... --password ...
xcrun altool --upload-app -f CERNIQ.ipa --type ios
```

---

## 3.16 What Requires Full Xcode (Next Phase)

The current setup builds and verifies with Swift Command Line Tools only. Full Xcode is required for:

- [ ] Real multiplatform app target builds (iOS device + macOS app bundle)
- [ ] Bundle identifiers: `io.cerniq.macos`, `io.cerniq.ios`
- [ ] Signing certificates + provisioning profiles (Apple Developer account)
- [ ] Entitlements: `com.apple.keychain-access-groups`, APN push notifications, App Groups for widgets
- [ ] Asset catalogs: `AppIcon.appiconset`, `AccentColor.colorset`, launch image
- [ ] Simulator runs + device debugging
- [ ] Xcode Previews (SwiftUI canvas)
- [ ] XCUITest UI automation suites
- [ ] TestFlight beta distribution
- [ ] Mac App Store / iOS App Store submission

---

*KLYTICS LLC · Proprietary & Confidential · cerniq.io*
