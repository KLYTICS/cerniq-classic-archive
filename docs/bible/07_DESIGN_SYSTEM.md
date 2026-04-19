# Part VII — Design System & UX Architecture

> **Audience:** Designers, Design Engineers, Frontend Engineers
> **Last updated:** April 2026

---

## 7.1 Design Philosophy

**"Native first, branded second."**

The CERNIQ Apple app must feel like a natural macOS/iOS citizen that happens to carry CERNIQ's identity. We embrace platform conventions (NavigationSplitView, TabView, SF Symbols, system materials) and apply CERNIQ's visual identity on top — not the other way around.

The web app follows **"data-first clarity"** — complex financial data must be immediately readable. No decorative chrome, no shadows for the sake of shadows. Every UI element earns its place by helping the user understand their ALM position faster.

---

## 7.2 Color System — Apple Platforms

All colors are specified as `Color(red:green:blue:)` in SwiftUI or hex for reference. Use semantic system colors where possible (`.primary`, `.secondary`, `.accent`) to ensure correct dark mode behavior.

| Token | SwiftUI / Hex | Usage |
|-------|--------------|-------|
| **Primary Navy** | `Color(red: 0.10, green: 0.31, blue: 0.56)` / `#1A4F8E` | Heading tint, icon accent, primary CTA button tint, environment label color |
| **Gradient Start** | `Color(red: 0.95, green: 0.97, blue: 0.99)` / `#F2F7FD` | Top-leading gradient stop on Home and Browser scenes |
| **Gradient End** | `Color(red: 1.00, green: 0.98, blue: 0.94)` / `#FFFAF0` | Bottom-trailing gradient stop — warm undertone for Puerto Rican warmth |
| **Metric Healthy** | `.green` | `MetricStatus.healthy` — LCR ≥ 100%, institution count > 0 |
| **Metric Monitor** | `.orange` | `MetricStatus.monitor` — Duration Gap present but < 2.0, KPI absent |
| **Metric Critical** | `.red` | `MetricStatus.critical` — LCR < 100%, Duration Gap ≥ 2.0, no institutions |
| **Card Background (primary)** | `.regularMaterial` | Environment card — vibrancy-aware, dark-mode safe |
| **Card Background (metric)** | `.thinMaterial` | Metric cards |
| **Card Background (institution)** | `.ultraThinMaterial` | Institution list items |
| **Card Stroke** | `.primary.opacity(0.08)` | All card overlays (1pt stroke) |
| **Quick Launch Fill** | `Color.white.opacity(0.82)` | Quick Launch destination cards |

---

## 7.3 Typography System — Apple Platforms

Uses Dynamic Type throughout — all font descriptors must use system scaling.

| Use | Font | SwiftUI |
|-----|------|---------|
| Workspace name (header) | System, largeTitle, semibold | `.font(.largeTitle).fontWeight(.semibold)` |
| Section headings | System, title3, semibold | `.font(.title3).fontWeight(.semibold)` |
| Destination card title | System, headline | `.font(.headline)` |
| Metric value | System, title2, semibold | `.font(.title2).fontWeight(.semibold)` |
| Body / description | System, body | `.font(.body)` |
| Secondary labels | System, subheadline | `.font(.subheadline).foregroundStyle(.secondary)` |
| Status label | System, caption | `.font(.caption)` |
| Environment URL | System, callout, monospaced | `.font(.callout.monospaced())` |
| CERNIQ badge label | System, caption, semibold, uppercase | `.font(.caption.weight(.semibold)).textCase(.uppercase)` |
| Home hero title | System, 34pt, bold, rounded | `.font(.system(size: 34, weight: .bold, design: .rounded))` |

**Accessibility:** All text must remain readable at Dynamic Type size `accessibilityExtraExtraLarge`. Test using the Accessibility Inspector in Xcode or device Settings → Accessibility → Display & Text Size.

---

## 7.4 Spacing & Corner Radius

| Element | Corner Radius | Padding |
|---------|--------------|---------|
| Environment card | 24pt | 20pt internal |
| Quick Launch card | 22pt | 18pt internal |
| Header section card | 20pt | 20pt internal |
| Metric card | 18pt | 18pt internal |
| Institution card | 16pt | 16pt internal |
| Browser scene WKWebView | 20pt | 20pt container |
| Overall page padding | — | 20pt (macOS), 16pt (iOS) |
| Quick Launch grid gap | — | 16pt |
| Metric grid gap | — | 16pt |

