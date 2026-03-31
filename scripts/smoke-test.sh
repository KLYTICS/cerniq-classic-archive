#!/bin/bash
# ============================================================================
# CERNIQ — Complete API Smoke Test
# Tests every real endpoint against a running instance
# ============================================================================
# Usage:
#   bash scripts/smoke-test.sh                        # test localhost
#   bash scripts/smoke-test.sh https://api.cerniq.io  # test production
#
# Prerequisites:
#   - CERNIQ backend running (T1 + T2 or Railway)
#   - ADMIN_KEY exported: export ADMIN_KEY=your_key
#   - Optional: export TEST_EMAIL=test@example.com TEST_PASS=TestPass123!
#
# Exit codes:
#   0 = all checks passed
#   1 = one or more checks failed
# ============================================================================

set -uo pipefail

API="${1:-http://localhost:3000}"
ADMIN_KEY="${ADMIN_KEY:-}"
ALLOW_PRODUCTION_MUTATIONS="${ALLOW_PRODUCTION_MUTATIONS:-0}"
TEST_EMAIL="${TEST_EMAIL:-smoke_$(date +%s)@cerniq-test.io}"
TEST_PASS="${TEST_PASS:-SmokeTest_$(date +%s)!}"
AUTH_TOKEN=""
AUTH_BEARER_TOKEN=""
AUTH_COOKIE_JAR=""
AUTH_CURL_ARGS=()
AUTH_ARGS_RESULT=()

IS_PRODUCTION=0
if [ "$API" = "https://api.cerniq.io" ] || [ "$API" = "https://api.cerniq.io/" ]; then
  IS_PRODUCTION=1
fi

READ_ONLY_MODE=0
if [ "$IS_PRODUCTION" -eq 1 ] && [ "$ALLOW_PRODUCTION_MUTATIONS" != "1" ]; then
  READ_ONLY_MODE=1
fi

# ─── Counters ───
PASS=0
FAIL=0
SKIP=0
WARN=0

# ─── Colors ───
green()  { printf "\033[32m✅ %-55s PASS\033[0m\n" "$1"; }
red()    { printf "\033[31m❌ %-55s FAIL (HTTP %s)\033[0m\n" "$1" "$2"; }
yellow() { printf "\033[33m⚠️  %-55s SKIP (%s)\033[0m\n" "$1" "$2"; }
blue()   { printf "\033[34m%s\033[0m\n" "$1"; }
dim()    { printf "\033[2m%s\033[0m\n" "$1"; }

build_auth_args() {
  local auth_ref="${2:-}"

  if [ "$#" -gt 0 ]; then
    auth_ref="${1:-}"
  fi

  AUTH_ARGS_RESULT=()

  if [ -z "$auth_ref" ]; then
    return
  fi

  if [ "$auth_ref" = "__AUTH__" ]; then
    [ -n "$AUTH_BEARER_TOKEN" ] && AUTH_ARGS_RESULT+=(-H "Authorization: Bearer $AUTH_BEARER_TOKEN")
    [ -n "$AUTH_COOKIE_JAR" ] && AUTH_ARGS_RESULT+=(-b "$AUTH_COOKIE_JAR")
    return
  fi

  AUTH_ARGS_RESULT+=(-H "Authorization: Bearer $auth_ref")
}

is_auth_rejected() {
  local code="$1"
  [ "$code" = "401" ] || [ "$code" = "403" ]
}

skip_read_only_section() {
  local label="$1"
  yellow "$label" "production read-only mode (set ALLOW_PRODUCTION_MUTATIONS=1 to enable)"
  SKIP=$((SKIP+1))
}

# ─── HTTP helpers ───
GET() {
  local label="$1"; local path="$2"; local token="${3:-}"
  local expected="${4:-200}"
  local code
  build_auth_args "$token"
  if [ "${#AUTH_ARGS_RESULT[@]}" -gt 0 ]; then
    code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 15 "${AUTH_ARGS_RESULT[@]}" "$API$path" 2>/dev/null || echo "000")
  else
    code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 15 "$API$path" 2>/dev/null || echo "000")
  fi
  if [ "$code" = "$expected" ]; then green "$label"; PASS=$((PASS+1));
  else red "$label" "$code"; FAIL=$((FAIL+1)); fi
}

POST() {
  local label="$1"; local path="$2"; local body="$3"; local token="${4:-}"
  local expected="${5:-200}"
  local code
  build_auth_args "$token"
  if [ "${#AUTH_ARGS_RESULT[@]}" -gt 0 ]; then
    code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 15 -H "Content-Type: application/json" "${AUTH_ARGS_RESULT[@]}" -d "$body" "$API$path" 2>/dev/null || echo "000")
  else
    code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 15 -H "Content-Type: application/json" -d "$body" "$API$path" 2>/dev/null || echo "000")
  fi
  if [ "$code" = "$expected" ] || [ "$code" = "201" ] && [ "$expected" = "200" ]; then
    green "$label"; PASS=$((PASS+1));
  elif [ "$code" = "201" ] && [ "$expected" = "201" ]; then
    green "$label"; PASS=$((PASS+1));
  else red "$label" "$code"; FAIL=$((FAIL+1)); fi
}

