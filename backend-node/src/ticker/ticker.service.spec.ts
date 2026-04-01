import { Test, TestingModule } from '@nestjs/testing';
import { TickerService } from './ticker.service';
import { NotFoundException } from '@nestjs/common';

// Mock createClient before importing the module
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({
    from: jest.fn(),
  })),
}));

describe('TickerService', () => {
  let service: TickerService;

  beforeEach(async () => {
    process.env.SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_KEY = 'test-key';

    const module: TestingModule = await Test.createTestingModule({
      providers: [TickerService],
    }).compile();

    service = module.get<TickerService>(TickerService);
  });

  afterEach(() => {
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_KEY;
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getTicker', () => {
    it('should throw NotFoundException when supabase is not configured', async () => {
      // Force supabase to be null
      (service as any).supabase = null;
      await expect(service.getTicker('AAPL')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw NotFoundException when ticker not found', async () => {
      (service as any).supabase = {
        from: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: null,
                error: { message: 'Not found' },
              }),
            }),
          }),
        }),
      };

      await expect(service.getTicker('ZZZZ')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should return mapped TickerDto on success', async () => {
      const mockRow = {
        ticker: 'AAPL',
        name: 'Apple Inc.',
        sector: 'Technology',
        industry: 'Consumer Electronics',
        asset_type: 'equity',
        exchange: 'NASDAQ',
        country: 'US',
        market_cap: 3000000000000,
        is_active: true,
        first_added: '2024-01-01T00:00:00Z',
        last_updated: '2024-06-01T00:00:00Z',
        metadata: { cusip: '037833100' },
      };

      (service as any).supabase = {
        from: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest
                .fn()
                .mockResolvedValue({ data: mockRow, error: null }),
            }),
          }),
        }),
      };

      const result = await service.getTicker('aapl');
      expect(result.ticker).toBe('AAPL');
      expect(result.name).toBe('Apple Inc.');
      expect(result.assetType).toBe('equity');
    });
  });

  describe('listTickers', () => {
    it('should return empty list when supabase is not configured', async () => {
      (service as any).supabase = null;
      const result = await service.listTickers({ page: 1, limit: 10 });
      expect(result.tickers).toEqual([]);
      expect(result.total).toBe(0);
    });
  });

  describe('deleteTicker', () => {
    it('should throw when supabase is not configured', async () => {
      (service as any).supabase = null;
      await expect(service.deleteTicker('AAPL')).rejects.toThrow(
        'Database not configured',
      );
    });
  });

  // ── search via listTickers ─────────────────────────────────
  describe('listTickers with search', () => {
    it('applies search filter and returns paginated results', async () => {
      const mockData = [
        {
          ticker: 'AAPL',
          name: 'Apple Inc.',
          sector: 'Technology',
          industry: 'Consumer Electronics',
          asset_type: 'equity',
          exchange: 'NASDAQ',
          country: 'US',
          market_cap: 3e12,
          is_active: true,
          first_added: '2024-01-01T00:00:00Z',
          last_updated: '2024-06-01T00:00:00Z',
          metadata: {},
        },
      ];

      const mockQueryBuilder = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        or: jest.fn().mockReturnThis(),
        range: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({
          data: mockData,
          error: null,
          count: 1,
        }),
      };
      (service as any).supabase = {
        from: jest.fn().mockReturnValue(mockQueryBuilder),
      };

      const result = await service.listTickers({
        page: 1,
        limit: 10,
        search: 'Apple',
      });

      expect(result.tickers).toHaveLength(1);
      expect(result.tickers[0].ticker).toBe('AAPL');
      expect(result.total).toBe(1);
      expect(mockQueryBuilder.or).toHaveBeenCalled();
    });

    it('returns error-free empty result when supabase query fails', async () => {
      const mockQueryBuilder = {
        select: jest.fn().mockReturnThis(),
        range: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({
          data: null,
          error: { message: 'DB error' },
          count: 0,
        }),
      };
      (service as any).supabase = {
        from: jest.fn().mockReturnValue(mockQueryBuilder),
      };

      const result = await service.listTickers({ page: 1, limit: 10 });
      expect(result.tickers).toEqual([]);
      expect(result.total).toBe(0);
    });
  });

  // ── getBySymbol uppercases input ───────────────────────────
  describe('getTicker uppercasing', () => {
    it('uppercases the symbol when querying', async () => {
      const eqFn = jest.fn().mockReturnValue({
        single: jest.fn().mockResolvedValue({
          data: {
            ticker: 'MSFT',
            name: 'Microsoft',
            sector: 'Technology',
            industry: 'Software',
            asset_type: 'equity',
            exchange: 'NASDAQ',
            country: 'US',
            market_cap: 2.8e12,
            is_active: true,
            first_added: '2024-01-01T00:00:00Z',
            last_updated: '2024-06-01T00:00:00Z',
            metadata: {},
          },
          error: null,
        }),
      });
      (service as any).supabase = {
        from: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            eq: eqFn,
          }),
        }),
      };

      const result = await service.getTicker('msft');
      expect(eqFn).toHaveBeenCalledWith('ticker', 'MSFT');
      expect(result.ticker).toBe('MSFT');
    });
  });

  // ── createTicker ───────────────────────────────────────────
  describe('createTicker', () => {
    it('creates ticker and uppercases symbol', async () => {
      const mockInsert = {
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: {
                ticker: 'TSLA',
                name: 'Tesla',
                sector: 'Automotive',
                industry: 'Electric Vehicles',
                asset_type: 'equity',
                exchange: 'NASDAQ',
                country: 'US',
                market_cap: 8e11,
                is_active: true,
                first_added: '2024-01-01T00:00:00Z',
                last_updated: '2024-06-01T00:00:00Z',
                metadata: {},
              },
              error: null,
            }),
          }),
        }),
      };
      (service as any).supabase = {
        from: jest.fn().mockReturnValue(mockInsert),
      };

      const result = await service.createTicker({
        ticker: 'tsla',
        name: 'Tesla',
        assetType: 'equity',
      } as any);
      expect(result.ticker).toBe('TSLA');
    });

    it('throws when supabase is not configured', async () => {
      (service as any).supabase = null;
      await expect(
        service.createTicker({
          ticker: 'FAIL',
          name: 'Fail Co',
          assetType: 'equity',
        } as any),
      ).rejects.toThrow('Database not configured');
    });
  });
});
