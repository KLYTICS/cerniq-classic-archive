# Part XI — Engineering Onboarding & Operational Runbooks

> **Audience:** All engineers (new + existing)
> **Last updated:** April 2026

---

## 11.1 Day 1 — Web Platform Setup

### Prerequisites
- Node.js 20+ and npm
- Docker Desktop (for PostgreSQL + Redis)
- Git access to `github.com/monykiss/cerniq`

### Step-by-Step
```bash
# 1. Clone
git clone https://github.com/monykiss/cerniq.git
cd cerniq

# 2. Configure environment
cp .env.example .env
# Fill in values — ask team lead for:
# - STRIPE_SECRET_KEY (test)
# - OPENAI_API_KEY
# - SUPABASE_URL + SUPABASE_ANON_KEY
# - CLOUDFLARE_R2_* credentials

# 3. Start infrastructure
docker compose up -d postgres redis
# Postgres available on :5433 | Redis on :6380

# 4. Backend setup
cd backend-node
npm install --legacy-peer-deps
npx prisma migrate dev          # Apply all migrations
npx prisma generate             # Generate Prisma client
npm run start:dev               # Hot-reload server on :3000

# 5. Verify backend
curl http://localhost:3000/health
# → { "status": "ok", "database": "connected", "redis": "connected" }

# 6. Frontend setup (new terminal)
cd frontend
npm install
npm run dev                     # Dev server on :3001

# 7. Open
open http://localhost:3001      # Web app
open http://localhost:5555      # Prisma Studio (run: npx prisma studio)
```

### First smoke test
1. Register a new account at `http://localhost:3001/signup`
2. Navigate to `/portal/submit`
3. Upload `test_data/portal-submit-fixture.csv`
4. Verify dry-run preview renders
5. Confirm submission → check ReportJob created in Prisma Studio

---

## 11.2 Day 1 — Apple Platform Setup

### Prerequisites
- Swift 6.3+ Command Line Tools: `swift --version`
- Xcode 16+ (for full app targets — optional for SPM-only work)

```bash
# 1. Verify Swift
swift --version
# → swift-driver version: 1.x Swift version: 6.x

# 2. Build SPM package
cd apple
swift build
# → Build complete! (All 6 targets)

# 3. Run contract verification
swift run CerniqContractsCheck
# → CerniqContractsCheck passed

# 4. (Xcode required) Open the project
open CerniqApple/CerniqApple.xcodeproj
# Select "CERNIQ macOS" scheme → Run → native launchpad opens
# Select "CERNIQ iOS" scheme → Select simulator → Run
```

### Connecting to local backend
In the macOS app (Xcode run):
1. The launchpad shows the Environment Card
2. Select **Local** in the segmented picker
3. The app now points to `http://localhost:3001`
4. Tap Portal → see your local Next.js frontend in WKWebView

In the SPM shell (`swift run CerniqMacApp`):
- Uses `PreviewWorkspaceOverviewService` — shows sample data (no network calls)
- Swap to `LiveWorkspaceOverviewService` in `CerniqMacApp.swift` to test against live API

---

## 11.3 Make Commands Reference

All commands run from repo root:

```bash
make dev            # Start DB + backend + frontend
make prod           # Build production Docker images
make test           # Backend Jest unit tests
make test-e2e       # Playwright E2E tests (requires dev server running)
make migrate        # Run Prisma migrations
make health         # Check backend health endpoint
make lint           # Lint backend + frontend (ESLint)
make db-studio      # Open Prisma Studio on :5555
make deploy         # Deploy backend (Railway) + frontend (Vercel)
make clean          # Remove .next, dist, node_modules caches
```

---

## 11.4 npm Scripts Reference

### Root (`package.json`)
```bash
npm run build                    # Build frontend (rm lock + next build)
npm run verify:frontend          # lint + test + coverage + build + clean check
npm run verify:backend           # eslint + tsc + prisma + test + build + clean check
npm run verify:local:critical    # Full E2E critical path (deploy gate)
npm run smoke:production         # Smoke test live cerniq.io + api.cerniq.io
npm run cerniq:status            # Platform status report
npm run cerniq:cross             # Cross-service health check
```

### Backend (`backend-node/package.json`)
```bash
npm run start:dev          # Hot-reload NestJS on :3000
npm run start:prod         # Production start (compiled dist/)
npm run build              # TypeScript → dist/
npm test                   # Jest unit tests
npm run test:cov           # Test + LCOV coverage report
npm run seed:portal-submit # E2E seed: user + sub + report job + magic link + CSV
npm run lint               # ESLint
```

### Frontend (`frontend/package.json`)
```bash
npm run dev                # Next.js dev server on :3001 (Turbopack)
npm run build              # Production build
npm run lint               # ESLint
npx vitest run             # Unit tests (Vitest)
npm run test:coverage      # Unit tests + coverage
npm run test:e2e           # All Playwright E2E tests
npm run test:e2e:critical  # Critical path only
npm run test:e2e:production # Smoke test against live cerniq.io
```

