# Portal Prod Smoke Runbook — cerniq.io

**Purpose.** Manual end-to-end verification of the paid portal flow against production (`https://cerniq.io`). Run after any deploy touching `frontend/app/portal/**`, `backend-node/src/portal/**`, `backend-node/src/alm/reports/**`, or `backend-node/src/pipeline/**`. Target runtime: 15 minutes, one operator, one browser tab.

Last updated: 2026-04-15.

---

## 0. Preconditions

| # | Requirement | Verify |
|---|---|---|
| P1 | A paid portal account (tier ≠ `free`, status = `active`). `requirePaidPortalAccess` (`portal.controller.ts:1498`) gates every portal API. | Hit `GET https://cerniq.io/api/auth/session` — assert `user.access.platformAccessAllowed === true`. |
| P2 | Email inbox access for the test account (magic-link auth, no bypass in prod). | Mailbox reachable from the device running the test. |
| P3 | Browser with cookies + localStorage cleared for `cerniq.io`. Fresh profile or incognito. | DevTools → Application → Clear site data. |
| P4 | A balance-sheet CSV ready for upload. Pick by §6 scenario: **A** → `data/balance_sheet_template_cooperativa.csv`; **B** → `data/portal_smoke_scenario_b_warning.csv`; **C** → `data/portal_smoke_scenario_c_critical.csv`; **D** → `data/portal_smoke_scenario_d_malformed.csv`. Live template mirror: `https://cerniq.io/templates/cerniq-balance-sheet-v1.csv`. | File on local disk, ≤1MB, schema: `category,subcategory,name,balance,rate,duration,rateType`. All columns required; `duration` must parse as a number in `[0, 50]` years (`csv-ingestion.service.ts:541-556`). |
| P5 | Know the **scenario** you are exercising (§6). Happy-path vs. gaps-path assert different things at step 10. | Section 6 filled in. |

---

## 1. Login — magic-link round-trip

| Step | Do | Expected | Assert |
|---|---|---|---|
| 1.1 | Navigate to `https://cerniq.io/portal` | Browser redirects to `/portal/login` → `/login?returnUrl=%2Fportal&mode=magic-link` | URL ends at `/login` with `mode=magic-link` (`auth-redirect.ts:36`) |
| 1.2 | Enter test email, submit | Inline "Check your email" confirmation | No console errors; no 4xx/5xx in Network |
| 1.3 | Open email, click magic link | Browser lands on `/auth/verify?token=...&returnUrl=%2Fportal` → `/auth/callback` → `/portal` | `document.cookie` contains a session cookie; final pathname = `/portal` |
| 1.4 | On `/portal`, open DevTools → Network → reload | `GET /api/auth/session` 200; `GET /api/portal/overview` 200; `GET /api/billing/subscription` 200 | `session.user.access.platformAccessAllowed === true` and `access.isPaid === true` |

**Fail-stop.** If any of 1.1–1.4 fail, abort the smoke — the rest of the runbook assumes an authenticated paid session.

---

## 2. Open report cycle

| Step | Do | Expected | Assert |
|---|---|---|---|
| 2.1 | On `/portal`, click the primary "Start new report" CTA (or manually visit `/portal/submit?createCycle=1`) | Frontend POSTs `/api/portal/jobs/open-cycle` (`portal.controller.ts:206`) | Response 200 with `{ jobId, institutionId, institutionName, status: 'AWAITING_DATA' \| 'VALIDATION_FAILED', nextHref }` |
| 2.2 | Capture `jobId` from the `open-cycle` response payload (DevTools) | — | Paste into §7 ledger row A |
| 2.3 | Page renders the upload surface on `/portal/submit` | Template download button visible, drop zone visible, `ProgressTracker` on step "Upload" | No `ErrorBanner` rendered |

**Idempotency check.** Refresh the page. The same `jobId` must be returned (open-cycle reuses the latest `AWAITING_DATA`/`VALIDATION_FAILED` job per `portal.controller.ts:226-234`). If a second cycle is created, flag as **FAIL** — §7 row B.

---

## 3. Upload balance-sheet CSV

