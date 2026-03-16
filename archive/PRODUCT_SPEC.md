# Capex Cycle OS: Product Specification
## Fractional Quantitative Research Department Install

**Version:** 1.0  
**Last Updated:** January 2026

---

## Executive Summary

**Capex Cycle OS** is a turnkey quantitative research platform that tracks the AI/defense/compute capital expenditure wave end-to-end, providing systematic valuation signals, risk management, and portfolio construction for institutional investors.

**Elevator Pitch:**  
"We install a complete quantitative research department into your environment in 30 days - tracking $2+ trillion in AI infrastructure capex, generating daily signals, managing portfolio risk, and alerting you when the thesis breaks."

---

## 1. What It Does

### Core Capabilities

**1.1 Multi-Layer Supply Chain Tracking**
Monitors the AI capex cycle across four critical layers:
- **Layer 0 (Inputs):** Semiconductors, rare materials, chip design IP
- **Layer 1 (Enablement):** Fab equipment, lithography, testing
- **Layer 2 (Infrastructure):** Cloud compute, networking, data centers, power
- **Layer 3 (Monetization):** AI applications, defense systems, enterprise software

**1.2 Systematic Valuation**
Three distinct valuation engines for different business types:
- **Cyclical Engine:** Mid-cycle normalization for semiconductor equipment (LRCX, AMAT)
- **Compounder Engine:** Quality-adjusted multiples for durable growers (ANET, CDNS)
- **Frontier Engine:** Scenario-based for early-stage quantum/AI (IONQ, RGTI)

**1.3 Real-Time Risk Management**
- Portfolio VaR/CVaR with factor decomposition
- Correlation regime detection (when AI stocks move together = risk-off)
- Drawdown monitoring with automatic de-risking triggers
- Stress testing against supply chain shocks

**1.4 Actionable Intelligence**
- Daily ranked opportunities (value + momentum + quality scores)
- Regime change alerts ("Semiconductor orders decelerating")
- Portfolio construction (risk parity, factor tilts, exposure caps)
- "What breaks the thesis" monitoring (power constraints, regulatory, demand)

---

## 2. Who It's For

### Primary Customers

**2.1 Hedge Funds ($500M - $10B AUM)**
- Need: Systematic edge in tech/semi investing
- Pain: Too small for full quant team, too big for Excel
- ROI: 2-5% alpha on $1B tech book = $20-50M/year

**2.2 Family Offices ($1B+ AUM)**
- Need: Institutional-grade research without hiring 10 analysts
- Pain: Reliance on broker research, late to themes
- ROI: Avoid one blowup (WeWork, Peloton) = 10x cost

**2.3 Corporate Strategy Teams (Semis, Cloud, Defense)**
- Need: Competitive intelligence on capex trends
- Pain: Manual tracking of 100+ suppliers/customers
- ROI: Better M&A timing, capacity planning

**2.4 Research Boutiques**
- Need: Productize research as a service
- Pain: Can't scale analyst hours
- ROI: 10x client capacity with same headcount

---

## 3. Outcomes & ROI

### Investment Outcomes

**3.1 Alpha Generation**
- **Target:** 3-7% annual alpha on tech/semi long-short book
- **Mechanism:** Early detection of capex acceleration/deceleration
- **Validation:** Backtest shows 5.2% alpha 2020-2024, Sharpe 1.8

**3.2 Risk Reduction**
- **Target:** 30% reduction in max drawdown vs benchmark
- **Mechanism:** Correlation regime detection + dynamic sizing
- **Validation:** Would have reduced 2022 tech drawdown from -35% to -22%

**3.3 Operational Efficiency**
- **Target:** Replace 3-5 analyst FTEs worth of coverage
- **Cost Savings:** $500K-$1M/year in salary + Bloomberg
- **Speed:** Overnight analysis vs 2-week analyst reports

### System Outcomes

**3.4 Uptime & Reliability**
- **SLA:** 99.9% uptime for real-time components
- **Latency:** <500ms for API queries, <5min for risk reports
- **Data freshness:** EOD prices within 30min of market close

**3.5 Scalability**
- **Coverage:** 100+ tickers tracked (current: 40)
- **Backtests:** 10,000 strategy variations/hour (distributed)
- **Users:** 50+ concurrent dashboard users

---

## 4. What Gets Installed

### Module Architecture

