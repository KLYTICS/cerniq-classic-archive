# AGENTS.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## Project Overview

CapexCycleOS is an institutional-grade quantitative finance platform providing real-time market data, advanced risk analytics, technical charting, options analysis, and execution quality tools. It also includes SpendCheck, an expense management module.

## Architecture

The system runs **two backends** in parallel:

**Rust Backend (Axum)** - Port 8001
- Core financial analytics: portfolios, risk models, screeners, valuation engines
- Authentication (JWT/Argon2)
- SEC filings parsing, feature engineering
- WebSocket streaming for real-time data
- Direct PostgreSQL via SQLx

**Node.js Backend (NestJS)** - Port 3000
- Market data via Yahoo Finance API
- Options pricing and Greeks calculations
- Execution analytics and backtesting
- Real-time data streaming (Socket.IO)
- SpendCheck: expense tracking with receipt OCR (LLM-powered)
- PostgreSQL via Prisma ORM

**Frontend (Next.js 16)** - Port 3001
- React 19 with App Router
- State: Zustand (global), React Query (server)
- Charts: Recharts (simple), Plotly.js (3D/complex)
- Styling: Tailwind CSS 4

**Infrastructure**
- Database: TimescaleDB (PostgreSQL 15) on port 5433
- Cache: Redis 7 on port 6380

## Development Commands

### Start Infrastructure
```bash
docker-compose up postgres redis -d
```

### Run Services
```bash
# Rust backend (from repo root)
cd backend && cargo run

# Node backend (from repo root)  
cd backend-node && npm run start:dev

# Frontend (from repo root)
cd frontend && npm run dev
```

### Testing
```bash
# Rust tests
cd backend && cargo test

# Single Rust test
cd backend && cargo test test_name

# Node tests
cd backend-node && npm run test
cd backend-node && npm run test:e2e
cd backend-node && npm run test:cov

# Frontend lint
cd frontend && npm run lint
```

### Database Operations
```bash
# Run Rust migrations
cd backend && sqlx migrate run

# Create new Rust migration
cd backend && sqlx migrate add migration_name

# Generate Prisma client (Node)
cd backend-node && npx prisma generate

# Reset database (destroys data)
make db-reset

# Open PostgreSQL shell
docker-compose exec postgres psql -U capexcycle -d capexcycle
```

### Code Quality
```bash
# Rust
cd backend && cargo fmt      # Format
cd backend && cargo clippy   # Lint

# Node/Frontend
cd backend-node && npm run lint
cd frontend && npm run lint
```

## Key Module Locations

### Rust Backend (`backend/src/`)
- `routes/` - API route handlers (portfolios, risk, screener, filings, valuation, etc.)
- `valuation/cyclical.rs` - Mid-cycle earnings normalization for semi equipment stocks
- `compute.rs` - Numerical computations (VaR, risk decomposition)
- `auth/` - JWT authentication and password hashing
- `services/` - Data pipeline services

### Node Backend (`backend-node/src/`)
- `market-data/` - Yahoo Finance integration, technical indicators
- `options/` - Greeks calculations, options strategies
- `risk/` - Component VaR, GARCH forecasting, stress testing
- `execution/` - Backtesting engine, execution quality
- `expenses/` - SpendCheck expense management
- `llm/` - Receipt parsing via OpenAI/Anthropic/Ollama

### Frontend (`frontend/app/`)
- `dashboard/` - Main overview page
- `portfolios/` - Portfolio management
- `risk-analytics/` - VaR, stress testing UI
- `options/` - Options chain, Greeks display
- `volatility-analytics/` - IV surface, vol cone
- `spendcheck/` - Expense tracking UI

## Environment Configuration

Copy `.env.example` to `.env` and configure:
- `DATABASE_URL` - PostgreSQL connection (default port 5433)
- `REDIS_URL` - Redis connection (default port 6380)
- `JWT_SECRET` - Authentication secret
- `YAHOO_FINANCE_API_KEY` - Optional, for enhanced market data
- `OPENAI_API_KEY` or `ANTHROPIC_API_KEY` - For SpendCheck receipt parsing
- `USE_LOCAL_LLM=true` + `OLLAMA_BASE_URL` - For local LLM instead

## API Patterns

- REST endpoints follow `/api/{domain}/{resource}` pattern
- WebSocket at `/ws` (Rust backend) for real-time streaming
- Socket.IO at Node backend for live price/Greeks updates
- Both backends use Redis for caching with similar TTL strategies

## Testing Data

SQL fixtures in repo root (`test_data_*.sql`) can populate test data:
```bash
psql -U capexcycle -d capexcycle -f test_data_lrcx_v2.sql
```

## Build for Production

```bash
# Full build
cd backend && cargo build --release
cd frontend && npm run build

# Docker
docker-compose up --build
```
