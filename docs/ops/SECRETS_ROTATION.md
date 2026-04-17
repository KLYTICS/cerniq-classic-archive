# CERNIQ Secrets Rotation Runbook

**Version:** 1.0
**Date:** 2026-04-17
**Audience:** Ops operators (Erwin, on-call)

Every long-lived credential in the system must be rotated on a schedule
or on a trust-breach event. This document catalogs every secret, its
source of truth, its rotation cadence, and the exact 5-step procedure
to rotate it without downtime.

## 📋 Inventory of long-lived secrets

| Secret | Source | Cadence | Downtime risk if rotation fails |
|---|---|---|---|
| `RAILWAY_TOKEN` | GitHub repo secret | 90 days (Railway TTL) | Deploy blocks; service stays up |
| `JWT_SECRET` | Railway env var | 90 days | All sessions invalidated — users must re-login |
| `STRIPE_SECRET_KEY` | Railway env var | On compromise only | Payments fail until rotated |
| `STRIPE_WEBHOOK_SECRET` | Railway env var | On compromise or Stripe endpoint change | Incoming webhooks rejected |
| `ANTHROPIC_API_KEY` | Railway env var | 180 days or on compromise | Agent Execution Layer degraded to fallback mode |
| `RESEND_API_KEY` | Railway env var | 180 days or on compromise | Email delivery fails (magic links, reports, alerts) |
| `DATA_ENCRYPTION_KEY` | Railway env var | **Never rotate after data exists** — would orphan encrypted PII | N/A — rotation is destructive |
| `ADMIN_KEY` | Railway env var | 90 days or on compromise | Admin endpoints inaccessible |
| `API_KEY_PEPPER` | Railway env var | **Never rotate** — would invalidate all customer API keys | N/A — rotation is destructive |
| `SUPABASE_JWT_SECRET` | Railway env var (if used) | Aligned with Supabase rotation | Supabase-minted JWTs rejected |

## 🔄 Rotation procedures

### 1. RAILWAY_TOKEN

