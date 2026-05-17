import 'reflect-metadata';
import { Test, TestingModule } from '@nestjs/testing';
import { HttpException } from '@nestjs/common';
import { MarketDataController } from './market-data.controller';
import { MarketDataService } from './market-data.service';
import { LlmService } from '../llm/llm.service';
import { MarketStreamManagerService } from './market-stream-manager.service';
import { AdminKeyGuard } from '../auth/admin-key.guard';

describe('MarketDataController', () => {
  let controller: MarketDataController;
  let marketDataService: Record<string, jest.Mock>;
  let llmService: Record<string, jest.Mock>;
  let marketStreamManager: Record<string, jest.Mock>;

  beforeEach(async () => {
    marketDataService = {
      getQuote: jest.fn(),
      getRealtimeQuote: jest.fn(),
      getHistoricalPrices: jest.fn(),
      getFundamentals: jest.fn(),
      getInstrumentProfile: jest.fn(),
      getNews: jest.fn(),
      getMarketSnapshot: jest.fn(),
      searchTickers: jest.fn(),
      getHealth: jest.fn(),
      clearCaches: jest.fn(),
    };

    llmService = {
      generateStockInsight: jest.fn(),
    };

    marketStreamManager = {
      getStreamStatus: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [MarketDataController],
      providers: [
        { provide: MarketDataService, useValue: marketDataService },
        { provide: LlmService, useValue: llmService },
        { provide: MarketStreamManagerService, useValue: marketStreamManager },
      ],
    })
      .overrideGuard(AdminKeyGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<MarketDataController>(MarketDataController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getInsights', () => {
    it('should return insights for a ticker', async () => {
      marketDataService.getQuote.mockResolvedValue({
        price: 150,
        changePercent: 2.5,
      });
      llmService.generateStockInsight.mockResolvedValue('Bullish outlook');

      const result = await controller.getInsights('AAPL');
      expect(result).toEqual({ ticker: 'AAPL', insight: 'Bullish outlook' });
      expect(llmService.generateStockInsight).toHaveBeenCalledWith(
        'AAPL',
        150,
        2.5,
      );
    });

    it('should throw HttpException when ticker is missing', async () => {
      await expect(controller.getInsights(undefined as any)).rejects.toThrow(
        HttpException,
      );
    });

    it('should fallback when quote fails but insight succeeds', async () => {
      marketDataService.getQuote.mockRejectedValue(new Error('Quote failed'));
      llmService.generateStockInsight.mockResolvedValue('Fallback insight');

      const result = await controller.getInsights('AAPL');
      expect(result).toEqual({ ticker: 'AAPL', insight: 'Fallback insight' });
      expect(llmService.generateStockInsight).toHaveBeenCalledWith(
        'AAPL',
        0,
        0,
      );
    });

    it('should throw HttpException when both quote and fallback fail', async () => {
      marketDataService.getQuote.mockRejectedValue(new Error('fail'));
      llmService.generateStockInsight.mockRejectedValue(new Error('LLM fail'));

      await expect(controller.getInsights('AAPL')).rejects.toThrow(
        HttpException,
      );
    });
  });

  describe('getQuote', () => {
    it('should return a quote', async () => {
      const mockQuote = { price: 150, change: 2 };
      marketDataService.getRealtimeQuote.mockResolvedValue(mockQuote);

      const result = await controller.getQuote('AAPL');
      expect(result).toEqual(mockQuote);
    });

    it('should throw HttpException on error', async () => {
      marketDataService.getRealtimeQuote.mockRejectedValue({
        message: 'Not found',
        status: 404,
      });

      await expect(controller.getQuote('BAD')).rejects.toThrow(HttpException);
    });
  });

  describe('getHistoricalPrices', () => {
    it('should return historical prices with date range', async () => {
      const mockPrices = [{ date: '2025-01-01', close: 150 }];
      marketDataService.getHistoricalPrices.mockResolvedValue(mockPrices);

      const result = await controller.getHistoricalPrices(
        'AAPL',
        '2025-01-01',
        '2025-12-31',
      );
      expect(result).toEqual(mockPrices);
      expect(marketDataService.getHistoricalPrices).toHaveBeenCalledWith(
        'AAPL',
        new Date('2025-01-01'),
        new Date('2025-12-31'),
      );
    });

    it('should use default dates when not specified', async () => {
      marketDataService.getHistoricalPrices.mockResolvedValue([]);

      await controller.getHistoricalPrices('AAPL');
      const call = marketDataService.getHistoricalPrices.mock.calls[0];
      expect(call[0]).toBe('AAPL');
      expect(call[1]).toBeInstanceOf(Date);
      expect(call[2]).toBeInstanceOf(Date);
    });

    it('should throw HttpException on error', async () => {
      marketDataService.getHistoricalPrices.mockRejectedValue({
        message: 'fail',
      });

      await expect(controller.getHistoricalPrices('BAD')).rejects.toThrow(
        HttpException,
      );
    });
  });

  describe('getFundamentals', () => {
    it('should return fundamentals', async () => {
      const mockData = { pe: 25, eps: 6 };
      marketDataService.getFundamentals.mockResolvedValue(mockData);

      const result = await controller.getFundamentals('AAPL');
      expect(result).toEqual(mockData);
    });

    it('should throw HttpException on error', async () => {
      marketDataService.getFundamentals.mockRejectedValue({
        message: 'fail',
      });

      await expect(controller.getFundamentals('BAD')).rejects.toThrow(
        HttpException,
      );
    });
  });

  describe('getInstrumentProfile', () => {
    it('should return instrument profile', async () => {
      const mockProfile = { ticker: 'AAPL', name: 'Apple Inc' };
      marketDataService.getInstrumentProfile.mockResolvedValue(mockProfile);

      const result = await controller.getInstrumentProfile('AAPL');
      expect(result).toEqual(mockProfile);
    });

    it('should throw HttpException on error', async () => {
      marketDataService.getInstrumentProfile.mockRejectedValue({
        message: 'fail',
      });

      await expect(controller.getInstrumentProfile('BAD')).rejects.toThrow(
        HttpException,
      );
    });
  });

  describe('getNews', () => {
    it('should return news with default limit', async () => {
      const mockNews = [{ title: 'Apple news' }];
      marketDataService.getNews.mockResolvedValue(mockNews);

      const result = await controller.getNews('AAPL');
      expect(result).toEqual(mockNews);
      expect(marketDataService.getNews).toHaveBeenCalledWith('AAPL', 8);
    });

    it('should parse custom limit', async () => {
      marketDataService.getNews.mockResolvedValue([]);

      await controller.getNews('AAPL', '5');
      expect(marketDataService.getNews).toHaveBeenCalledWith('AAPL', 5);
    });

    it('should use default limit for invalid string', async () => {
      marketDataService.getNews.mockResolvedValue([]);

      await controller.getNews('AAPL', 'abc');
      expect(marketDataService.getNews).toHaveBeenCalledWith('AAPL', 8);
    });

    it('should throw HttpException on error', async () => {
      marketDataService.getNews.mockRejectedValue({ message: 'fail' });

      await expect(controller.getNews('BAD')).rejects.toThrow(HttpException);
    });
  });

  describe('getMarketSnapshot', () => {
    it('should return market snapshot with default limit', async () => {
      const mockSnapshot = { quote: {}, news: [] };
      marketDataService.getMarketSnapshot.mockResolvedValue(mockSnapshot);

      const result = await controller.getMarketSnapshot('AAPL');
      expect(result).toEqual(mockSnapshot);
      expect(marketDataService.getMarketSnapshot).toHaveBeenCalledWith(
        'AAPL',
        8,
      );
    });

    it('should parse custom news limit', async () => {
      marketDataService.getMarketSnapshot.mockResolvedValue({});

      await controller.getMarketSnapshot('AAPL', '5');
      expect(marketDataService.getMarketSnapshot).toHaveBeenCalledWith(
        'AAPL',
        5,
      );
    });

    it('should throw HttpException on error', async () => {
      marketDataService.getMarketSnapshot.mockRejectedValue({
        message: 'fail',
      });

      await expect(controller.getMarketSnapshot('BAD')).rejects.toThrow(
        HttpException,
      );
    });
  });

  describe('searchTickers', () => {
    it('should search tickers', async () => {
      const mockResults = [{ symbol: 'AAPL', name: 'Apple' }];
      marketDataService.searchTickers.mockResolvedValue(mockResults);

      const result = await controller.searchTickers('apple');
      expect(result).toEqual(mockResults);
      expect(marketDataService.searchTickers).toHaveBeenCalledWith(
        'apple',
        undefined,
      );
    });

    it('should search with asset type filter', async () => {
      marketDataService.searchTickers.mockResolvedValue([]);

      await controller.searchTickers('SPY', 'etf');
      expect(marketDataService.searchTickers).toHaveBeenCalledWith(
        'SPY',
        'etf',
      );
    });

    it('should throw HttpException when query is empty', async () => {
      await expect(controller.searchTickers('')).rejects.toThrow(HttpException);
    });

    it('should throw HttpException when query is whitespace only', async () => {
      await expect(controller.searchTickers('   ')).rejects.toThrow(
        HttpException,
      );
    });

    it('should throw HttpException on service error', async () => {
      marketDataService.searchTickers.mockRejectedValue({
        message: 'fail',
      });

      await expect(controller.searchTickers('AAPL')).rejects.toThrow(
        HttpException,
      );
    });
  });

  describe('getMarketDataHealth', () => {
    it('should return health status', () => {
      const mockStreamStatus = [{ ticker: 'AAPL', active: true }];
      marketStreamManager.getStreamStatus.mockReturnValue(mockStreamStatus);
      const mockHealth = { status: 'healthy' };
      marketDataService.getHealth.mockReturnValue(mockHealth);

      const result = controller.getMarketDataHealth();
      expect(result).toEqual(mockHealth);
      expect(marketDataService.getHealth).toHaveBeenCalledWith(
        mockStreamStatus,
      );
    });
  });

  describe('getActiveStreams', () => {
    it('should return active stream status', () => {
      const mockStreams = [{ ticker: 'AAPL', subscribers: 3 }];
      marketStreamManager.getStreamStatus.mockReturnValue(mockStreams);

      const result = controller.getActiveStreams();
      expect(result).toEqual(mockStreams);
    });
  });

  describe('clearCaches', () => {
    // Post-AdminKeyGuard refactor: admin-key enforcement is in
    // `AdminKeyGuard` (10-case suite in `admin-key.guard.spec.ts`).
    // Pre-refactor `controller.clearCaches('wrong-key')` calls no
    // longer detect auth — guards run at HTTP layer, direct method
    // invocation bypasses them. Replaced with a method-level wiring
    // lock + a delegation test.

    it('has AdminKeyGuard wired at the method level (reflection lock)', () => {
      const guards =
        Reflect.getMetadata(
          '__guards__',
          MarketDataController.prototype.clearCaches,
        ) ?? [];
      const names = guards.map((g: { name?: string }) => g?.name ?? String(g));
      expect(names).toContain('AdminKeyGuard');
    });

    it('delegates to MarketDataService.clearCaches and returns success message', () => {
      const result = controller.clearCaches();
      expect(result).toEqual({ message: 'Caches cleared successfully' });
      expect(marketDataService.clearCaches).toHaveBeenCalled();
    });
  });
});
