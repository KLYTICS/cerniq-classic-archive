import { Test, TestingModule } from '@nestjs/testing';
import { RiskController } from './risk.controller';
import { RiskService } from './risk.service';
import { AdvancedRiskService } from './advanced-risk.service';
import { AuthGuard } from '../auth/auth.guard';

describe('RiskController', () => {
  let controller: RiskController;
  let riskService: Record<string, jest.Mock>;
  let advancedRiskService: Record<string, jest.Mock>;

  const mockReq = { user: { userId: 'user-1' } };

  beforeEach(async () => {
    riskService = {
      runMonteCarloSimulation: jest.fn(),
      calculateVaR: jest.fn(),
      calculateCorrelationMatrix: jest.fn(),
      getPortfolioRisk: jest.fn(),
      runStressTest: jest.fn(),
    };

    advancedRiskService = {
      calculateComponentVaR: jest.fn(),
      forecastVolatility: jest.fn(),
      calculateParametricVaR: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [RiskController],
      providers: [
        { provide: RiskService, useValue: riskService },
        { provide: AdvancedRiskService, useValue: advancedRiskService },
      ],
    })
      .overrideGuard(AuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<RiskController>(RiskController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('runMonteCarloSimulation', () => {
    it('should run a Monte Carlo simulation', async () => {
      const mockResult = { paths: 10000, meanReturn: 0.08 };
      riskService.runMonteCarloSimulation.mockResolvedValue(mockResult);

      const request = { ticker: 'AAPL', simulations: 10000 };
      const result = await controller.runMonteCarloSimulation(request as any);
      expect(result).toEqual(mockResult);
      expect(riskService.runMonteCarloSimulation).toHaveBeenCalledWith(request);
    });
  });

  describe('calculateVaR', () => {
    it('should calculate VaR', async () => {
      const mockResult = { var95: -0.05, var99: -0.08 };
      riskService.calculateVaR.mockResolvedValue(mockResult);

      const request = { portfolio: [{ ticker: 'AAPL', weight: 0.5 }] };
      const result = await controller.calculateVaR(request as any);
      expect(result).toEqual(mockResult);
      expect(riskService.calculateVaR).toHaveBeenCalledWith(request);
    });
  });

  describe('calculateCorrelationMatrix', () => {
    it('should calculate correlation matrix', async () => {
      const mockResult = {
        matrix: [
          [1, 0.5],
          [0.5, 1],
        ],
      };
      riskService.calculateCorrelationMatrix.mockResolvedValue(mockResult);

      const request = { tickers: ['AAPL', 'MSFT'] };
      const result = await controller.calculateCorrelationMatrix(
        request as any,
      );
      expect(result).toEqual(mockResult);
      expect(riskService.calculateCorrelationMatrix).toHaveBeenCalledWith(
        request,
      );
    });
  });

  describe('getPortfolioRisk', () => {
    it('should return portfolio risk', async () => {
      const mockResult = { riskLevel: 'moderate' };
      riskService.getPortfolioRisk.mockResolvedValue(mockResult);

      const result = await controller.getPortfolioRisk('p1', mockReq);
      expect(result).toEqual(mockResult);
      expect(riskService.getPortfolioRisk).toHaveBeenCalledWith('p1', 'user-1');
    });
  });

  describe('runStressTest', () => {
    it('should run stress test', async () => {
      const mockResult = { impact: -0.15 };
      riskService.runStressTest.mockResolvedValue(mockResult);

      const scenarios = [{ name: 'Crash', shockPercent: -20 }];
      const result = await controller.runStressTest(
        'p1',
        mockReq,
        scenarios as any,
      );
      expect(result).toEqual(mockResult);
      expect(riskService.runStressTest).toHaveBeenCalledWith(
        'p1',
        'user-1',
        scenarios,
      );
    });
  });

  describe('calculateComponentVaR', () => {
    it('should calculate component VaR', async () => {
      const mockResult = { componentVar: [0.01, 0.02] };
      advancedRiskService.calculateComponentVaR.mockResolvedValue(mockResult);

      const request = { positions: [{ ticker: 'AAPL' }] };
      const result = await controller.calculateComponentVaR(request as any);
      expect(result).toEqual(mockResult);
      expect(advancedRiskService.calculateComponentVaR).toHaveBeenCalledWith(
        request,
      );
    });
  });

  describe('forecastVolatility', () => {
    it('should forecast volatility with default horizon', async () => {
      const mockResult = { forecast: 0.2 };
      advancedRiskService.forecastVolatility.mockResolvedValue(mockResult);

      const result = await controller.forecastVolatility('AAPL');
      expect(result).toEqual(mockResult);
      expect(advancedRiskService.forecastVolatility).toHaveBeenCalledWith({
        ticker: 'AAPL',
        horizon: 30,
      });
    });

    it('should use custom horizon', async () => {
      advancedRiskService.forecastVolatility.mockResolvedValue({});

      await controller.forecastVolatility('AAPL', 60);
      expect(advancedRiskService.forecastVolatility).toHaveBeenCalledWith({
        ticker: 'AAPL',
        horizon: 60,
      });
    });
  });

  describe('calculateParametricVaR', () => {
    it('should calculate parametric VaR', async () => {
      const mockResult = { var: -0.03 };
      advancedRiskService.calculateParametricVaR.mockResolvedValue(mockResult);

      const request = { confidence: 0.95, holdings: [] };
      const result = await controller.calculateParametricVaR(request as any);
      expect(result).toEqual(mockResult);
      expect(advancedRiskService.calculateParametricVaR).toHaveBeenCalledWith(
        request,
      );
    });
  });
});
