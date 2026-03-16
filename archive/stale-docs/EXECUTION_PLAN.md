# Execution Plan: From Quant Projects to Production Platform

## Mission
Build a portfolio of quant-finance projects that demonstrate systematic trading knowledge, risk management expertise, and production engineering skills—positioning you for quantitative developer roles at hedge funds, prop shops, and fintech companies.

## Strategic Framework: The AI Capex Cycle Thesis

**Investment Thesis:**  
The AI infrastructure buildout (2023-2027) represents a multi-trillion dollar capital expenditure wave spanning semiconductors, data centers, networking, and power infrastructure. This creates:

1. **Layered opportunities**: From inputs (chips) → enablement (equipment) → infrastructure (cloud) → monetization (applications)
2. **Cyclical valuation challenges**: Traditional metrics fail for companies in different cycle phases
3. **Risk concentration**: High correlation within layers, non-obvious correlations across layers
4. **Information edge**: Public filings contain leading indicators of capex acceleration/deceleration

**Our Edge:**  
Systematic framework that tracks the entire stack, identifies valuation dislocations, and manages risk through regime-aware allocation.

---

## Phase 0: Quick Wins (Weeks 1-2)
**Goal:** Ship 3 production-ready projects that demonstrate core quant skills.

### Project 1: Risk Parity Portfolio - AI Infrastructure ✓
**Status:** Complete  
**Location:** `/projects/01-risk-parity-ai-infra/`

**What it demonstrates:**
- Modern portfolio theory (risk parity vs mean-variance)
- Convex optimization (CVXPY)
- Financial domain knowledge (AI supply chain layers)
- Interactive visualization (Streamlit)

**Technical highlights:**
- Covariance estimation with lookback periods
- Iterative solver for equal risk contribution
- Backtesting with multiple benchmarks
- Clean separation: optimization engine → app layer

**Next enhancements:**
- [ ] Add Ledoit-Wolf covariance shrinkage
- [ ] Implement transaction cost modeling
- [ ] Add regime detection (high/low vol states)
- [ ] Unit tests for optimizer

---

### Project 2: VaR/CVaR Risk Report Generator ✓
**Status:** Complete  
**Location:** `/projects/02-var-risk-reports/`

**What it demonstrates:**
- Institutional risk management practices
- Statistical rigor (VaR, CVaR, drawdown)
- Production-grade engineering (modular, testable)
- Multiple output formats (interactive + export)

**Technical highlights:**
- Historical and parametric VaR calculation
- Component VaR (risk attribution)
- Rolling volatility analysis
- Normality testing (Q-Q plots)

**Next enhancements:**
- [ ] PDF report generation with ReportLab
- [ ] FastAPI endpoint for programmatic access
- [ ] Monte Carlo VaR simulation
- [ ] GARCH volatility forecasting
- [ ] Backtesting VaR coverage (Kupiec test)

---

### Project 3: AI Semiconductor Valuation Screener
**Status:** Next to build  
**Location:** `/projects/03-ai-valuation-screener/`

**Objective:**  
Multi-regime valuation engine for cyclical semiconductor equipment stocks (LRCX, AMAT, KLAC, ASML, TER).

**Core Features:**
1. **Mid-Cycle Normalization:**
   - Identify peak/trough earnings in historical cycles
   - Normalize current EPS to mid-cycle baseline
   - Adjust P/E multiples for cycle position

2. **Valuation Bands:**
   - Historical P/E, P/S, EV/EBITDA ranges
   - Percentile-based buy/sell zones
   - Adjust for current cycle regime

3. **Cycle Regime Detection:**
   - Backlog momentum (YoY, QoQ)
   - Capex momentum from customers (NVDA, AMD, hyperscalers)
   - WFE (wafer fab equipment) spending forecasts
   - Classify: Early/Mid/Late/Trough

4. **Output:**
   - Ranked opportunities (most undervalued given regime)
   - Risk scores (cyclical volatility, concentration)
   - Alerts: "LRCX at 0.8x mid-cycle earnings, 15th percentile P/E"

**Data Sources:**
- Quarterly filings (SEC EDGAR API)
- Price data (yfinance)
- Macro proxies (FRED: semiconductor billings, PMI)

