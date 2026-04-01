jest.mock('coingecko-api', () => {
  return jest.fn().mockImplementation(() => ({
    coins: {
      fetch: jest.fn(),
      fetchMarketChart: jest.fn(),
      list: jest.fn(),
    },
  }));
});

import { CoinGeckoProvider } from './coingecko.provider';

describe('CoinGeckoProvider', () => {
  let provider: CoinGeckoProvider;
  let mockClient: any;

  beforeEach(() => {
    provider = new CoinGeckoProvider();
    mockClient = (provider as any).client;
    jest.clearAllMocks();
  });

  // ── getQuote ───────────────────────────────────────────────────────

  describe('getQuote', () => {
    it('returns crypto quote for known ticker', async () => {
      mockClient.coins.fetch.mockResolvedValue({
        success: true,
        data: {
          market_data: {
            current_price: { usd: 65_000 },
            price_change_24h: 1200,
            price_change_percentage_24h: 1.88,
            total_volume: { usd: 25_000_000_000 },
            market_cap: { usd: 1_270_000_000_000 },
            high_24h: { usd: 65_500 },
            low_24h: { usd: 63_800 },
          },
        },
      });

      const result = await provider.getQuote('BTC');

      expect(result).not.toBeNull();
      expect(result!.ticker).toBe('BTC');
      expect(result!.price).toBe(65_000);
      expect(result!.change).toBe(1200);
      expect(result!.changePercent).toBe(1.88);
      expect(result!.volume).toBe(25_000_000_000);
      expect(result!.marketCap).toBe(1_270_000_000_000);
      expect(result!.high).toBe(65_500);
      expect(result!.low).toBe(63_800);
      expect(result!.open).toBe(0);
      expect(result!.previousClose).toBe(0);
      expect(result!.timestamp).toBeInstanceOf(Date);
    });

    it('returns null for unknown crypto ticker', async () => {
      const result = await provider.getQuote('UNKNOWN_COIN');
      expect(result).toBeNull();
      expect(mockClient.coins.fetch).not.toHaveBeenCalled();
    });

    it('handles case-insensitive tickers', async () => {
      mockClient.coins.fetch.mockResolvedValue({
        success: true,
        data: {
          market_data: {
            current_price: { usd: 3500 },
            price_change_24h: 50,
            price_change_percentage_24h: 1.45,
            total_volume: { usd: 15_000_000_000 },
            market_cap: { usd: 420_000_000_000 },
            high_24h: { usd: 3550 },
            low_24h: { usd: 3450 },
          },
        },
      });

      const result = await provider.getQuote('eth');
      expect(result).not.toBeNull();
      expect(result!.ticker).toBe('ETH');
      expect(mockClient.coins.fetch).toHaveBeenCalledWith('ethereum', { market_data: true });
    });

    it('returns null when API response is not successful', async () => {
      mockClient.coins.fetch.mockResolvedValue({ success: false });
      const result = await provider.getQuote('BTC');
      expect(result).toBeNull();
    });

    it('returns null on error', async () => {
      mockClient.coins.fetch.mockRejectedValue(new Error('Rate limited'));
      const result = await provider.getQuote('BTC');
      expect(result).toBeNull();
    });

    it('defaults numeric fields to 0 when missing', async () => {
      mockClient.coins.fetch.mockResolvedValue({
        success: true,
        data: {
          market_data: {},
        },
      });

      const result = await provider.getQuote('SOL');
      expect(result!.price).toBe(0);
      expect(result!.change).toBe(0);
      expect(result!.volume).toBe(0);
      expect(result!.high).toBe(0);
      expect(result!.low).toBe(0);
    });

    it('maps all known tickers correctly', async () => {
      const knownTickers = ['BTC', 'ETH', 'BNB', 'SOL', 'XRP', 'ADA', 'DOGE', 'MATIC', 'DOT', 'AVAX'];
      const expectedIds = ['bitcoin', 'ethereum', 'binancecoin', 'solana', 'ripple', 'cardano', 'dogecoin', 'matic-network', 'polkadot', 'avalanche-2'];

      for (let i = 0; i < knownTickers.length; i++) {
        mockClient.coins.fetch.mockResolvedValue({
          success: true,
          data: { market_data: { current_price: { usd: 100 } } },
        });
        await provider.getQuote(knownTickers[i]);
        expect(mockClient.coins.fetch).toHaveBeenCalledWith(expectedIds[i], { market_data: true });
        jest.clearAllMocks();
      }
    });
  });

  // ── getHistoricalPrices ────────────────────────────────────────────

  describe('getHistoricalPrices', () => {
    it('returns mapped historical prices', async () => {
      const now = Date.now();
      mockClient.coins.fetchMarketChart.mockResolvedValue({
        success: true,
        data: {
          prices: [
            [now - 86400000, 64000],
            [now, 65000],
          ],
        },
      });

      const result = await provider.getHistoricalPrices(
        'BTC',
        new Date(now - 2 * 86400000),
        new Date(now),
      );

      expect(result).toHaveLength(2);
      expect(result[0].close).toBe(64000);
      expect(result[0].open).toBe(64000);
      expect(result[0].high).toBe(64000);
      expect(result[0].low).toBe(64000);
      expect(result[0].adjustedClose).toBe(64000);
      expect(result[0].volume).toBe(0);
      expect(result[0].date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it('returns empty array for unknown ticker', async () => {
      const result = await provider.getHistoricalPrices(
        'UNKNOWNCOIN',
        new Date('2024-01-01'),
        new Date('2024-01-31'),
      );
      expect(result).toEqual([]);
    });

    it('returns empty array when API response is not successful', async () => {
      mockClient.coins.fetchMarketChart.mockResolvedValue({ success: false });
      const result = await provider.getHistoricalPrices(
        'ETH',
        new Date('2024-01-01'),
        new Date('2024-01-31'),
      );
      expect(result).toEqual([]);
    });

    it('returns empty array on error', async () => {
      mockClient.coins.fetchMarketChart.mockRejectedValue(new Error('Network error'));
      const result = await provider.getHistoricalPrices(
        'BTC',
        new Date('2024-01-01'),
        new Date('2024-01-31'),
      );
      expect(result).toEqual([]);
    });

    it('calculates days correctly from date range', async () => {
      mockClient.coins.fetchMarketChart.mockResolvedValue({
        success: true,
        data: { prices: [] },
      });

      const start = new Date('2024-01-01');
      const end = new Date('2024-01-31');
      await provider.getHistoricalPrices('BTC', start, end);

      expect(mockClient.coins.fetchMarketChart).toHaveBeenCalledWith('bitcoin', {
        days: '30',
        vs_currency: 'usd',
      });
    });

    it('handles empty prices array', async () => {
      mockClient.coins.fetchMarketChart.mockResolvedValue({
        success: true,
        data: { prices: [] },
      });
      const result = await provider.getHistoricalPrices(
        'BTC',
        new Date('2024-01-01'),
        new Date('2024-01-31'),
      );
      expect(result).toEqual([]);
    });
  });

  // ── searchCrypto ───────────────────────────────────────────────────

  describe('searchCrypto', () => {
    it('filters and returns matching coins', async () => {
      mockClient.coins.list.mockResolvedValue({
        success: true,
        data: [
          { symbol: 'btc', name: 'Bitcoin', id: 'bitcoin' },
          { symbol: 'eth', name: 'Ethereum', id: 'ethereum' },
          { symbol: 'btt', name: 'BitTorrent', id: 'bittorrent' },
        ],
      });

      const result = await provider.searchCrypto('bit');
      expect(result).toHaveLength(2); // Bitcoin and BitTorrent
      expect(result[0].symbol).toBe('BTC');
      expect(result[0].name).toBe('Bitcoin');
      expect(result[0].id).toBe('bitcoin');
    });

    it('limits results to 10', async () => {
      const coins = Array.from({ length: 20 }, (_, i) => ({
        symbol: `coin${i}`,
        name: `Coin ${i}`,
        id: `coin-${i}`,
      }));
      mockClient.coins.list.mockResolvedValue({ success: true, data: coins });

      const result = await provider.searchCrypto('coin');
      expect(result).toHaveLength(10);
    });

    it('returns empty array when API response is not successful', async () => {
      mockClient.coins.list.mockResolvedValue({ success: false });
      const result = await provider.searchCrypto('btc');
      expect(result).toEqual([]);
    });

    it('returns empty array on error', async () => {
      mockClient.coins.list.mockRejectedValue(new Error('Error'));
      const result = await provider.searchCrypto('btc');
      expect(result).toEqual([]);
    });

    it('searches case-insensitively by symbol', async () => {
      mockClient.coins.list.mockResolvedValue({
        success: true,
        data: [
          { symbol: 'sol', name: 'Solana', id: 'solana' },
        ],
      });

      const result = await provider.searchCrypto('SOL');
      expect(result).toHaveLength(1);
      expect(result[0].symbol).toBe('SOL');
    });

    it('searches by name', async () => {
      mockClient.coins.list.mockResolvedValue({
        success: true,
        data: [
          { symbol: 'eth', name: 'Ethereum', id: 'ethereum' },
          { symbol: 'etc', name: 'Ethereum Classic', id: 'ethereum-classic' },
        ],
      });

      const result = await provider.searchCrypto('ethereum');
      expect(result).toHaveLength(2);
    });
  });
});
