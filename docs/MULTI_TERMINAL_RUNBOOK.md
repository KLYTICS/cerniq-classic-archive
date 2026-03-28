# CERNIQ — Multi-Terminal Enterprise Runbook
## 5+ Terminal Development & Operations Guide

> **Purpose:** Step-by-step instructions for running CERNIQ across 5–7 terminal windows for full-stack development, testing, and production operations.
> **Updated:** March 2026

---

## OVERVIEW

Running CERNIQ enterprise-quality requires 5+ dedicated terminal windows. Each terminal has a single responsibility. This ensures clean separation, easy debugging, and the ability to restart any layer independently.

```
┌─────────────────────────────────────────────────────────────────┐
│                    CERNIQ TERMINAL LAYOUT                        │
├──────────────────┬──────────────────┬───────────────────────────┤
│  T1: DATABASE    │  T2: BACKEND     │  T3: FRONTEND             │
│  Postgres+Redis  │  NestJS API      │  Next.js UI               │
│  :5433 :6380     │  :3000           │  :3001                    │
├──────────────────┼──────────────────┼───────────────────────────┤
│  T4: OUTBOUND    │  T5: MONITOR     │  T6: DEV TOOLS (opt)      │
│  Python FastAPI  │  Logs + Health   │  Prisma Studio / Tests    │
│  :8002           │  Continuous poll │  :5555                    │
└──────────────────┴──────────────────┴───────────────────────────┘
```

**Startup order is critical:**
```
T1 (DB) → T2 (Backend) → T3 (Frontend) → T4 (Outbound) → T5 (Monitor) → T6 (Tools)
```

---

## PRE-FLIGHT CHECKLIST

Before opening any terminal, verify:

```bash
# 1. Docker is running
docker info > /dev/null 2>&1 && echo "✅ Docker running" || echo "❌ Start Docker"

# 2. Node.js is available
node --version && echo "✅ Node.js OK" || echo "❌ Install Node.js 20+"

# 3. Python is available
python3 --version && echo "✅ Python OK" || echo "❌ Install Python 3.10+"

# 4. Environment files exist
[ -f "backend-node/.env" ] && echo "✅ Backend .env" || echo "⚠️  cp backend-node/.env.example backend-node/.env"
[ -f "frontend/.env.local" ] && echo "✅ Frontend .env.local" || echo "⚠️  cp frontend/.env.example frontend/.env.local"
[ -f "services/outbound/.env" ] && echo "✅ Outbound .env" || echo "⚠️  cp services/outbound/.env.example services/outbound/.env"

# 5. Critical env vars are set
source backend-node/.env 2>/dev/null
[ -n "$DATABASE_URL" ] && echo "✅ DATABASE_URL set" || echo "❌ Set DATABASE_URL"
[ -n "$JWT_SECRET" ] && echo "✅ JWT_SECRET set" || echo "❌ Set JWT_SECRET"
[ -n "$ADMIN_KEY" ] && echo "✅ ADMIN_KEY set" || echo "❌ Set ADMIN_KEY"
[ -n "$REDIS_URL" ] && echo "✅ REDIS_URL set" || echo "❌ Set REDIS_URL"

# 6. Frontend API URL is set
grep -q "NEXT_PUBLIC_NODE_API_URL" frontend/.env.local 2>/dev/null \
  && echo "✅ NEXT_PUBLIC_NODE_API_URL set" \
  || echo "❌ Add NEXT_PUBLIC_NODE_API_URL=http://localhost:3000 to frontend/.env.local"
```

---

## TERMINAL 1 — DATA LAYER

**Role:** PostgreSQL 15 + Redis 7 — start first, shut down last.

> Both dev and prod compose use `postgres:15-alpine` with user `cerniq` / database `cerniq`.
> If you have volumes from an older compose config (e.g., using `capexcycle`), run
> `docker compose down -v` to recreate them — the `POSTGRES_USER` only applies on first init.

```bash
# ─── STEP 1: Navigate to project root ───
cd ~/Desktop/Cerniq   # or wherever your project lives

# ─── STEP 2: Start database and cache ───
docker compose up -d postgres redis

# ─── STEP 3: Verify both services are healthy ───
echo "Waiting for PostgreSQL..."
until docker exec cerniq-db pg_isready -U cerniq 2>/dev/null; do sleep 1; done
echo "✅ PostgreSQL ready"

echo "Checking Redis..."
docker exec cerniq-redis redis-cli ping && echo "✅ Redis ready"

# ─── STEP 4: Run migrations (first time or after schema changes) ───
cd backend-node && npx prisma migrate deploy && cd ..

# ─── STEP 5: Seed demo data (first time only — populates tickers table) ───
# cd backend-node && npx prisma db seed && cd ..
# Seeds ~55 tickers (stocks, ETFs, futures, crypto) for market data features

# ─── STEP 6: Follow logs (keep this running) ───
docker compose logs -f postgres redis
```