POST_EXPECT_2XX() {
  local label="$1"; local path="$2"; local body="$3"; local token="${4:-}"
  local code
  build_auth_args "$token"
  if [ "${#AUTH_ARGS_RESULT[@]}" -gt 0 ]; then
    code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 15 -H "Content-Type: application/json" "${AUTH_ARGS_RESULT[@]}" -d "$body" "$API$path" 2>/dev/null || echo "000")
  else
    code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 15 -H "Content-Type: application/json" -d "$body" "$API$path" 2>/dev/null || echo "000")
  fi
  if [[ "$code" =~ ^2 ]]; then green "$label"; PASS=$((PASS+1));
  else red "$label" "$code"; FAIL=$((FAIL+1)); fi
}

ADMIN_GET() {
  local label="$1"; local path="$2"; local expected="${3:-200}"
  if [ -z "$ADMIN_KEY" ]; then yellow "$label" "ADMIN_KEY not set"; SKIP=$((SKIP+1)); return; fi
  local code
  code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 15 -H "x-admin-key: $ADMIN_KEY" "$API$path" 2>/dev/null || echo "000")
  if [ "$code" = "$expected" ]; then green "$label"; PASS=$((PASS+1));
  else red "$label" "$code"; FAIL=$((FAIL+1)); fi
}

EXPECT_AUTH_REJECTED() {
  local label="$1"; local path="$2"
  local method="${3:-GET}"
  local body="${4:-}"
  local headers=()
  [ "$method" = "POST" ] && headers+=(-H "Content-Type: application/json")
  local code
  if [ "$method" = "POST" ]; then
    code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "${headers[@]}" -d "$body" "$API$path" 2>/dev/null || echo "000")
  else
    code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "$API$path" 2>/dev/null || echo "000")
  fi
  if is_auth_rejected "$code"; then green "$label (correctly rejected)"; PASS=$((PASS+1));
  else red "$label (should be 401/403)" "$code"; FAIL=$((FAIL+1)); fi
}

GET_BODY() {
  curl -s --max-time 15 "$API$1" 2>/dev/null || echo "{}"
}

POST_BODY() {
  curl -s --max-time 15 -H "Content-Type: application/json" -d "$2" "$API$1" 2>/dev/null || echo "{}"
}

# ─── Banner ───
echo ""
blue "══════════════════════════════════════════════════════════"
blue "  CERNIQ Complete API Smoke Test"
blue "══════════════════════════════════════════════════════════"
echo "  Target:  $API"
echo "  Time:    $(date -u '+%Y-%m-%d %H:%M:%S UTC')"
if [ "$READ_ONLY_MODE" -eq 1 ]; then
  echo "  Mode:    🔒 read-only public-production"
else
  echo "  Mode:    🧪 full smoke"
fi
[ -n "$ADMIN_KEY" ] && echo "  Admin:   ✅ ADMIN_KEY provided" || echo "  Admin:   ⚠️  ADMIN_KEY not set (admin tests skipped)"
blue "══════════════════════════════════════════════════════════"
echo ""

# ════════════════════════════════════════════
# SECTION 1: HEALTH & STATUS
# ════════════════════════════════════════════
blue "──── 1. Health & Status ────"
GET "GET /health"                    "/health"
GET "GET /ready"                     "/ready"
GET "GET /api/status"                "/api/status"
echo ""

# Inspect health payload
HEALTH=$(GET_BODY "/health")
STATUS=$(echo "$HEALTH" | python3 -c "import sys,json; r=json.load(sys.stdin); d=r.get('data',r); print(d.get('status','?'))" 2>/dev/null || echo "?")
DB=$(echo "$HEALTH" | python3 -c "import sys,json; r=json.load(sys.stdin); d=r.get('data',r); print(d.get('db','?'))" 2>/dev/null || echo "?")
MEM=$(echo "$HEALTH" | python3 -c "import sys,json; r=json.load(sys.stdin); d=r.get('data',r); print(d.get('memoryPercent','?'))" 2>/dev/null || echo "?")
dim "  Health payload: status=$STATUS db=$DB memory=${MEM}%"
echo ""

# ════════════════════════════════════════════
# SECTION 2: AUTH SECURITY
# ════════════════════════════════════════════
blue "──── 2. Auth Security (unauthenticated rejection) ────"
EXPECT_AUTH_REJECTED "ALM institutions (no token)"     "/api/alm/institutions"
EXPECT_AUTH_REJECTED "Portfolio (no token)"            "/api/portfolios"
EXPECT_AUTH_REJECTED "Risk engine (POST, no token)"    "/api/risk/var" "POST" '{"returns":[0.01,-0.02],"confidence":0.95,"method":"historical"}'
EXPECT_AUTH_REJECTED "Options (POST, no token)"        "/api/options/calculate" "POST" '{"underlying":100,"strike":105,"timeToExpiry":0.25,"riskFreeRate":0.05,"volatility":0.25,"optionType":"call"}'
EXPECT_AUTH_REJECTED "Execution (POST, no token)"      "/api/execution/slippage" "POST" '{"executions":[{"ticker":"AAPL","executionPrice":150.25,"midPrice":150.1,"side":"buy","quantity":100}]}'
EXPECT_AUTH_REJECTED "Auth profile (no token)"         "/api/auth/profile"
EXPECT_AUTH_REJECTED "ALM beta library (no token)"     "/api/alm/deposit-beta/library"
EXPECT_AUTH_REJECTED "ALM treasury rates (no token)"   "/api/alm/treasury/rates"
EXPECT_AUTH_REJECTED "ALM treasury curve (no token)"   "/api/alm/treasury/curve"
EXPECT_AUTH_REJECTED "ALM stress presets (no token)"   "/api/alm/stress-v2/presets"
EXPECT_AUTH_REJECTED "ALM USVI framework (no token)"   "/api/alm/usvi/framework"
EXPECT_AUTH_REJECTED "ALM macro regime (no token)"     "/api/alm/market/macro-regime"
EXPECT_AUTH_REJECTED "ALM fed futures (no token)"      "/api/alm/market/fed-futures"
EXPECT_AUTH_REJECTED "ALM publications (no token)"     "/api/alm/regulatory/publications"
EXPECT_AUTH_REJECTED "ALM analyst tools (no token)"    "/api/alm/analyst/tools"
EXPECT_AUTH_REJECTED "ALM peer synthesis (no token)"   "/api/alm/peer-synthesis/latest"
echo ""

