import { Test, TestingModule } from '@nestjs/testing';
import { HttpException } from '@nestjs/common';
import { ChartsController } from './charts.controller';
import { MarketDataService } from './market-data.service';
import { TechnicalIndicatorsService } from './technical-indicators.service';
import { CacheService } from '../cache/cache.service';

describe('ChartsController', () => {
  let controller: ChartsController;
  let marketDataService: Record<string, jest.Mock>;
  let technicalService: Record<string, jest.Mock>;
  let cacheService: Record<string, jest.Mock>;

  beforeEach(async () => {
    marketDataService = {
      getHistoricalPrices: jest.fn(),
    };

    technicalService = {
      calculateSMA: jest.fn().mockReturnValue([]),
      calculateEMA: jest.fn().mockReturnValue([]),
      calculateRSI: jest.fn().mockReturnValue([]),
      calculateMACD: jest.fn().mockReturnValue({}),
      calculateBollingerBands: jest.fn().mockReturnValue({}),
      calculateVWAP: jest.fn().mockReturnValue([]),
      calculateATR: jest.fn().mockReturnValue([]),
      calculateStochastic: jest.fn().mockReturnValue({}),
    };

    cacheService = {
      getOrSet: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ChartsController],
      providers: [
        { provide: MarketDataService, useValue: marketDataService },
        { provide: TechnicalIndicatorsService, useValue: technicalService },
        { provide: CacheService, useValue: cacheService },
      ],
    }).compile();

    controller = module.get<ChartsController>(ChartsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getTechnicalData', () => {
    it('should return cached technical data', async () => {
      const mockData = { ohlcv: [], indicators: {} };
      cacheService.getOrSet.mockResolvedValue(mockData);

      const result = await controller.getTechnicalData('AAPL', '1M', 'sma20');
      expect(result).toEqual(mockData);
      expect(cacheService.getOrSet).toHaveBeenCalledWith(
        'chart:AAPL:1M:sma20',
        expect.any(Function),
        900,
      );
    });

    it('should use default timeframe and indicators when not specified', async () => {
      cacheService.getOrSet.mockResolvedValue({});

      await controller.getTechnicalData('AAPL', '1M', undefined);
      expect(cacheService.getOrSet).toHaveBeenCalledWith(
        'chart:AAPL:1M:default',
        expect.any(Function),
        900,
      );
    });

    it('should execute the factory function with historical data', async () => {
      const historicalData = [
        {
          date: '2025-01-01',
          open: 100,
          high: 110,
          low: 95,
          close: 105,
          volume: 1000,
        },
      ];
      marketDataService.getHistoricalPrices.mockResolvedValue(historicalData);

      // Execute the factory function
      cacheService.getOrSet.mockImplementation(
        async (_key: string, factory: () => Promise<any>) => factory(),
      );

      const result = await controller.getTechnicalData(
        'AAPL',
        '1M',
        'sma20,rsi',
      );
      expect(result.ohlcv).toHaveLength(1);
      expect(technicalService.calculateSMA).toHaveBeenCalledWith([105], 20);
      expect(technicalService.calculateRSI).toHaveBeenCalledWith([105]);
    });

    it('should handle all timeframe options in factory', async () => {
      const historicalData = [
        {
          date: '2025-01-01',
          open: 100,
          high: 110,
          low: 95,
          close: 105,
          volume: 1000,
        },
      ];
      marketDataService.getHistoricalPrices.mockResolvedValue(historicalData);

      cacheService.getOrSet.mockImplementation(
        async (_key: string, factory: () => Promise<any>) => factory(),
      );

      for (const tf of ['1D', '1W', '1M', '3M', '1Y', 'ALL', 'unknown']) {
        const result = await controller.getTechnicalData('AAPL', tf, 'sma20');
        expect(result.ohlcv).toHaveLength(1);
      }
    });

    it('should calculate all indicator types', async () => {
      const historicalData = [
        {
          date: '2025-01-01',
          open: 100,
          high: 110,
          low: 95,
          close: 105,
          volume: 1000,
        },
      ];
      marketDataService.getHistoricalPrices.mockResolvedValue(historicalData);

      cacheService.getOrSet.mockImplementation(
        async (_key: string, factory: () => Promise<any>) => factory(),
      );

      await controller.getTechnicalData(
        'AAPL',
        '1M',
        'sma20,sma50,sma200,ema12,ema26,rsi,macd,bollinger,vwap,atr,stochastic',
      );

      expect(technicalService.calculateSMA).toHaveBeenCalledWith([105], 20);
      expect(technicalService.calculateSMA).toHaveBeenCalledWith([105], 50);
      expect(technicalService.calculateSMA).toHaveBeenCalledWith([105], 200);
      expect(technicalService.calculateEMA).toHaveBeenCalledWith([105], 12);
      expect(technicalService.calculateEMA).toHaveBeenCalledWith([105], 26);
      expect(technicalService.calculateRSI).toHaveBeenCalledWith([105]);
      expect(technicalService.calculateMACD).toHaveBeenCalledWith([105]);
      expect(technicalService.calculateBollingerBands).toHaveBeenCalledWith([
        105,
      ]);
      expect(technicalService.calculateVWAP).toHaveBeenCalledWith(
        [105],
        [1000],
      );
      expect(technicalService.calculateATR).toHaveBeenCalledWith(
        [110],
        [95],
        [105],
      );
      expect(technicalService.calculateStochastic).toHaveBeenCalledWith(
        [110],
        [95],
        [105],
      );
    });

    it('should throw HttpException when factory throws error', async () => {
      cacheService.getOrSet.mockRejectedValue(new Error('Service down'));

      await expect(
        controller.getTechnicalData('AAPL', '1M', 'sma20'),
      ).rejects.toThrow(HttpException);
    });

    it('should throw when no historical data available', async () => {
      marketDataService.getHistoricalPrices.mockResolvedValue([]);

      cacheService.getOrSet.mockImplementation(
        async (_key: string, factory: () => Promise<any>) => factory(),
      );

      await expect(
        controller.getTechnicalData('AAPL', '1M', 'sma20'),
      ).rejects.toThrow(HttpException);
    });
  });

  describe('getOHLCVData', () => {
    it('should return cached OHLCV data', async () => {
      const mockData = { ticker: 'AAPL', timeframe: '1M', data: [] };
      cacheService.getOrSet.mockResolvedValue(mockData);

      const result = await controller.getOHLCVData('AAPL', '1M');
      expect(result).toEqual(mockData);
      expect(cacheService.getOrSet).toHaveBeenCalledWith(
        'ohlcv:AAPL:1M',
        expect.any(Function),
        900,
      );
    });

    it('should execute the factory function correctly', async () => {
      const historicalData = [
        {
          date: '2025-01-01',
          open: 100,
          high: 110,
          low: 95,
          close: 105,
          volume: 1000,
        },
      ];
      marketDataService.getHistoricalPrices.mockResolvedValue(historicalData);

      cacheService.getOrSet.mockImplementation(
        async (_key: string, factory: () => Promise<any>) => factory(),
      );

      const result = await controller.getOHLCVData('AAPL', '1M');
      expect(result.ticker).toBe('AAPL');
      expect(result.timeframe).toBe('1M');
      expect(result.data).toHaveLength(1);
    });

    it('should handle all timeframe options', async () => {
      const historicalData = [
        {
          date: '2025-01-01',
          open: 100,
          high: 110,
          low: 95,
          close: 105,
          volume: 1000,
        },
      ];
      marketDataService.getHistoricalPrices.mockResolvedValue(historicalData);

      cacheService.getOrSet.mockImplementation(
        async (_key: string, factory: () => Promise<any>) => factory(),
      );

      for (const tf of ['1D', '1W', '1M', '3M', '1Y', 'ALL', 'unknown']) {
        const result = await controller.getOHLCVData('AAPL', tf);
        expect(result.data).toHaveLength(1);
      }
    });

    it('should throw HttpException on error', async () => {
      cacheService.getOrSet.mockRejectedValue(new Error('fail'));

      await expect(controller.getOHLCVData('AAPL', '1M')).rejects.toThrow(
        HttpException,
      );
    });
  });
});
