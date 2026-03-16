/**
 * Capex Cycle OS - Main API Server
 * Built with Bun.js for maximum performance
 */

import { serve, type Server } from 'bun';
import { router, json, error } from './router';
import { FeatureStore } from './services/features';
import { ValuationEngine } from './services/valuation';
import { RiskCalculator } from './services/risk';

// Configuration
const PORT = process.env.PORT || 3000;
const ENV = process.env.NODE_ENV || 'development';

// Initialize services
const featureStore = new FeatureStore({
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
  dbUrl: process.env.DATABASE_URL || 'postgres://localhost/capex'
});

const valuationEngine = new ValuationEngine(featureStore);
const riskCalculator = new RiskCalculator();

// Health check
router.get('/health', () => {
  return json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: ENV
  });
});

// Get scored universe (screener)
router.get('/api/v1/screener', async (req) => {
  const url = new URL(req.url);
  const sector = url.searchParams.get('sector');
  const minScore = parseFloat(url.searchParams.get('min_score') || '0');
  const sortBy = url.searchParams.get('sort') || 'score';
  
  try {
    // Get universe of tickers
    const universe = await getUniverseForSector(sector);
    
    // Fetch scores in parallel
    const scores = await Promise.all(
      universe.map(ticker => featureStore.getScore(ticker))
    );
    
    // Filter and sort
    const filtered = scores
      .filter(s => s && s.total_score >= minScore)
      .sort((a, b) => {
        if (sortBy === 'score') return b.total_score - a.total_score;
        if (sortBy === 'upside') return b.valuation.upside_pct - a.valuation.upside_pct;
        return 0;
      });
    
    return json({
      count: filtered.length,
      timestamp: new Date().toISOString(),
      results: filtered
    });
  } catch (err) {
    return error(500, `Failed to fetch screener: ${err.message}`);
  }
});

