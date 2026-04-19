# Part V — Frontend Engineering Reference

> **Audience:** Frontend Engineers, Design Engineers
> **Last updated:** April 2026

---

## 5.1 Overview

The CERNIQ frontend is a **Next.js 16 App Router** application with 100+ routes deployed on Vercel. It serves as both the main web product and the embedded web experience inside the macOS/iOS WKWebView shell.

**Entry:** `frontend/app/layout.tsx`
**Dev server:** `http://localhost:3001`

---

## 5.2 Directory Structure

```
frontend/
├── app/                     # Next.js App Router pages
│   ├── (marketing)/         # Route group: public marketing pages
│   ├── admin/               # Admin panel (leads, pipeline, metrics)
│   ├── alm/                 # 62 ALM analysis module pages
│   ├── auth/                # Auth flows
│   ├── backtest/            # Backtesting module
│   ├── compliance/          # COSSEC/NCUA compliance hub
│   ├── dashboard/           # Main ALM dashboard
│   ├── demo/                # Interactive product demo
│   ├── enterprise/          # Enterprise-tier features
│   ├── expenses/            # SpendCheck expense tracking
│   ├── login/               # Login (email, OAuth, magic link)
│   ├── onboarding/          # New user onboarding wizard
│   ├── options/             # Options pricing module
│   ├── portal/              # Client portal (submit, reports, settings, billing)
│   ├── portfolios/          # Portfolio management
│   ├── pricing/             # Pricing page
│   ├── risk-analytics/      # Risk analytics surface
│   ├── settings/            # Account settings
│   ├── signup/              # Registration
│   ├── status/              # Platform status page
│   ├── stress-test/         # Stress testing module
│   ├── strategy/            # Strategy management
│   └── ...                  # 40+ more routes
├── components/              # React components (16 directories)
│   ├── alm/                 # ALM-specific charts and inputs
│   ├── auth/                # Auth forms and flows
│   ├── charts/              # Financial chart wrappers (Recharts, Plotly)
│   ├── compliance/          # COSSEC compliance components
│   ├── dashboard/           # Dashboard layout and widgets
│   ├── portal/              # Portal components (upload wizard, report table)
│   ├── shared/              # Shared UI primitives
│   └── ...
├── hooks/                   # Custom React hooks (30+ files)
├── lib/                     # Core libraries
│   ├── api/                 # API client (typed fetch wrappers)
│   ├── stores/              # Zustand stores
│   ├── i18n/                # ES/EN translation system
│   ├── utils/               # Utility functions
│   └── auth/                # Client-side auth helpers
├── types/                   # TypeScript type definitions
├── e2e/                     # Playwright E2E tests
├── __tests__/               # Vitest unit tests
├── public/                  # Static assets
├── next.config.ts           # Next.js configuration
├── vercel.json              # Vercel deployment + API rewrites
├── tailwind.config.ts       # Tailwind CSS 4 configuration
└── playwright.config.ts     # E2E test configuration
```

---

## 5.3 Route Inventory — Key Routes

| Route | Purpose | Auth | WKWebView Accessible |
|-------|---------|------|---------------------|
| `/` | Landing / marketing homepage | No | ✅ |
| `/login` | Email/password, OAuth, magic link | No | ✅ |
| `/signup` | Account registration + plan selection | No | ✅ |
| `/dashboard` | Main ALM dashboard hub | Yes | ✅ |
| `/alm/duration-gap` | Duration Gap analysis module | Yes | ✅ |
| `/alm/nii-sensitivity` | NII Sensitivity | Yes | ✅ |
| `/alm/eve` | Economic Value of Equity | Yes | ✅ |
| `/alm/lcr` | Liquidity Coverage Ratio | Yes | ✅ |
| `/alm/bpv` | Basis Point Value | Yes | ✅ |
| `/alm/monte-carlo` | Monte Carlo stress testing | Yes | ✅ |
| `/alm/cossec` | COSSEC compliance module | Yes | ✅ |
| `/alm/*` | All 62 ALM modules | Yes | ✅ |
| `/portal` | Institution portal: reports, workspace | Yes | ✅ |
| `/portal/submit` | CSV upload wizard (primary Apple entry) | Yes | ✅ |
| `/portal/settings` | Workspace settings, API keys | Yes | ✅ |
| `/portal/billing` | Stripe billing portal | Yes | ✅ |
| `/compliance` | COSSEC/NCUA compliance hub | Yes | ✅ |
| `/stress-test` | Stress testing dashboard | Yes | ✅ |
| `/risk-analytics` | Risk analytics surface | Yes | ✅ |
| `/pricing` | Pricing page (cooperativa tiers) | No | ✅ |
| `/status` | Platform status page | No | ✅ |
| `/admin/*` | Admin panel (leads, prospects, metrics) | Admin key | ✅ |
| `/demo` | Interactive product demo | No | ✅ |

---

## 5.4 State Management Architecture

### Zustand Stores (`lib/stores/`)
Global client state — synchronous, non-async:

| Store | State | Purpose |
|-------|-------|---------|
| `authStore` | `user`, `session`, `isAuthenticated` | Current auth session |
| `institutionStore` | `selectedInstitution`, `institutions` | Active institution selection |
| `almStore` | `activeModule`, `runHistory` | ALM module selection + run history |
| `uiStore` | `locale`, `theme`, `sidebarOpen` | UI preferences |

