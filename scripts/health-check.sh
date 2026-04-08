#!/bin/bash
# ============================================================================
# CERNIQ Production Health Check
# ============================================================================
# Run:   bash scripts/health-check.sh
# Or:    bash scripts/health-check.sh https://api.cerniq.io https://cerniq.io
#
# Exit codes:
#   0 = all checks passed
#   1 = one or more checks failed
# ============================================================================

set -euo pipefail

API_URL="${1:-https://api.cerniq.io}"
FRONTEND_URL="${2:-https://cerniq.io}"
ADMIN_KEY="${ADMIN_KEY:-}"

PASS=0
FAIL=0
WARN=0

green()  { printf "\033[32m%s\033[0m" "$1"; }
red()    { printf "\033[31m%s\033[0m" "$1"; }
yellow() { printf "\033[33m%s\033[0m" "$1"; }

is_auth_rejected() {
  local code="$1"
  [ "$code" = "401" ] || [ "$code" = "403" ]
}

check() {
  local label="$1"
  local url="$2"
  local expected="${3:-200}"

  local code
  code=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 10 --max-time 15 "$url" 2>/dev/null || echo "000")

  if [ "$code" = "$expected" ]; then
    printf "  %-30s $(green 'PASS') (%s)\n" "$label" "$code"
    PASS=$((PASS + 1))
  else
    printf "  %-30s $(red 'FAIL') (got %s, expected %s)\n" "$label" "$code" "$expected"
    FAIL=$((FAIL + 1))
  fi
}

echo ""
echo "============================================"
echo "  CERNIQ Production Health Check"
echo "============================================"
echo "  API:      $API_URL"
echo "  Frontend: $FRONTEND_URL"
echo "  Time:     $(date -u '+%Y-%m-%d %H:%M:%S UTC')"
echo "============================================"
echo ""

# ---- Section 1: Core Endpoints ----
echo "--- Core Endpoints ---"
check "API Health (/health)"       "$API_URL/health"
check "API Readiness (/ready)"     "$API_URL/ready"
check "API Status (/api/status)"   "$API_URL/api/status"
check "Frontend API (/api/health)" "$FRONTEND_URL/api/health"
check "Frontend Root"              "$FRONTEND_URL"
echo ""

# ---- Section 2: Key Pages ----
echo "--- Key Pages ---"
check "Pricing Page"               "$FRONTEND_URL/pricing"
check "Login Page"                 "$FRONTEND_URL/login"
check "Status Page"                "$FRONTEND_URL/status"
check "Portal Page"                "$FRONTEND_URL/portal"
check "ALM Page"                   "$FRONTEND_URL/alm"
check "CSV Template"               "$FRONTEND_URL/templates/cerniq-balance-sheet-v1.csv"
echo ""

# ---- Section 3: Security ----
echo "--- Security Checks ---"
# Detailed health should be hidden in production
detail_code=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 10 --max-time 15 "$API_URL/health/detailed" 2>/dev/null || echo "000")
if [ "$detail_code" = "404" ]; then
  printf "  %-30s $(green 'PASS') (hidden, %s)\n" "Detailed Health Hidden" "$detail_code"
  PASS=$((PASS + 1))
elif [ "$detail_code" = "200" ]; then
  printf "  %-30s $(yellow 'WARN') (exposed, %s -- set HEALTH_DETAILS_PUBLIC=false)\n" "Detailed Health Hidden" "$detail_code"
  WARN=$((WARN + 1))
else
  printf "  %-30s $(yellow 'WARN') (unexpected %s)\n" "Detailed Health Hidden" "$detail_code"
  WARN=$((WARN + 1))
fi

# Admin endpoint without key should return 401
admin_code=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 10 --max-time 15 "$API_URL/api/admin/stats" 2>/dev/null || echo "000")
if is_auth_rejected "$admin_code"; then
  printf "  %-30s $(green 'PASS') (rejected, %s)\n" "Admin Auth Guard" "$admin_code"
  PASS=$((PASS + 1))
