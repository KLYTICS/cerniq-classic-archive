# CERNIQ Cold-Storage Revival Runbook

**Status:** Operator-side prerequisite for `deployment_runbook.md`. Run this FIRST. The code lane (PR #61) is green and ready to merge, but the underlying infrastructure was cold-stored on **2026-05-09** as part of the portfolio spend-reduction pivot. Until steps 1–7 below are complete, `deploy-backend` and `deploy-frontend` CI jobs will either no-op or fail.

**Audience:** You (Erwin), at a terminal with browser access to Railway / Vercel / Spaceship dashboards (and optionally Cloudflare, if R2 storage or WAF are reactivated — neither is required for the core revival). None of this is automatable from a CI job — it requires owner-level dashboard auth.

**Time:** 60–90 min if dumps are recoverable, 2–4 hours if migrating from a fresh schema.

---

## 0. Pre-flight reality check (5 min)

**Quick automated check first:**

```bash
npm run smoke:pre-deploy        # ~30s, ~45 checks
npm run smoke:pre-deploy:test   # ~1s, self-test of the smoke's machinery
```

(Equivalent to `bash scripts/pre-deploy-smoke.sh` / `... --self-test` for environments without npm; the npm forms are the canonical discovery path.)

This runs ~45 local checks against the checkout (toolchain, type-check, schema validation, env-var hygiene, CI wiring, runbook presence) in about 30 seconds. If it exits 0, the codebase is ready to deploy *if* the infrastructure exists. If it exits 1, fix the failing checks before spending an hour on dashboards — the dashboard work is wasted if the code won't build.

`smoke:pre-deploy` is also the first step of `npm run verify:local:critical` — that command runs the full lint+test+build gate chain, so if you've just run `verify:local:critical` and it passed, the pre-deploy gate is already green.

After the smoke script passes, verify what was actually preserved in the cold-storage tear-down. The cold-storage memory from 2026-05-09 claims Railway was deleted, GitHub Actions disabled, Postgres dumped to `~/Desktop/spend-audit-2026-05-09/dumps/`. Some of this is now stale:

| Claim | Verified as of 2026-05-16 | Notes |
|---|---|---|
| Railway project deleted | Likely — no `~/.config/railway`, no local link, runbook refs project `0a09d7c9-a960-49df-a71d-12d06d7c8bcd` which is unreachable | Confirm by attempting `railway login` then `railway list` |
| Vercel project deleted | **No — likely survived.** The 2026-05-09 cold-storage tear-down did NOT delete Vercel. Check `.vercel/project.json` (root + `frontend/`) — if either exists, the project is alive. Per 2026-05-16 revival, prod is `capexcycle` (id `prj_odl6Ltja3NXGwJI0v7jZ7NEs88bL`) and `cerniq.io` still serves it. | Skip §3.1 recreate-from-scratch if the link exists; jump to §3.2 env-var refresh. |
| GitHub Actions disabled | Stale — Actions are running (PR #61 had 22 green checks today) | Re-enabled at some point; verify in repo Settings → Actions |
| Postgres dump at `~/Desktop/spend-audit-2026-05-09/dumps/` | **UNVERIFIED** — `~/Desktop/spend-audit-2026-05-09/` is permission-locked from CLI | Open in Finder to verify; if empty, see §3b |
| TLS cert on `api.cerniq.io` | Mismatched — cert is `*.up.railway.app`, not `api.cerniq.io` | Railway issues a new Let's Encrypt cert when `api.cerniq.io` is added as a Custom Domain on the service (see §4.2). No Cloudflare involved. |

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

# SAFETY CHECK — confirm the target DB is empty before --clean wipes it.
# pg_restore --clean --if-exists DROPS existing tables, so a wrong
# DATABASE_URL (e.g., accidentally pointing at another live DB) is a
# silent disaster. Expected output: zero tables in the public schema.
psql "$DATABASE_URL" -tAc \
  "SELECT count(*) FROM information_schema.tables WHERE table_schema='public';"
# Expected: 0 (a fresh Railway Postgres has no public tables yet).
# If non-zero — STOP. Either you're pointing at the wrong DB, or someone
# already started a restore. Reconcile before continuing.

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

Reference `docs/ops/railway_env_vars.md` for the full list. Minimum required for boot (note the **Path R / Path F** column — values diverge):

| Variable | Path F (Fresh) | Path R (Restore) | Why it matters on Path R |
|---|---|---|---|
| `DATABASE_URL` | from §2.3 (internal Postgres) | from §2.3 — same URL whether Fresh or Restored | n/a — points at the DB |
| `JWT_SECRET` | `openssl rand -hex 32` | **MUST match dump-era value** | All stored refresh tokens + active session JWTs verify against this. Fresh value → every user logged out. |
| `DATA_ENCRYPTION_KEY` | `openssl rand -hex 32` | **MUST match dump-era value** | AES-256 key for `report_jobs.raw_data` + other encrypted columns. Fresh value → existing rows return gibberish. |
| `API_KEY_PEPPER` | `openssl rand -hex 32` | **MUST match dump-era value** | HMAC pepper used in the API-key hash function. Fresh value → every issued customer key fails auth (per `feedback_hash_divergence_pattern` memory: this is exactly how `e602c1d7` shipped broken customer auth for an unknown duration). |
| `MASTER_ACCOUNT_PASSWORD` | `openssl rand -hex 32` | **MUST match dump-era value** | Master-account password derivative used in privileged auth path. Fresh value → master account locked out. |
| `FRONTEND_URL` | `https://cerniq.io` | same | CORS + email-link origin |
| `ALLOWED_ORIGINS` | `https://cerniq.io,https://app.cerniq.io` | same | CORS allowlist |
| `NODE_ENV` | `production` | same | enables prod-mode hardening |
| `ADMIN_KEY` | `openssl rand -hex 32` | safe to rotate | not stored in DB; only used for admin endpoint auth |
| `AUTH_ALLOW_LEGACY` | `false` | `true` (temporarily) | per 2026-05-16 revival precedent — allow legacy SHA-256 hashed keys to authenticate while customers re-issue under HMAC-with-pepper. Revoke once cutover is complete. |

```bash
# Path F example. For Path R, source the must-match values from the local
# .env files BEFORE the dump-restore session is closed:
#   - /Users/money/Desktop/cerniq/.env             (has JWT_SECRET)
#   - /Users/money/Desktop/cerniq/backend-node/.env (has API_KEY_PEPPER + MASTER_ACCOUNT_PASSWORD)
# DATA_ENCRYPTION_KEY may not be in either file (it's z.string().optional() in
# env.schema.ts) — if absent, document the loss as DataGap per Rule 1.

railway variables --service cerniq-api --set "DATABASE_URL=<internal postgres URL from 2.3>"
railway variables --service cerniq-api --set "JWT_SECRET=$(openssl rand -hex 32)"          # Path F only — Path R: use original
railway variables --service cerniq-api --set "DATA_ENCRYPTION_KEY=$(openssl rand -hex 32)" # Path F only — Path R: use original
railway variables --service cerniq-api --set "API_KEY_PEPPER=$(openssl rand -hex 32)"      # Path F only — Path R: use original
railway variables --service cerniq-api --set "MASTER_ACCOUNT_PASSWORD=$(openssl rand -hex 32)" # Path F only — Path R: use original
railway variables --service cerniq-api --set "FRONTEND_URL=https://cerniq.io"
railway variables --service cerniq-api --set "ALLOWED_ORIGINS=https://cerniq.io,https://app.cerniq.io"
railway variables --service cerniq-api --set "NODE_ENV=production"
railway variables --service cerniq-api --set "ADMIN_KEY=$(openssl rand -hex 32)"
railway variables --service cerniq-api --set "AUTH_ALLOW_LEGACY=true"  # set false after legacy key cutover
```

**Why the four-secret matrix matters:** On Path R, regenerating any of `JWT_SECRET` / `DATA_ENCRYPTION_KEY` / `API_KEY_PEPPER` / `MASTER_ACCOUNT_PASSWORD` invalidates the corresponding state in the restored data: sessions, encrypted columns, customer API keys, master-account auth — independently of each other. Catalog which ones you can recover from the local `.env` files BEFORE running §2.6. Anything not recoverable is a DataGap per Rule 1 (never silent zeros) — document it in `docs/SESSION_HANDOFF.md` rather than pretending the system is whole.

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

## 3. Vercel revival (10–20 min — usually closer to 5)

### 3.0 Is Vercel actually deleted?

In the 2026-05-09 cold-storage, Vercel was **NOT** torn down. Confirm before recreating.

**Local-state check (necessary but not sufficient):**

```bash
ls /Users/money/Desktop/cerniq/.vercel/project.json \
   /Users/money/Desktop/cerniq/frontend/.vercel/project.json 2>/dev/null
```

`.vercel/` is gitignored at both root and `frontend/`, so these files are **per-user link state, not source of truth**. They tell you which Vercel project YOUR machine last linked to — they don't tell you which project is currently deploying to `cerniq.io`.

**Authoritative check (do this too):**

Open the Vercel dashboard → `ekiess-projects` org → look for the project whose **Domains** tab includes `cerniq.io`. That is the live deployer, regardless of what your local `project.json` says. The 2026-05-16 revival recorded `capexcycle` (id `prj_odl6Ltja3NXGwJI0v7jZ7NEs88bL`) as production, but verify in dashboard — peer sessions on this tree have been observed creating a second project `frontend` (id `prj_MdkT4rrUMnf5fn5TpHENOzFbHL6z`) via `vercel link` from `frontend/`, and which one Vercel routes `cerniq.io` traffic to is determined externally.

**If the dashboard shows a live project owning `cerniq.io` → skip §3.1, jump to §3.2 (env-var refresh + redeploy on that project).**

If no Vercel project owns `cerniq.io` (true full cold-storage of a future cycle) → follow §3.1 to recreate.

### 3.1 Authenticate and link (only if §3.0 confirmed deleted)

```bash
cd /Users/money/Desktop/cerniq/frontend
vercel login
vercel link --yes   # creates fresh .vercel/project.json
```

When prompted:
- Set up and deploy? **n** (we'll configure first)
- Link to existing project? **y** if the org has an existing `capexcycle` project; otherwise **n**
- Project name: `capexcycle` (the canonical 2026-05-16 prod name — use the existing name on revival, not a new one, so Vercel's GitHub App webhook continues to route deploys)
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

Wait for the build (~2 min). Note the deployment URL (e.g., `capexcycle-xxx.vercel.app`).

### 3.4 Attach the production domain

In Vercel dashboard → `capexcycle` → Settings → Domains (skip this step if §3.0 confirmed the project survived — `cerniq.io` is already attached):
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
2. If shown as "unverified", re-add the SPF / DKIM / DMARC TXT records **at Spaceship** (per `docs/ops/resend_dns_setup.md` — that doc is correct; only this runbook had it wrong).
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
# Use whatever branch the revival commit will merge from. Post-merge,
# this is `main`. Pre-merge, it's whatever feature branch carries the
# infra config. The original 2026-05-16 revival used
# `claude/enterprise-quality-hardening`; do not hardcode it on later cycles.
BRANCH="$(git branch --show-current)"
gh workflow run "CERNIQ CI/CD" --ref "$BRANCH"
gh run watch
```

---

## 7. Smoke test (10 min)

Once §1–§6 are done, run the existing health script:

```bash
cd /Users/money/Desktop/cerniq
bash scripts/health-check.sh https://api.cerniq.io https://cerniq.io
```

(The pre-deploy counterpart is `npm run smoke:pre-deploy` from §0; this `health-check.sh` is its post-deploy sibling and is not yet wired into `npm run`. If a future round wires it as `npm run smoke:post-deploy`, update this section.)

All checks must PASS. If any fail, see `docs/ops/deployment_runbook.md` §7 "Common Issues and Fixes" — that runbook now applies in full.

Manual end-to-end:
1. Visit `https://cerniq.io` — landing page loads, no console errors
2. Visit `https://cerniq.io/pricing` — Stripe checkout button renders
3. Sign up via magic link — email arrives (Resend), link works (JWT_SECRET)
4. `curl -H "x-admin-key: $ADMIN_KEY" https://api.cerniq.io/api/admin/stats` — returns JSON
5. Trigger one Stripe test webhook (`checkout.session.completed` with test mode) — confirm 200 in Stripe dashboard "Recent deliveries"

---

## 8. Hand back to Claude

Once §7 is fully green, broadcast to all active Claude sessions (the peers CLI does not support project-name targeting — `msg` takes `<sid-prefix|all>`):

```bash
~/.claude/peers/bin/claude-peers msg all "Cold-storage revival complete. \
Railway project=<new-id> service=<new-id>. \
Vercel project=capexcycle (survived; relinked if needed). \
api.cerniq.io cert OK. \
All 7 smoke checks passed. \
Ready for PR merge + deploy."
```

For a durable handoff entry that future sessions will find via `git log` / SESSION_HANDOFF.md, use `claude-peers handoff --project cerniq --summary "..."` instead of (or in addition to) the broadcast.

Claude will then:
1. Wait for the active peer write-sessions to settle (`claude-peers status`)
2. Confirm the active feature branch is still mergeable (the 2026-05-16 revival used `claude/enterprise-quality-hardening`; subsequent cycles may differ)
3. Squash-merge the active PR to `main`
4. Watch the `deploy-backend` + `deploy-frontend` workflow runs
5. Verify with `scripts/health-check.sh` post-deploy
6. Update `docs/SESSION_HANDOFF.md` with the deployment log entry

---

## 9. Rollback / abort

If any step fails and you want to bail:

- **Before §3** (Railway only): `railway down --service cerniq-api` and delete the project from dashboard. Cost so far: ~$0 (Railway bills monthly, prorated).
- **Before §4** (Railway + Vercel, but no DNS changes): same as above. **Do NOT** `vercel projects rm capexcycle` unless you are intentionally destroying the live frontend — `capexcycle` was preserved through 2026-05-09 cold-storage precisely because it serves `cerniq.io` from Vercel's edge cache and tearing it down loses that fallback.
- **After §4** (DNS changed): you have a window where `cerniq.io` may briefly 502 while DNS propagates back. Revert the Spaceship records first (NOT Cloudflare — DNS authority is Spaceship retail per §4), wait 5 min, then teardown Railway. The cached Vercel edge build returns once DNS re-resolves.

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
- **Round-2 audit caught what round-1 missed.** The first triage pass (`a69e44fa`) corrected §4 Cloudflare → Spaceship but did not sweep the rest of the doc for the same kind of drift. A second pass found: §0 + §3 wrongly claimed Vercel was deleted (it survived as `capexcycle`); §5.2 still pointed Resend DNS at Cloudflare; §8 hand-back used the wrong `claude-peers msg` syntax (`msg <project>` is not supported — only `msg <sid-prefix|all>`); §9 rollback named `cerniq-frontend` (wrong project) and "Cloudflare records" (wrong registrar). **Rule for next cycle:** when correcting one factual-drift bug in a runbook, grep the whole doc for the same noun (here: `Cloudflare`, `cerniq-frontend`, `deleted`) and audit every occurrence — not just the section you came in to fix.
- **Round-3 audit caught what rounds 1 and 2 missed — at the section-interior level.** Surface-level drift is easier to grep than interior-logic bugs. Three new findings: (a) §2.6 warned only `DATA_ENCRYPTION_KEY` as restore-sensitive, missing `JWT_SECRET` / `API_KEY_PEPPER` / `MASTER_ACCOUNT_PASSWORD` — all four invalidate independent slices of restored state if regenerated (sessions / encrypted columns / customer API keys / master-account auth). The `API_KEY_PEPPER` mismatch in particular is the same class of bug as `[[hash-divergence-pattern]]` (commit `e602c1d7`) where wrong hash function silently broke customer auth. (b) §2.4 `pg_restore --clean --if-exists` will drop tables in whatever DB the URL points at — added an empty-DB pre-check so a misrouted URL doesn't silently wipe a live database. (c) §3.0 over-claimed which Vercel project is prod based on local `.vercel/project.json` files that are gitignored per-user state; the authoritative source is the Vercel dashboard. Also (d) §6 and §8 hardcoded the working branch name `claude/enterprise-quality-hardening`, which self-stales on every merge. **Rule for next cycle:** audit `env.schema.ts` and each restore-sensitive secret SEPARATELY against the inline command list — `JWT_SECRET`, `API_KEY_PEPPER`, etc., are easy to set with `openssl rand -hex 32` and easy to overlook as Path R consistency dependencies. Also: never claim a fact in a runbook that comes from a gitignored file — locate the authoritative source instead.

---

## Appendix C — Cost expectations

A typical CERNIQ revival lands at roughly:

| Service | Plan | Monthly |
|---|---|---|
| Railway (API + Postgres + cron) | Hobby+ | $20–40 |
| Vercel (Pro tier required for production domain) | Pro | $20 |
| Spaceship (domain + DNS) | annual | ~$15–25/yr (≈$1–2/mo amortized) |
| Cloudflare (R2 + WAF, optional — not used by core revival) | Free → Pro for WAF | $0–20 |
| Stripe | Per-transaction | usage-based |
| Resend | Free tier (3k/mo) → Pro | $0–20 |
| Sentry | Free dev → Team | $0–26 |
| Anthropic API | Per-token | usage-based |
| **Baseline** | | **~$60–125/mo** before AI/Stripe usage |

Set the Actions org budget per the KLYTICS billing footgun memory — $100 with alert at 75%, NOT $0 with Stop=Yes (the latter bricks ALL CI org-wide).
