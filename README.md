# CapexCycle OS - AI Market Analysis Platform

**Modern full-stack platform for crypto, AI, and tech market analysis with real-time data and AI-powered insights**

## 🚀 Architecture

- **Frontend**: Next.js 14+ (App Router) + Bun + TailwindCSS
- **Backend**: Rust (Axum) for high-performance APIs
- **Database**: PostgreSQL + TimescaleDB for time-series data
- **Cache/Pub-Sub**: Redis
- **Real-time**: WebSocket streaming
- **AI/LLM**: Integrated insights engine

## 📦 Features

### ✅ Implemented
- User authentication (JWT-based)
- Database schema with migrations
- API infrastructure
- WebSocket support
- Modern responsive UI

### 🚧 In Progress
- Risk Parity Portfolio Optimizer
- VaR/CVaR Risk Reports
- Valuation Screener
- AI Market Insights
- Real-time market data streaming

## 🏁 Quick Start

### Prerequisites
- Rust 1.70+ ([Install](https://rustup.rs/))
- Bun ([Install](https://bun.sh/))
- Docker & Docker Compose
- PostgreSQL 15+ (via Docker)

### Installation

```bash
# Clone repository
cd /Users/money/Desktop/CapexCycleOS

# Copy environment file
cp .env.example .env
# Edit .env with your API keys

# Start database and Redis
make docker-up

# Install dependencies
make install

# Run database migrations
make migrate

# Start development servers
make dev
```

This will start:
- **Backend**: http://localhost:8000
- **Frontend**: http://localhost:3000
- **PostgreSQL**: localhost:5432
- **Redis**: localhost:6379

## 📚 Project Structure

```
CapexCycleOS/
├── backend/                 # Rust backend (Axum)
│   ├── src/
│   │   ├── main.rs         # Server entry point
│   │   ├── auth/           # Authentication module
│   │   ├── models.rs       # Database models
│   │   ├── routes/         # API routes
│   │   ├── compute/        # Computational engines
│   │   └── market_data/    # Market data providers
│   └── Cargo.toml
├── frontend/                # Next.js frontend
│   ├── app/                # App Router pages
│   │   ├── page.tsx        # Login page
│   │   └── dashboard/      # Dashboard
│   ├── lib/                # Utilities
│   │   ├── api.ts          # API client
│   │   ├── store.ts        # State management
│   │   └── websocket.ts    # WebSocket hook
│   └── package.json
├── migrations/              # Database migrations
├── docker-compose.yml       # Docker services
├── Makefile                # Development commands
└── README.md
```

## 🛠️ Development Commands

```bash
# Development
make dev                    # Start all services
make dev-backend           # Backend only
make dev-frontend          # Frontend only

# Database
make migrate               # Run migrations
make db-reset             # Reset database (⚠️ destroys data)
make db-shell             # Open PostgreSQL shell

# Testing
make test                 # Run all tests
make lint                 # Lint code
make format               # Format code

# Docker
make docker-up            # Start Docker services
make docker-down          # Stop Docker services
make docker-logs          # View logs
```

## 🔐 Authentication

The platform uses JWT-based authentication:

1. Register or login at http://localhost:3000
2. Receive JWT token (stored in localStorage)
3. Token automatically included in API requests
4. Access protected dashboard and features

## 📊 API Endpoints

### Authentication
- `POST /auth/register` - Create new account
- `POST /auth/login` - Login and receive JWT

### Portfolios (Protected)
- `GET /api/portfolios` - List user portfolios
- `POST /api/portfolios` - Create portfolio

### Risk Analysis (Protected)
- `GET /api/risk/:id` - Get risk metrics

### Market Data (Protected)
- `POST /api/market-data` - Fetch historical data

### AI Insights (Protected)
- `GET /api/insights` - Get AI-generated insights

### WebSocket
- `WS /ws` - Real-time data stream

## 🎨 Frontend Tech Stack

- **Framework**: Next.js 14+ with App Router
- **Styling**: TailwindCSS with custom gradients
- **State**: Zustand for global state
- **API**: Axios with interceptors
- **Real-time**: Custom WebSocket hook
- **Charts**: Recharts (planned)

## 🦀 Backend Tech Stack

- **Framework**: Axum (async Rust web framework)
- **Database**: SQLx with PostgreSQL
- **Cache**: Redis
- **Auth**: JWT + Argon2 password hashing
- **Compute**: ndarray for numerical operations
- **WebSocket**: Native Axum WebSocket support

## 🗄️ Database Schema

- **users**: User accounts with encrypted passwords
- **portfolios**: User-owned portfolios
- **positions**: Portfolio positions (ticker + weight)
- **market_data**: TimescaleDB hypertable for price data
- **ai_insights**: LLM-generated insights with confidence scores

## 🚀 Deployment

```bash
# Build for production
make build

# Deploy (configure your target first)
make deploy-prod
```

## 📝 Environment Variables

See `.env.example` for required environment variables:

- Database credentials
- Redis URL
- JWT secret
- API keys (market data, LLM providers)
- Service ports

## 🔜 Roadmap

**Phase 1: Foundation** ✅
- [x] Project setup
- [x] Authentication
- [x] Database schema

**Phase 2: Core Features** 🚧
- [ ] Risk parity engine (Rust port)
- [ ] VaR/CVaR calculations  
- [ ] Portfolio management UI

**Phase 3: AI Integration**
- [ ] LLM insights generation
- [ ] Market classification models
- [ ] Opportunity scoring

**Phase 4: Real-Time**
- [ ] Market data streaming
- [ ] Live price updates
- [ ] WebSocket client

**Phase 5: Production**
- [ ] Comprehensive testing
- [ ] Performance optimization
- [ ] CI/CD pipeline
- [ ] Deployment

## 🤝 Contributing

This is a portfolio project. For collaboration inquiries, please open an issue.

## 📄 License

Private - All Rights Reserved

---

**Built with**: Rust 🦀, Next.js ⚛️, PostgreSQL 🐘, and ❤️ for quantitative finance
