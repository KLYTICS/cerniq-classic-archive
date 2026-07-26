#!/usr/bin/env bash
# Wave 1 API smoke — production (or any) authenticated ALM surface.
#
# Usage:
#   source .env.production-e2e.local
#   bash scripts/wave1-api-smoke.sh [--json-out /path/to/out.json]
#
# Requires: CERNIQ_E2E_JWT, CERNIQ_API_URL (optional institution id)

set -euo pipefail

API_URL="${CERNIQ_API_URL:-https://api.cerniq.io}"
API_URL="${API_URL%/}"
JWT="${CERNIQ_E2E_JWT:-}"
INST_ID="${CERNIQ_E2E_INSTITUTION_ID:-}"
CROSS_JWT="${CERNIQ_E2E_CROSS_JWT:-}"
WORKSPACE_ID="${CERNIQ_E2E_WORKSPACE_ID:-}"
JSON_OUT=""

PASS=0
FAIL=0
START_MS=$(python3 -c 'import time; print(int(time.time()*1000))')
PHASE_RESULTS="[]"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --json-out)
      JSON_OUT="${2:?--json-out requires a path}"
      shift 2
      ;;
    *)
      echo "Unknown argument: $1" >&2
      exit 2
      ;;
  esac
done

if [[ -z "$JWT" ]]; then
  echo "CERNIQ_E2E_JWT is required (source .env.production-e2e.local)" >&2
  exit 2
fi

header() { echo -e "\n── $1 ──"; }
pass() { echo "  ✓ $1"; PASS=$((PASS + 1)); }
fail() { echo "  ✗ $1"; FAIL=$((FAIL + 1)); }

