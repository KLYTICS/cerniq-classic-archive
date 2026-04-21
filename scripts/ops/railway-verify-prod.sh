#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════
# Verify that every REQUIRED env var exists in Railway prod for cerniq-api.
# Does NOT print secret values — only presence + length + shape check.
#
# Exit 0 = all good. Exit 1 = one or more vars missing / malformed.
# ═══════════════════════════════════════════════════════════════════════════
set -euo pipefail

color() { printf '\033[%sm%s\033[0m\n' "$1" "$2"; }
ok()   { color "32" "✔ $*"; }
miss() { color "31" "✘ $*"; }
warn() { color "33" "⚠ $*"; }

command -v railway >/dev/null 2>&1 || { miss "railway CLI missing"; exit 1; }

KV="$(railway variables --kv 2>/dev/null || true)"
[[ -z "$KV" ]] && { miss "no variables returned — is the service linked?"; exit 1; }

FAIL=0

# var_name  required?  prefix-pattern  min-len
check() {
  local name="$1" required="$2" pattern="$3" minlen="${4:-1}"
  local line val
  line="$(printf '%s\n' "$KV" | grep -E "^$name=" || true)"
  if [[ -z "$line" || "$line" == "$name=" ]]; then
    if [[ "$required" == "req" ]]; then miss "$name missing"; FAIL=$((FAIL+1)); else warn "$name not set (optional)"; fi
    return
  fi
  val="${line#$name=}"
  if [[ ${#val} -lt $minlen ]]; then miss "$name too short (${#val} < $minlen)"; FAIL=$((FAIL+1)); return; fi
  if [[ -n "$pattern" && ! "$val" =~ $pattern ]]; then miss "$name shape mismatch (expected $pattern)"; FAIL=$((FAIL+1)); return; fi
  ok "$name set (len=${#val})"
}

echo "─── Critical ───"
check DATABASE_URL              req '^postgres' 20
check JWT_SECRET                req ''          32
check DATA_ENCRYPTION_KEY       req '^[0-9a-f]{64}$' 64

echo "─── Stripe (live) ───"
check STRIPE_SECRET_KEY                    req '^sk_live_'   20
check STRIPE_WEBHOOK_SECRET                req '^whsec_'     20
check STRIPE_PRICE_ONE_TIME                req '^price_'     10
check STRIPE_PRICE_MONTHLY                 req '^price_'     10
check STRIPE_PRICE_ANNUAL                  req '^price_'     10
check STRIPE_PRICE_PARTNER                 req '^price_'     10
check NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY   req '^pk_live_'   20

echo "─── Email + Observability ───"
check RESEND_API_KEY            req '^re_'        10
check SENTRY_DSN                req '^https://'   20
check SLACK_WEBHOOK_URL         opt '^https://hooks.slack.com/' 20

echo "─── Auth + URLs ───"
check FRONTEND_URL              req '^https://'   10
check ALLOWED_ORIGINS           req '^https://'   10
check SUPABASE_URL              req '^https://'   10
check SUPABASE_SERVICE_ROLE_KEY req ''            20

echo "─── AI runtime ───"
check ANTHROPIC_API_KEY         req '^sk-ant-'    20

echo "─── Redis ───"
check REDIS_URL                 req '^redis'      10

echo
if [[ $FAIL -eq 0 ]]; then
  ok "All required variables present and well-shaped."
  exit 0
else
  miss "$FAIL problem(s) detected. Fix and re-run."
  exit 1
fi
