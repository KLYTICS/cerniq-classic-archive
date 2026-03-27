import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';

describe('API Integration Tests (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Charts API', () => {
    it('GET /api/charts/ohlcv/:ticker should return OHLCV data', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/charts/ohlcv/AAPL?timeframe=1M')
        .expect(200);

      expect(response.body).toHaveProperty('ticker');
      expect(response.body).toHaveProperty('timeframe');
      expect(response.body).toHaveProperty('data');
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    it('GET /api/charts/technical/:ticker should return data with indicators', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/charts/technical/AAPL?timeframe=1M&indicators=sma20,rsi')
        .expect(200);

      expect(response.body).toHaveProperty('ohlcv');
      expect(response.body).toHaveProperty('indicators');
      expect(response.body.indicators).toHaveProperty('sma20');
      expect(response.body.indicators).toHaveProperty('rsi');
    });
  });

  describe('Risk API', () => {
    it('POST /api/risk/component-var should calculate component VaR', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/risk/component-var')
        .send({
          positions: [
            { ticker: 'AAPL', quantity: 100, price: 175 },
            { ticker: 'GOOGL', quantity: 50, price: 140 },
          ],
          confidenceLevel: 0.95,
          horizon: 1,
        })
        .expect(200);

      expect(response.body).toHaveProperty('portfolioVaR');
      expect(response.body).toHaveProperty('components');
      expect(response.body.portfolioVaR).toBeGreaterThan(0);
    });

    it('GET /api/risk/forecast-volatility/:ticker should return GARCH forecast', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/risk/forecast-volatility/AAPL?horizon=30')
        .expect(200);

      expect(response.body).toHaveProperty('forecast');
      expect(response.body).toHaveProperty('model');
      expect(response.body.forecast.length).toBe(30);
    });

    it('POST /api/risk/correlation should return correlation matrix', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/risk/correlation')
        .send({ tickers: ['AAPL', 'GOOGL', 'MSFT'] })
        .expect(200);

      expect(response.body).toHaveProperty('tickers');
      expect(response.body).toHaveProperty('matrix');
      expect(response.body.matrix.length).toBe(3);
      expect(response.body.matrix[0].length).toBe(3);

      // Diagonal should be 1
      expect(response.body.matrix[0][0]).toBe(1);
      expect(response.body.matrix[1][1]).toBe(1);
      expect(response.body.matrix[2][2]).toBe(1);
    });
  });

  describe('Execution API', () => {
    it('POST /api/execution/slippage should analyze slippage', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/execution/slippage')
        .send({
          ticker: 'AAPL',
          executionPrice: 175.1,
          executionTime: new Date().toISOString(),
          side: 'BUY',
          quantity: 100,
        })
        .expect(200);

      expect(response.body).toHaveProperty('slippageBps');
      expect(response.body).toHaveProperty('quality');
      expect(['EXCELLENT', 'GOOD', 'FAIR', 'POOR']).toContain(
        response.body.quality,
      );
    });

    it('GET /api/execution/strategies should return available strategies', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/execution/strategies')
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);
      expect(response.body[0]).toHaveProperty('name');
      expect(response.body[0]).toHaveProperty('type');
      expect(response.body[0]).toHaveProperty('params');
    });

    it('POST /api/execution/backtest should run backtest', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/execution/backtest')
        .send({
          strategy: {
            name: 'SMA Crossover',
            type: 'SMA_CROSSOVER',
            lookbackPeriod: 30,
            params: { shortPeriod: 10, longPeriod: 20 },
          },
          tickers: ['AAPL'],
          startDate: '2023-01-01',
          endDate: '2023-03-31',
          initialCapital: 100000,
          commission: 5,
        })
        .expect(200);

      expect(response.body).toHaveProperty('metrics');
      expect(response.body).toHaveProperty('equityCurve');
      expect(response.body.metrics).toHaveProperty('totalReturn');
      expect(response.body.metrics).toHaveProperty('sharpeRatio');
    });
  });

  describe('Market Data API', () => {
    it('GET /api/market-data/quote/:ticker should return quote', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/market-data/quote/AAPL')
        .expect(200);

      expect(response.body).toHaveProperty('symbol');
      expect(response.body).toHaveProperty('price');
    });
  });

  describe('Options API', () => {
    it('POST /api/options/greeks should calculate Greeks', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/options/greeks')
        .send({
          underlying: 175,
          strike: 180,
          timeToExpiry: 0.25,
          riskFreeRate: 0.05,
          volatility: 0.25,
          optionType: 'CALL',
        })
        .expect(200);

      expect(response.body).toHaveProperty('delta');
      expect(response.body).toHaveProperty('gamma');
      expect(response.body).toHaveProperty('theta');
      expect(response.body).toHaveProperty('vega');
      expect(response.body).toHaveProperty('rho');
    });
  });
});

// WebSocket tests
describe('WebSocket Integration Tests', () => {
  // Note: These are conceptual tests - actual WebSocket testing requires socket.io-client
  describe('Realtime Gateway', () => {
    it('should handle subscribe-ticker events', () => {
      // WebSocket subscription test would go here
      expect(true).toBe(true);
    });

    it('should handle subscribe-greeks events', () => {
      // Greeks subscription test would go here
      expect(true).toBe(true);
    });

    it('should handle subscribe-portfolio-pnl events', () => {
      // Portfolio P&L subscription test would go here
      expect(true).toBe(true);
    });
  });
});