# Admin endpoint rejection without key
ADMIN_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "$API/api/admin/stats" 2>/dev/null || echo "000")
if is_auth_rejected "$ADMIN_CODE"; then green "GET /api/admin/stats (no key — correctly rejected)"; PASS=$((PASS+1));
else red "GET /api/admin/stats (no key — should 401/403)" "$ADMIN_CODE"; FAIL=$((FAIL+1)); fi
echo ""

# ════════════════════════════════════════════
# SECTION 3: PUBLIC ENDPOINTS
# ════════════════════════════════════════════
blue "──── 3. Public Endpoints (no auth required) ────"
GET "GET /api/market-data/quote/AAPL"        "/api/market-data/quote/AAPL"
GET "GET /api/market-data/quote/SPY"         "/api/market-data/quote/SPY"
GET "GET /api/alm/demo-balance-sheet"        "/api/alm/demo-balance-sheet"
GET "GET /api/alm/demo-analysis"             "/api/alm/demo-analysis"
GET "GET /api/alm/templates/cooperativa"     "/api/alm/templates/cooperativa"
echo ""

# ════════════════════════════════════════════
# SECTION 4: REGISTER & LOGIN
# ════════════════════════════════════════════
if [ "$READ_ONLY_MODE" -eq 1 ]; then
  skip_read_only_section "4. Authenticated and mutating smoke coverage"
  echo ""
else
  blue "──── 4. Auth: Register & Login ────"

  AUTH_COOKIE_JAR=$(mktemp "${TMPDIR:-/tmp}/cerniq-smoke-cookies.XXXXXX")
  trap 'rm -f "$AUTH_COOKIE_JAR"' EXIT

  # Register
  REG_BODY="{\"email\":\"$TEST_EMAIL\",\"password\":\"$TEST_PASS\",\"name\":\"Smoke Test\"}"
  REG_RESP=$(curl -s --max-time 15 \
    -c "$AUTH_COOKIE_JAR" -b "$AUTH_COOKIE_JAR" \
    -H "Content-Type: application/json" -d "$REG_BODY" "$API/api/auth/register" 2>/dev/null || echo "{}")
  REG_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 15 \
    -c "$AUTH_COOKIE_JAR" -b "$AUTH_COOKIE_JAR" \
    -H "Content-Type: application/json" -d "$REG_BODY" "$API/api/auth/register" 2>/dev/null || echo "000")

  if [[ "$REG_CODE" =~ ^2 ]]; then
    green "POST /api/auth/register"
    PASS=$((PASS+1))
  else
    # Maybe user already exists — try login
    if [ "$REG_CODE" = "409" ]; then
      dim "  (User exists, will try login)"
      PASS=$((PASS+1))
    else
      red "POST /api/auth/register" "$REG_CODE"
      FAIL=$((FAIL+1))
    fi
  fi

  # Login (always try — may have registered above or using existing user)
  LOGIN_BODY="{\"email\":\"$TEST_EMAIL\",\"password\":\"$TEST_PASS\"}"
  LOGIN_RESP=$(curl -s --max-time 15 \
    -c "$AUTH_COOKIE_JAR" -b "$AUTH_COOKIE_JAR" \
    -H "Content-Type: application/json" -d "$LOGIN_BODY" "$API/api/auth/login" 2>/dev/null || echo "{}")
  LOGIN_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 15 \
    -c "$AUTH_COOKIE_JAR" -b "$AUTH_COOKIE_JAR" \
    -H "Content-Type: application/json" -d "$LOGIN_BODY" "$API/api/auth/login" 2>/dev/null || echo "000")

  if [[ "$LOGIN_CODE" =~ ^2 ]]; then
    green "POST /api/auth/login"
    PASS=$((PASS+1))
    AUTH_BEARER_TOKEN=$(echo "$LOGIN_RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('accessToken', d.get('access_token','')))" 2>/dev/null || echo "")
    AUTH_TOKEN="__AUTH__"
    AUTH_CURL_ARGS=()
    [ -n "$AUTH_BEARER_TOKEN" ] && AUTH_CURL_ARGS+=(-H "Authorization: Bearer $AUTH_BEARER_TOKEN")
    [ -n "$AUTH_COOKIE_JAR" ] && AUTH_CURL_ARGS+=(-b "$AUTH_COOKIE_JAR")
    if [ -n "$AUTH_BEARER_TOKEN" ]; then
      dim "  Token: ${AUTH_BEARER_TOKEN:0:40}..."
    else
      dim "  Auth established via HTTP-only cookie"
    fi
  else
    red "POST /api/auth/login" "$LOGIN_CODE"
    FAIL=$((FAIL+1))
    AUTH_TOKEN=""
    AUTH_CURL_ARGS=()
  fi

  echo ""
fi

