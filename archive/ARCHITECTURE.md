# Capex Cycle OS: Technical Architecture
## System Design & Implementation Blueprint

**Version:** 1.0  
**Architecture:** Microservices on Kubernetes  
**Target Scale:** 100+ stocks, 50+ concurrent users, 10K backtests/hour

---

## System Summary

Capex Cycle OS is a distributed quantitative research platform built on Kubernetes that tracks the AI/defense/compute capex wave through a multi-layer supply chain model, applies regime-specific valuation across three business archetypes (cyclical, compounder, frontier), generates systematic signals via a KPI scoreboard, and manages portfolio risk using factor models and regime detection—all delivered through Bun.js APIs, Rust compute kernels, and GitOps-managed infrastructure.

---

# PART A: MULTI-LAYER MARKET MAP

## A.1 Layer Taxonomy

The AI capex cycle flows through four distinct layers, each with unique bottleneck dynamics:

```
LAYER 0: INPUTS
├── Semiconductors (Chips)
│   ├── GPU Compute: NVDA, AMD
│   ├── Networking Chips: AVGO, MRVL
│   ├── Memory: MU, WDC
│   └── Legacy/Foundry: INTC, TSM
├── Materials & IP
│   ├── Rare Earth: MP (rare earth materials)
│   ├── Design IP: CDNS, SNPS (EDA tools)
│   └── Silicon Wafers: Not public (tracked via supplier data)
└── Power Components
    ├── Power Semis: ON, MPWR
    └── Cooling: AAON (HVAC for data centers)

LAYER 1: ENABLEMENT (Equipment & Tools)
├── Fab Equipment
│   ├── Deposition/Etch: LRCX
│   ├── Multi-process: AMAT
│   ├── Inspection: KLAC
│   └── Lithography: ASML (EUV monopoly)
├── Test Equipment
│   ├── ATE: TER
│   └── Metrology: Included in KLAC
└── Assembly
    └── MKSI (process control)

LAYER 2: INFRASTRUCTURE (Build-Out)
├── Cloud Compute
│   ├── Hyperscalers: MSFT (Azure), GOOGL (GCP), AMZN (AWS)
│   ├── Specialized: ORCL (cloud infra)
│   └── GPU Cloud: Emerging (track private: CoreWeave, Lambda)
├── Networking
│   ├── Data Center Switching: ANET
│   ├── Optical: CIEN, LITE
│   └── Traditional: CSCO
├── Data Centers (REITs)
│   ├── DLR (Digital Realty)
│   ├── EQIX (Equinix)
│   └── CCI (cell towers - edge compute)
└── Power Infrastructure
    ├── Utilities: AEP, NEE, D
    ├── Generators: GE Vernova (post-spin)
    └── Energy Storage: TSLA (Megapack - track but risky)

LAYER 3: MONETIZATION (Revenue Generation)
├── AI Applications
│   ├── Foundation Models: MSFT (OpenAI), GOOGL, META
│   ├── Enterprise AI: PLTR, SNOW, NOW
│   └── Vertical AI: C3.AI, SOUN (risky)
├── Defense Systems
│   ├── Autonomous: PLTR, ANDURIL (private)
│   ├── Traditional: RTX, LMT, NOC
│   └── Cyber: PANW, CRWD, FTNT
└── Frontier Tech
    ├── Quantum: IONQ, RGTI
    ├── Robotics: Not public (track Figure, Agility)
    └── Energy: Fusion (private: Commonwealth, Helion)
```

---

## A.2 Bottleneck Logic

Each layer has a critical bottleneck that gates throughput:

### Layer 0: Chip Availability
**Bottleneck:** Foundry capacity (TSM, Samsung)
**Leading Indicator:** Fab equipment orders (LRCX, AMAT backlogs)
**Time Lag:** 18-24 months (order → production)
**Breakage Point:** Geopolitical (Taiwan), power shortages

**Tracking Metrics:**
- TSM capex announcements (quarterly calls)
- ASML EUV shipment rates (annual guidance)
- GPU lead times (NVDA channel checks)

---

### Layer 1: Equipment Lead Times
**Bottleneck:** ASML EUV lithography tools (12-18 month lead time)
**Leading Indicator:** Chip maker capex guidance (TSM, INTC, Samsung)
**Time Lag:** 6-12 months (order → delivery)
**Breakage Point:** Export controls (China restrictions), ASML production capacity

**Tracking Metrics:**
- ASML backlog/book-to-bill
- LRCX/AMAT order rates vs shipments
- WFE (wafer fab equipment) spending forecasts (SEMI)

---

### Layer 2: Power & Space
**Bottleneck:** Electrical grid capacity + real estate
**Leading Indicator:** Hyperscaler capex (MSFT, GOOGL, AMZN)
**Time Lag:** 12-36 months (site selection → live)
**Breakage Point:** Power unavailability, permitting delays, NIMBYism

**Tracking Metrics:**
- Hyperscaler capex YoY growth (quarterly filings)
- Data center REIT leasing velocity (DLR, EQIX earnings)
- Utility capex in data center regions (AEP, NEE)

---

### Layer 3: Demand Realization
**Bottleneck:** Enterprise adoption rates, ROI proof points
**Leading Indicator:** Cloud AI revenue (Azure AI, GCP Vertex)
**Time Lag:** 6-18 months (model release → enterprise deployment)
**Breakage Point:** Regulation (AI safety), economic downturn, disappointing ROI

**Tracking Metrics:**
- OpenAI/Anthropic API usage proxies (MSFT Azure AI growth)
- Enterprise AI vendor ARR growth (PLTR, SNOW)
- Job postings for "AI engineer" roles (leading labor demand)

---

## A.3 Layer KPIs & Roll-Up Scoring

### Universal KPIs (0-5 scale, all layers)

**Scored 0-5 for every ticker:**

1. **Revenue Acceleration** (0-5)
   - 5: QoQ >20%, YoY >30%
   - 4: QoQ 10-20%, YoY 20-30%
   - 3: QoQ 5-10%, YoY 10-20%
   - 2: QoQ 0-5%, YoY 5-10%
   - 1: Flat to slight decline
   - 0: Declining >5%

2. **Margin Trajectory** (0-5)
   - 5: Expanding >200bps YoY
   - 4: Expanding 100-200bps
   - 3: Stable ±50bps
   - 2: Compressing 50-100bps
   - 1: Compressing 100-200bps
   - 0: Compressing >200bps

3. **Capital Efficiency** (0-5)
   - ROIC vs WACC spread
   - 5: ROIC >30%, ROIC-WACC >20%
   - 3: ROIC 15-30%, ROIC-WACC 10-20%
   - 0: ROIC <10%

4. **Backlog/Visibility** (0-5)
   - 5: Backlog >12 months revenue, growing
   - 4: Backlog 9-12 months, stable
   - 3: Backlog 6-9 months
   - 2: Backlog 3-6 months
   - 1: Backlog <3 months
   - 0: No backlog disclosure (high risk)

5. **Management Quality** (0-5)
   - Execution: guide-and-deliver track record
   - Capital allocation: buybacks, M&A discipline
   - 5: Perfect record (>90% guide accuracy, smart M&A)
   - 3: Average (70-90% accuracy)
   - 0: Unreliable (missed guidance 3+ times)

### Layer-Specific KPIs

**Layer 0 (Semiconductors):**
- **Lead Time Trends:** Increasing = tight supply (bullish)
- **ASP Trends:** Pricing power indicator
- **Design Win Momentum:** New customer adds

**Layer 1 (Equipment):**
- **Book-to-Bill Ratio:** >1.0 = accelerating, <1.0 = decelerating
- **Service Revenue %:** Higher = installed base quality
- **Geographic Mix:** China exposure = regulatory risk

**Layer 2 (Infrastructure):**
- **GPU Utilization Rates:** >90% = need more capacity
- **Network Bandwidth Growth:** YoY traffic increase
- **Power Usage Effectiveness (PUE):** <1.3 = efficient

**Layer 3 (Monetization):**
- **ARR Growth:** Annual recurring revenue acceleration
- **Customer Concentration:** <20% from top customer = healthy
- **Unit Economics:** LTV/CAC >3 = sustainable

---

## A.4 Unified Scoring & Signal Generation

### Composite Score (0-100)

```python
# For each ticker:
score = (
    0.25 * revenue_accel_score +
    0.20 * margin_trajectory_score +
    0.15 * capital_efficiency_score +
    0.15 * backlog_visibility_score +
    0.10 * management_quality_score +
    0.15 * layer_specific_score
) * 20  # Scale to 0-100

# Adjustments
if valuation_percentile > 80:
    score *= 0.8  # Penalize expensive
if valuation_percentile < 20:
    score *= 1.2  # Reward cheap (but cap at 100)
```

### Signal Taxonomy

**Strong Buy (Score 80-100):**
- Improving fundamentals + cheap valuation + favorable regime
- Position size: 3-5% of portfolio

**Buy (Score 65-79):**
- Solid fundamentals, fair valuation
- Position size: 2-3%

**Hold (Score 50-64):**
- Mixed signals or fair value
- Position size: maintain or trim

**Sell (Score 35-49):**
- Deteriorating fundamentals or expensive
- Action: reduce to <1% or exit

**Strong Sell (Score 0-34):**
- Broken story + expensive
- Action: exit immediately

---

## A.5 Portfolio Allocation Framework

### Risk Budgeting by Layer

