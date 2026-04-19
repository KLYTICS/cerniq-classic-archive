# Part IX — Product Roadmap & $10M MRR Path

> **Audience:** Product, Engineering, Design, GTM
> **Last updated:** April 2026

---

## 9.1 Apple Platform Release Roadmap

| Release | Status | Target | Engineering Unlock | Key Deliverables |
|---------|--------|--------|-------------------|-----------------|
| **v0.1 — SPM Foundation** | ✅ Complete | Q1 2026 | Swift 6 + SPM only | CerniqDomain, CerniqAPI, CerniqAuth, CerniqFeatures, CerniqMacApp (shell), CerniqiOSApp (scaffold), CerniqContractsCheck |
| **v0.2 — Xcode Integration** | 🔄 In Progress | Q2 2026 | Xcode 16+ on CI runner | Full CerniqApple.xcodeproj; CI builds for macOS + iOS; unit test suites green; ContractsCheck in CI gate |
| **v1.0 — macOS App Store** | 📅 Planned | Q2 2026 | Apple Developer account, signing certs | Bundle ID `io.cerniq.macos`, entitlements, app icon, notarization, App Store listing (EN + ES), TestFlight beta |
| **v1.1 — iOS App Store** | 📅 Planned | Q3 2026 | iOS signing, APNs cert | Bundle ID `io.cerniq.ios`, iPhone + iPad layout, Face ID/Touch ID keychain auth, push notification entitlement, App Store listing |
| **v1.2 — Live Native Data** | 📅 Planned | Q3 2026 | Stable `/api/alm/institutions` + summary routes | LiveWorkspaceOverviewService wired in production builds; native login UI (email/password + OAuth buttons); KeychainCredentialStore in production targets |
| **v2.0 — Native CSV Submit** | 📅 Planned | Q4 2026 | — | FileImporter (macOS NSOpenPanel / iOS DocumentPicker) → native CSV validation UI → multipart upload to `/api/portal/balance-sheet/upload` → progress indicator → job polling |
| **v2.1 — Push Notifications** | 📅 Planned | Q4 2026 | Backend APNs provider integration | APNs push for `ReportJob COMPLETE` events; "Your ALM report is ready" with deep link to presigned URL |
| **v2.2 — App Intents / Siri** | 📅 Planned | Q1 2027 | — | "Get my LCR ratio", "Submit ALM data", "Download latest report" as Siri-addressable App Intents |
| **v3.0 — Widget Extension** | 📅 Planned | Q2 2027 | WidgetKit + background refresh entitlement | macOS Dashboard Widget + iOS Lock Screen Widget: live LCR, Duration Gap, NIM from cached API data |
| **v3.1 — watchOS Companion** | 📅 Planned | Q3 2027 | watchOS target + WatchConnectivity | Glanceable KPI summary on Apple Watch; critical risk alert on wrist |

---

## 9.2 Web Platform Roadmap

| Feature | Target | Priority | Description |
|---------|--------|----------|-------------|
| NCUA Form 5300 GA | Q2 2026 | P0 | Extends TAM to all 4,800 US federal credit unions; automated quarterly call report data package |
| White-label API | Q3 2026 | P0 | REST API + TypeScript SDK for CPA firms and financial technology partners |
| Multi-currency support | Q3 2026 | P1 | Puerto Rico institutions with USD + foreign currency positions |
| Advanced COSSEC exam prep | Q4 2026 | P1 | AI-generated mock exam questions based on current exam patterns |
| Core banking integrations | Q1 2027 | P1 | Fiserv, Jack Henry, FIS connectors for automated balance sheet import |
| LATAM regulatory modules | Q2 2027 | P2 | Dominican Republic BANRESERVAS, Colombia Superfinanciera |
| Real-time rate feeds | Q3 2027 | P2 | Bloomberg / Refinitiv data integration for live rate shock calculations |

---

## 9.3 $10M MRR — Department Deliverables Matrix

### Engineering Team — Next 90 Days

**Apple Platform (Critical path):**
- [ ] Complete CerniqApple.xcodeproj with working macOS + iOS builds
- [ ] Wire KeychainCredentialStore to both production app targets
- [ ] Replace PreviewWorkspaceOverviewService with LiveWorkspaceOverviewService in production
- [ ] Implement native login UI: email/password form + OAuth (Google) button
- [ ] macOS App Store submission: bundle ID, signing, notarization, TestFlight
- [ ] iOS TestFlight beta: push notification entitlement, iPhone + iPad layouts
- [ ] Expand CerniqContractsCheck to 10+ API routes
- [ ] XCTest unit suites: CerniqAPITests (URL construction, error cases), CerniqAuthTests (token lifecycle, keychain), CerniqDomainTests (Codable round-trips)

**Backend (Critical path for Apple app):**
- [ ] Stabilize `/api/alm/institutions` response shape (finalize and lock fixture)
- [ ] Stabilize `/api/alm/{id}/summary` response shape
- [ ] APNs push notification provider integration (for v2.1)
- [ ] WebSocket push for `ReportJob` status transitions (feeds native app polling)

**Infrastructure:**
- [ ] macOS GitHub Actions runner configured with Xcode 16+
- [ ] Fastlane match + gym + pilot configured for automated TestFlight uploads
- [ ] Sentry SDK integrated in both app targets

---

### AI Team — Next 90 Days

- [ ] CoreML binary classifier for MetricStatus (LCR, Duration Gap → healthy/monitor/critical)
  - Training data: 500 synthetic institution snapshots with labeled status
  - Target model size: < 500KB
  - Integration: replace `buildHighlights()` risk logic with CoreML inference