# ════════════════════════════════════════════
# SECTION 5: AUTH PROFILE & API KEYS
# ════════════════════════════════════════════
if [ "$READ_ONLY_MODE" -eq 0 ] && [ -n "$AUTH_TOKEN" ]; then
  blue "──── 5. Auth: Profile & API Keys ────"
  GET "GET /api/auth/profile"         "/api/auth/profile"         "$AUTH_TOKEN"
  GET "GET /api/auth/api-keys"        "/api/auth/api-keys"        "$AUTH_TOKEN"
  POST_EXPECT_2XX "POST /api/auth/api-keys" "/api/auth/api-keys" \
    '{"name":"Smoke Test Key","expiresInDays":1}' "$AUTH_TOKEN"
  echo ""
fi

# ════════════════════════════════════════════
# SECTION 6: WORKSPACES
# ════════════════════════════════════════════
if [ "$READ_ONLY_MODE" -eq 0 ] && [ -n "$AUTH_TOKEN" ]; then
  blue "──── 6. Workspaces ────"
  GET "GET /api/workspaces"           "/api/workspaces"           "$AUTH_TOKEN"
  POST_EXPECT_2XX "POST /api/workspaces" "/api/workspaces" \
    '{"name":"Smoke Workspace"}' "$AUTH_TOKEN"
  echo ""
fi

# ════════════════════════════════════════════
# SECTION 7: ALM — INSTITUTION CRUD
# ════════════════════════════════════════════
INSTITUTION_ID=""
if [ "$READ_ONLY_MODE" -eq 0 ] && [ -n "$AUTH_TOKEN" ]; then
  blue "──── 7. ALM: Institution Management ────"

  # Create institution
  INST_BODY='{"name":"Smoke Test CoopAhorro","type":"cooperativa","totalAssets":250000000,"currency":"USD","regulatoryBody":"COSSEC"}'
  if [ "${#AUTH_CURL_ARGS[@]}" -gt 0 ]; then
    INST_RESP=$(curl -s --max-time 15 \
      -H "Content-Type: application/json" \
      "${AUTH_CURL_ARGS[@]}" \
      -d "$INST_BODY" "$API/api/alm/institutions" 2>/dev/null || echo "{}")
    INST_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 15 \
      -H "Content-Type: application/json" \
      "${AUTH_CURL_ARGS[@]}" \
      -d "$INST_BODY" "$API/api/alm/institutions" 2>/dev/null || echo "000")
  else
    INST_RESP=$(curl -s --max-time 15 \
      -H "Content-Type: application/json" \
      -d "$INST_BODY" "$API/api/alm/institutions" 2>/dev/null || echo "{}")
    INST_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 15 \
      -H "Content-Type: application/json" \
      -d "$INST_BODY" "$API/api/alm/institutions" 2>/dev/null || echo "000")
  fi

  if [[ "$INST_CODE" =~ ^2 ]]; then
    green "POST /api/alm/institutions"
    PASS=$((PASS+1))
    INSTITUTION_ID=$(echo "$INST_RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('id',''))" 2>/dev/null || echo "")
    dim "  Institution ID: $INSTITUTION_ID"
  else
    red "POST /api/alm/institutions" "$INST_CODE"
    FAIL=$((FAIL+1))
  fi

  GET "GET /api/alm/institutions"       "/api/alm/institutions"     "$AUTH_TOKEN"

  if [ -n "$INSTITUTION_ID" ]; then
    GET "GET /api/alm/institutions/:id"   "/api/alm/institutions/$INSTITUTION_ID" "$AUTH_TOKEN"
  fi
  echo ""
fi

# ════════════════════════════════════════════
# SECTION 8: ALM — STATELESS CALCULATIONS
# ════════════════════════════════════════════
if [ "$READ_ONLY_MODE" -eq 0 ] && [ -n "$AUTH_TOKEN" ]; then
  blue "──── 8. ALM: Stateless Calculations ────"

  DG_BODY='{"assets":[{"balance":100000000,"rate":0.065,"maturityYears":5,"isFixed":true},{"balance":50000000,"rate":0.055,"maturityYears":7,"isFixed":true}],"liabilities":[{"balance":80000000,"rate":0.025,"maturityYears":1,"isFixed":false},{"balance":40000000,"rate":0.03,"maturityYears":3,"isFixed":false}]}'
  POST_EXPECT_2XX "POST /api/alm/duration-gap (stateless)"    "/api/alm/duration-gap"    "$DG_BODY" "$AUTH_TOKEN"

  NII_BODY='{"assets":[{"balance":100000000,"rate":0.065,"repricingSensitivity":0.5}],"liabilities":[{"balance":80000000,"rate":0.025,"repricingSensitivity":0.8}],"scenarios":[-200,-100,0,100,200,300]}'
  POST_EXPECT_2XX "POST /api/alm/nii-simulation (stateless)"  "/api/alm/nii-simulation"  "$NII_BODY" "$AUTH_TOKEN"

  EVE_BODY='{"assets":[{"balance":100000000,"rate":0.065,"maturityYears":5}],"liabilities":[{"balance":80000000,"rate":0.025,"maturityYears":1}]}'
  POST_EXPECT_2XX "POST /api/alm/eve (stateless)"             "/api/alm/eve"             "$EVE_BODY" "$AUTH_TOKEN"

  LCR_BODY='{"level1Assets":25000000,"level2aAssets":5000000,"level2bAssets":2000000,"cashOutflows30d":20000000,"cashInflows30d":5000000}'
  POST_EXPECT_2XX "POST /api/alm/lcr (stateless)"             "/api/alm/lcr"             "$LCR_BODY" "$AUTH_TOKEN"

  BPV_BODY='{"portfolioValue":250000000,"modifiedDuration":3.5}'
  POST_EXPECT_2XX "POST /api/alm/bpv (stateless)"             "/api/alm/bpv"             "$BPV_BODY" "$AUTH_TOKEN"
  echo ""
