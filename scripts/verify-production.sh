#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
API_URL="${1:-https://api.cerniq.io}"
FRONTEND_URL="${2:-https://cerniq.io}"
ATTEMPTS="${CERNIQ_VERIFY_ATTEMPTS:-6}"
SLEEP_SECONDS="${CERNIQ_VERIFY_SLEEP_SECONDS:-30}"

cd "$ROOT_DIR"

attempt=1
while [[ "$attempt" -le "$ATTEMPTS" ]]; do
  printf '\n== Production Verification Attempt %s/%s ==\n' "$attempt" "$ATTEMPTS"
  if bash scripts/health-check.sh "$API_URL" "$FRONTEND_URL"; then
    printf '\nProduction verification passed.\n'
    exit 0
  fi

  if [[ "$attempt" -lt "$ATTEMPTS" ]]; then
    printf '\nProduction verification not green yet. Sleeping %ss before retry.\n' "$SLEEP_SECONDS"
    sleep "$SLEEP_SECONDS"
  fi

  attempt=$((attempt + 1))
done

printf '\nProduction verification failed after %s attempt(s).\n' "$ATTEMPTS"
exit 1