- [ ] AI Advisor integration in macOS sidebar as native WebSocket-backed view
- [ ] ALM narrative latency optimization (target P95 < 2 seconds for executive summary)
- [ ] Spanish fine-tuning dataset curation (COSSEC bulletins, NCUA guidance, board reports)
- [ ] Fine-tuning job: gpt-4o-mini on cooperativa regulatory vocabulary
- [ ] A/B test: fine-tuned vs base GPT-4o on 50 COSSEC commentary prompts

---

### Design Team — Next 90 Days

**App icons (blocking App Store submission):**
- [ ] macOS app icon: all sizes (16 → 1024px), dark mode variant, meet Apple HIG flat icon spec
- [ ] iOS app icon: 1024×1024px master, all required sizes generated, no alpha channel
- [ ] Asset catalog: `CerniqApple.xcassets` with AppIcon.appiconset + AccentColor.colorset

**Onboarding:**
- [ ] First-launch empty state design (macOS): what to do when workspace has no institutions
- [ ] Setup wizard flow: institution creation → first CSV upload → report generation
- [ ] Progress indicators for report generation pipeline (animated steps)

**App Store:**
- [ ] macOS App Store screenshots (2560×1600px, minimum 3): launchpad, analysis view, report view
- [ ] iOS screenshots: iPhone 6.9" + iPad Pro 13" sizes
- [ ] App preview video: 30-second walkthrough of submit → report workflow

**Documentation:**
- [ ] Native component design specs in Figma: dark mode variants, spacing tokens, accessibility notes
- [ ] Widget design mockup (macOS Dashboard Widget, iOS Lock Screen Widget)

---

### DevOps Team — Next 90 Days

- [ ] macOS GitHub Actions runner: `runs-on: macos-14` (or `macos-15-xlarge`) with Xcode 16.3+
- [ ] Fastlane configuration: `Matchfile`, `Fastfile` with `beta` and `release` lanes
- [ ] App Store Connect API key: `APPLE_API_KEY_ID`, `APPLE_API_ISSUER_ID`, `APPLE_API_KEY` secrets in GitHub
- [ ] TestFlight automation: auto-distribute to internal testers on every `main` merge
- [ ] Sentry project setup: `CERNIQ macOS` + `CERNIQ iOS` projects; DSN in CI secrets
- [ ] Crash reporting alert: Sentry → Slack alert on new crash type in production
- [ ] Railway autoscaling: configure scale-to-2-replicas when CPU > 70% sustained 3 min

---

### Product Team — Next 90 Days

**App Store listing (required before submission):**
- [ ] App name: `CERNIQ — ALM Intelligence` (macOS) / `CERNIQ ALM` (iOS, 30-char limit)
- [ ] Subtitle (30 chars): `Board-ready ALM for cooperativas`
- [ ] Description (EN + ES): full feature list, regulatory credentials, 3 social proof quotes
- [ ] Keywords (100 chars): `ALM,cooperativa,COSSEC,credit union,liquidity,risk,Puerto Rico,finance,compliance,banking`
- [ ] What's New: v1.0 release notes (EN + ES)

**Metrics & Analytics:**
- [ ] Define native app KPI dashboard in Metabase:
  - DAU, MAU, DAU/MAU ratio
  - Session duration by destination (home vs browser scenes)
  - Report generation initiations from native app
  - Push notification opt-in rate
  - App Store rating + review volume
- [ ] Funnel: App Store view → download → first launch → first report → paid conversion

**Customer Research:**
- [ ] 3 CFO interviews at COSSEC cooperativas: validate native app workflow preferences (submit data priority, push vs email notification preference)
- [ ] 2 board member interviews: validate home screen KPI card design (what metrics matter at board level)
- [ ] Pricing test: $199 vs $299 Starter for cooperativas with $100M–$300M assets

---

## 9.4 MRR Milestones

| Milestone | Target Date | Leading Indicators |
|-----------|-------------|-------------------|
| First 10 paying customers | Q2 2026 | 50 demo requests, 200 free analyses run |
| $50K MRR | Q3 2026 | 150 paying customers at $333 avg |
| macOS App Store launch | Q2 2026 | App Store approval, 4.5+ star rating target |
| iOS App Store launch | Q3 2026 | 1,000 downloads first 30 days |
| $250K MRR | Q4 2026 | 500 paying customers, NRR > 110% |
| $1M MRR | Q2 2027 | NCUA module GA, first enterprise contract |
| $2M MRR | Q4 2027 | Core banking integration, 5,000 paying customers |
| $10M MRR | 2028+ | LATAM expansion, white-label platform, 30,000 customers |

---

## 9.5 Feature Flag Strategy

All major features are gated behind feature flags to enable safe rollouts:

| Flag | Default | Rollout Plan |
|------|---------|-------------|
| `live_workspace_overview` | `false` (preview service) | Enable for internal users → 10% → 50% → 100% after login UI ships |
| `native_csv_submit` | `false` | Enable after backend upload API stabilized and native FileImporter built |
| `push_notifications` | `false` | Enable after APNs cert provisioned and backend provider integrated |
| `ai_advisor_sidebar` | `false` | Enable after latency < 2s validated on 100 test queries |
| `coreml_metric_status` | `false` | Enable after CoreML model validated against server-computed values on 1,000 snapshots |
| `siri_shortcuts` | `false` | Enable after App Intents registered and tested on physical device |
| `ncua_form_5300` | `false` | Enable for beta CUs after manual QA of 5 institutions' Form 5300 outputs |

---

*KLYTICS LLC · Proprietary & Confidential · cerniq.io*
