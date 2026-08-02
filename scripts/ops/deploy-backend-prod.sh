#!/usr/bin/env bash
# Canonical production backend deploy — with a hard guard on the target service.
#
# WHY THIS EXISTS
# ---------------
# On 2026-08-01 a bare `railway up` from backend-node/ deployed the API
# Dockerfile onto the **Postgres** service and took production down.
# `railway status` displayed:
#
#     Service: cerniq-api-backend
#
# ...but the upload targeted service 4d79d2c4… (Postgres). The returned build
# URL contained that service id, which is the only reason it was caught at all.
# Railway then built the API image on the database service; it failed, the
# database went down, and it stayed down.
#
# The lesson is not "be careful". It is: NEVER let `railway up` pick the target
# implicitly. This script resolves the service id explicitly, asserts by NAME
# that it is the backend, and refuses to upload anything otherwise. A deploy
# that cannot name its target is a deploy that can land on your database.
#
# Usage:
#   bash scripts/ops/deploy-backend-prod.sh            # guard + deploy
#   bash scripts/ops/deploy-backend-prod.sh --check    # verify the guard only
#
# Requires: railway CLI logged in. The token is read but never printed.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(dirname "$SCRIPT_DIR")"
REPO_ROOT="$(dirname "$REPO_ROOT")"
BACKEND="$REPO_ROOT/backend-node"

# The one service this script is ever allowed to deploy to.
EXPECTED_SVC_ID="${CERNIQ_API_SERVICE_ID:-9b95101a-736a-4349-83ca-d901dc8f1757}"
EXPECTED_SVC_NAME="${CERNIQ_API_SERVICE_NAME:-cerniq-api-backend}"
API_URL="${CERNIQ_API_URL:-https://api.cerniq.io}"
CHECK_ONLY=0

[[ "${1:-}" == "--check" ]] && CHECK_ONLY=1

command -v railway >/dev/null 2>&1 || { echo "ERROR: railway CLI required." >&2; exit 1; }
[ -d "$BACKEND" ] || { echo "ERROR: $BACKEND not found." >&2; exit 1; }

# ── Guard: confirm the target id really is the backend, by name, via the API ──
echo "Verifying deploy target..."
ACTUAL_NAME="$(
  CERNIQ_EXPECT_ID="$EXPECTED_SVC_ID" python3 - <<'PY'
import json, os, sys, urllib.request, urllib.error
try:
    token = json.load(open(os.path.expanduser('~/.railway/config.json')))['user']['token']
except Exception:
    sys.exit(0)
body = json.dumps({
    'query': 'query($id: String!) { service(id: $id) { name } }',
    'variables': {'id': os.environ['CERNIQ_EXPECT_ID']},
}).encode()
req = urllib.request.Request(
    'https://backboard.railway.com/graphql/v2', data=body,
    headers={'Content-Type': 'application/json',
             'Authorization': f'Bearer {token}',
             'User-Agent': 'railway-cli/4.33.0'})
try:
    with urllib.request.urlopen(req, timeout=60) as r:
        print(((json.load(r).get('data') or {}).get('service') or {}).get('name', ''))
except urllib.error.HTTPError:
    pass
PY
)"

if [ -z "$ACTUAL_NAME" ]; then
  echo "ERROR: could not resolve service $EXPECTED_SVC_ID (is the Railway CLI logged in?)." >&2
  exit 1
fi

echo "  target id   : $EXPECTED_SVC_ID"
echo "  resolves to : $ACTUAL_NAME"

if [ "$ACTUAL_NAME" != "$EXPECTED_SVC_NAME" ]; then
  echo "" >&2
  echo "ABORT: service $EXPECTED_SVC_ID is named '$ACTUAL_NAME', expected '$EXPECTED_SVC_NAME'." >&2
  echo "Refusing to upload. This guard exists because a deploy once landed on Postgres." >&2
  exit 1
fi
echo "  guard       : OK"

if [ "$CHECK_ONLY" -eq 1 ]; then
  echo ""
  echo "Check only — nothing deployed."
  exit 0
fi

# ── Deploy, always with an explicit --service ────────────────────────────────
cd "$BACKEND"
read_uptime() {
  curl -s --max-time 10 "$API_URL/health" 2>/dev/null \
    | python3 -c 'import sys,json;print(int(float(json.load(sys.stdin)["data"]["uptime"])))' 2>/dev/null \
    || echo ''
}

# Baseline BEFORE deploying. The cutover test is "uptime dropped below the value
# the OLD container was already reporting", so it must be seeded from a real
# reading. Seeding from a sentinel like 999999 makes the very first sample
# satisfy the comparison and reports success while the build is still running —
# observed 2026-08-02, when this script declared a live cutover against a
# deployment still in BUILDING.
BASELINE="$(read_uptime)"
[ -n "$BASELINE" ] || BASELINE=0
echo ""
echo "Baseline uptime before deploy: ${BASELINE}s"

echo ""
echo "Deploying backend-node/ to $EXPECTED_SVC_NAME..."
railway up --service "$EXPECTED_SVC_ID" --detach

# ── Wait for the API to come back on a NEW container ─────────────────────────
# `prisma migrate deploy` runs from the Dockerfile CMD before the server starts,
# so a cutover is not instant. Railway also keeps the old container serving
# until the new one passes its healthcheck, which is exactly why a 200 here
# proves nothing on its own.
echo ""
echo "Waiting for cutover (uptime must drop below the baseline)..."
for i in $(seq 1 40); do
  sleep 15
  BODY="$(curl -s --max-time 10 "$API_URL/health" 2>/dev/null || echo '')"
  if [ -z "$BODY" ]; then
    printf '  [%4ds] unreachable\n' "$((i * 15))"
    continue
  fi
  read -r UP DB ST <<<"$(printf '%s' "$BODY" | python3 -c \
    'import sys,json;d=json.load(sys.stdin)["data"];print(int(float(d["uptime"])),d["db"],d["status"])' 2>/dev/null || echo '0 ? ?')"
  printf '  [%4ds] uptime=%-7s db=%-10s status=%s\n' "$((i * 15))" "$UP" "$DB" "$ST"
  # A genuinely new container reports an uptime lower than the old one's, and
  # its database must be reachable before we call the deploy good.
  if [ "$UP" -lt "$BASELINE" ] && [ "$DB" = "connected" ]; then
    echo ""
    echo "Backend is live on a new container (uptime ${UP}s < baseline ${BASELINE}s), database healthy."
    exit 0
  fi
done

echo "" >&2
echo "Backend did not report a healthy new container within 10 minutes." >&2
echo "Check: railway logs --service $EXPECTED_SVC_ID" >&2
exit 1