---

## 7.5 Component Catalog — Native SwiftUI

### CerniqHomeView — Quick Launch Card
```
┌──────────────────────────────────────┐  ← white 82% opacity, 22pt corners, 1px stroke
│  [icon]  ← SF Symbol, title2.semibold,   │
│           navy tint                      │
│                                          │
│  Destination Title  ← headline           │
│                                          │
│  Summary text that explains what         │
│  this section does in context.  ← subheadline, secondary
│                                          │
│  ⬇ Spacer                               │
│                                          │
│  Open           →  ← caption.semibold    │
│       (navy tint)                        │
└──────────────────────────────────────┘
Min height: 180pt
Grid: LazyVGrid, adaptive min: 220pt, max: 320pt, spacing: 16pt
```

### CerniqBrowserScene — Header Bar
```
[Destination Title (largeTitle, rounded, bold)]    [Reload] [Open in Browser →]
[Summary description (callout, secondary)]
[🌐 https://cerniq.io (caption, secondary)]
──────────────────────────────────────────────
[WKWebView (20pt corner radius, 1px stroke)]
```

### WorkspaceOverviewView — Metric Card
```
┌───────────────────────────────┐  ← thinMaterial, 18pt corners
│  Duration Gap         ← headline           │
│                                            │
│  1.80                 ← title2.semibold    │
│                                            │
│  Monitor              ← caption, .orange  │
└───────────────────────────────┘
```

### WorkspaceOverviewView — Institution Card
```
┌───────────────────────────────────────────┐  ← ultraThinMaterial, 16pt corners
│  CoopAhorro San Juan          ← headline  │
│  Cooperativa  Q1-2026  $250,000,000       │
│  ← subheadline HStack, secondary         │
└───────────────────────────────────────────┘
```

---

## 7.6 SF Symbol Usage

All icons must use SF Symbols — never custom assets for navigation or action icons.

| Context | Symbol | Notes |
|---------|--------|-------|
| Launchpad (home) | `sparkles.rectangle.stack` | Home destination identity |
| Portal | `building.2.crop.circle` | Institution / cooperative building motif |
| Submit Data | `square.and.arrow.up` | Standard upload convention |
| Reports | `doc.text.magnifyingglass` | Document + analysis |
| Dashboard | `chart.line.uptrend.xyaxis` | ALM analytics identity |
| Billing | `creditcard` | Standard billing |
| Settings | `slider.horizontal.3` | Operator preferences |
| Login | `person.crop.circle.badge.checkmark` | Authenticated identity |
| Status | `waveform.path.ecg` | System health / vital signs |
| Environment (server) | `server.rack` | Environment configuration section |
| Network / URL | `network` | Base URL display |
| Open in browser | `safari` | System browser action |
| Reload | `arrow.clockwise` | Page reload |
| Loading indicator | `ProgressView()` | System spinner, top-trailing corner |

---

## 7.7 macOS vs iOS Layout Differences

| Surface | macOS | iOS |
|---------|-------|-----|
| Root navigation | `NavigationSplitView` (sidebar + detail) | `TabView` (4 tabs) |
| Sidebar | Persistent; lists all 9 destinations | Not present; tabs are Home, Portal, Workspace, Account |
| Settings | `Settings {}` scene (menu bar: CERNIQ → Settings...) | Settings tab in TabView |
| Window min size | 1,120 × 760pt | Full screen |
| Home padding | 20pt | 20pt |
| Destination card min | 220pt (adaptive grid) | 220pt (adaptive grid, smaller per-screen) |
| Browser chrome | Header bar with title + 2 buttons | NavigationBar (inline) |
| External links | Routed via NSWorkspace | Routed via UIApplication |

---

## 7.8 Accessibility Requirements

### Mandatory

- **Dynamic Type:** All text uses system font descriptors. Never hard-code a pixel font size without a dynamic type equivalent.
- **VoiceOver labels:** All `Image(systemName:)` used alone (without `Label()`) must have `.accessibilityLabel()`. Quick Launch cards need `.accessibilityLabel("\(destination.title). \(destination.summary)")`.
- **Color independence:** `MetricStatus` visual meaning must never rely on color alone. Status text label ("`Healthy`", "`Monitor`", "`Critical`") is always shown alongside the color.
- **Keyboard navigation (macOS):** Full Tab-cycle through sidebar list, environment picker, Quick Launch grid, and action buttons. All interactive elements must be focusable. Test with Keyboard Access enabled in macOS Settings.
- **Reduce Motion:** Current shell has no animations. Any future animation must check `@Environment(\.accessibilityReduceMotion)` and skip or replace with instant transition.
- **Minimum tap target (iOS):** All tappable elements must be ≥ 44×44pt. Quick Launch cards (min 180pt height) pass. Buttons in header bars must be verified.

