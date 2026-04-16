# CERNIQ Vol. 6: Terminal Fleet Operations Bible
## The Definitive Authority on the 10-Terminal, 100-CLI Fleet for the CERNIQ ALM Platform

**Owner:** Erwin Kiess-Alfonso / KLYTICS LLC
**Volume:** 6 (Vol1=Agent Bible, Vol2=Engineering Bible, Vol3=Execution Bible, Vol4=Swarm Master Bible, Vol5=GTM War Room, Vol6=Terminal Fleet Ops Bible)
**Last Updated:** 2026-04-16
**Classification:** Internal Only — DO NOT PUBLISH
**Supersedes:** MULTI_TERMINAL_RUNBOOK.md, SESSION_COORDINATION.md, all loose terminal notes and tmux cheat sheets

---

> **ONE SENTENCE:** Ten named terminals. One hundred Claude Code CLI instances. One human operator. Every process, every agent, every deployment, every compliance check — orchestrated through this document.

---

## TABLE OF CONTENTS

1. [Fleet Overview & Philosophy](#1-fleet-overview--philosophy)
2. [The 10-Terminal Architecture — Full Layout](#2-the-10-terminal-architecture--full-layout)
   - [T-01: Data Layer](#t-01-data-layer--postgresql-15--redis-7)
   - [T-02: Backend Core](#t-02-backend-core--nestjs-11-api-3000)
   - [T-03: Frontend](#t-03-frontend--nextjs-16-3001)
   - [T-04: Outbound Sales Engine](#t-04-outbound-sales-engine--python-fastapi-8002)
   - [T-05: Monitoring & Alerts](#t-05-monitoring--alerts)
   - [T-06: Quant/ALM Engine](#t-06-quantalm-engine)
   - [T-07: DevOps/Infra](#t-07-devopsinfra)
   - [T-08: Compliance & Regulatory](#t-08-compliance--regulatory)
   - [T-09: Product & Research](#t-09-product--research)
   - [T-10: Human Operator](#t-10-human-operator--erwins-command-center)
3. [Daily Fleet Rhythm](#3-daily-fleet-rhythm)
4. [Session Management Protocols](#4-session-management-protocols)
5. [Parallel Execution Patterns](#5-parallel-execution-patterns)
6. [Git Worktree Management](#6-git-worktree-management)
7. [Fleet Health & Emergency Protocols](#7-fleet-health--emergency-protocols)
8. [Onboarding a New CLI](#8-onboarding-a-new-cli)
9. [Performance Metrics](#9-performance-metrics)

---

## 1. FLEET OVERVIEW & PHILOSOPHY

### 1.1 Why 10 Terminals, 100 CLIs for a Fintech Startup

CERNIQ is not an ordinary startup. It targets 109 COSSEC-regulated cooperativas and 40+ NCUA credit unions in Puerto Rico with a 62-module ALM platform that must be bilingual, board-ready, and delivered faster than a human consultant charges $15,000 for the same analysis. The product surface is wide — NestJS API, Next.js frontend, Python FastAPI outbound sales engine, Prisma ORM, Redis cache, 62 quant modules, Railway deployment, Vercel frontend delivery, and a regulatory compliance layer that spans two federal/territorial bodies. Building this serially with a single engineer or a sequential AI session would take years.

The 10-terminal fleet solves this by treating the development, operations, compliance, and go-to-market surfaces of CERNIQ as parallel lanes, each staffed with dedicated CLI agents that run continuously, never context-switch between domains, and hand off artifacts through a structured session coordination layer rather than human memory.

**Why 100 CLIs across 10 terminals:**

| Factor | Traditional Approach | CERNIQ Fleet Approach |
|---|---|---|
| Task parallelism | One engineer, one task | 100 agents, 100 tasks simultaneously |
| Context contamination | Engineer carries all context | Each CLI owns one domain — clean context |
| 24/7 availability | Human works 8 hours/day | CLIs work continuously until queue is empty |
| Review quality | Self-review only | Cross-agent reviewer-worker separation |
| Specialization depth | Generalist | Domain expert prompt per CLI |
| Git discipline | Shared branch, merge chaos | One worktree per CLI, zero collisions |
| Failure blast radius | Blocked engineer blocks team | One CLI failure does not touch other agents |

The math is straightforward: 10 CLIs per terminal × 10 terminals = 100 CLIs. With a human operator reviewing at T-10, the ratio is 100 autonomous agents to 1 decision-maker. That ratio is only safe because of the session coordination layer, the landing gate, and the terminal separation defined in this document.

### 1.2 The "Never Idle" Principle

Every CLI in the fleet must have a **mission queue** — a backlog of tasks scoped to its domain that it pulls from when its current task completes. Idle CLIs are waste. The mission queue is the mechanism that converts "I'm done" into "here is my next task."

Mission queues live in:
- `.omx/state/team/{session-id}/queue.json` — individual session queue
- `tasks/terminal/{T-XX}/queue.md` — terminal-level backlog maintained by the human operator at T-10
- GitHub Issues labeled `fleet:T-XX` — persistent mission backlog that survives fleet restarts

A CLI that reports "done" without pulling from the queue is misconfigured. The onboarding prompt (Section 8) always includes queue awareness.

### 1.3 Separation of Concerns: Services vs. Agents vs. Operators

The fleet uses three distinct role types. Mixing these roles in a single terminal is the most common operational error and the root cause of most merge conflicts and state corruption incidents.

**Service processes** run continuously and own infrastructure:
- PostgreSQL, Redis (T-01)
- NestJS API server (T-02)
- Next.js dev server (T-03)
- FastAPI outbound engine (T-04)
- Health polling daemons (T-05)

**Agent CLIs** are Claude Code instances that execute tasks in their domain, use the session coordination layer, commit to worktrees, and hand off to reviewers. Agents never touch service processes outside their designated terminal. An agent on T-06 (Quant/ALM) does not restart the NestJS server. It files a GitHub Issue or messages the T-02 agent pool.

**The human operator** (T-10) reviews, approves, escalates, and rebalances mission queues. T-10 never runs autonomous CLIs. It is a decision surface, not an execution surface.

### 1.4 Terminal Naming Convention

All terminals follow a strict naming convention to prevent tmux session confusion:

```
cerniq-T{number}-{department}
```

Examples:
- `cerniq-T01-data`
- `cerniq-T02-backend`
- `cerniq-T10-operator`

Windows within a terminal follow: `cerniq-T{number}-{department}:{window-name}`

All 100 CLI sessions are registered in `.omx/state/team/` with their terminal affiliation as a required field.

---

## 2. THE 10-TERMINAL ARCHITECTURE — FULL LAYOUT

### T-01: Data Layer — PostgreSQL 15 + Redis 7

**Purpose:** Own the data infrastructure. No other terminal starts until T-01 is green.

**Ports:** PostgreSQL on `:5433`, Redis on `:6380`, Prisma Studio on `:5555`

#### 2.1.1 Startup Sequence

```bash
# Create or attach to the T-01 tmux session
tmux new-session -d -s cerniq-T01-data -x 220 -y 50

# Window 1: PostgreSQL health + psql console
tmux rename-window -t cerniq-T01-data:0 'pg-console'
tmux send-keys -t cerniq-T01-data:pg-console \
  'cd /path/to/cerniq && pg_isready -h localhost -p 5433 -U cerniq_user' Enter

# Window 2: Redis health + redis-cli
tmux new-window -t cerniq-T01-data -n 'redis-console'
tmux send-keys -t cerniq-T01-data:redis-console \
  'redis-cli -p 6380 ping' Enter

# Window 3: Prisma Studio
tmux new-window -t cerniq-T01-data -n 'prisma-studio'
tmux send-keys -t cerniq-T01-data:prisma-studio \
  'cd /path/to/cerniq && npx prisma studio --port 5555' Enter

# Window 4: DB migration agent (Claude Code CLI)
tmux new-window -t cerniq-T01-data -n 'cli-migration'

# Window 5: DB performance agent (Claude Code CLI)
tmux new-window -t cerniq-T01-data -n 'cli-perf'
```

#### 2.1.2 Health Check Commands

```bash
# PostgreSQL — full health check
psql -h localhost -p 5433 -U cerniq_user -d cerniq_db -c "
  SELECT
    count(*) AS active_connections,
    (SELECT count(*) FROM pg_stat_activity WHERE state = 'idle in transaction') AS idle_in_txn,
    pg_size_pretty(pg_database_size('cerniq_db')) AS db_size,
    (SELECT max(query_start) FROM pg_stat_activity WHERE state = 'active') AS last_active_query
  FROM pg_stat_activity
  WHERE datname = 'cerniq_db';
"

# Redis — health + memory
redis-cli -p 6380 INFO memory | grep -E "used_memory_human|maxmemory_human|mem_fragmentation_ratio"
redis-cli -p 6380 INFO keyspace
redis-cli -p 6380 DBSIZE

# Prisma Studio — check port is bound
curl -sf http://localhost:5555 > /dev/null && echo "Prisma Studio: UP" || echo "Prisma Studio: DOWN"

# Full T-01 health summary (run this at fleet startup)
bash scripts/health/t01-data-health.sh
```

#### 2.1.3 Emergency Procedures

```bash
# Scenario: PostgreSQL connection pool exhausted
psql -h localhost -p 5433 -U cerniq_user -d cerniq_db -c "
  SELECT pg_terminate_backend(pid)
  FROM pg_stat_activity
  WHERE datname = 'cerniq_db'
    AND state = 'idle in transaction'
    AND query_start < NOW() - INTERVAL '5 minutes';
"

# Scenario: Redis out of memory — flush session cache only
redis-cli -p 6380 KEYS "session:*" | xargs redis-cli -p 6380 DEL

# Scenario: Prisma migration conflict — reset dev DB (NEVER run on prod)
cd /path/to/cerniq
npx prisma migrate reset --force --skip-generate

# Scenario: Full data layer restart
sudo systemctl restart postgresql-15
redis-cli -p 6380 SHUTDOWN SAVE
redis-server /etc/redis/redis-6380.conf --daemonize yes
```

#### 2.1.4 Backup Commands

```bash
# Daily backup — run from T-01, cron or manual
pg_dump -h localhost -p 5433 -U cerniq_user cerniq_db \
  | gzip > backups/cerniq_$(date +%Y%m%d_%H%M%S).sql.gz

# Verify backup integrity
gunzip -c backups/cerniq_$(date +%Y%m%d)*.sql.gz | psql -h localhost -p 5433 \
  -U cerniq_user cerniq_db_test

# Redis snapshot
redis-cli -p 6380 BGSAVE
cp /var/lib/redis/dump-6380.rdb backups/redis_$(date +%Y%m%d).rdb
```

#### 2.1.5 T-01 CLI Agents

**DB Migration Agent (cli-migration)**
- Session name: `cerniq-cli-t01-migration-{id}`
- Mission: Monitor `prisma/migrations/` for new migration files, validate them against staging DB before they reach prod, run `prisma migrate deploy` on confirmed schemas, and write migration summaries to `docs/ops/migration-log.md`
- Trigger: New `.sql` file in `prisma/migrations/` or direct queue entry
- Output: Migration success/failure status posted to `.omx/state/team/{id}/status.json`

**DB Performance Optimizer Agent (cli-perf)**
- Session name: `cerniq-cli-t01-perf-{id}`
- Mission: Run `EXPLAIN ANALYZE` on slow queries surfaced by T-05 monitor, propose and test index additions in the staging DB, produce `docs/ops/index-recommendations.md`, never ALTER TABLE in production without human approval at T-10
- Trigger: T-05 alert with query duration > 500ms, or daily sweep at 09:00 AST

---

### T-02: Backend Core — NestJS 11 API (:3000)

**Purpose:** Run and continuously improve the NestJS 11 backend. All API changes land here first.

**Port:** `:3000`

#### 2.2.1 Startup Sequence

```bash
tmux new-session -d -s cerniq-T02-backend -x 220 -y 50

# Window 1: NestJS dev server
tmux rename-window -t cerniq-T02-backend:0 'api-server'
tmux send-keys -t cerniq-T02-backend:api-server \
  'cd /path/to/cerniq && cp .env.local .env && npm run start:dev' Enter

# Window 2: API test runner (watch mode)
tmux new-window -t cerniq-T02-backend -n 'test-watch'
tmux send-keys -t cerniq-T02-backend:test-watch \
  'cd /path/to/cerniq && npm run test:watch' Enter

# Window 3: API test agent CLI
tmux new-window -t cerniq-T02-backend -n 'cli-api-test'

# Window 4: Endpoint validation agent CLI
tmux new-window -t cerniq-T02-backend -n 'cli-endpoint'

# Window 5: Schema sync agent CLI
tmux new-window -t cerniq-T02-backend -n 'cli-schema'
```

#### 2.2.2 Environment Loading

```bash
# Standard env load — always from .env.local, never commit .env
cd /path/to/cerniq
cp .env.local .env

# Required env vars — verify all present before starting
node -e "
  const required = [
    'DATABASE_URL', 'REDIS_URL', 'JWT_SECRET', 'STRIPE_SECRET_KEY',
    'RESEND_API_KEY', 'SENTRY_DSN', 'RAILWAY_ENVIRONMENT'
  ];
  const missing = required.filter(k => !process.env[k]);
  if (missing.length) { console.error('MISSING:', missing); process.exit(1); }
  console.log('All env vars present');
" -- $(cat .env | xargs)
```

#### 2.2.3 Health Check Endpoints

```bash
# Basic liveness
curl -sf http://localhost:3000/health | jq '.'

# Deep health — DB + Redis connectivity
curl -sf http://localhost:3000/health/deep | jq '.'

# ALM module availability
curl -sf http://localhost:3000/alm/health | jq '.modules | length'

# Expected output: 62

# Auth system
curl -sf -X POST http://localhost:3000/auth/health | jq '.'

# Stripe webhook receiver
curl -sf http://localhost:3000/stripe/webhook/health | jq '.'
```

#### 2.2.4 T-02 CLI Agents

**API Test Agent (cli-api-test)**
- Session name: `cerniq-cli-t02-apitest-{id}`
- Mission: Write and run Jest integration tests for new endpoints surfaced by T-09 feature tickets. Target coverage: >80% on all new routes. Commits tests to worktree `cerniq-wt-backend-{cli-id}` and opens PR for review
- Never modifies production code directly — tests only

**Endpoint Validation Agent (cli-endpoint)**
- Session name: `cerniq-cli-t02-endpoint-{id}`
- Mission: Run `scripts/validate-endpoints.sh` hourly, compare expected vs. actual response schemas using Zod validators, report schema drift to T-10 queue

**Schema Sync Agent (cli-schema)**
- Session name: `cerniq-cli-t02-schema-{id}`
- Mission: Watch `prisma/schema.prisma` for changes, auto-generate DTOs and validators in `src/dto/`, run `npx prisma generate`, validate generated types compile cleanly

---

### T-03: Frontend — Next.js 16 (:3001)

**Purpose:** Run and improve the Next.js 16 frontend. UI agents live here.

**Port:** `:3001`

#### 2.3.1 Startup Sequence

```bash
tmux new-session -d -s cerniq-T03-frontend -x 220 -y 50

# Window 1: Next.js dev server
tmux rename-window -t cerniq-T03-frontend:0 'next-dev'
tmux send-keys -t cerniq-T03-frontend:next-dev \
  'cd /path/to/cerniq-frontend && npm run dev -- --port 3001' Enter

# Window 2: TypeScript type check watcher
tmux new-window -t cerniq-T03-frontend -n 'tsc-watch'
tmux send-keys -t cerniq-T03-frontend:tsc-watch \
  'cd /path/to/cerniq-frontend && npx tsc --watch --noEmit' Enter

# Window 3: UI test agent
tmux new-window -t cerniq-T03-frontend -n 'cli-ui-test'

# Window 4: Accessibility check agent
tmux new-window -t cerniq-T03-frontend -n 'cli-a11y'
```

#### 2.3.2 Build & Performance Commands

```bash
# Production build (run before any Vercel deploy)
cd /path/to/cerniq-frontend
npm run build 2>&1 | tee logs/build-$(date +%Y%m%d_%H%M%S).log

# Bundle analyzer — identify oversized chunks
ANALYZE=true npm run build

# Lighthouse CI (requires lighthouse-ci installed)
lhci autorun --upload.target=temporary-public-storage \
  --collect.url=http://localhost:3001/dashboard

# Core Web Vitals target thresholds
# LCP: < 2.5s, FID: < 100ms, CLS: < 0.1
# INP: < 200ms (Next.js 16 App Router target)

# Check for unoptimized images
grep -r "img src=" src/components/ --include="*.tsx" | grep -v "next/image"
```

#### 2.3.3 T-03 CLI Agents

**UI Test Agent (cli-ui-test)**
- Session name: `cerniq-cli-t03-uitest-{id}`
- Mission: Write Playwright e2e tests for critical user flows: upload CSV → generate report → download PDF. Maintain `tests/e2e/` directory. Run tests on every PR targeting frontend
- Key flows: cooperativa onboarding, ALM report generation, Stripe checkout, demo page

**A11y Check Agent (cli-a11y)**
- Session name: `cerniq-cli-t03-a11y-{id}`
- Mission: Run `axe-core` accessibility scans on all pages, produce `reports/a11y-$(date).json`, flag WCAG 2.1 AA violations as GitHub Issues labeled `a11y:critical`. CERNIQ serves Spanish-speaking cooperative members — bilingual accessibility is non-negotiable

---

### T-04: Outbound Sales Engine — Python FastAPI (:8002)

**Purpose:** Run the 6-agent outbound sales pipeline targeting 109 cooperativas and NCUA credit unions.

**Port:** `:8002`

#### 2.4.1 Sales Agent Pipeline Startup

The outbound engine has 6 named agents, each a FastAPI background worker:

```bash
tmux new-session -d -s cerniq-T04-outbound -x 220 -y 50

# Window 1: FastAPI main process
tmux rename-window -t cerniq-T04-outbound:0 'api-main'
tmux send-keys -t cerniq-T04-outbound:api-main \
  'cd /path/to/cerniq-outbound && source venv/bin/activate && uvicorn main:app --host 0.0.0.0 --port 8002 --reload' Enter

# Window 2: Agent 1 — Prospector (identifies next batch of cooperativas to contact)
tmux new-window -t cerniq-T04-outbound -n 'agent-prospector'
tmux send-keys -t cerniq-T04-outbound:agent-prospector \
  'source venv/bin/activate && python agents/prospector.py --batch-size 10' Enter

# Window 3: Agent 2 — Enricher (pulls COSSEC data, LinkedIn, website)
tmux new-window -t cerniq-T04-outbound -n 'agent-enricher'

# Window 4: Agent 3 — Personalizer (crafts bilingual outreach)
tmux new-window -t cerniq-T04-outbound -n 'agent-personalizer'

# Window 5: Agent 4 — Sender (Resend API integration)
tmux new-window -t cerniq-T04-outbound -n 'agent-sender'

# Window 6: Agent 5 — Follow-up tracker (sequence timing, open/click events)
tmux new-window -t cerniq-T04-outbound -n 'agent-followup'

# Window 7: Agent 6 — CRM Sync (writes results to ProspectInstitution table)
tmux new-window -t cerniq-T04-outbound -n 'agent-crm'

# Window 8: Lead research CLI
tmux new-window -t cerniq-T04-outbound -n 'cli-lead-research'

# Window 9: Email drafting CLI
tmux new-window -t cerniq-T04-outbound -n 'cli-email-draft'

# Window 10: CRM sync validation CLI
tmux new-window -t cerniq-T04-outbound -n 'cli-crm-validate'
```

#### 2.4.2 Lead Pipeline Monitoring

```bash
# Check pipeline status — counts at each stage
curl -sf http://localhost:8002/pipeline/status | jq '
  {
    prospected: .stages.prospected,
    enriched: .stages.enriched,
    personalized: .stages.personalized,
    sent: .stages.sent,
    opened: .stages.opened,
    replied: .stages.replied,
    demo_booked: .stages.demo_booked
  }
'

# Conversion funnel health check
curl -sf http://localhost:8002/pipeline/funnel | jq '.conversion_rates'

# Stuck leads (enrichment pending > 2 hours)
psql -h localhost -p 5433 -U cerniq_user -d cerniq_db -c "
  SELECT name, status, updated_at
  FROM ProspectInstitution
  WHERE status = 'ENRICHING'
    AND updated_at < NOW() - INTERVAL '2 hours'
  ORDER BY updated_at;
"

# Today's send quota status
curl -sf http://localhost:8002/sender/quota | jq '{sent_today: .sent, daily_limit: .limit, remaining: .remaining}'
```

#### 2.4.3 T-04 CLI Agents

**Lead Research CLI (cli-lead-research)**
- Mission: For each cooperativa in the prospector batch, research the CFO/Risk Manager persona, verify current COSSEC compliance status, identify any recent regulatory events, and write a JSON enrichment record to `data/leads/enriched/`

**Email Drafting CLI (cli-email-draft)**
- Mission: Consume enrichment records, produce bilingual (Spanish primary, English secondary) outreach emails using the T-05 Vol. templates from CERNIQ_Vol5_GTM_WAR_ROOM_BIBLE.md. Store drafts in `data/email-drafts/` for Agent 3 (Personalizer) to finalize

**CRM Sync CLI (cli-crm-validate)**
- Mission: Validate all ProspectInstitution records updated in the last 24 hours for data integrity, flag missing required fields (assets, contact_email, status), and produce a daily CRM quality report

---

### T-05: Monitoring & Alerts

**Purpose:** Continuous observability across all services and agents. T-05 is the fleet's nervous system.

#### 2.5.1 Startup Sequence

```bash
tmux new-session -d -s cerniq-T05-monitor -x 220 -y 50

# Window 1: Unified health poller
tmux rename-window -t cerniq-T05-monitor:0 'health-poller'
tmux send-keys -t cerniq-T05-monitor:health-poller \
  'watch -n 30 bash scripts/health/fleet-health-summary.sh' Enter

# Window 2: Railway logs tail
tmux new-window -t cerniq-T05-monitor -n 'railway-logs'
tmux send-keys -t cerniq-T05-monitor:railway-logs \
  'railway logs --tail --environment production' Enter

# Window 3: Sentry error feed
tmux new-window -t cerniq-T05-monitor -n 'sentry-feed'
tmux send-keys -t cerniq-T05-monitor:sentry-feed \
  'watch -n 60 scripts/monitor/sentry-latest.sh' Enter

# Window 4: Log scanner CLI
tmux new-window -t cerniq-T05-monitor -n 'cli-log-scanner'

# Window 5: Metric reporter CLI
tmux new-window -t cerniq-T05-monitor -n 'cli-metric-reporter'
```

#### 2.5.2 Alert Thresholds and Escalation

| Metric | Yellow Threshold | Red Threshold | Escalation Action |
|---|---|---|---|
| API response time (p95) | > 800ms | > 2000ms | T-02 agent + T-10 notification |
| PostgreSQL active connections | > 80 | > 120 | T-01 agent immediate action |
| Redis memory usage | > 70% | > 90% | T-01 emergency flush |
| Error rate (5xx per minute) | > 5 | > 20 | T-10 pager + T-02 rollback candidate |
| Outbound send failures | > 10% | > 30% | T-04 agent + Resend API check |
| ALM module test failures | > 2 | > 10 | T-06 agent blocker + T-10 review |
| CLI sessions stale (no heartbeat) | > 15 min | > 30 min | Auto-reap + T-10 alert |
| Queue depth (all terminals) | > 500 tasks | > 1000 tasks | Mission reassignment at T-10 |

#### 2.5.3 Fleet Health Summary Script

```bash
#!/bin/bash
# scripts/health/fleet-health-summary.sh
# Run this at any time to get a full fleet snapshot

echo "=== CERNIQ FLEET HEALTH === $(date '+%Y-%m-%d %H:%M:%S AST')"
echo ""

# Services
echo "--- SERVICES ---"
curl -sf http://localhost:3000/health > /dev/null && echo "[UP]  T-02 NestJS :3000" || echo "[DOWN] T-02 NestJS :3000"
curl -sf http://localhost:3001 > /dev/null       && echo "[UP]  T-03 Next.js :3001" || echo "[DOWN] T-03 Next.js :3001"
curl -sf http://localhost:8002/health > /dev/null && echo "[UP]  T-04 FastAPI :8002" || echo "[DOWN] T-04 FastAPI :8002"
pg_isready -h localhost -p 5433 -q              && echo "[UP]  T-01 PostgreSQL :5433" || echo "[DOWN] T-01 PostgreSQL :5433"
redis-cli -p 6380 ping > /dev/null 2>&1         && echo "[UP]  T-01 Redis :6380" || echo "[DOWN] T-01 Redis :6380"

echo ""
echo "--- ACTIVE CLI SESSIONS ---"
ls .omx/state/team/ 2>/dev/null | wc -l | xargs echo "Registered sessions:"
node scripts/session/list-active.js 2>/dev/null | grep "working" | wc -l | xargs echo "Working sessions:"
node scripts/session/list-active.js 2>/dev/null | grep "stale" | wc -l | xargs echo "Stale sessions:"

echo ""
echo "--- QUEUE DEPTHS ---"
for t in T01 T02 T03 T04 T05 T06 T07 T08 T09; do
  count=$(wc -l < tasks/terminal/${t}/queue.md 2>/dev/null || echo "0")
  echo "  ${t}: ${count} tasks"
done
```

#### 2.5.4 T-05 CLI Agents

**Log Scanner CLI (cli-log-scanner)**
- Mission: Tail Railway and local logs, extract ERROR and WARN lines, deduplicate, group by error type, and post a structured hourly digest to `logs/digests/$(date +%Y%m%d_%H).json`. Escalate any new error type not seen in the last 7 days to T-10 immediately

**Metric Reporter CLI (cli-metric-reporter)**
- Mission: Pull metrics from all services every 15 minutes, write structured metrics to `metrics/$(date +%Y%m%d).jsonl`, generate daily summary report at 17:00 AST for T-10 review

---

### T-06: Quant/ALM Engine

**Purpose:** Develop, test, validate, and QA the 62 ALM modules that are the core product of CERNIQ.

#### 2.6.1 Startup Sequence

```bash
tmux new-session -d -s cerniq-T06-quant -x 220 -y 50

# Window 1: 62-module test runner (Jest/Pytest)
tmux rename-window -t cerniq-T06-quant:0 'module-tests'
tmux send-keys -t cerniq-T06-quant:module-tests \
  'cd /path/to/cerniq && npm run test:alm -- --watch' Enter

# Window 2: Backtesting harness
tmux new-window -t cerniq-T06-quant -n 'backtest'
tmux send-keys -t cerniq-T06-quant:backtest \
  'cd /path/to/cerniq && node scripts/backtest/run-harness.js --verbose' Enter

# Window 3: Module validator CLI
tmux new-window -t cerniq-T06-quant -n 'cli-validator'

# Window 4: Backtester CLI
tmux new-window -t cerniq-T06-quant -n 'cli-backtester'

# Window 5: Report QA CLI
tmux new-window -t cerniq-T06-quant -n 'cli-report-qa'
```

#### 2.6.2 62-Module Test Runner

```bash
# Run all 62 ALM modules in parallel
npm run test:alm -- --runInBand=false --maxWorkers=8

# Run specific module category
npm run test:alm -- --testPathPattern="duration-gap|nii-sensitivity|eve"

# Backtest with historical cooperativa data
node scripts/backtest/run-harness.js \
  --institution CoopAhorroSanJuan \
  --date-range "2023-01-01:2025-12-31" \
  --modules all \
  --output reports/backtest/$(date +%Y%m%d).json

# Module coverage report — must be >90% for all 62 modules
npm run test:alm -- --coverage --coverageDirectory=coverage/alm

# Check which modules are below 90% coverage
node -e "
  const cov = require('./coverage/alm/coverage-summary.json');
  Object.entries(cov).forEach(([file, data]) => {
    if (data.lines.pct < 90) console.log(file, data.lines.pct + '%');
  });
"
```

#### 2.6.3 T-06 CLI Agents

**Module Validator CLI (cli-validator)**
- Mission: For each new or modified ALM module, run the full test suite, validate mathematical outputs against NCUA/COSSEC benchmark values from `data/regulatory-benchmarks/`, flag any deviation > 0.01% for human review at T-10

**Backtester CLI (cli-backtester)**
- Mission: Run 12-month backtests on the 10 largest cooperativas (by total assets) weekly, produce comparison reports showing CERNIQ ALM outputs vs. published COSSEC annual report figures, flag discrepancies > 5%

**Report QA CLI (cli-report-qa)**
- Mission: Generate test ALM reports for the CoopAhorro San Juan demo institution, validate all 14 pages render correctly (charts, tables, Spanish/English), check PDF metadata, verify Stripe billing event fires on generation

---

### T-07: DevOps/Infra

**Purpose:** Own Railway deployment, Vercel builds, CI/CD pipeline, and all infrastructure operations.

#### 2.7.1 Startup Sequence

```bash
tmux new-session -d -s cerniq-T07-devops -x 220 -y 50

# Window 1: GitHub Actions monitor
tmux rename-window -t cerniq-T07-devops:0 'gh-actions'
tmux send-keys -t cerniq-T07-devops:gh-actions \
  'watch -n 30 "gh run list --limit 10 --json status,name,conclusion,createdAt | jq -r '.[] | [.status, .conclusion, .name] | @tsv'"' Enter

# Window 2: Railway status
tmux new-window -t cerniq-T07-devops -n 'railway-status'
tmux send-keys -t cerniq-T07-devops:railway-status \
  'watch -n 60 railway status' Enter

# Window 3: Deploy agent CLI
tmux new-window -t cerniq-T07-devops -n 'cli-deploy'

# Window 4: Migration runner CLI
tmux new-window -t cerniq-T07-devops -n 'cli-migration-runner'

# Window 5: Secret rotation CLI
tmux new-window -t cerniq-T07-devops -n 'cli-secret-rotation'
```

#### 2.7.2 Deploy Commands

```bash
# Standard backend deploy (Railway)
git checkout main
git pull origin main
railway up --service cerniq-backend --environment production

# Frontend deploy (Vercel — auto-deploys on main push, but manual trigger:)
cd /path/to/cerniq-frontend && vercel --prod

# Deploy with rollback plan — always tag before deploying
git tag "pre-deploy-$(date +%Y%m%d_%H%M%S)"
git push origin --tags

# Rollback backend to previous Railway deployment
railway rollback --service cerniq-backend --environment production

# Rollback frontend (Vercel)
vercel rollback [deployment-url] --scope klytics

# Check deployment health after deploy (run from T-07, waits 60s then checks)
sleep 60 && curl -sf https://api.cerniq.app/health | jq '.version'
```

#### 2.7.3 T-07 CLI Agents

**Deploy Agent (cli-deploy)**
- Mission: Monitor GitHub Actions for successful CI on main branch, execute Railway deploy, run post-deploy health checks, report deploy status to T-10 queue. Never deploy if any T-06 ALM module tests are failing

**Migration Runner CLI (cli-migration-runner)**
- Mission: Coordinate with T-01 DB migration agent to sequence Prisma migrations before backend deploys. Validate migration idempotency in staging before production. Post migration status to deploy log

**Secret Rotation CLI (cli-secret-rotation)**
- Mission: Monthly — audit all secrets in Railway and Vercel environment variables for age > 90 days, generate rotation checklist, alert T-10 for approval before any rotation. Never rotates without T-10 approval

---

### T-08: Compliance & Regulatory

**Purpose:** Ensure every CERNIQ feature, report, and data handling practice meets COSSEC and NCUA requirements.

#### 2.8.1 Startup Sequence

```bash
tmux new-session -d -s cerniq-T08-compliance -x 220 -y 50

# Window 1: Compliance checker (runs nightly, available on-demand)
tmux rename-window -t cerniq-T08-compliance:0 'compliance-runner'
tmux send-keys -t cerniq-T08-compliance:compliance-runner \
  'cd /path/to/cerniq && node scripts/compliance/run-checker.js --report' Enter

# Window 2: Regulatory report generator
tmux new-window -t cerniq-T08-compliance -n 'reg-report-gen'

# Window 3: COSSEC validator CLI
tmux new-window -t cerniq-T08-compliance -n 'cli-cossec'

# Window 4: NCUA sync CLI
tmux new-window -t cerniq-T08-compliance -n 'cli-ncua'

# Window 5: Audit log reviewer
tmux new-window -t cerniq-T08-compliance -n 'cli-audit'
```

#### 2.8.2 T-08 CLI Agents

**COSSEC Validator CLI (cli-cossec)**
- Mission: Validate all 62 ALM module outputs against COSSEC Reglamento de Administración de Activos y Pasivos (AAP) requirements. Maintain `docs/compliance/cossec-mapping.md` — a mapping of every CERNIQ module to its COSSEC regulatory reference. Flag any output field with no regulatory backing

**NCUA Sync CLI (cli-ncua)**
- Mission: Monitor NCUA Letter to Credit Unions releases weekly, summarize regulatory changes relevant to ALM, update `docs/compliance/ncua-updates.md`, create GitHub Issues for any ALM module changes required within 90 days of a new NCUA guidance letter

**Audit Log Reviewer (cli-audit)**
- Mission: Daily review of audit log table in PostgreSQL — every ALM report generation, every user action, every API key usage. Verify log integrity (no gaps in sequence), export daily audit digest to `logs/audit/$(date +%Y%m%d).json`, flag any anomalous access patterns to T-10

```bash
# Compliance check — run on demand or nightly
node scripts/compliance/run-checker.js \
  --frameworks COSSEC,NCUA \
  --output reports/compliance/$(date +%Y%m%d).json \
  --alert-threshold MEDIUM

# Audit log integrity check
psql -h localhost -p 5433 -U cerniq_user -d cerniq_db -c "
  SELECT
    date_trunc('hour', created_at) AS hour,
    count(*) AS events,
    count(DISTINCT user_id) AS unique_users,
    array_agg(DISTINCT action_type) AS action_types
  FROM AuditLog
  WHERE created_at > NOW() - INTERVAL '24 hours'
  GROUP BY 1
  ORDER BY 1;
"
```

---

### T-09: Product & Research

**Purpose:** Drive product strategy, feature specs, UX research synthesis, and competitive intelligence.

#### 2.9.1 Startup Sequence

```bash
tmux new-session -d -s cerniq-T09-product -x 220 -y 50

# Window 1: Feature spec writer CLI
tmux rename-window -t cerniq-T09-product:0 'cli-spec-writer'

# Window 2: Competitor monitor CLI
tmux new-window -t cerniq-T09-product -n 'cli-competitor'

# Window 3: User research synthesizer CLI
tmux new-window -t cerniq-T09-product -n 'cli-ux-research'

# Window 4: GitHub Issues triage
tmux new-window -t cerniq-T09-product -n 'issues-triage'
tmux send-keys -t cerniq-T09-product:issues-triage \
  'watch -n 120 "gh issue list --label product --json number,title,state,labels | jq -r \".[] | [.number, .state, .title] | @tsv\""' Enter
```

#### 2.9.2 T-09 CLI Agents

**Feature Spec Writer (cli-spec-writer)**
- Mission: Convert T-10 decision records and user feedback into structured feature specs following the CERNIQ spec template: Problem Statement → User Story → Acceptance Criteria → ALM Impact → Compliance Check → Technical Dependencies. Write to `docs/specs/features/`

**Competitor Monitor CLI (cli-competitor)**
- Mission: Weekly sweep of key competitor sites (Plansmith, Empyrean, QRM, Visible Equity), extract pricing page changes, feature announcements, and press releases, summarize in `docs/competitive/weekly-$(date +%Y%m%d).md`

**User Research Synthesizer (cli-ux-research)**
- Mission: Process demo call notes, support tickets, and email replies from cooperativa contacts, extract common pain points and feature requests, maintain `docs/research/user-insights.md` as a living document of validated user needs

---

### T-10: Human Operator — Erwin's Command Center

**Purpose:** The only terminal that never runs CLIs autonomously. T-10 is the decision surface for the entire fleet.

#### 2.10.1 Core Principle

**T-10 does not run Claude Code CLI instances.** Every action at T-10 is a human decision: approving a PR, reassigning a CLI's mission queue, escalating a compliance flag, reviewing a deploy, signing off on an ALM module, or calling a nuclear pause. If T-10 is running an autonomous agent, something has gone wrong with fleet discipline.

#### 2.10.2 T-10 Layout

```bash
tmux new-session -d -s cerniq-T10-operator -x 220 -y 50

# Window 1: T-10 dashboard — fleet health snapshot
tmux rename-window -t cerniq-T10-operator:0 'fleet-dashboard'
tmux send-keys -t cerniq-T10-operator:fleet-dashboard \
  'watch -n 30 bash scripts/health/fleet-health-summary.sh' Enter

# Window 2: GitHub PR review queue
tmux new-window -t cerniq-T10-operator -n 'pr-queue'
tmux send-keys -t cerniq-T10-operator:pr-queue \
  'watch -n 60 "gh pr list --json number,title,author,labels,isDraft | jq -r \".[] | select(.isDraft == false) | [.number, .author.login, .title] | @tsv\""' Enter

# Window 3: T-10 inbox — escalations from all terminals
tmux new-window -t cerniq-T10-operator -n 'escalation-inbox'
tmux send-keys -t cerniq-T10-operator:escalation-inbox \
  'tail -f .omx/state/operator/escalations.log' Enter

# Window 4: Decision log
tmux new-window -t cerniq-T10-operator -n 'decision-log'
tmux send-keys -t cerniq-T10-operator:decision-log \
  'tail -f docs/ops/decision-log.md' Enter

# Window 5: Mission queue rebalancer
tmux new-window -t cerniq-T10-operator -n 'queue-mgmt'
```

#### 2.10.3 T-10 Review Workflow

Every item arriving in T-10's escalation inbox follows this approval workflow:

```
ESCALATION RECEIVED
      |
      v
Classify: [BLOCKER | DECISION | INFO | EMERGENCY]
      |
  BLOCKER: Unblock immediately (< 15 min SLA)
  DECISION: Add to next review window (09:00 or 15:00 AST)
  INFO: Acknowledge, file in ops log
  EMERGENCY: Nuclear protocol (Section 7.5)
      |
      v
Record decision in docs/ops/decision-log.md format:
  ## [YYYY-MM-DD HH:MM AST] Decision: {title}
  **Context:** {escalation summary}
  **Decision:** {what was decided}
  **Rationale:** {why}
  **Actions:** {what CLIs need to do next}
  **Owner:** T-{terminal}
```

#### 2.10.4 T-10 Must-Never List

T-10 must never:
- Run `claude` CLI autonomously — all CLI sessions belong to T-01 through T-09
- Merge PRs without reading the diff — agents can open, only humans merge
- Override STRICT_CLAIMS mode without documenting the reason
- Deploy to production without reviewing T-06 test results and T-08 compliance check
- Approve a database migration that has not been tested in staging (T-01 agent validates this)

---

## 3. DAILY FLEET RHYTHM

### 3.1 Fleet Startup Sequence — 07:00 AST

Execute in strict order. A terminal with a dependency on another must wait for its upstream to show GREEN before starting.

```bash
# PHASE 1: Infrastructure (no dependencies)
# 07:00 — T-01 starts first, always
tmux attach -t cerniq-T01-data || tmux new-session -s cerniq-T01-data
# Run startup sequence from Section 2.1.1
# Wait for: pg_isready -h localhost -p 5433 returns "accepting connections"
# Wait for: redis-cli -p 6380 ping returns "PONG"

# PHASE 2: Application layer (depends on T-01 GREEN)
# 07:05 — T-02 Backend
tmux new-session -d -s cerniq-T02-backend
# npm run start:dev — wait for "Nest application successfully started"

# 07:08 — T-03 Frontend (can start parallel with T-02)
tmux new-session -d -s cerniq-T03-frontend
# npm run dev -- --port 3001

# 07:10 — T-04 Outbound Engine
tmux new-session -d -s cerniq-T04-outbound
# uvicorn main:app --port 8002

# PHASE 3: Observability (depends on T-02, T-03, T-04 started)
# 07:12 — T-05 Monitor
tmux new-session -d -s cerniq-T05-monitor
# Run fleet-health-summary.sh — expect all GREEN before proceeding

# PHASE 4: Intelligence (no service dependencies)
# 07:15 — T-06, T-07, T-08, T-09 start in parallel
for terminal in T06-quant T07-devops T08-compliance T09-product; do
  tmux new-session -d -s cerniq-${terminal}
done

# PHASE 5: Operator
# 07:20 — T-10 operator opens dashboard
tmux new-session -d -s cerniq-T10-operator

# 07:25 — Register all CLI sessions
npm run session:register-fleet  # registers all CLIs with .omx state
```

### 3.2 07:30 AST — Automated Standup

All 100 CLIs post a standup status to `.omx/state/team/{id}/standup.json` at 07:30 AST.

```bash
# Trigger standup collection across fleet
npm run fleet:standup

# Expected standup format from each CLI:
# {
#   "session_id": "cerniq-cli-t02-apitest-001",
#   "terminal": "T-02",
#   "status": "working|idle|blocked",
#   "current_task": "Writing integration tests for /alm/upload endpoint",
#   "completed_since_last": ["Tests for /auth/login", "Tests for /health/deep"],
#   "blockers": [],
#   "queue_depth": 4,
#   "timestamp": "2026-04-16T07:30:00-04:00"
# }

# Aggregate standup report for T-10
node scripts/fleet/aggregate-standup.js \
  --output reports/standup/$(date +%Y%m%d).md \
  --alert-on-blocked

# View standup summary
cat reports/standup/$(date +%Y%m%d).md
```

### 3.3 09:00 AST — Priority Review & Mission Reassignment

T-10 operator reviews the standup aggregate and takes the following actions:

```bash
# Review blocked CLIs — unblock or reassign
node scripts/fleet/list-blocked.js

# Reassign idle CLIs to priority queue items
node scripts/fleet/rebalance-queues.js --dry-run
# Review output, then execute:
node scripts/fleet/rebalance-queues.js --execute

# Review overnight GitHub PRs opened by agents
gh pr list --json number,title,author,labels --jq '.[] | select(.labels[].name | test("agent:"))'

# Check if any T-06 test failures are blocking T-07 deploys
npm run test:alm -- --passWithNoTests 2>&1 | tail -5
```

### 3.4 12:00 AST — Mid-Day Health Check

```bash
# Full fleet health snapshot
bash scripts/health/fleet-health-summary.sh

# API performance check
curl -sf http://localhost:3000/health/deep | jq '.response_time_ms'

# Check outbound pipeline throughput since 07:00
curl -sf http://localhost:8002/pipeline/today | jq '{sent: .sent, opened: .opened, replied: .replied}'

# Verify no stale sessions
npm run session:cleanup --dry-run
```

### 3.5 17:00 AST — EOD Status Roll-Up

```bash
# Generate EOD report
node scripts/fleet/eod-report.js \
  --output reports/eod/$(date +%Y%m%d).md

# EOD report includes:
# - Tasks completed by each CLI (by terminal)
# - PRs opened, merged, closed
# - Tests run, pass rate
# - ALM modules tested, coverage delta
# - Outbound metrics: sent/opened/replied/demos booked
# - Compliance flags raised
# - Performance metrics: API p95, error rate
# - Queue depths entering overnight

# Post EOD summary to T-10 decision log
cat reports/eod/$(date +%Y%m%d).md >> docs/ops/decision-log.md
```

### 3.6 22:00 AST — Overnight Task Queue Loading

```bash
# Load overnight task queues for all terminals
# T-06 Quant: run full 62-module test suite overnight
echo '{"task": "run_full_alm_suite", "priority": "high", "trigger": "overnight"}' \
  >> tasks/terminal/T06/queue.md

# T-05 Monitor: reduce polling interval to 5 min overnight (no humans to respond)
# T-04 Outbound: pause email sending (respect business hours), continue research
# T-08 Compliance: run nightly compliance audit
npm run queue:load-overnight

# Verify overnight queue is healthy
npm run queue:status
```

---

## 4. SESSION MANAGEMENT PROTOCOLS

### 4.1 Full Session Lifecycle

Every CLI session moves through these states in strict order:

```
UNREGISTERED → REGISTERED → CLAIMED → WORKING → RELEASING → RELEASED
                                                     ↑
                                             HEARTBEAT (every 5 min while WORKING)
```

**State transition rules:**
- A session can only CLAIM a file/task if no other WORKING session holds a claim on it
- STRICT_CLAIMS=1 makes claim conflicts blocking — the CLI waits or fails
- STRICT_CLAIMS=0 (default) makes conflicts advisory — the CLI proceeds with a warning logged
- A session not heartbeating for > 15 minutes is marked STALE and eligible for reaping
- Only the session that claimed a task can release it (no steal-release except via T-10 operator override)

### 4.2 npm run session:* Commands

```bash
# Register a new CLI session
npm run session:register -- \
  --id cerniq-cli-t02-apitest-001 \
  --terminal T-02 \
  --type agent \
  --mission "API integration testing"

# Claim a file/task (non-blocking by default)
npm run session:claim -- \
  --session cerniq-cli-t02-apitest-001 \
  --resource src/modules/alm/alm.service.ts \
  --intent read-write

# Claim in strict mode (blocks if contested)
STRICT_CLAIMS=1 npm run session:claim -- \
  --session cerniq-cli-t02-apitest-001 \
  --resource src/modules/alm/alm.service.ts \
  --intent read-write

# Heartbeat — must be called every 5 minutes while WORKING
npm run session:heartbeat -- --session cerniq-cli-t02-apitest-001

# Release a claim
npm run session:release -- \
  --session cerniq-cli-t02-apitest-001 \
  --resource src/modules/alm/alm.service.ts

# Deregister session (end of session lifecycle)
npm run session:deregister -- --session cerniq-cli-t02-apitest-001

# List all active sessions
npm run session:list

# List claims on a specific file
npm run session:claims -- --resource src/modules/alm/alm.service.ts

# Force-release a stale session's claims (T-10 operator only)
npm run session:force-release -- --session cerniq-cli-t02-apitest-001 --operator T-10
```

### 4.3 Conflict Detection

```bash
# Check who has claimed a file before touching it
npm run session:claims -- --resource src/modules/alm/duration-gap.service.ts

# Output:
# {
#   "resource": "src/modules/alm/duration-gap.service.ts",
#   "claims": [
#     {
#       "session": "cerniq-cli-t06-validator-003",
#       "intent": "read-write",
#       "claimed_at": "2026-04-16T09:15:33-04:00",
#       "last_heartbeat": "2026-04-16T09:20:11-04:00",
#       "status": "working"
#     }
#   ]
# }

# Check for cross-terminal conflicts (e.g., T-02 and T-06 both touching alm.service.ts)
npm run session:conflicts -- --report
```

### 4.4 Stale Session Cleanup

```bash
# Dry run — see what would be cleaned
npm run session:cleanup --dry-run

# Execute cleanup (reaps sessions with no heartbeat > 15 min)
npm run session:cleanup

# Force cleanup with lower threshold (emergency — stale > 5 min)
npm run session:cleanup -- --stale-threshold 300

# Post-cleanup: verify no orphaned claims remain
npm run session:claims -- --orphaned
```

### 4.5 Cross-Terminal Dependency Chains

Some tasks require coordination across terminals. These are modeled as dependency chains:

```yaml
# Example: ALM module update requires T-06 → T-02 → T-07 chain
chain:
  name: "alm-module-update"
  steps:
    - terminal: T-06
      session: cerniq-cli-t06-validator-001
      task: "Validate and test updated duration-gap module"
      outputs: ["test-results/duration-gap.json"]
      success_condition: "all_tests_pass"

    - terminal: T-02
      session: cerniq-cli-t02-schema-001
      task: "Update Zod validators for new module output schema"
      depends_on: "T-06 success"
      outputs: ["src/dto/alm/duration-gap.dto.ts"]

    - terminal: T-07
      session: cerniq-cli-t07-deploy-001
      task: "Deploy updated backend to Railway staging"
      depends_on: "T-02 success"
      requires_human_approval: true
      approver: "T-10"
```

```bash
# Start a dependency chain
npm run chain:start -- --config chains/alm-module-update.yaml

# Monitor chain progress
npm run chain:status -- --name alm-module-update

# Cancel a chain (propagates cancel to all pending steps)
npm run chain:cancel -- --name alm-module-update
```

---

## 5. PARALLEL EXECUTION PATTERNS

### 5.1 Fan-Out Pattern

One lead CLI dispatches identical or parameterized tasks to N worker CLIs simultaneously.

**Structure:**
```
LEAD CLI (orchestrator)
    ├── WORKER-001 (processes cooperativa batch 1–20)
    ├── WORKER-002 (processes cooperativa batch 21–40)
    ├── WORKER-003 (processes cooperativa batch 41–60)
    ├── WORKER-004 (processes cooperativa batch 61–80)
    └── WORKER-005 (processes cooperativa batch 81–109)
```

**CERNIQ Example — Monthly ALM report generation for all 109 cooperativas:**

```bash
# Lead CLI on T-06 fans out to 5 worker CLIs
node scripts/patterns/fan-out.js \
  --lead cerniq-cli-t06-lead-001 \
  --worker-count 5 \
  --task-template tasks/alm/generate-monthly-report.json \
  --input-list data/cooperativas/all-109.json \
  --partition-by assets \
  --output-dir reports/monthly/$(date +%Y%m)/ \
  --merge-strategy concat

# Monitor fan-out progress
node scripts/patterns/fan-out-status.js --lead cerniq-cli-t06-lead-001
```

**When to use:** Large homogeneous datasets (all 109 cooperativas), independent processing units, embarrassingly parallel tasks.

**Anti-pattern:** Fan-out to > 20 workers without a merge strategy defined upfront results in output chaos.

### 5.2 Pipeline Pattern

Each CLI in the chain consumes the output of the prior CLI as its input.

**Structure:**
```
RESEARCH CLI → ENRICHER CLI → PERSONALIZER CLI → SENDER CLI
```

**CERNIQ Example — T-04 outbound sales pipeline:**

```bash
# Pipeline definition
node scripts/patterns/pipeline.js \
  --stages \
    "research:cerniq-cli-t04-research-001:agents/prospector.py" \
    "enrich:cerniq-cli-t04-enricher-001:agents/enricher.py" \
    "personalize:cerniq-cli-t04-personalizer-001:agents/personalizer.py" \
    "send:cerniq-cli-t04-sender-001:agents/sender.py" \
  --input-queue data/leads/pending/ \
  --output-dir data/leads/processed/ \
  --dead-letter data/leads/failed/

# Each stage writes to a handoff directory that the next stage polls
# Failure in any stage sends to dead-letter queue, does not block the pipeline
```

**When to use:** Sequential enrichment workflows, multi-stage transformations, when each stage needs prior stage's output.

### 5.3 Reviewer-Worker Pattern

A worker CLI produces an artifact; a separate reviewer CLI validates it before it can merge.

**Structure:**
```
WORKER CLI ──→ (artifact) ──→ REVIEWER CLI ──→ APPROVE/REJECT
                                                     |
                                              (approved) → MASTER MERGE
                                              (rejected) → back to WORKER
```

**CERNIQ Example — ALM module development:**

```bash
# Worker writes new module code to worktree
# Worker registers completion:
npm run session:complete -- \
  --session cerniq-cli-t06-worker-001 \
  --artifact src/alm/modules/duration-gap-v2.ts \
  --type code \
  --reviewer-required true

# Reviewer CLI picks up the review task
npm run session:claim-review -- \
  --session cerniq-cli-t06-reviewer-001 \
  --artifact src/alm/modules/duration-gap-v2.ts

# Reviewer approves or rejects
npm run session:review-decision -- \
  --session cerniq-cli-t06-reviewer-001 \
  --artifact src/alm/modules/duration-gap-v2.ts \
  --decision approve \
  --notes "Tests pass, output within 0.001% of benchmark"

# On approval, T-10 human performs final merge
# gh pr merge {pr-number} --squash
```

**CERNIQ Rule:** No ALM module merges to main without a reviewer-worker separation. The worker and reviewer CLIs must have different session IDs — a session cannot review its own output.

### 5.4 Watchdog Pattern

A dedicated monitor CLI watches a set of service CLIs and restarts or alerts if any fail.

**Structure:**
```
WATCHDOG CLI
    ├── watches SERVICE-001
    ├── watches SERVICE-002
    ├── watches SERVICE-003
    └── on failure: restart + alert T-05
```

**CERNIQ Example — T-04 outbound agent watchdog:**

```bash
# Watchdog script — runs continuously on T-04
cat > scripts/watchdog/t04-agents.sh << 'EOF'
#!/bin/bash
AGENTS=(prospector enricher personalizer sender followup crm-sync)
while true; do
  for agent in "${AGENTS[@]}"; do
    pid=$(pgrep -f "agents/${agent}.py")
    if [ -z "$pid" ]; then
      echo "[$(date)] WATCHDOG: ${agent} is DOWN — restarting"
      source venv/bin/activate
      python agents/${agent}.py &
      # Alert T-05 monitor
      echo "{\"event\": \"agent_restart\", \"agent\": \"${agent}\", \"ts\": \"$(date -Iseconds)\"}" \
        >> .omx/state/operator/escalations.log
    fi
  done
  sleep 30
done
EOF
chmod +x scripts/watchdog/t04-agents.sh

# Run watchdog in its own tmux window
tmux new-window -t cerniq-T04-outbound -n 'watchdog'
tmux send-keys -t cerniq-T04-outbound:watchdog \
  'bash scripts/watchdog/t04-agents.sh' Enter
```

**When to use:** Long-running service processes that must never be down, background Python workers, any process not managed by a process manager.

---

## 6. GIT WORKTREE MANAGEMENT

### 6.1 Naming Convention

Every CLI gets its own git worktree. Shared branches cause merge conflicts and session state corruption. No exceptions.

```
cerniq-wt-{department}-{cli-id}
```

Examples:
- `cerniq-wt-backend-t02-apitest-001`
- `cerniq-wt-quant-t06-validator-003`
- `cerniq-wt-compliance-t08-cossec-001`
- `cerniq-wt-devops-t07-deploy-001`

Worktrees are created in the parent directory of the main repo:
```
/path/to/
  cerniq/                          (main repo — T-10 reviews here)
  cerniq-wt-backend-t02-apitest-001/
  cerniq-wt-quant-t06-validator-003/
  cerniq-wt-compliance-t08-cossec-001/
```

### 6.2 Worktree Creation

```bash
# Standard worktree creation for a new CLI assignment
BRANCH="feature/t02-api-endpoint-validation-$(date +%Y%m%d)"
WORKTREE_PATH="/path/to/cerniq-wt-backend-t02-apitest-001"

git -C /path/to/cerniq worktree add \
  "${WORKTREE_PATH}" \
  -b "${BRANCH}"

# Verify worktree is clean and on correct branch
git -C "${WORKTREE_PATH}" status
git -C "${WORKTREE_PATH}" branch --show-current

# Install dependencies in worktree (if package.json changed)
cd "${WORKTREE_PATH}" && npm ci

# Register worktree with session coordinator
npm run session:register-worktree -- \
  --session cerniq-cli-t02-apitest-001 \
  --worktree "${WORKTREE_PATH}" \
  --branch "${BRANCH}"
```

### 6.3 Worktree Cleanup

```bash
# List all active worktrees
git -C /path/to/cerniq worktree list

# Remove completed worktree (after PR merged)
git -C /path/to/cerniq worktree remove /path/to/cerniq-wt-backend-t02-apitest-001
git -C /path/to/cerniq branch -d "feature/t02-api-endpoint-validation-20260416"

# Batch cleanup: remove all worktrees for merged PRs
node scripts/worktree/cleanup-merged.js --dry-run
node scripts/worktree/cleanup-merged.js --execute

# Emergency cleanup: remove all worktrees for a specific terminal (nuclear scenario)
node scripts/worktree/cleanup-terminal.js --terminal T-02 --force
```

### 6.4 Merge Strategy

All CLIs follow this merge strategy without exception:

1. **CLI commits** to its own worktree branch throughout its task
2. **CLI opens a PR** from its branch targeting `main` when its task is complete
3. **Reviewer CLI** reviews the PR (or human at T-10 for high-risk changes)
4. **Landing gate** runs on every PR: pre-commit hooks + claim-gate validation
5. **Human operator** at T-10 performs the final `gh pr merge` — no autonomous merges to main

```bash
# CLI opens PR (from within its worktree)
cd /path/to/cerniq-wt-backend-t02-apitest-001
gh pr create \
  --title "feat(t02): Add integration tests for /alm/upload endpoint" \
  --body "$(cat .github/pr-template-agent.md | envsubst)" \
  --label "agent:T-02,review-required,test" \
  --reviewer "@klytics/t10-operator"

# Landing gate check (runs automatically on PR open via GitHub Actions)
# Manual trigger:
bash scripts/gates/landing-gate.sh --branch feature/t02-api-endpoint-validation-20260416

# Claim gate check (verifies no unresolved claims remain before merge)
STRICT_CLAIMS=1 bash scripts/gates/claim-gate.sh \
  --branch feature/t02-api-endpoint-validation-20260416
```

### 6.5 Conflict Resolution Protocol

```bash
# Detect conflicts before they reach PR
git -C /path/to/cerniq-wt-backend-t02-apitest-001 \
  merge --no-commit --no-ff origin/main

# If conflicts detected:
# 1. CLI pauses its task
# 2. CLI posts conflict report to .omx/state/team/{id}/conflicts.json
# 3. T-10 reviews and decides: CLI resolves, T-10 resolves, or task reassigned

# After T-10 decision, resolve and continue:
git -C /path/to/cerniq-wt-backend-t02-apitest-001 merge --abort
git -C /path/to/cerniq-wt-backend-t02-apitest-001 rebase origin/main
```

---

## 7. FLEET HEALTH & EMERGENCY PROTOCOLS

### 7.1 Fleet Status Definitions

| Status | Color | Definition | T-10 Action Required |
|---|---|---|---|
| All services up, <5% error rate, all CLIs heartbeating, no blocked sessions | GREEN | Normal operations | None |
| 1 service degraded OR 5–15% error rate OR > 10 stale sessions | YELLOW | Degraded operations | Monitor closely, prepare remediation |
| 1+ service down OR > 15% error rate OR data layer issues | ORANGE | Partial outage | Immediate intervention, escalate |
| Multiple services down OR data integrity risk OR security event | RED | Critical outage | All hands, nuclear protocol |

```bash
# Get current fleet status color
node scripts/fleet/fleet-status.js --output color

# Get full status report
node scripts/fleet/fleet-status.js --output full
```

### 7.2 Per-Terminal Health Check Commands

```bash
# Run health check for any specific terminal
bash scripts/health/terminal-health.sh T-01  # Data layer
bash scripts/health/terminal-health.sh T-02  # Backend
bash scripts/health/terminal-health.sh T-03  # Frontend
bash scripts/health/terminal-health.sh T-04  # Outbound
bash scripts/health/terminal-health.sh T-05  # Monitor
bash scripts/health/terminal-health.sh T-06  # Quant/ALM
bash scripts/health/terminal-health.sh T-07  # DevOps
bash scripts/health/terminal-health.sh T-08  # Compliance
bash scripts/health/terminal-health.sh T-09  # Product

# Full fleet sweep
bash scripts/health/fleet-health-summary.sh

# Check specific CLI session health
npm run session:health -- --session cerniq-cli-t02-apitest-001
```

### 7.3 Hot-Swap Procedure for Failed CLIs

When a CLI session dies unexpectedly, hot-swap it without interrupting surrounding CLIs:

```bash
# Step 1: Identify the failed session
npm run session:list -- --status stale

# Step 2: Check what it had claimed
npm run session:claims -- --session cerniq-cli-t02-apitest-001 --include-stale

# Step 3: Release its stale claims
npm run session:force-release -- \
  --session cerniq-cli-t02-apitest-001 \
  --operator T-10 \
  --reason "session_died_hot_swap"

# Step 4: Deregister the dead session
npm run session:deregister -- --session cerniq-cli-t02-apitest-001 --force

# Step 5: Provision replacement CLI on same terminal
npm run session:register -- \
  --id cerniq-cli-t02-apitest-001b \
  --terminal T-02 \
  --type agent \
  --mission "Resume: API integration tests for /alm/upload" \
  --resume-from cerniq-cli-t02-apitest-001

# Step 6: Launch new CLI in the existing tmux window
tmux send-keys -t cerniq-T02-backend:cli-api-test \
  'claude --session-id cerniq-cli-t02-apitest-001b --resume' Enter
```

### 7.4 Nuclear Pause — Stop All 100 CLIs Safely

Use this when: production data integrity is at risk, a security event is detected, or T-10 decides the fleet must stop for a full review.

```bash
# NUCLEAR PAUSE — Step-by-step, do NOT skip steps

# Step 1: Broadcast pause signal to all active sessions
npm run fleet:pause -- --reason "nuclear_pause" --operator T-10

# Step 2: All CLIs receiving the pause will:
# - Complete their current atomic operation (not mid-file)
# - Release all claims
# - Write their current state to .omx/state/team/{id}/pause-state.json
# - Stop accepting new tasks

# Step 3: Verify all CLIs have paused (wait up to 5 minutes)
watch -n 10 "npm run session:list -- --status working | wc -l"
# Wait until count reaches 0

# Step 4: If any CLIs haven't paused within 5 minutes, force-stop:
npm run fleet:force-stop -- --operator T-10 --reason "nuclear_pause_timeout"

# Step 5: Confirm all tmux windows are idle
tmux list-sessions | grep cerniq

# Step 6: T-10 performs investigation/remediation

# Step 7: Resume fleet (partial — specify terminals)
npm run fleet:resume -- --terminals T-01,T-02 --operator T-10
# Or full resume:
npm run fleet:resume -- --all --operator T-10
```

### 7.5 Recovery Sequence After Full-Fleet Restart

```bash
# Post-restart recovery — run in this exact order

# 1. Verify infrastructure clean state
bash scripts/health/fleet-health-summary.sh

# 2. Clear stale session state
npm run session:cleanup -- --stale-threshold 0 --force

# 3. Verify no orphaned claims
npm run session:claims -- --orphaned
# If orphaned claims exist: npm run session:claims -- --clear-orphaned --operator T-10

# 4. Verify git worktrees are consistent
git -C /path/to/cerniq worktree list
# Any worktrees for dead sessions: git worktree remove --force {path}

# 5. Run landing gate on all open PRs to ensure no broken state merged
gh pr list --state open --json number --jq '.[].number' \
  | xargs -I{} bash scripts/gates/landing-gate.sh --pr {}

# 6. Restart terminals in dependency order (Phase 1 → 5 from Section 3.1)

# 7. Load today's mission queues
npm run queue:load-today

# 8. Run 07:30 standup manually
npm run fleet:standup

# 9. T-10 reviews standup and clears to resume
```

---

## 8. ONBOARDING A NEW CLI

### 8.1 5-Minute CLI Setup Checklist

```bash
# New CLI onboarding — complete all steps before starting work

# [ ] 1. Register session with correct terminal affiliation
npm run session:register -- \
  --id cerniq-cli-{terminal}-{department}-{sequence} \
  --terminal {T-XX} \
  --type agent \
  --mission "{one-sentence mission}"

# [ ] 2. Create dedicated git worktree
git -C /path/to/cerniq worktree add \
  /path/to/cerniq-wt-{department}-{session-id} \
  -b "feature/{department}-{task-slug}-$(date +%Y%m%d)"

# [ ] 3. Verify environment variables are available
cd /path/to/cerniq-wt-{department}-{session-id}
cp /path/to/cerniq/.env.local .env
node -e "console.log('DB:', process.env.DATABASE_URL ? 'OK' : 'MISSING')"

# [ ] 4. Confirm session coordination scripts are accessible
npm run session:list -- --filter terminal={T-XX}

# [ ] 5. Set up heartbeat daemon (must run every 5 min while WORKING)
# Add to CLI's CLAUDE.md or startup prompt:
# "Every 5 minutes, run: npm run session:heartbeat -- --session {session-id}"

# [ ] 6. Confirm queue assignment
cat tasks/terminal/{T-XX}/queue.md | head -20

# [ ] 7. Verify claim-gate is functional
STRICT_CLAIMS=1 npm run session:claim -- \
  --session {session-id} \
  --resource .omx/test-claim \
  --intent read-write
npm run session:release -- --session {session-id} --resource .omx/test-claim
echo "Claim gate: OK"

# [ ] 8. First heartbeat
npm run session:heartbeat -- --session {session-id}
```

### 8.2 Environment Injection

Every CLI must know the following at startup:

```json
{
  "session_id": "cerniq-cli-t06-validator-007",
  "terminal": "T-06",
  "department": "quant-alm",
  "worktree_path": "/path/to/cerniq-wt-quant-t06-validator-007",
  "branch": "feature/quant-nii-sensitivity-update-20260416",
  "main_repo_path": "/path/to/cerniq",
  "services": {
    "api_base": "http://localhost:3000",
    "frontend_base": "http://localhost:3001",
    "outbound_base": "http://localhost:8002",
    "postgres_port": 5433,
    "redis_port": 6380,
    "prisma_studio_port": 5555
  },
  "session_commands": {
    "claim": "npm run session:claim -- --session {id}",
    "release": "npm run session:release -- --session {id}",
    "heartbeat": "npm run session:heartbeat -- --session {id}",
    "complete": "npm run session:complete -- --session {id}"
  },
  "queue_path": "tasks/terminal/T-06/queue.md",
  "output_path": "reports/quant/",
  "escalation_path": ".omx/state/operator/escalations.log"
}
```

### 8.3 Mission Briefing Format

Every CLI receives a mission briefing in this exact format before starting work:

```markdown
## MISSION BRIEF — {session-id}

**Terminal:** T-{XX} — {department name}
**Date:** {YYYY-MM-DD}
**Priority:** HIGH | MEDIUM | LOW
**Estimated Duration:** {X hours}

### Objective
{One paragraph: what you are building/testing/validating and why it matters for CERNIQ}

### Context
- Related PRs: #{numbers}
- Related issues: #{numbers}
- Depends on: {list of dependencies — other CLIs, migrations, etc.}
- Blocked by: {none, or specific blockers}

### Acceptance Criteria
- [ ] {Criterion 1 — must be testable and specific}
- [ ] {Criterion 2}
- [ ] {Criterion 3}

### Files in Scope
- `{path/to/file1}` — {what you're doing with it}
- `{path/to/file2}` — {what you're doing with it}

### Out of Scope (do not touch)
- {files/modules/databases off-limits for this task}

### Output
- Write output to: `{path}`
- Open PR when complete: YES / NO (T-10 review required: YES / NO)
- Post status to: `.omx/state/team/{session-id}/status.json`

### Escalation
If you encounter: {list specific blockers or decision points}
Escalate to: T-10 operator via `.omx/state/operator/escalations.log`
```

### 8.4 First-Hour Task Queue for a New CLI

```markdown
# First-Hour Queue — New CLI Onboarding

## Minute 0–5: Environment Verification
- Run the 5-minute setup checklist from Section 8.1
- Verify all 7 checklist items are GREEN

## Minute 5–15: Domain Familiarization
- Read the terminal's section in this document (Section 2.{XX})
- Review the last 5 closed PRs from your terminal: `gh pr list --state closed --label "agent:T-{XX}" --limit 5`
- Review current open issues for your terminal: `gh issue list --label "fleet:T-{XX}"`

## Minute 15–25: Queue Intake
- Read your mission briefing (format: Section 8.3)
- Review your worktree status: `git status` and `git log --oneline -10`
- Claim your first task file: `npm run session:claim`

## Minute 25–60: First Task Execution
- Execute the first task from your queue
- Heartbeat every 5 minutes
- Commit progress at natural checkpoints (do not accumulate large unstaged diffs)
- When first task is complete: open PR, post status, pull next task from queue
```

---

## 9. PERFORMANCE METRICS

### 9.1 CLI Utilization Rate Targets

| Terminal | Target Utilization | Definition |
|---|---|---|
| T-01 Data Layer | 40% | CLI agents active vs. service monitoring time |
| T-02 Backend | 85% | CLIs working on tasks vs. idle |
| T-03 Frontend | 80% | CLIs writing/testing code vs. idle |
| T-04 Outbound | 90% | Pipeline stages processing leads vs. paused |
| T-05 Monitor | 60% | Active scanning vs. idle watch loops |
| T-06 Quant/ALM | 85% | Module dev/test vs. idle |
| T-07 DevOps | 70% | Active deploys/monitoring vs. idle |
| T-08 Compliance | 75% | Active validation vs. waiting for inputs |
| T-09 Product | 80% | Active spec/research work vs. idle |

**Measuring utilization:**
```bash
# Pull utilization report for past 24h
node scripts/metrics/cli-utilization.js \
  --period 24h \
  --output reports/metrics/utilization-$(date +%Y%m%d).json

# Per-terminal breakdown
node scripts/metrics/cli-utilization.js --terminal T-02 --period 1h
```

### 9.2 Throughput Metrics Per Department

```bash
# Weekly throughput report — all terminals
node scripts/metrics/weekly-throughput.js \
  --week $(date +%Y-W%V) \
  --output reports/weekly/throughput-$(date +%Y%m%d).md

# Department-specific metrics:

# T-02 Backend: endpoints tested per day (target: 10+)
# T-03 Frontend: pages with Playwright coverage (target: 100% of critical flows)
# T-04 Outbound: leads processed per day (target: 20+ enriched, 10+ sent)
# T-06 Quant/ALM: modules with >90% test coverage (target: 62/62)
# T-08 Compliance: compliance checks run per week (target: 1 full sweep/week)

# Sample throughput check
psql -h localhost -p 5433 -U cerniq_user -d cerniq_db -c "
  SELECT
    date_trunc('day', created_at) AS day,
    action_type,
    count(*) AS count
  FROM AuditLog
  WHERE created_at > NOW() - INTERVAL '7 days'
    AND actor_type = 'cli_agent'
  GROUP BY 1, 2
  ORDER BY 1 DESC, 3 DESC;
"
```

### 9.3 Quality Gates

No code merges to `main` without passing all of the following gates:

```bash
# Quality gate checklist — automated via GitHub Actions + manual at T-10

# Gate 1: Tests pass
npm run test -- --passWithNoTests=false
# Target: 100% of existing tests pass, new code >80% covered

# Gate 2: TypeScript compiles clean
npx tsc --noEmit
# Target: 0 TypeScript errors

# Gate 3: ALM module integrity (if alm/ files changed)
npm run test:alm -- --passWithNoTests=false
# Target: all 62 modules pass, mathematical outputs within tolerance

# Gate 4: Claim gate (no unresolved claims on changed files)
STRICT_CLAIMS=1 bash scripts/gates/claim-gate.sh --branch $(git branch --show-current)
# Target: 0 active claims on files in this PR

# Gate 5: Landing gate (pre-commit hooks all pass)
bash scripts/gates/landing-gate.sh --branch $(git branch --show-current)

# Gate 6: Compliance check (if regulatory-touch files changed)
node scripts/compliance/run-checker.js --changed-files-only
# Target: 0 CRITICAL compliance flags

# Gate 7: Human review (T-10 final approval)
gh pr review {pr-number} --approve  # T-10 only, human action
```

### 9.4 Weekly Fleet Report Format

Every Friday at 17:00 AST, the T-05 metric reporter CLI generates the Weekly Fleet Report:

```markdown
# CERNIQ Weekly Fleet Report — Week {W} | {YYYY-MM-DD}

## Fleet Status Summary
- Fleet health at EOW: {GREEN | YELLOW | ORANGE | RED}
- Total CLI-hours logged: {N}
- Total tasks completed: {N}
- PRs opened: {N} | PRs merged: {N} | PRs closed without merge: {N}
- Nuclear pauses this week: {N}

## By Terminal

### T-01 Data Layer
- Migrations run: {N}
- Slow queries resolved: {N}
- DB uptime: {%}
- Backup integrity checks: {N/N passed}

### T-02 Backend Core
- Endpoints tested: {N}
- Test coverage delta: {+/-}%
- API error rate (weekly avg p95): {ms}
- Schema sync runs: {N}

### T-03 Frontend
- Playwright tests added: {N}
- A11y violations resolved: {N}
- Build success rate: {%}
- Bundle size delta: {+/-} KB

### T-04 Outbound Sales Engine
- Cooperativas contacted: {N}
- Emails sent: {N} | Opened: {N} ({%}) | Replied: {N} ({%})
- Demos booked: {N}
- Pipeline stage distribution: Prospected:{N} / Enriched:{N} / Sent:{N} / Replied:{N}

### T-06 Quant/ALM Engine
- Modules at >90% coverage: {N}/62
- Backtest runs completed: {N}
- Mathematical tolerance violations: {N}
- New modules delivered: {N}

### T-07 DevOps/Infra
- Deploys to Railway: {N}
- Deploys to Vercel: {N}
- Rollbacks: {N}
- Deployment success rate: {%}

### T-08 Compliance
- Compliance sweeps completed: {N}
- COSSEC flags raised: {N} ({N} resolved)
- NCUA regulatory updates processed: {N}
- Audit log integrity checks: {N/N passed}

## Quality Metrics
- Overall test pass rate: {%}
- Gate violations (PRs that failed a gate): {N}
- Merge queue cleanliness: {N} PRs awaiting review at EOW

## Next Week Priorities (T-10 set)
1. {Priority 1}
2. {Priority 2}
3. {Priority 3}

## Blockers Carried Over
- {Blocker}: assigned to {T-XX}, ETA {date}

---
*Generated by T-05 metric reporter CLI — {timestamp}*
*Reviewed and approved by T-10 operator — {timestamp}*
```

---

## APPENDIX A: FULL TMUX SESSION MAP

```bash
# Complete list of all tmux sessions in a healthy fleet

cerniq-T01-data          (windows: pg-console, redis-console, prisma-studio, cli-migration, cli-perf)
cerniq-T02-backend       (windows: api-server, test-watch, cli-api-test, cli-endpoint, cli-schema)
cerniq-T03-frontend      (windows: next-dev, tsc-watch, cli-ui-test, cli-a11y)
cerniq-T04-outbound      (windows: api-main, agent-prospector, agent-enricher, agent-personalizer, agent-sender, agent-followup, agent-crm, cli-lead-research, cli-email-draft, cli-crm-validate)
cerniq-T05-monitor       (windows: health-poller, railway-logs, sentry-feed, cli-log-scanner, cli-metric-reporter)
cerniq-T06-quant         (windows: module-tests, backtest, cli-validator, cli-backtester, cli-report-qa)
cerniq-T07-devops        (windows: gh-actions, railway-status, cli-deploy, cli-migration-runner, cli-secret-rotation)
cerniq-T08-compliance    (windows: compliance-runner, reg-report-gen, cli-cossec, cli-ncua, cli-audit)
cerniq-T09-product       (windows: cli-spec-writer, cli-competitor, cli-ux-research, issues-triage)
cerniq-T10-operator      (windows: fleet-dashboard, pr-queue, escalation-inbox, decision-log, queue-mgmt)

# Attach to any terminal
tmux attach -t cerniq-T{XX}-{name}

# List all active cerniq sessions
tmux list-sessions | grep cerniq

# Kill a specific terminal (use with care — T-10 approval required)
tmux kill-session -t cerniq-T{XX}-{name}
```

## APPENDIX B: CLI SESSION ID REGISTRY FORMAT

```
cerniq-cli-t{XX}-{function}-{sequence}

Where:
  XX       = terminal number, zero-padded (01–09)
  function = short function name (apitest, validator, deploy, cossec, etc.)
  sequence = 3-digit sequence number (001–999), reset per function per day

Examples:
  cerniq-cli-t02-apitest-001
  cerniq-cli-t06-validator-003
  cerniq-cli-t04-enricher-002
  cerniq-cli-t08-ncua-001
  cerniq-cli-t07-deploy-001
```

## APPENDIX C: ESCALATION CODE REFERENCE

| Code | Meaning | T-10 SLA |
|---|---|---|
| ESC-001 | Service down (T-01/02/03/04) | 5 minutes |
| ESC-002 | Data integrity risk | Immediate |
| ESC-003 | Security event detected | Immediate + nuclear pause |
| ESC-004 | Compliance flag (CRITICAL) | 30 minutes |
| ESC-005 | Deploy failed + rollback needed | 10 minutes |
| ESC-006 | ALM math tolerance exceeded | 1 hour |
| ESC-007 | CLI claim conflict unresolved | 15 minutes |
| ESC-008 | Queue depth > 1000 tasks | 1 hour rebalance |
| ESC-009 | Outbound send failure rate > 30% | 30 minutes |
| ESC-010 | Human decision required on PR | Next review window |

---

*CERNIQ Vol. 6 — Terminal Fleet Operations Bible*
*Owner: Erwin Kiess-Alfonso / KLYTICS LLC*
*Classification: Internal Only — DO NOT PUBLISH*
*Volume 6 of the CERNIQ Bible Series*
*Last Updated: 2026-04-16*
