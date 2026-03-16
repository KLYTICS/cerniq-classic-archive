# CERNIQ Frontend Reference

> Complete reference for all routes, components, and libraries in `frontend/`.

---

## Overview

The frontend is a **Next.js 16** application using the App Router, React 19, and TypeScript. It uses Bun as the package manager and Tailwind CSS 4 for styling.

**Entry layout:** `app/layout.tsx`
**Global styles:** `app/globals.css`
**Base URL:** `http://localhost:3001` (dev) / `https://cerniq.io` (prod)

---

## Route Map (34 routes)

### Public Routes

| Route | File | Description |
|-------|------|-------------|
| `/` | `app/page.tsx` | Landing page — hero, features, pricing CTA |
| `/login` | `app/login/page.tsx` | Login form (email + OAuth) |
| `/signup` | `app/signup/` | Registration |
| `/pricing` | `app/pricing/page.tsx` | Pricing tiers with Stripe checkout |
| `/thank-you` | `app/thank-you/page.tsx` | Post-purchase confirmation |
| `/demo` | `app/demo/` | Interactive demo |
| `/demo/embed` | `app/demo/embed/page.tsx` | Embeddable demo (iframe-friendly) |
| `/demo-video` | `app/demo-video/` | Demo video page |
| `/onboarding` | `app/onboarding/page.tsx` | New user onboarding flow |
| `/status` | `app/status/` | System status page |

### Portal Routes (Authenticated)

| Route | File | Description |
|-------|------|-------------|
| `/portal` | `app/portal/page.tsx` | Client portal dashboard |
| `/portal/submit` | `app/portal/submit/page.tsx` | CSV upload and report submission |
| `/portal/settings` | `app/portal/settings/page.tsx` | Account and subscription settings |

### ALM & Analytics Routes

| Route | File | Description |
|-------|------|-------------|
| `/alm` | `app/alm/` | ALM analysis dashboard |
| `/dashboard` | `app/dashboard/` | Main analytics dashboard |
| `/risk-analytics` | `app/risk-analytics/` | Risk analysis views |
| `/stress-test` | `app/stress-test/` | Stress testing interface |
| `/var-reports` | `app/var-reports/` | Value at Risk reports |
| `/factor-risk` | `app/factor-risk/` | Factor risk analysis |
| `/risk-parity` | `app/risk-parity/` | Risk parity optimization |

### Market Data Routes

| Route | File | Description |
|-------|------|-------------|
| `/live-data` | `app/live-data/` | Real-time market data |
| `/charts` | `app/charts/` | Interactive charting |
| `/volatility` | `app/volatility/` | Volatility analysis |
| `/volatility-analytics` | `app/volatility-analytics/` | Advanced volatility |

### Portfolio Routes

| Route | File | Description |
|-------|------|-------------|
| `/portfolios` | `app/portfolios/` | Portfolio management |
| `/backtest` | `app/backtest/` | Strategy backtesting |
| `/execution-quality` | `app/execution-quality/` | Trade execution analysis |
| `/strategy` | `app/strategy/` | Strategy builder |
| `/options` | `app/options/` | Options analytics |

### Other Routes

| Route | File | Description |
|-------|------|-------------|
| `/admin` | `app/admin/` | Admin panel |
| `/ai-insights` | `app/ai-insights/` | AI-powered insights |
| `/expenses` | `app/expenses/` | SpendCheck expense tracker |
| `/spendcheck` | `app/spendcheck/` | SpendCheck landing |
| `/pablo` | `app/pablo/` | Pablo demo persona |
| `/roi` | `app/roi/` | ROI calculator |
| `/settings` | `app/settings/` | User settings |
| `/auth` | `app/auth/` | Auth callback handlers |

---

## Component Library (16 directories)

### Core Components (`components/`)

| File | Purpose |
|------|---------|
| `ErrorBoundary.tsx` | React error boundary with fallback UI |
| `FeatureGate.tsx` | Feature flag wrapper component |
| `MarketOverview.tsx` | Market overview widget |
| `MarketTicker.tsx` | Scrolling market ticker |
| `Providers.tsx` | React Query + global providers |
| `TickerSearch.tsx` | Asset search with autocomplete |

### Component Directories

