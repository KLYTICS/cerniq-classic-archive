#!/bin/bash
# ============================================================================
# CERNIQ — Master Startup Script
# Launch all services in the correct order
# ============================================================================
# Usage: bash scripts/cerniq-start.sh [mode]
#
# Modes:
#   full      → All 5 terminals (data + backend + frontend + outbound + monitor)
#   core      → Core 3 terminals (data + backend + frontend)
#   backend   → Backend only (data + backend)
#   check     → Run preflight checks only
#   stop      → Stop all services
#
# Default: core
# ============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_ROOT"

MODE="${1:-core}"

green()  { printf "\033[32m%s\033[0m\n" "$*"; }
red()    { printf "\033[31m%s\033[0m\n" "$*"; }
yellow() { printf "\033[33m%s\033[0m\n" "$*"; }
blue()   { printf "\033[34m%s\033[0m\n" "$*"; }
bold()   { printf "\033[1m%s\033[0m\n" "$*"; }

print_banner() {
  echo ""
  blue "╔══════════════════════════════════════════════╗"
  blue "║          CERNIQ — ENTERPRISE STARTUP         ║"
  blue "║     Bilingual ALM Platform for Cooperativas  ║"
  blue "╚══════════════════════════════════════════════╝"
  echo ""
}

print_banner

echo "  Mode: $MODE"
echo "  Date: $(date '+%Y-%m-%d %H:%M:%S')"
echo ""

