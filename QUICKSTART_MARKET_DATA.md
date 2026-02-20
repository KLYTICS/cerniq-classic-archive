# CapexCycleOS - Quick Start Guide
## Getting Real-Time Market Data Working

### 1. Start the Services

```bash
# From project root
docker-compose up -d postgres redis
```

### 2. Run Database Migrations

```bash
cd backend
sqlx migrate run
# or use: make migrate
```

### 3. Start Backend

```bash
cd backend
cargo run
# or use: cargo watch -x run for hot reload
```

Backend will be available at: `http://localhost:8001`

### 4. Start Frontend

```bash
cd frontend
bun run dev
```

Frontend will be available at: `http://localhost:3002`

### 5. Test Market Data API

```bash
# Test single ticker
curl "http://localhost:8001/api/market-data/NVDA?start=2024-01-01&end=2024-01-31"

# Test batch fetch
curl "http://localhost:8001/api/market-data/batch?tickers=NVDA,LRCX,AMAT&start=2024-01-01&end=2024-01-31"
```

### 6. Test WebSocket Streaming

**Option A: Use the Frontend Component**

Add to any page in `/frontend/app/`:

```tsx
import MarketTicker from '@/components/MarketTicker';

export default function Page() {
  return (
    <div className="p-8">
      <MarketTicker tickers={['NVDA', 'LRCX', 'AMAT', 'ASML', 'AVGO']} />
    </div>
  );
}
```

**Option B: Test via Browser Console**

```javascript
const ws = new WebSocket('ws://localhost:8001/ws');

ws.onopen = () => {
  console.log('Connected!');
  // Subscribe to tickers
  ws.send(JSON.stringify({
    type: 'subscribe',
    tickers: ['NVDA', 'LRCX', 'AMAT']
  }));
};

ws.onmessage = (event) => {
  console.log('Received:', JSON.parse(event.data));
};
```

### WebSocket Message Protocol

**Client → Server:**
```json
// Subscribe to tickers
{
  "type": "subscribe",
  "tickers": ["NVDA", "LRCX", "AMAT"]
}

// Unsubscribe from tickers
{
  "type": "unsubscribe",
  "tickers": ["NVDA"]
}

// Ping
{
  "type": "ping"
}
```

**Server → Client:**
```json
// Price update (sent every 5 seconds for subscribed tickers)
{
  "type": "price_update",
  "ticker": "NVDA",
  "price": 875.50,
  "change": 12.30,
  "change_percent": 1.42,
  "volume": 52340000,
  "timestamp": "2026-01-28T17:15:00Z"
}

// Subscription confirmation
{
  "type": "subscribed",
  "tickers": ["NVDA", "LRCX", "AMAT"]
}

// Error
{
  "type": "error",
  "message": "Failed to fetch NVDA: ..."
}

// Pong response
{
  "type": "pong"
}
```

### Troubleshooting

**Backend won't start:**
- Check PostgreSQL is running: `docker ps | grep postgres`
- Check Redis is running: `docker ps | grep redis`
- Verify migrations ran: `cd backend && sqlx migrate run`

**No market data:**
- Check backend logs for API errors
- yfinance API might be rate-limited (wait 60 seconds)
- Try AlphaVantage fallback by setting `ALPHAVANTAGE_API_KEY` in `.env`

**WebSocket won't connect:**
- Verify backend is running on port 8001
- Check browser console for connection errors
- Test with: `wscat -c ws://localhost:8001/ws` (install: `npm i -g wscat`)

### Next Steps

1. **Add to Dashboard**: Integrate `MarketTicker` into `/frontend/app/dashboard/page.tsx`
2. **Configure Tickers**: Set default tickers in environment or config
3. **Implement Caching**: Add Redis caching to reduce API calls
4. **Build Charts**: Use Recharts to visualize price history

### Environment Variables

**Backend** (`.env` or `backend/.env`):
```bash
DATABASE_URL=postgresql://capexcycle:password@localhost:5433/capexcycle
REDIS_URL=redis://localhost:6380
BACKEND_PORT=8001
JWT_SECRET=your-secret-key
ALPHAVANTAGE_API_KEY=optional-for-fallback
```

**Frontend** (frontend/.env.local):
```bash
NEXT_PUBLIC_API_URL=http://localhost:8001
NEXT_PUBLIC_WS_URL=ws://localhost:8001/ws
```

---

**Status:** ✅ Market data service and WebSocket streaming are fully implemented and ready to use!