**Verify:**
```bash
# DB accessible
docker exec cerniq-db psql -U cerniq -d cerniq -c "\dt" | head -20

# Redis accessible
docker exec cerniq-redis redis-cli info server | grep redis_version
```

**Common issues:**
| Error | Cause | Fix |
|---|---|---|
| `password authentication failed` | Wrong user in command | Dev compose uses `POSTGRES_USER=cerniq` / `POSTGRES_DB=cerniq` — use `-U cerniq` in all psql/pg_isready commands |
| `Error: connect ECONNREFUSED 127.0.0.1:6379` | Redis on 6380 but env says 6379 | Set `REDIS_URL=redis://localhost:6380` in backend .env |
| `relation "users" does not exist` | Migrations not run | Run `npx prisma migrate deploy` from backend-node/ |

---

## TERMINAL 2 — BACKEND API

**Role:** NestJS 11 API server — the brain of CERNIQ.

```bash
# ─── STEP 1: Navigate to backend ───
cd ~/Desktop/Cerniq/backend-node

# ─── STEP 2: Install dependencies (first time) ───
npm ci --legacy-peer-deps

# ─── STEP 3: Generate Prisma client ───
npx prisma generate

# ─── STEP 4: Start development server ───
npm run start:dev

# ─── OR start production build ───
# npm run build && npm run start:prod
```

**Expected startup output:**
```
[Nest] LOG [NestApplication] Mapped {/health, GET}
[Nest] LOG [NestApplication] Mapped {/api/auth/login, POST}
[Nest] LOG [NestApplication] Mapped {/api/alm/institutions, GET}
... (many more route mappings)
[Nest] LOG [NestApplication] Nest application successfully started +Xms
[Nest] LOG Application is running on: http://localhost:3000
```

**Verify (run in a new tab):**
```bash
# Health check
curl -s http://localhost:3000/health | python3 -m json.tool

# Expected shape (wrapped by ResponseEnvelopeInterceptor):
{
  "success": true,
  "data": {
    "status": "ok",
    "db": "connected",
    "memoryPercent": 2,
    "memorySource": "container",
    "memory": {
      "heapUsedMB": 83,
      "heapTotalMB": 87,
      "rssMB": 156,
      "limitMB": 7629,
      "heapPercent": 95,
      "rssPercent": 2
    },
    "version": "2.0.0",
    "uptime": 66254,
    "timestamp": "2026-03-28T...",
    "services": {
      "api": "up",
      "database": "up",
      "cache": "up",
      "marketData": "healthy"
    }
  }
}

# Readiness probe
curl -s http://localhost:3000/ready | python3 -m json.tool
```

**Common issues:**
| Error | Cause | Fix |
|---|---|---|
| `Cannot connect to database` | DB not started or wrong DATABASE_URL | Start Terminal 1 first; check `.env` DATABASE_URL |
| `Cannot connect to Redis` | Redis not started or wrong port | Check `.env` REDIS_URL matches compose port (6380) |
| `Module build failed` | Missing env vars | Check all required vars in `.env` |
| Port 3000 already in use | Another process | `lsof -ti :3000 \| xargs kill -9` |

---

## TERMINAL 3 — FRONTEND

**Role:** Next.js 16 UI — the customer-facing interface.

```bash
# ─── STEP 1: Navigate to frontend ───
cd ~/Desktop/Cerniq/frontend

# ─── STEP 2: Install dependencies (first time) ───
bun install
# OR: npm ci

# ─── STEP 3: Configure environment ───
# Verify .env.local has:
# NEXT_PUBLIC_NODE_API_URL=http://localhost:3000
# NEXT_PUBLIC_APP_URL=http://localhost:3001

# ─── STEP 4: Start development server ───
npm run dev          # runs on port 3001 (configured in package.json)
# OR: bun dev        # also uses --port 3001 from package.json
```

**Expected startup output:**
```
  ▲ Next.js 16.x.x
  - Local:        http://localhost:3001
  - Network:      http://0.0.0.0:3001

 ✓ Starting...
 ✓ Ready in 2.1s
```

