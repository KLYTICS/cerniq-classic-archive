import { Injectable, Logger } from '@nestjs/common';
import { QuoteDto, HistoricalPriceDto } from '../dto/quote.dto';

const CoinGecko = require('coingecko-api');

@Injectable()
export class CoinGeckoProvider {
  private readonly logger = new Logger(CoinGeckoProvider.name);
  private readonly client = new CoinGecko();

  // Map common crypto tickers to CoinGecko IDs
  private readonly tickerToId: Record<string, string> = {
    BTC: 'bitcoin',
    ETH: 'ethereum',
    BNB: 'binancecoin',
    SOL: 'solana',
    XRP: 'ripple',
    ADA: 'cardano',
    DOGE: 'dogecoin',
    MATIC: 'matic-network',
    DOT: 'polkadot',
    AVAX: 'avalanche-2',
  };

  async getQuote(ticker: string): Promise<QuoteDto | null> {
    try {
      const coinId = this.tickerToId[ticker.toUpperCase()];
      if (!coinId) {
        this.logger.warn(`Unknown crypto ticker: ${ticker}`);
        return null;
      }

      this.logger.debug(`Fetching quote for ${ticker} (${coinId})`);
      const response = await this.client.coins.fetch(coinId, {
        market_data: true,
      });

      if (!response.success) {
        this.logger.error(`Failed to fetch data for ${ticker}`);
        return null;
      }

      const data = response.data;
      const marketData = data.market_data;

      return {
        ticker: ticker.toUpperCase(),
        price: marketData.current_price?.usd || 0,
        change: marketData.price_change_24h || 0,
        changePercent: marketData.price_change_percentage_24h || 0,
        volume: marketData.total_volume?.usd || 0,
        marketCap: marketData.market_cap?.usd,
        high: marketData.high_24h?.usd || 0,
        low: marketData.low_24h?.usd || 0,
        open: 0, // CoinGecko doesn't provide open price directly
        previousClose: 0, // Calculate from current price and change
        timestamp: new Date(),
      };
    } catch (error) {
      this.logger.error(
        `Failed to fetch crypto quote for ${ticker}: ${error.message}`,
      );
      return null;
    }
  }

  async getHistoricalPrices(
    ticker: string,
    startDate: Date,
    endDate: Date,
  ): Promise<HistoricalPriceDto[]> {
    try {
      const coinId = this.tickerToId[ticker.toUpperCase()];
      if (!coinId) {
        return [];
      }

      const days = Math.ceil(
        (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24),
      );
      this.logger.debug(
        `Fetching ${days} days of historical data for ${ticker}`,
      );

      const response = await this.client.coins.fetchMarketChart(coinId, {
        days: days.toString(),
        vs_currency: 'usd',
      });

      if (!response.success) {
        return [];
      }

      const prices = response.data.prices || [];

      return prices.map(([timestamp, price]: [number, number]) => {
        const date = new Date(timestamp);
        return {
          date: date.toISOString().split('T')[0],
          open: price, // CoinGecko provides only closing prices
          high: price,
          low: price,
          close: price,
          volume: 0,
          adjustedClose: price,
        };
      });
    } catch (error) {
      this.logger.error(
        `Failed to fetch historical prices for ${ticker}: ${error.message}`,
      );
      return [];
    }
  }

  async searchCrypto(
    query: string,
  ): Promise<Array<{ symbol: string; name: string; id: string }>> {
    try {
      this.logger.debug(`Searching for crypto with query: ${query}`);
      const response = await this.client.coins.list();

      if (!response.success) {
        return [];
      }

      const coins = response.data || [];
      const queryLower = query.toLowerCase();

      return coins
        .filter(
          (coin: any) =>
            coin.symbol.toLowerCase().includes(queryLower) ||
            coin.name.toLowerCase().includes(queryLower),
        )
        .slice(0, 10)
        .map((coin: any) => ({
          symbol: coin.symbol.toUpperCase(),
          name: coin.name,
          id: coin.id,
        }));
    } catch (error) {
      this.logger.error(
        `Failed to search crypto with query ${query}: ${error.message}`,
      );
      return [];
    }
  }
}