| Step | Do | Expected | Assert |
|---|---|---|---|
| 3.1 | Drag the P4 CSV onto the upload surface (or pick via file dialog) | Frontend POSTs `/api/portal/jobs/:jobId/submit` (`portal.controller.ts:579`, multipart) | Response payload is `SubmitResponse` with `valid: boolean`, `status`, `jobId`, `itemsImported`, optional `errors[]`, optional `warnings[]` |
| 3.2 | Happy path: file accepted | `valid: true`, `status === 'QUEUED'`, `itemsImported` matches row count minus header | `itemsImported` equals your §6 expectation. |
| 3.2′ | Validation failure path (for §6 scenario C): file rejected | `valid: false`, `status === 'VALIDATION_FAILED'`, `errors[]` populated with `{row, field, message}` | Job is preserved actionable, not deleted — re-uploading a fixed CSV on same `jobId` works (SESSION_HANDOFF §4 line 307) |
| 3.3 | Page transitions to the processing surface; `ReportProgressWS` component mounts | WebSocket connects; status pill cycles `QUEUED → VALIDATING → PROCESSING → GENERATING_PDF → COMPLETE` | No manual refresh needed — WS updates. Max wait: ~90s for a 10-item CSV. |

---

## 4. Wait for `COMPLETE`

| Step | Do | Expected | Assert |
|---|---|---|---|
| 4.1 | Watch WS-driven progress bar | Terminal status = `COMPLETE` with `reportUrl` populated | `GET /api/portal/jobs/:jobId` returns `status: 'COMPLETE'`, `reportUrl` or `reportUrlEn` non-null |
| 4.2 | If status stalls >5 min in `PROCESSING` | Open `GET /api/portal/jobs/:jobId/ingestion-logs` in a new tab — identifies stuck stage | Note stuck stage in §7 row C; abort if blocked |
| 4.3 | On `COMPLETE`, "View report" CTA appears | — | Click it — expect navigation to `/portal/reports/:jobId` |

---

## 5. Inspect report + gaps manifest (**the core D1 contract**)

This is the section that validates the "never silent zeros, always DataGap manifests" invariant (`feedback_cerniq_quality.md`, `SESSION_HANDOFF.md` §1 D1).

| Step | Do | Expected | Assert |
|---|---|---|---|
| 5.1 | On `/portal/reports/:jobId`, scroll to KPI strip (`MetricStrip`) | Every numeric cell is either a real number **or** the literal `—` / `DATA UNAVAILABLE`. Never `0` as a stand-in for missing. | Screenshot each missing-data cell for §7 row D |
| 5.2 | Scroll to the gaps manifest panel | If your CSV omitted liquidity/COSSEC fields, gaps list renders with `{field, reason, severity, action}` rows. CRITICAL rows in red, WARNING in amber. | Count of gaps ≥ your §6 expectation |
| 5.3 | Inspect the "Download PDF" button | If any gap has `severity: 'CRITICAL'` → button disabled or gated. If only WARNING gaps → enabled with amber badge. (SESSION_HANDOFF §4 "Portal report viewer" line 286) | Button state matches gap severity |
| 5.4 | Click "Download PDF" (when enabled) | PDF downloads; filename follows `{institutionName}-{reportingPeriod}.pdf`-ish pattern | PDF opens; first page shows institution name, reporting period, Cerniq branding. Any unavailable KPI renders as grey "—" cell, **not** "0.00". |
| 5.5 | Open the PDF "Data Gaps" sheet (first sheet for Excel export / final appendix for PDF) | Lists every CRITICAL/WARNING gap with severity, field, reason, action columns (SESSION_HANDOFF §2 "Excel export" entry) | Gap count in PDF == gap count on web. Mismatch = **FAIL**. |
| 5.6 | (If subscription tier permits) Click Excel export | `.xlsx` downloads with "Data Gaps" sheet at index 0 | Same consistency check as 5.5 |

---

## 6. Scenario — **PICK ONE before running steps 3–5**

The smoke only covers what your CSV exercises. Choose:

- [ ] **A. Happy path — cooperativa.** Canonical cooperativa template (`data/balance_sheet_template_cooperativa.csv`, 10 items, mixed asset/liability, PR credit-union shape). Expected: `itemsImported: 10`, 0 CRITICAL gaps if the test institution has a liquidity position already attached (otherwise LCR → CRITICAL), WARNING gaps present for service-layer unwired sources (EVE sensitivity, CECL vintage, NCUA 5300 allowance/delinquency per SESSION_HANDOFF §2). PDF downloads; every numeric KPI renders a real number or literal `—`.
- [ ] **B. Alternate shape — bank.** Bank-profile balance sheet (`data/portal_smoke_scenario_b_warning.csv`, 13 items, larger mortgage/securities concentration, variable-rate borrowings). Same pass criteria as A but exercises the aggregation/bucket logic across different subcategory keys (`residential_mortgages`, `commercial_loans`, `borrowings`, ...). Expected: `itemsImported: 13`, same gap profile as A plus/minus institution-shape-driven differences. Use this scenario when a prior PR touched CECL segments, NCUA RBC2, or peer-analytics bucketing.
- [ ] **C. CRITICAL-gap path.** Minimal CSV (`data/portal_smoke_scenario_c_critical.csv`, 2 asset rows, 0 liabilities, no liquidity). Expected: submit succeeds with `itemsImported: 2`; report renders; `lcr: null`, `status: 'data_unavailable'`; ≥1 CRITICAL gap with `reason: 'EMPTY_BALANCE_SHEET'` or `'NO_LIQUIDITY_POSITION'` (`data-gap.ts:33`); PDF download button gated / disabled.
- [ ] **D. Validation-failure path.** Malformed CSV (`data/portal_smoke_scenario_d_malformed.csv`, row 3 has `balance: "abc"`). Expected: step 3.1 returns `valid: false`, `status: 'VALIDATION_FAILED'`, `errors[]` includes `{row: 3, field: 'balance', message: /Invalid balance "abc"/}` (`csv-ingestion.service.ts:505`); job persists actionable on same `jobId` so re-upload of a fixed CSV reuses the cycle. Report viewer never reached.

Each scenario asserts a different production invariant. A smoke that only runs **A** leaves the D1 silent-zero regression path untested. Recommended rotation: **A** on every deploy; **C** weekly; **B** and **D** monthly or on relevant-area PRs.

---

## 7. Test ledger (fill in on each run)

| Row | Field | Value |
|---|---|---|
| A | `jobId` from step 2.2 | |
| B | Cycle idempotency (step 2.3 refresh): PASS / FAIL | |
| C | Stuck stage (if 4.2 triggered): `— / VALIDATING / PROCESSING / GENERATING_PDF` | |
| D | Missing-data cells rendered as `—` (step 5.1): count + screenshot path | |
| E | Gap count web vs PDF (step 5.5): `N / N` | |
| F | PDF download gate matches severity (step 5.3): PASS / FAIL | |
| G | Total wall-clock time (step 1.1 → 5.5) | |
| H | Scenario exercised (§6) | A / B / C / D |
| I | Overall: PASS / FAIL + one-line root cause if FAIL | |

Paste the completed ledger into the deploy PR or release thread.

---

## 8. Cleanup

The smoke creates real rows in prod Postgres:

- `ReportJob` (1 row per run)
- `Institution` (1 row if the test user had none, else reused)
- `ReportArtifact` (1 row per PDF generated)
- `IngestionLog` (several rows)
- `AuditLog` (several rows — `portal_open_cycle`, `portal_submit`, `portal_report_download`)

Retention strategy (pick one, record choice in `project_cerniq.md` memory if not already there):

- **Keep.** Tag the jobs by setting the test user's email to `e2e-portal@cerniq.io` so they are filterable. Counts toward prod metrics but preserves audit trail.
- **Soft-delete.** Add a post-run `DELETE FROM "ReportJob" WHERE "userId" = $TEST_USER_ID AND "triggeredBy" = 'portal_cycle_bootstrap' AND "createdAt" > NOW() - INTERVAL '1 hour'` executed via the existing admin console. Preserves audit logs, drops the jobs.
- **Leave.** Accept the rows; they cost cents/year. Simplest, recommended for the current cadence.

Do **not** `DELETE FROM "AuditLog"` — audit immutability is a compliance requirement (`project_cerniq_enterprise.md`).

---

## 9. Known pitfalls

- **Magic-link expiry.** Tokens live ~15 min. If step 1.3 fails with "link expired," restart from 1.2.
- **Demo-seat redirect.** If the test user is a demo seat (not paid), step 1.4 redirects to `/pricing`. Check P1.
- **WS reconnect loop.** If `ReportProgressWS` reconnects every few seconds, usually a mixed-content issue (HTTP WS from HTTPS page). Check browser console; file Sentry link.
- **PDF `0.00` for unavailable fields.** This is the silent-zero regression. Fails the D1 contract. File as P0.
- **`gaps` array missing from `/api/portal/jobs/:jobId` response.** Means an upstream report service returned a non-manifest shape. Fails the D1 contract. File as P0.
- **Tenant leak.** If `GET /api/portal/jobs` ever returns a job whose `userId` ≠ your test user, **stop immediately and escalate** — cross-tenant leak is the worst bug class the enterprise bible covers.
