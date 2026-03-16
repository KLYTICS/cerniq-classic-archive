# CapexCycleOS - Project Summary

> **Institutional-Grade Quantitative Research Platform for the AI/Defense/Compute Capital Expenditure Cycle**

---

## Executive Overview

CapexCycleOS is a turnkey quantitative research system designed to track and analyze the $2+ trillion AI infrastructure capex wave flowing through a 4-layer supply chain. The platform delivers systematic valuation signals, portfolio risk management, and actionable daily intelligence to institutional investors.

**Target Market:** Hedge funds, family offices, and boutique asset managers with $500M+ tech exposure.

---

## Project State

### Current Implementation Status

| Phase | Status | Description |
|-------|--------|-------------|
| **Phase 0: Local Prototype** | **Complete** | Streamlit apps, risk parity optimizer, VaR/CVaR reports, screener |
| **Phase 1: Containerization** | **In Progress** | Docker, Compose, CI/CD pipelines |
| **Phase 2: Backend Services** | **In Progress** | Rust API (Axum), PostgreSQL, authentication, WebSocket |
| **Phase 3: Data Pipelines** | **In Progress** | SEC filing parser, market data, feature store |
| **Phase 4: Advanced Features** | **Pending** | Distributed backtesting, ML alerts, multi-tenant SaaS |

### Component Readiness

```
[====================] Risk Parity Optimizer     100% - DEPLOYED
[====================] VaR/CVaR Risk Reports     100% - DEPLOYED
[================    ] Valuation Screener        80%  - Backend Complete
[==============      ] Rust Compute Engine       70%  - Core Functions Working
[============        ] Frontend Dashboard        60%  - Basic UI Ready
[==========          ] Kubernetes Infra          50%  - Manifests Created
[========            ] Real-time Alerts          40%  - Framework Ready
```

### Tech Stack

| Layer | Technology | Why |
|-------|------------|-----|
| **API** | Bun.js / Rust (Axum) | 3x faster than Node.js, memory-safe compute |
| **Database** | PostgreSQL + TimescaleDB | Time-series optimized, 10:1 compression |
| **Cache** | Redis | <1ms hot data access |
| **Compute** | Rust (ndarray, CVXPY) | 38x faster than NumPy for optimization |
| **Storage** | Cloudflare R2 | 63x cheaper than S3, zero egress |
| **Message Queue** | NATS JetStream | 11M msgs/sec, simpler than Kafka |
| **Orchestration** | Kubernetes + ArgoCD | GitOps-native deployment |

---

## Market Implications

### The AI Capex Opportunity

The AI infrastructure buildout represents the largest capital expenditure cycle since the internet era. CapexCycleOS tracks this investment wave across four interconnected layers:

```
Layer 0 (Inputs)          → NVDA, AMD, MU, CDNS, SNPS
Layer 1 (Enablement)      → LRCX, AMAT, KLAC, ASML, TER
Layer 2 (Infrastructure)  → MSFT, GOOGL, AMZN, ANET, DLR
Layer 3 (Monetization)    → PLTR, SNOW, RTX, LMT, IONQ
```

### Why This Matters

| Factor | Market Impact |
|--------|---------------|
| **Capex Visibility** | Hyperscalers committing $200B+ annually to AI infrastructure |
| **Supply Chain Bottlenecks** | Semiconductor equipment cycles create asymmetric opportunities |
| **Regime Transitions** | Early detection of acceleration/deceleration = alpha generation |
| **Correlation Risk** | AI stocks increasingly move together - systematic risk management required |

### Competitive Advantage

1. **Systematic Approach**: Removes emotional bias from investment decisions
2. **Real-Time Intelligence**: Daily ranked opportunities vs quarterly analyst updates
3. **Evidence Lineage**: Every score traces to SEC filings and verified data
4. **Risk Integration**: Valuation + risk in one platform (not siloed tools)

---

## Integration & Impact

### System Integration Architecture

