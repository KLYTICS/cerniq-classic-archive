import { Logger, NotFoundException } from '@nestjs/common';
import { TickerService } from './ticker.service';

const mockCreateClient = jest.fn();

jest.mock('@supabase/supabase-js', () => ({
  createClient: (...args: any[]) => mockCreateClient(...args),
}));

describe('TickerService', () => {
  const originalEnv = {
    url: process.env.SUPABASE_URL,
    key: process.env.SUPABASE_KEY,
    anonKey: process.env.SUPABASE_ANON_KEY,
  };

  const tickerRow = {
    ticker: 'AAPL',
    name: 'Apple Inc.',
    sector: 'Technology',
    industry: 'Consumer Electronics',
    asset_type: 'stock',
    exchange: 'NASDAQ',
    country: 'US',
    market_cap: 3_000_000_000_000,
    is_active: true,
    first_added: '2024-01-01T00:00:00Z',
    last_updated: '2024-06-01T00:00:00Z',
    metadata: { cusip: '037833100' },
  };

  const setConfiguredEnv = () => {
    process.env.SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_KEY = 'test-key';
    delete process.env.SUPABASE_ANON_KEY;
  };

  const restoreEnv = () => {
    process.env.SUPABASE_URL = originalEnv.url;
    process.env.SUPABASE_KEY = originalEnv.key;
    process.env.SUPABASE_ANON_KEY = originalEnv.anonKey;
  };

  const buildAwaitable = (result: any) => {
    const promise = Promise.resolve(result) as any;
    return promise;
  };

  const buildListBuilder = (result: any) => {
    const builder = buildAwaitable(result);
    builder.eq = jest.fn(() => builder);
    builder.or = jest.fn(() => builder);
    builder.range = jest.fn(() => builder);
    builder.order = jest.fn(() => builder);
    return builder;
  };

  const buildGetTickerSupabase = (result: any) => {
    const single = jest.fn().mockResolvedValue(result);
    const eq = jest.fn(() => ({ single }));
    const select = jest.fn(() => ({ eq }));
    return {
      from: jest.fn(() => ({ select })),
      select,
      eq,
      single,
    };
  };

  const buildCreateSupabase = (result: any) => {
    const single = jest.fn().mockResolvedValue(result);
    const select = jest.fn(() => ({ single }));
    const insert = jest.fn(() => ({ select }));
    return {
      from: jest.fn(() => ({ insert })),
      insert,
      select,
      single,
    };
  };

  const buildUpdateSupabase = (result: any) => {
    const single = jest.fn().mockResolvedValue(result);
    const select = jest.fn(() => ({ single }));
    const eq = jest.fn(() => ({ select }));
    const update = jest.fn(() => ({ eq }));
    return {
      from: jest.fn(() => ({ update })),
      update,
      eq,
      select,
      single,
    };
  };

  const buildDeleteSupabase = (result: any) => {
    const eq = jest.fn().mockResolvedValue(result);
    const update = jest.fn(() => ({ eq }));
    return {
      from: jest.fn(() => ({ update })),
      update,
      eq,
    };
  };

  beforeEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
    setConfiguredEnv();
    mockCreateClient.mockReturnValue({ from: jest.fn() });
  });

  afterEach(() => {
    restoreEnv();
  });

  it('initializes Supabase when a valid URL is configured', () => {
    const logSpy = jest
      .spyOn(Logger.prototype, 'log')
      .mockImplementation(() => undefined);
    const service = new TickerService();

    expect(service).toBeDefined();
    expect(mockCreateClient).toHaveBeenCalledWith(
      'https://test.supabase.co',
      'test-key',
    );
    expect(logSpy).toHaveBeenCalledWith('Supabase client initialized');
  });

  it('falls back cleanly when no valid Supabase URL is configured', () => {
    process.env.SUPABASE_URL = 'postgres://not-http';
    const warnSpy = jest
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => undefined);

    const service = new TickerService();

    expect(service).toBeDefined();
    expect(mockCreateClient).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalledWith(
      'No Supabase URL configured — ticker service will use fallback',
    );
  });

  it('warns and uses fallback when client initialization throws', () => {
    mockCreateClient.mockImplementationOnce(() => {
      throw new Error('boom');
    });
    const warnSpy = jest
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => undefined);

    const service = new TickerService();

    expect(service).toBeDefined();
    expect(warnSpy).toHaveBeenCalledWith(
      'Supabase client initialization failed — ticker service will use fallback',
    );
  });

  describe('getTicker', () => {
    it('throws when the database is not configured', async () => {
      const service = new TickerService();
      (service as any).supabase = null;

      await expect(service.getTicker('AAPL')).rejects.toThrow(
        new NotFoundException('Database not configured'),
      );
    });

    it('throws when a ticker cannot be found', async () => {
      const service = new TickerService();
      (service as any).supabase = buildGetTickerSupabase({
        data: null,
        error: { message: 'not found' },
      });

      await expect(service.getTicker('zzzz')).rejects.toThrow(
        'Ticker zzzz not found',
      );
    });

    it('returns a mapped ticker dto on success', async () => {
      const service = new TickerService();
      const supabase = buildGetTickerSupabase({ data: tickerRow, error: null });
      (service as any).supabase = supabase;

      await expect(service.getTicker('aapl')).resolves.toMatchObject({
        ticker: 'AAPL',
        assetType: 'stock',
        metadata: { cusip: '037833100' },
      });
      expect(supabase.eq).toHaveBeenCalledWith('ticker', 'AAPL');
    });
  });

  describe('listTickers', () => {
    it('returns fallback pagination when the database is not configured', async () => {
      const service = new TickerService();
      (service as any).supabase = null;

      await expect(
        service.listTickers({ page: 2, limit: 20 }),
      ).resolves.toEqual({
        tickers: [],
        total: 0,
        page: 1,
        limit: 10,
      });
    });

    it('applies filters, pagination, sorting, and maps ticker rows', async () => {
      const service = new TickerService();
      const builder = buildListBuilder({
        data: [tickerRow],
        error: null,
        count: 1,
      });
      const from = jest.fn(() => ({
        select: jest.fn(() => builder),
      }));
      (service as any).supabase = { from };

      const result = await service.listTickers({
        assetType: 'stock',
        sector: 'Technology',
        isActive: true,
        search: 'app',
        page: 2,
        limit: 5,
      });

      expect(builder.eq).toHaveBeenCalledWith('asset_type', 'stock');
      expect(builder.eq).toHaveBeenCalledWith('sector', 'Technology');
      expect(builder.eq).toHaveBeenCalledWith('is_active', true);
      expect(builder.or).toHaveBeenCalledWith(
        'ticker.ilike.%app%,name.ilike.%app%',
      );
      expect(builder.range).toHaveBeenCalledWith(5, 9);
      expect(builder.order).toHaveBeenCalledWith('ticker', { ascending: true });
      expect(result).toMatchObject({
        total: 1,
        page: 2,
        limit: 5,
      });
      expect(result.tickers[0]).toMatchObject({
        ticker: 'AAPL',
        assetType: 'stock',
      });
    });

    it('returns an empty result and logs when listing fails', async () => {
      const service = new TickerService();
      const errorSpy = jest
        .spyOn((service as any).logger, 'error')
        .mockImplementation(() => undefined);
      const builder = buildListBuilder({
        data: null,
        error: { message: 'query failed' },
        count: null,
      });
      (service as any).supabase = {
        from: jest.fn(() => ({
          select: jest.fn(() => builder),
        })),
      };

      await expect(service.listTickers({ page: 3, limit: 7 })).resolves.toEqual(
        {
          tickers: [],
          total: 0,
          page: 3,
          limit: 7,
        },
      );
      expect(errorSpy).toHaveBeenCalledWith(
        'Failed to list tickers: query failed',
      );
    });
  });

  describe('createTicker', () => {
    it('throws when the database is not configured', async () => {
      const service = new TickerService();
      (service as any).supabase = null;

      await expect(
        service.createTicker({
          ticker: 'AAPL',
          name: 'Apple',
          assetType: 'stock',
        } as any),
      ).rejects.toThrow('Database not configured');
    });

    it('creates a ticker, uppercases the symbol, and defaults metadata', async () => {
      const service = new TickerService();
      const logSpy = jest
        .spyOn((service as any).logger, 'log')
        .mockImplementation(() => undefined);
      const supabase = buildCreateSupabase({ data: tickerRow, error: null });
      (service as any).supabase = supabase;

      await expect(
        service.createTicker({
          ticker: 'aapl',
          name: 'Apple',
          assetType: 'stock',
          sector: 'Technology',
          marketCap: 10,
        } as any),
      ).resolves.toMatchObject({
        ticker: 'AAPL',
        metadata: { cusip: '037833100' },
      });
      expect(supabase.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          ticker: 'AAPL',
          metadata: {},
          is_active: true,
        }),
      );
      expect(logSpy).toHaveBeenCalledWith('Created ticker: aapl');
    });

    it('logs and throws when creation fails', async () => {
      const service = new TickerService();
      const errorSpy = jest
        .spyOn((service as any).logger, 'error')
        .mockImplementation(() => undefined);
      (service as any).supabase = buildCreateSupabase({
        data: null,
        error: { message: 'duplicate key' },
      });

      await expect(
        service.createTicker({
          ticker: 'AAPL',
          name: 'Apple',
          assetType: 'stock',
        } as any),
      ).rejects.toThrow('Failed to create ticker: duplicate key');
      expect(errorSpy).toHaveBeenCalledWith(
        'Failed to create ticker: duplicate key',
      );
    });
  });

  describe('updateTicker', () => {
    it('throws when the database is not configured', async () => {
      const service = new TickerService();
      (service as any).supabase = null;

      await expect(service.updateTicker('AAPL', {})).rejects.toThrow(
        'Database not configured',
      );
    });

    it('updates only provided fields and stamps last_updated', async () => {
      const service = new TickerService();
      const logSpy = jest
        .spyOn((service as any).logger, 'log')
        .mockImplementation(() => undefined);
      const supabase = buildUpdateSupabase({ data: tickerRow, error: null });
      (service as any).supabase = supabase;

      await expect(
        service.updateTicker('aapl', {
          name: 'Apple Inc.',
          marketCap: 123,
          isActive: false,
          metadata: { region: 'US' },
        }),
      ).resolves.toMatchObject({
        ticker: 'AAPL',
      });
      expect(supabase.update).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Apple Inc.',
          market_cap: 123,
          is_active: false,
          metadata: { region: 'US' },
          last_updated: expect.any(String),
        }),
      );
      expect(supabase.eq).toHaveBeenCalledWith('ticker', 'AAPL');
      expect(logSpy).toHaveBeenCalledWith('Updated ticker: aapl');
    });

    it('throws when updating fails', async () => {
      const service = new TickerService();
      (service as any).supabase = buildUpdateSupabase({
        data: null,
        error: { message: 'write failed' },
      });

      await expect(service.updateTicker('AAPL', {})).rejects.toThrow(
        'Failed to update ticker: write failed',
      );
    });
  });

  describe('deleteTicker', () => {
    it('throws when the database is not configured', async () => {
      const service = new TickerService();
      (service as any).supabase = null;

      await expect(service.deleteTicker('AAPL')).rejects.toThrow(
        'Database not configured',
      );
    });

    it('soft deletes a ticker and logs the operation', async () => {
      const service = new TickerService();
      const logSpy = jest
        .spyOn((service as any).logger, 'log')
        .mockImplementation(() => undefined);
      const supabase = buildDeleteSupabase({ error: null });
      (service as any).supabase = supabase;

      await expect(service.deleteTicker('aapl')).resolves.toBeUndefined();
      expect(supabase.update).toHaveBeenCalledWith(
        expect.objectContaining({
          is_active: false,
          last_updated: expect.any(String),
        }),
      );
      expect(supabase.eq).toHaveBeenCalledWith('ticker', 'AAPL');
      expect(logSpy).toHaveBeenCalledWith('Deleted ticker: aapl');
    });

    it('throws when delete fails', async () => {
      const service = new TickerService();
      (service as any).supabase = buildDeleteSupabase({
        error: { message: 'delete failed' },
      });

      await expect(service.deleteTicker('AAPL')).rejects.toThrow(
        'Failed to delete ticker: delete failed',
      );
    });
  });

  it('enrichTicker delegates to getTicker', async () => {
    const service = new TickerService();
    const getTickerSpy = jest
      .spyOn(service, 'getTicker')
      .mockResolvedValue({ ticker: 'AAPL' } as any);

    await expect(service.enrichTicker('AAPL')).resolves.toEqual({
      ticker: 'AAPL',
    });
    expect(getTickerSpy).toHaveBeenCalledWith('AAPL');
  });

  it('maps missing metadata to an empty object', () => {
    const service = new TickerService();

    expect(
      (service as any).mapToTickerDto({
        ...tickerRow,
        metadata: undefined,
      }),
    ).toMatchObject({
      metadata: {},
      firstAdded: new Date('2024-01-01T00:00:00Z'),
      lastUpdated: new Date('2024-06-01T00:00:00Z'),
    });
  });
});