record_phase() {
  local name="$1" status="$2" detail="${3:-}"
  local escaped
  escaped=$(python3 -c 'import json,sys; print(json.dumps(sys.argv[1]))' "$detail")
  PHASE_RESULTS=$(python3 -c "
import json
phases = json.loads('''$PHASE_RESULTS''')
phases.append({'name': '$name', 'status': '$status', 'detail': $escaped})
print(json.dumps(phases))
")
}

auth_header="Authorization: Bearer $JWT"

api_get() {
  local path="$1"
  curl -sf -H "$auth_header" -H "Accept: application/json" \
    "$API_URL$path"
}

api_get_code() {
  local path="$1" token="$2"
  curl -s -o /tmp/cerniq_wave1_body.json -w "%{http_code}" \
    -H "Authorization: Bearer $token" -H "Accept: application/json" \
    "$API_URL$path"
}

api_post() {
  local path="$1"
  curl -sf -X POST -H "$auth_header" -H "Accept: application/json" \
    -H "Content-Type: application/json" \
    -d '{}' "$API_URL$path"
}

# ── 1. Resolve institution ───────────────────────────────────────────────────
header "1. Resolve institution"

if [[ -n "$INST_ID" ]]; then
  pass "using CERNIQ_E2E_INSTITUTION_ID=$INST_ID"
  record_phase "resolve_institution" "pass" "env institution id"
else
  LIST_PATH="/api/alm/institutions?limit=10"
  if [[ -n "$WORKSPACE_ID" ]]; then
    LIST_PATH="/api/alm/institutions?limit=10&workspaceId=$WORKSPACE_ID"
  fi
  if LIST_JSON=$(api_get "$LIST_PATH" 2>&1); then
    INST_ID=$(printf '%s' "$LIST_JSON" | python3 -c "
import json, sys
raw = json.load(sys.stdin)
data = raw.get('data', raw)
items = data if isinstance(data, list) else data.get('items', data.get('data', []))
if not items:
    sys.exit(1)
first = items[0]
print(first.get('id') or first.get('institutionId') or '')
" 2>/dev/null) || INST_ID=""
    if [[ -n "$INST_ID" ]]; then
      pass "resolved institutionId=$INST_ID from list"
      record_phase "resolve_institution" "pass" "$INST_ID"
    else
      fail "institution list empty — set CERNIQ_E2E_INSTITUTION_ID"
      record_phase "resolve_institution" "fail" "empty list"
    fi
  else
    fail "GET /api/alm/institutions failed"
    record_phase "resolve_institution" "fail" "list request failed"
  fi
fi

if [[ -z "$INST_ID" ]]; then
  echo -e "\n── Summary ──"
  echo "  PASS: $PASS  FAIL: $FAIL"
  exit 1
fi

BASE="/api/alm/$INST_ID"

# ── 2. Preflight ─────────────────────────────────────────────────────────────
header "2. Preflight"
if PREFLIGHT=$(api_get "$BASE/preflight" 2>&1); then
  if printf '%s' "$PREFLIGHT" | python3 -c "
import json, sys
raw = json.load(sys.stdin)
data = raw.get('data', raw)
gaps = data.get('gaps')
if gaps is None and not isinstance(data, dict):
    sys.exit(1)
sys.exit(0)
" 2>/dev/null; then
    pass "preflight envelope OK"
    record_phase "preflight" "pass" ""
  else
    fail "preflight missing gaps shape"
    record_phase "preflight" "fail" "shape"
  fi
else
  fail "GET preflight failed"
  record_phase "preflight" "fail" "http"
fi

# ── 3. CAEL ──────────────────────────────────────────────────────────────────
header "3. CAEL (W1.1)"
if CAEL=$(api_get "$BASE/cael" 2>&1); then
  COUNT=$(printf '%s' "$CAEL" | python3 -c "
import json, sys
raw = json.load(sys.stdin)
data = raw.get('data', raw)
items = data if isinstance(data, list) else [data]
print(len(items) if isinstance(items, list) else 0)
" 2>/dev/null || echo "0")
  if [[ "$COUNT" -ge 3 ]]; then
    pass "cael returned $COUNT variants"
    record_phase "cael" "pass" "$COUNT variants"
  else
    fail "cael expected >=3 variants, got $COUNT"
    record_phase "cael" "fail" "count=$COUNT"
  fi
else
  fail "GET cael failed"
  record_phase "cael" "fail" "http"
fi

# ── 4. EWS compute ───────────────────────────────────────────────────────────
header "4. EWS compute (W1.3)"
if EWS=$(api_get "$BASE/ews" 2>&1); then
  if printf '%s' "$EWS" | python3 -c "
import json, sys
raw = json.load(sys.stdin)
data = raw.get('data', raw)
if 'indicators' not in data:
    sys.exit(1)
" 2>/dev/null; then
    pass "ews compute envelope OK"
    record_phase "ews_compute" "pass" ""
  else
    fail "ews missing indicators"
    record_phase "ews_compute" "fail" "shape"
  fi
else
  fail "GET ews failed"
  record_phase "ews_compute" "fail" "http"
fi

# ── 5. EWS snapshot capture ──────────────────────────────────────────────────
header "5. EWS snapshot capture"
if SNAP=$(api_post "$BASE/ews/snapshot" 2>&1); then
  pass "POST ews/snapshot OK"
  record_phase "ews_snapshot" "pass" ""
  # Idempotent re-capture same day
  if api_post "$BASE/ews/snapshot" >/dev/null 2>&1; then
    pass "ews/snapshot idempotent re-POST OK"
    record_phase "ews_snapshot_idempotent" "pass" ""
  else
    fail "ews/snapshot re-POST failed"
    record_phase "ews_snapshot_idempotent" "fail" ""
  fi
else
  fail "POST ews/snapshot failed (is migration 20260709220000 applied?)"
  record_phase "ews_snapshot" "fail" "http — check ews_snapshots migration"
fi

# ── 6. EWS history ───────────────────────────────────────────────────────────
header "6. EWS history"
if HIST=$(api_get "$BASE/ews/history?limit=7" 2>&1); then
  HLEN=$(printf '%s' "$HIST" | python3 -c "
import json, sys
raw = json.load(sys.stdin)
data = raw.get('data', raw)
print(len(data) if isinstance(data, list) else 0)
" 2>/dev/null || echo "0")
  if [[ "$HLEN" -ge 1 ]]; then
    pass "ews history length=$HLEN"
    record_phase "ews_history" "pass" "len=$HLEN"
  else
    fail "ews history empty after capture"
    record_phase "ews_history" "fail" "empty"
  fi
else
  fail "GET ews/history failed"
  record_phase "ews_history" "fail" "http"
fi

# ── 7. EWS trend ─────────────────────────────────────────────────────────────
header "7. EWS trend"
if TREND=$(api_get "$BASE/ews/trend" 2>&1); then
  if printf '%s' "$TREND" | python3 -c "
import json, sys
raw = json.load(sys.stdin)
data = raw.get('data', raw)
latest = data.get('latest')
if latest is None:
    sys.exit(1)
" 2>/dev/null; then
    pass "ews trend latest populated"
    record_phase "ews_trend" "pass" ""
  else
    fail "ews trend latest null after capture"
    record_phase "ews_trend" "fail" "latest null"
  fi
else
  fail "GET ews/trend failed"
  record_phase "ews_trend" "fail" "http"
fi

# ── 8. CECL / macro W1.2 ─────────────────────────────────────────────────────
header "8. CECL warm (W1.2 indirect)"
if CECL=$(api_get "$BASE/cecl?method=warm" 2>&1); then
  pass "GET cecl?method=warm OK"
  record_phase "cecl_warm" "pass" ""
else
  fail "GET cecl failed"
  record_phase "cecl_warm" "fail" "http"
fi

# ── 9. RLS cross-tenant (optional) ───────────────────────────────────────────
header "9. RLS tenant isolation"
if [[ -n "$CROSS_JWT" ]]; then
  CODE=$(api_get_code "$BASE/ews" "$CROSS_JWT")
  if [[ "$CODE" == "401" || "$CODE" == "403" ]]; then
    pass "cross-tenant ews rejected ($CODE)"
    record_phase "rls" "pass" "http $CODE"
  else
    BODY=$(cat /tmp/cerniq_wave1_body.json 2>/dev/null || echo "")
    FORBIDDEN=$(printf '%s' "$BODY" | python3 -c "
import json, sys
try:
    raw = json.load(sys.stdin)
except Exception:
    sys.exit(0)
data = raw.get('data', raw)
if data is None or data == {}:
    sys.exit(0)
if isinstance(data, dict) and data.get('success') is False:
    sys.exit(0)
sys.exit(1)
" 2>/dev/null && echo "yes" || echo "no")
    if [[ "$FORBIDDEN" == "yes" || "$CODE" == "404" ]]; then
      pass "cross-tenant ews blocked (code=$CODE)"
      record_phase "rls" "pass" "code=$CODE"
    else
      fail "cross-tenant ews returned $CODE — RLS may be open"
      record_phase "rls" "fail" "code=$CODE"
    fi
  fi
else
  echo "  ⊘ skipped (no CERNIQ_E2E_CROSS_JWT)"
  record_phase "rls" "skip" "no cross jwt"
fi

# ── Summary + JSON ───────────────────────────────────────────────────────────
END_MS=$(python3 -c 'import time; print(int(time.time()*1000))')
DURATION=$((END_MS - START_MS))

header "Summary"
echo "  PASS: $PASS  FAIL: $FAIL  (${DURATION}ms)"
echo "  institutionId: $INST_ID"
echo "  api: $API_URL"

if [[ -n "$JSON_OUT" ]]; then
  python3 -c "
import json
payload = {
  'script': 'wave1-api-smoke',
  'apiUrl': '$API_URL',
  'institutionId': '$INST_ID',
  'pass': $PASS,
  'fail': $FAIL,
  'durationMs': $DURATION,
  'phases': json.loads('''$PHASE_RESULTS'''),
}
with open('$JSON_OUT', 'w') as f:
    json.dump(payload, f, indent=2)
print('Wrote', '$JSON_OUT')
"
fi

if [[ "$FAIL" -gt 0 ]]; then
  echo "  ⚠ WAVE 1 API SMOKE FAILED"
  exit 1
fi

echo "  ✓ WAVE 1 API SMOKE PASSED"
exit 0