```
Target allocations (risk parity adjusted):
- Layer 0 (Semiconductors): 30-40% (high vol, high returns)
- Layer 1 (Equipment): 20-25% (cyclical, moderate vol)
- Layer 2 (Infrastructure): 25-35% (stable, lower vol)
- Layer 3 (Monetization): 5-15% (high risk, asymmetric)

Constraints:
- Max single position: 8%
- Max sector concentration: 40%
- Max correlation to SPY: 0.85
- Min Sharpe ratio: 1.2 (trailing 12mo)
```

### Rebalancing Triggers

**Forced rebalance:**
- Any position >10% (profit-taking)
- Correlation regime change (>0.9 correlation = de-risk)
- Drawdown >12% from peak (systematic de-leverage)

**Opportunistic rebalance:**
- Score changes >15 points
- Valuation dislocation >20 percentile points
- Layer shifts (e.g., equipment → semiconductors rotation)

---

# PART B: VALUATION ENGINES

## B.1 Cyclical Valuation Engine (Semiconductor Equipment)

**Use case:** LRCX, AMAT, KLAC, ASML, TER

### Model: Mid-Cycle Normalization

**Concept:** Cyclical stocks swing between peak and trough earnings. Comparing current P/E to historical average is misleading. Instead, normalize to mid-cycle earnings.

**Formula:**
```python
# 1. Identify historical cycles (peak-to-peak or trough-to-trough)
cycles = identify_cycles(revenue_history, method='turning_points')

# 2. Compute mid-cycle earnings
for cycle in cycles:
    peak_eps = max(eps in cycle)
    trough_eps = min(eps in cycle)
    mid_cycle_eps = (peak_eps + trough_eps) / 2

mid_cycle_eps_avg = mean(mid_cycle_eps for all cycles)

# 3. Current position in cycle
current_eps = latest_eps
cycle_position = (current_eps - trough_eps) / (peak_eps - trough_eps)
# 0 = trough, 0.5 = mid, 1.0 = peak

# 4. Regime-adjusted multiple
if cycle_position < 0.3:  # Early cycle
    target_multiple = 15 - 18
elif cycle_position < 0.7:  # Mid cycle
    target_multiple = 12 - 15
else:  # Late cycle
    target_multiple = 8 - 12

fair_value = mid_cycle_eps_avg * target_multiple
current_price = latest_price
upside_downside = (fair_value - current_price) / current_price
```

**Evidence Requirements:**
- 10 years of quarterly EPS (min 2 full cycles)
- Revenue growth correlation to WFE spending
- Backlog disclosure (if available)

**Stress Tests:**
```python
scenarios = {
    'base': {'wfe_spending': 0, 'multiple': target_multiple},
    'upcycle': {'wfe_spending': +30%, 'multiple': target_multiple * 1.2},
    'downcycle': {'wfe_spending': -20%, 'multiple': target_multiple * 0.7},
    'china_ban': {'revenue': -15%, 'multiple': target_multiple * 0.8}
}

for scenario, params in scenarios:
    stressed_eps = current_eps * (1 + params['revenue_impact'])
    stressed_fair_value = stressed_eps * params['multiple']
    scenario_return = (stressed_fair_value - current_price) / current_price
```

**Output:**
- Fair value range: [bear, base, bull]
- Implied return: [worst, expected, best]
- Cycle regime: Early/Mid/Late/Trough
- Risk rating: Low/Med/High (based on cycle position + valuation)

---

## B.2 Compounder Valuation Engine (Durable Growers)

**Use case:** ANET, CDNS, SNPS, PANW, NOW, ADBE

### Model: Quality-Adjusted Multiple Bands

**Concept:** High-quality compounders deserve premium multiples, but there are limits. Use historical banding to detect dislocations.

**Quality Score (0-100):**
```python
quality_score = (
    0.25 * roic_score +         # ROIC >25% = 100, <10% = 0
    0.25 * fcf_quality_score +  # FCF/Net Income >1.0 = 100
    0.20 * moat_score +         # Gross margin >70% = strong moat
    0.15 * growth_stability +   # Revenue growth stdev <5% = stable
    0.15 * balance_sheet +      # Net cash >20% market cap = pristine
)

# ROIC score
roic = nopat / invested_capital
roic_score = min(100, (roic / 0.25) * 100)  # 25% ROIC = max

# FCF quality
fcf_quality = fcf / net_income
fcf_quality_score = min(100, fcf_quality * 100)

# Moat (gross margin proxy)
moat_score = min(100, (gross_margin / 0.70) * 100)

# Growth stability (lower stdev = higher score)
revenue_growth_stdev = stdev(revenue_growth_last_8q)
growth_stability = max(0, 100 - (revenue_growth_stdev / 0.05) * 100)

# Balance sheet
net_cash_pct = (cash - debt) / market_cap
balance_sheet = min(100, (net_cash_pct / 0.20) * 100)
```

**Historical Banding:**
```python
# Compute historical P/E, P/S, EV/EBITDA over 5-10 years
metrics = ['pe', 'ps', 'ev_ebitda']

for metric in metrics:
    percentiles = compute_percentiles(
        historical_data[metric],
        levels=[10, 25, 50, 75, 90]
    )
    
    current_value = latest_data[metric]
    current_percentile = where_in_distribution(current_value, percentiles)
    
    # Valuation score: lower percentile = more attractive
    valuation_score = 100 - current_percentile

# Quality-adjusted fair value
if quality_score > 80:  # Exceptional
    target_multiple = percentile_75  # Can sustain premium
elif quality_score > 60:  # Good
    target_multiple = percentile_50  # Fair value
else:  # Mediocre
    target_multiple = percentile_25  # Discount
    
fair_value = earnings * target_multiple
```

**Durability Tests:**
```python
# Test 1: Moat erosion
if gross_margin_trend < 0 for 4+ quarters:
    flag = "Moat eroding - competition or pricing pressure"
    
# Test 2: Growth deceleration
if revenue_growth_3y_cagr < revenue_growth_5y_cagr - 5%:
    flag = "Decelerating - law of large numbers or market saturation"
    
# Test 3: FCF divergence
if fcf_growth < revenue_growth - 10%:
    flag = "FCF quality declining - working capital or capex intensive"
```

**Output:**
- Quality score (0-100)
- Fair value range by quality tier
- Percentile position (historical)
- Durability flags (moat, growth, FCF)

---

## B.3 Frontier Valuation Engine (Convex/Early-Stage)

**Use case:** IONQ, RGTI, early-stage defense tech

### Model: Scenario Probability Weighting

**Concept:** These companies have binary outcomes. Traditional DCF doesn't work. Instead, model scenarios with probabilities.

**Scenario Framework:**
```python
scenarios = {
    'bull': {
        'prob': 0.15,
        'revenue_2028': $500M,
        'margin': 40%,
        'multiple': 15,
        'outcome': $500M * 0.40 * 15 = $3B market cap
    },
    'base': {
        'prob': 0.50,
        'revenue_2028': $150M,
        'margin': 20%,
        'multiple': 8,
        'outcome': $150M * 0.20 * 8 = $240M market cap
    },
    'bear': {
        'prob': 0.25,
        'revenue_2028': $30M,
        'margin': -10%,
        'multiple': 2,
        'outcome': $60M market cap (liquidation value)
    },
    'zero': {
        'prob': 0.10,
        'revenue_2028': 0,
        'outcome': $0 (bankruptcy)
    }
}

# Expected value
expected_market_cap = sum(
    scenario['prob'] * scenario['outcome']
    for scenario in scenarios
)

# Probability-weighted return
expected_return = (expected_market_cap - current_market_cap) / current_market_cap

# Kelly criterion position sizing
kelly_fraction = sum(
    scenario['prob'] * max(0, (scenario['outcome'] - current_cap) / current_cap)
) / volatility^2

recommended_position = min(kelly_fraction, 0.02)  # Cap at 2%
```

**Repeatability Tests:**
```python
# Test 1: Revenue traction
if bookings_last_4q < $10M:
    flag = "Pre-revenue / minimal traction"
    max_position = 0.5%

# Test 2: Customer concentration
if top_customer_pct > 50%:
    flag = "High concentration risk"
    scenario['prob']['bear'] += 0.10
    scenario['prob']['base'] -= 0.10

# Test 3: Burn efficiency
burn_efficiency = revenue_growth / cash_burned
if burn_efficiency < 0.5:  # Burning $2 for $1 revenue growth
    flag = "Capital inefficient - financing risk"
    scenario['prob']['zero'] += 0.05

# Test 4: Dilution trajectory
if shares_outstanding_growth > 15% annually:
    flag = "High dilution - value destruction"
    # Adjust scenario outcomes for future dilution
```

**Position Sizing Rules:**
```python
# Base position (Kelly-adjusted)
base_position = kelly_fraction

# Risk adjustments
if 'pre-revenue' in flags:
    base_position *= 0.3
if 'high concentration' in flags:
    base_position *= 0.5
if 'burn inefficiency' in flags:
    base_position *= 0.4
    
# Hard caps
final_position = min(base_position, 0.02)  # Never >2%
```

**Output:**
- Expected value (probability-weighted)
- Scenario tree with probabilities
- Recommended position size (Kelly-adjusted)
- Risk flags (concentration, burn, dilution)
- "What needs to go right" checklist

---

# PART C: KPI SCOREBOARD

## C.1 Scoreboard Design

**Philosophy:** "No vibes, only evidence." Every score must be traceable to a specific filing, transcript quote, or price action.

