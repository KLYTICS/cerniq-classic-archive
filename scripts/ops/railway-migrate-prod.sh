#!/usr/bin/env bash
# Production migration status + optional deploy (Railway cerniq-api).
#
# Usage:
#   railway login && railway link   # once, interactive
#   bash scripts/ops/railway-migrate-prod.sh          # status only
#   bash scripts/ops/railway-migrate-prod.sh --deploy # apply pending (founder approval)
#
# Exit 0 when database schema is up to date.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(dirname "$SCRIPT_DIR")/../.."
DEPLOY=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --deploy) DEPLOY=1; shift ;;
    *) echo "Unknown: $1" >&2; exit 2 ;;
  esac
done

command -v railway >/dev/null 2>&1 || { echo "railway CLI missing — run: railway login" >&2; exit 1; }

if ! railway whoami >/dev/null 2>&1; then
  echo "Railway unauthorized. Run: railway login && railway link (select cerniq-api)" >&2
  exit 1
fi

echo "── Railway env verify ──"
bash "$SCRIPT_DIR/railway-verify-prod.sh"

export DATABASE_URL="$(railway variables --kv 2>/dev/null | grep -E '^DATABASE_URL=' | cut -d= -f2- || true)"
if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "DATABASE_URL not returned — is the service linked?" >&2
  exit 1
fi

echo ""
echo "── Prisma migrate status (production) ──"
(cd "$REPO_ROOT/backend-node" && npx prisma migrate status)

if [[ "$DEPLOY" -eq 1 ]]; then
  echo ""
  echo "── Applying pending migrations ──"
  railway run -- npx prisma migrate deploy
  (cd "$REPO_ROOT/backend-node" && npx prisma migrate status)
fi