else
  printf "  %-30s $(red 'FAIL') (got %s, expected 401/403)\n" "Admin Auth Guard" "$admin_code"
  FAIL=$((FAIL + 1))
fi
echo ""

# ---- Section 4: API Health Details ----
echo "--- API Health Payload ---"
health_json=$(curl -s --connect-timeout 10 --max-time 15 "$API_URL/health" 2>/dev/null || echo "{}")
if command -v python3 &>/dev/null; then
  echo "$health_json" | python3 -m json.tool 2>/dev/null || echo "$health_json"
elif command -v jq &>/dev/null; then
  echo "$health_json" | jq . 2>/dev/null || echo "$health_json"
else
  echo "$health_json"
fi
echo ""

# ---- Section 5: Database Connectivity (from health payload) ----
echo "--- Service Status (from /health) ---"
if command -v python3 &>/dev/null; then
  # Unwrap ResponseEnvelopeInterceptor: { success, data: { ... } }
  db_status=$(echo "$health_json" | python3 -c "import sys,json; r=json.load(sys.stdin); d=r.get('data',r); print(d.get('db','unknown'))" 2>/dev/null || echo "unknown")
  api_status=$(echo "$health_json" | python3 -c "import sys,json; r=json.load(sys.stdin); d=r.get('data',r); print(d.get('status','unknown'))" 2>/dev/null || echo "unknown")
  mem_pct=$(echo "$health_json" | python3 -c "import sys,json; r=json.load(sys.stdin); d=r.get('data',r); print(d.get('memoryPercent','?'))" 2>/dev/null || echo "?")
  uptime=$(echo "$health_json" | python3 -c "import sys,json; r=json.load(sys.stdin); d=r.get('data',r); print(d.get('uptime','?'))" 2>/dev/null || echo "?")

  printf "  %-20s %s\n" "Overall:" "$api_status"
  printf "  %-20s %s\n" "Database:" "$db_status"
  printf "  %-20s %s%%\n" "Memory:" "$mem_pct"
  printf "  %-20s %ss\n" "Uptime:" "$uptime"
else
  echo "  (install python3 for parsed output)"
  echo "  Raw: $health_json"
fi
echo ""

# ---- Section 6: Admin Ops (optional, requires ADMIN_KEY) ----
if [ -n "$ADMIN_KEY" ]; then
  echo "--- Admin Ops (ADMIN_KEY provided) ---"
  ops_json=$(curl -s --connect-timeout 10 --max-time 15 -H "x-admin-key: $ADMIN_KEY" "$API_URL/api/admin/stats" 2>/dev/null || echo "{}")
  if command -v python3 &>/dev/null; then
    echo "$ops_json" | python3 -m json.tool 2>/dev/null || echo "$ops_json"
  else
    echo "$ops_json"
  fi
  echo ""
fi

# ---- Summary ----
TOTAL=$((PASS + FAIL))
echo "============================================"
echo "  RESULTS"
echo "============================================"
printf "  Passed:   $(green '%d')\n" "$PASS"
if [ "$FAIL" -gt 0 ]; then
  printf "  Failed:   $(red '%d')\n" "$FAIL"
else
  printf "  Failed:   %d\n" "$FAIL"
fi
if [ "$WARN" -gt 0 ]; then
  printf "  Warnings: $(yellow '%d')\n" "$WARN"
fi
printf "  Total:    %d\n" "$TOTAL"
echo "============================================"

if [ "$FAIL" -gt 0 ]; then
  echo ""
  echo "  $(red 'PRODUCTION GATE: NOT READY')"
  echo "  Fix the failing checks before client engagement."
  echo ""
  exit 1
else
  echo ""
  echo "  $(green 'PUBLIC PRODUCTION GATE: OK')"
  echo "  Proceed with the broader smoke matrix only if authenticated coverage is explicitly intended."
  echo ""
  exit 0
fi