fi

# ════════════════════════════════════════════
# SECTION 9: ALM — INSTITUTION ANALYSIS
# ════════════════════════════════════════════
if [ "$READ_ONLY_MODE" -eq 0 ] && [ -n "$AUTH_TOKEN" ] && [ -n "$INSTITUTION_ID" ]; then
  blue "──── 9. ALM: Institution-Scoped Analysis ────"

  # First seed some balance sheet items
  BS_ITEMS='[{"name":"Mortgage Portfolio","itemType":"ASSET","category":"loans","balance":150000000,"rate":0.065,"maturityYears":20,"isFixed":true,"duration":8.5},{"name":"Commercial Loans","itemType":"ASSET","category":"loans","balance":50000000,"rate":0.072,"maturityYears":5,"isFixed":false,"duration":3.2},{"name":"Member Deposits","itemType":"LIABILITY","category":"deposits","balance":140000000,"rate":0.025,"maturityYears":1,"isFixed":false,"duration":0.8},{"name":"Borrowed Funds","itemType":"LIABILITY","category":"borrowings","balance":30000000,"rate":0.045,"maturityYears":5,"isFixed":true,"duration":4.2}]'
  POST_EXPECT_2XX "POST /api/alm/institutions/:id/balance-sheet-items" \
    "/api/alm/institutions/$INSTITUTION_ID/balance-sheet-items" "$BS_ITEMS" "$AUTH_TOKEN"

  GET "GET /api/alm/:id/summary"              "/api/alm/$INSTITUTION_ID/summary"              "$AUTH_TOKEN"
  GET "GET /api/alm/:id/duration-gap"         "/api/alm/$INSTITUTION_ID/duration-gap"         "$AUTH_TOKEN"
  GET "GET /api/alm/:id/nii-sensitivity"      "/api/alm/$INSTITUTION_ID/nii-sensitivity"      "$AUTH_TOKEN"
  GET "GET /api/alm/:id/liquidity"            "/api/alm/$INSTITUTION_ID/liquidity"            "$AUTH_TOKEN"
  GET "GET /api/alm/:id/cossec-compliance"    "/api/alm/$INSTITUTION_ID/cossec-compliance"    "$AUTH_TOKEN"
  GET "GET /api/alm/:id/concentration"        "/api/alm/$INSTITUTION_ID/concentration"        "$AUTH_TOKEN"
  GET "GET /api/alm/:id/credit-risk"          "/api/alm/$INSTITUTION_ID/credit-risk"          "$AUTH_TOKEN"
  GET "GET /api/alm/:id/var"                  "/api/alm/$INSTITUTION_ID/var"                  "$AUTH_TOKEN"
  GET "GET /api/alm/:id/ftp"                  "/api/alm/$INSTITUTION_ID/ftp"                  "$AUTH_TOKEN"
  GET "GET /api/alm/:id/ftp/attribution"      "/api/alm/$INSTITUTION_ID/ftp/attribution"      "$AUTH_TOKEN"
  GET "GET /api/alm/:id/cecl"                 "/api/alm/$INSTITUTION_ID/cecl"                 "$AUTH_TOKEN"
  GET "GET /api/alm/:id/behavioral-duration"  "/api/alm/$INSTITUTION_ID/behavioral-duration"  "$AUTH_TOKEN"
  GET "GET /api/alm/:id/deposit-betas"        "/api/alm/$INSTITUTION_ID/deposit-betas"        "$AUTH_TOKEN"
  GET "GET /api/alm/:id/deposit-beta-impact"  "/api/alm/$INSTITUTION_ID/deposit-beta-impact"  "$AUTH_TOKEN"
  GET "GET /api/alm/:id/repricing-gap"        "/api/alm/$INSTITUTION_ID/repricing-gap"        "$AUTH_TOKEN"
  GET "GET /api/alm/:id/irr-policy"           "/api/alm/$INSTITUTION_ID/irr-policy"           "$AUTH_TOKEN"
  GET "GET /api/alm/:id/peer-analytics"       "/api/alm/$INSTITUTION_ID/peer-analytics"       "$AUTH_TOKEN"
  GET "GET /api/alm/:id/oas"                  "/api/alm/$INSTITUTION_ID/oas"                  "$AUTH_TOKEN"
  GET "GET /api/alm/:id/ews"                  "/api/alm/$INSTITUTION_ID/ews"                  "$AUTH_TOKEN"
  GET "GET /api/alm/:id/sofr-exposure"        "/api/alm/$INSTITUTION_ID/sofr-exposure"        "$AUTH_TOKEN"
  GET "GET /api/alm/:id/camel-forecast"       "/api/alm/$INSTITUTION_ID/camel-forecast"       "$AUTH_TOKEN"
  GET "GET /api/alm/:id/alerts"               "/api/alm/$INSTITUTION_ID/alerts"               "$AUTH_TOKEN"
  GET "GET /api/alm/:id/yield-curve-analysis" "/api/alm/$INSTITUTION_ID/yield-curve-analysis" "$AUTH_TOKEN"
  GET "GET /api/alm/:id/concentration-var"    "/api/alm/$INSTITUTION_ID/concentration-var"    "$AUTH_TOKEN"
  GET "GET /api/alm/:id/optionality"          "/api/alm/$INSTITUTION_ID/optionality"          "$AUTH_TOKEN"
  GET "GET /api/alm/:id/nim-optimizer"        "/api/alm/$INSTITUTION_ID/nim-optimizer"        "$AUTH_TOKEN"
  GET "GET /api/alm/:id/hrp"                  "/api/alm/$INSTITUTION_ID/hrp"                  "$AUTH_TOKEN"
  GET "GET /api/alm/:id/pca-factors"          "/api/alm/$INSTITUTION_ID/pca-factors"          "$AUTH_TOKEN"
  GET "GET /api/alm/:id/macro-factors"        "/api/alm/$INSTITUTION_ID/macro-factors"        "$AUTH_TOKEN"
  GET "GET /api/alm/:id/calendar"             "/api/alm/$INSTITUTION_ID/calendar"             "$AUTH_TOKEN"
  GET "GET /api/alm/:id/exam-prep"            "/api/alm/$INSTITUTION_ID/exam-prep"            "$AUTH_TOKEN"
  GET "GET /api/alm/:id/ltp"                  "/api/alm/$INSTITUTION_ID/ltp"                  "$AUTH_TOKEN"
  GET "GET /api/alm/:id/rbc2"                 "/api/alm/$INSTITUTION_ID/rbc2"                 "$AUTH_TOKEN"
  GET "GET /api/alm/:id/frtb-capital"         "/api/alm/$INSTITUTION_ID/frtb-capital"         "$AUTH_TOKEN"
  GET "GET /api/alm/:id/wrong-way-risk"       "/api/alm/$INSTITUTION_ID/wrong-way-risk"       "$AUTH_TOKEN"
  GET "GET /api/alm/:id/climate-risk"         "/api/alm/$INSTITUTION_ID/climate-risk"         "$AUTH_TOKEN"
  GET "GET /api/alm/:id/nim-attribution"      "/api/alm/$INSTITUTION_ID/nim-attribution"      "$AUTH_TOKEN"
  GET "GET /api/alm/:id/key-rate-durations"   "/api/alm/$INSTITUTION_ID/key-rate-durations"   "$AUTH_TOKEN"
  GET "GET /api/alm/:id/onboarding"           "/api/alm/$INSTITUTION_ID/onboarding"           "$AUTH_TOKEN"
  GET "GET /api/alm/:id/advisor/health-score" "/api/alm/$INSTITUTION_ID/advisor/health-score" "$AUTH_TOKEN"
  GET "GET /api/alm/:id/advisor/narrative"    "/api/alm/$INSTITUTION_ID/advisor/narrative"    "$AUTH_TOKEN"
  GET "GET /api/alm/:id/stress-pack"          "/api/alm/$INSTITUTION_ID/stress-pack"          "$AUTH_TOKEN"
  GET "GET /api/alm/:id/report (PDF)"         "/api/alm/$INSTITUTION_ID/report"               "$AUTH_TOKEN"
  echo ""