### Data Structure
```typescript
interface TickerScore {
  ticker: string;
  timestamp: Date;
  
  // Universal KPIs (0-5 each)
  revenue_accel: {
    score: number;
    evidence: {
      qoq_growth: number;
      yoy_growth: number;
      source: '10-Q filed 2025-01-15';
    }
  };
  
  margin_trajectory: {
    score: number;
    evidence: {
      gross_margin_change: number;
      operating_margin_change: number;
      source: '10-K filed 2024-02-20';
    }
  };
  
  // ... other universal KPIs
  
  // Layer-specific
  layer_kpis: {
    [key: string]: {
      score: number;
      evidence: any;
    }
  };
  
  // Composite
  total_score: number;  // 0-100
  percentile_rank: number;  // vs universe
  
  // Valuation context
  valuation: {
    engine_type: 'cyclical' | 'compounder' | 'frontier';
    fair_value: number;
    current_price: number;
    upside_pct: number;
    percentile: number;  // Historical valuation percentile
  };
  
  // Flags
  flags: string[];  // ["Moat eroding", "High dilution", etc.]
}
```

---

## C.2 Evidence Requirements

### Tier 1 Evidence (Required)
- **SEC Filings:** 10-K, 10-Q (quarterly refresh)
- **Price Action:** Daily adjusted close
- **Market Cap:** Shares outstanding × price

### Tier 2 Evidence (Strongly Preferred)
- **Earnings Transcripts:** For backlog, guidance, competitive dynamics
- **Segment Data:** Geographic mix, product mix
- **Insider Trading:** Form 4 filings (bullish/bearish)

### Tier 3 Evidence (Nice to Have)
- **Supply Chain Checks:** Customer mentions (e.g., NVDA mentions TSMC)
- **Job Postings:** Hiring velocity = growth indicator
- **Patent Filings:** Innovation proxy

### Evidence Lineage
```python
# Every score must trace to source
evidence = {
    'ticker': 'LRCX',
    'metric': 'revenue_accel',
    'score': 4,
    'calculation': {
        'qoq_growth': 0.18,  # 18%
        'yoy_growth': 0.25,  # 25%
        'scoring_rule': 'QoQ 10-20%, YoY 20-30% → Score 4'
    },
    'source': {
        'filing': '10-Q for Q3 2024',
        'filed_date': '2024-10-24',
        'url': 'https://sec.gov/...',
        'extract_method': 'revenue from income statement page 4'
    },
    'verification': {
        'manual_check': True,
        'checked_by': 'system',
        'outlier_flag': False
    }
}
```

---

## C.3 Output: Opportunity Quadrants

### 2×2 Matrix: Improving vs Price

```
         Price
         Cheap  |  Expensive
        --------|------------
Improv- |   A   |      B
ing     | BUY!  | WAIT/TRIM
--------|-------|------------
Deter-  |   C   |      D
iorat-  | VALUE | SELL!
ing     | TRAP? |
```

**Quadrant A (Top Priority):**
- Improving fundamentals (score increasing)
- Cheap valuation (<30th percentile)
- **Action:** Strong buy, size up to max position
- **Examples:** "LRCX improving from score 65→78, at 22nd percentile P/E"

**Quadrant B (Monitor):**
- Improving fundamentals
- Expensive valuation (>70th percentile)
- **Action:** Watch for pullback, don't chase
- **Examples:** "NVDA score 92 but at 88th percentile"

**Quadrant C (Value Trap Risk):**
- Deteriorating fundamentals (score decreasing)
- Cheap valuation
- **Action:** Investigate - is this value or broken?
- **Examples:** "INTC score 45→38, at 15th percentile"

**Quadrant D (Exit Zone):**
- Deteriorating fundamentals
- Expensive valuation
- **Action:** Sell immediately
- **Examples:** "AAPL score 68→55, at 82nd percentile"

### Dashboard View
```
Top Improving & Cheap (Quadrant A):
1. LRCX: Score 78 (+13 vs 90d), Percentile 22%, Upside +24%
2. ANET: Score 84 (+8 vs 90d), Percentile 31%, Upside +18%
3. KLAC: Score 72 (+11 vs 90d), Percentile 28%, Upside +15%

Overpriced Improving (Quadrant B):
1. NVDA: Score 92 (+5 vs 90d), Percentile 88%, Upside -12%
2. AVGO: Score 81 (+6 vs 90d), Percentile 76%, Upside -8%

Deteriorating & Cheap (Quadrant C - Investigate):
1. INTC: Score 38 (-7 vs 90d), Percentile 15%, Upside +42% (value trap?)

Sell Zone (Quadrant D):
1. MU: Score 52 (-9 vs 90d), Percentile 79%, Downside -18%
```

---

# PART D: MODULAR SYSTEM DESIGN

## D.1 Data Ingest Module

**Interface:**
```typescript
// services/data-ingest/src/types.ts

interface DataIngestService {
  // SEC Filings
  ingestFiling(ticker: string, formType: '10-K' | '10-Q'): Promise<Filing>;
  parseFiling(filing: Filing): Promise<FinancialData>;
  
  // Earnings transcripts
  ingestTranscript(ticker: string, quarter: string): Promise<Transcript>;
  extractMetrics(transcript: Transcript): Promise<TranscriptMetrics>;
  
  // Market data
  fetchPrices(tickers: string[], start: Date, end: Date): Promise<PriceData>;
  
  // Macro
  fetchFredSeries(series: string[]): Promise<MacroData>;
}

interface Filing {
  ticker: string;
  cik: string;
  formType: string;
  filedDate: Date;
  period: Date;
  url: string;
  html: string;
  extracted: boolean;
}

interface FinancialData {
  ticker: string;
  period: Date;
  revenue: number;
  operating_income: number;
  net_income: number;
  eps_diluted: number;
  shares_outstanding: number;
  total_assets: number;
  total_liabilities: number;
  cash: number;
  debt: number;
  capex: number;
  rd_expense: number;
  backlog?: number;  // Optional, not all companies disclose
  metadata: {
    source_filing: string;
    extraction_method: string;
    confidence: number;  // 0-1, how confident is the parse
  };
}
```

**Storage:**
```sql
-- PostgreSQL schema
CREATE TABLE filings (
  id SERIAL PRIMARY KEY,
  ticker VARCHAR(10) NOT NULL,
  form_type VARCHAR(10) NOT NULL,
  filed_date DATE NOT NULL,
  period_end DATE NOT NULL,
  url TEXT,
  html TEXT,  -- Full HTML
  extracted BOOLEAN DEFAULT FALSE,
  extracted_at TIMESTAMP,
  UNIQUE(ticker, form_type, period_end)
);

CREATE TABLE financial_metrics (
  id SERIAL PRIMARY KEY,
  ticker VARCHAR(10) NOT NULL,
  period DATE NOT NULL,
  metric_name VARCHAR(50) NOT NULL,
  metric_value NUMERIC,
  source_filing_id INTEGER REFERENCES filings(id),
  extraction_confidence NUMERIC CHECK (extraction_confidence >= 0 AND extraction_confidence <= 1),
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(ticker, period, metric_name)
);

CREATE INDEX idx_metrics_ticker_period ON financial_metrics(ticker, period DESC);
CREATE INDEX idx_filings_ticker_date ON filings(ticker, filed_date DESC);
```

**Implementation (Bun.js):**
```typescript
// services/data-ingest/src/sec-parser.ts

import { parse } from 'node-html-parser';

export class SECFilingParser {
  async parseTenK(html: string): Promise<FinancialData> {
    const root = parse(html);
    
    // Extract from income statement
    const revenue = this.extractMetric(root, [
      'revenue', 'total revenue', 'net sales'
    ]);
    
    const operatingIncome = this.extractMetric(root, [
      'operating income', 'income from operations'
    ]);
    
    // Extract from balance sheet
    const cash = this.extractMetric(root, [
      'cash and cash equivalents', 'cash'
    ]);
    
    // Extract from cash flow statement
    const capex = this.extractMetric(root, [
      'capital expenditures', 'purchase of property'
    ]);
    
    return {
      revenue,
      operatingIncome,
      cash,
      capex,
      metadata: {
        extractionMethod: 'html-parsing-v1',
        confidence: this.calculateConfidence()
      }
    };
  }
  
  private extractMetric(root: any, terms: string[]): number | null {
    // Look for table cells containing these terms
    // Parse the associated numeric value
    // Handle (thousands), millions, etc.
    // This is simplified - real implementation uses regex + validation
  }
}
```

**Compute Cost:**
- **Batch:** 1 CPU, 2GB RAM per 10 filings/minute
- **Storage:** 100MB per ticker-year (HTML + extracted)
- **Scaling:** Horizontally scalable (embarrassingly parallel)

---

## D.2 Feature Store Module

