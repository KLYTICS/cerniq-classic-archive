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
import { JwtService } from '@nestjs/jwt';
import { MarketDataService } from '../market-data/market-data.service';
import { OptionsService } from '../options/options.service';
import { PortfolioService } from '../portfolio/portfolio.service';
import { OptionType } from '../options/dto/options.dto';
import { isAllowedOrigin } from '../security/origin-allowlist';
import { MarketStreamManagerService } from '../market-data/market-stream-manager.service';

interface SubscriptionPayload {
  ticker: string;
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
}

/** Per-socket authenticated user context, bound at handshake when JWT verifies. */
interface SocketUserCtx {
  userId: string;
  isMasterCeo: boolean;
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
    private readonly jwtService: JwtService,
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

  // ─── Connection handling (permissive JWT, per-handler enforcement) ──
  //
  // This gateway serves a MIXED surface: public ticker feeds + private
  // portfolio P&L. Unlike the ai-advisor (b2a64c25) and alm-realtime
  // (5d2f6637) gateways where every handler is tenant-scoped and the
  // connection itself fails-closed, this gateway lazy-verifies the JWT
  // at handshake and BINDS `client.data.user` only when the token is
  // valid. Sensitive handlers (currently just
  // `handlePortfolioPnLSubscription`) require `client.data.user` and
  // call `portfolioService.getPortfolio(portfolioId, userId)` —
  // already an ownership-or-404 primitive — before joining the room.
  // Public handlers (ticker / Greeks) keep their pre-existing
  // unauthenticated behavior so the marketing surface and SSO-pre-auth
  // tabs continue to receive market data.
  //
  // Pre-fix: `handlePortfolioPnLSubscription` accepted `userId` from
  // `@MessageBody()` and passed it straight into the ownership check,
  // letting any caller impersonate any user by claiming their id. JWT
  // verification at the connection (when present) is now the only
  // path that supplies userId to the P&L handler.

  async handleConnection(client: Socket): Promise<void> {
    const user = await this.verifyClientToken(client);
    if (user) {
      client.data.user = user;
      this.logger.log(`Client connected: user=${user.userId} (${client.id})`);
    } else {
      // Permissive: allow the connection through for public ticker /
      // Greeks subscriptions. The sensitive P&L handler will check
      // `client.data.user` and reject if absent.
      this.logger.log(`Client connected: anonymous (${client.id})`);
    }
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
    // Auth-required handler. Closes CRITICAL body-trust IDOR — pre-fix
    // accepted `userId` from @MessageBody alongside `portfolioId`,
    // letting an attacker join `pnl:<victim-portfolio>` by lying about
    // who they were. Verified userId comes from the JWT bound on
    // handleConnection; absence → reject the subscription.
    const user = client.data.user as SocketUserCtx | undefined;
    if (!user) {
      return {
        success: false,
        message:
          'UNAUTHENTICATED: portfolio P&L requires an authenticated session',
      };
    }

    if (!payload?.portfolioId || typeof payload.portfolioId !== 'string') {
      return {
        success: false,
        message: 'Invalid payload: portfolioId required',
      };
    }
    const { portfolioId } = payload;

    // Verify ownership BEFORE joining the room. `getPortfolio` throws
    // `NotFoundException` on cross-tenant access (anti-enumeration
    // posture — never reveal whether the portfolio exists). On
    // success the row is hydrated; we discard it here and let
    // refreshPnLStream re-fetch on the interval cycle.
    try {
      await this.portfolioService.getPortfolio(portfolioId, user.userId);
    } catch (err) {
      this.logger.warn(
        `P&L subscription denied: user=${user.userId} portfolio=${portfolioId} (${err instanceof Error ? err.message : 'unknown'})`,
      );
      return {
        success: false,
        message: 'FORBIDDEN: portfolio not found or not owned',
      };
    }

    const pnlKey = `pnl:${portfolioId}`;
    this.logger.log(
      `Client ${client.id} (user=${user.userId}) subscribing to P&L for portfolio ${portfolioId}`,
    );
    await client.join(pnlKey);

    // Start P&L calculation stream — pass the verified userId so the
    // refresh loop's PortfolioService call uses the same identity that
    // just passed the ownership check.
    if (!this.pnlIntervals.has(pnlKey)) {
      await this.startPnLStream(portfolioId, user.userId);
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

  // ─── Auth helpers (dual-source: legacy JWT then Supabase) ──
  //
  // Same shape as `AlmRealtimeGateway.verifyClientToken` (5d2f6637) +
  // `AiAdvisorGateway.verifyClientToken` (b2a64c25). Permissive return
  // (null on failure) — caller decides whether to fail-closed (P&L)
  // or fail-open (ticker/Greeks).

  private async verifyClientToken(
    client: Socket,
  ): Promise<SocketUserCtx | null> {
    const token = this.extractToken(client);
    if (!token) return null;

    const legacy = this.tryVerifyLegacyJwt(token);
    if (legacy) return legacy;

    const supabase = await this.tryVerifySupabaseToken(token);
    if (supabase) return supabase;

    this.logger.warn(
      `Realtime gateway token failed both legacy and Supabase verification (clientId=${client.id})`,
    );
    return null;
  }

  private tryVerifyLegacyJwt(token: string): SocketUserCtx | null {
    try {
      const payload = this.jwtService.verify(token);
      const userId =
        (payload?.userId as string | undefined) ??
        (payload?.sub as string | undefined);
      if (!userId) return null;
      const access = payload?.access as { isMasterCeo?: boolean } | undefined;
      return {
        userId,
        isMasterCeo: !!access?.isMasterCeo,
      };
    } catch {
      return null;
    }
  }

  private async tryVerifySupabaseToken(
    token: string,
  ): Promise<SocketUserCtx | null> {
    const supabaseUrl = (process.env.SUPABASE_URL || '')
      .trim()
      .replace(/\/$/, '');
    const anonKey =
      (process.env.SUPABASE_ANON_KEY || '').trim() ||
      (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '').trim();
    if (!supabaseUrl || !anonKey) return null;

    try {
      const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
        headers: {
          apikey: anonKey,
          Authorization: `Bearer ${token}`,
        },
      });
      if (!response.ok) return null;
      const user = (await response.json()) as { id?: string };
      if (!user?.id) return null;
      return {
        userId: user.id,
        isMasterCeo: false,
      };
    } catch {
      return null;
    }
  }

  private extractToken(client: Socket): string | null {
    const auth = client.handshake.auth as Record<string, unknown> | undefined;
    const fromAuth =
      (auth?.token as string | undefined) ||
      (auth?.accessToken as string | undefined);
    if (fromAuth) return fromAuth;

    const header = client.handshake.headers?.authorization;
    if (typeof header === 'string') {
      const m = header.match(/^Bearer\s+(.+)$/i);
      if (m) return m[1];
    }
    return null;
  }
}
