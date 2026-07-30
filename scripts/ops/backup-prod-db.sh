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

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
BACKUP_DIR="${BACKUP_DIR:-$HOME/cerniq-db-backups}"
RETAIN="${RETAIN:-14}"
MIN_TABLES="${MIN_TABLES:-50}"   # sanity floor; prod had 99 tables with data on 2026-07-30

mkdir -p "$BACKUP_DIR"; chmod 700 "$BACKUP_DIR"

# Resolve the connection string. Prefer an explicit env var (CI / other hosts),
# otherwise ask the Railway CLI for the Postgres service's public URL.
DB_URL="${CERNIQ_BACKUP_DATABASE_URL:-}"
RELINK=""
if [ -z "$DB_URL" ]; then
  command -v railway >/dev/null 2>&1 || { echo "ERROR: no CERNIQ_BACKUP_DATABASE_URL and no railway CLI." >&2; exit 1; }
  cd "$REPO_ROOT"
  RELINK="$(railway status 2>/dev/null | awk -F': ' '/^Service:/{print $2}')"
  railway service Postgres >/dev/null 2>&1 || true
  DB_URL="$(railway variables --json 2>/dev/null \
    | python3 -c 'import sys,json;print(json.load(sys.stdin).get("DATABASE_PUBLIC_URL",""))')"
  # Restore the caller's previously linked service so this script has no side effects.
  [ -n "$RELINK" ] && railway service "$RELINK" >/dev/null 2>&1 || true
fi
[ -n "$DB_URL" ] || { echo "ERROR: could not resolve the production database URL." >&2; exit 1; }

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
