# Quick Start Guide

Get your quant portfolio up and running in 5 minutes.

## Prerequisites
- Python 3.11+ installed
- Git installed
- 4GB+ RAM available

## Installation

### 1. Clone or Setup Repository
```bash
# If you received this as a folder
cd capex-cycle-quant

# Or initialize git
git init
git add .
git commit -m "Initial commit: Capex Cycle Quant Platform"
```

### 2. Run Setup Script
```bash
chmod +x setup.sh
./setup.sh
```

This will:
- Create a virtual environment
- Install all Python dependencies
- Create necessary directories
- Set up configuration templates

### 3. Activate Virtual Environment
```bash
source venv/bin/activate  # Mac/Linux
# or
venv\Scripts\activate     # Windows
```

## Running the Projects

### Project 1: Risk Parity Portfolio
```bash
cd projects/01-risk-parity-ai-infra
streamlit run app.py
```

**What it does:** Interactive portfolio optimizer that builds a risk-balanced allocation across the AI infrastructure stack (semiconductors, cloud, networking, power).

**First run:** Will download ~3 years of market data (takes 10-30 seconds)

**Try this:**
1. Select different layers (e.g., just Semiconductors + Cloud)
2. Adjust the lookback period slider (60 days vs 252 days)
3. Compare Risk Parity vs Equal Weight performance
4. Download the optimal weights as CSV

---

### Project 2: VaR/CVaR Risk Reports
```bash
cd projects/02-var-risk-reports
streamlit run app.py
```

**What it does:** Generate institutional-quality risk reports for any portfolio with VaR, CVaR, max drawdown, and stress testing.

**Default portfolio:** NVDA (25%), MSFT (20%), ANET (20%), AMD (20%), GOOGL (15%)

**Try this:**
1. Enter your own portfolio (tickers + weights)
2. View VaR at 95% and 99% confidence levels
3. See the worst 10 days in your portfolio's history
4. Export the risk report as JSON

---

### Project 3: AI Semiconductor Valuation Screener
```bash
cd projects/03-ai-valuation-screener
streamlit run app.py
```

**Status:** ⚠️ Coming soon (build this next!)

**What it will do:** Find undervalued semiconductor equipment stocks by normalizing earnings to mid-cycle levels and detecting current cycle position.

---

## Troubleshooting

### "Module not found" errors
```bash
# Make sure you're in the virtual environment
source venv/bin/activate

# Reinstall dependencies
pip install -r requirements.txt
```

### Streamlit port already in use
```bash
# Use a different port
streamlit run app.py --server.port 8502
```

### Data download slow or failing
```bash
# yfinance sometimes has rate limits
# Wait 1 minute and try again
# Or reduce the date range in the sidebar
```

### Python version issues
```bash
# Check version
python3 --version

# Should be 3.11+
# If not, install latest Python from python.org
```

## Next Steps

### 1. Customize the Projects
- Edit the ticker lists in `app.py`
- Adjust parameters (lookback periods, confidence levels)
- Add your own benchmarks

### 2. Add Tests
```bash
# Install test dependencies
pip install pytest pytest-cov

# Run tests (after you write them!)
pytest tests/
```

### 3. Deploy to Cloud
- Streamlit Cloud (free tier): https://streamlit.io/cloud
- Railway: https://railway.app
- Render: https://render.com

### 4. Build Project 3
Follow the README in `projects/03-ai-valuation-screener/` to build the semiconductor screener.

### 5. Start Applying to Jobs
With 2-3 working projects, you have a strong portfolio. See `docs/job_search_strategy.md` for application tips.

---

## File Structure
```
capex-cycle-quant/
├── README.md                 # Overview
├── EXECUTION_PLAN.md         # Detailed roadmap
├── QUICKSTART.md            # This file
├── requirements.txt          # Python dependencies
├── setup.sh                 # Automated setup
├── projects/
│   ├── 01-risk-parity-ai-infra/
│   │   ├── app.py           # Streamlit app
│   │   ├── risk_parity.py   # Optimization engine
│   │   └── README.md
│   ├── 02-var-risk-reports/
│   │   ├── app.py
│   │   ├── risk_engine.py
│   │   └── README.md
│   └── 03-ai-valuation-screener/
│       └── README.md         # Spec (to be built)
└── data/                     # Downloaded data cached here
```

## Tips for Success

1. **Start simple:** Run Project 1 first, understand how it works
2. **Read the code:** Each module has docstrings explaining the logic
3. **Modify gradually:** Change one thing at a time, see what breaks
4. **Add your own ideas:** Customize tickers, add features, experiment
5. **Document changes:** Update READMEs as you enhance the projects

## Getting Help

- **Code questions:** Read the module docstrings and comments
- **Errors:** Check the Streamlit error messages (very helpful)
- **Theory questions:** See the README files for methodology explanations

## Demo Video Ideas

Record 2-3 minute demos showing:
1. **Project 1:** "Building a risk-balanced AI infrastructure portfolio"
2. **Project 2:** "Generating institutional risk reports in 30 seconds"
3. Post on LinkedIn/GitHub with link to repo

---

**Ready to start?**
```bash
source venv/bin/activate
cd projects/01-risk-parity-ai-infra
streamlit run app.py
```

Good luck! 🚀
