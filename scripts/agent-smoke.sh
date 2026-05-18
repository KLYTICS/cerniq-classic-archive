#!/usr/bin/env bash
set -euo pipefail

# Agent-Layer Smoke Test (T10 — first-customer ship gate)
#
# Usage:
#   bash scripts/agent-smoke.sh <API_URL> <JWT> <INSTITUTION_ID> [CROSS_JWT]
#
# Args:
#   API_URL         e.g. https://api.cerniq.io  (no trailing slash)
#   JWT             Bearer token for a user with access to INSTITUTION_ID
#   INSTITUTION_ID  Target institution UUID
#   CROSS_JWT       (optional) Bearer for a user from a DIFFERENT institution.
#                   When provided, Step 5 asserts that cross-tenant access
#                   to INSTITUTION_ID's runs is denied (403/404 or empty).
#
# Mirrors the going-live checklist in docs/ops/AGENT_GOING_LIVE.md and the
# T10 ship-gate referenced in docs/SESSION_HANDOFF.md §4.7. Designed to be
# safe in production: read-only where possible, single test run, no cleanup
# required (the run row stays in the DB as a smoke artifact; operators may
# delete via `psql` if desired).
#
# Exit codes:
#   0   all steps passed
#   1   any step failed
#   2   pre-flight reachability check failed (API unreachable / wrong URL)
#   64  missing args (bash :? handler)

API_URL="${1:?Usage: agent-smoke.sh <API_URL> <JWT> <INSTITUTION_ID> [CROSS_JWT]}"
JWT="${2:?Missing JWT}"
INST_ID="${3:?Missing INSTITUTION_ID}"
CROSS_JWT="${4:-}"

# Strip trailing slash so URL composition is consistent.
API_URL="${API_URL%/}"

PASS=0
FAIL=0
TIMEOUT=120

header() { echo -e "\n── $1 ──"; }
pass() { echo "  ✓ $1"; PASS=$((PASS + 1)); }
fail() { echo "  ✗ $1"; FAIL=$((FAIL + 1)); }

auth_header="Authorization: Bearer $JWT"

# ── 0. Pre-flight reachability ───────────────────────────────────────────────
# Fail fast with a clear error if the API URL is wrong or the backend is
# down — without this, Step 1 would fail with an opaque curl error.
header "0. Pre-flight"
PREFLIGHT_STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
  --max-time 10 "$API_URL/health" 2>/dev/null || echo "000")
if [ "$PREFLIGHT_STATUS" = "200" ]; then
  pass "API reachable at $API_URL (HTTP $PREFLIGHT_STATUS)"
elif [ "$PREFLIGHT_STATUS" = "000" ]; then
  echo "  ✗ API unreachable at $API_URL/health (connect failed)"
  echo "  Hint: check the URL, DNS, and that the backend is running."
  exit 2
else
  # Non-200 but reachable — odd, but don't hard-fail (some deployments
  # don't expose /health). Note it and continue.
  echo "  ⚠ /health returned HTTP $PREFLIGHT_STATUS — continuing anyway"
fi

# ── 1. Trigger ALM_DECISION run ──────────────────────────────────────────────
header "1. Trigger ALM_DECISION"
RUN_RESPONSE=$(curl -sf -X POST \
  -H "$auth_header" \
  -H "Content-Type: application/json" \
  -d '{"agentId":"ALM_DECISION","triggerKind":"API"}' \
  "$API_URL/api/v1/agents/$INST_ID/run" 2>&1) || { fail "trigger failed"; }

RUN_ID=$(echo "$RUN_RESPONSE" | python3 -c "import sys,json; print(json.load(sys.stdin).get('runId',''))" 2>/dev/null || echo "")
if [ -z "$RUN_ID" ]; then
  fail "no runId in response"
else
  pass "triggered runId=$RUN_ID"
fi

# ── 2. Poll until SUCCEEDED ─────────────────────────────────────────────────
header "2. Poll for completion (timeout ${TIMEOUT}s)"
START=$(date +%s)
STATUS=""
while true; do
  ELAPSED=$(( $(date +%s) - START ))
  if [ "$ELAPSED" -ge "$TIMEOUT" ]; then
    fail "timed out after ${TIMEOUT}s (last status=$STATUS)"
    break
  fi

  RUN_DATA=$(curl -sf -H "$auth_header" \
    "$API_URL/api/v1/agents/$INST_ID/runs/$RUN_ID" 2>&1) || { sleep 3; continue; }

  STATUS=$(echo "$RUN_DATA" | python3 -c "import sys,json; print(json.load(sys.stdin).get('status',''))" 2>/dev/null || echo "")

  if [ "$STATUS" = "SUCCEEDED" ]; then
    pass "completed in ${ELAPSED}s"
    break
  elif [ "$STATUS" = "FAILED" ] || [ "$STATUS" = "TIMED_OUT" ]; then
    fail "run $STATUS"
    break
  fi

  sleep 3
