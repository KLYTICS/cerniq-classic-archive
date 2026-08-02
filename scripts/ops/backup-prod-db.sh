#!/usr/bin/env bash
# Take a verified, restorable backup of the CerniQ production Postgres.
#
# WHY THIS EXISTS: Railway's managed backups are a dashboard-only setting and
# were never enabled. On 2026-07-30 the Postgres AND Redis services were deleted
# from the project; the only reason production data survived was an orphaned
# volume. A second orphan (postgres-volume-nHem) shows that had happened before.
# Until Railway backups are switched on, this script IS the backup.
#
# Properties:
#   - custom format (-Fc): compressed, selective restore, parallel restore
#   - verifies the archive TOC after writing (a dump that cannot be listed is
#     not a backup) and fails loudly if the archive is unreadable or empty
#   - never prints the connection string or any credential
#   - retains the newest RETAIN backups (default 14), prunes older ones
#
# Usage:
#   bash scripts/ops/backup-prod-db.sh
#   RETAIN=30 BACKUP_DIR=/mnt/vault bash scripts/ops/backup-prod-db.sh
#
# Restore (into a fresh database — never straight over a live one):
#   pg_restore --clean --if-exists --no-owner -d "<target-url>" <file>.dump
set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-$HOME/cerniq-db-backups}"
RETAIN="${RETAIN:-14}"
MIN_TABLES="${MIN_TABLES:-50}"   # sanity floor; prod had 99 tables with data on 2026-07-30
PG_SERVICE_ID="${CERNIQ_PG_SERVICE_ID:-4d79d2c4-cb3b-420f-ab27-0a3d725d91fb}"
RAILWAY_ENV_ID="${CERNIQ_RAILWAY_ENV_ID:-8e51374b-5f13-4980-a037-007c6c1792bc}"
RAILWAY_PROJECT_ID="${CERNIQ_RAILWAY_PROJECT_ID:-1ad9be3e-c89d-4b18-9af2-b1775a14161d}"

mkdir -p "$BACKUP_DIR"; chmod 700 "$BACKUP_DIR"

# Resolve the connection string. Prefer an explicit env var (CI / other hosts),
# otherwise ask the Railway API for the Postgres service's public URL.
#
# This deliberately does NOT shell out to `railway` from the repo directory.
# The previous implementation did (`cd "$REPO_ROOT"` then `railway service
# Postgres`), which made the script unrunnable from cron: macOS TCC refuses a
# cron job access to anything under ~/Desktop, so every scheduled run died with
# "Operation not permitted" before executing a single line, and the nightly
# backup silently never ran. Reading the token from ~/.railway/config.json and
# querying the API keeps the script location-independent — and it no longer
# relinks the CLI's active service as a side effect.
DB_URL="${CERNIQ_BACKUP_DATABASE_URL:-}"
if [ -z "$DB_URL" ]; then
  DB_URL="$(
    CERNIQ_PG_SVC="$PG_SERVICE_ID" \
    CERNIQ_ENV_ID="$RAILWAY_ENV_ID" \
    CERNIQ_PROJ_ID="$RAILWAY_PROJECT_ID" \
    python3 - <<'PY'
import json, os, sys, urllib.request, urllib.error

cfg = os.path.expanduser('~/.railway/config.json')
try:
    token = json.load(open(cfg))['user']['token']
except Exception:
    sys.exit(0)  # no creds; caller reports the error

body = json.dumps({
    'query': 'query($p: String!, $e: String!, $s: String!) {'
             ' variables(projectId: $p, environmentId: $e, serviceId: $s) }',
    'variables': {'p': os.environ['CERNIQ_PROJ_ID'],
                  'e': os.environ['CERNIQ_ENV_ID'],
                  's': os.environ['CERNIQ_PG_SVC']},
}).encode()
req = urllib.request.Request(
    'https://backboard.railway.com/graphql/v2', data=body,
    headers={'Content-Type': 'application/json',
             'Authorization': f'Bearer {token}',
             # Railway is behind Cloudflare; a missing UA is rejected 403/1010.
             'User-Agent': 'railway-cli/4.33.0'})
try:
    with urllib.request.urlopen(req, timeout=60) as r:
        data = json.load(r)
except urllib.error.HTTPError:
    sys.exit(0)
print(((data.get('data') or {}).get('variables') or {}).get('DATABASE_PUBLIC_URL', ''))
PY
  )"
fi
[ -n "$DB_URL" ] || { echo "ERROR: could not resolve the production database URL (is the Railway CLI logged in?)." >&2; exit 1; }

TS="$(date -u +%Y%m%dT%H%M%SZ)"
OUT="$BACKUP_DIR/cerniq-prod-$TS.dump"

echo "Dumping production database -> $OUT"
pg_dump "$DB_URL" -Fc -f "$OUT"

# ── Verify. An unverified dump is a false sense of safety. ────────────────────
if [ ! -s "$OUT" ]; then
  echo "FATAL: dump file is empty." >&2; rm -f "$OUT"; exit 1
fi
TABLES_WITH_DATA="$(pg_restore --list "$OUT" 2>/dev/null | grep -c 'TABLE DATA' || true)"
if [ "${TABLES_WITH_DATA:-0}" -lt "$MIN_TABLES" ]; then
  echo "FATAL: archive lists only ${TABLES_WITH_DATA} tables with data (floor ${MIN_TABLES})." >&2
  echo "Refusing to treat this as a good backup; keeping the file for inspection: $OUT" >&2
  exit 1
fi

SIZE="$(du -h "$OUT" | cut -f1)"
echo "OK: $SIZE, ${TABLES_WITH_DATA} tables with data, archive TOC readable."

# ── Retention ────────────────────────────────────────────────────────────────
COUNT="$(ls -1 "$BACKUP_DIR"/cerniq-prod-*.dump 2>/dev/null | wc -l | tr -d ' ')"
if [ "$COUNT" -gt "$RETAIN" ]; then
  ls -1t "$BACKUP_DIR"/cerniq-prod-*.dump | tail -n +$((RETAIN + 1)) | while read -r old; do
    echo "  pruning $(basename "$old")"; rm -f "$old"
  done
fi
echo "Retained $(ls -1 "$BACKUP_DIR"/cerniq-prod-*.dump 2>/dev/null | wc -l | tr -d ' ') backup(s) in $BACKUP_DIR"