**Key URLs to verify:**
```bash
# Landing page
curl -sI http://localhost:3001 | head -5

# Demo page
open http://localhost:3001/demo?type=cooperativa

# ALM dashboard (requires login)
open http://localhost:3001/alm

# Admin panel
open http://localhost:3001/admin
```

**Common issues:**
| Error | Cause | Fix |
|---|---|---|
| `NEXT_PUBLIC_NODE_API_URL is undefined` | Missing env.local | Copy .env.example → .env.local |
| API calls returning 404 | Wrong API URL in .env.local | Set to `http://localhost:3000` |
| Build fails on TypeScript | Type errors | Run `npx tsc --noEmit` to see errors |

---

## TERMINAL 4 — OUTBOUND ENGINE

**Role:** Python autonomous sales agent — cooperativa outreach pipeline.

> **Note:** The outbound engine uses SMTP for email delivery and Hunter/Apollo/Clearbit
> for lead enrichment. It does NOT use OpenAI or SendGrid — those are separate services.

```bash
# ─── STEP 1: Navigate to outbound service ───
cd ~/Desktop/Cerniq/services/outbound

# ─── STEP 2: Set up Python environment (first time) ───
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# ─── STEP 3: Activate environment (subsequent runs) ───
source venv/bin/activate

# ─── STEP 4: Configure environment (first time) ───
cp .env.example .env
# Edit .env — at minimum set SMTP credentials for email delivery.
# Enrichment API keys (Hunter, Apollo, Clearbit) are optional — agents
# degrade gracefully without them.

# ─── STEP 5: Start the FastAPI server ───
uvicorn app:app --host 0.0.0.0 --port 8002 --reload

# ─── OR run the daily pipeline manually ───
python3 pipelines/daily_outreach_pipeline.py

# ─── OR run lead ingestion ───
python3 pipelines/lead_ingestion_pipeline.py
```

> **Port note:** The config.py default is `8099`, but this runbook standardizes on `8002`
> via the explicit `--port 8002` flag above. The port table and all curl examples use `8002`.

**Expected startup output:**
```
INFO:     Started server process [XXXXX]
INFO:     Waiting for application startup.
INFO:     Application startup complete.
INFO:     Uvicorn running on http://0.0.0.0:8002
```

**Verify:**
```bash
# Health check
curl http://localhost:8002/health

# API docs (interactive)
open http://localhost:8002/docs

# Seed cooperativa data then list leads
curl -X POST http://localhost:8002/leads/seed | python3 -m json.tool
curl http://localhost:8002/leads | python3 -m json.tool

# Pipeline metrics
curl http://localhost:8002/metrics | python3 -m json.tool
```

**Running specific agent:**
```bash
# Test messaging agent (generate one bilingual email)
python3 -c "
from agents.messaging_agent import MessagingAgent
agent = MessagingAgent()
result = agent.generate_email(
    institution_name='CoopAhorro Mayaguez',
    contact_name='Ana Rivera',
    language='es',
    key_insight='Su cooperativa tiene una brecha de duración de +2.1 años.'
)
print(result)
"
```

---

## TERMINAL 5 — MONITORING

**Role:** Real-time log watching, health checks, and system telemetry.

```bash
# ─── Option A: Simple continuous health monitor ───
while true; do
  clear
  echo "═══════════════════════════════════════════"
  echo "  CERNIQ System Status — $(date '+%Y-%m-%d %H:%M:%S')"
  echo "═══════════════════════════════════════════"

  # Backend health
  HEALTH=$(curl -s --max-time 5 http://localhost:3000/health 2>/dev/null || echo '{"status":"unreachable"}')
  # Unwrap ResponseEnvelopeInterceptor: { success, data: { ... } }
  STATUS=$(echo $HEALTH | python3 -c "import sys,json; r=json.load(sys.stdin); d=r.get('data',r); print(d.get('status','?'))" 2>/dev/null)
  DB=$(echo $HEALTH | python3 -c "import sys,json; r=json.load(sys.stdin); d=r.get('data',r); print(d.get('db','?'))" 2>/dev/null)
  MEM=$(echo $HEALTH | python3 -c "import sys,json; r=json.load(sys.stdin); d=r.get('data',r); print(d.get('memoryPercent','?'))" 2>/dev/null)

  echo "  Backend:  ${STATUS:-unknown}"
  echo "  Database: ${DB:-unknown}"
  echo "  Memory:   ${MEM:-?}%"

  # Frontend health
  FE_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 http://localhost:3001 2>/dev/null || echo "000")
  echo "  Frontend: HTTP $FE_CODE"

  # Docker containers
  echo ""
  echo "  Docker Containers:"
  docker ps --format "  {{.Names}}: {{.Status}}" 2>/dev/null | grep -E "cerniq|capexcycle" || echo "  (No containers running)"

  echo "═══════════════════════════════════════════"
  sleep 30
done
```