done

# ── 3. Assert audit trace ────────────────────────────────────────────────────
header "3. Audit trace integrity"
if [ -n "$RUN_ID" ] && [ "$STATUS" = "SUCCEEDED" ]; then
  TRACE=$(curl -sf -H "$auth_header" \
    "$API_URL/api/v1/agents/$INST_ID/runs/$RUN_ID/trace" 2>&1) || { fail "trace fetch failed"; }

  STEP_COUNT=$(echo "$TRACE" | python3 -c "import sys,json; print(len(json.load(sys.stdin)))" 2>/dev/null || echo "0")
  if [ "$STEP_COUNT" -ge 12 ]; then
    pass "trace has $STEP_COUNT steps (≥12)"
  else
    fail "trace has $STEP_COUNT steps (expected ≥12)"
  fi
else
  fail "skipped (run did not succeed)"
fi

# ── 4. Assert LLM cost tracked ──────────────────────────────────────────────
header "4. LLM cost tracking"
if [ -n "$RUN_ID" ] && [ "$STATUS" = "SUCCEEDED" ]; then
  COST=$(echo "$RUN_DATA" | python3 -c "import sys,json; print(json.load(sys.stdin).get('costUsdCents',0))" 2>/dev/null || echo "0")
  if [ "$COST" -gt 0 ] 2>/dev/null; then
    pass "costUsdCents=$COST"
  else
    fail "costUsdCents is $COST (expected > 0)"
  fi
else
  fail "skipped (run did not succeed)"
fi

# ── 5. RLS cross-tenant isolation ────────────────────────────────────────────
# Two valid outcomes: HTTP 403/404 (guard denies) OR HTTP 200 with empty
# runs[] (guard passes, DB-level RLS / institutionId filter empties the
# result). Both are "safe"; the failure mode we're guarding against is
# HTTP 200 with non-empty runs[] (leak).
header "5. RLS tenant isolation"
if [ -n "$CROSS_JWT" ]; then
  CROSS_HTTP=$(curl -s -o /tmp/cerniq-smoke-cross.json -w "%{http_code}" \
    -H "Authorization: Bearer $CROSS_JWT" \
    "$API_URL/api/v1/agents/$INST_ID/runs?limit=1" 2>/dev/null || echo "000")

  if [ "$CROSS_HTTP" = "403" ] || [ "$CROSS_HTTP" = "404" ]; then
    pass "cross-tenant request denied at guard layer (HTTP $CROSS_HTTP)"
  elif [ "$CROSS_HTTP" = "200" ]; then
    CROSS_COUNT=$(python3 -c "import sys,json; d=json.load(open('/tmp/cerniq-smoke-cross.json')); print(len(d.get('runs',d if isinstance(d,list) else [])))" 2>/dev/null || echo "-1")
    if [ "$CROSS_COUNT" -eq 0 ]; then
      pass "cross-tenant request passed guard but RLS emptied result (HTTP 200, 0 runs)"
    else
      fail "RLS LEAK — cross-tenant fetch returned $CROSS_COUNT runs (HTTP 200, expected 0 or 4xx)"
    fi
  else
    fail "cross-tenant request returned unexpected HTTP $CROSS_HTTP"
  fi
  rm -f /tmp/cerniq-smoke-cross.json
else
  echo "  ⊘ skipped (no CROSS_JWT provided; pass 4 args to enable)"
fi

# ── Summary ──────────────────────────────────────────────────────────────────
header "Summary"
echo "  PASS: $PASS  FAIL: $FAIL"
if [ -n "${RUN_ID:-}" ]; then
  echo "  runId: $RUN_ID  (delete via: DELETE FROM agent_runs WHERE id='$RUN_ID';)"
fi
if [ "$FAIL" -gt 0 ]; then
  echo "  ⚠ AGENT SMOKE FAILED"
  exit 1
else
  echo "  ✓ AGENT SMOKE PASSED"
  exit 0
fi