### Recommended

- **Contrast ratio:** All body text on system background should achieve WCAG AA (4.5:1 minimum). Navy (#1A4F8E) on white: ✅. Green/orange/red status on material backgrounds: verify with Accessibility Inspector.
- **Smart Invert:** Materials invert correctly. `Color.white.opacity(0.82)` on Quick Launch cards should be tested in Smart Invert mode.

---

## 7.9 Web Design System (Frontend)

### Tailwind CSS 4 Tokens

| Token | Tailwind Class | Value |
|-------|---------------|-------|
| Primary navy | `text-cerniq-navy` / `bg-cerniq-navy` | `#1A2E5A` |
| Accent blue | `text-cerniq-blue` / `bg-cerniq-blue` | `#1C4F91` |
| Healthy green | `text-green-700` | `#15803D` |
| Warning orange | `text-orange-600` | `#EA580C` |
| Critical red | `text-red-700` | `#B91C1C` |
| Surface | `bg-white` / `bg-slate-50` | — |
| Border | `border-slate-200` | `#E2E8F0` |

### Component Library (shared/)
All shared components are accessible, i18n-aware, and dark-mode safe:
- `Button` — variants: primary, secondary, ghost, danger
- `Input`, `Select`, `Textarea`, `Checkbox`, `Radio`
- `Modal`, `Drawer`, `Popover`, `Tooltip`
- `Table`, `DataGrid` — sortable, filterable, bilingual column headers
- `Badge`, `Tag`, `StatusDot` — MetricStatus color system mirrored from native
- `AlertBanner` — info, warning, error, success variants
- `SkeletonLoader` — for all data-fetching states
- `Chart wrappers` — Recharts + Plotly with bilingual support

### WKWebView Compatibility Requirements

The web app must work inside WKWebView without degradation:

1. **JavaScript enabled:** WKWebView has JS enabled (`allowsContentJavaScript = true`). All interactive features work.
2. **No localStorage assumptions for auth:** Auth is cookie-based in WKWebView. Never rely on `localStorage` for auth tokens in the web app — use `httpOnly` cookies instead.
3. **Safe area:** iOS WKWebView reports safe area insets. Use `env(safe-area-inset-bottom)` in CSS for content that may be obscured by the home indicator or tab bar.
4. **prefers-color-scheme:** WKWebView inherits system appearance. Web app must support `prefers-color-scheme: dark` for correct dark mode behavior.
5. **No pop-up windows:** `window.open()` will not work in WKWebView by default. All actions must use in-page navigation.
6. **Back/forward:** `allowsBackForwardNavigationGestures = true` (iOS only). Web app must not break browser history — use pushState correctly.

---

## 7.10 App Store Assets — Requirements

### macOS
| Asset | Size | Format |
|-------|------|--------|
| App icon (all sizes) | 16, 32, 64, 128, 256, 512, 1024px | PNG, @1x and @2x |
| App preview screenshots | 2560×1600px | PNG |
| App Store promotional artwork | 2048×1024px | JPEG/PNG |

### iOS
| Asset | Size | Format |
|-------|------|--------|
| App icon | 1024×1024px (App Store), all required sizes | PNG |
| iPhone 6.9" screenshots | 1320×2868px | PNG (minimum 3, maximum 10) |
| iPhone 6.7" screenshots | 1290×2796px | PNG |
| iPad Pro 13" screenshots | 2064×2752px | PNG |
| App preview video | 15–30 seconds, 1920×1080px | MP4/MOV |

### Icon Design Brief
- Background: deep navy gradient (`#1A2E5A` → `#0D1B38`)
- Foreground: simplified ALM waveform or ascending bar chart in white/gold
- No text in icon
- Must be legible at 16×16px (macOS menu bar, Dock small)
- Must comply with Apple's flat icon guidelines (no shadows, no gloss)

---

*KLYTICS LLC · Proprietary & Confidential · cerniq.io*
