import { FactorRiskService } from './factor-risk.service';

describe('FactorRiskService', () => {
  let service: FactorRiskService;
  const mockMarketDataService = {
    getQuote: jest.fn().mockResolvedValue({ price: 150 }),
  };
  const mockCacheService = {
    getOrSet: jest.fn().mockImplementation((_key, fn) => fn()),
  };

  beforeEach(() => {
    service = new FactorRiskService(
      mockMarketDataService as any,
      mockCacheService as any,
    );
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('calculateFactorExposures returns portfolio-level exposures', async () => {
    const positions = [
      { ticker: 'AAPL', quantity: 100 },
      { ticker: 'JPM', quantity: 50 },
    ];
    const result = await service.calculateFactorExposures(positions);
    expect(result.portfolioValue).toBeGreaterThan(0);
    expect(result.exposures).toHaveProperty('MKT');
    expect(result.exposures).toHaveProperty('SMB');
    expect(result.exposures).toHaveProperty('HML');
    expect(result.stockExposures).toHaveLength(2);
    expect(typeof result.totalFactorRisk).toBe('number');
    expect(typeof result.idiosyncraticRisk).toBe('number');
  });

  it('factorDescriptions includes all six factors', async () => {
    const positions = [{ ticker: 'MSFT', quantity: 10 }];
    const result = await service.calculateFactorExposures(positions);
    const factors = Object.keys(result.factorDescriptions);
    expect(factors).toEqual(
      expect.arrayContaining(['MKT', 'SMB', 'HML', 'RMW', 'CMA', 'MOM']),
    );
  });

  it('decomposeReturns returns factor contributions and alpha', async () => {
    const positions = [{ ticker: 'NVDA', quantity: 20 }];
    const result = await service.decomposeReturns(positions, 'daily');
    expect(result.period).toBe('daily');
    expect(result.factorContributions).toHaveProperty('MKT');
    expect(typeof result.alpha).toBe('number');
    expect(result.r_squared).toBe(0.85);
  });

  it('riskContributions sum to approximately 100%', async () => {
    const positions = [
      { ticker: 'AAPL', quantity: 100 },
      { ticker: 'JPM', quantity: 50 },
    ];
    const result = await service.calculateFactorExposures(positions);
    const total = Object.values(result.riskContributions).reduce(
      (sum, v) => sum + v,
      0,
    );
    expect(Math.abs(total - 100)).toBeLessThan(5);
  });

  // ── Coverage: all ticker categories ──────────────────────────
  it('estimates factor exposures for techSmall stocks', async () => {
    const positions = [{ ticker: 'PLTR', quantity: 100 }];
    const result = await service.calculateFactorExposures(positions);
    expect(result.exposures.SMB).toBeGreaterThan(0); // small cap = positive SMB
    expect(result.exposures.MKT).toBeGreaterThan(1); // high beta
  });

  it('estimates factor exposures for value stocks', async () => {
    const positions = [{ ticker: 'JPM', quantity: 100 }];
    const result = await service.calculateFactorExposures(positions);
    expect(result.exposures.HML).toBeGreaterThan(0); // value = positive HML
  });

  it('estimates factor exposures for growth stocks', async () => {
    const positions = [{ ticker: 'TSLA', quantity: 100 }];
    const result = await service.calculateFactorExposures(positions);
    expect(result.exposures.HML).toBeLessThan(0); // growth = negative HML
    expect(result.exposures.MOM).toBeGreaterThan(0); // momentum
  });

  it('estimates factor exposures for smallCap stocks', async () => {
    const positions = [{ ticker: 'GME', quantity: 100 }];
    const result = await service.calculateFactorExposures(positions);
    expect(result.exposures.SMB).toBeGreaterThan(0.5);
  });

  it('decomposes returns for weekly and monthly periods', async () => {
    const positions = [{ ticker: 'AAPL', quantity: 100 }];
    const weekly = await service.decomposeReturns(positions, 'weekly');
    expect(weekly.period).toBe('weekly');
    expect(weekly.factorContributions).toHaveProperty('MKT');

    const monthly = await service.decomposeReturns(positions, 'monthly');
    expect(monthly.period).toBe('monthly');
    expect(monthly.totalReturn).toBeGreaterThan(weekly.totalReturn);
  });

  it('includes idiosyncratic risk in results', async () => {
    const positions = [
      { ticker: 'AAPL', quantity: 100 },
      { ticker: 'MSFT', quantity: 100 },
    ];
    const result = await service.calculateFactorExposures(positions);
    expect(result.idiosyncraticRisk).toBeGreaterThan(0);
    expect(result.factorDescriptions).toHaveProperty('MKT');
  });
});