**Why it's powerful:**
- Shows understanding of cyclical valuation
- Demonstrates data engineering (filings parsing)
- Sector expertise (semiconductor capex cycle)
- Actionable signals, not just academic backtests

**Timeline:** 2-3 days
- Day 1: Data pipeline (filings + prices)
- Day 2: Valuation engine + cycle detection
- Day 3: Streamlit UI + ranked screener

---

## Phase 1: Infrastructure & Testing (Weeks 3-4)
**Goal:** Add production-grade infrastructure around the projects.

### 1.1 Testing & Quality
```bash
# Add pytest structure
/tests/
├── test_risk_parity.py
├── test_var_engine.py
└── test_valuation.py

# Coverage target: 80%+ for core modules
pytest --cov=projects --cov-report=html
```

**Deliverables:**
- [ ] Unit tests for all optimization/calculation functions
- [ ] Integration tests for data loading
- [ ] CI/CD with GitHub Actions (run tests on push)
- [ ] Pre-commit hooks (black, flake8, mypy)

### 1.2 Containerization
```dockerfile
# Dockerfile for each project
FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
CMD ["streamlit", "run", "app.py", "--server.port=8501"]
```

**Deliverables:**
- [ ] Dockerfile for each project
- [ ] docker-compose.yml for local development
- [ ] .dockerignore for efficient builds

### 1.3 Documentation
**Deliverables:**
- [ ] API documentation (Sphinx or MkDocs)
- [ ] Architecture decision records (ADR)
- [ ] Runbooks: "How to deploy", "How to add new assets"

---

## Phase 2: Data Layer & Feature Store (Month 2)
**Goal:** Build reusable data infrastructure that all projects share.

### 2.1 Data Pipeline Architecture
```
/platform/services/data-ingest/
├── sources/
│   ├── sec_filings.py      # SEC EDGAR API
│   ├── market_data.py      # yfinance + fallback to AlphaVantage
│   ├── macro_data.py       # FRED API
│   └── earnings_calls.py   # Transcripts (future)
├── pipeline.py             # Orchestration
├── cache.py                # Redis/Parquet caching
└── normalization.py        # Data cleaning & standardization
```

**Key Components:**

**2.1.1 SEC Filings Parser**
- Quarterly 10-Q, Annual 10-K
- Extract: Revenue, Operating Income, Capex, R&D, Backlog
- Handle restatements, segment reporting
- Store: TimescaleDB (time-series) or Parquet files

**2.1.2 Market Data Aggregator**
- Primary: yfinance (free, good for prototypes)
- Fallback: AlphaVantage, Polygon.io
- Store adjusted prices, splits, dividends
- Cache: 24-hour TTL for end-of-day data

**2.1.3 Feature Engineering**
```python
# Computed features
features = {
    'fundamental': [
        'revenue_yoy', 'revenue_qoq',
        'margin_expansion', 'capex_intensity',
        'backlog_proxy', 'days_sales_outstanding'
    ],
    'technical': [
        'momentum_12_1', 'relative_strength',
        'beta_spy', 'correlation_sector'
    ],
    'valuation': [
        'pe_ratio', 'peg_ratio', 'ev_ebitda',
        'fcf_yield', 'pe_percentile_5y'
    ],
    'regime': [
        'vol_regime', 'cycle_phase',
        'momentum_regime', 'valuation_regime'
    ]
}
```

**Deliverables:**
- [ ] SEC filings parser (start with 10-K/10-Q)
- [ ] Unified market data interface
- [ ] Feature store with versioning
- [ ] Backfill scripts for historical data
- [ ] Data quality checks (missing data, outliers)

---

## Phase 3: Platform Services (Month 3)

### 3.1 API Layer (FastAPI)
```
/platform/services/api/
├── main.py                 # FastAPI app
├── routes/
│   ├── risk.py            # POST /risk-report
│   ├── portfolio.py       # GET /portfolio/{id}
│   ├── valuation.py       # GET /screener?sector=semis
│   └── health.py          # GET /health
├── models/               # Pydantic schemas
└── middleware/           # Auth, rate limiting
```

