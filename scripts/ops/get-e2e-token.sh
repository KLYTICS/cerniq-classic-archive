#!/usr/bin/env bash
# Acquire a production Supabase JWT and bootstrap .env.production-e2e.local.
#
# Replaces the manual DevTools dance in PRODUCTION_E2E_RUNBOOK § JWT bootstrap.
# Signs in directly against Supabase's password grant, then hands the token to
# scripts/bootstrap-production-e2e.mjs.
#
# Safety properties (deliberate):
#   - password is read with `read -rs` (never echoed, never in shell history)
#   - password reaches curl via STDIN, never argv (invisible to `ps`)
#   - token is passed to the bootstrap via CERNIQ_E2E_JWT env, never argv
#   - neither password nor token is ever printed
#
# Usage:  bash scripts/ops/get-e2e-token.sh
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SUPABASE_URL="${SUPABASE_URL:-https://ahjaxqtomakzkrekoyqv.supabase.co}"

# ── Resolve the Supabase anon key (public by design; safe to read from Railway).
ANON="${NEXT_PUBLIC_SUPABASE_ANON_KEY:-}"
if [ -z "$ANON" ] && command -v railway >/dev/null 2>&1; then
  ANON="$(railway variables --json 2>/dev/null \
    | python3 -c 'import sys,json;print(json.load(sys.stdin).get("NEXT_PUBLIC_SUPABASE_ANON_KEY",""))' 2>/dev/null || true)"
fi
if [ -z "$ANON" ]; then
  echo "ERROR: could not resolve the Supabase anon key." >&2
  echo "  Fix: export NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key> and re-run," >&2
  echo "  or run from a shell where 'railway' is linked to cerniq-api." >&2
  exit 1
fi

echo "Signing in to Supabase ($SUPABASE_URL)"
read -rp  "  email    : " EMAIL
read -rsp "  password : " PASSWORD
echo

# Build the JSON body in python (correct escaping for any password), pipe via stdin.
RESPONSE="$(EMAIL="$EMAIL" PASSWORD="$PASSWORD" python3 -c '
import json, os
print(json.dumps({"email": os.environ["EMAIL"], "password": os.environ["PASSWORD"]}))
' | curl -sS -X POST "${SUPABASE_URL}/auth/v1/token?grant_type=password" \
      -H "apikey: ${ANON}" \
      -H "Content-Type: application/json" \
      --data @- )"
unset PASSWORD

TOKEN="$(printf '%s' "$RESPONSE" | python3 -c '
import sys, json
try: d = json.load(sys.stdin)
except Exception: d = {}
print(d.get("access_token", "") if isinstance(d, dict) else "")
')"

if [ -z "$TOKEN" ]; then
  DETAIL="$(printf '%s' "$RESPONSE" | python3 -c '
import sys, json
try: d = json.load(sys.stdin)
except Exception: d = {}
if not isinstance(d, dict): d = {}
print(d.get("error_code") or d.get("msg") or d.get("error_description") or "unknown error")
')"
  echo "" >&2
  echo "SIGN-IN FAILED: ${DETAIL}" >&2
  case "$DETAIL" in
    *invalid_credentials*|*Invalid*)
      echo "" >&2
      echo "Most likely cause: this account does not exist in SUPABASE Auth yet." >&2
      echo "Existing Prisma users were never backfilled into Supabase, so a" >&2
      echo "correct password still fails. Create the user once:" >&2
      echo "  Supabase dashboard -> Authentication -> Users -> Add user" >&2
      echo "  (email + password, tick Auto Confirm User), then re-run this script." >&2
      ;;
    *email_not_confirmed*)
      echo "" >&2
      echo "The user exists but is unconfirmed. In Supabase -> Authentication ->" >&2
      echo "Users, open the user and confirm their email, then re-run." >&2
      ;;
  esac
  exit 1
fi

echo "Token acquired (not printed). Bootstrapping .env.production-e2e.local ..."
cd "$REPO_ROOT"
CERNIQ_E2E_JWT="$TOKEN" node scripts/bootstrap-production-e2e.mjs --write
echo ""
echo "Done. .env.production-e2e.local written (mode 0600)."
echo "Tell Claude \"done\" and it will run: bash scripts/verify-production-platform.sh"