fi

# ════════════════════════════════════════════
# SECTION 10: ALM — STRESS TESTING
# ════════════════════════════════════════════
if [ "$READ_ONLY_MODE" -eq 0 ] && [ -n "$AUTH_TOKEN" ] && [ -n "$INSTITUTION_ID" ]; then
  blue "──── 10. ALM: Stress Testing ────"

  MC_BODY="{\"institutionId\":\"$INSTITUTION_ID\"}"
  POST_EXPECT_2XX "POST /api/alm/:id/monte-carlo/run" \
    "/api/alm/$INSTITUTION_ID/monte-carlo/run" "$MC_BODY" "$AUTH_TOKEN"

  ST_BODY='{"scenarios":[{"name":"Base Case","shockBps":0},{"name":"Up 200bps","shockBps":200}]}'
  POST_EXPECT_2XX "POST /api/alm/:id/stress-test" \
    "/api/alm/$INSTITUTION_ID/stress-test" "$ST_BODY" "$AUTH_TOKEN"

  SV2_BODY='{"scenarioKey":"ncua_shock_300"}'
  POST_EXPECT_2XX "POST /api/alm/:id/stress-v2/run" \
    "/api/alm/$INSTITUTION_ID/stress-v2/run" "$SV2_BODY" "$AUTH_TOKEN"

  FWD_BODY='{"periods":4,"growthRate":0.05}'
  POST_EXPECT_2XX "POST /api/alm/:id/forward-simulation" \
    "/api/alm/$INSTITUTION_ID/forward-simulation" "$FWD_BODY" "$AUTH_TOKEN"
  echo ""
fi

