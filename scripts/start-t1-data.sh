#!/bin/bash
# ============================================================================
# CERNIQ Terminal 1 — Data Layer Startup
# PostgreSQL 15 + Redis 7
# ============================================================================
# Usage: bash scripts/start-t1-data.sh
# Run this FIRST before any other terminal.
# ============================================================================

set -euo pipefail

# Navigate to project root (handles running from any directory)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_ROOT"

green()  { printf "\033[32m%s\033[0m\n" "$*"; }
red()    { printf "\033[31m%s\033[0m\n" "$*"; }
yellow() { printf "\033[33m%s\033[0m\n" "$*"; }
blue()   { printf "\033[34m%s\033[0m\n" "$*"; }

echo ""
blue "══════════════════════════════════════════════"
blue "  CERNIQ T1 — Data Layer"
blue "  PostgreSQL 15 + Redis 7"
blue "══════════════════════════════════════════════"
echo ""

# ─── Check Docker ───
if ! docker info > /dev/null 2>&1; then
  red "❌ Docker is not running. Start Docker Desktop first."
  exit 1
fi
green "✅ Docker is running"

# ─── Start services ───
echo ""
yellow "→ Starting PostgreSQL and Redis..."
docker compose up -d postgres redis

# ─── Wait for PostgreSQL ───
echo ""
yellow "→ Waiting for PostgreSQL to be ready..."
RETRIES=30
COUNT=0
while [ $COUNT -lt $RETRIES ]; do
  if docker exec cerniq-db pg_isready -U cerniq > /dev/null 2>&1; then
    green "✅ PostgreSQL is ready (port 5433)"
    break
  fi
  # Try capexcycle user too (before compose is fixed)
  if docker exec cerniq-db pg_isready -U capexcycle > /dev/null 2>&1; then
    yellow "⚠️  PostgreSQL ready but using user 'capexcycle' — update docker-compose.yml to use 'cerniq'"
    break
  fi
  COUNT=$((COUNT + 1))
  echo "   Waiting... ($COUNT/$RETRIES)"
  sleep 2
done

if [ $COUNT -eq $RETRIES ]; then
  red "❌ PostgreSQL did not start in time. Check: docker logs cerniq-db"
  exit 1
fi

# ─── Wait for Redis ───
yellow "→ Checking Redis..."
if docker exec cerniq-redis redis-cli ping 2>/dev/null | grep -q "PONG"; then
  green "✅ Redis is ready (port 6380)"
else
  red "❌ Redis not responding. Check: docker logs cerniq-redis"
  exit 1
fi

# ─── Check if migrations are needed ───
echo ""
yellow "→ Checking database migrations..."
cd backend-node
if npx prisma migrate status 2>/dev/null | grep -q "Database schema is up to date"; then
  green "✅ Database migrations are current"
elif npx prisma migrate status 2>/dev/null | grep -q "following migration"; then
  yellow "⚠️  Pending migrations detected. Running..."
  npx prisma migrate deploy
  green "✅ Migrations applied"
else
  yellow "→ Running migrations to ensure schema is current..."
  npx prisma migrate deploy 2>/dev/null || yellow "⚠️  Could not verify migration status (may be first run)"
fi
cd "$PROJECT_ROOT"

# ─── Status summary ───
echo ""
blue "══════════════════════════════════════════════"
green "  DATA LAYER READY"
echo ""
echo "  PostgreSQL:  localhost:5433 (internal 5432)"
echo "  Redis:       localhost:6380 (internal 6379)"
echo ""
echo "  Quick checks:"
echo "    DB:    docker exec cerniq-db psql -U cerniq -c '\\dt'"
echo "    Redis: docker exec cerniq-redis redis-cli info keyspace"
echo ""
yellow "  Next: Open Terminal 2 and run: bash scripts/start-t2-backend.sh"
blue "══════════════════════════════════════════════"
echo ""

# ─── Follow logs ───
yellow "→ Following container logs (Ctrl+C to stop watching, services continue running)..."
echo ""
docker compose logs -f postgres redis
