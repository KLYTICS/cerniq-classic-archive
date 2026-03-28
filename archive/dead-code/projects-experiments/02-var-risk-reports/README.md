# Project 2: VaR/CVaR Risk Report Generator

## Goal
Production-grade risk reporting system that generates institutional-quality PDF reports for any portfolio. Demonstrates understanding of risk management practices used by hedge funds and asset managers.

## Why This Matters
- **Institutional standard**: VaR (Value at Risk) is the industry standard risk metric
- **Regulatory compliance**: Required by Basel III, Dodd-Frank, and many risk frameworks
- **Real-world application**: This is what risk teams actually build
- **Demonstrates**: Statistical rigor + production engineering skills

## Core Metrics

### Value at Risk (VaR)
Maximum expected loss over a given time horizon at a specified confidence level.
- **VaR(95%)**: "95% confident we won't lose more than X%"
- **VaR(99%)**: "99% confident we won't lose more than X%"

### Conditional Value at Risk (CVaR / Expected Shortfall)
Average loss in the worst (1-α)% of cases. More informative than VaR because it captures tail risk.

### Other Metrics
- **Maximum Drawdown**: Largest peak-to-trough decline
- **Rolling Volatility**: 30/60/90-day annualized volatility
- **Stress Days**: Worst 10 daily losses
- **Correlation Matrix**: Asset co-movement patterns

## Features

### 1. Historical VaR/CVaR
- Parametric (assumes normal distribution)
- Historical simulation (empirical distribution)
- Monte Carlo simulation (optional)

### 2. Stress Testing
- Identify worst historical days
- Sector-specific stress scenarios
- Custom shock scenarios

### 3. Risk Decomposition
- Contribution to VaR by position
- Marginal VaR (impact of position size changes)
- Correlation-adjusted risk

### 4. Visualizations
- Drawdown waterfall chart
- Rolling volatility bands
- Loss distribution histogram
- Correlation heatmap
- VaR backtesting (coverage test)

## Output Formats
1. **PDF Report**: Executive-ready, branded, chartpack-style
2. **JSON/API**: Programmatic access to all metrics
3. **Excel**: Detailed data tables for further analysis
4. **Streamlit Dashboard**: Interactive exploration

## Usage

```bash
# Generate report for a portfolio
python generate_report.py --tickers NVDA,AMD,MSFT --weights 0.4,0.3,0.3 --output report.pdf

# Or use the interactive dashboard
streamlit run app.py
```

## Technical Implementation

### Risk Calculation Engine (`risk_engine.py`)
- Historical VaR: 95th/99th percentile of historical returns
- CVaR: Mean of returns beyond VaR threshold
- Efficient vectorized calculations with NumPy

### Report Generator (`report_generator.py`)
- Uses ReportLab for professional PDF generation
- Matplotlib for high-quality charts
- Modular sections: cover page, metrics, charts, appendix

### API Endpoint (`api.py`) - Optional
- FastAPI service for programmatic access
- Endpoint: `POST /risk-report` with portfolio JSON
- Returns risk metrics + pre-signed PDF URL

## Example Output

```
Portfolio Risk Report
Generated: 2025-01-25

Portfolio Summary:
  - Assets: 5
  - Total Value: $1,000,000
  - Lookback: 252 days

Risk Metrics (Daily):
  - VaR (95%): -2.34%
  - VaR (99%): -3.87%
  - CVaR (95%): -3.12%
  - CVaR (99%): -4.45%

Annualized:
  - Volatility: 28.5%
  - Max Drawdown: -18.2%
  - Sharpe Ratio: 1.45

Top Risk Contributors:
  1. NVDA: 35.2% of portfolio risk
  2. AMD: 28.1% of portfolio risk
  3. MSFT: 20.3% of portfolio risk
```

## Why This Impresses Recruiters

1. **Practical**: This is exactly what risk teams build
2. **Technical depth**: Shows understanding of both statistics and software engineering
3. **Production-ready**: PDF generation, API, error handling
4. **Institutional knowledge**: Uses industry-standard metrics and methodologies
5. **Modular**: Clean separation of risk engine, reporting, and presentation

## Future Enhancements
- Integrate with Bloomberg/FactSet data
- Add parametric VaR with GARCH volatility forecasting
- Implement historical scenario analysis (2008 crisis, COVID crash)
- Multi-currency portfolio support
- Real-time risk monitoring with alerting
- Compliance: Add UCITS/AIFMD/Basel report templates