**Interface:**
```typescript
interface FeatureStore {
  // Compute features
  computeFeatures(ticker: string, asOf: Date): Promise<Features>;
  
  // Retrieve cached features
  getFeatures(ticker: string, asOf: Date): Promise<Features | null>;
  
  // Batch computation
  computeBatch(tickers: string[], asOf: Date): Promise<Map<string, Features>>;
  
  // Versioning
  listVersions(featureName: string): Promise<FeatureVersion[]>;
  getFeatureVersion(name: string, version: string): Promise<FeatureDefinition>;
}

interface Features {
  ticker: string;
  as_of: Date;
  
  // Fundamental
  fundamental: {
    revenue_yoy: number;
    revenue_qoq: number;
    revenue_3y_cagr: number;
    margin_gross: number;
    margin_operating: number;
    margin_change_yoy: number;
    roic: number;
    fcf_yield: number;
    net_cash_pct: number;
  };
  
  // Technical
  technical: {
    momentum_12_1: number;  // 12-month return excluding last month
    rsi_14: number;
    volatility_30d: number;
    beta_spy: number;
    correlation_sector: number;
  };
  
  // Valuation
  valuation: {
    pe_ratio: number;
    ps_ratio: number;
    ev_ebitda: number;
    peg_ratio: number;
    pe_percentile_5y: number;
    ps_percentile_5y: number;
  };
  
  // Regime
  regime: {
    vol_regime: 'low' | 'medium' | 'high';
    cycle_phase: 'early' | 'mid' | 'late' | 'trough';
    momentum_regime: 'strong' | 'weak';
    valuation_regime: 'cheap' | 'fair' | 'expensive';
  };
  
  // Metadata
  metadata: {
    computation_time_ms: number;
    cache_hit: boolean;
    version: string;
  };
}
```

**Implementation (Rust Compute Kernel):**
```rust
// crates/feature-compute/src/fundamental.rs

use polars::prelude::*;

pub struct FundamentalFeatures;

impl FundamentalFeatures {
    pub fn compute_revenue_growth(
        financials: &DataFrame,
    ) -> Result<DataFrame> {
        let df = financials
            .sort(["period"], false)?  // Sort descending
            .with_column(
                // YoY growth
                (col("revenue") / col("revenue").shift(4) - lit(1.0))
                    .alias("revenue_yoy")
            )?
            .with_column(
                // QoQ growth  
                (col("revenue") / col("revenue").shift(1) - lit(1.0))
                    .alias("revenue_qoq")
            )?;
            
        Ok(df)
    }
    
    pub fn compute_roic(financials: &DataFrame) -> Result<f64> {
        // ROIC = NOPAT / Invested Capital
        let nopat = self.compute_nopat(financials)?;
        let invested_capital = self.compute_invested_capital(financials)?;
        
        Ok(nopat / invested_capital)
    }
    
    fn compute_nopat(&self, df: &DataFrame) -> Result<f64> {
        // NOPAT = Operating Income * (1 - Tax Rate)
        let operating_income: f64 = df.column("operating_income")?.sum()?;
        let tax_rate = 0.21;  // Simplified - should extract from filing
        
        Ok(operating_income * (1.0 - tax_rate))
    }
}
```

**Storage:**
- **Cache:** Redis (60-second TTL for real-time features)
- **Persistent:** TimescaleDB (hypertable on period)
- **Parquet:** S3/R2 for bulk exports and ML training

**Compute Cost:**
- **Per-ticker:** 10ms (Rust) vs 80ms (Python)
- **Batch (40 tickers):** 400ms with parallelization
- **Scaling:** Stateless, scales horizontally

---

## D.3 Models Module

### D.3.1 Change-Point Detection (Acceleration/Deceleration)

**Goal:** Detect when a metric shifts regime (e.g., revenue growth accelerating).

**Algorithm:** Bayesian Online Changepoint Detection
```python
# Simplified version
def detect_changepoint(time_series: np.array) -> list[int]:
    """
    Returns indices where significant regime changes occurred.
    """
    from ruptures import Pelt
    
    # PELT algorithm for multiple changepoints
    model = Pelt(model="rbf", min_size=3).fit(time_series)
    changepoints = model.predict(pen=10)
    
    return changepoints

# Usage
revenue_growth = get_quarterly_revenue_growth('LRCX')
changepoints = detect_changepoint(revenue_growth)

if changepoints[-1] == len(revenue_growth) - 1:
    print("Recent changepoint detected - regime shift!")
```

**Evidence:**
```python
alert = {
    'ticker': 'LRCX',
    'metric': 'revenue_yoy',
    'event': 'acceleration',
    'changepoint_detected': '2024-Q3',
    'before_regime_mean': 0.08,  # 8% growth
    'after_regime_mean': 0.22,   # 22% growth
    'confidence': 0.87
}
```

---

### D.3.2 Lag Relationship Models

**Goal:** Understand how capex spending in Layer 2 predicts equipment orders in Layer 1.

**Model:** Vector Autoregression (VAR)
```python
from statsmodels.tsa.api import VAR

# Time series
hyperscaler_capex = get_metric(['MSFT', 'GOOGL', 'AMZN'], 'capex')
equipment_revenue = get_metric(['LRCX', 'AMAT'], 'revenue')

# Combine into dataframe
data = pd.DataFrame({
    'hyperscaler_capex': hyperscaler_capex,
    'equipment_revenue': equipment_revenue
})

# Fit VAR model
model = VAR(data)
results = model.fit(maxlags=4)  # Up to 4-quarter lag

# Forecast
forecast = results.forecast(data.values[-4:], steps=4)

# Interpretation
lag_effect = results.params['equipment_revenue']['hyperscaler_capex.L1']
# "1% increase in hyperscaler capex → X% increase in equipment revenue 1Q later"
```

**Use case:**
- Predict LRCX revenue based on MSFT/GOOGL/AMZN capex guidance
- Lead time: 2-4 quarters
- Validate predictions vs actual results

---

### D.3.3 Sensitivity Models

**Goal:** "If natural gas prices rise 20%, how much do MSFT data center margins compress?"

**Approach:** Monte Carlo simulation with correlations
```rust
// crates/risk-models/src/sensitivity.rs

pub struct SensitivityAnalyzer {
    correlations: HashMap<(String, String), f64>,
    volatilities: HashMap<String, f64>,
}

impl SensitivityAnalyzer {
    pub fn run_simulation(
        &self,
        base_case: &Scenario,
        shocks: &HashMap<String, f64>,
        n_sims: usize,
    ) -> SimulationResult {
        let mut outcomes = Vec::new();
        
        for _ in 0..n_sims {
            // Generate correlated shocks
            let shocked_vars = self.generate_correlated_shocks(shocks);
            
            // Compute impact on target
            let outcome = self.compute_outcome(base_case, &shocked_vars);
            outcomes.push(outcome);
        }
        
        SimulationResult {
            mean: mean(&outcomes),
            percentiles: compute_percentiles(&outcomes, &[5, 25, 50, 75, 95]),
            var_95: percentile(&outcomes, 0.05),
        }
    }
}
```

**Example:**
```python
# Shock: Natural gas +20%, power prices +15%
shocks = {'natural_gas': 0.20, 'power_price': 0.15}

# Impact model (simplified linear)
margin_impact = (
    -0.3 * shocks['power_price']  # Power is 30% of COGS for hyperscalers
)

# MSFT sensitivity
msft_margin_base = 0.45  # 45% operating margin
msft_margin_shocked = msft_margin_base + margin_impact
# = 0.45 - 0.045 = 0.405 (40.5%)

# Fair value impact
eps_impact = (msft_margin_shocked / msft_margin_base) - 1
fair_value_shocked = fair_value_base * (1 + eps_impact)
```

**Output:**
- Margin sensitivity to input costs
- Fair value sensitivity to macro shocks
- Ranked list: "Most sensitive to power costs"

---

## D.3.4 Risk Models

**Interface:**
```typescript
interface RiskModel {
  computeVaR(portfolio: Portfolio, confidence: number): number;
  computeCVaR(portfolio: Portfolio, confidence: number): number;
  decomposeRisk(portfolio: Portfolio): RiskDecomposition;
  stressTest(portfolio: Portfolio, scenario: Scenario): StressResult;
}

interface RiskDecomposition {
  total_var: number;
  contributions: Map<string, number>;  // Ticker -> contribution
  factor_exposures: {
    market_beta: number;
    size_factor: number;
    value_factor: number;
    momentum_factor: number;
  };
}
```

**Implementation (Rust):**
```rust
// crates/risk-models/src/var.rs

use ndarray::{Array1, Array2};
use statrs::distribution::{Normal, ContinuousCDF};

pub struct VaRCalculator {
    returns: Array2<f64>,  // T×N matrix (days × assets)
    weights: Array1<f64>,  // N vector
}

impl VaRCalculator {
    pub fn historical_var(&self, confidence: f64) -> f64 {
        // Portfolio returns
        let port_returns = self.returns.dot(&self.weights);
        
        // Empirical quantile
        let mut sorted = port_returns.to_vec();
        sorted.sort_by(|a, b| a.partial_cmp(b).unwrap());
        
        let alpha = 1.0 - confidence;
        let idx = (alpha * sorted.len() as f64) as usize;
        
        sorted[idx]
    }
    
    pub fn parametric_var(&self, confidence: f64) -> f64 {
        let port_returns = self.returns.dot(&self.weights);
        
        // Estimate mean and std
        let mean = port_returns.mean().unwrap();
        let std = port_returns.std(0.0);
        
        // Assume normal distribution
        let normal = Normal::new(mean, std).unwrap();
        let alpha = 1.0 - confidence;
        
        normal.inverse_cdf(alpha)
    }
    
    pub fn component_var(&self, confidence: f64) -> Array1<f64> {
        // Marginal contributions to VaR
        let cov = self.covariance_matrix();
        let port_var = self.weights.dot(&cov.dot(&self.weights));
        let port_vol = port_var.sqrt();
        
        // Component = weight * (cov @ weights) / vol
        let marginal = cov.dot(&self.weights);
        let components = &self.weights * &marginal / port_vol;
        
        // Scale by z-score
        let z = Normal::new(0.0, 1.0).unwrap()
            .inverse_cdf(1.0 - confidence);
        
        components * z.abs()
    }
}
```

