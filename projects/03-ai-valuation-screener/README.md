# Project 3: AI Semiconductor Valuation Screener

## Goal
Multi-regime valuation engine for cyclical semiconductor equipment stocks. Identify undervalued opportunities by normalizing earnings to mid-cycle levels and detecting current cycle position.

## The Semiconductor Capex Cycle

Semiconductor equipment (LRCX, AMAT, KLAC, ASML, TER) follows a distinct 3-5 year cycle driven by:
1. **Demand waves**: New technology nodes (5nm → 3nm → 2nm)
2. **Capacity additions**: Chip makers build new fabs
3. **Equipment orders**: 6-12 month lead time
4. **Revenue recognition**: 3-6 month lag after shipment

**Problem:** Traditional P/E ratios are misleading:
- At cycle peak: Low P/E (high earnings) → Looks cheap but about to decline
- At cycle trough: High P/E (depressed earnings) → Looks expensive but about to recover

**Solution:** Normalize to mid-cycle earnings and adjust multiples for cycle regime.

## Methodology

### 1. Cycle Regime Detection
Classify current position in the cycle:

**Early Cycle:**
- Backlog accelerating (QoQ growth > 10%)
- Capacity utilization rising
- Equipment orders > shipments
- **Multiple:** Premium (15-20x mid-cycle earnings)

**Mid Cycle:**
- Steady growth (5-10% QoQ)
- High capacity utilization (>85%)
- Orders ≈ shipments
- **Multiple:** Fair value (12-15x)

**Late Cycle:**
- Decelerating growth (<5% QoQ)
- Peak utilization, no new orders
- Shipments > orders (drawing down backlog)
- **Multiple:** Discount (8-12x)

**Trough:**
- Negative growth
- Low utilization (<70%)
- Minimal orders
- **Multiple:** Deep value (6-10x, but with risk)

### 2. Mid-Cycle Normalization
```
Mid-Cycle EPS = Average(EPS) from last 2 full cycles
Normalized P/E = Current Price / Mid-Cycle EPS
Fair Value = Mid-Cycle EPS × Regime Multiple
```

### 3. Valuation Bands
For each stock, compute historical percentiles:
- P/E: 10th, 25th, 50th, 75th, 90th percentile
- P/S: Same percentiles
- EV/EBITDA: Same percentiles

**Buy zone:** Below 25th percentile + in Early/Mid cycle  
**Sell zone:** Above 75th percentile + in Late cycle  
**Watch zone:** Everything else

### 4. Scoring System (0-100)
```
Score = 0.4 × Valuation Score (percentile-based)
      + 0.3 × Momentum Score (backlog growth, revenue accel)
      + 0.2 × Quality Score (margins, ROIC)
      + 0.1 × Technical Score (relative strength, price vs MA)
```

## Universe

**Primary (Equipment):**
- LRCX (Lam Research): Etch & deposition
- AMAT (Applied Materials): Wafer fab equipment
- KLAC (KLA Corp): Inspection & metrology
- ASML (ASML Holding): Lithography (EUV monopoly)
- TER (Teradyne): Test equipment

**Secondary (Customers - for cycle context):**
- TSM (TSMC): Leading foundry
- INTC (Intel): IDM transitioning to foundry
- NVDA (Nvidia): Fabless, large capex driver

## Features

1. **Interactive Dashboard:**
   - Ranked list of opportunities (highest score first)
   - Regime classification for each stock
   - Valuation bands chart (current vs historical)
   - Backlog momentum indicators

2. **Alerts:**
   - "LRCX entering buy zone (22nd percentile P/E, Early Cycle)"
   - "AMAT in sell zone (78th percentile, Late Cycle risk)"

3. **Detailed Views:**
   - Historical cycle chart (revenue, earnings, multiples)
   - Peer comparison (relative valuation)
   - Sensitivity analysis ("If we enter downturn, fair value drops 30%")

## Data Requirements

### Quarterly Fundamentals (from 10-Q/10-K):
- Revenue, Operating Income, Net Income
- R&D, Capex
- Backlog (if disclosed)
- Segment breakdowns

### Market Data:
- Daily prices (adjusted for splits)
- Market cap
- Shares outstanding

### Macro Indicators:
- FRED: Semiconductor billings (proxy for demand)
- PMI Manufacturing (economic cycle)
- WFE spending forecasts (industry reports)

## Implementation

```bash
# Directory structure
/projects/03-ai-valuation-screener/
├── data_fetch.py           # Download filings + prices
├── valuation_engine.py     # Normalization + scoring
├── regime_detector.py      # Cycle classification
├── app.py                  # Streamlit UI
├── screener.py             # CLI tool
└── tests/
```

## Usage

```bash
# Run screener
python screener.py --sector semiconductor --min-score 70

# Interactive dashboard
streamlit run app.py
```

## Output Example

```
AI Semiconductor Valuation Screener
Generated: 2025-01-25

Top Opportunities:
1. LRCX - Score: 85
   - Current P/E: 18.2x (25th percentile)
   - Mid-Cycle P/E: 12.5x → Fair Value: $110 (Current: $92, +19% upside)
   - Regime: Early Cycle
   - Backlog: +15% QoQ
   - Risk: Medium (cyclical volatility)

2. KLAC - Score: 78
   - Current P/E: 22.1x (40th percentile)
   - Mid-Cycle P/E: 15.8x → Fair Value: $680 (Current: $645, +5% upside)
   - Regime: Mid Cycle
   - Backlog: +8% QoQ
   - Risk: Low (strong moat in inspection)

Watch List:
- AMAT: Late Cycle risk, currently at 68th percentile
- TER: Trough, high risk but potential deep value
```

## Why This Impresses

1. **Sector expertise**: Shows deep understanding of semiconductor cycle
2. **Thoughtful valuation**: Not just P/E ratios, but regime-adjusted
3. **Practical**: Actionable signals, not academic theory
4. **Data engineering**: Parsing filings, building feature pipeline
5. **Risk awareness**: Explicitly flags cycle risks

## Next Steps
- Add custom scenario analysis ("What if AI capex slows 30%?")
- Integrate insider trading data (Form 4 filings)
- Connect to portfolio optimizer (size positions based on conviction)
- Historical backtest: "Would this have flagged LRCX in 2019 trough?"

## Dependencies
```
yfinance
pandas
numpy
sec-api (or custom EDGAR parser)
streamlit
plotly
```

---
**Note:** This is a valuation tool, not a trading signal. Always combine with fundamental research and risk management.
