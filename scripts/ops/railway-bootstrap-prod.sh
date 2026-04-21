#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════
# Railway production env bootstrap for cerniq-api
# ═══════════════════════════════════════════════════════════════════════════
#
# Sets the remaining production secrets for the cerniq-api Railway service:
#   - DATA_ENCRYPTION_KEY (generated locally, AES-256)
#   - Stripe live keys (prompted interactively; never echoed)
#
# USAGE
#   scripts/ops/railway-bootstrap-prod.sh              # dry-run (default)
#   scripts/ops/railway-bootstrap-prod.sh --apply      # actually set vars
#
# SAFETY
#   - Refuses to overwrite an existing DATA_ENCRYPTION_KEY (re-key flow is a
#     separate, higher-ceremony operation documented in docs/ops/railway_env_vars.md).
#   - Reads Stripe secrets from stdin (read -s) — they never hit argv or history.
#   - Requires `railway` CLI ≥ 4.x, a linked project, and the prod environment
#     selected. Run `railway status` first.
# ═══════════════════════════════════════════════════════════════════════════
set -euo pipefail

APPLY=0
if [[ "${1:-}" == "--apply" ]]; then APPLY=1; fi

color() { printf '\033[%sm%s\033[0m\n' "$1" "$2"; }
info()  { color "36" "ℹ $*"; }
warn()  { color "33" "⚠ $*"; }
ok()    { color "32" "✔ $*"; }
fail()  { color "31" "✘ $*"; exit 1; }

command -v railway >/dev/null 2>&1 || fail "railway CLI not found — install: npm i -g @railway/cli"
command -v openssl >/dev/null 2>&1 || fail "openssl not found"

info "Current Railway context:"
railway status 2>/dev/null || fail "no linked project — run 'railway link' first"

# Guard: must be targeting the prod environment of cerniq-api
ENV_NAME="$(railway status --json 2>/dev/null | grep -o '"environmentName":"[^"]*"' | cut -d'"' -f4 || true)"
SVC_NAME="$(railway status --json 2>/dev/null | grep -o '"serviceName":"[^"]*"' | cut -d'"' -f4 || true)"

if [[ "$ENV_NAME" != "production" ]]; then
  warn "environment is '$ENV_NAME', not 'production'. Switch with: railway environment production"
  [[ $APPLY -eq 1 ]] && fail "refusing to apply outside production"
fi
if [[ "$SVC_NAME" != "cerniq-api" ]]; then
  warn "service is '$SVC_NAME', expected 'cerniq-api'. Switch with: railway service cerniq-api"
  [[ $APPLY -eq 1 ]] && fail "refusing to apply to wrong service"
fi

# ─── DATA_ENCRYPTION_KEY ───────────────────────────────────────────────────
info "Checking DATA_ENCRYPTION_KEY..."
EXISTING_DEK="$(railway variables --kv 2>/dev/null | grep -E '^DATA_ENCRYPTION_KEY=' || true)"
if [[ -n "$EXISTING_DEK" ]]; then
  ok "DATA_ENCRYPTION_KEY already set — skipping (re-key uses a separate script)"
else
  NEW_DEK="$(openssl rand -hex 32)"
  if [[ ${#NEW_DEK} -ne 64 ]]; then fail "generated key has wrong length: ${#NEW_DEK}"; fi
  if [[ $APPLY -eq 1 ]]; then
    railway variables --set "DATA_ENCRYPTION_KEY=$NEW_DEK" >/dev/null
    ok "DATA_ENCRYPTION_KEY set (64-char hex, AES-256)"
    warn "Back this key up somewhere safe (1Password). Losing it = losing access to every encrypted report_job.raw_data row."
  else
    info "[dry-run] would set DATA_ENCRYPTION_KEY to a fresh 64-char hex key"
  fi
fi

# ─── Stripe live keys ─────────────────────────────────────────────────────
prompt_secret() {
  local name="$1"
  local pattern="$2"
  local existing
  existing="$(railway variables --kv 2>/dev/null | grep -E "^$name=" || true)"
  if [[ -n "$existing" && "$existing" != "$name=" ]]; then
    ok "$name already set — skipping"
    return
  fi
  printf "  %s (paste, hidden): " "$name"
  read -rs val
  echo
  if [[ -z "$val" ]]; then warn "$name skipped (empty)"; return; fi
  if [[ ! "$val" =~ $pattern ]]; then fail "$name does not match expected prefix pattern"; fi
  if [[ $APPLY -eq 1 ]]; then
    railway variables --set "$name=$val" >/dev/null
    ok "$name set"
  else
    info "[dry-run] would set $name (len=${#val})"
  fi
}

info "Stripe live keys (Ctrl-C to abort; empty input to skip any single var):"
prompt_secret STRIPE_SECRET_KEY           '^sk_live_'
prompt_secret STRIPE_WEBHOOK_SECRET       '^whsec_'
prompt_secret STRIPE_PRICE_ONE_TIME       '^price_'
prompt_secret STRIPE_PRICE_MONTHLY        '^price_'
prompt_secret STRIPE_PRICE_ANNUAL         '^price_'
prompt_secret STRIPE_PRICE_PARTNER        '^price_'
prompt_secret NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY '^pk_live_'

if [[ $APPLY -eq 0 ]]; then
  warn "Dry-run complete. Re-run with --apply to actually set variables."
else
  ok "Bootstrap complete. Railway will redeploy cerniq-api automatically."
  info "Verify with: scripts/ops/railway-verify-prod.sh"
fi