```
                    ┌─────────────────────────────────────┐
                    │         External Data Sources        │
                    │  SEC Edgar │ Market Data │ Earnings  │
                    └─────────────┬───────────────────────┘
                                  │
                    ┌─────────────▼───────────────────────┐
                    │          Data Ingestion Layer        │
                    │   Filing Parser │ Price Fetcher      │
                    └─────────────┬───────────────────────┘
                                  │
                    ┌─────────────▼───────────────────────┐
                    │          Feature Store               │
                    │   TimescaleDB │ Redis Cache          │
                    └─────────────┬───────────────────────┘
                                  │
        ┌─────────────────────────┼─────────────────────────┐
        │                         │                         │
┌───────▼───────┐       ┌────────▼────────┐       ┌────────▼────────┐
│   Valuation   │       │      Risk       │       │    Portfolio    │
│    Engines    │       │     Engine      │       │    Optimizer    │
│ Cyclical/     │       │ VaR/CVaR/       │       │ Risk Parity/    │
│ Compounder/   │       │ Factor/         │       │ Mean-Variance   │
│ Frontier      │       │ Correlation     │       │                 │
└───────┬───────┘       └────────┬────────┘       └────────┬────────┘
        │                        │                         │
        └────────────────────────┼─────────────────────────┘
                                 │
                    ┌────────────▼────────────────────────┐
                    │           Serving Layer              │
                    │  REST API │ WebSocket │ Dashboard    │
                    └────────────┬────────────────────────┘
                                 │
                    ┌────────────▼────────────────────────┐
                    │              Clients                 │
                    │   Hedge Funds │ Family Offices       │
                    └─────────────────────────────────────┘
```

### Deployment Integration

| Environment | Stack | Purpose |
|-------------|-------|---------|
| **Local Dev** | Docker Compose | Rapid iteration |
| **Staging** | k3d (single-node K8s) | Integration testing |
| **Production** | Multi-AZ EKS/GKE | High availability |

### API Integration Points

```bash
# REST API Endpoints
GET  /api/v1/screener          # Valuation scores
GET  /api/v1/risk/var          # VaR/CVaR calculations
GET  /api/v1/portfolio         # Portfolio analytics
POST /api/v1/optimize          # Risk parity optimization
WS   /ws/alerts                # Real-time alerts

# Webhook Integrations
→ Slack notifications
→ Email alerts
→ Custom webhooks
```

### Business Impact Metrics

| Metric | Target | Impact |
|--------|--------|--------|
| **Hit Rate** | >60% on top-10 ranked stocks | Direct alpha generation |
| **Sharpe Ratio** | >1.5 on model portfolio | Risk-adjusted outperformance |
| **Max Drawdown** | <15% | Capital preservation |
| **Time to Insight** | T+1hr vs T+1week | First-mover advantage |
| **ROI** | 25-30x cost annually | Avoid one blowup = 10x+ value |

---

## Features

### 1. Multi-Regime Valuation Engines

**Cyclical Engine** (LRCX, AMAT, KLAC, ASML)
- Mid-cycle earnings normalization
- Cycle position detection (Early/Mid/Late/Trough)
- Regime-adjusted multiples (8-18x P/E)
- Supply chain shock stress testing

**Compounder Engine** (ANET, CDNS, SNPS, NOW)
- Quality-adjusted multiple bands
- Quality score (0-100): ROIC, FCF, moat, growth stability
- Historical valuation percentiles
- Moat durability testing

**Frontier Engine** (IONQ, RGTI, early-stage defense)
- Scenario probability weighting
- Kelly criterion position sizing
- Milestone-based valuation

### 2. Risk Management Suite

| Capability | Description |
|------------|-------------|
| **VaR/CVaR** | Parametric & historical methods (95%, 99% confidence) |
| **Factor Decomposition** | Market beta, size, value, momentum attribution |
| **Correlation Regime** | Auto-triggers de-risking when AI stocks move together |
| **Drawdown Monitoring** | Real-time alerts on position and portfolio level |
| **Stress Testing** | Historical (2008, COVID) and hypothetical scenarios |