**Compute Cost:**
- **VaR (historical):** O(T log T) for sorting, ~1ms for 252 days
- **VaR (parametric):** O(T) for mean/std, ~0.5ms
- **Component VaR:** O(N²) for covariance, ~10ms for 40 assets
- **Monte Carlo:** O(N² × M) for M simulations, ~100ms for 10K sims

---

## D.3.5 Portfolio Optimizer

**Interface:**
```typescript
interface PortfolioOptimizer {
  optimize(
    universe: string[],
    method: 'risk_parity' | 'mean_variance' | 'black_litterman',
    constraints: Constraints
  ): Promise<Portfolio>;
  
  backtest(
    portfolio: Portfolio,
    start: Date,
    end: Date,
    rebalance_freq: 'daily' | 'weekly' | 'monthly'
  ): Promise<BacktestResult>;
}

interface Constraints {
  max_position_size: number;  // e.g., 0.08 for 8% max
  max_sector_exposure: Map<string, number>;
  min_sharpe: number;
  max_drawdown: number;
  min_liquidity_adv: number;  // Min average daily volume
  forbidden_tickers: string[];
}

interface Portfolio {
  weights: Map<string, number>;
  expected_return: number;
  expected_volatility: number;
  sharpe_ratio: number;
  risk_contributions: Map<string, number>;
}
```

**Implementation (Rust with CVXPY binding):**
```rust
// crates/portfolio-opt/src/risk_parity.rs

use pyo3::prelude::*;
use pyo3::types::PyModule;

pub struct RiskParityOptimizer {
    python_runtime: Python,
}

impl RiskParityOptimizer {
    pub fn optimize(
        &self,
        returns: &Array2<f64>,
        constraints: &Constraints,
    ) -> Result<Array1<f64>> {
        // Call Python CVXPY from Rust for complex optimization
        // For simple cases, use pure Rust optimizer
        
        self.python_runtime.with_gil(|py| {
            let cvxpy = PyModule::import(py, "cvxpy")?;
            
            // Build and solve problem
            // ... (CVXPY code from earlier)
            
            Ok(weights)
        })
    }
}
```

**Alternative (Pure Rust):**
```rust
// Using osqp-rs for quadratic programming
use osqp::{Problem, Settings};

pub fn risk_parity_pure_rust(
    cov: &Array2<f64>,
    constraints: &Constraints,
) -> Array1<f64> {
    // Convert to OSQP format
    // Solve quadratic program
    // Return optimal weights
}
```

**Compute Cost:**
- **Optimization:** 100-500ms for 40 assets
- **Backtest (3 years, monthly rebal):** 2-5 seconds
- **Parallel backtests (100 strategies):** 30 seconds on 10-core machine

---

## D.4 Orchestration Module

**Interface:**
```typescript
interface Orchestrator {
  // Schedule batch jobs
  schedule(job: JobDefinition, cron: string): Promise<JobId>;
  
  // Run immediate job
  runJob(job: JobDefinition): Promise<JobResult>;
  
  // Job status
  getJobStatus(jobId: JobId): Promise<JobStatus>;
  
  // Cancel job
  cancelJob(jobId: JobId): Promise<void>;
}

interface JobDefinition {
  name: string;
  type: 'data_refresh' | 'backtest' | 'report_gen' | 'alert_check';
  params: Record<string, any>;
  retries: number;
  timeout_seconds: number;
  resources: {
    cpu: string;  // "500m" = 0.5 CPU
    memory: string;  // "2Gi"
    gpu?: boolean;
  };
}
```

**Implementation (Kubernetes Jobs + Controller):**
```yaml
# infra/k8s/jobs/daily-data-refresh.yaml

apiVersion: batch/v1
kind: CronJob
metadata:
  name: daily-data-refresh
  namespace: capex-cycle
spec:
  schedule: "0 18 * * 1-5"  # 6PM EST, weekdays
  jobTemplate:
    spec:
      template:
        spec:
          containers:
          - name: data-refresh
            image: capex-cycle/data-ingest:v1.2.0
            command: ["bun", "run", "refresh-all"]
            env:
            - name: TICKERS
              valueFrom:
                configMapKeyRef:
                  name: universe-config
                  key: tickers
            resources:
              requests:
                cpu: "2"
                memory: "4Gi"
              limits:
                cpu: "4"
                memory: "8Gi"
          restartPolicy: OnFailure
      backoffLimit: 3
```

**Job Queue (NATS JetStream):**
```typescript
// services/orchestrator/src/queue.ts

import { connect, StringCodec } from 'nats';

export class JobQueue {
  private nc: any;
  private js: any;
  
  async publish(job: JobDefinition): Promise<void> {
    const sc = StringCodec();
    await this.js.publish('jobs.backtest', sc.encode(JSON.stringify(job)));
  }
  
  async subscribe(handler: (job: JobDefinition) => Promise<void>): Promise<void> {
    const sc = StringCodec();
    const sub = await this.js.subscribe('jobs.*');
    
    for await (const msg of sub) {
      const job = JSON.parse(sc.decode(msg.data));
      try {
        await handler(job);
        msg.ack();
      } catch (error) {
        msg.nak();  // Requeue on failure
      }
    }
  }
}
```

**Caching Strategy:**
```typescript
// Redis caching layer

interface CacheStrategy {
  // Hot data: Real-time features (60s TTL)
  features: {
    ttl: 60,
    invalidate_on: ['price_update', 'filing_update']
  };
  
  // Warm data: Daily metrics (24h TTL)
  scores: {
    ttl: 86400,
    invalidate_on: ['fundamental_update']
  };
  
  // Cold data: Historical backtests (7d TTL)
  backtests: {
    ttl: 604800,
    invalidate_on: ['strategy_update']
  };
}
```

---

## D.5 Serving Module

### D.5.1 REST API (Bun.js)

**Why Bun.js over Node.js:**
1. **Speed:** 3-4x faster HTTP throughput
2. **Built-in TypeScript:** No build step needed
3. **Better APIs:** Native fetch, WebSockets, file I/O
4. **Lower memory:** 50% less memory for same workload

**API Structure:**
```typescript
// apps/api/src/server.ts

import { serve } from 'bun';
import { Router } from 'itty-router';

const router = Router();

// Health check
router.get('/health', () => new Response('OK'));

// Get scored universe
router.get('/api/v1/screener', async (req) => {
  const { sector, min_score } = req.query;
  
  // Fetch from feature store
  const scores = await featureStore.getBatch(
    universe.filter(t => t.sector === sector)
  );
  
  // Filter and rank
  const ranked = scores
    .filter(s => s.total_score >= min_score)
    .sort((a, b) => b.total_score - a.total_score);
  
  return Response.json(ranked);
});

// Risk report
router.post('/api/v1/risk-report', async (req) => {
  const { tickers, weights } = await req.json();
  
  // Call Rust risk engine via FFI
  const riskMetrics = await rustEngine.computeRisk(tickers, weights);
  
  // Generate PDF (async job)
  const pdfUrl = await reportGen.generatePDF(riskMetrics);
  
  return Response.json({
    metrics: riskMetrics,
    report_url: pdfUrl
  });
});

// WebSocket for real-time alerts
router.get('/ws/alerts', (req) => {
  const server = serve({
    port: 3001,
    websocket: {
      open(ws) {
        // Subscribe to alert stream
        alertStream.subscribe(ws);
      },
      message(ws, message) {
        // Handle client messages
      },
    },
  });
});

// Start server
serve({
  port: 3000,
  fetch: router.fetch,
});
```

**Performance Characteristics:**
- **Latency:** p50: 20ms, p95: 180ms, p99: 450ms
- **Throughput:** 50K requests/second (single core)
- **Concurrency:** 10K concurrent connections (WebSocket)

---

### D.5.2 Dashboard (React + Plotly)

**Architecture:**
```
apps/dashboard/
├── src/
│   ├── components/
│   │   ├── ScoreCard.tsx          # Ticker score display
│   │   ├── ValuationChart.tsx     # Historical bands
│   │   ├── PortfolioView.tsx      # Allocation pie chart
│   │   └── RiskMatrix.tsx         # Correlation heatmap
│   ├── pages/
│   │   ├── Screener.tsx           # Main ranked list
│   │   ├── TickerDetail.tsx       # Deep dive per stock
│   │   ├── Portfolio.tsx          # Current positions
│   │   └── Risk.tsx               # Risk dashboard
│   ├── hooks/
│   │   ├── useScores.ts           # Real-time score updates
│   │   ├── useWebSocket.ts        # Alert subscriptions
│   │   └── useRiskMetrics.ts      # Portfolio risk
│   └── utils/
│       ├── api.ts                 # API client
│       └── formatters.ts          # Number formatting
```

**Key Features:**
1. **Real-time updates:** WebSocket connection for score changes
2. **Filtering:** By layer, score range, valuation percentile
3. **Sorting:** By score, upside, momentum, any metric
4. **Drill-down:** Click ticker → full detail view with charts
5. **Export:** Download current screener as CSV/Excel

---

### D.5.3 Report Generator

**PDF Risk Report Structure:**
```
Page 1: Cover
- Report date
- Portfolio name
- Summary metrics (VaR, Sharpe, max DD)

Page 2: Executive Summary
- Current allocation (pie chart)
- Performance vs benchmark (line chart)
- Top 5 risks

Pages 3-4: Risk Metrics
- VaR/CVaR table (95%, 99%)
- Drawdown chart with annotations
- Rolling volatility (30/60/90d)
- Correlation matrix heatmap

Pages 5-6: Position Details
- Table: Ticker, Weight, Risk Contribution, Return
- Marginal VaR for each position
- "What-if" scenarios (remove top contributor)

Page 7: Stress Tests
- Historical: 2008 crisis, COVID crash, 2022 tech selloff
- Hypothetical: -20% semiconductors, +50% power costs
- Factor shocks: +2σ move in each factor

Page 8: Appendix
- Methodology notes
- Data sources
- Disclaimers
```