See [deployment_runbook.md §2 "RAILWAY_TOKEN rotation"](deployment_runbook.md#railway_token-rotation-every-90-days)
for the canonical 5-step procedure.

### 2. JWT_SECRET

**Impact:** All existing JWTs (customer sessions, admin sessions, magic
links) become invalid immediately. Every active user must re-login.
Schedule during a low-traffic window (typically PR weekend 10pm-2am AST).

```bash
# 1. Generate new secret (must be ≥32 chars — Zod schema rejects shorter)
NEW_JWT=$(openssl rand -base64 48 | tr -d '\n')

# 2. Update on Railway (paste as JWT_SECRET value)
railway variables --set JWT_SECRET="$NEW_JWT" --service cerniq-api --environment production

# 3. Railway auto-redeploys with the new secret. Wait for health check:
until curl -sf https://api.cerniq.io/health | grep -q '"status":"healthy"'; do sleep 5; done

# 4. Verify all existing sessions invalidated:
curl -i https://api.cerniq.io/api/auth/whoami \
  -H "Cookie: capex_access_token=<stale token>"
# Expect: 401 Unauthorized

# 5. Broadcast user comm: "Session rotation complete. Please re-login."
```

**NEVER** retain the old secret alongside the new one — that defeats
the rotation. If you need graceful transition (dual-accept old+new for
N hours), that's a code change, not a config change.

### 3. STRIPE_SECRET_KEY

**Cadence:** On compromise only. Stripe restricted keys don't have a
hard expiry; rotate when (a) a team member with access leaves, (b) a
key was logged accidentally, (c) Stripe detects exposure.

```bash
# 1. Stripe Dashboard → Developers → API keys → "Create restricted key"
#    Scope: payments + customers + subscriptions + webhooks (READ+WRITE)
#    Name: cerniq-production-<YYYY-MM-DD>

# 2. Update Railway:
railway variables --set STRIPE_SECRET_KEY="sk_live_..." --service cerniq-api --environment production

# 3. Railway redeploys. Verify with a test webhook:
stripe trigger checkout.session.completed --api-key "sk_live_..."

# 4. Confirm via logs that billing.controller processed the event:
railway logs --service cerniq-api | grep "checkout.session.completed"

# 5. Revoke the OLD key in Stripe Dashboard → API keys → "Expire".
#    Monitor for 30 min — old key usage logs in Stripe dashboard should
#    stay at zero. If not, check for any un-rotated caller (rare).
```

### 4. STRIPE_WEBHOOK_SECRET

**Cadence:** On webhook endpoint URL change OR compromise.

```bash
# 1. Stripe Dashboard → Developers → Webhooks → Select cerniq endpoint
# 2. Click "Roll secret" → generates new whsec_...
# 3. railway variables --set STRIPE_WEBHOOK_SECRET="whsec_..." \
#      --service cerniq-api --environment production
# 4. Stripe provides a 24-hour dual-signing window — the endpoint
#    accepts BOTH old and new during this time. No user-facing impact.
# 5. After 24 hours, old secret auto-expires.
```

### 5. ANTHROPIC_API_KEY

**Cadence:** 180 days OR on compromise. Agent Execution Layer degrades
gracefully to local fallback if the key is invalid (per startup
`WARN: ANTHROPIC_API_KEY not set — CERNIQ Analyst falls back to local
data-only mode.`), so there's no hard downtime during rotation.

```bash
# 1. Anthropic Console → Settings → API Keys → "Create Key"
#    Workspace: CERNIQ production
#    Name: cerniq-prod-<YYYY-MM-DD>
# 2. railway variables --set ANTHROPIC_API_KEY="sk-ant-..." \
#      --service cerniq-api --environment production
# 3. Railway redeploys. Verify:
curl -H "x-admin-key: $ADMIN_KEY" \
  https://api.cerniq.io/api/alm/<test-institution>/advisor/stream
# Expect: SSE stream with real Claude output (not "[DRY RUN]" log)
# 4. Monitor the LLM cost dashboard for 1 hour — new key should see
#    traffic identical to old key's decline.
# 5. Revoke the OLD key in Anthropic Console. Confirm no 401s in Pino
#    logs for 30 min after revocation.
```

### 6. RESEND_API_KEY

**Cadence:** 180 days OR on compromise.

```bash
# 1. Resend Dashboard → API Keys → "Create API Key"
#    Permission: Sending access
#    Name: cerniq-prod-<YYYY-MM-DD>
# 2. railway variables --set RESEND_API_KEY="re_..." \
#      --service cerniq-api --environment production
# 3. Verify by triggering a test email:
curl -X POST -H "x-admin-key: $ADMIN_KEY" \
  https://api.cerniq.io/admin/api/control-tower/actions \
  -d '{"action":"send_test_email","userId":"<your-user-id>"}'
# 4. Check inbox. Verify Resend dashboard shows the new key in logs.
# 5. Revoke the OLD key in Resend dashboard.
```

### 7. ADMIN_KEY

**Cadence:** 90 days OR on team-member-leaving event.

```bash
# 1. Generate: openssl rand -base64 32
# 2. railway variables --set ADMIN_KEY="<new>" --service cerniq-api
# 3. Update every operator's local .env and any monitoring scripts.
# 4. Verify old key rejected: curl -H "x-admin-key: <old>" .../admin/...
#    Expect: 401 Unauthorized
# 5. Verify new key works: curl -H "x-admin-key: <new>" .../admin/...
#    Expect: 200 OK
```

## 🚫 Do NOT rotate

Two secrets are **destructive to rotate** and must be treated as
permanent once data exists:

### DATA_ENCRYPTION_KEY

Encrypted PII columns (customer emails, phone numbers, some document
fields) are deterministically encrypted with this key. Rotating the
key would orphan all existing encrypted data — it'd become unreadable.

**Mitigation if compromise happens:**
1. Disable new writes (maintenance mode)
2. Write a migration that decrypts with old key + re-encrypts with new
3. Run in a transaction per institution
4. Deploy both new key + migration atomically
5. This is a multi-day operation; plan accordingly

### API_KEY_PEPPER

Customer API keys (`ck_live_...`) are peppered + hashed before storage.
Rotating the pepper would invalidate every customer's API key silently
— they'd all get 401s with no way to recover.

**Mitigation:** same dual-write pattern as DATA_ENCRYPTION_KEY.

## 📅 Rotation calendar

Set calendar reminders per the cadence column above. Recommended cadence:

| Month | Rotate |
|---|---|
| Jan, Apr, Jul, Oct (quarterly) | `RAILWAY_TOKEN`, `JWT_SECRET`, `ADMIN_KEY` |
| Jul, Jan (biannual) | `ANTHROPIC_API_KEY`, `RESEND_API_KEY` |
| On event | Stripe keys, Supabase JWT secret |

## 🔔 Compromise detection

If any of these fire, treat as immediate compromise and rotate within 1 hour:

- Sentry issue spike on `AuthenticationError` from a single IP
- Stripe dashboard shows charges you didn't initiate
- GitHub push from an unknown IP using `RAILWAY_TOKEN`
- Anthropic billing shows >2× normal usage
- Resend shows emails sent to unknown recipients
- Any secret appears in git history (run `gitleaks` if unsure)

## 📂 Related docs

- [deployment_runbook.md §2](deployment_runbook.md#2-railway-deployment-backend) — RAILWAY_TOKEN rotation (canonical)
- [railway_env_vars.md](railway_env_vars.md) — all env vars reference
- [INCIDENT_RUNBOOK.md](INCIDENT_RUNBOOK.md) — Sev-1/2/3 response procedures
- [disaster_recovery.md](disaster_recovery.md) — backup + restore