| Directory | Purpose |
|-----------|---------|
| `alm/` | ALM-specific components (charts, tables, reports) |
| `analytics/` | Analytics dashboard widgets |
| `auth/` | Login/signup forms, OAuth buttons |
| `brand/` | Logo, branding assets |
| `charts/` | Reusable chart components (Recharts, Plotly) |
| `dashboard/` | Dashboard layout and cards |
| `expenses/` | SpendCheck expense components |
| `layout/` | Sidebar, header, navigation |
| `options/` | Options chain and analytics |
| `portal/` | Portal components (ProgressTracker, PortalPaywall, WorkspaceCommandCenter, EmptyState, ErrorBanner) |
| `realtime/` | WebSocket status indicators |
| `receipts/` | Receipt OCR and display |
| `risk/` | Risk visualization components |
| `spendcheck/` | SpendCheck-specific UI |
| `ui/` | Shared UI primitives (buttons, modals, cards) |
| `valuation/` | Valuation display components |

---

## Libraries (`lib/`)

### `api.ts` (37 KB)
Centralized API client with all backend endpoint calls. Groups:
- Auth endpoints
- ALM endpoints
- Portal endpoints
- Market data endpoints
- Risk endpoints
- Admin endpoints

### `store.ts` (7 KB)
Zustand stores for client-side state:
- Auth store (user, tokens, login/logout)
- UI store (sidebar, theme, notifications)
- Market data store (quotes, watchlist)

### `features.ts` (2.6 KB)
Feature flag system. Reads from env vars:
- `ENABLE_WEBSOCKET`
- `ENABLE_AI_INSIGHTS`
- `ENABLE_CRYPTO_DATA`

### `billing.ts` (1.8 KB)
Stripe billing utilities:
- Tier definitions and limits
- Checkout session creation
- Subscription status checks

### `subscription.ts` (1.2 KB)
Subscription tier helpers:
- Feature gating per tier
- Report limits per tier

### `marketDataSocket.ts` (11 KB)
Socket.IO client for real-time market data:
- Connection management with auto-reconnect
- Subscription to ticker channels
- Event handlers for price updates

### `websocket.ts` (2.7 KB)
Generic WebSocket client wrapper

### `marketTransport.ts`
Market data transport abstraction layer

### `analytics.ts` (2.7 KB)
Client-side analytics (Segment, GA4, PostHog)

### `spendcheck-api.ts` (8.7 KB)
SpendCheck-specific API client

### `utils.ts`
Shared utility functions (formatting, dates)

### `brand.ts`
Brand constants (colors, fonts, names)

### `i18n/`
Bilingual internationalization (Spanish/English)

---

## E2E Tests (`e2e/`)

5 Playwright spec files covering 38 tests:

| Spec | Tests |
|------|-------|
| `navigation.spec.ts` | Page navigation and routing |
| `auth.spec.ts` | Login, signup, OAuth flows |
| `alm-dashboard.spec.ts` | ALM dashboard interactions |
| `api-health.spec.ts` | API health check verification |
| `accessibility.spec.ts` | a11y compliance checks |

Run: `bun run test:e2e` or `bun run test:e2e:ui`

---

## Key Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `next` | 16.1.5 | Framework |
| `react` | 19.2.3 | UI library |
| `tailwindcss` | 4 | Styling |
| `framer-motion` | 12.29 | Animations |
| `zustand` | 5.0 | State management |
| `@tanstack/react-query` | 5.90 | Server state |
| `recharts` | 3.7 | Charts |
| `plotly.js` | 3.3 | Advanced charts |
| `lucide-react` | 0.563 | Icons |
| `socket.io-client` | 4.8 | WebSockets |
| `react-dropzone` | 14.4 | File upload |
| `jspdf` | 4.2 | Client PDF export |

---

## Configuration

### `next.config.ts`
- API rewrites (proxies `/api/*` to backend in production)
- Image domains
- Environment variable exposure

### `vercel.json`
- Rewrite rules for API proxy
- Build configuration

### `tsconfig.json`
- Path aliases (`@/` → root)
- Strict mode enabled

---

## Running the Frontend

```bash
cd frontend

# Development
bun run dev               # Dev server
bun run dev -- --port 3847  # Custom port

# Production
bun run build             # Build
bun run start             # Start production server

# Testing
bun run test:e2e          # Headless E2E
bun run test:e2e:ui       # E2E with UI

# Lint
bun run lint              # ESLint
```