**Endpoints:**
```python
# Risk report
POST /api/v1/risk-report
Body: {"tickers": [...], "weights": [...], "confidence": 0.95}
Response: {var, cvar, max_dd, pdf_url}

# Valuation screener
GET /api/v1/screener?sector=semiconductor&regime=mid-cycle
Response: [
    {ticker, fair_value, current_price, upside, risk_score},
    ...
]

# Portfolio optimization
POST /api/v1/optimize
Body: {"tickers": [...], "method": "risk_parity", "constraints": {...}}
Response: {weights, risk_contrib, backtest}
```

**Deliverables:**
- [ ] FastAPI service with endpoints above
- [ ] API key authentication (simple)
- [ ] Rate limiting (100 req/hour per key)
- [ ] OpenAPI/Swagger docs
- [ ] Deploy to Cloud Run or Railway

### 3.2 Batch Processing (Airflow or Prefect)
```
/platform/services/scheduler/
├── dags/
│   ├── daily_data_refresh.py
│   ├── weekly_screener_run.py
│   └── monthly_rebalance.py
└── tasks/
    ├── fetch_prices.py
    ├── compute_features.py
    └── send_alerts.py
```

**Scheduled Jobs:**
- Daily: Fetch EOD prices, update features
- Weekly: Run valuation screener, send top picks
- Monthly: Rebalance risk parity portfolio, generate reports

**Deliverables:**
- [ ] Airflow DAGs or Prefect flows
- [ ] Error handling & retries
- [ ] Alerting (Discord/Slack webhook)

---

## Phase 4: Kubernetes & HPC (Month 4+)

### 4.1 Why Kubernetes?
1. **Scalability**: Run 1,000 backtests in parallel
2. **Resilience**: Auto-restart failed jobs
3. **Resource efficiency**: Burst compute, scale down idle
4. **GitOps**: Declarative config, version controlled

### 4.2 Architecture
```
/platform/infra/k8s/
├── base/                   # Common manifests
│   ├── namespace.yaml
│   ├── configmap.yaml
│   └── secrets.yaml
├── services/
│   ├── api-deployment.yaml
│   ├── streamlit-deployment.yaml
│   └── batch-job.yaml
├── data/
│   ├── postgres-statefulset.yaml
│   ├── redis-deployment.yaml
│   └── minio-deployment.yaml (S3-compatible object storage)
└── argo/                   # ArgoCD GitOps
    ├── application.yaml
    └── sync-policy.yaml
```

### 4.3 HPC with KubeRay
**Use case:** Parallelize backtests across 100+ stock universes.

```python
# Ray-based backtester
import ray

@ray.remote
def backtest_strategy(ticker, params):
    # Run strategy on single ticker
    return {ticker: metrics}

# Distribute across cluster
results = ray.get([
    backtest_strategy.remote(t, params)
    for t in tickers
])
```

**Infrastructure:**
- KubeRay operator for Ray cluster management
- Autoscaling: 1-10 worker nodes
- Spot instances for cost savings

**Deliverables:**
- [ ] Kubernetes cluster (local: k3d, cloud: GKE/EKS)
- [ ] ArgoCD for GitOps deployments
- [ ] KubeRay for distributed backtesting
- [ ] Helm charts for all services
- [ ] Monitoring: Prometheus + Grafana

---

## Phase 5: Full Capex Cycle OS (Months 5-6)

### 5.1 Product Vision
**"Fractional Quant Department Install"**

A turn-key platform that hedge funds, family offices, or research shops can deploy to:
1. Track the AI capex cycle across all layers
2. Get daily valuation signals and risk reports
3. Backtest factor strategies
4. Monitor portfolio risk in real-time

**Modules:**
1. **Market Map Dashboard**: Visual layer hierarchy, bottleneck tracking
2. **Valuation Engine**: Multi-regime pricing for cyclicals, compounders, frontier
3. **Risk Console**: Real-time VaR, stress testing, correlation tracking
4. **Portfolio Optimizer**: Risk parity, factor tilts, constraint handling
5. **Alert System**: "LRCX just entered buy zone", "Correlation spike detected"