# ════════════════════════════════════════════
# SECTION 11: RISK ENGINE
# ════════════════════════════════════════════
if [ "$READ_ONLY_MODE" -eq 0 ] && [ -n "$AUTH_TOKEN" ]; then
  blue "──── 11. Risk Engine ────"

  VAR_BODY='{"returns":[-0.02,0.01,-0.015,0.008,-0.03,0.025,-0.01,0.005,-0.012,0.018,0.003,-0.008],"confidence":0.95,"method":"historical"}'
  POST_EXPECT_2XX "POST /api/risk/var"            "/api/risk/var"            "$VAR_BODY"  "$AUTH_TOKEN"

  PVAR_BODY='{"portfolioValue":10000000,"volatility":0.15,"confidence":0.95,"timeHorizonDays":10}'
  POST_EXPECT_2XX "POST /api/risk/parametric-var" "/api/risk/parametric-var" "$PVAR_BODY" "$AUTH_TOKEN"

  CORR_BODY='{"assets":[{"ticker":"AAPL","returns":[-0.02,0.01,0.03,-0.01,0.02]},{"ticker":"MSFT","returns":[0.01,-0.02,0.02,0.01,-0.01]}]}'
  POST_EXPECT_2XX "POST /api/risk/correlation"    "/api/risk/correlation"    "$CORR_BODY" "$AUTH_TOKEN"

  MC_BODY='{"portfolioValue":10000000,"volatility":0.15,"timeHorizonDays":252,"numSimulations":1000,"confidenceLevel":0.95}'
  POST_EXPECT_2XX "POST /api/risk/monte-carlo"    "/api/risk/monte-carlo"    "$MC_BODY"   "$AUTH_TOKEN"
  echo ""
fi

# ════════════════════════════════════════════
# SECTION 12: OPTIONS ENGINE
# ════════════════════════════════════════════
if [ "$READ_ONLY_MODE" -eq 0 ] && [ -n "$AUTH_TOKEN" ]; then
  blue "──── 12. Options Engine ────"

  GREEKS_BODY='{"underlying":450.00,"strike":460.00,"timeToExpiry":0.0833,"riskFreeRate":0.045,"volatility":0.22,"optionType":"call"}'
  POST_EXPECT_2XX "POST /api/options/calculate"         "/api/options/calculate"         "$GREEKS_BODY" "$AUTH_TOKEN"

  IV_BODY='{"ticker":"SPY","strike":460.00,"expiration":"2026-06-19","marketPrice":8.50,"optionType":"call"}'
  POST_EXPECT_2XX "POST /api/options/implied-volatility" "/api/options/implied-volatility" "$IV_BODY"    "$AUTH_TOKEN"

  GET "GET /api/options/strategy-presets"               "/api/options/strategy-presets"                "$AUTH_TOKEN"
  GET "GET /api/options/chain/SPY"                      "/api/options/chain/SPY"                       "$AUTH_TOKEN"
  echo ""
fi

# ════════════════════════════════════════════
# SECTION 13: EXECUTION QUALITY
# ════════════════════════════════════════════
if [ "$READ_ONLY_MODE" -eq 0 ] && [ -n "$AUTH_TOKEN" ]; then
  blue "──── 13. Execution Quality ────"

  SLIP_BODY='{"executions":[{"ticker":"AAPL","executionPrice":150.25,"midPrice":150.10,"side":"buy","quantity":100},{"ticker":"MSFT","executionPrice":310.50,"midPrice":310.75,"side":"sell","quantity":50}]}'
  POST_EXPECT_2XX "POST /api/execution/slippage"              "/api/execution/slippage"              "$SLIP_BODY" "$AUTH_TOKEN"

  VWAP_BODY='{"ticker":"AAPL","vwap":150.15,"executions":[{"price":150.25,"quantity":100},{"price":150.05,"quantity":200}]}'
  POST_EXPECT_2XX "POST /api/execution/vwap"                  "/api/execution/vwap"                  "$VWAP_BODY" "$AUTH_TOKEN"

  IS_BODY='{"ticker":"AAPL","decisionPrice":149.50,"executionPrice":150.25,"quantity":1000,"side":"buy","benchmarkPrice":149.80}'
  POST_EXPECT_2XX "POST /api/execution/implementation-shortfall" "/api/execution/implementation-shortfall" "$IS_BODY" "$AUTH_TOKEN"

  GET "GET /api/execution/strategies"                         "/api/execution/strategies"                          "$AUTH_TOKEN"
  echo ""
fi

# ════════════════════════════════════════════
# SECTION 14: MARKET DATA
# ════════════════════════════════════════════
blue "──── 14. Market Data ────"
GET "GET /api/market-data/quote/AAPL"         "/api/market-data/quote/AAPL"
GET "GET /api/market-data/quote/SPY"          "/api/market-data/quote/SPY"
GET "GET /api/market-data/snapshot/AAPL"      "/api/market-data/snapshot/AAPL"
GET "GET /api/market-data/health"             "/api/market-data/health"
GET "GET /api/market-data/streams"            "/api/market-data/streams"
echo ""

# ════════════════════════════════════════════
# SECTION 15: PORTFOLIO
# ════════════════════════════════════════════
PORTFOLIO_ID=""
if [ "$READ_ONLY_MODE" -eq 0 ] && [ -n "$AUTH_TOKEN" ]; then
  blue "──── 15. Portfolio ────"
  GET "GET /api/portfolios" "/api/portfolios" "$AUTH_TOKEN"

  P_BODY='{"name":"Smoke Test Portfolio","description":"Test","currency":"USD"}'
  if [ "${#AUTH_CURL_ARGS[@]}" -gt 0 ]; then
    P_RESP=$(curl -s --max-time 15 \
      -H "Content-Type: application/json" \
      "${AUTH_CURL_ARGS[@]}" \
      -d "$P_BODY" "$API/api/portfolios" 2>/dev/null || echo "{}")
    P_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 15 \
      -H "Content-Type: application/json" \
      "${AUTH_CURL_ARGS[@]}" \
      -d "$P_BODY" "$API/api/portfolios" 2>/dev/null || echo "000")
  else
    P_RESP=$(curl -s --max-time 15 \
      -H "Content-Type: application/json" \
      -d "$P_BODY" "$API/api/portfolios" 2>/dev/null || echo "{}")
    P_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 15 \
      -H "Content-Type: application/json" \
      -d "$P_BODY" "$API/api/portfolios" 2>/dev/null || echo "000")
  fi

  if [[ "$P_CODE" =~ ^2 ]]; then
    green "POST /api/portfolios"
    PASS=$((PASS+1))
    PORTFOLIO_ID=$(echo "$P_RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('id',''))" 2>/dev/null || echo "")
  else
    red "POST /api/portfolios" "$P_CODE"
    FAIL=$((FAIL+1))
  fi

  if [ -n "$PORTFOLIO_ID" ]; then
    GET "GET /api/portfolios/:id"          "/api/portfolios/$PORTFOLIO_ID"            "$AUTH_TOKEN"
    GET "GET /api/portfolios/:id/analytics" "/api/portfolios/$PORTFOLIO_ID/analytics"  "$AUTH_TOKEN"
  fi
  echo ""
