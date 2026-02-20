# Project 1: Risk Parity Portfolio - AI Infrastructure Stack

## Goal
Build a risk-balanced portfolio across the AI capital expenditure supply chain, from semiconductors to cloud infrastructure, using modern portfolio theory.

## Why This Matters
- **Traditional 60/40 fails in tech**: Equal weighting overweights high-volatility assets
- **Risk parity balances contributions**: Each asset contributes equally to portfolio risk
- **Sector knowledge**: Understanding the AI stack layers shows domain expertise

## The AI Capex Stack

```
Layer 1: Inputs (Semiconductors)
├── NVDA (GPUs - compute)
├── AMD (GPUs/CPUs - compute)  
├── AVGO (networking chips)
└── INTC (foundry/legacy)

Layer 2: Enablement (Equipment)
├── LRCX (etch/deposition)
├── AMAT (wafer fab equipment)
└── ASML (lithography)

Layer 3: Infrastructure (Cloud/Networking)
├── MSFT (Azure AI)
├── GOOGL (GCP + TPUs)
├── AMZN (AWS Trainium)
├── META (Llama infra)
└── ANET (datacenter networking)

Layer 4: Power (Utilities)
├── AEP (grid infrastructure)
└── NEE (renewable energy)
```

## Methodology

### 1. Risk Parity Algorithm
- Estimate covariance matrix from historical returns
- Solve for weights where each asset contributes equal risk:
  - `w_i * (Σw)_i = k` for all assets
- Use iterative optimization (Newton's method or CVXPY)

### 2. Benchmark Comparison
- Equal weight portfolio
- Market cap weight
- 60/40 stocks/bonds (SPY/TLT)

### 3. Risk Metrics
- Portfolio volatility
- Max drawdown
- Sharpe ratio
- Individual risk contributions

## Features
- **Interactive**: Adjust lookback period, rebalance frequency
- **Visual**: Risk contribution pie chart, cumulative returns
- **Exportable**: Download weights as CSV
- **Backtest**: Performance since 2020

## Usage

```bash
cd projects/01-risk-parity-ai-infra
streamlit run app.py
```

## Technical Implementation
- **Optimizer**: CVXPY for convex optimization
- **Data**: yfinance for adjusted close prices
- **Covariance**: 252-day rolling window, optional shrinkage
- **Rebalancing**: Monthly (20 trading days)

## Output
1. Optimal risk parity weights
2. Risk contribution breakdown
3. Backtest vs benchmarks (2020-present)
4. Rolling Sharpe ratio chart
5. Correlation heatmap

## Why This Impresses Recruiters
1. Shows understanding of modern portfolio theory
2. Demonstrates sector/domain knowledge (AI supply chain)
3. Clean code + production-ready structure
4. Practical application of convex optimization
5. Interactive tool, not just a notebook

## Next Steps
- Add transaction cost modeling
- Implement robust covariance estimation (Ledoit-Wolf shrinkage)
- Add regime detection (high/low vol states)
- Connect to real portfolio tracking