### 5.2 Technology Stack (Final)
| Layer | Technology | Rationale |
|-------|-----------|-----------|
| Frontend | Next.js (React) | Fast, SEO-friendly dashboards |
| API Gateway | Bun.js + tRPC | TypeScript end-to-end, fast edge functions |
| Compute Kernels | Rust | 10-100x speedup for optimization, simulations |
| Orchestration | Temporal | Durable workflows, better than Airflow for complex DAGs |
| Data Processing | DuckDB + Polars | Fast analytics on Parquet, no external DB needed |
| Object Storage | Cloudflare R2 | S3-compatible, cheaper egress |
| Caching | Redis | Feature store, real-time data |
| Observability | Grafana + Loki | Metrics + logs in one place |
| Deployment | Kubernetes + ArgoCD | GitOps, autoscaling, multi-cloud |

### 5.3 Deliverables (MVP)
- [ ] Next.js dashboard with 5 main views
- [ ] Bun.js API with 10+ endpoints
- [ ] Rust optimizer (2-3x faster than Python)
- [ ] Temporal workflows for data pipelines
- [ ] Full k8s deployment (GKE or EKS)
- [ ] Runbooks & SOPs
- [ ] Sales deck for "fractional quant install"

---

## Success Metrics

### Portfolio Metrics (What You Ship)
- **Week 2:** 3 projects live, deployed to Streamlit Cloud
- **Week 4:** GitHub with tests, CI/CD, 90%+ coverage on core modules
- **Month 2:** API deployed, 100+ requests/day handled
- **Month 3:** Kubernetes cluster running, backtests completing in <5min
- **Month 4:** Full platform demo video, product pitch deck

### Career Metrics (Job Search)
- **Applications:** 50+ quant dev roles
- **Screens:** 15+ phone screens
- **Onsites:** 5+ final rounds
- **Offers:** 2+ competing offers

### Investment Metrics (Backtest)
- **Sharpe ratio:** >1.5 on AI infra risk parity
- **Max drawdown:** <20% on diversified portfolio
- **Hit rate:** >60% on valuation screener top picks

---

## Risk Factors & Mitigations

| Risk | Impact | Mitigation |
|------|--------|-----------|
| **Data quality:** Bad filings data | High | Implement data validation, multiple sources |
| **Overfitting:** Strategies that don't generalize | High | Walk-forward validation, out-of-sample testing |
| **Scope creep:** Platform too ambitious | Medium | Focus on Phase 0-2, defer Phase 4-5 if needed |
| **Technical debt:** Fast iteration → messy code | Medium | Mandatory tests, code reviews, refactor sprints |
| **Market regime shift:** AI cycle ends | Low | Thesis includes both growth and drawdown phases |

---

## Next Actions (This Week)

### Immediate (Days 1-3)
1. ✅ Complete Project 1 & 2
2. [ ] Build Project 3: AI Semiconductor Valuation Screener
3. [ ] Deploy all 3 to Streamlit Cloud
4. [ ] Create GitHub repo with clean README

### Short-term (Days 4-7)
5. [ ] Add unit tests (80%+ coverage)
6. [ ] Set up GitHub Actions CI/CD
7. [ ] Create demo video for each project (2-3 min)
8. [ ] Write blog post: "Building a Quant Portfolio in 2 Weeks"

### Medium-term (Weeks 2-4)
9. [ ] Start Phase 2: Data pipeline
10. [ ] Build FastAPI endpoints
11. [ ] Containerize everything
12. [ ] Start job applications

---

## Resources & Learning Path

### Books
- *Quantitative Trading* - Ernie Chan (strategies)
- *Advances in Financial Machine Learning* - Marcos López de Prado (implementation)
- *Systematic Trading* - Robert Carver (portfolio construction)

### Online
- QuantConnect (algorithmic trading platform)
- Portfolio Visualizer (backtest benchmark)
- SSRN (academic papers on factor investing)

### Courses
- "Machine Learning for Trading" (Georgia Tech, free)
- "Financial Engineering" (Columbia, edX)

---

## Summary

**You are building:**
1. **Short-term (2 weeks):** 3 production-ready projects → job applications
2. **Medium-term (2 months):** Reusable platform → more projects, API
3. **Long-term (6 months):** Full "Capex Cycle OS" → potential product/startup

**Your edge:**
- Domain knowledge (AI capex cycle)
- Production engineering (tests, Docker, k8s)
- Full-stack capability (Python → Rust → TypeScript)
- Portfolio of shipped projects, not just notebooks

**First milestone:**  
Ship Project 3 by end of this week, deploy all 3, update resume, start applications.

Let's build.
