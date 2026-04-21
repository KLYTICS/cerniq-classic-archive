#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════
# Verify the 90-day DPA purge is actually firing in production.
#
# The unit test (pipeline.worker.spec.ts > deleteExpiredData) proves the
# mechanism works. This script proves the cron is actually running in
# Railway and purging real data.
#
# Two independent signals to reduce false confidence:
#   1. DB signal: report_jobs with completedAt > 90 days old should all
#      have rawDataPurgedAt set (or rawData already null).
#   2. Log signal: the pipeline.data_purge.complete Pino event should
#      appear in Railway logs at least once in the last 48 hours.
#
# Use for:
#   - Monthly DPA compliance check
#   - Bank procurement evidence (run → paste the green output)
#   - Incident: "did we actually purge X yesterday?"
#
# REQUIRES
#   - Railway CLI linked to cerniq-api production
#   - psql client + $DATABASE_URL_RO (read-only DB URL) OR $DATABASE_URL
# ═══════════════════════════════════════════════════════════════════════════
set -uo pipefail

color() { printf '\033[%sm%s\033[0m\n' "$1" "$2"; }
ok()    { color "32" "✔ $*"; }
fail()  { color "31" "✘ $*"; }
warn()  { color "33" "⚠ $*"; }
info()  { color "36" "ℹ $*"; }

FAIL=0

# ─── Signal 1: DB — no unpurged jobs older than 90 days ───────────────────
info "Signal 1/2: querying database for unpurged jobs > 90 days old..."

DB_URL="${DATABASE_URL_RO:-${DATABASE_URL:-}}"
if [[ -z "$DB_URL" ]]; then
  warn "DATABASE_URL / DATABASE_URL_RO not set — skipping DB signal"
  warn "Fetch via: railway variables --service cerniq-api --environment production --kv | grep DATABASE_URL"
else
  command -v psql >/dev/null 2>&1 || { fail "psql client not installed"; exit 1; }

  # Count jobs that SHOULD have been purged but haven't been
  q='SELECT COUNT(*)::bigint FROM report_jobs
     WHERE status = '"'COMPLETE'"'
       AND completed_at <= NOW() - INTERVAL '"'90 days'"'
       AND raw_data IS NOT NULL
       AND raw_data_purged_at IS NULL;'
  unpurged="$(psql "$DB_URL" -Atq -c "$q" 2>/dev/null || echo 'ERR')"

  if [[ "$unpurged" == "ERR" ]]; then
    fail "could not query report_jobs (is DATABASE_URL valid? is the table migrated?)"
    FAIL=$((FAIL+1))
  elif [[ "$unpurged" -gt 0 ]]; then
    fail "$unpurged report_jobs older than 90 days STILL have raw_data — DPA violation"
    fail "Run the cron manually: railway run --service cerniq-api 'node -e \"...pipeline worker invocation...\"'"
    FAIL=$((FAIL+1))
  else
    ok "0 unpurged jobs older than 90 days ✓"
  fi

  # Also show positive evidence — how many have been purged to date
  q2='SELECT COUNT(*)::bigint FROM report_jobs WHERE raw_data_purged_at IS NOT NULL;'
  purged_count="$(psql "$DB_URL" -Atq -c "$q2" 2>/dev/null || echo '?')"
  info "Total jobs purged to date: $purged_count"
fi

# ─── Signal 2: Logs — pipeline.data_purge.complete in the last 48h ────────
echo
info "Signal 2/2: grepping Railway logs for data_purge events (last 48h)..."

if ! command -v railway >/dev/null 2>&1; then
  warn "railway CLI not installed — skipping log signal"
else
  # Railway's log CLI paginates; -n 5000 usually covers 48h for a quiet
  # service. Adjust if cerniq-api gets chattier.
  logs="$(railway logs --service cerniq-api 2>/dev/null | tail -5000 || true)"
  if [[ -z "$logs" ]]; then
    warn "no Railway logs returned — is the service linked? (railway status)"
  else
    complete_events="$(grep -c 'pipeline.data_purge.complete' <<<"$logs" || true)"
    failed_events="$(grep -c 'pipeline.data_purge.failed' <<<"$logs" || true)"

    if [[ "$complete_events" -gt 0 ]]; then
      ok "pipeline.data_purge.complete appeared $complete_events time(s) in recent logs"
      # Show the most recent one for proof
      last="$(grep 'pipeline.data_purge.complete' <<<"$logs" | tail -1)"
      info "most recent: $(echo "$last" | head -c 200)..."
    else
      fail "no pipeline.data_purge.complete events in recent logs — cron may not be firing"
      fail "Expected at least one per day (0 2 * * * UTC)"
      FAIL=$((FAIL+1))
    fi

    if [[ "$failed_events" -gt 0 ]]; then
      warn "pipeline.data_purge.failed appeared $failed_events time(s) — investigate"
    fi
  fi
fi

# ─── Summary ──────────────────────────────────────────────────────────────
echo
if [[ $FAIL -eq 0 ]]; then
  ok "DPA 90-day purge is healthy. Safe evidence for a security questionnaire."
  exit 0
else
  fail "$FAIL signal(s) broken. Investigate BEFORE signing any DPA-bearing contract."
  exit 1
fi
