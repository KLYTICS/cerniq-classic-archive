#!/usr/bin/env bash
# Install (or repair) the nightly production-Postgres backup cron job.
#
# WHY THIS EXISTS
# ---------------
# The backup cron was installed on 2026-07-30 pointing straight at the script in
# the repo:
#
#   15 3 * * * /bin/bash /Users/money/Desktop/Cerniq/scripts/ops/backup-prod-db.sh
#
# Every scheduled run failed with:
#
#   /bin/bash: .../scripts/ops/backup-prod-db.sh: Operation not permitted
#
# macOS TCC does not grant `cron` access to ~/Desktop, ~/Documents or
# ~/Downloads. bash could not even open the file, so the job never ran and the
# failure was invisible unless someone read the log — production went unbacked
# for days while the crontab entry looked correct.
#
# Fix: keep the repo as the source of truth, but RUN from a copy outside the
# TCC-protected tree. `backup-prod-db.sh` no longer depends on the repo (it
# resolves the database URL from the Railway API), so a standalone copy is
# fully functional.
#
# Re-run this script after changing backup-prod-db.sh to re-sync the copy.
#
# Usage:
#   bash scripts/ops/install-backup-cron.sh          # install/repair + verify
#   bash scripts/ops/install-backup-cron.sh --check   # report only, change nothing

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SRC="$SCRIPT_DIR/backup-prod-db.sh"
RUN_DIR="${CERNIQ_OPS_DIR:-$HOME/.cerniq-ops}"
DEST="$RUN_DIR/backup-prod-db.sh"
LOG_DIR="${BACKUP_DIR:-$HOME/cerniq-db-backups}/logs"
LOG="$LOG_DIR/backup.log"
SCHEDULE="${BACKUP_CRON_SCHEDULE:-15 3 * * *}"
CHECK_ONLY=0

[[ "${1:-}" == "--check" ]] && CHECK_ONLY=1

[ -f "$SRC" ] || { echo "ERROR: $SRC not found." >&2; exit 1; }

case "$RUN_DIR" in
  "$HOME"/Desktop/*|"$HOME"/Documents/*|"$HOME"/Downloads/*)
    echo "ERROR: $RUN_DIR is inside a TCC-protected folder — cron could not run it." >&2
    echo "That is the exact bug this script exists to fix. Pick another CERNIQ_OPS_DIR." >&2
    exit 1 ;;
esac

echo "Source : $SRC"
echo "Runner : $DEST"
echo "Log    : $LOG"

if [ "$CHECK_ONLY" -eq 1 ]; then
  echo ""
  echo "--- current crontab (backup lines) ---"
  crontab -l 2>/dev/null | grep -F 'backup-prod-db.sh' || echo "(none installed)"
  echo ""
  if crontab -l 2>/dev/null | grep -F 'backup-prod-db.sh' | grep -qE "$HOME/(Desktop|Documents|Downloads)/"; then
    echo "BROKEN: cron points into a TCC-protected folder; it cannot execute there."
    exit 1
  fi
  echo "OK: no cron entry points into a TCC-protected folder."
  exit 0
fi

mkdir -p "$RUN_DIR" "$LOG_DIR"
chmod 700 "$RUN_DIR"
install -m 700 "$SRC" "$DEST"
echo "Installed runner copy."

# Replace any existing backup-prod-db.sh line, keep everything else verbatim.
TMP="$(mktemp)"
trap 'rm -f "$TMP"' EXIT
crontab -l 2>/dev/null | grep -vF 'backup-prod-db.sh' | grep -v '^# CerniQ production Postgres backup' > "$TMP" || true
{
  echo "# CerniQ production Postgres backup — nightly. Runs from $RUN_DIR because"
  echo "# macOS TCC blocks cron from executing anything under ~/Desktop."
  echo "# Re-sync after editing the repo copy: bash scripts/ops/install-backup-cron.sh"
  echo "$SCHEDULE /bin/bash $DEST >> \"$LOG\" 2>&1"
} >> "$TMP"
crontab "$TMP"
echo "Crontab updated."

echo ""
echo "--- installed entry ---"
crontab -l 2>/dev/null | grep -F 'backup-prod-db.sh'

# Prove cron can actually READ and EXECUTE the file. `test -x` is not enough:
# the original failure was an open() denial, which only shows up on a real read.
echo ""
if head -c 1 "$DEST" >/dev/null 2>&1 && [ -x "$DEST" ]; then
  echo "Runner is readable and executable."
else
  echo "ERROR: runner is not readable/executable at $DEST" >&2
  exit 1
fi

echo ""
echo "Next: verify a real backup end-to-end (requires the database to be UP):"
echo "  bash $DEST"