**Implementation:**
```typescript
// services/report-gen/src/pdf-generator.ts

import PDFDocument from 'pdfkit';
import { ChartRenderer } from './charts';

export class RiskReportGenerator {
  async generate(metrics: RiskMetrics): Promise<Buffer> {
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const buffers: Buffer[] = [];
    
    doc.on('data', buffers.push.bind(buffers));
    
    // Page 1: Cover
    this.addCoverPage(doc, metrics);
    doc.addPage();
    
    // Page 2: Summary
    this.addSummaryPage(doc, metrics);
    doc.addPage();
    
    // Pages 3-4: Risk metrics
    await this.addRiskMetricsPages(doc, metrics);
    
    // ... more pages
    
    doc.end();
    
    return new Promise((resolve) => {
      doc.on('end', () => resolve(Buffer.concat(buffers)));
    });
  }
  
  private async addRiskMetricsPages(doc: PDFDocument, metrics: RiskMetrics) {
    // Generate charts using ChartRenderer (matplotlib or plotly via Rust)
    const drawdownChart = await ChartRenderer.renderDrawdown(
      metrics.drawdownSeries
    );
    
    // Embed image
    doc.image(drawdownChart, 50, 100, { width: 500 });
    
    // Add table
    this.addTable(doc, metrics.varTable, { x: 50, y: 400 });
  }
}
```

---

### D.5.4 Alert System

**Alert Types:**
```typescript
type AlertType =
  | 'score_change'        // Score moved >10 points
  | 'valuation_dislocation'  // Crossed percentile threshold
  | 'regime_change'       // Cycle phase shifted
  | 'correlation_spike'   // Correlation >0.9 (risk-off)
  | 'drawdown_threshold'  // Portfolio down >10%
  | 'var_breach'          // Actual loss exceeded VaR
  | 'thesis_break';       // Leading indicator deteriorated

interface Alert {
  id: string;
  type: AlertType;
  severity: 'info' | 'warning' | 'critical';
  ticker?: string;
  message: string;
  details: Record<string, any>;
  timestamp: Date;
  acknowledged: boolean;
}
```

**Delivery Channels:**
```typescript
// services/alerts/src/dispatcher.ts

interface AlertDispatcher {
  sendSlack(alert: Alert): Promise<void>;
  sendEmail(alert: Alert, recipients: string[]): Promise<void>;
  sendSMS(alert: Alert, numbers: string[]): Promise<void>;  // Critical only
  sendWebhook(alert: Alert, url: string): Promise<void>;
}

// Example
const alert: Alert = {
  type: 'score_change',
  severity: 'warning',
  ticker: 'LRCX',
  message: 'LRCX score jumped from 68 → 82 (+14 points)',
  details: {
    drivers: ['Revenue acceleration: 15% → 22% YoY', 'Backlog up 18%'],
    valuation: 'Still cheap at 28th percentile P/E',
    action: 'Consider adding to position'
  }
};

await dispatcher.sendSlack(alert);
```

**Alert Logic:**
```python
# Check for alert conditions (runs every 15 minutes)
def check_alerts():
    current_scores = get_all_scores()
    previous_scores = get_scores(15_minutes_ago)
    
    for ticker in universe:
        delta = current_scores[ticker] - previous_scores[ticker]
        
        if abs(delta) > 10:
            create_alert(
                type='score_change',
                ticker=ticker,
                details={'old': previous_scores[ticker], 'new': current_scores[ticker]}
            )
```

---

## D.6 Governance Module

### D.6.1 Model Registry

**Purpose:** Track all model versions, parameters, and performance.

```typescript
interface ModelRegistry {
  registerModel(model: ModelDefinition): Promise<ModelId>;
  getModel(modelId: ModelId): Promise<ModelDefinition>;
  listModels(filter: ModelFilter): Promise<ModelDefinition[]>;
  
  // A/B testing
  compareModels(modelA: ModelId, modelB: ModelId): Promise<Comparison>;
  promoteModel(modelId: ModelId, stage: 'staging' | 'production'): Promise<void>;
}

interface ModelDefinition {
  id: string;
  name: string;
  version: string;
  type: 'valuation' | 'risk' | 'portfolio';
  
  parameters: Record<string, any>;
  training_data: {
    start_date: Date;
    end_date: Date;
    tickers: string[];
  };
  
  performance: {
    sharpe: number;
    hit_rate: number;
    max_drawdown: number;
  };
  
  metadata: {
    created_at: Date;
    created_by: string;
    commit_hash: string;
    docker_image: string;
  };
}
```

**Storage (PostgreSQL):**
```sql
CREATE TABLE models (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  version VARCHAR(20) NOT NULL,
  type VARCHAR(50) NOT NULL,
  parameters JSONB,
  performance_metrics JSONB,
  stage VARCHAR(20) CHECK (stage IN ('dev', 'staging', 'production')),
  created_at TIMESTAMP DEFAULT NOW(),
  commit_hash VARCHAR(40),
  UNIQUE(name, version)
);

CREATE TABLE model_predictions (
  id SERIAL PRIMARY KEY,
  model_id UUID REFERENCES models(id),
  ticker VARCHAR(10),
  prediction_date DATE,
  predicted_return NUMERIC,
  actual_return NUMERIC,  -- Filled in later for validation
  created_at TIMESTAMP DEFAULT NOW()
);

-- Performance tracking
CREATE INDEX idx_predictions_model_date ON model_predictions(model_id, prediction_date DESC);
```

---

### D.6.2 Audit Logs

**Requirements:**
- Log all API calls (who, what, when)
- Log all signal generations (why this score)
- Log all portfolio decisions (rebalances, trades)
- Retention: 7 years (regulatory)

**Implementation:**
```typescript
// services/audit/src/logger.ts

interface AuditLog {
  id: string;
  timestamp: Date;
  user_id: string;
  action: string;
  resource_type: 'portfolio' | 'model' | 'alert' | 'api_call';
  resource_id: string;
  details: Record<string, any>;
  ip_address: string;
  user_agent: string;
}

export class AuditLogger {
  async log(entry: AuditLog): Promise<void> {
    // Write to TimescaleDB
    await db.insert('audit_logs', entry);
    
    // Also stream to Loki for real-time search
    await loki.push(entry);
  }
  
  async query(filter: AuditFilter): Promise<AuditLog[]> {
    // Query audit trail
    return await db.query(`
      SELECT * FROM audit_logs
      WHERE user_id = $1
      AND timestamp >= $2
      ORDER BY timestamp DESC
      LIMIT 1000
    `, [filter.userId, filter.startDate]);
  }
}
```

---

### D.6.3 Explainability

**Goal:** "Why did ticker X get score Y?"

**Explainability Artifact:**
```json
{
  "ticker": "LRCX",
  "score": 78,
  "as_of": "2025-01-25",
  
  "breakdown": {
    "revenue_accel": {
      "score": 4,
      "contribution": 20,  // 0.25 weight * 4 * 20 = 20 points
      "evidence": "QoQ +18%, YoY +25% per 10-Q filed 2025-01-15"
    },
    "margin_trajectory": {
      "score": 3,
      "contribution": 12,
      "evidence": "Gross margin +120bps YoY per 10-K"
    },
    // ... other components
  },
  
  "valuation_adjustment": {
    "multiplier": 1.15,
    "reason": "Trading at 28th percentile P/E, boosted score from 68 → 78"
  },
  
  "comparable_scenarios": [
    "Similar to LRCX in Q2 2020 (score 75, returned +45% over 6mo)",
    "Dissimilar to LRCX in Q4 2021 (score 82 but at 85th percentile, returned -15%)"
  ]
}
```

---

# PART E: KUBERNETES & HPC

## E.1 Cluster Architecture

**Development (Single Node):**
```bash
# Local k3d cluster
k3d cluster create capex-dev \
  --agents 0 \
  --servers 1 \
  --port "8080:80@loadbalancer" \
  --volume /tmp/capex-data:/data@all

# Resources
CPU: 4 cores
Memory: 8GB
Storage: 50GB
```

**Production (Multi-Node):**
```yaml
# GKE/EKS cluster spec
nodeGroups:
  - name: core-services
    instanceType: n2-standard-8  # 8 vCPU, 32GB
    minSize: 3
    maxSize: 5
    labels:
      workload: "core"
      
  - name: batch-workers
    instanceType: n2-standard-16  # 16 vCPU, 64GB
    minSize: 0
    maxSize: 20
    labels:
      workload: "batch"
    taints:
      - effect: NoSchedule
        key: workload
        value: batch
        
  - name: compute-intensive
    instanceType: c2-standard-60  # 60 vCPU, 240GB
    minSize: 0
    maxSize: 10
    labels:
      workload: "hpc"
```

---

## E.2 KubeRay for Distributed Backtesting

**Why Ray:** Scales Python workloads across 100+ nodes without rewriting code.