// Get detailed ticker analysis
router.get('/api/v1/ticker/:ticker', async (req) => {
  const { ticker } = req.params;
  
  try {
    const [score, valuation, features] = await Promise.all([
      featureStore.getScore(ticker),
      valuationEngine.getValue(ticker),
      featureStore.getFeatures(ticker)
    ]);
    
    if (!score) {
      return error(404, `Ticker ${ticker} not found`);
    }
    
    return json({
      ticker,
      score,
      valuation,
      features,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    return error(500, `Failed to fetch ticker data: ${err.message}`);
  }
});

// Portfolio risk analysis
router.post('/api/v1/risk-report', async (req) => {
  try {
    const body = await req.json();
    const { tickers, weights, confidence = 0.95 } = body;
    
    // Validate inputs
    if (!Array.isArray(tickers) || !Array.isArray(weights)) {
      return error(400, 'tickers and weights must be arrays');
    }
    
    if (tickers.length !== weights.length) {
      return error(400, 'tickers and weights must have same length');
    }
    
    const sumWeights = weights.reduce((a, b) => a + b, 0);
    if (Math.abs(sumWeights - 1.0) > 0.01) {
      return error(400, `weights must sum to 1.0, got ${sumWeights}`);
    }
    
    // Fetch historical returns
    const returns = await featureStore.getReturns(tickers, {
      lookback: 252  // 1 year daily
    });
    
    // Calculate risk metrics
    const metrics = await riskCalculator.compute({
      returns,
      weights,
      confidence
    });
    
    // Generate PDF report (async job)
    const reportId = await scheduleReportGeneration(metrics);
    
    return json({
      metrics,
      report_id: reportId,
      report_url: `/api/v1/reports/${reportId}`,
      estimated_ready_at: new Date(Date.now() + 120000).toISOString() // 2min
    });
  } catch (err) {
    return error(500, `Failed to compute risk: ${err.message}`);
  }
});

// Portfolio optimization
router.post('/api/v1/optimize', async (req) => {
  try {
    const body = await req.json();
    const { 
      tickers, 
      method = 'risk_parity',
      constraints = {}
    } = body;
    
    // Call Rust optimizer via FFI for performance
    const optimized = await callRustOptimizer(tickers, method, constraints);
    
    // Backtest
    const backtest = await backtestPortfolio(optimized.weights, {
      start: '2020-01-01',
      end: new Date().toISOString().split('T')[0],
      rebalance_freq: 'monthly'
    });
    
    return json({
      weights: optimized.weights,
      risk_contributions: optimized.risk_contributions,
      expected_sharpe: optimized.sharpe,
      backtest
    });
  } catch (err) {
    return error(500, `Optimization failed: ${err.message}`);
  }
});

// WebSocket for real-time alerts
const wss = new Set<WebSocket>();

router.get('/ws/alerts', (req) => {
  const upgraded = req.upgrade();
  
  if (!upgraded) {
    return error(400, 'WebSocket upgrade required');
  }
  
  // Handle in websocket context
  return;
});

// WebSocket handlers
const websocket = {
  open(ws: WebSocket) {
    wss.add(ws);
    console.log('WebSocket connected, total:', wss.size);
    
    // Send initial state
    ws.send(JSON.stringify({
      type: 'connected',
      timestamp: new Date().toISOString()
    }));
  },
  
  message(ws: WebSocket, message: string) {
    try {
      const data = JSON.parse(message);
      
      if (data.type === 'subscribe') {
        // Subscribe to specific alert types
        ws.send(JSON.stringify({
          type: 'subscribed',
          channels: data.channels
        }));
      }
    } catch (err) {
      console.error('WebSocket message error:', err);
    }
  },
  
  close(ws: WebSocket) {
    wss.delete(ws);
    console.log('WebSocket disconnected, total:', wss.size);
  }
};

// Broadcast alerts to all connected clients
export function broadcastAlert(alert: any) {
  const message = JSON.stringify({
    type: 'alert',
    ...alert
  });
  
  for (const ws of wss) {
    ws.send(message);
  }
}

// Start server
const server = serve({
  port: PORT,
  fetch: router.fetch,
  websocket,
  
  error(error) {
    return new Response(`Server error: ${error.message}`, { 
      status: 500 
    });
  }
});

console.log(`🚀 Capex Cycle OS API running on http://localhost:${PORT}`);
console.log(`📊 Environment: ${ENV}`);
console.log(`⚡️ Runtime: Bun v${Bun.version}`);

// Helper functions
async function getUniverseForSector(sector: string | null): Promise<string[]> {
  // In production, fetch from database
  // For now, hardcoded universes
  const universes = {
    'semiconductor': ['NVDA', 'AMD', 'AVGO', 'INTC', 'MU', 'QCOM'],
    'equipment': ['LRCX', 'AMAT', 'KLAC', 'ASML', 'TER'],
    'cloud': ['MSFT', 'GOOGL', 'AMZN', 'ORCL', 'IBM'],
    'networking': ['ANET', 'CSCO', 'CIEN', 'JNPR'],
    'all': [
      'NVDA', 'AMD', 'AVGO', 'INTC', 'MU',
      'LRCX', 'AMAT', 'KLAC', 'ASML', 'TER',
      'MSFT', 'GOOGL', 'AMZN', 'META',
      'ANET', 'CSCO'
    ]
  };
  
  return universes[sector || 'all'] || universes['all'];
}

async function callRustOptimizer(
  tickers: string[], 
  method: string, 
  constraints: any
) {
  // In production, call Rust library via FFI
  // For now, placeholder
  return {
    weights: tickers.map(() => 1.0 / tickers.length),
    risk_contributions: tickers.map(() => 1.0 / tickers.length),
    sharpe: 1.5
  };
}

async function backtestPortfolio(weights: number[], options: any) {
  // In production, run actual backtest
  return {
    total_return: 0.45,
    cagr: 0.12,
    volatility: 0.18,
    sharpe: 1.52,
    max_drawdown: -0.15,
    calmar: 0.80
  };
}

async function scheduleReportGeneration(metrics: any): Promise<string> {
  const reportId = `report_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  // In production, submit to job queue (NATS/Redis)
  // For now, log
  console.log('Scheduled report generation:', reportId);
  
  return reportId;
}

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down gracefully...');
  server.stop();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Received SIGTERM, shutting down...');
  server.stop();
  process.exit(0);
});
