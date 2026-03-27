#!/bin/bash
# ============================================================================
# CERNIQ Terminal 4 — Python Outbound Sales Engine
# FastAPI + 6 Autonomous Agents
# ============================================================================
# Usage: bash scripts/start-t4-outbound.sh
# Optional: Runs independently of Terminals 1-3.
# ============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
OUTBOUND_DIR="$PROJECT_ROOT/services/outbound"

green()  { printf "\033[32m%s\033[0m\n" "$*"; }
red()    { printf "\033[31m%s\033[0m\n" "$*"; }
yellow() { printf "\033[33m%s\033[0m\n" "$*"; }
blue()   { printf "\033[34m%s\033[0m\n" "$*"; }

echo ""
blue "══════════════════════════════════════════════"
blue "  CERNIQ T4 — Outbound Sales Engine"
blue "  Python FastAPI — Port 8002"
blue "══════════════════════════════════════════════"
echo ""

# ─── Check outbound directory exists ───
if [ ! -d "$OUTBOUND_DIR" ]; then
  red "❌ services/outbound/ directory not found"
  exit 1
fi

cd "$OUTBOUND_DIR"

# ─── Check Python ───
if ! command -v python3 > /dev/null 2>&1; then
  red "❌ Python 3 not installed"
  exit 1
fi
green "✅ Python: $(python3 --version)"

# ─── Set up virtual environment ───
if [ ! -d "venv" ]; then
  yellow "→ Creating Python virtual environment..."
  python3 -m venv venv
  green "✅ Virtual environment created"
fi

# ─── Activate venv ───
source venv/bin/activate
green "✅ Virtual environment activated"

# ─── Install/update dependencies ───
if [ ! -f "venv/installed.marker" ] || [ "requirements.txt" -nt "venv/installed.marker" ]; then
  yellow "→ Installing Python dependencies..."
  pip install -r requirements.txt -q
  touch venv/installed.marker
  green "✅ Dependencies installed"
else
  green "✅ Dependencies current"
fi

# ─── Check env file ───
if [ ! -f ".env" ]; then
  if [ -f ".env.example" ]; then
    cp .env.example .env
    yellow "⚠️  Created .env from example. Set OPENAI_API_KEY and email credentials."
  else
    cat > .env << 'EOF'
# Outbound Engine Configuration
OPENAI_API_KEY=
ANTHROPIC_API_KEY=

# Email dispatch (choose one)
SENDGRID_API_KEY=
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=

# Database (optional - for logging)
DATABASE_URL=

# Outbound settings
MAX_EMAILS_PER_DAY=50
DRY_RUN=true
EOF
    yellow "⚠️  Created .env. Set OPENAI_API_KEY and email credentials."
    yellow "   DRY_RUN=true by default — no emails sent until you disable it."
  fi
else
  green "✅ .env file found"
fi

# ─── Validate critical env vars ───
source .env 2>/dev/null || true
if [ -z "${OPENAI_API_KEY:-}" ] && [ -z "${ANTHROPIC_API_KEY:-}" ]; then
  yellow "⚠️  No AI API key set (OPENAI_API_KEY or ANTHROPIC_API_KEY)"
  yellow "   Messaging agent will not generate emails without an API key."
fi

DRY_RUN="${DRY_RUN:-true}"
if [ "$DRY_RUN" = "true" ]; then
  yellow "ℹ️  DRY_RUN=true — no real emails will be sent"
else
  yellow "⚠️  DRY_RUN=false — REAL emails will be dispatched!"
fi

# ─── Check for port conflict ───
if lsof -ti :8002 > /dev/null 2>&1; then
  yellow "⚠️  Port 8002 is in use."
  lsof -ti :8002 | xargs kill -9 2>/dev/null || true
  sleep 1
fi

# ─── Start FastAPI server ───
echo ""
blue "══════════════════════════════════════════════"
yellow "→ Starting Python Outbound Engine..."
echo ""
echo "   API URL:     http://localhost:8002"
echo "   API Docs:    http://localhost:8002/docs"
echo "   Lead data:   services/outbound/data/puerto_rico_cooperativas_seed.csv"
echo "   Dry run:     $DRY_RUN"
echo ""
echo "  Agents:"
echo "    1. Lead Research  — Identifies cooperativa targets"
echo "    2. Enrichment     — Adds contact & firmographic data"
echo "    3. Messaging      — Generates bilingual emails (AI)"
echo "    4. Outreach       — Dispatches via SMTP/SendGrid"
echo "    5. CRM            — Logs outcomes"
echo "    6. Followup       — Schedules 3-day & 7-day waves"
echo ""
blue "══════════════════════════════════════════════"
echo ""

uvicorn app:app --host 0.0.0.0 --port 8002 --reload