```bash
# ─── Option B: Follow backend logs ───
cd ~/Desktop/Cerniq/backend-node
npm run start:dev 2>&1 | grep -E "ERROR|WARN|LOG" | grep -v "Nest"

# ─── Option C: Follow Docker logs ───
cd ~/Desktop/Cerniq
docker compose logs -f --tail=50 2>&1 | grep -E "ERROR|FATAL|error|failed"

# ─── Option D: Run production health check script ───
bash ~/Desktop/Cerniq/scripts/health-check.sh http://localhost:3000 http://localhost:3001

# ─── Option E: Railway production logs (if deployed) ───
railway logs --service backend-node --tail 200 -f
```

**Alert thresholds to watch for:**
```
ERROR: Cannot connect to database
ERROR: Redis connection failed
ERROR: Report job FAILED
WARN:  Memory usage exceeds 80%
ERROR: Stripe webhook verification failed
ERROR: PDF generation failed
```

---

## TERMINAL 6 — DEVELOPMENT TOOLS (Optional)

**Role:** Prisma Studio, tests, lint, type-check — switch between as needed.

```bash
# ─── Prisma Studio (visual DB browser) ───
cd ~/Desktop/Cerniq/backend-node
npx prisma studio
# Opens http://localhost:5555 in browser

# ─── OR: Run backend unit tests ───
cd ~/Desktop/Cerniq/backend-node
npm test
# Or with watch mode:
npm run test:watch
# Or with coverage:
npm run test:cov

# ─── OR: Run E2E tests ───
cd ~/Desktop/Cerniq/frontend
npm run test:e2e          # headless
npm run test:e2e:ui       # interactive Playwright UI

# ─── OR: TypeScript type check ───
cd ~/Desktop/Cerniq/backend-node && npx tsc --noEmit
cd ~/Desktop/Cerniq/frontend && npx tsc --noEmit

# ─── OR: Lint all code ───
cd ~/Desktop/Cerniq
make lint

# ─── OR: Apply a new migration ───
cd ~/Desktop/Cerniq/backend-node
npx prisma migrate dev --name "add_model_registry_table"

# ─── OR: Open database CLI ───
docker exec -it cerniq-db psql -U cerniq -d cerniq
```

---

## TERMINAL 7 — QUANT RESEARCH (Optional)

**Role:** Ad-hoc API testing, model validation, data exploration.

