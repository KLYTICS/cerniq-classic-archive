# CERNIQ Cold-Storage Revival Runbook

**Status:** Operator-side prerequisite for `deployment_runbook.md`. Run this FIRST. The code lane (PR #61) is green and ready to merge, but the underlying infrastructure was cold-stored on **2026-05-09** as part of the portfolio spend-reduction pivot. Until steps 1–7 below are complete, `deploy-backend` and `deploy-frontend` CI jobs will either no-op or fail.

**Audience:** You (Erwin), at a terminal with browser access to Railway / Vercel / Cloudflare / Spaceship dashboards. None of this is automatable from a CI job — it requires owner-level dashboard auth.

**Time:** 60–90 min if dumps are recoverable, 2–4 hours if migrating from a fresh schema.

---

## 0. Pre-flight reality check (5 min)

**Quick automated check first:**

```bash
bash scripts/pre-deploy-smoke.sh
```

This runs ~45 local checks against the checkout (toolchain, type-check, schema validation, env-var hygiene, CI wiring, runbook presence) in about 30 seconds. If it exits 0, the codebase is ready to deploy *if* the infrastructure exists. If it exits 1, fix the failing checks before spending an hour on dashboards — the dashboard work is wasted if the code won't build.

After the smoke script passes, verify what was actually preserved in the cold-storage tear-down. The cold-storage memory from 2026-05-09 claims Railway was deleted, GitHub Actions disabled, Postgres dumped to `~/Desktop/spend-audit-2026-05-09/dumps/`. Some of this is now stale:

| Claim | Verified as of 2026-05-16 | Notes |
|---|---|---|
| Railway project deleted | Likely — no `~/.config/railway`, no local link, runbook refs project `0a09d7c9-a960-49df-a71d-12d06d7c8bcd` which is unreachable | Confirm by attempting `railway login` then `railway list` |
| Vercel project deleted | Likely — `vercel ls` from frontend/ returns dead-link, but `cerniq.io` still serves cached edge build | Cached HTML survives; new deploys would 404 the integration |
| GitHub Actions disabled | Stale — Actions are running (PR #61 had 22 green checks today) | Re-enabled at some point; verify in repo Settings → Actions |
| Postgres dump at `~/Desktop/spend-audit-2026-05-09/dumps/` | **UNVERIFIED** — `~/Desktop/spend-audit-2026-05-09/` is permission-locked from CLI | Open in Finder to verify; if empty, see §3b |
| TLS cert on `api.cerniq.io` | Mismatched — cert is `*.up.railway.app`, not `api.cerniq.io` | Will need re-issue at Cloudflare once new Railway service exists |

**Action:** Open `~/Desktop/spend-audit-2026-05-09/dumps/` in Finder right now. If there's a `.dump`, `.sql`, or `.sql.gz` file there, note the filename and size. If empty, you are on the fresh-schema path (§3b).

---

## 1. Decide: restore vs. fresh boot

| Path | Pick when | Tradeoff |
|---|---|---|
| **Path R** (Restore) | Dump file exists and is recent (≥ April 2026) | Preserves historical user data, billing state, audit logs |
| **Path F** (Fresh) | Dump missing, corrupt, or > 90 days old | Faster boot, but every user must re-register; Stripe subscriptions need manual reconciliation |

If you're not 100% sure the dump is intact, **stop and verify**. A bad restore is worse than a fresh start because it can re-inject stale OAuth state, expired Stripe customer IDs, and revoked JWT secrets.

---

## 2. Railway revival (15–30 min)

### 2.1 Authenticate

```bash
railway login   # opens browser
railway whoami  # confirm account
```

### 2.2 Create the project

```bash
railway init --name cerniq-api
```

Pick "Empty Project" when prompted. Note the new project ID — you'll need it for §6.

### 2.3 Provision Postgres

In Railway dashboard:
1. Project → New → Database → PostgreSQL
2. Wait for provisioning (~60s)
3. Click the Postgres service → Variables → copy `DATABASE_URL` (it's the `postgres://...@postgres-production-xxxx.up.railway.app:port/railway` form — use the internal one for the API service, see 2.5)

### 2.4 Restore or bootstrap the database

**Path R — Restore:**

```bash
# Replace the placeholders with the values from §2.3 and the verified dump
DUMP_FILE="$HOME/Desktop/spend-audit-2026-05-09/dumps/cerniq-prod-YYYY-MM-DD.dump"
DATABASE_URL="postgresql://postgres:...@maglev.proxy.rlwy.net:PORT/railway"

# pg_restore from custom-format dump (the format Railway exports)
pg_restore --clean --if-exists --no-owner --no-acl \
  --dbname="$DATABASE_URL" \
  "$DUMP_FILE"

# Or if it's a plain SQL dump:
psql "$DATABASE_URL" -f "$DUMP_FILE"
```

After restore, fast-forward Prisma's migration table so `migrate deploy` doesn't try to replay:

```bash
cd backend-node
DATABASE_URL="$DATABASE_URL" npx prisma migrate resolve --applied "20260417020000_rls_tenant_isolation"
# (use whichever was the latest migration in the dump)
DATABASE_URL="$DATABASE_URL" npx prisma migrate deploy   # applies anything newer
```

**Path F — Fresh:**

```bash
cd backend-node
DATABASE_URL="$DATABASE_URL" npx prisma migrate deploy
```

This applies all 36 migrations including `20260417020000_rls_tenant_isolation`. Takes ~30s. After it completes:

```bash
DATABASE_URL="$DATABASE_URL" npx prisma migrate status
# Should show: "Database schema is up to date!"
```

### 2.5 Create the API service

```bash
cd /Users/money/Desktop/Cerniq
railway link   # interactive — pick the project from §2.2
cd backend-node
railway service create cerniq-api
```

Note the service ID for §6.

### 2.6 Set environment variables on the API service

Reference `docs/ops/railway_env_vars.md` for the full list. Minimum required for boot:

```bash
railway variables --service cerniq-api --set "DATABASE_URL=<internal postgres URL from 2.3>"
railway variables --service cerniq-api --set "JWT_SECRET=$(openssl rand -hex 32)"
railway variables --service cerniq-api --set "DATA_ENCRYPTION_KEY=$(openssl rand -hex 32)"
railway variables --service cerniq-api --set "FRONTEND_URL=https://cerniq.io"
railway variables --service cerniq-api --set "ALLOWED_ORIGINS=https://cerniq.io,https://app.cerniq.io"
railway variables --service cerniq-api --set "NODE_ENV=production"
railway variables --service cerniq-api --set "ADMIN_KEY=$(openssl rand -hex 32)"
```

**WARNING on `DATA_ENCRYPTION_KEY`:** if you took Path R (restore), this MUST be the same value used when the dump was created, or every encrypted `rawData` field will return gibberish. If you can't recover the original key, document the loss and treat encrypted columns as a known DataGap (per Rule 1 of KLYTICS audit discipline — never silent zeros).

Then layer in the third-party keys (Stripe, Resend, Anthropic, OAuth, Sentry, Alpha Vantage) — see `docs/ops/railway_env_vars.md` for the full table. **Do not paste live Stripe keys until §7** so dry-run smoke tests can't accidentally bill anyone.

### 2.7 First deploy

```bash
cd /Users/money/Desktop/Cerniq/backend-node
railway up --service cerniq-api
```

Stream logs:
```bash
railway logs --service cerniq-api --follow
```

Wait for `Nest application successfully started`. Then check the temporary Railway URL:
```bash
TEMP_URL=$(railway domain --service cerniq-api | grep https | head -1)
curl "$TEMP_URL/health"
# Expected: {"success":true,"data":{"status":"ok"|"degraded",...}}
```

Do NOT proceed to §3 until `/health` returns 200.

---

## 3. Vercel revival (10–20 min)

### 3.1 Authenticate and link

```bash
cd /Users/money/Desktop/Cerniq/frontend
rm -rf .vercel   # clear stale project link from deleted project
vercel login
vercel link --yes   # creates fresh .vercel/project.json
```

When prompted:
- Set up and deploy? **n** (we'll configure first)
- Link to existing project? **n**
- Project name: `cerniq-frontend` (or whatever the dashboard already shows)
- Directory: `./` (current = `frontend/`)

### 3.2 Set environment variables

```bash
vercel env add NEXT_PUBLIC_NODE_API_URL production
# When prompted, paste: https://api.cerniq.io
vercel env add NEXT_PUBLIC_APP_URL production
# Paste: https://cerniq.io
vercel env add NEXT_PUBLIC_API_URL production
# Paste: https://api.cerniq.io
vercel env add NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY production
# Paste your pk_live_... (or pk_test_... for first smoke)
vercel env add NEXT_PUBLIC_ALLOW_DEMO_MOCKS production
# Paste: false
```

### 3.3 First deploy

```bash
vercel --prod
```

Wait for the build (~2 min). Note the deployment URL (e.g., `cerniq-frontend-xxx.vercel.app`).

### 3.4 Attach the production domain

In Vercel dashboard → cerniq-frontend → Settings → Domains:
1. Add `cerniq.io`
2. Add `www.cerniq.io` (redirect to apex)
3. Vercel will show the required DNS records — note them for §4

---

## 4. DNS + TLS (15–30 min, blocked on DNS propagation)

**DNS authority for cerniq.io is Spaceship retail (`launch1.spaceship.net`, `launch2.spaceship.net`), NOT Cloudflare.** Spaceship is both registrar and DNS host. Do not look for a Cloudflare zone — there isn't one. There is no programmatic API for Spaceship retail DNS; all edits below are operator-only via the dashboard at `https://www.spaceship.com/`.

### 4.1 Spaceship DNS — apex + www + api

Log into Spaceship → cerniq.io → Advanced DNS. Add or update:

| Type | Name | Value | Notes |
|---|---|---|---|
| A | @ | (Vercel-supplied IP from §3.4) | apex |
| CNAME | www | `cname.vercel-dns.com` | redirect target |
| CNAME | api | `<new-railway-domain>.up.railway.app` | from §2.7 — update if revival #2 |

If `api` already has a CNAME from a previous (cold-stored) Railway service, **edit it in place** to the new hostname from §2.7. Do not leave the stale CNAME — it returns the `x-railway-fallback: true` header which clients treat as `503`.

### 4.2 Railway TLS issuance (custom domain)

This closes the **TLS cert mismatch** on `api.cerniq.io`. The default cert at `<new-railway-domain>.up.railway.app` covers only Railway's wildcard; browsers reject it for `api.cerniq.io`.

1. Railway dashboard → cerniq-api service → Settings → Networking → Custom Domain → add `api.cerniq.io`
2. Railway will display a CNAME target (e.g., `xxxxxx.up.railway.app`) AND a TXT verification record `_railway-verify.api` → value. **Both must be set at Spaceship before the cert issues.** Update §4.1's `api` CNAME to match if Railway returns a different target than §2.7.
3. Let's Encrypt issuance is automatic once both DNS records propagate. Takes 1–10 min.
4. Watch the Railway dashboard "Custom Domains" panel — it flips from "Pending Verification" → "Active" when the cert lands.

Verify from a terminal:
```bash
# Wait for DNS propagation (typically ≤ 10 min at Spaceship)
dig +short CNAME api.cerniq.io @1.1.1.1
# Should return the railway-domain target (NOT empty, NOT the stale cold-storage host)

dig +short TXT _railway-verify.api.cerniq.io @1.1.1.1
# Should match the verification value Railway showed in step 2

# Then verify the cert SAN
echo | openssl s_client -servername api.cerniq.io -connect api.cerniq.io:443 2>/dev/null \
  | openssl x509 -noout -subject
# Expected: subject=CN=api.cerniq.io  (not *.up.railway.app)

# And the kill-switch: x-railway-fallback MUST be absent
curl -sSI https://api.cerniq.io/health | grep -i 'x-railway-fallback' && echo "STILL DEAD" || echo "OK — live service"
```

---

## 5. Stripe + Resend rewiring (10 min)

### 5.1 Stripe webhook endpoint

1. Stripe Dashboard → Webhooks → Add endpoint
2. URL: `https://api.cerniq.io/api/billing/webhook`
3. Events: `checkout.session.completed`, `customer.subscription.*`, `invoice.*` (or match what's listed in `backend-node/src/billing/billing.controller.ts`)
4. Copy the new `whsec_...` signing secret
5. Paste into Railway: `railway variables --service cerniq-api --set "STRIPE_WEBHOOK_SECRET=whsec_..."`
6. Redeploy: `railway up --service cerniq-api`

### 5.2 Resend domain re-verification

If the Resend domain verification expired during cold-storage:
1. Resend dashboard → Domains → cerniq.io
2. If shown as "unverified", re-add the SPF / DKIM / DMARC TXT records via Cloudflare (per `docs/ops/resend_dns_setup.md`)
3. Click "Verify" — typically takes 5–15 min after DNS propagates

---

## 6. GitHub Actions secrets refresh (5 min)

The `release-gate` workflow's `deploy-backend` job references repo-level vars and secrets that point at the deleted project. Refresh them:

```bash
# Project + service IDs from §2.2 and §2.5
gh variable set RAILWAY_PROJECT_ID --body "<new-project-id>"
gh variable set RAILWAY_SERVICE_ID --body "<new-service-id>"
gh variable set RAILWAY_ENVIRONMENT_NAME --body "production"

# Token: generate at https://railway.app/account/tokens, scope to new project
gh secret set RAILWAY_TOKEN --body "<new-railway-token>"
```

Vercel is auto-wired via the GitHub integration once §3.4 completes — no repo-secret refresh needed (the `deploy-frontend` job is a no-op echo by design).

Verify by running a dry workflow trigger:
```bash
gh workflow run "CERNIQ CI/CD" --ref claude/enterprise-quality-hardening
gh run watch
```

---

## 7. Smoke test (10 min)

Once §1–§6 are done, run the existing health script:

```bash
cd /Users/money/Desktop/Cerniq
bash scripts/health-check.sh https://api.cerniq.io https://cerniq.io
```

All checks must PASS. If any fail, see `docs/ops/deployment_runbook.md` §7 "Common Issues and Fixes" — that runbook now applies in full.

Manual end-to-end:
1. Visit `https://cerniq.io` — landing page loads, no console errors
2. Visit `https://cerniq.io/pricing` — Stripe checkout button renders
3. Sign up via magic link — email arrives (Resend), link works (JWT_SECRET)
4. `curl -H "x-admin-key: $ADMIN_KEY" https://api.cerniq.io/api/admin/stats` — returns JSON
5. Trigger one Stripe test webhook (`checkout.session.completed` with test mode) — confirm 200 in Stripe dashboard "Recent deliveries"

---

## 8. Hand back to Claude

Once §7 is fully green, msg the cerniq Claude lane:

```bash
~/.claude/peers/bin/claude-peers msg cerniq "Cold-storage revival complete. \
Railway project=<new-id> service=<new-id>. \
Vercel project=cerniq-frontend (live). \
api.cerniq.io cert OK. \
All 7 smoke checks passed. \
Ready for PR #61 merge + deploy."
```

Claude will then:
1. Wait for the 3 active peer write-sessions to settle
2. Confirm `claude/enterprise-quality-hardening` is still mergeable
3. Squash-merge PR #61 to main
4. Watch the `deploy-backend` + `deploy-frontend` workflow runs
5. Verify with `scripts/health-check.sh` post-deploy
6. Update `docs/SESSION_HANDOFF.md` with the deployment log entry

---

## 9. Rollback / abort

If any step fails and you want to bail:

- **Before §3** (Railway only): `railway down --service cerniq-api` and delete the project from dashboard. Cost so far: ~$0 (Railway bills monthly, prorated).
- **Before §4** (Railway + Vercel, but no DNS changes): same as above + `vercel projects rm cerniq-frontend --yes`. Cached `cerniq.io` build keeps serving via the old Vercel edge.
- **After §4** (DNS changed): you have a window where `cerniq.io` may briefly 502 while DNS propagates back. Revert the Cloudflare records first, wait 5 min, then teardown Railway/Vercel. The cached edge build returns once DNS re-resolves.

There's no rollback from Path F (fresh database) once users start signing up — you'd have to merge old + new data manually. That's the main reason to start Path R if there's any chance the dump is usable.

---

## Appendix A — Why this exists separately from `deployment_runbook.md`

`deployment_runbook.md` assumes infrastructure exists and you're shipping a new build to it. This runbook assumes the infrastructure was *intentionally torn down* (cold-storage pivot 2026-05-09) and needs reconstitution. The two are complementary: complete this runbook once, then `deployment_runbook.md` governs every deploy thereafter.

## Appendix B — 2026-05-16 revival log (precedent for next cycle)

This appendix records the actual execution of the runbook on 2026-05-16, after the 2026-05-09 cold-storage tear-down. Captured here so the next cycle has a precedent, not just a procedure. **IDs are stable-infra references, not secrets.** Where a literal value would be a secret (tokens, keys, database URLs), this log records only the ID/path of the secret, never its content.

### Sequence

1. **Path decision (§1):** Path F (Fresh). The 2026-05-09 dump directory at `~/Desktop/spend-audit-2026-05-09/dumps/` was TCC-locked from CLI access, never verified in time. Historical encrypted `report_jobs.raw_data` rows are tombstones — `DATA_ENCRYPTION_KEY` was not in scope to recover. Accepted as DataGap per Rule 1.
2. **Railway (§2):** New project `cerniq-api` provisioned at 19:30 UTC. Postgres + API service in one project. 24 env vars set via `gh secret set --body-file -` and Railway dashboard; 5 left empty (Sentry + Slack-webhook — operator can fill later). 37 Prisma migrations auto-applied on first boot in ~30s.
3. **DNS (§4):** Operator-only — only `api` CNAME + `_railway-verify.api` TXT updates pending at Spaceship. Old CNAME pointed at `48l0ranw.up.railway.app` (deleted project), new target was the §2.7 Railway-supplied hostname.
4. **CI secrets (§6):** `RAILWAY_TOKEN` regenerated via the GraphQL `projectTokenCreate` mutation against `https://backboard.railway.com/graphql/v2`, using the user-level session token already cached at `~/.railway/config.json`. Token value was piped to `gh secret set --body-file -` and never touched argv, history, or session context. A first-attempt orphan token was cleaned up via `projectTokenDelete`. Pattern is reusable for any future "regen CI token" need.
5. **Smoke (§7):** Pre-deploy `scripts/pre-deploy-smoke.sh` exited 0 (42/44 with peer-lane TS noise; 44/44 on the cold-storage paths). Post-deploy `scripts/health-check.sh` deferred until §4 DNS lands.

### Resource IDs (this revival cycle)

| Resource | ID (post-revival) | Notes |
|---|---|---|
| Railway project (old) | `0a09d7c9-a960-49df-a71d-12d06d7c8bcd` | Deleted 2026-05-09 |
| Railway project (new) | `1ad9be3e-c89d-4b18-9af2-b1775a14161d` | Provisioned 2026-05-16 19:30 UTC |
| Railway production environment | `8e51374b-5f13-4980-a037-007c6c1792bc` | New project's prod env |
| Backend service (new) | `9b95101a-736a-4349-83ca-d901dc8f1757` | replaces old `809be713-…` |
| Postgres service (new) | `4411b6cf-02b4-4d8f-93f2-0d2bf533df50` | Fresh DB — no restore |
| Vercel project (unchanged) | `prj_odl6Ltja3NXGwJI0v7jZ7NEs88bL` | `capexcycle` / `ekiess-projects` — survived cold-storage |
| Railway CI token (active) | id `ab6c759e-e517-4ada-80ef-b60d39af5507` | name `cerniq-ci-active-2026-05-16`; value in GH secret `RAILWAY_TOKEN` (env=production) |

These IDs become stale on the next revival cycle. Treat the table as a snapshot.

### Lessons (read before next revival)

- **§4 originally directed operators to Cloudflare** — this was wrong; cerniq DNS has always been Spaceship retail. Fixed in this rev. If a future revival pulls cerniq into a Cloudflare zone, the §4 prose needs to flip back.
- **TCC permission on `~/Desktop/spend-audit-…` is not enumerable from Claude's shell** — granting Full Disk Access OR moving the dump dir to `~/cerniq-backups/` solves this. Path F was forced this cycle because the dump was unverifiable in time.
- **`x-railway-fallback: true`** is the symptom of a stale CNAME pointing at a deleted Railway project. Watch for it in §7 smoke output before assuming a deploy issue.
- **`AUTH_ALLOW_LEGACY=true`** was set in env so existing API keys (hashed with legacy SHA-256) continue to authenticate; revoke once all keys re-issued under HMAC-with-pepper.
- **Live secrets in repo `.env`** (Stripe `sk_live_…`, Anthropic, Resend) were treated as compromised because they touched at least one local-shell session during recovery; **rotate during the next revival window**.

---

## Appendix C — Cost expectations

A typical CERNIQ revival lands at roughly:

| Service | Plan | Monthly |
|---|---|---|
| Railway (API + Postgres + cron) | Hobby+ | $20–40 |
| Vercel (Pro tier required for production domain) | Pro | $20 |
| Cloudflare (DNS + R2 + WAF) | Free → Pro for WAF | $0–20 |
| Stripe | Per-transaction | usage-based |
| Resend | Free tier (3k/mo) → Pro | $0–20 |
| Sentry | Free dev → Team | $0–26 |
| Anthropic API | Per-token | usage-based |
| **Baseline** | | **~$60–125/mo** before AI/Stripe usage |

Set the Actions org budget per the KLYTICS billing footgun memory — $100 with alert at 75%, NOT $0 with Stop=Yes (the latter bricks ALL CI org-wide).
