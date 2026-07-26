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
bash "$SCRIPT_DIR/health-check.sh" "${CERNIQ_API_URL:-https://api.cerniq.io}" "${CERNIQ_FRONTEND_URL:-https://cerniq.io}"
