import { Test, TestingModule } from '@nestjs/testing';
import { HttpException } from '@nestjs/common';
import { TickerController } from './ticker.controller';
import { TickerService } from './ticker.service';
import { AuthGuard } from '../auth/auth.guard';

describe('TickerController', () => {
  let controller: TickerController;
  let tickerService: Record<string, jest.Mock>;

  beforeEach(async () => {
    tickerService = {
      getTicker: jest.fn(),
      listTickers: jest.fn(),
      createTicker: jest.fn(),
      updateTicker: jest.fn(),
      deleteTicker: jest.fn(),
      enrichTicker: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [TickerController],
      providers: [
        { provide: TickerService, useValue: tickerService },
      ],
    })
      .overrideGuard(AuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<TickerController>(TickerController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getTicker', () => {
    it('should return ticker data', async () => {
      const mockTicker = { symbol: 'AAPL', name: 'Apple Inc' };
      tickerService.getTicker.mockResolvedValue(mockTicker);

      const result = await controller.getTicker('AAPL');
      expect(result).toEqual(mockTicker);
      expect(tickerService.getTicker).toHaveBeenCalledWith('AAPL');
    });

    it('should throw HttpException on error', async () => {
      tickerService.getTicker.mockRejectedValue({
        message: 'Not found',
        status: 404,
      });

      await expect(controller.getTicker('BAD')).rejects.toThrow(HttpException);
    });
  });

  describe('listTickers', () => {
    it('should list tickers with query', async () => {
      const mockList = { items: [{ symbol: 'AAPL' }], total: 1 };
      tickerService.listTickers.mockResolvedValue(mockList);

      const query = { assetType: 'stock', page: 1, limit: 50 };
      const result = await controller.listTickers(query as any);
      expect(result).toEqual(mockList);
      expect(tickerService.listTickers).toHaveBeenCalledWith(query);
    });

    it('should throw HttpException on error', async () => {
      tickerService.listTickers.mockRejectedValue(new Error('DB error'));

      await expect(controller.listTickers({} as any)).rejects.toThrow(
        HttpException,
      );
    });
  });

  describe('createTicker', () => {
    it('should create a new ticker', async () => {
      const createDto = { symbol: 'TSLA', name: 'Tesla Inc', assetType: 'stock' };
      const mockTicker = { ...createDto, id: 't1' };
      tickerService.createTicker.mockResolvedValue(mockTicker);

      const result = await controller.createTicker(createDto as any);
      expect(result).toEqual(mockTicker);
      expect(tickerService.createTicker).toHaveBeenCalledWith(createDto);
    });

    it('should throw HttpException on error', async () => {
      tickerService.createTicker.mockRejectedValue(
        new Error('Duplicate symbol'),
      );

      await expect(controller.createTicker({} as any)).rejects.toThrow(
        HttpException,
      );
    });
  });

  describe('updateTicker', () => {
    it('should update a ticker', async () => {
      const updateDto = { name: 'Apple Inc.' };
      const mockTicker = { symbol: 'AAPL', name: 'Apple Inc.' };
      tickerService.updateTicker.mockResolvedValue(mockTicker);

      const result = await controller.updateTicker('AAPL', updateDto as any);
      expect(result).toEqual(mockTicker);
      expect(tickerService.updateTicker).toHaveBeenCalledWith(
        'AAPL',
        updateDto,
      );
    });

    it('should throw HttpException on error', async () => {
      tickerService.updateTicker.mockRejectedValue(new Error('Not found'));

      await expect(
        controller.updateTicker('BAD', {} as any),
      ).rejects.toThrow(HttpException);
    });
  });

  describe('deleteTicker', () => {
    it('should delete a ticker', async () => {
      tickerService.deleteTicker.mockResolvedValue(undefined);

      const result = await controller.deleteTicker('AAPL');
      expect(result).toEqual({
        message: 'Ticker AAPL deleted successfully',
      });
      expect(tickerService.deleteTicker).toHaveBeenCalledWith('AAPL');
    });

    it('should throw HttpException on error', async () => {
      tickerService.deleteTicker.mockRejectedValue(new Error('fail'));

      await expect(controller.deleteTicker('BAD')).rejects.toThrow(
        HttpException,
      );
    });
  });

  describe('enrichTicker', () => {
    it('should enrich ticker metadata', async () => {
      const mockTicker = { symbol: 'AAPL', sector: 'Technology' };
      tickerService.enrichTicker.mockResolvedValue(mockTicker);

      const result = await controller.enrichTicker('AAPL');
      expect(result).toEqual(mockTicker);
      expect(tickerService.enrichTicker).toHaveBeenCalledWith('AAPL');
    });

    it('should throw HttpException on error', async () => {
      tickerService.enrichTicker.mockRejectedValue(new Error('API error'));

      await expect(controller.enrichTicker('BAD')).rejects.toThrow(
        HttpException,
      );
    });
  });
});