### 3. Portfolio Construction

- **Risk Parity Optimization**: Equal risk contribution allocation
- **Mean-Variance Optimization**: Sharpe ratio maximization
- **Rebalancing Triggers**:
  - Forced: Position >10%, correlation >0.9
  - Opportunistic: Valuation signals
- **Layer Allocation Framework**: 30-40% L0, 20-25% L1, 25-35% L2, 5-15% L3

### 4. Systematic Scoring

```
┌─────────────────────────────────────────────────────────┐
│                    KPI Scorecard                         │
├─────────────────────────────────────────────────────────┤
│  Revenue Acceleration    [████████░░] 80                 │
│  Margin Trajectory       [███████░░░] 70                 │
│  Capital Efficiency      [█████████░] 90                 │
│  Backlog Visibility      [██████░░░░] 60                 │
│  Management Quality      [████████░░] 85                 │
├─────────────────────────────────────────────────────────┤
│  COMPOSITE SCORE                        77/100           │
│  SIGNAL: BUY | Position Size: 3.2%                       │
└─────────────────────────────────────────────────────────┘
```

### 5. Real-Time Intelligence

- **Daily Rankings**: Value + momentum + quality composite
- **Regime Alerts**: "Semiconductor orders decelerating"
- **Portfolio Reports**: VaR, Sharpe, drawdown, attribution
- **Thesis Monitoring**: "What breaks the thesis" watchlist
- **WebSocket Alerts**: Score changes, correlation spikes, VaR breaches

### 6. Data Pipeline

| Source | Frequency | Content |
|--------|-----------|---------|
| SEC Edgar | Daily | 10-K, 10-Q filings, HTML extraction |
| Market Data | EOD + intraday | Prices, volumes, fundamentals |
| Earnings Calls | Quarterly | NLP transcript analysis |
| Feature Store | Real-time | Computed features, cached scores |

---

## Quick Start

```bash
# Clone and setup
git clone <repo-url>
cd CapexCycleOS

# Local development
make docker-up       # Start PostgreSQL, Redis
make install         # Install dependencies
make migrate         # Run database migrations
make dev             # Start API + Frontend

# Run standalone projects
cd projects/01-risk-parity-ai-infra && streamlit run app.py
cd projects/02-var-risk-reports && streamlit run app.py
cd projects/03-ai-valuation-screener && streamlit run app.py
```

---

## Roadmap

| Quarter | Focus | Deliverables |
|---------|-------|--------------|
| **Q1 2026** | Foundation | Core engines, risk reporting, 40 tickers |
| **Q2 2026** | Scale | 100 tickers, earnings NLP, real-time alerts |
| **Q3 2026** | Intelligence | Supply chain graphs, options flow, macro regime |
| **Q4 2026** | Enterprise | SOC 2, white-label, multi-tenant SaaS |

---

## Pricing Model

| Tier | Annual Cost | Includes |
|------|-------------|----------|
| **Base Platform** | $250K | 50 tickers, 10 users, daily updates |
| **Enterprise** | $500K | Unlimited tickers/users, real-time, API access |
| **Implementation** | $75K | 30-day onboarding, custom integrations |

**ROI Projection**: 25-30x in Year 1 for a $2B fund with $500M tech book

---

## Documentation

- [`START_HERE.md`](./START_HERE.md) - Onboarding guide
- [`ARCHITECTURE.md`](./ARCHITECTURE.md) - System design deep-dive
- [`QUICKSTART.md`](./QUICKSTART.md) - Development setup
- [`EXECUTION_PLAN.md`](./EXECUTION_PLAN.md) - Implementation timeline
- [`docs/`](./docs/) - Runbooks, API specs, deployment guides

---

## License & Contact

**CapexCycleOS** - Institutional Quantitative Research Platform

For inquiries: Contact the development team

---

*Built for institutional investors who refuse to fly blind in the AI capex cycle.*