### React Query / SWR
Server state caching for all API calls:
- Background refetch on window focus
- Stale-while-revalidate for institution data (30-second stale time)
- Optimistic updates for report job status polling

### URL State
ALM module configuration (date ranges, scenario parameters, institution selection) encoded in URL search params — enables shareable analysis URLs and browser back/forward navigation within WKWebView.

---

## 5.5 i18n — Bilingual ES/EN System

CERNIQ's bilingual system is purpose-built for the Puerto Rico cooperativa market. Spanish is the **primary language**; English is the secondary export format.

### Coverage
- All UI text, labels, error messages, tooltips
- PDF report generation (14+ pages in user's selected locale)
- Transactional emails (Resend templates in both languages)
- COSSEC compliance commentary
- ALM analysis narratives (OpenAI generates in user's language)

### Implementation (`lib/i18n/`)
- Custom translation hook: `useTranslation()`
- Locale stored in Zustand `uiStore.locale` + `localStorage` for persistence
- Server Components: locale passed via `cookies()` or `headers()` for SSR
- Translation keys: `t('alm.duration_gap.title')` → `"Duration Gap"` (EN) / `"Brecha de Duración"` (ES)

### Locale Switcher
Available in the portal header. Changing locale:
1. Updates `uiStore.locale`
2. Persists to `localStorage`
3. Re-renders all client components via Zustand subscription
4. Next report PDF generated in new locale

---

## 5.6 API Client (`lib/api/`)

Typed fetch wrappers around all backend endpoints. Pattern:

```typescript
// lib/api/alm.ts
export async function listInstitutions(): Promise<InstitutionSummary[]> {
  const res = await apiFetch('/api/alm/institutions')
  return res.data
}

export async function getALMSummary(institutionId: string): Promise<ALMSummary> {
  const res = await apiFetch(`/api/alm/${institutionId}/summary`)
  return res.data
}
```

`apiFetch` is a thin wrapper that:
1. Adds `Authorization: Bearer <token>` from cookie/session
2. Parses the `{ success, data, error }` envelope
3. Throws typed `APIError` on non-2xx or `success: false`
4. Works identically in browser and WKWebView (same-origin `/api/*` proxy)

---

## 5.7 Component Architecture

### Design Principles
- **Server Components first** — all data-fetching components are RSC; client components only when interactivity required
- **Compound components** — complex surfaces (portal submit wizard, ALM module page) composed from small, testable primitives
- **Co-location** — each route folder contains page-specific components alongside the page
- **Shared primitives** — `components/shared/` contains Button, Input, Select, Modal, Table, Badge, Tooltip — all Tailwind-based, all accessible

### Chart Library
- **Recharts** — time-series charts (NII sensitivity over rate scenarios, LCR trend)
- **Plotly.js** — heatmaps (correlation matrix), 3D surfaces (yield curve scenarios), histograms (Monte Carlo distribution)
- All charts are bilingual — axis labels, tooltips, and legends use `useTranslation()`

---

## 5.8 Vercel Configuration

```json
// vercel.json (key parts)
{
  "rewrites": [
    { "source": "/api/:path*", "destination": "https://api.cerniq.io/api/:path*" }
  ],
  "headers": [
    { "source": "/(.*)", "headers": [{ "key": "X-Content-Type-Options", "value": "nosniff" }] }
  ]
}
```

The `/api/*` rewrite is the critical bridge — it allows:
- Browser to call `/api/...` without CORS (same origin)
- WKWebView (iOS/macOS) to call the same relative paths without any additional configuration
- No CORS setup needed on the backend for web clients

---

## 5.9 Performance Targets

| Metric | Target | Measurement |
|--------|--------|-------------|
| LCP (Largest Contentful Paint) | < 1.5s | Vercel Analytics |
| FID / INP | < 100ms | Core Web Vitals |
| Dashboard initial load | < 2s | Playwright timing |
| ALM module page load | < 1s | Playwright timing |
| WKWebView first paint | < 1.5s | Measured from app launch |
| Report PDF download initiation | < 500ms after job COMPLETE | Backend logs |

---

## 5.10 Testing

### Unit Tests (Vitest)
```bash
cd frontend && npx vitest run
cd frontend && npm run test:coverage  # LCOV report to coverage/
```

Files: `**/__tests__/**/*.{ts,tsx}` and `**/*.test.{ts,tsx}`

Coverage targets:
- API client functions: 90%
- Zustand store actions: 85%
- Utility functions: 95%
- React hooks: 80%

### E2E Tests (Playwright)
5 spec files, 38 critical path tests:
```bash
cd frontend && bun run test:e2e           # All E2E tests
cd frontend && npm run test:e2e:critical  # Critical path only (used in deploy gate)
cd frontend && npm run test:e2e:production # Smoke test against live cerniq.io
```

Critical path tests cover:
1. Auth flow (register → login → dashboard)
2. Portal submit (CSV upload → dry-run → confirm → report job created)
3. Report download (poll for COMPLETE → presigned URL accessible)
4. Billing flow (pricing page → Stripe checkout → subscription activated)
5. ALM module (duration gap calculation → chart rendered)

---

*KLYTICS LLC · Proprietary & Confidential · cerniq.io*