```bash
# ─── Set token for authenticated calls ───
cd ~/Desktop/Cerniq

# Register (first time)
curl -s -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"erwin@cerniq.io","password":"SecurePass123!","name":"Erwin"}' \
  | python3 -m json.tool

# Login and capture token from Set-Cookie header
# Auth response sets HttpOnly cookies; extract access_token from cookie jar
COOKIE_JAR="/tmp/cerniq-cookies.txt"
curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"erwin@cerniq.io","password":"SecurePass123!"}' \
  -c "$COOKIE_JAR" | python3 -m json.tool

TOKEN=$(grep "access_token" "$COOKIE_JAR" 2>/dev/null | awk '{print $NF}')
echo "Token captured: ${TOKEN:0:40}..."
export TOKEN=$TOKEN
export COOKIE_JAR=$COOKIE_JAR

# For subsequent requests, use either -b cookie jar or -H Authorization:
# Option A (cookies): curl -b "$COOKIE_JAR" ...
# Option B (bearer):  curl -H "Authorization: Bearer $TOKEN" ...

# ─── Test ALM: Duration Gap ───
curl -s -X POST http://localhost:3000/api/alm/duration-gap \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "balanceSheet": {
      "assets": [
        {"balance": 100000000, "rate": 0.065, "maturityYears": 5, "isFixed": true},
        {"balance": 50000000,  "rate": 0.072, "maturityYears": 10, "isFixed": true},
        {"balance": 30000000,  "rate": 0.045, "maturityYears": 0.5, "isFixed": false}
      ],
      "liabilities": [
        {"balance": 80000000,  "rate": 0.025, "maturityYears": 1, "isFixed": false},
        {"balance": 60000000,  "rate": 0.032, "maturityYears": 3, "isFixed": false}
      ],
      "equity": 40000000
    }
  }' | python3 -m json.tool

# ─── Test Risk: Monte Carlo VaR ───
curl -s -X POST http://localhost:3000/api/risk/monte-carlo \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "portfolioValue": 10000000,
    "volatility": 0.15,
    "timeHorizonDays": 252,
    "numSimulations": 1000,
    "confidenceLevel": 0.95
  }' | python3 -m json.tool

# ─── Test Options: Black-Scholes Greeks ───
curl -s -X POST http://localhost:3000/api/options/calculate \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "underlying": 450.00,
    "strike": 460.00,
    "timeToExpiry": 0.0833,
    "riskFreeRate": 0.045,
    "volatility": 0.22,
    "optionType": "call"
  }' | python3 -m json.tool

# ─── Test Options: Implied Volatility ───
curl -s -X POST http://localhost:3000/api/options/implied-volatility \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "ticker": "AAPL",
    "strike": 460.00,
    "expiration": "2026-06-21",
    "optionType": "call",
    "marketPrice": 8.50
  }' | python3 -m json.tool

# ─── Test Admin Stats ───
ADMIN_KEY=$(grep ADMIN_KEY backend-node/.env | cut -d= -f2)
curl -s -H "x-admin-key: $ADMIN_KEY" http://localhost:3000/api/admin/stats | python3 -m json.tool
# Returns: { demoRequests, institutions, users, recentUsers, prospects }

# ─── Test Admin Ops ───
curl -s -H "x-admin-key: $ADMIN_KEY" http://localhost:3000/api/admin/ops | python3 -m json.tool

# ─── Trigger daily pipeline manually ───
curl -s -X POST -H "x-admin-key: $ADMIN_KEY" http://localhost:3000/api/admin/run-pipeline | python3 -m json.tool

# ─── Full cooperativa demo flow ───
# 1. Create institution
INSTITUTION=$(curl -s -X POST http://localhost:3000/api/alm/institutions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"name":"CoopAhorro San Juan","type":"cooperativa","totalAssets":250000000,"currency":"USD","regulatoryBody":"COSSEC"}')

INST_ID=$(echo $INSTITUTION | python3 -c "import sys,json; print(json.load(sys.stdin).get('id',''))")
echo "Institution ID: $INST_ID"

# 2. Run full ALM analysis
curl -s -X POST http://localhost:3000/api/alm/analysis/run \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "{\"institutionId\": \"$INST_ID\"}" | python3 -m json.tool
```

---

## FULL SYSTEM STARTUP SEQUENCE

Use this sequence when starting from cold (everything off):

```bash
# ─── ONE-LINE FULL START (using Makefile) ───
cd ~/Desktop/Cerniq && make dev
# ⚠️  Note: `make dev` backgrounds the backend with `&` and runs the frontend
# in the foreground. This works for quick starts but you lose separate log
# streams. For debugging, use the full multi-terminal approach below.

# ─── OR manual sequence (recommended for development) ───

# Step 1: Start data layer (background)
cd ~/Desktop/Cerniq && docker compose up -d postgres redis
sleep 5

# Step 2: Run migrations
cd backend-node && npx prisma migrate deploy && cd ..

# Step 3: Start backend (in Terminal 2)
cd backend-node && npm run start:dev

# Step 4: Start frontend (in Terminal 3, after backend is up)
cd frontend && npm run dev

# Step 5: Verify everything
bash scripts/health-check.sh http://localhost:3000 http://localhost:3001
```

---

## FULL SYSTEM SHUTDOWN SEQUENCE

```bash
# ─── Graceful shutdown ───

# 1. Stop frontend (Ctrl+C in Terminal 3)
# 2. Stop backend (Ctrl+C in Terminal 2)
# 3. Stop outbound engine (Ctrl+C in Terminal 4)
# 4. Stop data layer
cd ~/Desktop/Cerniq && docker compose down

# ─── Nuclear option (everything) ───
docker compose down -v   # WARNING: -v removes volumes (data!)
# Only use -v if you want to reset the database entirely
```

---

## PRODUCTION OPERATIONS COMMANDS

