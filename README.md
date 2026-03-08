# CERNIQ

> **Institutional-Grade Quantitative Finance Platform**

[![CI/CD](https://github.com/your-org/cerniq/actions/workflows/ci-cd.yml/badge.svg)](https://github.com/your-org/cerniq/actions)
[![Version](https://img.shields.io/badge/version-2.0.0-blue.svg)](https://github.com/your-org/cerniq)

---

## 🎯 Overview

CERNIQ is a professional-grade financial analytics platform designed for quantitative analysts, portfolio managers, and options traders. It provides real-time market data, advanced risk analytics, technical charting, and execution quality analysis.

---

## ✨ Key Features

### 📊 Risk Analytics
- **Component VaR** - Risk decomposition by position
- **GARCH Forecasting** - 30-day volatility predictions
- **Stress Testing** - 7 historical crisis scenarios
- **Factor Models** - Fama-French 6-factor analysis
- **Monte Carlo VaR** - Simulation-based risk

### 📈 Premium Charting
- **Candlestick Charts** - Interactive OHLCV visualization
- **8 Technical Indicators** - SMA, EMA, RSI, MACD, Bollinger Bands, VWAP, ATR, Stochastic
- **Multiple Timeframes** - 1D, 1W, 1M, 3M, 1Y, ALL

### 🔴 Real-Time Data
- **Live Prices** - WebSocket streaming
- **Live Greeks** - Options sensitivity updates
- **Portfolio P&L** - Real-time unrealized gains

### 🎯 Execution Analytics
- **Slippage Analysis** - Basis point measurement
- **VWAP Comparison** - Execution benchmarking
- **Best Execution Reports** - MiFID II compliant
- **Backtesting Engine** - Strategy simulation

### 📉 Volatility Analytics
- **3D IV Surface** - Strike × Expiry visualization
- **Volatility Cone** - Historical percentiles
- **IV Smile Analysis** - Cross-strike comparison

---

## 🚀 Quick Start

### Prerequisites
- Node.js 20+
- Docker & Docker Compose
- Redis (optional, uses Docker)

### Development Setup

```bash
# Clone repository
git clone https://github.com/your-org/cerniq.git
cd cerniq

# Start infrastructure
docker-compose up postgres redis -d

# Backend Node.js
cd backend-node
npm install
npm run start:dev

# Frontend (new terminal)
cd frontend
npm install
npm run dev
```

### Docker Production

```bash
docker-compose up --build
```

### Access
- Frontend: http://localhost:3001
- Backend API: http://localhost:3000
- API Status: http://localhost:3000/api/status
- Health Check: http://localhost:3000/health

---

## 📚 Documentation

| Document | Description |
|----------|-------------|
| [API Reference](docs/API_REFERENCE.md) | Complete REST API documentation |
| [Architecture](docs/ARCHITECTURE.md) | System design and diagrams |

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Frontend (Next.js 14)                    │
│  Components: Charts, Risk, Options, Realtime, Execution    │
└─────────────────────┬───────────────────┬──────────────────┘
                      │ REST              │ WebSocket
┌─────────────────────▼───────────────────▼──────────────────┐
│                  Backend Node.js (NestJS)                   │
│  Modules: MarketData, Risk, Options, Charts, Execution     │
└─────────────────────┬───────────────────┬──────────────────┘
                      │                   │
        ┌─────────────▼─────┐   ┌────────▼────────┐
        │   PostgreSQL +    │   │     Redis       │
        │   TimescaleDB     │   │    (Cache)      │
        └───────────────────┘   └─────────────────┘
```

---

## 📊 API Endpoints

| Category | Endpoints | Example |
|----------|-----------|---------|
| Market Data | 5 | `GET /api/market-data/quote/AAPL` |
| Charts | 3 | `GET /api/charts/technical/AAPL?timeframe=1M` |
| Risk | 8 | `POST /api/risk/component-var` |
| Options | 4 | `POST /api/options/greeks` |
| Execution | 6 | `POST /api/execution/backtest` |
| WebSocket | 3 | `subscribe-ticker`, `subscribe-greeks` |

---

## 🧪 Testing

```bash
# Unit tests
cd backend-node && npm run test

# E2E tests
npm run test:e2e

# Coverage
npm run test:cov
```

---

## 🛠️ Technology Stack

**Frontend:** Next.js 14, React 18, Recharts, Plotly.js, Framer Motion, Tailwind CSS

**Backend:** NestJS, TypeScript, Socket.IO, Redis, PostgreSQL

**Infrastructure:** Docker, GitHub Actions, GHCR

---

## 📈 Performance

| Metric | Value |
|--------|-------|
| API Response | ~150ms |
| Cached Response | ~10ms |
| WebSocket Latency | ~300ms |
| Chart Render | ~50ms |

---

## 📄 License

MIT License - See [LICENSE](LICENSE) for details.

---

**Built for quantitative finance professionals** 🚀