### Apple (`apple/`)
```bash
swift build                # Build all SPM targets
swift run CerniqMacApp     # Run macOS SwiftUI shell (SPM-based)
swift run CerniqContractsCheck  # Contract verification
swift test                 # Unit tests (requires XCTest availability)
```

---

## 11.5 Session Coordination System

CERNIQ uses a custom session management system for multi-engineer parallel development (and AI agent fleet coordination):

```bash
npm run session:register   # Register a new work session with task description
npm run session:claim      # Claim an available session slot
npm run session:release    # Release session on task completion
npm run session:handoff    # Hand off session context to another engineer/agent
npm run session:status     # List all active sessions
npm run session:list       # List available sessions
```

**Session lifecycle:**
```
register → claim → (work) → release
                  └→ handoff (if incomplete)
```

Sessions prevent two engineers from working on the same file/module simultaneously. The system writes to `.cerniq/sessions/` (gitignored).

---

## 11.6 Swarm Agent Fleet Operations

CERNIQ operates an internal AI agent swarm for automated development tasks:

```bash
npm run swarm:boot         # Initialize agent fleet with current task context
npm run swarm:dispatch     # Dispatch a specific task to available agent
npm run swarm:health       # Check health of all active agents
npm run swarm:doctor       # Diagnose and repair unhealthy agents
npm run swarm:fleet        # List all agents and their current assignments
npm run swarm:metrics      # Agent performance metrics (completion rate, error rate)
npm run swarm:orient       # Re-orient agents to current codebase state
npm run swarm:handoff      # Hand off agent task to human engineer
npm run swarm:landing      # Graceful shutdown of all agents
npm run swarm:cross        # Cross-agent coordination check
npm run approval           # Review and approve agent-proposed changes
npm run approval:auto      # Auto-approve low-risk changes (lint fixes, docs)
npm run audit              # Full audit of agent actions and outputs
npm run scope:check        # Verify agent stayed within authorized scope
```

---

## 11.7 Common Operations

### Add a new ALM module
1. Create calculation service: `backend-node/src/alm/<module-name>.service.ts`
2. Register in `AlmModule` providers
3. Add controller endpoint in `AlmController`
4. Add frontend page: `frontend/app/alm/<module-name>/page.tsx`
5. Add to ALM module list in sidebar navigation
6. Add E2E test to `frontend/e2e/alm-module.spec.ts`
7. Update `route-inventory.json`

### Add a new Apple API endpoint
1. Add request builder to relevant namespace in `CerniqAPI.swift`:
   ```swift
   public enum ALMAPI {
       public static func newEndpoint(param: String) -> APIRequest<NewResponseType> {
           APIRequest(path: "/api/alm/new/\(param)")
       }
   }
   ```
2. Add response type to `CerniqDomain/Models.swift` if new type needed
3. Generate JSON fixture from live API: `curl ... | jq > apple/Fixtures/new-endpoint.json`
4. Add contract verification case to `CerniqContractsCheck/main.swift`
5. Run: `swift run CerniqContractsCheck` → must pass
6. Add XCTest unit case in `CerniqAPITests`

### Prisma schema change
```bash
# 1. Edit backend-node/prisma/schema.prisma
# 2. Generate + apply migration
cd backend-node
npx prisma migrate dev --name <descriptive_name>

# 3. Regenerate client
npx prisma generate

# 4. Validate
npx prisma validate

# 5. Update seed files if new required fields added
```

### Deploy hotfix to production
```bash
# 1. Create hotfix branch
git checkout -b hotfix/describe-the-fix

# 2. Make fix + commit

# 3. Run quick verify
npm run verify:backend     # or verify:frontend depending on what changed

# 4. Deploy directly (skip full E2E for critical hotfix)
cd backend-node && railway up
# OR
cd frontend && vercel --prod

# 5. Verify with smoke test
npm run smoke:production

# 6. Merge to main + clean up branch
```

---

## 11.8 Incident Response

### Backend API down
```bash
# 1. Check Railway dashboard for container status
# 2. Check Railway logs
railway logs --service backend-node

# 3. Health check
curl https://api.cerniq.io/health

# 4. If DB connection failed
# → Check Railway PostgreSQL addon status
# → Verify DATABASE_URL in Railway env vars

# 5. If Redis connection failed
# → Check Railway Redis addon
# → Verify REDIS_URL in Railway env vars

# 6. Roll back to previous deploy
railway rollback
```

### Frontend down (Vercel)
```bash
# 1. Check Vercel dashboard for deployment status
vercel ls

# 2. View deployment logs
vercel logs [deployment-url]

# 3. Roll back to previous deployment
vercel rollback [previous-deployment-url]

# 4. Force redeploy
cd frontend && vercel --prod --force
```

### Database migration failed
```bash
# 1. Check migration status
cd backend-node
npx prisma migrate status

# 2. If migration is stuck in "failed" state
npx prisma migrate resolve --rolled-back <migration_name>

# 3. Re-run migration
npx prisma migrate deploy

# ⚠️ NEVER use prisma migrate reset in production — it drops all data
```

---

*KLYTICS LLC · Proprietary & Confidential · cerniq.io*
