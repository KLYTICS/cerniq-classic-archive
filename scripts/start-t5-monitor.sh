#!/bin/bash
# ============================================================================
# CERNIQ Terminal 5 — System Monitor
# Real-time health, logs, and telemetry
# ============================================================================
# Usage: bash scripts/start-t5-monitor.sh [local|production]
# Default: local
# ============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_ROOT"

MODE="${1:-local}"

green()  { printf "\033[32m%s\033[0m" "$*"; }
red()    { printf "\033[31m%s\033[0m" "$*"; }
yellow() { printf "\033[33m%s\033[0m" "$*"; }
blue()   { printf "\033[34m%s\033[0m" "$*"; }
dim()    { printf "\033[2m%s\033[0m" "$*"; }

if [ "$MODE" = "production" ]; then
  API_URL="https://api.cerniq.io"
  FE_URL="https://cerniq.io"
  LABEL="PRODUCTION"
else
  API_URL="http://localhost:3000"
  FE_URL="http://localhost:3001"
  LABEL="LOCAL DEV"
fi

echo ""
printf "\033[34m══════════════════════════════════════════════\033[0m\n"
printf "\033[34m  CERNIQ T5 — System Monitor [$LABEL]\033[0m\n"
printf "\033[34m══════════════════════════════════════════════\033[0m\n"
echo ""
echo "  API:      $API_URL"
echo "  Frontend: $FE_URL"
echo "  Mode:     $MODE"
echo ""
echo "  Refreshing every 30 seconds. Ctrl+C to stop."
printf "\033[34m══════════════════════════════════════════════\033[0m\n"

check_service() {
  local name="$1"
  local url="$2"
  local code
  code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 "$url" 2>/dev/null || echo "000")
  if [ "$code" = "200" ]; then
    printf "  %-20s $(green 'UP')    [HTTP %s]\n" "$name" "$code"
  elif [ "$code" = "000" ]; then
    printf "  %-20s $(red 'DOWN')  [unreachable]\n" "$name"
  else
    printf "  %-20s $(yellow 'WARN') [HTTP %s]\n" "$name" "$code"
  fi
}

monitor_loop() {
  while true; do
    clear
    printf "\033[34m══════════════════════════════════════════════\033[0m\n"
    printf "\033[34m  CERNIQ System Monitor — %s\033[0m\n" "$(date '+%Y-%m-%d %H:%M:%S')"
    printf "\033[34m  Mode: %-37s\033[0m\n" "$LABEL"
    printf "\033[34m══════════════════════════════════════════════\033[0m\n"
    echo ""

    # ─── Service Status ───
    echo "  [SERVICES]"
    check_service "Backend API" "$API_URL/health"
    check_service "Frontend" "$FE_URL"
    if [ "$MODE" = "local" ]; then
      check_service "Outbound Engine" "http://localhost:8002/health"
      check_service "Prisma Studio" "http://localhost:5555"
    fi
    echo ""

    # ─── Health Payload ───
    echo "  [API HEALTH DETAILS]"
    HEALTH=$(curl -s --max-time 5 "$API_URL/health" 2>/dev/null || echo '{}')
    STATUS=$(echo "$HEALTH" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('status','unknown'))" 2>/dev/null || echo "unreachable")
    DB=$(echo "$HEALTH" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('db','unknown'))" 2>/dev/null || echo "unknown")
    MEM=$(echo "$HEALTH" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('memoryPercent','?'))" 2>/dev/null || echo "?")
    UPTIME=$(echo "$HEALTH" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('uptime','?'))" 2>/dev/null || echo "?")

    printf "  %-22s %s\n" "Overall Status:" "$STATUS"
    printf "  %-22s %s\n" "Database:" "$DB"
    printf "  %-22s %s%%\n" "Memory:" "$MEM"
    printf "  %-22s %ss\n" "Uptime:" "$UPTIME"
    echo ""

    # ─── Docker containers (local only) ───
    if [ "$MODE" = "local" ]; then
      echo "  [DOCKER CONTAINERS]"
      docker ps --format "  {{.Names}}: {{.Status}}" 2>/dev/null | grep -E "cerniq|capexcycle" || \
        printf "  $(dim '(no containers running)')\n"
      echo ""
    fi

    # ─── Security checks ───
    echo "  [SECURITY]"
    ADMIN_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 "$API_URL/api/admin/stats" 2>/dev/null || echo "000")
    if [ "$ADMIN_CODE" = "401" ]; then
      printf "  %-22s $(green 'PASS') Admin endpoint protected\n" "Admin Guard:"
    else
      printf "  %-22s $(red 'FAIL') Admin returned %s (should be 401)\n" "Admin Guard:" "$ADMIN_CODE"
    fi

    DETAIL_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 "$API_URL/health/detailed" 2>/dev/null || echo "000")
    if [ "$DETAIL_CODE" = "404" ]; then
      printf "  %-22s $(green 'PASS') Detailed health hidden\n" "Health Detail:"
    elif [ "$DETAIL_CODE" = "200" ]; then
      printf "  %-22s $(yellow 'WARN') Detailed health exposed (set HEALTH_DETAILS_PUBLIC=false)\n" "Health Detail:"
    fi
    echo ""

    # ─── Alert conditions ───
    echo "  [ALERTS]"
    ALERTS=0

    # Memory alert
    if [ -n "$MEM" ] && [ "$MEM" != "?" ]; then
      if [ "$MEM" -gt 85 ] 2>/dev/null; then
        printf "  🔴 $(red 'CRITICAL: Memory at %s%% (threshold: 85%%)')\n" "$MEM"
        ALERTS=$((ALERTS + 1))
      elif [ "$MEM" -gt 70 ] 2>/dev/null; then
        printf "  🟡 $(yellow 'WARNING: Memory at %s%% (threshold: 70%%)')\n" "$MEM"
        ALERTS=$((ALERTS + 1))
      fi
    fi

    if [ "$STATUS" = "unreachable" ]; then
      printf "  🔴 $(red 'CRITICAL: Backend API is unreachable')\n"
      ALERTS=$((ALERTS + 1))
    fi

    if [ "$DB" = "disconnected" ] || [ "$DB" = "error" ]; then
      printf "  🔴 $(red 'CRITICAL: Database disconnected')\n"
      ALERTS=$((ALERTS + 1))
    fi

    if [ "$ALERTS" -eq 0 ]; then
      printf "  $(green '✅ No active alerts')\n"
    fi

    echo ""
    printf "$(dim '  Next refresh in 30s — Ctrl+C to stop')\n"

    sleep 30
  done
}

monitor_loop