**Deployment:**
```yaml
# infra/k8s/ray/ray-cluster.yaml

apiVersion: ray.io/v1alpha1
kind: RayCluster
metadata:
  name: capex-backtest-cluster
spec:
  rayVersion: '2.9.0'
  
  headGroupSpec:
    serviceType: ClusterIP
    replicas: 1
    template:
      spec:
        containers:
        - name: ray-head
          image: rayproject/ray:2.9.0-py311
          resources:
            limits:
              cpu: "4"
              memory: "16Gi"
          ports:
          - containerPort: 6379  # Redis
          - containerPort: 8265  # Dashboard
          
  workerGroupSpecs:
  - groupName: backtest-workers
    replicas: 10
    minReplicas: 0
    maxReplicas: 50
    template:
      spec:
        containers:
        - name: ray-worker
          image: capex-cycle/ray-worker:v1.0
          resources:
            limits:
              cpu: "15"
              memory: "60Gi"
```

**Backtest Workflow:**
```python
# services/backtester/src/ray_backtest.py

import ray

@ray.remote
def backtest_single_strategy(ticker: str, params: dict) -> dict:
    """Run backtest for one ticker with given parameters."""
    # Load data
    prices = load_prices(ticker, params['start'], params['end'])
    
    # Run strategy
    signals = strategy.generate_signals(prices, params)
    
    # Compute metrics
    metrics = compute_metrics(signals, prices)
    
    return {
        'ticker': ticker,
        'params': params,
        'metrics': metrics
    }

# Distribute across cluster
ray.init(address='ray://ray-head:10001')

# Run 1000 backtests in parallel
tickers = load_universe()  # 100 tickers
param_grid = generate_param_grid()  # 10 variations each

futures = [
    backtest_single_strategy.remote(ticker, params)
    for ticker in tickers
    for params in param_grid
]

# Collect results (blocks until all done)
results = ray.get(futures)  # ~5 minutes for 1000 backtests

# Aggregate
best_strategy = max(results, key=lambda r: r['metrics']['sharpe'])
```

**Scaling:**
- **1 node:** ~10 backtests/minute
- **10 nodes:** ~100 backtests/minute
- **50 nodes (autoscale):** ~500 backtests/minute

---

## E.3 Batch Scheduling with Kubernetes Jobs

**Pattern:** Armada-like queue controller

**Architecture:**
```
Job Submission → Queue (NATS) → Job Controller → K8s Job → Worker Pod
```

**Job Controller:**
```typescript
// services/job-controller/src/controller.ts

export class JobController {
  async processQueue() {
    while (true) {
      const job = await queue.dequeue('jobs.pending');
      
      if (job) {
        // Create Kubernetes Job
        const k8sJob = this.createJobManifest(job);
        await k8sClient.createJob(k8sJob);
        
        // Update status
        await queue.enqueue('jobs.running', job);
      }
      
      await sleep(1000);  // Poll every second
    }
  }
  
  private createJobManifest(job: JobDefinition): any {
    return {
      apiVersion: 'batch/v1',
      kind: 'Job',
      metadata: {
        name: `job-${job.id}`,
        namespace: 'capex-cycle'
      },
      spec: {
        template: {
          spec: {
            containers: [{
              name: 'worker',
              image: `capex-cycle/${job.type}:latest`,
              env: [
                { name: 'JOB_ID', value: job.id },
                { name: 'PARAMS', value: JSON.stringify(job.params) }
              ],
              resources: {
                requests: { cpu: job.resources.cpu, memory: job.resources.memory },
                limits: { cpu: job.resources.cpu, memory: job.resources.memory }
              }
            }],
            restartPolicy: 'OnFailure'
          }
        },
        backoffLimit: job.retries,
        activeDeadlineSeconds: job.timeout_seconds
      }
    };
  }
}
```

**Job Types:**
```typescript
const jobs = {
  daily_refresh: {
    schedule: '0 18 * * 1-5',  // 6PM EST weekdays
    resources: { cpu: '2', memory: '4Gi' },
    timeout: 1800  // 30 minutes
  },
  
  weekly_screener: {
    schedule: '0 8 * * 1',  // 8AM Monday
    resources: { cpu: '4', memory: '8Gi' },
    timeout: 3600
  },
  
  monthly_rebalance: {
    schedule: '0 9 1 * *',  // 9AM first of month
    resources: { cpu: '8', memory: '16Gi' },
    timeout: 7200
  },
  
  adhoc_backtest: {
    schedule: null,  // On-demand
    resources: { cpu: '30', memory: '120Gi' },  // Use HPC nodes
    timeout: 14400  // 4 hours
  }
};
```

---

## E.4 Data Processing (DuckDB + Polars)

**Why DuckDB over Spark:**
- Single binary, no cluster needed for <1TB data
- 10-100x faster than Pandas for analytics
- SQL interface + Parquet native
- Upgrade path to distributed mode when needed

**Usage:**
```python
# services/analytics/src/analytics.py

import duckdb
import polars as pl

# Query data directly from S3 Parquet files
conn = duckdb.connect()

query = """
SELECT 
  ticker,
  period,
  revenue,
  revenue / LAG(revenue, 4) OVER (PARTITION BY ticker ORDER BY period) - 1 AS revenue_yoy,
  AVG(revenue) OVER (
    PARTITION BY ticker 
    ORDER BY period 
    ROWS BETWEEN 7 PRECEDING AND CURRENT ROW
  ) AS revenue_8q_avg
FROM read_parquet('s3://capex-data/financials/*.parquet')
WHERE period >= '2020-01-01'
ORDER BY ticker, period DESC
"""

df = conn.execute(query).pl()  # Returns Polars DataFrame

# Further processing with Polars (20-50x faster than pandas)
result = (
    df
    .filter(pl.col('period') >= date(2024, 1, 1))
    .with_columns([
        (pl.col('revenue_yoy') * 100).alias('revenue_yoy_pct'),
        pl.col('revenue').pct_change().alias('revenue_qoq')
    ])
    .groupby('ticker')
    .agg([
        pl.col('revenue_yoy_pct').mean().alias('avg_yoy'),
        pl.col('revenue_qoq').std().alias('growth_volatility')
    ])
)
```

**Upgrade Path to Spark:**
```python
# When data exceeds 1TB or need distributed processing
from pyspark.sql import SparkSession

spark = SparkSession.builder \
    .appName("CapexCycleAnalytics") \
    .config("spark.kubernetes.namespace", "capex-cycle") \
    .getOrCreate()

# Same SQL interface
df = spark.sql(query)
```

---

## E.5 GitOps with ArgoCD

**Deployment Flow:**
```
Code Push → GitHub → CI Build → Docker Push → ArgoCD Sync → K8s Apply
```

**ArgoCD Application:**
```yaml
# infra/argocd/application.yaml

apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: capex-cycle-os
  namespace: argocd
spec:
  project: default
  
  source:
    repoURL: https://github.com/yourorg/capex-cycle-os
    targetRevision: main
    path: infra/k8s/overlays/production
    
  destination:
    server: https://kubernetes.default.svc
    namespace: capex-cycle
    
  syncPolicy:
    automated:
      prune: true
      selfHeal: true
    syncOptions:
    - CreateNamespace=true
    
  # Retry on failure
  retry:
    limit: 5
    backoff:
      duration: 5s
      factor: 2
      maxDuration: 3m
```

**Config Management:**
```
infra/k8s/
├── base/                    # Base manifests
│   ├── namespace.yaml
│   ├── api-deployment.yaml
│   ├── services.yaml
│   └── kustomization.yaml
├── overlays/
│   ├── dev/
│   │   ├── kustomization.yaml
│   │   └── patches/
│   ├── staging/
│   └── production/
│       ├── kustomization.yaml
│       └── patches/
│           ├── replicas.yaml  # 3 replicas
│           ├── resources.yaml  # Higher limits
│           └── secrets.yaml   # Prod secrets
```

---

## E.6 Data Access Layer (Object Storage + Caching)

**Architecture:**
```
Application
    ↓
Redis Cache (hot data, <1GB)
    ↓ (cache miss)
DuckDB Query Layer
    ↓
S3/R2 Object Storage (Parquet files, cold data)
```

**Parquet Organization:**
```
s3://capex-data/
├── prices/
│   ├── daily/
│   │   └── year=2024/
│   │       └── month=01/
│   │           └── prices.parquet  # Partitioned by date
├── financials/
│   └── ticker=LRCX/
│       └── financials.parquet
├── features/
│   └── computed/
│       └── date=2025-01-25/
│           └── features.parquet
└── models/
    └── predictions/
        └── model=valuation-v1.2/
            └── predictions.parquet
```

**Data Access Pattern:**
```typescript
// services/data-access/src/storage.ts

export class DataAccessLayer {
  private redis: Redis;
  private s3: S3Client;
  
  async getFeatures(ticker: string, asOf: Date): Promise<Features | null> {
    // 1. Try cache
    const cached = await this.redis.get(`features:${ticker}:${asOf}`);
    if (cached) return JSON.parse(cached);
    
    // 2. Query from object storage
    const features = await this.queryParquet(
      `s3://capex-data/features/computed/date=${asOf}/features.parquet`,
      `SELECT * FROM features WHERE ticker = '${ticker}'`
    );
    
    // 3. Cache for future
    await this.redis.setex(
      `features:${ticker}:${asOf}`,
      3600,  // 1 hour TTL
      JSON.stringify(features)
    );
    
    return features;
  }
  
  private async queryParquet(path: string, sql: string): Promise<any> {
    // Use DuckDB to query Parquet directly from S3
    const result = await duckdb.query(`
      SELECT * FROM read_parquet('${path}')
      WHERE ${sql}
    `);
    
    return result.toArray();
  }
}
```

**Caching Strategy (Fluid-like for ML):**
```yaml
# For large ML training datasets, use Fluid (JuiceFS on k8s)

