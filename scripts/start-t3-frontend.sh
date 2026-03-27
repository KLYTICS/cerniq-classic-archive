#!/bin/bash
# ============================================================================
# CERNIQ Terminal 3 — Frontend Startup
# Next.js 16 + React 19
# ============================================================================
# Usage: bash scripts/start-t3-frontend.sh
# Requires: Terminal 2 (backend) to be running.
# ============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
FRONTEND_DIR="$PROJECT_ROOT/frontend"
cd "$PROJECT_ROOT"

green()  { printf "\033[32m%s\033[0m\n" "$*"; }
red()    { printf "\033[31m%s\033[0m\n" "$*"; }
yellow() { printf "\033[33m%s\033[0m\n" "$*"; }
blue()   { printf "\033[34m%s\033[0m\n" "$*"; }

echo ""
blue "══════════════════════════════════════════════"
blue "  CERNIQ T3 — Frontend"
blue "  Next.js 16 — Port 3001"
blue "══════════════════════════════════════════════"
echo ""

# ─── Check env file ───
if [ ! -f "$FRONTEND_DIR/.env.local" ]; then
  yellow "⚠️  frontend/.env.local not found. Creating from example..."
  if [ -f "$FRONTEND_DIR/.env.example" ]; then
    cp "$FRONTEND_DIR/.env.example" "$FRONTEND_DIR/.env.local"
    yellow "   Created .env.local — verify NEXT_PUBLIC_NODE_API_URL=http://localhost:3000"
  else
    # Create minimal env file
    cat > "$FRONTEND_DIR/.env.local" << 'EOF'
NEXT_PUBLIC_NODE_API_URL=http://localhost:3000
NEXT_PUBLIC_APP_URL=http://localhost:3001
NEXT_PUBLIC_ENVIRONMENT=development
EOF
    green "✅ Created minimal .env.local"
  fi
else
  green "✅ .env.local found"
fi

# ─── Verify API URL is correct (not pointing to dead Rust backend) ───
API_URL=$(grep "NEXT_PUBLIC_NODE_API_URL" "$FRONTEND_DIR/.env.local" 2>/dev/null | cut -d= -f2 | tr -d '"')
if [ "$API_URL" = "http://localhost:8001" ]; then
  yellow "⚠️  API URL is pointing to dead Rust backend (8001)."
  yellow "   Fixing to localhost:3000..."
  sed -i.bak 's|NEXT_PUBLIC_NODE_API_URL=http://localhost:8001|NEXT_PUBLIC_NODE_API_URL=http://localhost:3000|g' \
    "$FRONTEND_DIR/.env.local"
  green "✅ API URL fixed to http://localhost:3000"
elif [ -z "$API_URL" ]; then
  yellow "⚠️  NEXT_PUBLIC_NODE_API_URL not set. Adding..."
  echo "NEXT_PUBLIC_NODE_API_URL=http://localhost:3000" >> "$FRONTEND_DIR/.env.local"
  green "✅ API URL added"
else
  green "✅ API URL: $API_URL"
fi

# ─── Check backend is running ───
yellow "→ Verifying backend is reachable..."
if curl -s --max-time 5 http://localhost:3000/health > /dev/null 2>&1; then
  green "✅ Backend is running at http://localhost:3000"
else
  yellow "⚠️  Backend not responding at localhost:3000"
  echo "   Start Terminal 2: bash scripts/start-t2-backend.sh"
  echo "   (Continuing anyway — frontend can start before backend)"
fi

# ─── Check if node_modules exist ───
if [ ! -d "$FRONTEND_DIR/node_modules" ]; then
  yellow "→ node_modules not found. Installing dependencies..."
  cd "$FRONTEND_DIR"
  # Try bun first, fall back to npm
  if command -v bun > /dev/null 2>&1; then
    bun install
  else
    npm ci
  fi
  cd "$PROJECT_ROOT"
  green "✅ Dependencies installed"
else
  green "✅ Dependencies present"
fi

# ─── Check for port conflict ───
if lsof -ti :3001 > /dev/null 2>&1; then
  yellow "⚠️  Port 3001 is in use."
  read -p "   Kill existing process? (y/n) " -n 1 -r
  echo
  if [[ $REPLY =~ ^[Yy]$ ]]; then
    lsof -ti :3001 | xargs kill -9 2>/dev/null || true
    sleep 1
    green "✅ Port 3001 cleared"
  fi
fi

# ─── Start frontend ───
echo ""
blue "══════════════════════════════════════════════"
yellow "→ Starting Next.js frontend..."
echo ""
echo "   Frontend URL:         http://localhost:3001"
echo "   Demo (cooperativa):   http://localhost:3001/demo?type=cooperativa"
echo "   ALM Dashboard:        http://localhost:3001/alm"
echo "   Admin Panel:          http://localhost:3001/admin"
echo "   Pricing:              http://localhost:3001/pricing"
echo ""
blue "══════════════════════════════════════════════"
echo ""

cd "$FRONTEND_DIR"
npm run dev -- --port 3001
