#!/usr/bin/env bash
# Restore the production Postgres service after a bad deployment.
#
# WHY THIS EXISTS
# ---------------
# On 2026-08-01 a `railway up` intended for `cerniq-api-backend` landed on the
# **Postgres** service instead (the CLI reported the linked service as the
# backend, but the upload targeted service 4d79d2c4…). Railway built the API
# Dockerfile as a one-off deployment on the database service; it failed, and the
# database went down.
#
# The important detail, confirmed against the Railway API: the service's
# configured SOURCE was never rewritten — it is still
# `ghcr.io/railwayapp-templates/postgres-ssl:18`, and the volume
# `/var/lib/postgresql/data` stayed attached. So this is NOT data loss and NOT a
# reconfiguration. It only needs a deploy from the configured source.
#
# `railway redeploy` is the WRONG tool here: it re-runs the *latest* deployment,
# which is the broken uploaded snapshot — that is how the first recovery attempt
# failed and produced a second FAILED deployment. The right call is
# `serviceInstanceRedeploy`, which deploys from the service's configured source.
#
# USAGE
#   bash scripts/ops/railway-restore-postgres.sh            # show state, do nothing
#   bash scripts/ops/railway-restore-postgres.sh --restore  # perform the redeploy
#
# Requires: the Railway CLI logged in (reads its token from ~/.railway/config.json).
# The token is never printed.

set -euo pipefail

PG_SVC="${CERNIQ_PG_SERVICE_ID:-4d79d2c4-cb3b-420f-ab27-0a3d725d91fb}"
ENV_ID="${CERNIQ_RAILWAY_ENV_ID:-8e51374b-5f13-4980-a037-007c6c1792bc}"
API_URL="${CERNIQ_API_URL:-https://api.cerniq.io}"
RESTORE=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --restore) RESTORE=1; shift ;;
    -h|--help) sed -n '2,30p' "$0"; exit 0 ;;
    *) echo "Unknown argument: $1" >&2; exit 2 ;;
  esac
done

[ -f "$HOME/.railway/config.json" ] || {
  echo "ERROR: ~/.railway/config.json not found — run \`railway login\` first." >&2
  exit 1
}

export CERNIQ_PG_SVC="$PG_SVC" CERNIQ_ENV_ID="$ENV_ID" CERNIQ_DO_RESTORE="$RESTORE"

python3 - <<'PY'
import json, os, sys, urllib.request, urllib.error

TOKEN = json.load(open(os.path.expanduser('~/.railway/config.json')))['user']['token']
URL = 'https://backboard.railway.com/graphql/v2'
SVC = os.environ['CERNIQ_PG_SVC']
ENV = os.environ['CERNIQ_ENV_ID']
DO_RESTORE = os.environ['CERNIQ_DO_RESTORE'] == '1'


def gql(query, variables=None):
    body = json.dumps({'query': query, 'variables': variables or {}}).encode()
    req = urllib.request.Request(URL, data=body, headers={
        'Content-Type': 'application/json',
        'Authorization': f'Bearer {TOKEN}',
        # Railway sits behind Cloudflare; a missing UA is rejected with 403/1010.
        'User-Agent': 'railway-cli/4.33.0',
    })
    try:
        with urllib.request.urlopen(req, timeout=90) as r:
            return json.load(r)
    except urllib.error.HTTPError as e:
        sys.exit(f'Railway API HTTP {e.code}: {e.read().decode()[:300]}')


state = gql(
    'query($id: String!, $env: String!) {'
    '  serviceInstance(serviceId: $id, environmentId: $env) { source { image } } }',
    {'id': SVC, 'env': ENV},
)
image = ((state.get('data') or {}).get('serviceInstance') or {}).get('source', {}).get('image')
print(f'Configured source image : {image}')

if not image or 'postgres' not in image:
    sys.exit(
        'ABORT: the service source is not a Postgres image. This script only '
        'redeploys an already-correct source; a changed source must be fixed in '
        'the Railway dashboard first (Settings -> Source).'
    )

if not DO_RESTORE:
    print('\nDry run. Source is intact, so a redeploy from source will restore the database.')
    print('Re-run with --restore to perform it.')
    sys.exit(0)

print('\nRedeploying from the configured source (NOT the failed snapshot)...')
res = gql(
    'mutation($env: String!, $svc: String!) {'
    '  serviceInstanceRedeploy(environmentId: $env, serviceId: $svc) }',
    {'env': ENV, 'svc': SVC},
)
if res.get('errors'):
    sys.exit(f'Redeploy failed: {json.dumps(res["errors"])[:400]}')
print('Redeploy accepted.')
PY

if [ "$RESTORE" -eq 1 ]; then
  echo ""
  echo "Waiting for the API to report a live database (up to ~5 min)..."
  for i in $(seq 1 30); do
    sleep 10
    DB="$(curl -s --max-time 10 "$API_URL/health" 2>/dev/null \
      | python3 -c 'import sys,json;print(json.load(sys.stdin)["data"]["db"])' 2>/dev/null || echo 'unreachable')"
    printf '  [%3ds] db=%s\n' "$((i * 10))" "$DB"
    if [ "$DB" = "connected" ]; then
      echo ""
      echo "DATABASE RECOVERED — $API_URL reports db=connected."
      exit 0
    fi
  done
  echo "" >&2
  echo "Database still not connected after 5 minutes." >&2
  echo "Check the Railway dashboard: Postgres service -> Deployments." >&2
  exit 1
fi
