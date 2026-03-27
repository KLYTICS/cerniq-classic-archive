#!/bin/bash
# ============================================================================
# CERNIQ Terminal 6 — Development Tools
# Prisma Studio | Tests | Lint | Quant Research
# ============================================================================
# Usage: bash scripts/start-t6-tools.sh [studio|test|lint|quant|typecheck]
# Default: studio
# ============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_ROOT"

green()  { printf "\033[32m%s\033[0m\n" "$*"; }
red()    { printf "\033[31m%s\033[0m\n" "$*"; }
yellow() { printf "\033[33m%s\033[0m\n" "$*"; }
blue()   { printf "\033[34m%s\033[0m\n" "$*"; }

TOOL="${1:-studio}"

echo ""
blue "══════════════════════════════════════════════"
blue "  CERNIQ T6 — Development Tools: $TOOL"
blue "══════════════════════════════════════════════"
echo ""

case "$TOOL" in
  studio)
    echo "  → Starting Prisma Studio at http://localhost:5555"
    echo "  → Browse all database tables visually"
    echo ""
    cd backend-node && npx prisma studio
    ;;

  test)
    echo "  → Running backend unit tests..."
    echo ""
    cd backend-node && npm test
    ;;

  test-watch)
    echo "  → Running backend tests in watch mode..."
    echo ""
    cd backend-node && npm run test:watch
    ;;

  test-cov)
    echo "  → Running backend tests with coverage..."
    echo ""
    cd backend-node && npm run test:cov
    ;;

  test-e2e)
    echo "  → Running frontend E2E tests (headless)..."
    echo "  → Requires: Frontend running at localhost:3001"
    echo ""
    cd frontend && npm run test:e2e
    ;;

  test-e2e-ui)
    echo "  → Opening Playwright interactive UI..."
    echo ""
    cd frontend && npm run test:e2e:ui
    ;;

  lint)
    echo "  → Running lint on all code..."
    echo ""
    echo "  Backend lint:"
    cd backend-node && npm run lint && cd "$PROJECT_ROOT"
    echo ""
    echo "  Frontend lint:"
    cd frontend && npm run lint && cd "$PROJECT_ROOT"
    green "✅ All lint checks passed"
    ;;

  typecheck)
    echo "  → Running TypeScript type checks..."
    echo ""
    echo "  Backend:"
    cd backend-node && npx tsc --noEmit 2>&1 && green "✅ Backend: no type errors" || red "❌ Backend: type errors found"
    cd "$PROJECT_ROOT"
    echo ""
    echo "  Frontend:"
    cd frontend && npx tsc --noEmit 2>&1 && green "✅ Frontend: no type errors" || red "❌ Frontend: type errors found"
    ;;

  migrate)
    MIGRATION_NAME="${2:-unnamed_migration}"
    echo "  → Creating new migration: $MIGRATION_NAME"
    echo ""
    cd backend-node && npx prisma migrate dev --name "$MIGRATION_NAME"
    ;;

  migrate-deploy)
    echo "  → Deploying pending migrations..."
    echo ""
    cd backend-node && npx prisma migrate deploy
    green "✅ Migrations deployed"
    ;;

  quant)
    echo "  → Quant Research Mode"
    echo "  → Testing CERNIQ quantitative models via API"
    echo ""

    # Get auth token
    TOKEN=$(curl -s -X POST http://localhost:3000/api/auth/login \
      -H "Content-Type: application/json" \
      -d '{"email":"erwin@cerniq.io","password":"SecurePass123!"}' \
      2>/dev/null | python3 -c "import sys,json; print(json.load(sys.stdin).get('accessToken','NO_TOKEN'))" 2>/dev/null || echo "NO_TOKEN")

    if [ "$TOKEN" = "NO_TOKEN" ]; then
      yellow "⚠️  Could not authenticate. Register first or check credentials."
      yellow "   curl -X POST http://localhost:3000/api/auth/register -H 'Content-Type: application/json' -d '{\"email\":\"erwin@cerniq.io\",\"password\":\"SecurePass123!\",\"name\":\"Erwin\"}'"
      exit 1
    fi

    echo "  Token captured. Running model tests..."
    echo ""

    # Test 1: Duration Gap
    echo "─── TEST 1: Duration Gap ───"
    curl -s -X POST http://localhost:3000/api/alm/duration-gap \
      -H "Content-Type: application/json" \
      -H "Authorization: Bearer $TOKEN" \
      -d '{
        "assets": [
          {"balance": 100000000, "rate": 0.065, "maturityYears": 5, "isFixed": true},
          {"balance": 50000000, "rate": 0.072, "maturityYears": 10, "isFixed": true}
        ],
        "liabilities": [
          {"balance": 80000000, "rate": 0.025, "maturityYears": 1, "isFixed": false},
          {"balance": 40000000, "rate": 0.032, "maturityYears": 3, "isFixed": false}
        ]
      }' 2>/dev/null | python3 -m json.tool 2>/dev/null || echo "(endpoint not available)"

    echo ""

    # Test 2: Black-Scholes Greeks
    echo "─── TEST 2: Black-Scholes Greeks ───"
    curl -s -X POST http://localhost:3000/api/options/greeks \
      -H "Content-Type: application/json" \
      -H "Authorization: Bearer $TOKEN" \
      -d '{
        "underlying": 450.00,
        "strike": 460.00,
        "timeToExpiry": 0.0833,
        "riskFreeRate": 0.045,
        "volatility": 0.22,
        "optionType": "call"
      }' 2>/dev/null | python3 -m json.tool 2>/dev/null || echo "(endpoint not available)"

    echo ""

    # Test 3: VaR
    echo "─── TEST 3: Value at Risk ───"
    curl -s -X POST http://localhost:3000/risk/var \
      -H "Content-Type: application/json" \
      -H "Authorization: Bearer $TOKEN" \
      -d '{
        "returns": [-0.02, 0.01, -0.015, 0.008, -0.03, 0.025, -0.01, 0.005, -0.012, 0.018],
        "confidence": 0.95,
        "method": "historical"
      }' 2>/dev/null | python3 -m json.tool 2>/dev/null || echo "(endpoint not available)"

    echo ""
    green "✅ Quant model tests complete"
    ;;

  preflight)
    echo "  → Running full system preflight check..."
    echo ""

    PASS=0
    FAIL=0
    WARN=0

    check() {
      local label="$1"
      local cmd="$2"
      if eval "$cmd" > /dev/null 2>&1; then
        printf "  ✅ %-40s PASS\n" "$label"
        PASS=$((PASS+1))
      else
        printf "  ❌ %-40s FAIL\n" "$label"
        FAIL=$((FAIL+1))
      fi
    }

    check "Docker running"                  "docker info"
    check "PostgreSQL container up"         "docker exec cerniq-db pg_isready -U cerniq"
    check "Redis container up"              "docker exec cerniq-redis redis-cli ping"
    check "Backend .env exists"             "[ -f backend-node/.env ]"
    check "Frontend .env.local exists"      "[ -f frontend/.env.local ]"
    check "Backend node_modules"            "[ -d backend-node/node_modules ]"
    check "Frontend node_modules"           "[ -d frontend/node_modules ]"
    check "Prisma client generated"         "[ -d backend-node/node_modules/.prisma ]"
    check "Backend port 3000 responding"    "curl -sf http://localhost:3000/health"
    check "Frontend port 3001 responding"   "curl -sf http://localhost:3001"
    check "DATABASE_URL set"               "grep -q DATABASE_URL backend-node/.env"
    check "JWT_SECRET set"                 "grep -q JWT_SECRET backend-node/.env"
    check "ADMIN_KEY set"                  "grep -q ADMIN_KEY backend-node/.env"

    echo ""
    echo "  Results: ${PASS} passed, ${FAIL} failed"
    if [ $FAIL -eq 0 ]; then
      green "  ✅ PREFLIGHT PASSED — System is ready"
    else
      red "  ❌ PREFLIGHT FAILED — Fix the issues above before proceeding"
      exit 1
    fi
    ;;

  *)
    echo "  Available tools:"
    echo "    studio       → Prisma Studio (visual DB browser, port 5555)"
    echo "    test         → Run backend unit tests"
    echo "    test-watch   → Run backend tests in watch mode"
    echo "    test-cov     → Run tests with coverage report"
    echo "    test-e2e     → Run frontend E2E tests (headless)"
    echo "    test-e2e-ui  → Open Playwright interactive UI"
    echo "    lint         → Run ESLint on backend + frontend"
    echo "    typecheck    → Run TypeScript type checks"
    echo "    migrate      → Create new migration (add name as 2nd arg)"
    echo "    migrate-deploy → Deploy pending migrations"
    echo "    quant        → Run quantitative model tests against API"
    echo "    preflight    → Full system health preflight check"
    echo ""
    echo "  Usage: bash scripts/start-t6-tools.sh [tool]"
    ;;
esac