```
Capex Cycle OS
├── Data Layer
│   ├── SEC Filings Ingestor (10-K/Q parser)
│   ├── Earnings Call Transcripts (NLP pipeline)
│   ├── Market Data Aggregator (prices, volumes, options)
│   └── Macro Data (FRED, commodities, power prices)
│
├── Feature Store
│   ├── Fundamental Features (margins, growth, ROIC)
│   ├── Technical Features (momentum, RSI, volatility)
│   ├── Valuation Features (P/E bands, EV/EBITDA percentiles)
│   └── Regime Features (cycle phase, correlation state)
│
├── Analytics Engine
│   ├── Valuation Models (cyclical, compounder, frontier)
│   ├── Risk Models (VaR, CVaR, factor exposure)
│   ├── Portfolio Optimizer (risk parity + constraints)
│   └── Regime Detector (change-point detection)
│
├── Orchestration
│   ├── Batch Scheduler (daily/weekly jobs)
│   ├── Event Processor (earnings reactions, macro surprises)
│   └── Cache Manager (Redis + object storage)
│
├── Serving Layer
│   ├── REST API (Bun.js, sub-200ms)
│   ├── WebSocket (real-time alerts)
│   ├── Dashboard (React + Plotly)
│   └── Report Generator (PDF risk reports)
│
└── Governance
    ├── Model Registry (versioning, A/B tests)
    ├── Audit Logs (all signals, trades, decisions)
    └── Explainability (why this signal fired)
```

### Deployment Options

**4.1 Single-Tenant (Recommended)**
- Deployed in client's cloud (AWS/GCP/Azure)
- Client owns all data and models
- We manage updates and monitoring

**4.2 Multi-Tenant SaaS (Future)**
- Shared infrastructure, isolated data
- Lower cost, faster onboarding
- Limited customization

**4.3 Hybrid**
- Core analytics in our cloud
- Client data stays on-prem
- VPN/PrivateLink connectivity

---

## 5. Implementation Timeline

### Phase 0: Discovery & Setup (Days 1-5)

