import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { MarketDataService } from '../market-data/market-data.service';
import { OptionsService } from '../options/options.service';
import { PortfolioService } from '../portfolio/portfolio.service';
import { OptionType } from '../options/dto/options.dto';
import { isAllowedOrigin } from '../security/origin-allowlist';
import { MarketStreamManagerService } from '../market-data/market-stream-manager.service';

interface SubscriptionPayload {
  ticker: string;
  userId?: string;
}

interface GreeksSubscriptionPayload {
  ticker: string;
  strike: number;
  maturity: string;
  optionType: OptionType;
  riskFreeRate?: number;
}

interface PortfolioPnLPayload {
  portfolioId: string;
  userId: string;
}

@WebSocketGateway({
  cors: {
    origin: (
      origin: string | undefined,
      callback: (error: Error | null, allow?: boolean) => void,
    ) => {
      if (isAllowedOrigin(origin)) {
        callback(null, true);
        return;
      }
      callback(
        new Error(`Socket origin not allowed: ${origin || 'unknown'}`),
        false,
      );
    },
    credentials: true,
  },
  namespace: 'market-data',
})
export class RealtimeGateway
  implements
    OnGatewayConnection,
    OnGatewayDisconnect,
    OnModuleInit,
    OnModuleDestroy
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(RealtimeGateway.name);
  private greeksIntervals: Map<string, NodeJS.Timeout> = new Map();
  private pnlIntervals: Map<string, NodeJS.Timeout> = new Map();
  private readonly clientTickerSubscriptions = new Map<string, Set<string>>();
  private readonly streamCleanupFns: Array<() => void> = [];
  private readonly UPDATE_INTERVAL_MS = this.parseUpdateInterval(
    process.env.MARKET_STREAM_INTERVAL_MS,
    5000,
  );

  constructor(
    private readonly marketDataService: MarketDataService,
    private readonly marketStreamManager: MarketStreamManagerService,
    private readonly optionsService: OptionsService,
    private readonly portfolioService: PortfolioService,
  ) {}

  onModuleInit() {
    this.streamCleanupFns.push(
      this.marketStreamManager.onQuote(({ ticker, quote }) => {
        this.server
          .to(`ticker:${ticker}`)
          .emit('price-update', this.buildPriceUpdatePayload(ticker, quote));
      }),
      this.marketStreamManager.onInstrument(
        ({ ticker, profile, quote, timestamp }) => {
          this.server.to(`ticker:${ticker}`).emit('instrument-update', {
            ticker,
            quote,
            profile,
            timestamp,
          });
        },
      ),
      this.marketStreamManager.onNews(({ ticker, items, timestamp }) => {
        this.server.to(`ticker:${ticker}`).emit('news-update', {
          ticker,
          items,
          timestamp,
        });
      }),
    );
  }

  onModuleDestroy() {
    for (const greeksKey of [...this.greeksIntervals.keys()]) {
      this.stopGreeksStream(greeksKey);
    }
    for (const pnlKey of [...this.pnlIntervals.keys()]) {
      this.stopPnLStream(pnlKey);
    }
    this.streamCleanupFns.forEach((cleanup) => cleanup());
    this.streamCleanupFns.length = 0;
    this.clientTickerSubscriptions.clear();
  }

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
    this.clientTickerSubscriptions.set(client.id, new Set());
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
    this.cleanupClientSubscriptions(client.id);
  }

  private parseUpdateInterval(
    rawValue: string | undefined,
    fallbackMs: number,
  ): number {
    const parsed = Number.parseInt(rawValue || '', 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallbackMs;
  }

  private getRoomSize(roomName: string): number {
    return (
      this.server.of('/market-data').adapter.rooms.get(roomName)?.size ?? 0
    );
  }

  private buildPriceUpdatePayload(
    ticker: string,
    quote: Awaited<ReturnType<MarketDataService['getRealtimeQuote']>>,
  ) {
    return {
      ticker,
      assetType: quote.assetType,
      shortName: quote.shortName,
      longName: quote.longName,
      exchange: quote.exchange,
      currency: quote.currency,
      marketState: quote.marketState,
      session: quote.session,
      freshnessState: quote.freshnessState,
      provider: quote.provider,
      quoteTimestamp: quote.quoteTimestamp,
      serverTimestamp: quote.serverTimestamp,
      ageMs: quote.ageMs,
      price: quote.price,
      change: quote.change,
      changePercent: quote.changePercent,
      volume: quote.volume,
      high: quote.high,
      low: quote.low,
      previousClose: quote.previousClose,
      timestamp: quote.timestamp,
    };
  }

  /**
   * Subscribe to real-time price updates for a ticker
   */
  @SubscribeMessage('subscribe-ticker')
  async handleTickerSubscription(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: SubscriptionPayload,
  ) {
    const ticker = this.marketDataService.normalizeTicker(payload.ticker);
    const roomName = `ticker:${ticker}`;
    const subscribedTickers =
      this.clientTickerSubscriptions.get(client.id) || new Set<string>();

    this.logger.log(`Client ${client.id} subscribing to ${ticker}`);
    await client.join(roomName);

    if (!subscribedTickers.has(ticker)) {
      await this.marketStreamManager.subscribe(ticker);
      subscribedTickers.add(ticker);
      this.clientTickerSubscriptions.set(client.id, subscribedTickers);
    }

    // Send immediate update
    try {
      const [quote, profile, news] = await Promise.all([
        this.marketDataService.getRealtimeQuote(ticker),
        this.marketDataService.getInstrumentProfile(ticker),
        this.marketDataService.getNews(ticker, 8),
      ]);
      client.emit('price-update', this.buildPriceUpdatePayload(ticker, quote));
      client.emit('instrument-update', {
        ticker,
        quote,
        profile,
      });
      client.emit('news-update', {
        ticker,
        items: news,
        timestamp: new Date(),
      });
    } catch (error) {
      this.logger.error(`Error fetching initial quote for ${ticker}:`, error);
      client.emit('error', { message: `Failed to fetch quote for ${ticker}` });
    }

    return { success: true, ticker, message: `Subscribed to ${ticker}` };
  }

  /**
   * Unsubscribe from ticker updates
   */
  @SubscribeMessage('unsubscribe-ticker')
  async handleTickerUnsubscription(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: SubscriptionPayload,
  ) {
    const ticker = this.marketDataService.normalizeTicker(payload.ticker);
    const roomName = `ticker:${ticker}`;
    const subscribedTickers = this.clientTickerSubscriptions.get(client.id);

    this.logger.log(`Client ${client.id} unsubscribing from ${ticker}`);
    await client.leave(roomName);

    if (subscribedTickers?.has(ticker)) {
      subscribedTickers.delete(ticker);
      this.marketStreamManager.unsubscribe(ticker);
    }

    return { success: true, ticker, message: `Unsubscribed from ${ticker}` };
  }

  /**
   * Subscribe to live Greeks calculations
   */
  @SubscribeMessage('subscribe-greeks')
  async handleGreeksSubscription(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: GreeksSubscriptionPayload,
  ) {
    const {
      ticker,
      strike,
      maturity,
      optionType,
      riskFreeRate = 0.045,
    } = payload;
    const greeksKey = `greeks:${ticker}:${strike}:${maturity}:${optionType}`;

    this.logger.log(
      `Client ${client.id} subscribing to Greeks for ${greeksKey}`,
    );
    await client.join(greeksKey);

    // Start Greeks calculation stream
    if (!this.greeksIntervals.has(greeksKey)) {
      await this.startGreeksStream(
        ticker,
        strike,
        maturity,
        optionType,
        riskFreeRate,
      );
    }

    // Send immediate calculation
    try {
      const quote = await this.marketDataService.getQuote(ticker);
      const timeToMaturity = this.calculateTimeToMaturity(maturity);

      const greeks = await this.optionsService.calculateGreeks({
        underlying: quote.price,
        strike,
        timeToExpiry: timeToMaturity,
        volatility: 0.25, // Default, should fetch from market
        riskFreeRate,
        optionType,
      });

      client.emit('greeks-update', {
        ticker,
        strike,
        maturity,
        optionType,
        underlyingPrice: quote.price,
        greeks,
        timestamp: new Date(),
      });
    } catch (error) {
      this.logger.error(`Error calculating Greeks for ${greeksKey}:`, error);
      client.emit('error', { message: `Failed to calculate Greeks` });
    }

    return { success: true, message: `Subscribed to Greeks` };
  }

  /**
   * Subscribe to portfolio P&L updates
   */
  @SubscribeMessage('subscribe-portfolio-pnl')
  async handlePortfolioPnLSubscription(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: PortfolioPnLPayload,
  ) {
    const { portfolioId, userId } = payload;
    const pnlKey = `pnl:${portfolioId}`;

    this.logger.log(
      `Client ${client.id} subscribing to P&L for portfolio ${portfolioId}`,
    );
    await client.join(pnlKey);

    // Start P&L calculation stream
    if (!this.pnlIntervals.has(pnlKey)) {
      await this.startPnLStream(portfolioId, userId);
    }

    return { success: true, message: `Subscribed to portfolio P&L` };
  }

  /**
   * Start streaming Greeks calculations
   */
  private async startGreeksStream(
    ticker: string,
    strike: number,
    maturity: string,
    optionType: OptionType,
    riskFreeRate: number,
  ) {
    const greeksKey = `greeks:${ticker}:${strike}:${maturity}:${optionType}`;

    const interval = setInterval(() => {
      void this.refreshGreeksStream(
        greeksKey,
        ticker,
        strike,
        maturity,
        optionType,
        riskFreeRate,
      );
    }, this.UPDATE_INTERVAL_MS);
    if (interval.unref) {
      interval.unref();
    }

    this.greeksIntervals.set(greeksKey, interval);
    this.logger.log(`Started Greeks stream for ${greeksKey}`);
  }

  /**
   * Start streaming portfolio P&L updates
   */
  private async startPnLStream(portfolioId: string, userId: string) {
    const pnlKey = `pnl:${portfolioId}`;

    const interval = setInterval(() => {
      void this.refreshPnLStream(pnlKey, portfolioId, userId);
    }, this.UPDATE_INTERVAL_MS);
    if (interval.unref) {
      interval.unref();
    }

    this.pnlIntervals.set(pnlKey, interval);
    this.logger.log(`Started P&L stream for portfolio ${portfolioId}`);
  }

  /**
   * Calculate time to maturity in years from maturity string (YYYY-MM-DD)
   */
  private calculateTimeToMaturity(maturity: string): number {
    const maturityDate = new Date(maturity);
    const now = new Date();
    const diffMs = maturityDate.getTime() - now.getTime();
    const diffDays = diffMs / (1000 * 60 * 60 * 24);
    return diffDays / 365; // Convert to years
  }

  private stopGreeksStream(greeksKey: string) {
    const interval = this.greeksIntervals.get(greeksKey);
    if (interval) {
      clearInterval(interval);
      this.greeksIntervals.delete(greeksKey);
      this.logger.log(`Stopped Greeks stream for ${greeksKey}`);
    }
  }

  private stopPnLStream(pnlKey: string) {
    const interval = this.pnlIntervals.get(pnlKey);
    if (interval) {
      clearInterval(interval);
      this.pnlIntervals.delete(pnlKey);
      this.logger.log(`Stopped P&L stream for ${pnlKey}`);
    }
  }

  private async refreshGreeksStream(
    greeksKey: string,
    ticker: string,
    strike: number,
    maturity: string,
    optionType: OptionType,
    riskFreeRate: number,
  ) {
    try {
      if (this.getRoomSize(greeksKey) === 0) {
        this.stopGreeksStream(greeksKey);
        return;
      }

      const quote = await this.marketDataService.getRealtimeQuote(ticker);
      const timeToMaturity = this.calculateTimeToMaturity(maturity);

      const greeks = await this.optionsService.calculateGreeks({
        underlying: quote.price,
        strike,
        timeToExpiry: timeToMaturity,
        volatility: 0.25,
        riskFreeRate,
        optionType,
      });

      this.server.to(greeksKey).emit('greeks-update', {
        ticker,
        strike,
        maturity,
        optionType,
        underlyingPrice: quote.price,
        greeks,
        timestamp: quote.timestamp,
      });
    } catch (error) {
      this.logger.error(`Error in Greeks stream for ${greeksKey}:`, error);
    }
  }

  private async refreshPnLStream(
    pnlKey: string,
    portfolioId: string,
    userId: string,
  ) {
    try {
      if (this.getRoomSize(pnlKey) === 0) {
        this.stopPnLStream(pnlKey);
        return;
      }

      const portfolio = await this.portfolioService.getPortfolio(
        portfolioId,
        userId,
      );

      if (
        !portfolio ||
        !portfolio.positions ||
        portfolio.positions.length === 0
      ) {
        return;
      }

      let totalValue = 0;
      let totalCost = 0;

      const liveQuotes = await Promise.all(
        portfolio.positions.map(async (position) => ({
          position,
          quote: await this.marketDataService.getRealtimeQuote(position.ticker),
        })),
      );

      for (const { position, quote } of liveQuotes) {
        const positionValue = position.quantity * quote.price;
        const positionCost = position.quantity * position.avgCost;

        totalValue += positionValue;
        totalCost += positionCost;
      }

      const totalPnL = totalValue - totalCost;
      const totalPnLPercent = (totalPnL / totalCost) * 100;

      this.server.to(pnlKey).emit('pnl-update', {
        portfolioId,
        totalValue: Number(totalValue.toFixed(2)),
        totalCost: Number(totalCost.toFixed(2)),
        totalPnL: Number(totalPnL.toFixed(2)),
        totalPnLPercent: Number(totalPnLPercent.toFixed(2)),
        timestamp: new Date(),
      });
    } catch (error) {
      this.logger.error(`Error in P&L stream for ${pnlKey}:`, error);
    }
  }

  /**
   * Clean up all subscriptions for a disconnected client
   */
  private cleanupClientSubscriptions(clientId: string) {
    const subscribedTickers =
      this.clientTickerSubscriptions.get(clientId) || new Set<string>();
    for (const ticker of subscribedTickers) {
      this.marketStreamManager.unsubscribe(ticker);
    }
    this.clientTickerSubscriptions.delete(clientId);

    for (const greeksKey of [...this.greeksIntervals.keys()]) {
      if (this.getRoomSize(greeksKey) === 0) {
        this.stopGreeksStream(greeksKey);
      }
    }

    for (const pnlKey of [...this.pnlIntervals.keys()]) {
      if (this.getRoomSize(pnlKey) === 0) {
        this.stopPnLStream(pnlKey);
      }
    }

    this.logger.log(`Cleaned up subscriptions for client ${clientId}`);
  }
}
