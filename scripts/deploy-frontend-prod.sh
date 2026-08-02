#!/usr/bin/env bash
# Canonical production frontend deploy — Next.js app lives in frontend/, not repo root.
#
# Root `vercel deploy --prod` fails (build writes frontend/.next; Vercel expects .next at root).
#
# Usage:
#   bash scripts/deploy-frontend-prod.sh [--no-alias]
#
# Requires: vercel CLI logged in, frontend/.vercel linked to cerniq-frontend.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(dirname "$SCRIPT_DIR")"
FRONTEND="$REPO_ROOT/frontend"
ALIAS=1

while [[ $# -gt 0 ]]; do
  case "$1" in
    --no-alias) ALIAS=0; shift ;;
    *) echo "Unknown: $1" >&2; exit 2 ;;
  esac
done

command -v vercel >/dev/null 2>&1 || { echo "vercel CLI required" >&2; exit 1; }

cd "$FRONTEND"
DEPLOY_JSON="$(vercel deploy --prod --yes 2>&1 | tee /tmp/cerniq-vercel-deploy.log)"
DEPLOY_URL="$(printf '%s\n' "$DEPLOY_JSON" | sed -n 's/.*Production[[:space:]]*https:\/\/\([^[:space:]]*\).*/\1/p' | tail -1)"

if [[ -z "$DEPLOY_URL" ]]; then
  echo "Could not parse deployment URL. See /tmp/cerniq-vercel-deploy.log" >&2
  exit 1
fi

echo "Production deployment: https://${DEPLOY_URL}"

if [[ "$ALIAS" -eq 1 ]]; then
  vercel alias set "$DEPLOY_URL" cerniq.io
  vercel alias set "$DEPLOY_URL" www.cerniq.io
  echo "Aliased cerniq.io + www.cerniq.io"
fi

cd "$REPO_ROOT"

# ── Post-deploy verification ────────────────────────────────────────────────
#
# Ordering matters: these frontend invariants run BEFORE health-check.sh.
# health-check.sh asserts platform readiness, including the API's /ready, which
# depends on the database. Running it first meant a backend outage aborted the
# script under `set -e` and the frontend checks below never executed at all —
# observed 2026-08-02, when a database incident masked the alias/CSP result for
# a deploy that was in fact fine. Whether the domain moved and whether the CSP
# still permits sign-in are properties of THIS deploy and must be reported
# independently of whatever the backend is doing.
# health-check.sh asserts HTTP status only, which cannot see either failure
# that has actually taken production down:
#
#   1. A stranded domain. `vercel --prod` alone does NOT move cerniq.io — it
#      only aliases *.vercel.app. Run bare (instead of via this script), it
#      leaves customers on an old build that still answers 200. Observed
#      2026-08-01: the live domain was serving a build with no supabase CSP.
#   2. A CSP that blocks auth. The login page renders 200 while the browser
#      silently refuses every request to supabase.co, so sign-in is impossible
#      and nothing reaches any server log.
#
# Both are checked here against the real domain, after aliasing.
if [[ "$ALIAS" -eq 1 ]]; then
  DOMAIN="${CERNIQ_FRONTEND_URL:-https://cerniq.io}"
  VERIFY_FAIL=0

  echo ""
  echo "Verifying ${DOMAIN} actually serves this deployment…"

  # Ask Vercel which deployment each domain resolves to. This must be the
  # authoritative alias mapping, NOT a fingerprint of the served bundle:
  # Next.js chunk names are content hashes, so a deploy that changes only
  # vercel.json (headers/CSP) — exactly the 2026-08-01 fix — produces byte
  # identical chunks. Comparing them would report PASS while the domain sat
  # on an entirely different deployment.
  for host in cerniq.io www.cerniq.io; do
    MAPPED="$(vercel alias ls 2>/dev/null | awk -v h="$host" '$2==h {print $1; exit}')"
    if [[ -z "$MAPPED" ]]; then
      echo "  alias ${host}   WARN (not found in \`vercel alias ls\`)"
    elif [[ "$MAPPED" == "$DEPLOY_URL" ]]; then
      echo "  alias ${host}   PASS"
    else
      echo "  alias ${host}   FAIL — points at ${MAPPED}, not ${DEPLOY_URL}" >&2
      VERIFY_FAIL=1
    fi
  done

  # Every origin the browser must reach for sign-in to work.
  CSP="$(curl -s --max-time 25 -D - -o /dev/null "$DOMAIN/login" \
    | tr -d '\r' | grep -i '^content-security-policy:' || true)"
  for origin in 'supabase.co' 'api.cerniq.io'; do
    if printf '%s' "$CSP" | grep -q "$origin"; then
      echo "  csp allows ${origin}   PASS"
    else
      echo "  csp allows ${origin}   FAIL — auth/API calls will be blocked in-browser" >&2
      VERIFY_FAIL=1
    fi
  done

  if [[ "$VERIFY_FAIL" -ne 0 ]]; then
    echo "" >&2
    echo "DEPLOY VERIFICATION FAILED — production may be serving a broken build." >&2
    echo "Roll back by pointing the domain at a known-good deployment:" >&2
    echo "  vercel alias set <previous-deployment-url> cerniq.io" >&2
    echo "  vercel alias set <previous-deployment-url> www.cerniq.io" >&2
    echo "List candidates with: vercel ls" >&2
    exit 1
  fi

  echo ""
  echo "Verified: ${DOMAIN} is live on https://${DEPLOY_URL}"
fi

# ── Platform readiness (frontend + backend together) ────────────────────────
# Runs last, and its exit code is reported rather than aborting the script, so
# a backend/database outage is surfaced as exactly that and never confused with
# a bad frontend deploy — which the checks above have already cleared.
echo ""
if bash "$SCRIPT_DIR/health-check.sh" \
     "${CERNIQ_API_URL:-https://api.cerniq.io}" \
     "${CERNIQ_FRONTEND_URL:-https://cerniq.io}"; then
  exit 0
fi
echo "" >&2
echo "The frontend deploy verified clean above; the failure is platform readiness" >&2
echo "(most often the API or its database), not this deployment." >&2
exit 1