```bash
# ─── Production health check ───
bash ~/Desktop/Cerniq/scripts/health-check.sh https://api.cerniq.io https://cerniq.io

# ─── Deploy backend to Railway ───
cd ~/Desktop/Cerniq/backend-node
railway up

# ─── Deploy frontend to Vercel ───
cd ~/Desktop/Cerniq/frontend
vercel --prod

# ─── Run production migrations ───
railway run --service backend-node npx prisma migrate deploy

# ─── Stream production backend logs ───
railway logs --service backend-node --tail 200 -f

# ─── Check production DB (Railway Postgres) ───
railway connect --service postgres

# ─── Admin stats on production ───
ADMIN_KEY=<your_prod_admin_key>
curl -H "x-admin-key: $ADMIN_KEY" https://api.cerniq.io/api/admin/stats | python3 -m json.tool

# ─── Admin ops on production ───
curl -H "x-admin-key: $ADMIN_KEY" https://api.cerniq.io/api/admin/ops | python3 -m json.tool

# ─── Trigger pipeline on production ───
curl -X POST -H "x-admin-key: $ADMIN_KEY" https://api.cerniq.io/api/admin/run-pipeline | python3 -m json.tool
```

---

## PORT REFERENCE TABLE

| Terminal | Service | Internal Port | External/Local Port | URL |
|---|---|---|---|---|
| T1 | PostgreSQL 15 | 5432 | 5433 | `localhost:5433` |
| T1 | Redis 7 | 6379 | 6380 | `localhost:6380` |
| T2 | NestJS Backend | 3000 | 3000 | `http://localhost:3000` |
| T3 | Next.js 16 Frontend | 3001 | 3001 | `http://localhost:3001` |
| T4 | Python FastAPI | 8002 | 8002 | `http://localhost:8002` |
| T6 | Prisma Studio | 5555 | 5555 | `http://localhost:5555` |

---

## ENVIRONMENT FILES REFERENCE

| File | Purpose | Source |
|---|---|---|
| `backend-node/.env` | NestJS API runtime config | `cp backend-node/.env.example backend-node/.env` — fill in secrets |
| `frontend/.env.local` | Next.js public + private env | `cp frontend/.env.example frontend/.env.local` — set API URL + keys |
| `services/outbound/.env` | Python outbound agent config | `cp services/outbound/.env.example services/outbound/.env` — set SMTP + enrichment keys |
| `.env` (root) | Docker compose env vars | Rarely needed; `docker-compose.yml` has defaults |

---

## TROUBLESHOOTING QUICK REFERENCE

```bash
# ─── "Backend won't start" ───
cd backend-node
cat .env | grep DATABASE_URL    # verify connection string
npx prisma generate              # regenerate Prisma client
npm ci --legacy-peer-deps        # reinstall deps

# ─── "Frontend can't reach API" ───
grep NEXT_PUBLIC_NODE_API_URL frontend/.env.local
# Should be: http://localhost:3000
# If this var is missing entirely, the next.config.ts rewrites will break silently

# ─── "Database connection refused" ───
docker ps | grep cerniq-db      # Is container running?
docker compose up -d postgres   # If not, start it
docker logs cerniq-db           # Check for startup errors

# ─── "Prisma: P1001 Can't reach database" ───
# 1. Verify container: docker ps
# 2. Verify port: docker port cerniq-db
# 3. Verify .env DATABASE_URL port matches compose (5433 external)

# ─── "Redis connection failed" ───
docker exec cerniq-redis redis-cli ping
# If fails: docker compose restart redis

# ─── "Report job stuck in PROCESSING" ───
# Check backend logs for PDF generation errors
# Verify R2_* env vars are set (cloud storage)
# Check pipeline worker logs

# ─── "Admin endpoints returning 401" ───
echo $ADMIN_KEY    # Should be set
# Set in backend-node/.env: ADMIN_KEY=your_secret
# Pass as header: -H "x-admin-key: $ADMIN_KEY"

# ─── "OAuth returning error" ───
# Verify GOOGLE_CALLBACK_URL or GITHUB_CALLBACK_URL
# Must match configured redirect URI in OAuth app settings

# ─── "PDF not generating" ───
# PDFKit requires no external service - should always work
# Check: R2 credentials if trying to upload
# Check: RESEND_API_KEY if email notification fails

# ─── "Token expired / 401 on authenticated calls" ───
# Re-login and capture new token from cookie:
COOKIE_JAR="/tmp/cerniq-cookies.txt"
curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"your@email.com","password":"yourpassword"}' \
  -c "$COOKIE_JAR" > /dev/null
TOKEN=$(grep "access_token" "$COOKIE_JAR" 2>/dev/null | awk '{print $NF}')
```

---

*Last updated: March 27, 2026*
*Part of: CERNIQ Enterprise Documentation Suite*
*See also: docs/CERNIQ_MASTER_PLAYBOOK.md, docs/ops/deployment_runbook.md*