case "$MODE" in
  check|preflight)
    bash "$SCRIPT_DIR/start-t6-tools.sh" preflight
    ;;

  stop)
    yellow "→ Stopping all CERNIQ services..."
    docker compose down 2>/dev/null || true
    pkill -f "nest start" 2>/dev/null || true
    pkill -f "next dev" 2>/dev/null || true
    pkill -f "uvicorn app:app" 2>/dev/null || true
    green "✅ All services stopped"
    ;;

  backend)
    blue "━━━━ BACKEND-ONLY MODE ━━━━"
    echo ""
    echo "  Starting: Data Layer + Backend API"
    echo "  Skipping: Frontend, Outbound, Monitor"
    echo ""
    yellow "→ Step 1/2: Starting data layer..."
    docker compose up -d postgres redis
    sleep 4

    yellow "→ Waiting for PostgreSQL..."
    RETRIES=20
    COUNT=0
    while [ $COUNT -lt $RETRIES ]; do
      if docker exec cerniq-db pg_isready -U cerniq > /dev/null 2>&1 || \
         docker exec cerniq-db pg_isready -U capexcycle > /dev/null 2>&1; then
        green "✅ Database ready"
        break
      fi
      COUNT=$((COUNT+1)); sleep 2
    done

    yellow "→ Step 2/2: Starting NestJS backend..."
    echo ""
    echo "  API: http://localhost:3000"
    echo "  Health: http://localhost:3000/health"
    echo ""
    cd backend-node && npm run start:dev
    ;;

  core)
    blue "━━━━ CORE MODE (recommended for development) ━━━━"
    echo ""
    echo "  This script starts the DATA LAYER in the background."
    echo "  You need to open 2 more terminals manually:"
    echo ""
    yellow "  TERMINAL 2 (Backend):"
    echo "    bash scripts/start-t2-backend.sh"
    echo ""
    yellow "  TERMINAL 3 (Frontend):"
    echo "    bash scripts/start-t3-frontend.sh"
    echo ""
    echo "  Optional terminals:"
    yellow "  TERMINAL 4 (Outbound):"
    echo "    bash scripts/start-t4-outbound.sh"
    yellow "  TERMINAL 5 (Monitor):"
    echo "    bash scripts/start-t5-monitor.sh"
    yellow "  TERMINAL 6 (Tools):"
    echo "    bash scripts/start-t6-tools.sh [studio|test|quant]"
    echo ""

    read -p "  Start the data layer now? (y/n) " -n 1 -r
    echo ""
    if [[ $REPLY =~ ^[Yy]$ ]]; then
      yellow "→ Starting data layer..."
      docker compose up -d postgres redis
      sleep 4

      # Wait for DB
      RETRIES=20
      COUNT=0
      while [ $COUNT -lt $RETRIES ]; do
        if docker exec cerniq-db pg_isready -U cerniq > /dev/null 2>&1 || \
           docker exec cerniq-db pg_isready -U capexcycle > /dev/null 2>&1; then
          green "✅ PostgreSQL ready at localhost:5433"
          break
        fi
        COUNT=$((COUNT+1)); sleep 2
      done

      if docker exec cerniq-redis redis-cli ping 2>/dev/null | grep -q "PONG"; then
        green "✅ Redis ready at localhost:6380"
      fi

      echo ""
      green "Data layer is running. Now open Terminal 2 and run:"
      yellow "  bash scripts/start-t2-backend.sh"
    fi
    ;;

  full)
    blue "━━━━ FULL MODE ━━━━"
    echo ""
    echo "  Launching all services. This requires tmux or iTerm split panes."
    echo "  Alternatively, run each script manually in separate terminals."
    echo ""

    # Check for tmux
    if command -v tmux > /dev/null 2>&1; then
      yellow "→ tmux detected. Launch in tmux session? (y/n)"
      read -n 1 -r
      echo ""
      if [[ $REPLY =~ ^[Yy]$ ]]; then
        SESSION="cerniq"
        tmux new-session -d -s "$SESSION" -n "T1-Data"
        tmux send-keys -t "$SESSION:T1-Data" "bash $SCRIPT_DIR/start-t1-data.sh" Enter

        sleep 6

        tmux new-window -t "$SESSION" -n "T2-Backend"
        tmux send-keys -t "$SESSION:T2-Backend" "bash $SCRIPT_DIR/start-t2-backend.sh" Enter

        sleep 8

        tmux new-window -t "$SESSION" -n "T3-Frontend"
        tmux send-keys -t "$SESSION:T3-Frontend" "bash $SCRIPT_DIR/start-t3-frontend.sh" Enter

        tmux new-window -t "$SESSION" -n "T4-Outbound"
        tmux send-keys -t "$SESSION:T4-Outbound" "bash $SCRIPT_DIR/start-t4-outbound.sh" Enter

        tmux new-window -t "$SESSION" -n "T5-Monitor"
        tmux send-keys -t "$SESSION:T5-Monitor" "bash $SCRIPT_DIR/start-t5-monitor.sh" Enter

        tmux new-window -t "$SESSION" -n "T6-Tools"
        tmux send-keys -t "$SESSION:T6-Tools" "bash $SCRIPT_DIR/start-t6-tools.sh studio" Enter

        tmux select-window -t "$SESSION:T5-Monitor"
        tmux attach-session -t "$SESSION"
        exit 0
      fi
    fi

    # No tmux - print instructions
    echo ""
    yellow "Open 5+ terminal windows and run in order:"
    echo ""
    echo "  T1 (now):  bash scripts/start-t1-data.sh"
    echo "  T2:        bash scripts/start-t2-backend.sh"
    echo "  T3:        bash scripts/start-t3-frontend.sh"
    echo "  T4:        bash scripts/start-t4-outbound.sh"
    echo "  T5:        bash scripts/start-t5-monitor.sh"
    echo "  T6:        bash scripts/start-t6-tools.sh studio"
    echo ""

    # Start data layer at minimum
    yellow "→ Starting data layer now..."
    bash "$SCRIPT_DIR/start-t1-data.sh"
    ;;

  *)
    echo "  Unknown mode: $MODE"
    echo ""
    echo "  Available modes:"
    echo "    check    → Run preflight checks"
    echo "    core     → Start data layer + instructions for T2/T3"
    echo "    backend  → Start data layer + backend only"
    echo "    full     → Start all services (uses tmux if available)"
    echo "    stop     → Stop all running services"
    echo ""
    echo "  Usage: bash scripts/cerniq-start.sh [mode]"
    ;;
esac
