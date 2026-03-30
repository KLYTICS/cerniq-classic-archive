import { Test, TestingModule } from '@nestjs/testing';
import { HttpException } from '@nestjs/common';
import { VolatilityController } from './volatility.controller';
import { VolatilityService } from './volatility.service';

describe('VolatilityController', () => {
  let controller: VolatilityController;
  let volatilityService: Record<string, jest.Mock>;

  beforeEach(async () => {
    volatilityService = {
      getVolatilityCone: jest.fn(),
      getVolatilityHeatmap: jest.fn(),
      getRealizedVsImplied: jest.fn(),
      getVolatilityStats: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [VolatilityController],
      providers: [{ provide: VolatilityService, useValue: volatilityService }],
    }).compile();

    controller = module.get<VolatilityController>(VolatilityController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getVolatilityCone', () => {
    it('should return volatility cone data', async () => {
      const mockCone = { percentiles: { p10: 0.1, p50: 0.2 } };
      volatilityService.getVolatilityCone.mockResolvedValue(mockCone);

      const result = await controller.getVolatilityCone('aapl');
      expect(result).toEqual(mockCone);
      expect(volatilityService.getVolatilityCone).toHaveBeenCalledWith('AAPL');
    });

    it('should throw HttpException on error', async () => {
      volatilityService.getVolatilityCone.mockRejectedValue(
        new Error('Calc failed'),
      );

      await expect(controller.getVolatilityCone('BAD')).rejects.toThrow(
        HttpException,
      );
    });
  });

  describe('getVolatilityHeatmap', () => {
    it('should return volatility heatmap', async () => {
      const mockHeatmap = { matrix: [[0.2]] };
      volatilityService.getVolatilityHeatmap.mockResolvedValue(mockHeatmap);

      const result = await controller.getVolatilityHeatmap('aapl');
      expect(result).toEqual(mockHeatmap);
      expect(volatilityService.getVolatilityHeatmap).toHaveBeenCalledWith(
        'AAPL',
      );
    });

    it('should throw HttpException on error', async () => {
      volatilityService.getVolatilityHeatmap.mockRejectedValue(
        new Error('fail'),
      );

      await expect(controller.getVolatilityHeatmap('BAD')).rejects.toThrow(
        HttpException,
      );
    });
  });

  describe('getRealizedVsImplied', () => {
    it('should return RV vs IV data with default days', async () => {
      const mockData = { series: [], spread: 0.05 };
      volatilityService.getRealizedVsImplied.mockResolvedValue(mockData);

      const result = await controller.getRealizedVsImplied('aapl');
      expect(result).toEqual(mockData);
      expect(volatilityService.getRealizedVsImplied).toHaveBeenCalledWith(
        'AAPL',
        90,
      );
    });

    it('should parse custom days parameter', async () => {
      volatilityService.getRealizedVsImplied.mockResolvedValue({});

      await controller.getRealizedVsImplied('aapl', '30');
      expect(volatilityService.getRealizedVsImplied).toHaveBeenCalledWith(
        'AAPL',
        30,
      );
    });

    it('should throw HttpException on error', async () => {
      volatilityService.getRealizedVsImplied.mockRejectedValue(
        new Error('fail'),
      );

      await expect(controller.getRealizedVsImplied('BAD')).rejects.toThrow(
        HttpException,
      );
    });
  });

  describe('getVolatilityStats', () => {
    it('should return volatility stats with default period', async () => {
      const mockStats = { realizedVol: 0.25, hvRank: 60 };
      volatilityService.getVolatilityStats.mockResolvedValue(mockStats);

      const result = await controller.getVolatilityStats('aapl');
      expect(result).toEqual(mockStats);
      expect(volatilityService.getVolatilityStats).toHaveBeenCalledWith(
        'AAPL',
        '30d',
      );
    });

    it('should pass custom period', async () => {
      volatilityService.getVolatilityStats.mockResolvedValue({});

      await controller.getVolatilityStats('aapl', '1y');
      expect(volatilityService.getVolatilityStats).toHaveBeenCalledWith(
        'AAPL',
        '1y',
      );
    });

    it('should throw HttpException on error', async () => {
      volatilityService.getVolatilityStats.mockRejectedValue(new Error('fail'));

      await expect(controller.getVolatilityStats('BAD')).rejects.toThrow(
        HttpException,
      );
    });
  });

  describe('healthCheck', () => {
    it('should return health status', () => {
      const result = controller.healthCheck();
      expect(result.status).toBe('ok');
      expect(result.service).toBe('volatility-analytics');
      expect(result.features).toBeDefined();
      expect(result.features.volatilityCone).toBe(true);
      expect(result.features.heatmap).toBe(true);
      expect(result.features.realizedVsImplied).toBe(true);
      expect(result.features.volatilityStats).toBe(true);
      expect(result.timestamp).toBeDefined();
    });
  });
});