fi

# ════════════════════════════════════════════
# SECTION 16: LEADS (PUBLIC)
# ════════════════════════════════════════════
blue "──── 16. Leads (Public Submit) ────"
if [ "$READ_ONLY_MODE" -eq 1 ]; then
  skip_read_only_section "16. Public submit endpoints"
else
  LEAD_BODY='{"email":"smoke_lead@test.io","name":"Smoke Tester","institutionName":"Test Cooperativa","institutionType":"cooperativa","phone":"+1-787-555-0100","message":"Smoke test lead submission"}'
  POST_EXPECT_2XX "POST /api/v1/leads/submit (public)" "/api/v1/leads/submit" "$LEAD_BODY"

  DEMO_BODY='{"name":"Smoke Tester","email":"smoke_demo@test.io","institutionName":"Test Cooperativa","institutionType":"cooperativa","message":"Smoke test demo request"}'
  POST_EXPECT_2XX "POST /api/demo-request (public)" "/api/demo-request" "$DEMO_BODY"
fi
echo ""

# ════════════════════════════════════════════
# SECTION 17: ADMIN ENDPOINTS
# ════════════════════════════════════════════
blue "──── 17. Admin Endpoints (ADMIN_KEY required) ────"
if [ "$READ_ONLY_MODE" -eq 1 ]; then
  skip_read_only_section "17. Admin endpoint coverage"
else
  ADMIN_GET "GET /api/admin/stats"              "/api/admin/stats"
  ADMIN_GET "GET /api/admin/demo-requests"      "/api/admin/demo-requests"
  ADMIN_GET "GET /api/admin/prospects"          "/api/admin/prospects"
  ADMIN_GET "GET /admin/api/leads"              "/admin/api/leads"
  ADMIN_GET "GET /admin/api/leads/metrics"      "/admin/api/leads/metrics"
  ADMIN_GET "GET /admin/api/pipeline"           "/admin/api/pipeline"
fi
echo ""

# ════════════════════════════════════════════
# SECTION 18: SAMPLE REPORT (Public)
# ════════════════════════════════════════════
blue "──── 18. Sample Report & Templates ────"
if [ "$READ_ONLY_MODE" -eq 1 ]; then
  skip_read_only_section "18. Sample report generation"
else
  SAMPLE_BODY='{"institutionName":"CoopAhorro Demo","totalAssets":250000000,"language":"es"}'
  POST_EXPECT_2XX "POST /api/alm/sample-report (public)" "/api/alm/sample-report" "$SAMPLE_BODY"
fi
GET "GET /api/alm/templates/cooperativa" "/api/alm/templates/cooperativa"
echo ""

# ════════════════════════════════════════════
# SECTION 19: ORGANIZATIONS
# ════════════════════════════════════════════
if [ "$READ_ONLY_MODE" -eq 0 ] && [ -n "$AUTH_TOKEN" ]; then
  blue "──── 19. Organizations ────"
  GET "GET /api/organizations" "/api/organizations" "$AUTH_TOKEN"
  ORG_BODY='{"name":"Smoke Test Org","slug":"smoke-test-org","description":"Test organization"}'
  POST_EXPECT_2XX "POST /api/organizations" "/api/organizations" "$ORG_BODY" "$AUTH_TOKEN"
  echo ""
fi

# ════════════════════════════════════════════
# SUMMARY
# ════════════════════════════════════════════
TOTAL=$((PASS + FAIL + SKIP))
echo ""
blue "══════════════════════════════════════════════════════════"
blue "  SMOKE TEST RESULTS"
blue "══════════════════════════════════════════════════════════"
printf "  \033[32mPassed:  %d\033[0m\n" "$PASS"
if [ "$FAIL" -gt 0 ]; then
  printf "  \033[31mFailed:  %d\033[0m\n" "$FAIL"
else
  printf "  Failed:  %d\n" "$FAIL"
fi
if [ "$SKIP" -gt 0 ]; then
  printf "  \033[33mSkipped: %d\033[0m (ADMIN_KEY not provided)\n" "$SKIP"
fi
printf "  Total:   %d\n" "$TOTAL"
blue "══════════════════════════════════════════════════════════"

if [ "$FAIL" -eq 0 ]; then
  echo ""
  printf "  \033[32m✅ ALL CHECKS PASSED — CERNIQ IS FULLY OPERATIONAL\033[0m\n"
  echo ""
  exit 0
else
  echo ""
  printf "  \033[31m❌ %d CHECKS FAILED — INVESTIGATE BEFORE CLIENT ENGAGEMENT\033[0m\n" "$FAIL"
  echo ""
  exit 1
fi