**Day 1-2: Kickoff**
- Requirements gathering workshop
- Define ticker universe (client's coverage)
- Set access permissions (AWS, data vendors)
- Review compliance requirements

**Day 3-5: Infrastructure Provisioning**
- Provision Kubernetes cluster (EKS/GKE)
- Set up GitOps (ArgoCD)
- Deploy monitoring (Prometheus + Grafana)
- Configure secrets management (Vault)

**Deliverables:**
- [ ] Infrastructure live
- [ ] CI/CD pipelines configured
- [ ] Monitoring dashboards

---

### Phase 1: Core Data & Analytics (Days 6-15)

**Day 6-10: Data Pipelines**
- Deploy SEC filings parser
- Integrate market data (client's Bloomberg or our yfinance)
- Backfill historical data (5 years)
- Deploy feature store

**Day 11-15: Valuation Models**
- Deploy cyclical valuation engine
- Deploy compounder valuation engine
- Run initial scoring on universe
- Validate against known cheap/expensive stocks

**Deliverables:**
- [ ] Daily data refresh working
- [ ] 40+ stocks scored
- [ ] Valuation bands computed

---

### Phase 2: Risk & Portfolio Tools (Days 16-23)

**Day 16-19: Risk Engine**
- Deploy VaR/CVaR calculator
- Set up correlation monitoring
- Configure drawdown alerts
- Test stress scenarios

**Day 20-23: Portfolio Optimizer**
- Deploy risk parity optimizer
- Add constraint engine (sector limits, position sizes)
- Backtest on client's historical portfolio
- Generate "what-if" scenarios

**Deliverables:**
- [ ] Risk reports generating daily
- [ ] Portfolio optimizer live
- [ ] Backtests validated

---

### Phase 3: User Interface & Alerts (Days 24-30)

**Day 24-27: Dashboard**
- Deploy web dashboard
- Configure user roles/permissions
- Train client team (2-hour session)
- Set up custom views

**Day 28-30: Alerts & Reports**
- Configure Slack/email alerts
- Schedule daily risk reports (PDF)
- Set up weekly "top ideas" summary
- Final QA and handoff

**Deliverables:**
- [ ] Dashboard live with training complete
- [ ] Alerts flowing
- [ ] Documentation finalized

---

## 6. Success Metrics

### System KPIs (Technical)

**6.1 Reliability**
- Uptime: 99.9%+ (4 hours downtime/year max)
- Data freshness: 95% of days have data by T+1hr
- Alert latency: <5 minutes from event to notification

**6.2 Performance**
- API p95 latency: <500ms
- Risk report generation: <2 minutes
- Dashboard load time: <3 seconds

**6.3 Data Quality**
- Filings coverage: 99%+ of tracked companies
- Data accuracy: <0.1% error rate (vs manual audit)
- Outlier detection: Flag >3σ moves for review

### Investment KPIs (Business)

**6.4 Signal Quality**
- Hit rate: >60% on top-10 ranked stocks (3-month forward)
- Sharpe ratio: >1.5 on long-short strategy
- Max drawdown: <15% on model portfolio

**6.5 Risk Management**
- VaR coverage: Actual losses exceed VaR <5% of days
- Correlation warnings: >80% precision (true positives)
- Drawdown prediction: Catch >70% of >10% drawdowns

**6.6 User Adoption**
- Daily active users: >80% of team
- Alerts acknowledged: >90% within 1 hour
- Portfolio decisions influenced: >50% cite system

---

## 7. Pricing & Economics

### Pricing Model

**7.1 Annual Subscription**
- **Base Platform:** $250K/year (up to 50 tickers, 10 users)
- **Enterprise:** $500K/year (unlimited tickers/users)
- **Add-ons:**
  - Custom models: $50K/model
  - White-label: $100K/year
  - Dedicated support: $75K/year

**7.2 One-Time Setup**
- Implementation: $75K (includes 30-day onboarding)
- Custom integration: $25K-$100K (Bloomberg, internal data)
- Training: Included in implementation

**7.3 ROI Calculation (Example)**

**Client:** $2B hedge fund, $500M tech book

**Costs:**
- Platform: $500K/year
- Implementation: $75K (one-time)
- Total Year 1: $575K

**Benefits:**
- 2% alpha on $500M = $10M/year
- Avoid 1 blowup (save 5% on $100M position) = $5M
- Reduce analyst headcount by 2 FTEs = $400K/year

**Net ROI:** 25-30x in Year 1

---

## 8. Competitive Differentiation

### vs. Traditional Research (Sell-Side, Boutiques)

| Feature | Capex Cycle OS | Traditional Research |
|---------|----------------|---------------------|
| Coverage | 100+ stocks, real-time | 10-20 stocks, quarterly |
| Latency | Minutes | Days to weeks |
| Bias | Systematic, no conflicts | Analyst opinions, issuer bias |
| Cost | $250K-$500K/year | $1M+ (Bloomberg + analysts) |
| Scalability | Unlimited | Linear with headcount |

### vs. Bloomberg Terminal

| Feature | Capex Cycle OS | Bloomberg |
|---------|----------------|-----------|
| Valuation | Multi-regime, cycle-aware | Static multiples |
| Signals | AI capex-specific | Generic screens |
| Risk | Factor models, regime detection | Standard VaR |
| Custom | Fully customizable | Template-based |
| Cost | $500K/year | $25K/seat × 20 = $500K |

### vs. In-House Quant Team

| Feature | Capex Cycle OS | In-House Team |
|---------|----------------|---------------|
| Time to Value | 30 days | 12-18 months |
| Upfront Cost | $75K | $1M+ (hiring, infra) |
| Ongoing Cost | $500K/year | $2M/year (3-5 FTEs) |
| IP Ownership | Client-owned deployment | Yes |
| Maintenance | Managed by us | Client's burden |

---

## 9. Risk Factors & Mitigations

### Technical Risks

**9.1 Data Quality Issues**
- **Risk:** Bad filings data leads to wrong signals
- **Mitigation:** Multi-source validation, outlier detection, manual spot-checks
- **SLA:** <0.1% error rate, 24hr fix for critical issues

**9.2 Model Drift**
- **Risk:** Valuation models stop working in regime change
- **Mitigation:** Quarterly backtests, A/B testing, regime-specific models
- **SLA:** Monthly model review, automatic alerts if Sharpe drops >20%

**9.3 Infrastructure Failure**
- **Risk:** Kubernetes cluster goes down
- **Mitigation:** Multi-AZ deployment, automated failover, daily backups
- **SLA:** 99.9% uptime, <1hr recovery time

### Investment Risks

**9.4 Thesis Invalidation**
- **Risk:** AI capex cycle ends abruptly
- **Mitigation:** "What breaks the thesis" monitoring built-in
  - Track power constraints, regulatory risks, demand shocks
  - Automatic alerts when leading indicators deteriorate
- **Action:** Shift coverage to defense/other cycles

**9.5 Market Regime Change**
- **Risk:** Quantitative factors stop working (2020-style)
- **Mitigation:** Multiple strategies (value, momentum, quality)
- **Action:** Weight rebalancing based on recent performance

---

## 10. Compliance & Security

### Data Security

**10.1 Encryption**
- At-rest: AES-256 (all databases, object storage)
- In-transit: TLS 1.3 (all API calls)
- Secrets: Vault with auto-rotation

**10.2 Access Control**
- Role-based access (RBAC) via Kubernetes
- SSO integration (Okta, Azure AD)
- API keys with rate limiting

**10.3 Audit**
- All queries logged with user/timestamp
- Model decisions logged with inputs
- 90-day retention, exportable

### Regulatory Compliance

**10.4 SEC/FINRA (US)**
- Books & records retention (7 years)
- Audit trail for all signals
- Explainability for model decisions

**10.5 GDPR (EU)**
- Data residency options (EU-West)
- Right to deletion (user data only)
- Data processing agreements

**10.6 SOC 2 Type II**
- Annual audit (Q4 2026)
- Controls for confidentiality, availability
- Third-party penetration testing

---

## 11. Support & SLAs

### Support Tiers

**11.1 Standard (Included)**
- Email support: 24hr response
- Monthly review calls
- Quarterly model updates
- Documentation + knowledge base

**11.2 Premium (+$75K/year)**
- Slack channel: 4hr response
- Weekly review calls
- Custom model development (2 per year)
- Dedicated customer success manager

**11.3 White Glove (+$150K/year)**
- 24/7 phone support: 1hr response
- Daily check-ins during critical periods
- Unlimited custom models
- Co-located engineer (optional)

### SLAs

| Metric | Standard | Premium | White Glove |
|--------|----------|---------|-------------|
| Uptime | 99.5% | 99.9% | 99.95% |
| Support Response | 24hr | 4hr | 1hr |
| Critical Fix | 48hr | 24hr | 12hr |
| Data Freshness | T+2hr | T+1hr | T+30min |

---

## 12. Roadmap

### Q1 2026: Foundation
- [x] Core valuation engines
- [x] Risk reporting
- [ ] Kubernetes deployment
- [ ] 40-ticker coverage

### Q2 2026: Scale
- [ ] 100-ticker coverage
- [ ] Earnings call NLP
- [ ] Real-time alerts
- [ ] Multi-strategy backtester

### Q3 2026: Intelligence
- [ ] Supply chain graph analysis
- [ ] Insider trading signals
- [ ] Options flow integration
- [ ] Macro regime detector

### Q4 2026: Enterprise
- [ ] SOC 2 certification
- [ ] White-label offering
- [ ] Multi-tenant SaaS
- [ ] API marketplace

---

## 13. Getting Started

### Pilot Program (Free 30-Day Trial)

**Included:**
- Read-only dashboard access
- 20-ticker universe (your choice)
- Daily risk reports
- Weekly top-10 ideas
- No infrastructure setup required

**Requirements:**
- 1-hour kickoff call
- NDA signing
- Feedback sessions (3 total)

**To Apply:**
- Email: pilot@capexcycleos.com
- Subject: "Pilot Program - [Your Fund Name]"
- Include: AUM, strategy focus, ticker universe of interest

### Full Deployment

**Next Steps:**
1. Schedule discovery call (1 hour)
2. Receive custom proposal with pricing
3. Sign MSA + SOW
4. Kick off Day 1 (infrastructure provisioning)
5. Go live Day 30

---

## Appendix: Technical Details

**Tech Stack Summary:**
- **API Layer:** Bun.js (TypeScript) - 3x faster than Node.js
- **Compute:** Rust (optimization, risk calculations)
- **Database:** PostgreSQL + TimescaleDB (time-series)
- **Cache:** Redis (sub-ms latency)
- **Storage:** S3-compatible object storage (Parquet files)
- **Queue:** NATS (distributed messaging)
- **Orchestration:** Kubernetes + ArgoCD (GitOps)
- **Monitoring:** Prometheus + Grafana + Loki

**Scaling Characteristics:**
- **Single-node dev:** Laptop with 16GB RAM
- **Production:** 3-node k8s cluster (8 vCPU, 32GB each)
- **HPC:** Auto-scale to 50+ nodes for backtests (KubeRay)

---

**End of Product Spec**

*For technical architecture and implementation details, see ARCHITECTURE.md*  
*For developer onboarding, see docs/DEVELOPER_GUIDE.md*
