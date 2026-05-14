# CERNIQ -- Getting Live: Complete Deployment Walkthrough

**Version:** 1.0
**Last Updated:** March 2026
**Owner:** Erwin Kiess-Alfonso, KLYTICS LLC
**Estimated Total Time:** 2-3 hours (first run), 30 minutes (subsequent)

> This is THE definitive guide for going from "code pushed to GitHub" to "first paying customer." Every step is sequential. Do not skip ahead.

---

## How To Use This Document

1. Work through each step in order. Each has a checkbox.
2. Estimated time is shown next to each step heading.
3. When you see a command, run it exactly as written.
4. When you see `YOUR_VALUE_HERE`, replace it with the real value.
5. At the end, you will have a fully operational platform ready for live clients.

---

## Prerequisites (verify before starting)

- [ ] GitHub repo: code pushed to `main` at `github.com/monykiss/capexos`
- [ ] Railway account created at [railway.app](https://railway.app)
- [ ] Vercel account created at [vercel.com](https://vercel.com)
- [ ] Stripe account created at [dashboard.stripe.com](https://dashboard.stripe.com)
- [ ] Resend account created at [resend.com](https://resend.com)
- [ ] Anthropic account created at [console.anthropic.com](https://console.anthropic.com)
- [ ] Domain `cerniq.io` registered (Spaceship) with DNS access
- [ ] A laptop with `curl` available (macOS and Linux have it built-in)
- [ ] A personal email address you can check for test emails

---

## Step 1: Railway Project Setup (15 minutes)

### 1A. Create the Railway Project

1. Log in at [railway.app](https://railway.app).
2. Click **New Project** in the top-right corner.
3. Select **Deploy from GitHub repo**.
4. Connect your GitHub account if not already connected.
5. Select the repo `monykiss/capexos`.
6. Railway will detect the monorepo. Set the **Root Directory** to `backend-node`.
7. Name the service `cerniq-api`.

### 1B. Add PostgreSQL

1. Inside the Railway project, click **+ New** (top right).
2. Select **Database > PostgreSQL**.
3. Railway will create a PostgreSQL instance and auto-set `DATABASE_URL` as a shared variable.
4. Click the PostgreSQL service, go to **Variables**, and copy the `DATABASE_URL` value. You will need this later.

> **What you should see on screen:** A Railway project with two services listed -- `cerniq-api` and a PostgreSQL instance.

### 1C. Set Environment Variables

In the Railway dashboard, click the `cerniq-api` service, then go to the **Variables** tab. Add every variable in the table below.

For variables that say "generate," open your terminal and run the command shown.

#### Generate secrets first (run these in your terminal):

```bash
# JWT Secret (64-char hex string)
openssl rand -hex 32

# Data Encryption Key (64-char hex string)
openssl rand -hex 32

# Admin Key (32-char hex string)
openssl rand -hex 16
```

Write down all three values. You will paste them into Railway.

#### Railway Variables -- Complete List

| Variable | How to Get It | Example Value |
|----------|---------------|---------------|
| `DATABASE_URL` | Already auto-set by Railway PostgreSQL plugin. Verify it exists. | `postgresql://<user>@...` |
| `JWT_SECRET` | Paste the first `openssl rand -hex 32` output | `a1b2c3d4e5f6...` (64 chars) |
| `DATA_ENCRYPTION_KEY` | Paste the second `openssl rand -hex 32` output | `d4e5f6a7b8c9...` (64 chars) |
| `ADMIN_KEY` | Paste the `openssl rand -hex 16` output | `a1b2c3d4e5f6...` (32 chars) |
| `NODE_ENV` | Type: `production` | `production` |
| `FRONTEND_URL` | Type: `https://cerniq.io` | `https://cerniq.io` |
| `ERWIN_EMAIL` | Your email for operator alerts | `eskiessalfonso@g
mail.com` |
| `RESEND_API_KEY` | See Step 1D below | `re_xxxx...` |
| `STRIPE_SECRET_KEY` | See Step 1E below | `sk_test_xxxx...` |
| `STRIPE_WEBHOOK_SECRET` | See Step 1F below | `whsec_xxxx...` |
| `STRIPE_PRICE_ONE_TIME` | See Step 1E below | `price_xxxx...` |
| `STRIPE_PRICE_MONTHLY` | See Step 1E below | `price_xxxx...` |
| `STRIPE_PRICE_ANNUAL` | See Step 1E below | `price_xxxx...` |
| `STRIPE_PRICE_PARTNER` | See Step 1E below | `price_xxxx...` |
| `ANTHROPIC_API_KEY` | See Step 1G below | `sk-ant-xxxx...` |
| `ALPHA_VANTAGE_API_KEY` | See Step 1H below | `XXXXXXXX` |

#### Optional Variables (set these if applicable):

| Variable | Purpose | Default if unset |
|----------|---------|------------------|
| `GITHUB_CLIENT_ID` | GitHub OAuth login | OAuth login disabled |
| `GITHUB_CLIENT_SECRET` | GitHub OAuth login | OAuth login disabled |
| `GITHUB_CALLBACK_URL` | GitHub OAuth callback | `https://api.cerniq.io/api/auth/github/callback` |
| `GOOGLE_CLIENT_ID` | Google OAuth login | OAuth login disabled |
| `GOOGLE_CLIENT_SECRET` | Google OAuth login | OAuth login disabled |
| `GOOGLE_CALLBACK_URL` | Google OAuth callback | `https://api.cerniq.io/api/auth/google/callback` |
| `R2_ENDPOINT` | Cloudflare R2 for PDF storage | PDFs use local paths (not recommended for production) |
| `R2_ACCESS_KEY_ID` | Cloudflare R2 access key | No cloud storage |
| `R2_SECRET_ACCESS_KEY` | Cloudflare R2 secret key | No cloud storage |
| `R2_BUCKET` | Cloudflare R2 bucket name | `cerniq-reports` |
| `REDIS_URL` | Redis cache (optional, degrades gracefully) | In-memory cache only |
| `AUTH_COOKIE_DOMAIN` | Cookie domain for cross-subdomain auth | Auto-detected |
| `ALLOW_PREVIEW_ORIGINS` | Allow Vercel preview URLs for CORS | `false` |

### 1D. Get the Resend API Key (5 minutes)

1. Log in at [resend.com](https://resend.com).
2. Click **Domains** in the left sidebar.
3. Click **Add Domain** and enter `cerniq.io`.
4. Resend will show you 3 DNS records to add (MX, TXT for SPF, and CNAME for DKIM).
5. Go to your DNS provider (Spaceship or Cloudflare) and add those records.
6. Wait for verification (usually 5-30 minutes; Resend shows a green checkmark when done).
7. Go to **API Keys** in the Resend sidebar.
8. Click **Create API Key**.
9. Name it `cerniq-production`.
10. Copy the key (starts with `re_`).
11. Paste it as `RESEND_API_KEY` in Railway.

> **Important:** Emails are sent from `hello@cerniq.io`. The domain MUST be verified in Resend for emails to deliver. Until it is verified, all emails will silently fail.

### 1E. Create Stripe Products and Get Price IDs (10 minutes)

1. Log in at [dashboard.stripe.com](https://dashboard.stripe.com).
2. Make sure you are in **Test mode** (toggle in top-right shows "Test mode" with orange badge). You will switch to live later.
3. Go to **Product catalog** (left sidebar).
4. Create 4 products:

**Product 1: ALM Report (One-Time)**
- Name: `CERNIQ ALM Report`
- Description: `Full ALM Intelligence Report -- bilingual PDF, COSSEC compliance`
- Click **Add a price**:
  - Amount: `$750.00`
  - Type: **One time**
- Save. Copy the Price ID (starts with `price_`). This is `STRIPE_PRICE_ONE_TIME`.

**Product 2: Pilot Platform**
- Name: `CERNIQ Platform -- Pilot`
- Description: `Full ALM intelligence platform, 90-day pilot, cancel anytime`
- Click **Add a price**:
  - Amount: `$2,500.00`
  - Type: **Recurring**, Billing period: **Monthly**
- Save. Copy the Price ID. This is `STRIPE_PRICE_MONTHLY`.

**Product 3: Standard Platform (Annual)**
- Name: `CERNIQ Platform -- Standard`
- Description: `Annual contract, unlimited users, priority support, HJM Monte Carlo engine`
- Click **Add a price**:
  - Amount: `$3,500.00`
  - Type: **Recurring**, Billing period: **Monthly**
- Save. Copy the Price ID. This is `STRIPE_PRICE_ANNUAL`.

**Product 4: Partner Access**
- Name: `CERNIQ Partner Access`
- Description: `White-label multi-client portal for CPA firms and consultants`
- Click **Add a price**:
  - Amount: `$499.00`
  - Type: **Recurring**, Billing period: **Monthly**
- Save. Copy the Price ID. This is `STRIPE_PRICE_PARTNER`.

5. Go to **Developers > API Keys** in Stripe.
6. Copy the **Secret key** (starts with `sk_test_`). This is `STRIPE_SECRET_KEY`.
7. Copy the **Publishable key** (starts with `pk_test_`). You will use this for Vercel later.

Paste all 5 values into Railway.

### 1F. Create the Stripe Webhook (5 minutes)

1. In Stripe, go to **Developers > Webhooks**.
2. Click **Add endpoint**.
3. Endpoint URL: `https://api-production-f804.up.railway.app/api/billing/webhook`
   - **Note:** Replace with your actual Railway URL if different. You can find it in Railway under the `cerniq-api` service > Settings > Domains.
   - Once you set up the custom domain `api.cerniq.io`, update the webhook URL to: `https://api.cerniq.io/api/billing/webhook`
4. Under **Events to send**, select these 7 events:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`
   - `charge.dispute.created`
5. Click **Add endpoint**.
6. On the webhook detail page, click **Reveal** under the Signing secret.
7. Copy the signing secret (starts with `whsec_`). This is `STRIPE_WEBHOOK_SECRET`.
8. Paste it into Railway.

### 1G. Get the Anthropic API Key (3 minutes)

1. Log in at [console.anthropic.com](https://console.anthropic.com).
2. Go to **Settings > API Keys**.
3. Click **Create Key**.
4. Name it `cerniq-production`.
5. Copy the key (starts with `sk-ant-`).
6. Paste it as `ANTHROPIC_API_KEY` in Railway.

> This powers the AI Risk Advisor chat feature. Without it, the advisor returns a polite "unavailable" message but nothing breaks.

### 1H. Get the Alpha Vantage API Key (2 minutes)

1. Go to [alphavantage.co/support/#api-key](https://www.alphavantage.co/support/#api-key).
2. Fill in the form. Select the free tier.
3. Copy the API key.
4. Paste it as `ALPHA_VANTAGE_API_KEY` in Railway.

> This powers real-time market data on the dashboard. Without it, market data widgets show stale or empty data.

### 1I. Verify All Variables Are Set

In the Railway dashboard, click the `cerniq-api` service > **Variables**. Count the variables. You should have at minimum **16 variables** set (the required ones from the table above).

- [ ] `DATABASE_URL` -- present (auto-set)
- [ ] `JWT_SECRET` -- 64 characters
- [ ] `DATA_ENCRYPTION_KEY` -- 64 characters
- [ ] `ADMIN_KEY` -- 32 characters
- [ ] `NODE_ENV` -- `production`
- [ ] `FRONTEND_URL` -- `https://cerniq.io`
- [ ] `ERWIN_EMAIL` -- your email
- [ ] `RESEND_API_KEY` -- starts with `re_`
- [ ] `STRIPE_SECRET_KEY` -- starts with `sk_test_`
- [ ] `STRIPE_WEBHOOK_SECRET` -- starts with `whsec_`
- [ ] `STRIPE_PRICE_ONE_TIME` -- starts with `price_`
- [ ] `STRIPE_PRICE_MONTHLY` -- starts with `price_`
- [ ] `STRIPE_PRICE_ANNUAL` -- starts with `price_`
- [ ] `STRIPE_PRICE_PARTNER` -- starts with `price_`
- [ ] `ANTHROPIC_API_KEY` -- starts with `sk-ant-`
- [ ] `ALPHA_VANTAGE_API_KEY` -- alphanumeric string

---

## Step 2: Deploy the Backend (10 minutes)

### 2A. Trigger Deployment

If Railway is connected to your GitHub repo with auto-deploy enabled:

```bash
# Just push to main -- Railway deploys automatically
git push origin main
```

If not auto-deploying, go to the Railway dashboard > `cerniq-api` service > **Deployments** > click **Deploy**.

### 2B. Monitor the Deploy

In the Railway dashboard, click the `cerniq-api` service and watch the **Build Logs** and **Deploy Logs**.

**What to look for in Build Logs:**
1. `npm ci` or `npm install` completes without errors
2. `prisma generate` completes (generates the Prisma client)
3. `nest build` completes (compiles TypeScript to JavaScript)

**What to look for in Deploy Logs:**
1. `CERNIQ backend running on 0.0.0.0:XXXX [production]`
2. `Nest application successfully started`
3. `Swagger UI available at /api/v1/docs`
4. No `FATAL:` error messages

> **Expected deploy time:** 2-4 minutes. If the build fails, check the logs for the specific error. The most common cause is a missing environment variable.

### 2C. Set Up Custom Domain (optional but recommended)

1. In Railway, click the `cerniq-api` service > **Settings** > **Networking** > **Custom Domain**.
2. Enter: `api.cerniq.io`
3. Railway will show you a CNAME record to add.
4. Go to your DNS provider and add: `api.cerniq.io` CNAME -> `<value-from-railway>.up.railway.app`
5. Wait for DNS propagation (5-30 minutes).
6. Railway will show a green checkmark when the domain is connected.

> **Until the custom domain is active**, use the Railway-provided URL (something like `https://api-production-f804.up.railway.app`). All instructions below use `api.cerniq.io` but substitute your Railway URL if the custom domain is not yet live.

---

## Step 3: Database Migration (5 minutes)

### 3A. Verify Migration Status

Production schema changes are explicit. They do not run automatically during app
startup.

Run:

```bash
cd backend-node
DATABASE_URL="postgresql://..." npm run prisma:status
```

Expected output: database schema is up to date.

### 3B. Manual Verification (if needed)

If you want to double-check, you can use the Railway CLI:

```bash
# Install Railway CLI (if not already installed)
npm install -g @railway/cli

# Login
railway login

# Link to your project
railway link

# Check migration status
railway run npm run prisma:status
```

Expected output: All migrations show "Applied."

### 3C. Apply Schema Changes Explicitly (only when needed)

```bash
cd backend-node
DATABASE_URL="postgresql://..." ALLOW_SCHEMA_MIGRATIONS=true npm run prisma:deploy
```

Only run this for reviewed schema changes, before deploying application code
that depends on them.

### 3D. Inspect the Database (optional)

To open Prisma Studio (visual database browser):

```bash
# This opens a browser window showing all your tables
railway run npx prisma studio
```

Verify you see these key tables:
- `users`
- `subscriptions`
- `report_jobs`
- `institutions`
- `balance_sheet_items`
- `audit_logs`
- `leads`
- `prospects`

---

## Step 4: Deploy the Frontend on Vercel (10 minutes)

### 4A. Connect the Repo

1. Log in at [vercel.com](https://vercel.com).
2. Click **Add New** > **Project**.
3. Import the GitHub repo `monykiss/capexos`.
4. Set the **Root Directory** to `frontend`.
5. Vercel will auto-detect Next.js as the framework.

### 4B. Configure Vercel Settings

In the project settings, verify:

| Setting | Value |
|---------|-------|
| Framework Preset | Next.js |
| Root Directory | `frontend` |
| Build Command | `bun run build` |
| Install Command | `bun install` |
| Node.js Version | 20.x |

### 4C. Set Vercel Environment Variables

Go to the project > **Settings** > **Environment Variables**. Add:

| Variable | Value | Notes |
|----------|-------|-------|
| `NEXT_PUBLIC_NODE_API_URL` | `https://api.cerniq.io` | Use Railway URL if custom domain not ready |
| `NEXT_PUBLIC_API_URL` | `https://api.cerniq.io` | Same as above |
| `NEXT_PUBLIC_APP_URL` | `https://cerniq.io` | Your frontend domain |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | `pk_test_xxxx...` | From Stripe > Developers > API Keys |
| `NEXT_PUBLIC_ALLOW_DEMO_MOCKS` | `false` | Disables mock data in production |

> **Critical:** The `NEXT_PUBLIC_NODE_API_URL` must point to the backend. If this is wrong, the pricing page, portal, and all API calls will break.

### 4D. Deploy

Click **Deploy**. Vercel will build and deploy the frontend.

**Expected build time:** 1-2 minutes.

### 4E. Set Up Custom Domain

1. In the Vercel project, go to **Settings** > **Domains**.
2. Add `cerniq.io` and `www.cerniq.io`.
3. Vercel will show DNS records to add.
4. Go to your DNS provider and add:
   - `cerniq.io` -- A record or CNAME to Vercel's provided value
   - `www.cerniq.io` -- CNAME to `cname.vercel-dns.com`
5. Vercel will auto-provision HTTPS certificates.

> **What you should see:** After DNS propagation, visiting `https://cerniq.io` shows the CERNIQ landing page with navy background and the pricing link.

---

## Step 5: Verify the Deployment (10 minutes)

### 5A. Run the Automated Health Check

On your laptop, open Terminal and run:

```bash
# Clone the repo if you haven't already
git clone https://github.com/monykiss/capexos.git
cd capexos

# Run the health check
bash scripts/health-check.sh https://api.cerniq.io https://cerniq.io
```

**Expected output:** Every line shows `PASS` in green. If any show `FAIL`, stop and fix before continuing.

> If you do not have the repo cloned locally, you can run these checks manually with curl (see 5B).

### 5B. Manual Verification (curl commands)

Run each command in your terminal. Expected results are shown.

```bash
# 1. Backend health
curl https://api.cerniq.io/health
```
Expected: `{"status":"ok","db":"connected","version":"2.0.0",...}`

```bash
# 2. Backend readiness
curl https://api.cerniq.io/ready
```
Expected: `{"ready":true,"checks":{"database":"ok"},...}`

```bash
# 3. API status
curl https://api.cerniq.io/api/status
```
Expected: `{"name":"CERNIQ API","version":"2.0.0",...}`

```bash
# 4. Frontend loads
curl -s -o /dev/null -w "%{http_code}" https://cerniq.io
```
Expected: `200`

```bash
# 5. Pricing page loads
curl -s -o /dev/null -w "%{http_code}" https://cerniq.io/pricing
```
Expected: `200`

```bash
# 6. Admin endpoint rejects unauthenticated requests
curl -s -o /dev/null -w "%{http_code}" https://api.cerniq.io/api/admin/stats
```
Expected: `401`

```bash
# 7. Admin endpoint works with your key
curl -H "x-admin-key: <admin-key>" https://api.cerniq.io/api/admin/stats
```
Expected: `200` with JSON showing `{"demoRequests":0,"institutions":0,"users":0,...}`

```bash
# 8. Swagger docs accessible
curl -s -o /dev/null -w "%{http_code}" https://api.cerniq.io/api/v1/docs
```
Expected: `200`

### 5C. Visual Verification

Open a browser and check these pages:

| Page | URL | What to See |
|------|-----|-------------|
| Landing page | `https://cerniq.io` | Navy header, CERNIQ logo, "Risk Intelligence Platform" |
| Pricing | `https://cerniq.io/pricing` | 4 tiers: $750 setup, $2,500/mo pilot, $3,500/mo standard, $499/mo partner |
| Login | `https://cerniq.io/login` | Email/password form, Google/GitHub buttons |
| ALM Dashboard | `https://cerniq.io/alm` | ALM intelligence page (may require login) |
| API Docs | `https://api.cerniq.io/api/v1/docs` | Swagger UI with CERNIQ branding |

- [ ] All 5 pages load without errors
- [ ] No "CapexCycleOS" text visible anywhere
- [ ] Browser console (F12 > Console) shows no red errors

---

## Step 6: E2E Production Gate -- Full Flow Test (30 minutes)

This is the most critical step. You will walk through the entire customer journey from pricing page to PDF delivery.

**Prerequisite:** Keep the `ADMIN_KEY` value handy and a test email you can check.

**Test card for Stripe:** `4242 4242 4242 4242` | Exp: `12/30` | CVC: `123` | ZIP: `10001`

For the full 13-step verification with pass/fail checkboxes, see:
**`docs/ops/e2e_production_gate.md`**

Below is the condensed version:

### Gate 1: Checkout Flow

1. **Visit `https://cerniq.io/pricing`**
   - [ ] Page loads with all 4 tiers displayed
   - [ ] Click "Start -- $750" (the one-time tier)
   - [ ] Stripe Checkout opens with correct price ($750 USD)
   - [ ] Product name shows "CERNIQ" (not CapexCycleOS)

2. **Complete Stripe Checkout**
   - Use email: your test email address
   - Card: `4242 4242 4242 4242`, Exp: `12/30`, CVC: `123`, ZIP: `10001`
   - [ ] Redirects to `https://cerniq.io/portal?welcome=1`
   - [ ] Portal page loads without errors

3. **Check Railway Logs** (within 30 seconds of checkout)
   - Go to Railway dashboard > `cerniq-api` > Deploy Logs, or run `railway logs`
   - [ ] Log shows `checkout.session.completed`
   - [ ] Log shows `payment.complete` with tier and amount

4. **Check Stripe Webhook Dashboard**
   - Go to Stripe > Developers > Webhooks > your endpoint
   - [ ] Recent deliveries show `200` status (green check)
   - [ ] No failed deliveries

5. **Check Your Email** (within 3 minutes)
   - [ ] Welcome email received from `hello@cerniq.io`
   - [ ] Email contains a magic link URL
   - [ ] Email mentions CERNIQ, not CapexCycleOS

6. **Click the Magic Link**
   - [ ] Opens the portal at `https://cerniq.io/portal`
   - [ ] User is authenticated (no login prompt)
   - [ ] Progress tracker visible

### Gate 2: Data Submission

7. **Institution Setup**
   - In the portal, find the institution setup form
   - Enter a test institution name (e.g., "Cooperativa Test")
   - Select type: Cooperativa
   - [ ] Form submits successfully
   - [ ] Redirects to upload page

8. **Template Download**
   - Click "Download Template"
   - [ ] CSV file downloads
   - [ ] Open in Excel/Google Sheets: has ~40 rows with balance sheet line items
   - [ ] Column headers include: category, subcategory, name, balance, rate, duration, rate_type

9. **CSV Upload**
   - Fill in the template with sample data (use realistic numbers or the demo data below)
   - Upload via drag-and-drop or file picker
   - [ ] Validation passes
   - [ ] Preview table shows your data
   - [ ] Click "Submit" -- confirmation message appears

**Sample balance sheet data for testing:**

| category | subcategory | name | balance | rate | duration | rate_type |
|----------|-------------|------|---------|------|----------|-----------|
| asset | prestamos_personales | Consumer Loans | 85.5 | 0.085 | 3.2 | fixed |
| asset | prestamos_hipotecarios | Residential Mortgages | 120.0 | 0.055 | 12.5 | fixed |
| asset | inversiones | Investment Securities | 45.0 | 0.042 | 5.0 | fixed |
| asset | efectivo | Cash & Equivalents | 25.0 | 0.015 | 0.1 | variable |
| liability | ahorros_socios | Savings Deposits | 95.0 | 0.020 | 0.5 | variable |
| liability | certificados_accion | Time Deposits | 110.0 | 0.035 | 2.0 | fixed |
| liability | prestamos_externos | Borrowings | 30.0 | 0.048 | 3.0 | fixed |

> **Note:** The `balance` column is in millions. The `rate` column is a decimal (0.085 = 8.5%). The `duration` column is in years.

### Gate 3: Pipeline & Delivery

10. **Job Queued**
    - Check Railway logs immediately after CSV submit
    - [ ] Log shows pipeline picked up the job
    - [ ] `report_jobs` status changes from `AWAITING_DATA` to `QUEUED` to `PROCESSING`

11. **Pipeline Completes**
    - Wait up to 10 minutes, monitoring Railway logs
    - [ ] Log shows `pipeline.job.complete`
    - [ ] Report PDF URLs are populated in the database

12. **Report Delivery Email**
    - Check your inbox within 2 minutes of pipeline completion
    - [ ] Email received with report link
    - [ ] PDF link opens in browser
    - [ ] PDF shows correct institution name

13. **Operator Alert**
    - Check the `ERWIN_EMAIL` inbox
    - [ ] Revenue alert received (shows $750 payment)
    - [ ] Job completion notification received

### Gate Result

Count your checkboxes. You need **13 out of 13** to pass.

| Result | Action |
|--------|--------|
| 13/13 PASS | Proceed to Step 7 (Stripe Live Keys) |
| Any FAIL | See the Troubleshooting section at the bottom of this document |

---

## Step 7: PDF Storage Setup -- Cloudflare R2 (15 minutes)

> **Why this matters:** Without cloud storage, generated PDFs exist only in the backend's memory and cannot be downloaded by clients. R2 is cheap ($0.015/GB/month) and S3-compatible.

### 7A. Create a Cloudflare R2 Bucket

1. Log in at [dash.cloudflare.com](https://dash.cloudflare.com).
2. In the left sidebar, click **R2 Object Storage**.
3. Click **Create bucket**.
4. Name: `cerniq-reports`
5. Location: Auto (or choose a region close to your Railway server).
6. Click **Create bucket**.

### 7B. Create R2 API Credentials

1. In the R2 section, click **Manage R2 API tokens** (top right).
2. Click **Create API token**.
3. Token name: `cerniq-api`
4. Permissions: **Object Read & Write**
5. Specify bucket: `cerniq-reports`
6. Click **Create API Token**.
7. You will see three values:
   - **Account ID** (not needed for the env var, but useful)
   - **Access Key ID** -- this is `R2_ACCESS_KEY_ID`
   - **Secret Access Key** -- this is `R2_SECRET_ACCESS_KEY`
8. The **S3 endpoint** is shown at the top of the R2 page. It looks like: `https://<account-id>.r2.cloudflarestorage.com` -- this is `R2_ENDPOINT`.

### 7C. Set R2 Variables in Railway

Add these 4 variables to your Railway `cerniq-api` service:

| Variable | Value |
|----------|-------|
| `R2_ENDPOINT` | `https://<account-id>.r2.cloudflarestorage.com` |
| `R2_ACCESS_KEY_ID` | Your R2 access key |
| `R2_SECRET_ACCESS_KEY` | Your R2 secret key |
| `R2_BUCKET` | `cerniq-reports` |

Railway will auto-redeploy when you save.

### 7D. Verify Upload Works

After redeployment, re-run the pipeline test (upload a CSV in the portal). Check Railway logs for:

```
report.uploaded  key: reports/<job-id>/report_es.pdf
report.uploaded  key: reports/<job-id>/report_en.pdf
```

If you see `Storage not configured, skipping upload`, the R2 variables are not set correctly.

---

## Step 8: Switch Stripe to Live Mode (15 minutes)

> **Do this ONLY after the E2E test passes in test mode.** Live mode charges real credit cards.

### 8A. Activate Your Stripe Account

1. In Stripe, click your account name (top-left) > **Settings**.
2. Under **Business details**, complete all required fields:
   - Business name: KLYTICS LLC
   - Business type: LLC
   - Address: San Juan, Puerto Rico
   - Tax ID / EIN
   - Bank account for payouts
3. Stripe will review and activate your account (usually instant for US businesses).

### 8B. Create Live Products

1. Toggle Stripe to **Live mode** (top-right toggle -- turns the orange "Test" badge off).
2. Repeat Step 1E: Create the same 4 products with the same prices.
3. Copy the 4 new Live Price IDs.

### 8C. Create Live Webhook

1. In Live mode, go to **Developers > Webhooks**.
2. Create a new endpoint: `https://api.cerniq.io/api/billing/webhook`
3. Select the same 7 events as before.
4. Copy the new Live signing secret.

### 8D. Update Railway Environment Variables

Replace these 6 values in Railway:

| Variable | New Value |
|----------|-----------|
| `STRIPE_SECRET_KEY` | `sk_live_xxxx...` (the live secret key) |
| `STRIPE_WEBHOOK_SECRET` | `whsec_xxxx...` (the live webhook signing secret) |
| `STRIPE_PRICE_ONE_TIME` | `price_xxxx...` (the live one-time price ID) |
| `STRIPE_PRICE_MONTHLY` | `price_xxxx...` (the live monthly price ID) |
| `STRIPE_PRICE_ANNUAL` | `price_xxxx...` (the live annual price ID) |
| `STRIPE_PRICE_PARTNER` | `price_xxxx...` (the live partner price ID) |

### 8E. Update Vercel Environment Variable

| Variable | New Value |
|----------|-----------|
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | `pk_live_xxxx...` (the live publishable key) |

Trigger a Vercel redeploy after changing this (go to Deployments > click "Redeploy" on the latest).

### 8F. Verify Live Mode

1. Visit `https://cerniq.io/pricing`.
2. Click a tier.
3. Stripe Checkout should open WITHOUT the "Test mode" banner.
4. **Do not complete a real purchase yet.** Just verify the checkout opens correctly, then close it.

- [ ] Checkout opens in live mode
- [ ] Price is correct
- [ ] No "Test mode" banner
- [ ] Webhook endpoint shows as "Active" in Stripe live dashboard

---

## Step 9: Feature Verification Checklist (30 minutes)

Go through each feature module and verify it works in production.

### 9A. ALM Intelligence (Core Product)

| Check | How to Verify | Pass? |
|-------|---------------|-------|
| Institution creation | POST to `/api/alm/institutions` via portal or curl | [ ] |
| Balance sheet import | Upload CSV in portal `/portal/submit` | [ ] |
| ALM summary | Visit institution detail in portal -- shows NIM, duration gap, LCR | [ ] |
| COSSEC compliance | 12 regulatory ratios calculated and displayed | [ ] |
| Interest rate scenarios | Parallel shock results (+100, +200, +300, -100 bps) shown | [ ] |
| PDF generation | Pipeline processes and generates bilingual PDF | [ ] |
| ALCO Pack | Available from portal for download | [ ] |
| Multi-period trends | Delta arrows show when multiple periods uploaded | [ ] |

### 9B. AI Risk Advisor

| Check | How to Verify | Pass? |
|-------|---------------|-------|
| Advisor available | `ANTHROPIC_API_KEY` set in Railway | [ ] |
| Chat works | POST to `/api/alm/<institutionId>/advisor` with auth returns response | [ ] |
| Institution-specific | Response references actual balance sheet data | [ ] |
| Daily limit | After 20 queries in a day, returns limit message | [ ] |
| Bilingual | Set `language: "es"` -- response in Spanish | [ ] |

To test from command line:
```bash
curl -X POST https://api.cerniq.io/api/alm/YOUR_INSTITUTION_ID/advisor \
  -H "Authorization: Bearer <jwt-token>" \
  -H "Content-Type: application/json" \
  -d '{"message": "What is my current interest rate risk exposure?", "language": "en"}'
```

### 9C. Custom Scenario Builder (Stress Testing)

| Check | How to Verify | Pass? |
|-------|---------------|-------|
| Full stress test | GET `/api/alm/<institutionId>/stress-test/full` returns Monte Carlo results | [ ] |
| Custom scenario | POST with 4 parameters (rate shock, deposit runoff, default increase, energy cost) | [ ] |
| Named scenarios | COSSEC scenarios (Hurricane, Rate Shock, Pandemic) available | [ ] |
| Before/after impact | Response includes `nimBefore`, `nimAfter`, `verdict` | [ ] |

### 9D. Regulatory Calendar

| Check | How to Verify | Pass? |
|-------|---------------|-------|
| Deadlines returned | GET `/api/alm/<institutionId>/compliance-calendar` returns deadlines | [ ] |
| COSSEC exam | If `nextExamDate` set, shows in results | [ ] |
| Urgency levels | CRITICAL, HIGH, MEDIUM, LOW based on days remaining | [ ] |
| ALCO meeting dates | If configured, appears in calendar | [ ] |

### 9E. SpendCheck

| Check | How to Verify | Pass? |
|-------|---------------|-------|
| Page loads | Visit `https://cerniq.io/spendcheck` | [ ] |
| Upload zone | Drag-and-drop area renders | [ ] |

> **Note:** SpendCheck backend endpoints are not yet fully implemented (deferred to Tier 2). The frontend renders but full AP analysis is not yet available.

### 9F. Public API

| Check | How to Verify | Pass? |
|-------|---------------|-------|
| Swagger UI | Visit `https://api.cerniq.io/api/v1/docs` | [ ] |
| API key auth | Create an API key via portal settings, use it in requests | [ ] |
| Rate limiting | 100 requests/hour standard, 1000/hour partner | [ ] |

### 9G. Security & Compliance

| Check | How to Verify | Pass? |
|-------|---------------|-------|
| RBAC enforced | VIEWER role cannot upload data (returns 403) | [ ] |
| Audit logs | Check `audit_logs` table after login/upload/download actions | [ ] |
| AES-256 encryption | `DATA_ENCRYPTION_KEY` is set; `rawData` in report_jobs is encrypted | [ ] |
| Rate limiting | 100 requests/minute globally (ThrottlerModule) | [ ] |
| CORS | Only `cerniq.io` and configured origins allowed | [ ] |
| Admin auth | All `/api/admin/*` routes require `x-admin-key` header | [ ] |
| Detailed health hidden | GET `/health/detailed` returns 404 in production | [ ] |

### 9H. Revenue Operations

| Check | How to Verify | Pass? |
|-------|---------------|-------|
| Revenue alert | After test purchase, Erwin receives alert email | [ ] |
| Daily ops report | Sent at 8:00 AM AST (12:00 UTC) daily | [ ] |
| Pipeline health monitor | Stuck jobs auto-retry (check logs hourly) | [ ] |
| NPS email scheduling | After report delivery, C2 follow-up scheduled for 24h later | [ ] |
| Onboarding emails | B2 (30min) and B3 (48h) scheduled after purchase | [ ] |

### 9I. Admin Operations

Test the admin endpoints using your `ADMIN_KEY`:

```bash
# Platform stats
curl -H "x-admin-key: <admin-key>" https://api.cerniq.io/api/admin/stats

# Pipeline dashboard
curl -H "x-admin-key: <admin-key>" https://api.cerniq.io/admin/api/pipeline

# Revenue metrics
curl -H "x-admin-key: <admin-key>" https://api.cerniq.io/admin/api/revenue

# Prospect CRM
curl -H "x-admin-key: <admin-key>" https://api.cerniq.io/api/admin/prospects

# Demo requests
curl -H "x-admin-key: <admin-key>" https://api.cerniq.io/api/admin/demo-requests
```

- [ ] All 5 admin endpoints return 200 with JSON data

---

## Step 10: UptimeRobot Monitoring (5 minutes)

### 10A. Create Account

1. Go to [uptimerobot.com](https://uptimerobot.com) and create a free account.

### 10B. Add Monitors

Create these 4 monitors:

| Monitor Name | URL | Type | Interval |
|--------------|-----|------|----------|
| CERNIQ Frontend | `https://cerniq.io` | HTTP(s) | 5 min |
| CERNIQ API Health | `https://api.cerniq.io/health` | HTTP(s) - Keyword: `"ok"` | 5 min |
| CERNIQ Pricing Page | `https://cerniq.io/pricing` | HTTP(s) | 5 min |
| CERNIQ API Readiness | `https://api.cerniq.io/ready` | HTTP(s) - Keyword: `"true"` | 5 min |

### 10C. Set Alert Contacts

1. Go to **My Settings** > **Alert Contacts**.
2. Add your email (`eskiessalfonso@gmail.com`).
3. Assign this contact to all 4 monitors.

> **What happens:** If any endpoint goes down for 2+ consecutive checks (10 minutes), you get an email. Free tier supports up to 50 monitors.

---

## Step 11: OAuth Setup -- Google & GitHub (15 minutes, optional)

> OAuth is optional. Email/password and magic link login work without it. Set this up later if you want social login.

### 11A. GitHub OAuth

1. Go to [github.com/settings/developers](https://github.com/settings/developers).
2. Click **New OAuth App**.
3. Fill in:
   - Application name: `CERNIQ`
   - Homepage URL: `https://cerniq.io`
   - Authorization callback URL: `https://api.cerniq.io/api/auth/github/callback`
4. Click **Register application**.
5. Copy the **Client ID** and generate a **Client Secret**.
6. Add to Railway:
   - `GITHUB_CLIENT_ID` = the client ID
   - `GITHUB_CLIENT_SECRET` = the client secret

### 11B. Google OAuth

1. Go to [console.cloud.google.com](https://console.cloud.google.com).
2. Create a project (or select existing).
3. Go to **APIs & Services > Credentials**.
4. Click **Create Credentials > OAuth 2.0 Client ID**.
5. Application type: **Web application**.
6. Name: `CERNIQ`.
7. Authorized redirect URIs: `https://api.cerniq.io/api/auth/google/callback`
8. Click **Create**.
9. Copy the **Client ID** and **Client Secret**.
10. Add to Railway:
    - `GOOGLE_CLIENT_ID` = the client ID
    - `GOOGLE_CLIENT_SECRET` = the client secret

---

## Step 12: First Client Preparation (30 minutes)

### 12A. Prepare Your Demo Environment

1. **Create a demo institution** with realistic data:
   - Log into the portal as yourself
   - Create an institution named "Demo Cooperativa"
   - Upload a CSV with realistic balance sheet data (use the sample data from Step 6)
   - Wait for the pipeline to generate the PDF
   - Download the PDF and review it

2. **Save the demo PDF** -- you will show this during client meetings

### 12B. Test the Complete Demo Flow

Run through this exact sequence as if you were a prospect:

1. Open an incognito browser window
2. Visit `https://cerniq.io` -- landing page loads
3. Click "Pricing" or scroll to pricing section
4. Click the $750 tier
5. Complete checkout (use a test card if still in test mode)
6. Receive welcome email
7. Click magic link
8. Set up institution
9. Upload CSV
10. Wait for report
11. Download and review PDF

- [ ] The entire flow works end-to-end without errors
- [ ] Total time from checkout to PDF delivery is under 15 minutes

### 12C. Prepare Sales Materials

Review these documents in the repo:

| Document | Path | Purpose |
|----------|------|---------|
| LinkedIn outreach templates | `docs/content/linkedin_outreach_templates.md` | For DMs to CFOs |
| Demo script | `docs/sales/` | 20-minute demo walkthrough |
| Prospect list | `backend-node/src/leads/prospect-seed.ts` | 12 cooperativas with contact info |

### 12D. Seed the Prospect CRM (optional)

If you have configured `PROSPECT_SEED_DATA` as a JSON env var in Railway, seed the prospects:

```bash
curl -X POST -H "x-admin-key: <admin-key>" \
  https://api.cerniq.io/api/admin/seed-prospects
```

Or add prospects manually:

```bash
curl -X POST -H "x-admin-key: <admin-key>" \
  -H "Content-Type: application/json" \
  https://api.cerniq.io/api/admin/prospects \
  -d '{
    "name": "CFO Name",
    "email": "cfo@cooperativa.com",
    "company": "Cooperativa Oriental",
    "role": "CFO",
    "stage": "lead",
    "source": "outbound"
  }'
```

---

## Step 13: Go-Live Checklist (Final Review)

Before engaging any live client, confirm every item:

### Infrastructure

- [ ] Railway backend running, health check returns `ok`
- [ ] Vercel frontend deployed, all pages load
- [ ] Custom domains active: `cerniq.io` and `api.cerniq.io`
- [ ] SSL certificates active on both domains (HTTPS)
- [ ] Database connected and all 17 migrations applied

### Payments

- [ ] Stripe in live mode (if ready for real charges)
- [ ] 4 products with correct prices created in live mode
- [ ] Webhook endpoint active and receiving events
- [ ] Test checkout works (or verified in test mode)

### Email

- [ ] Resend domain `cerniq.io` verified
- [ ] SPF, DKIM, and DMARC records in DNS
- [ ] Welcome email delivers correctly
- [ ] Report delivery email delivers correctly
- [ ] Revenue alert email delivers to `eskiessalfonso@gmail.com`

### Security

- [ ] `JWT_SECRET` is unique (not shared with any other service)
- [ ] `DATA_ENCRYPTION_KEY` is set (64-char hex)
- [ ] `ADMIN_KEY` is set and not committed to code
- [ ] Admin endpoints reject requests without valid key
- [ ] `/health/detailed` returns 404 in production
- [ ] No secrets in `NEXT_PUBLIC_*` Vercel variables

### Monitoring

- [ ] UptimeRobot monitors active (4 monitors)
- [ ] Daily ops report email configured (8 AM AST)
- [ ] Pipeline health monitor running (hourly stuck-job check)

### Data

- [ ] At least one test report generated successfully
- [ ] PDF has 14+ pages, bilingual, CERNIQ branding
- [ ] Balance sheet data encryption verified

---

## Troubleshooting

### Backend Will Not Start

| Symptom | Cause | Fix |
|---------|-------|-----|
| `FATAL: JWT_SECRET must be set and at least 32 characters` | `JWT_SECRET` missing or too short | Set it in Railway (64-char hex from `openssl rand -hex 32`) |
| `FATAL: DATABASE_URL must be set` | PostgreSQL not connected | Verify Railway PostgreSQL plugin is active and sharing the variable |
| Container exits with code 1 | Check Railway build/deploy logs | Look for the specific error message in logs |
| Health check returns `"status":"down"` | Database connection failed | Verify `DATABASE_URL` is correct; check PostgreSQL service is running |

### Frontend Shows Blank or Errors

| Symptom | Cause | Fix |
|---------|-------|-----|
| API calls return 404 | `NEXT_PUBLIC_NODE_API_URL` wrong | Verify it points to your Railway backend URL |
| CORS errors in console | Backend CORS not configured | Verify `FRONTEND_URL` is set to `https://cerniq.io` in Railway |
| Pricing page broken | Stripe publishable key missing | Set `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` in Vercel |
| "Loading..." never resolves | API connection timeout | Check if the backend is running (`curl /health`) |

### Stripe Issues

| Symptom | Cause | Fix |
|---------|-------|-----|
| Checkout opens but fails | Price ID invalid | Verify `STRIPE_PRICE_*` IDs match your Stripe products |
| Webhook shows 401/500 | Signing secret mismatch | Re-copy `whsec_` from Stripe and update in Railway |
| No email after purchase | Webhook not firing | Check webhook endpoint URL matches your backend |
| "Billing is not configured" | `STRIPE_SECRET_KEY` not set | Add it in Railway |

### Email Issues

| Symptom | Cause | Fix |
|---------|-------|-----|
| Emails not sending | `RESEND_API_KEY` not set | Add it in Railway |
| Emails bouncing | Domain not verified | Complete domain verification in Resend dashboard |
| Emails in spam | Missing SPF/DKIM | Add the DNS records Resend provides |
| "RESEND_API_KEY not set" in logs | Variable name typo | Verify exact variable name in Railway |

### Pipeline Issues

| Symptom | Cause | Fix |
|---------|-------|-----|
| Jobs stuck in AWAITING_DATA | CSV not submitted | Client needs to upload data in portal |
| Jobs stuck in QUEUED | Pipeline cron not running | Check that `ScheduleModule` is imported; redeploy |
| Jobs stuck in PROCESSING | PDF generation crash | Check Railway logs for stack trace |
| PDF URLs empty | R2 not configured | Set R2 env vars (Step 7) |
| "Max retries exceeded" | Repeated failures | Check Railway logs for root cause, then force-regenerate via admin API |

### Force-Regenerate a Failed Job

```bash
# Get the job ID from admin pipeline dashboard
curl -H "x-admin-key: <admin-key>" \
  https://api.cerniq.io/admin/api/pipeline

# Force regenerate
curl -X POST -H "x-admin-key: <admin-key>" \
  https://api.cerniq.io/admin/api/pipeline/JOB_ID/force-regenerate
```

### Auth / Login Issues

| Symptom | Cause | Fix |
|---------|-------|-----|
| Magic link expires immediately | Server clock skew | Railway handles this automatically; check token TTL |
| Magic link redirects to `/auth/expired` | Token already used or expired | Request a new magic link |
| Cannot login after checkout | Cookie not setting | Set `AUTH_COOKIE_DOMAIN=.cerniq.io` in Railway |
| OAuth "not-configured" error | OAuth env vars missing | Set `GITHUB_CLIENT_ID/SECRET` or `GOOGLE_CLIENT_ID/SECRET` |

---

## Appendix A: Complete Environment Variable Reference

### Railway (Backend) -- All Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `JWT_SECRET` | Yes | JWT signing secret (min 32 chars) |
| `NODE_ENV` | Yes | Must be `production` |
| `FRONTEND_URL` | Yes | `https://cerniq.io` |
| `ADMIN_KEY` | Yes | Admin API authentication |
| `DATA_ENCRYPTION_KEY` | Yes | AES-256 key (64-char hex) |
| `ERWIN_EMAIL` | Yes | Operator alert email |
| `RESEND_API_KEY` | Yes | Transactional email API key |
| `STRIPE_SECRET_KEY` | Yes | Stripe API secret key |
| `STRIPE_WEBHOOK_SECRET` | Yes | Stripe webhook signing secret |
| `STRIPE_PRICE_ONE_TIME` | Yes | Price ID for $750 one-time |
| `STRIPE_PRICE_MONTHLY` | Yes | Price ID for $299/mo |
| `STRIPE_PRICE_ANNUAL` | Yes | Price ID for $2,400/yr |
| `STRIPE_PRICE_PARTNER` | Yes | Price ID for $499/mo |
| `ANTHROPIC_API_KEY` | Recommended | AI Risk Advisor |
| `ALPHA_VANTAGE_API_KEY` | Recommended | Market data |
| `R2_ENDPOINT` | Recommended | Cloudflare R2 endpoint |
| `R2_ACCESS_KEY_ID` | Recommended | R2 access key |
| `R2_SECRET_ACCESS_KEY` | Recommended | R2 secret key |
| `R2_BUCKET` | Recommended | R2 bucket name |
| `GITHUB_CLIENT_ID` | Optional | GitHub OAuth |
| `GITHUB_CLIENT_SECRET` | Optional | GitHub OAuth |
| `GOOGLE_CLIENT_ID` | Optional | Google OAuth |
| `GOOGLE_CLIENT_SECRET` | Optional | Google OAuth |
| `REDIS_URL` | Optional | Redis cache URL |
| `AUTH_COOKIE_DOMAIN` | Optional | Cookie domain |
| `AUTH_COOKIE_SECURE` | Optional | Force secure cookies |
| `AUTH_COOKIE_SAMESITE` | Optional | Cookie SameSite policy |
| `ALLOW_PREVIEW_ORIGINS` | Optional | Allow Vercel preview CORS |
| `HEALTH_DETAILS_PUBLIC` | Optional | Expose detailed health endpoint |

### Vercel (Frontend) -- All Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_NODE_API_URL` | Yes | NestJS backend URL |
| `NEXT_PUBLIC_API_URL` | Yes | Same as above (legacy) |
| `NEXT_PUBLIC_APP_URL` | Yes | Frontend URL |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Yes | Stripe publishable key |
| `NEXT_PUBLIC_ALLOW_DEMO_MOCKS` | Recommended | Set to `false` in production |

---

## Appendix B: Key URLs Reference

| URL | Purpose |
|-----|---------|
| `https://cerniq.io` | Frontend (Vercel) |
| `https://cerniq.io/pricing` | Pricing page with Stripe checkout |
| `https://cerniq.io/login` | Login page |
| `https://cerniq.io/portal` | Client portal |
| `https://cerniq.io/portal/submit` | Data upload page |
| `https://cerniq.io/portal/billing` | Billing management |
| `https://cerniq.io/alm` | ALM dashboard |
| `https://cerniq.io/spendcheck` | SpendCheck module |
| `https://api.cerniq.io/health` | Backend health check |
| `https://api.cerniq.io/ready` | Backend readiness check |
| `https://api.cerniq.io/api/status` | API status |
| `https://api.cerniq.io/api/v1/docs` | Swagger API documentation |
| `https://api.cerniq.io/api/billing/webhook` | Stripe webhook endpoint |

---

## Appendix C: Admin API Quick Reference

All admin endpoints require the `x-admin-key` header.

```bash
# Set your admin key for convenience
export ADMIN_KEY="your-admin-key-here"
export API="https://api.cerniq.io"

# Platform stats (users, institutions, demo requests)
curl -H "x-admin-key: $ADMIN_KEY" $API/api/admin/stats

# Operations dashboard (recent jobs, subscriptions, analysis runs)
curl -H "x-admin-key: $ADMIN_KEY" $API/api/admin/ops

# Control tower summary (operator command center)
curl -H "x-admin-key: $ADMIN_KEY" $API/admin/api/control-tower/summary

# Pipeline jobs and health
curl -H "x-admin-key: $ADMIN_KEY" $API/admin/api/pipeline

# Revenue metrics (MRR, ARR, daily/monthly/yearly)
curl -H "x-admin-key: $ADMIN_KEY" $API/admin/api/revenue

# Prospect CRM (list all)
curl -H "x-admin-key: $ADMIN_KEY" $API/api/admin/prospects

# Demo requests (from landing page)
curl -H "x-admin-key: $ADMIN_KEY" $API/api/admin/demo-requests

# Force-regenerate a failed report job
curl -X POST -H "x-admin-key: $ADMIN_KEY" $API/admin/api/pipeline/JOB_ID/force-regenerate

# Force-advance a stuck job to QUEUED
curl -X POST -H "x-admin-key: $ADMIN_KEY" $API/admin/api/pipeline/JOB_ID/force-advance

# Force-fail a job (with reason)
curl -X POST -H "x-admin-key: $ADMIN_KEY" -H "Content-Type: application/json" \
  $API/admin/api/pipeline/JOB_ID/force-fail -d '{"reason":"Manual cancellation"}'
```

---

## Appendix D: Cron Jobs Running in Production

The NestJS backend runs these scheduled tasks automatically:

| Schedule | Task | What It Does |
|----------|------|--------------|
| Every 2 minutes | Pipeline Queue Processor | Picks up `QUEUED` report jobs and processes them |
| Every hour | Stalled Job Detector | Resets jobs stuck in `PROCESSING` for 30+ minutes (max 3 retries) |
| Daily at 12:00 UTC (8 AM AST) | Daily Health Report | Emails Erwin with pending jobs, failed jobs, new leads, overdue follow-ups |

No crontab configuration needed -- these run inside the NestJS process via `@nestjs/schedule`.

---

## Appendix E: Related Documentation

| Document | Path | Purpose |
|----------|------|---------|
| E2E Production Gate | `docs/ops/e2e_production_gate.md` | Detailed 13-step verification with pass/fail |
| Railway Env Vars | `docs/ops/railway_env_vars.md` | Variable reference with data retention notes |
| Deployment Runbook | `docs/ops/deployment_runbook.md` | Day-to-day deployment procedures and rollback |
| Health Check Script | `scripts/health-check.sh` | Automated production verification |

---

## Version History

| Date | Version | Changes |
|------|---------|---------|
| 2026-03-17 | 1.0 | Initial comprehensive walkthrough |