apiVersion: data.fluid.io/v1alpha1
kind: Dataset
metadata:
  name: historical-prices
spec:
  mounts:
  - mountPoint: s3://capex-data/prices
    name: prices
    
  # Cache in-cluster for fast access
  replicas: 3
  dataBackup:
    type: warm  # Preload hot data

---
apiVersion: data.fluid.io/v1alpha1
kind: JuiceFSRuntime
metadata:
  name: historical-prices
spec:
  replicas: 3
  tieredstore:
    levels:
    - mediumtype: MEM
      path: /dev/shm
      quota: 10Gi
      high: "0.95"
      low: "0.7"
```

**Effect:** Training jobs read from local SSD cache instead of S3, 10-50x faster.

---

## E.7 Chaos Engineering (PowerfulSeal)

**Purpose:** Test system resilience to failures.

**Scenarios:**
```yaml
# infra/chaos/scenarios.yaml

scenarios:
  - name: api-pod-kill
    description: Kill random API pod to test failover
    steps:
    - podAction:
        matches:
        - namespace: capex-cycle
          labels:
            app: api
        actions:
        - kill:
            probability: 0.5
            
  - name: database-network-delay
    description: Add 200ms latency to database
    steps:
    - networkAction:
        matches:
        - namespace: capex-cycle
          labels:
            app: postgres
        actions:
        - delay:
            delay: 200ms
            jitter: 50ms
            duration: 5m
            
  - name: worker-oom
    description: Trigger OOM in batch worker
    steps:
    - podAction:
        matches:
        - namespace: capex-cycle
          labels:
            workload: batch
        actions:
        - stressMemory:
            workers: 4
            duration: 2m
```

**Run chaos tests:**
```bash
# Deploy PowerfulSeal
kubectl apply -f infra/chaos/powerfulseal.yaml

# Run scenario
seal autonomous --config scenarios.yaml --policy-file policy.yaml

# Monitor
kubectl logs -n capex-cycle -l app=powerfulseal -f
```

**Success Criteria:**
- API stays up (reroutes to healthy pods)
- Jobs retry automatically
- No data loss (transactions rollback cleanly)
- Alerts fire correctly

---

# PART F: BUILD PLAN

## Phase 0: Local Prototype (Days 1-7)

**Goal:** Working system on a laptop.

**Stack:**
- Python for everything (defer Rust)
- SQLite instead of Postgres
- Local file storage instead of S3
- Streamlit for UI

**Deliverables:**
- [x] Projects 1-3 working
- [ ] Basic data pipeline (yfinance)
- [ ] SQLite schema with sample data
- [ ] Simple CLI tools

---

## Phase 1: Containerization + CI (Days 8-14)

**Goal:** Production-ready containers with CI/CD.

**Tasks:**
1. **Dockerize all services:**
```dockerfile
# apps/api/Dockerfile

FROM oven/bun:1.0
WORKDIR /app

COPY package.json bun.lockb ./
RUN bun install --frozen-lockfile

COPY . .

EXPOSE 3000
CMD ["bun", "run", "start"]
```

2. **GitHub Actions CI:**
```yaml
# .github/workflows/ci.yaml

name: CI

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v3
    
    - name: Setup Bun
      uses: oven-sh/setup-bun@v1
      
    - name: Install dependencies
      run: bun install
      
    - name: Run tests
      run: bun test
      
    - name: Build Docker images
      run: docker build -t capex-cycle/api:${{ github.sha }} apps/api
      
    - name: Push to registry
      if: github.ref == 'refs/heads/main'
      run: docker push capex-cycle/api:${{ github.sha }}
```

3. **docker-compose for dev:**
```yaml
# docker-compose.yaml

version: '3.8'

services:
  api:
    build: ./apps/api
    ports:
      - "3000:3000"
    environment:
      DATABASE_URL: postgres://user:pass@postgres:5432/capex
      REDIS_URL: redis://redis:6379
    depends_on:
      - postgres
      - redis
      
  postgres:
    image: timescale/timescaledb:latest-pg15
    environment:
      POSTGRES_DB: capex
      POSTGRES_USER: user
      POSTGRES_PASSWORD: pass
    volumes:
      - postgres-data:/var/lib/postgresql/data
      
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
      
  dashboard:
    build: ./apps/dashboard
    ports:
      - "3001:3000"
      
volumes:
  postgres-data:
```

**Deliverables:**
- [ ] All services containerized
- [ ] CI/CD pipeline working
- [ ] Local compose stack running

---

## Phase 2: Kubernetes Deployment + GitOps (Days 15-23)

**Goal:** Production k8s cluster with GitOps.

**Tasks:**

1. **Provision cluster (EKS/GKE):**
```bash
# Using Terraform (optional)
terraform apply -var-file=production.tfvars

# Or manual (GKE example)
gcloud container clusters create capex-cycle \
  --zone us-central1-a \
  --num-nodes 3 \
  --machine-type n2-standard-8 \
  --enable-autoscaling \
  --min-nodes 3 \
  --max-nodes 10
```

2. **Deploy ArgoCD:**
```bash
kubectl create namespace argocd
kubectl apply -n argocd -f https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml

# Access UI
kubectl port-forward svc/argocd-server -n argocd 8080:443
```

3. **Deploy applications via ArgoCD:**
```bash
kubectl apply -f infra/argocd/application.yaml

# ArgoCD automatically syncs from Git
# Any push to main → automatic deployment
```

4. **Set up monitoring:**
```yaml
# infra/k8s/monitoring/prometheus.yaml

apiVersion: v1
kind: ConfigMap
metadata:
  name: prometheus-config
data:
  prometheus.yml: |
    global:
      scrape_interval: 15s
      
    scrape_configs:
    - job_name: 'api'
      kubernetes_sd_configs:
      - role: pod
        namespaces:
          names: ['capex-cycle']
      relabel_configs:
      - source_labels: [__meta_kubernetes_pod_label_app]
        regex: api
        action: keep
```

**Deliverables:**
- [ ] K8s cluster live
- [ ] ArgoCD managing deployments
- [ ] Prometheus + Grafana monitoring
- [ ] All services deployed

---

## Phase 3: HPC Scaling (Days 24-30)

**Goal:** Distributed backtesting with KubeRay.

**Tasks:**

1. **Deploy Ray cluster:**
```bash
helm repo add kuberay https://ray-project.github.io/kuberay-helm/
helm install ray-cluster kuberay/ray-cluster \
  --namespace capex-cycle \
  --set image.tag=2.9.0-py311 \
  --set head.replicas=1 \
  --set worker.replicas=10
```

2. **Submit batch backtests:**
```python
# Submit 1000 backtest jobs
import ray

ray.init("ray://ray-cluster-head:10001")

@ray.remote
def run_backtest(ticker, params):
    # Backtest logic
    return metrics

# Distribute
results = ray.get([
    run_backtest.remote(t, p) 
    for t in tickers 
    for p in param_grid
])
```

3. **Autoscaling:**
```yaml
# infra/k8s/ray/autoscaler.yaml

apiVersion: ray.io/v1alpha1
kind: RayCluster
metadata:
  name: backtest-cluster
spec:
  enableInTreeAutoscaling: true
  autoscalerOptions:
    idleTimeoutSeconds: 300  # Scale down after 5min idle
    resources:
      limits:
        cpu: "500"
        memory: "2Gi"
```

**Deliverables:**
- [ ] KubeRay cluster operational
- [ ] Autoscaling tested (0 → 20 → 0 workers)
- [ ] Backtest throughput: 500+/minute

---

## Phase 4: Enterprise Hardening (Days 31-45)

**Goal:** Security, compliance, SLAs.

**Tasks:**

1. **Authentication & Authorization:**
```typescript
// Implement JWT-based auth
import jwt from 'jsonwebtoken';

middleware.use(async (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }
});

// RBAC
const permissions = {
  'analyst': ['read:scores', 'read:reports'],
  'trader': ['read:scores', 'read:reports', 'create:portfolio'],
  'admin': ['*']
};
```

2. **Secrets Management (Vault):**
```yaml
# Deploy Vault
apiVersion: v1
kind: Service
metadata:
  name: vault
spec:
  selector:
    app: vault
  ports:
  - port: 8200
    
---
# Inject secrets into pods
apiVersion: apps/v1
kind: Deployment
metadata:
  name: api
spec:
  template:
    metadata:
      annotations:
        vault.hashicorp.com/agent-inject: "true"
        vault.hashicorp.com/role: "api"
        vault.hashicorp.com/agent-inject-secret-db: "database/creds/api"
```

3. **SLO/SLA Monitoring:**
```yaml
# Prometheus recording rules

groups:
- name: slo
  interval: 30s
  rules:
  - record: api:latency:p95
    expr: histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))
    
  - record: api:error_rate
    expr: rate(http_requests_total{status=~"5.."}[5m]) / rate(http_requests_total[5m])
    
  - alert: SLOViolation
    expr: api:latency:p95 > 0.5 OR api:error_rate > 0.01
    annotations:
      summary: "SLO violated: p95 latency >500ms or error rate >1%"
```

**Deliverables:**
- [ ] JWT authentication
- [ ] RBAC with user roles
- [ ] Secrets in Vault
- [ ] SLO alerts configured

---

# CONTINUED IN ARCHITECTURE_PART2.md ...
