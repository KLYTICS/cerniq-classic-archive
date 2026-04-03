#!/bin/bash
# ============================================================================
# CERNIQ Terminal 2 — Backend API Startup
# NestJS 11 + TypeScript 5.9
# ============================================================================
# Usage: bash scripts/start-t2-backend.sh
# Requires: Terminal 1 (data layer) to be running first.
# ============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
BACKEND_DIR="$PROJECT_ROOT/backend-node"
cd "$PROJECT_ROOT"

green()  { printf "\033[32m%s\033[0m\n" "$*"; }
red()    { printf "\033[31m%s\033[0m\n" "$*"; }
yellow() { printf "\033[33m%s\033[0m\n" "$*"; }
blue()   { printf "\033[34m%s\033[0m\n" "$*"; }

echo ""
blue "══════════════════════════════════════════════"
blue "  CERNIQ T2 — Backend API"
blue "  NestJS 11 — Port 3000"
blue "══════════════════════════════════════════════"
echo ""

# ─── Check env file ───
if [ ! -f "$BACKEND_DIR/.env" ]; then
  red "❌ backend-node/.env not found."
  echo "   Run: cp backend-node/.env.example backend-node/.env"
  echo "   Then fill in: DATABASE_URL, JWT_SECRET, ADMIN_KEY"
  exit 1
fi
green "✅ .env file found"

# ─── Check required env vars ───
source "$BACKEND_DIR/.env" 2>/dev/null || true

MISSING_VARS=()
[ -z "${DATABASE_URL:-}" ] && MISSING_VARS+=("DATABASE_URL")
[ -z "${JWT_SECRET:-}" ]   && MISSING_VARS+=("JWT_SECRET")
[ -z "${ADMIN_KEY:-}" ]    && MISSING_VARS+=("ADMIN_KEY")

if [ ${#MISSING_VARS[@]} -gt 0 ]; then
  red "❌ Missing required env vars in backend-node/.env:"
  for VAR in "${MISSING_VARS[@]}"; do
    red "   - $VAR"
  done
  exit 1
fi
green "✅ Required env vars present"

# ─── Check database connectivity ───
yellow "→ Verifying database connectivity..."
if docker exec cerniq-db pg_isready -U cerniq > /dev/null 2>&1 || \
   docker exec cerniq-db pg_isready -U capexcycle > /dev/null 2>&1; then
  green "✅ Database is reachable"
else
  red "❌ Database is not running."
  echo "   Start Terminal 1 first: bash scripts/start-t1-data.sh"
  exit 1
fi

# ─── Check Redis connectivity ───
yellow "→ Verifying Redis connectivity..."
if docker exec cerniq-redis redis-cli ping 2>/dev/null | grep -q "PONG"; then
  green "✅ Redis is reachable"
else
  red "❌ Redis is not running."
  echo "   Start Terminal 1 first: bash scripts/start-t1-data.sh"
  exit 1
fi

# ─── Check if node_modules exist ───
if [ ! -d "$BACKEND_DIR/node_modules" ]; then
  yellow "→ node_modules not found. Installing dependencies..."
  cd "$BACKEND_DIR" && npm ci --legacy-peer-deps && cd "$PROJECT_ROOT"
  green "✅ Dependencies installed"
else
  green "✅ Dependencies present"
fi

# ─── Generate Prisma client if needed ───
if [ ! -d "$BACKEND_DIR/node_modules/.prisma" ]; then
  yellow "→ Generating Prisma client..."
  cd "$BACKEND_DIR" && npx prisma generate && cd "$PROJECT_ROOT"
  green "✅ Prisma client generated"
else
  green "✅ Prisma client present"
fi

# ─── Check for port conflict ───
if lsof -ti :3000 > /dev/null 2>&1; then
  yellow "⚠️  Port 3000 is in use."
  lsof -nP -iTCP:3000 -sTCP:LISTEN
  EXISTING_STATUS=$(curl -s -o /dev/null -w "%{http_code}" --max-time 3 http://localhost:3000/api/status 2>/dev/null || echo "000")
  if [ "$EXISTING_STATUS" != "000" ]; then
    yellow "   Probe: GET /api/status returned HTTP $EXISTING_STATUS"
    yellow "   If this is not the CERNIQ Nest backend, clear port 3000 before continuing."
  fi
  read -p "   Kill existing process? (y/n) " -n 1 -r
  echo
  if [[ $REPLY =~ ^[Yy]$ ]]; then
    lsof -ti :3000 | xargs kill -9 2>/dev/null || true
    sleep 1
    green "✅ Port 3000 cleared"
  else
    red "❌ Cannot start backend on port 3000"
    exit 1
  fi
fi

# ─── Start backend ───
echo ""
blue "══════════════════════════════════════════════"
yellow "→ Starting NestJS backend (development mode)..."
echo ""
echo "   API will be available at: http://localhost:3000"
echo "   Health check: http://localhost:3000/health"
echo ""
blue "══════════════════════════════════════════════"
echo ""

cd "$BACKEND_DIR"
npm run start:dev
