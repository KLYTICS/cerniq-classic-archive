#!/usr/bin/env bash
set -euo pipefail

# Agent-Layer Smoke Test
# Usage: bash scripts/agent-smoke.sh <API_URL> <JWT> <INSTITUTION_ID> [CROSS_JWT]
#
# Mirrors the going-live checklist in docs/ops/AGENT_GOING_LIVE.md.
# Designed to be safe in production (read-only where possible, single test run).

API_URL="${1:?Usage: agent-smoke.sh <API_URL> <JWT> <INSTITUTION_ID> [CROSS_JWT]}"
JWT="${2:?Missing JWT}"
INST_ID="${3:?Missing INSTITUTION_ID}"
CROSS_JWT="${4:-}"

PASS=0
FAIL=0
TIMEOUT=120

header() { echo -e "\n── $1 ──"; }
pass() { echo "  ✓ $1"; PASS=$((PASS + 1)); }
fail() { echo "  ✗ $1"; FAIL=$((FAIL + 1)); }

auth_header="Authorization: Bearer $JWT"

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
header "5. RLS tenant isolation"
if [ -n "$CROSS_JWT" ]; then
  CROSS_RUNS=$(curl -sf -H "Authorization: Bearer $CROSS_JWT" \
    "$API_URL/api/v1/agents/$INST_ID/runs?limit=1" 2>&1) || CROSS_RUNS='{"runs":[]}'

  CROSS_COUNT=$(echo "$CROSS_RUNS" | python3 -c "import sys,json; d=json.load(sys.stdin); print(len(d.get('runs',d if isinstance(d,list) else [])))" 2>/dev/null || echo "0")
  if [ "$CROSS_COUNT" -eq 0 ]; then
    pass "cross-tenant fetch returned 0 runs"
  else
    fail "cross-tenant fetch returned $CROSS_COUNT runs (expected 0)"
  fi
else
  echo "  ⊘ skipped (no CROSS_JWT provided)"
fi

# ── Summary ──────────────────────────────────────────────────────────────────
header "Summary"
echo "  PASS: $PASS  FAIL: $FAIL"
if [ "$FAIL" -gt 0 ]; then
  echo "  ⚠ AGENT SMOKE FAILED"
  exit 1
else
  echo "  ✓ AGENT SMOKE PASSED"
  exit 0
fi
