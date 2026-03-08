# CFO Test Sequences — Wave 02 B3 Validation

**Purpose**: 5 end-to-end scenarios a cooperativa CFO would execute. Run against live deployment.

---

## Test 1 — Demo Flow (Cooperativa CFO First Visit)

**URL**: `{BASE}/demo?type=cooperativa`

| Step | Action | Expected |
|------|--------|----------|
| 1 | Navigate to demo URL | Auto-selects "cooperativa", loads CoopAhorro San Juan ($250M) |
| 2 | Wait for auto-start | Step 1 → Step 4 completes without user input |
| 3 | Verify metrics overlay | Risk score, capital ratio, LCR, NII impact, duration gap visible |
| 4 | Download EN PDF | PDF downloads, contains COSSEC section |
| 5 | Download ES PDF | PDF downloads, Spanish headers and content |
| 6 | Social proof footer | Shows "Generated in X.Xs · Date · COSSEC: X/4 ratios" |
| 7 | Click "Open Dashboard" | Routes to /alm |
| 8 | Click lead form CTA | Form opens, submit works |

**Pass criteria**: No errors visible. All PDFs render. Analytics fires 6 events.

---

## Test 2 — Sales Companion Mode

**URL**: `{BASE}/demo?type=cooperativa&mode=sales`

| Step | Action | Expected |
|------|--------|----------|
| 1 | Navigate to sales URL | Same demo + talking points sidebar visible |
| 2 | Verify timer | Timer counting up from 0:00 |
| 3 | Verify talking points | Key metrics highlighted, sales hooks for each step |
| 4 | Flag for follow-up | Follow-up flag toggles |
| 5 | Switch locale to ES | All metric labels switch to Spanish |
| 6 | Verify sidebar in ES | Talking points switch language |

**Pass criteria**: Sales sidebar renders. Timer works. Bilingual toggle works.

---

## Test 3 — ALM Dashboard (Full Workflow)

**URL**: `{BASE}/alm`

| Step | Action | Expected |
|------|--------|----------|
| 1 | Select institution | Welcome state replaced with dashboard |
| 2 | Check Risk Score | Gauge renders with label (EN: "Low Risk", ES: "Bajo riesgo") |
| 3 | Navigate Rate Sensitivity | NII scenarios table, duration gap KPIs, charts render |
| 4 | Navigate Liquidity | LCR gauge, HQLA pie chart, waterfall chart render |
| 5 | Navigate Balance Sheet | Categories table with totals |
| 6 | Navigate Stress Test | Pre-run state visible, run button works |
| 7 | Run stress test | Loading animation → results table |
| 8 | Switch locale to ES | All labels switch: "Puntuación de riesgo", "Bajo riesgo", etc. |
| 9 | Verify date formatting | Dates use es-PR locale (DD/MM/YYYY) |
| 10 | Verify USD formatting | Currency shows $X,XXX.XX (US format, correct for PR) |

**Pass criteria**: All 5 sub-pages render data. Bilingual toggle works throughout. No blank screens.

---

## Test 4 — Lead Pipeline Admin

**URL**: `{BASE}/admin` → navigate to Lead Pipeline

| Step | Action | Expected |
|------|--------|----------|
| 1 | Enter invalid admin key | Error shown, not authenticated |
| 2 | Enter valid ADMIN_KEY | Dashboard loads, metrics visible |
| 3 | Verify 5 metrics | Total leads, conversion rate, monthly revenue, total revenue, pipeline value |
| 4 | Filter by status | Table filters correctly |
| 5 | Update lead status | Status changes, persists on refresh |
| 6 | Add note to lead | Note saved, visible in lead detail |
| 7 | Mark report sent | Timestamp appears |
| 8 | Convert to won | Revenue amount prompt → lead marked CLOSED_WON |
| 9 | Submit new lead (via demo form) | Lead appears in pipeline with correct priority |
| 10 | Check error banner | Disconnect network → retry button works when reconnected |

**Pass criteria**: All CRUD operations work. Metrics update correctly. Error banner renders on failure.

---

## Test 5 — Error Recovery & Edge Cases

| Step | Action | Expected |
|------|--------|----------|
| 1 | Navigate /demo with bad params | Demo degrades to defaults, no error shown |
| 2 | Navigate /alm with no institution | "No institution selected" empty state |
| 3 | Navigate /alm/sensitivity with no data | Empty state: "Upload balance sheet data..." |
| 4 | Navigate /alm/liquidity with no data | Empty state: "Upload balance sheet data..." |
| 5 | Kill backend, load /dashboard | Loading spinner shows (not blank screen) |
| 6 | Kill backend, load /admin | Error banner with retry button |
| 7 | Access /admin/leads with expired key | Redirects to auth gate |
| 8 | `GET /health` | Returns `{ status: "ok" }` |
| 9 | `GET /health/detailed` | Returns per-service latency, memory stats |
| 10 | `GET /api/market-data/clear-cache` without key | Returns 401 |

**Pass criteria**: No unhandled exceptions. All failure modes degrade gracefully with user-visible feedback.

---

## Execution Notes

- Run in both EN and ES locales
- Test on Chrome and Safari (primary cooperativa CFO browsers)
- Verify mobile viewport for /demo (sales presentations on iPad)
- All tests assume fresh deployment with seeded demo data
