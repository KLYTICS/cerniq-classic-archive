# MP-OPS-03 -- CERNIQ E2E Production Gate

**Version:** 1.0
**Date:** 2026-03-16
**Owner:** Erwin Kiess-Alfonso
**Status:** Pre-launch gate -- all 13 steps must pass before pitching any live client

---

## Prerequisites

Before starting the E2E walk-through, confirm these infrastructure gates:

- [ ] All Railway env vars set (see `docs/ops/railway_env_vars.md`)
- [ ] Vercel deployment successful (check https://vercel.com/dashboard)
- [ ] Railway deployment successful (check https://railway.app/dashboard)
- [ ] DNS: `cerniq.io` CNAME -> Vercel
- [ ] DNS: `api.cerniq.io` CNAME -> Railway (`<app>.up.railway.app`)
- [ ] Run `bash scripts/health-check.sh` -- all 4 checks PASS
- [ ] Stripe webhook endpoint configured: `https://api.cerniq.io/api/billing/webhook`
- [ ] Resend domain verified for `hello@cerniq.io`

**Test card for Stripe:** `4242 4242 4242 4242` | Exp: `12/30` | CVC: `123` | ZIP: `10001`

---

## Step-by-Step Verification

### Step 1 -- PRICING PAGE

| Action | Visit https://cerniq.io/pricing |
|--------|------|
| Click | "Comenzar -- $750" (or whichever tier you are testing) |
| **PASS** | Stripe Checkout opens with correct price ($750 USD) |
| **PASS** | Product name shows "CERNIQ" (not CapexCycleOS) |
| Note | "Test mode" banner is acceptable if using `sk_test_` / `pk_test_` keys |

**Result:** [ ] PASS / [ ] FAIL -- Notes: _______________

---

### Step 2 -- STRIPE CHECKOUT

| Action | Complete checkout with test card `4242 4242 4242 4242` |
|--------|------|
| Fill | Email: your test email, Name: Test User, ZIP: 10001 |
| **PASS** | Redirects to `https://cerniq.io/portal?welcome=1` |
| **PASS** | Welcome screen shows institution name input |
| **PASS** | No console errors in browser DevTools |

**Result:** [ ] PASS / [ ] FAIL -- Notes: _______________

---

### Step 3 -- WEBHOOK DELIVERY

| Action | Check Railway logs within 20 seconds of checkout completion |
|--------|------|
| Command | `railway logs` or view in Railway dashboard |
| **PASS** | Log line containing `checkout.session.completed` |
| **PASS** | Log line containing `ReportJob created` or equivalent |
| **PASS** | No 4xx/5xx errors in Stripe webhook dashboard |

**Result:** [ ] PASS / [ ] FAIL -- Notes: _______________

---

### Step 4 -- DATABASE RECORDS

| Action | Check Prisma Studio or query Railway Postgres directly |
|--------|------|
| Command | `npx prisma studio` (local with prod `DATABASE_URL`) or Railway Data tab |
| **PASS** | New row in `subscriptions` table with `status = 'active'` |
| **PASS** | New row in `report_jobs` table |
| **PASS** | New row in `users` table (or existing user linked) |
| **PASS** | New row in `magic_links` table |

**Result:** [ ] PASS / [ ] FAIL -- Notes: _______________

---

### Step 5 -- WELCOME EMAIL

| Action | Check the email inbox used during checkout |
|--------|------|
| Timeframe | Within 3 minutes of checkout |
| **PASS** | Email received from `hello@cerniq.io` |
| **PASS** | Subject contains "CERNIQ" |
| **PASS** | Body contains a magic link URL |
| **PASS** | No broken images or layout issues |

**Result:** [ ] PASS / [ ] FAIL -- Notes: _______________

---

### Step 6 -- MAGIC LINK LOGIN

| Action | Click the magic link in the welcome email |
|--------|------|
| **PASS** | Opens `https://cerniq.io/portal` (NOT `/onboarding` or `/login`) |
| **PASS** | Progress tracker / dashboard is visible |
| **PASS** | User name or email shown in header |
| **PASS** | JWT cookie set (check DevTools > Application > Cookies) |

**Result:** [ ] PASS / [ ] FAIL -- Notes: _______________

---

### Step 7 -- INSTITUTION SETUP

| Action | Complete the institution setup form in the portal |
|--------|------|
| Fill | Institution name, type (cooperativa/bank), COSSEC ID |
| **PASS** | Form validates required fields |
| **PASS** | Submits successfully (no errors) |
| **PASS** | Redirects to upload page with template download button |

**Result:** [ ] PASS / [ ] FAIL -- Notes: _______________

---

### Step 8 -- TEMPLATE DOWNLOAD

| Action | Click the "Download Template" button |
|--------|------|
| **PASS** | CSV file downloads |
| **PASS** | CSV contains correct column headers |
| **PASS** | CSV has ~40 pre-labeled rows (balance sheet line items) |
| **PASS** | File opens correctly in Excel / Google Sheets |

**Result:** [ ] PASS / [ ] FAIL -- Notes: _______________

---

### Step 9 -- CSV UPLOAD

| Action | Fill in the template with sample data and upload |
|--------|------|
| **PASS** | Drag-and-drop or file picker works |
| **PASS** | Client-side validation passes (correct columns, numeric values) |
| **PASS** | Preview table shows uploaded data |
| **PASS** | "Submit" button becomes active |
| **PASS** | Submit succeeds -- confirmation message shown |

**Result:** [ ] PASS / [ ] FAIL -- Notes: _______________

---

### Step 10 -- JOB QUEUED

| Action | Check Railway logs immediately after CSV submit |
|--------|------|
| Command | `railway logs` or Railway dashboard |
| **PASS** | Log: `Pipeline: picked up job <job_id>` (or equivalent) |
| **PASS** | `report_jobs` row: status changes from `QUEUED` to `PROCESSING` |
| **PASS** | No immediate error/crash in logs |

**Result:** [ ] PASS / [ ] FAIL -- Notes: _______________

---

### Step 11 -- PIPELINE COMPLETE

| Action | Wait up to 10 minutes, monitor Railway logs |
|--------|------|
| **PASS** | Log: `pipeline.job.complete` (or equivalent success message) |
| **PASS** | `report_jobs` row: status = `COMPLETE` |
| **PASS** | `report_jobs` row: `completedAt` is set |
| **PASS** | `report_jobs` row: `pdfUrl` is populated |
| **PASS** | PDF accessible at the `pdfUrl` (returns 200, content-type `application/pdf`) |

**Result:** [ ] PASS / [ ] FAIL -- Notes: _______________

---

### Step 12 -- REPORT DELIVERY EMAIL

| Action | Check inbox for report delivery email |
|--------|------|
| Timeframe | Within 2 minutes of pipeline completion |
| **PASS** | Email received with subject referencing the report |
| **PASS** | Email contains a link to view/download the PDF |
| **PASS** | PDF link works (opens in browser) |
| **PASS** | PDF is the correct report (institution name matches) |

**Result:** [ ] PASS / [ ] FAIL -- Notes: _______________

---

### Step 13 -- ERWIN OPERATOR ALERT

| Action | Check Erwin's email (eskiessalfonso@gmail.com) |
|--------|------|
| **PASS** | Alert email received with job completion details |
| **PASS** | Contains: institution name, job ID, completion time |
| **PASS** | Contains: link to admin ops dashboard or PDF |

**Result:** [ ] PASS / [ ] FAIL -- Notes: _______________

---

## Final PDF Verification

Open the generated PDF and verify:

| Check | Criteria | Pass? |
|-------|----------|-------|
| Page count | >= 14 pages | [ ] |
| Bilingual | Contains both ES and EN sections | [ ] |
| COSSEC ratios | Page ~8 shows 12 regulatory ratios | [ ] |
| Executive summary | Exam readiness score present | [ ] |
| Cover page | Institution name displayed correctly | [ ] |
| Charts | At least 3 charts render (no blank boxes) | [ ] |
| Branding | "CERNIQ" logo/name on cover, no "CapexCycleOS" | [ ] |
| Formatting | No overlapping text, tables render cleanly | [ ] |

---

## Result Log

| Date | Tester | Steps Passed | Steps Failed | Failed Steps | Notes |
|------|--------|--------------|--------------|--------------|-------|
| | | /13 | | | |
| | | /13 | | | |
| | | /13 | | | |

---

## Failure Triage

If any step fails, check the following:

| Failed Step | Most Likely Cause | Quick Fix |
|-------------|-------------------|-----------|
| 1 (Pricing) | Stripe price IDs not set or mismatched | Check `STRIPE_PRICE_ONE_TIME` in Vercel env vars |
| 2 (Checkout) | Frontend redirect URL wrong | Check `FRONTEND_URL` in Railway and Stripe success_url |
| 3 (Webhook) | Webhook secret mismatch or endpoint not registered | Verify `STRIPE_WEBHOOK_SECRET` matches Stripe dashboard |
| 4 (Database) | Migration not applied | Run `npx prisma migrate deploy` |
| 5 (Email) | Resend API key invalid or domain not verified | Check `RESEND_API_KEY` in Railway, verify domain in Resend |
| 6 (Magic Link) | Token expired or JWT_SECRET mismatch | Check token TTL and `JWT_SECRET` consistency |
| 7 (Institution) | API 401/403 | Check auth guard, cookie domain (`AUTH_COOKIE_DOMAIN`) |
| 8 (Template) | File not found / 404 | Check static asset deployment in Vercel |
| 9 (Upload) | CORS blocked or file size limit | Check `ALLOWED_ORIGINS`, increase body parser limit |
| 10 (Queue) | Pipeline cron not running | Check NestJS ScheduleModule is imported, `railway logs` |
| 11 (Pipeline) | PDF generation crash | Check R2 credentials (`R2_ENDPOINT`, `R2_ACCESS_KEY_ID`) |
| 12 (Report Email) | Resend rate limit or template error | Check Resend dashboard for bounces |
| 13 (Alert) | `ERWIN_EMAIL` env var not set | Set in Railway env vars |

---

## Sign-Off

| Role | Name | Date | Signature |
|------|------|------|-----------|
| Founder / Operator | Erwin Kiess-Alfonso | | |
| QA (if applicable) | | | |

**This gate must be fully green (13/13) before any live client engagement.**
