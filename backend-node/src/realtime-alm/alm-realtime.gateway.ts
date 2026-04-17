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
import { MarketDataFeedService } from './market-data-feed.service';
import { RateAlertService } from './rate-alert.service';
import { AlmRecalcService } from './alm-recalc.service';
import {
  SubscribePayloadSchema,
  MarketDataSnapshot,
  MarketRateResult,
} from './realtime-alm.dto';

/** Default polling interval: 5 minutes (300 000 ms). */
const DEFAULT_POLL_MS = 300_000;

/** Heartbeat interval: 30 seconds. */
const HEARTBEAT_MS = 30_000;

@WebSocketGateway({
  namespace: '/alm-realtime',
  cors: { origin: '*' },
})
export class AlmRealtimeGateway
  implements
    OnGatewayConnection,
    OnGatewayDisconnect,
    OnModuleInit,
    OnModuleDestroy
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(AlmRealtimeGateway.name);

  /** Maps clientId → Set of institutionIds they are subscribed to. */
  private readonly clientSubscriptions = new Map<string, Set<string>>();

  /** Heartbeat timer reference. */
  private heartbeatTimer: NodeJS.Timeout | null = null;

  /** Polling timer for market-data-driven recalcs. */
  private pollTimer: NodeJS.Timeout | null = null;

  constructor(
    private readonly marketDataFeed: MarketDataFeedService,
    private readonly rateAlertService: RateAlertService,
    private readonly almRecalcService: AlmRecalcService,
  ) {}

  // ─── Lifecycle ─────────────────────────────────────────────

  onModuleInit(): void {
    // Start the market-data polling cycle
    this.startPollCycle();

    // Start heartbeat
    this.heartbeatTimer = setInterval(() => {
      this.server?.emit('heartbeat', { ts: Date.now() });
    }, HEARTBEAT_MS);
    if (this.heartbeatTimer.unref) this.heartbeatTimer.unref();

    this.logger.log('ALM Realtime Gateway initialised');
  }

  onModuleDestroy(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
    this.clientSubscriptions.clear();
  }

  // ─── Connection handling ───────────────────────────────────

  handleConnection(client: Socket): void {
    // Validate auth token from handshake (permissive for now — log and allow)
    const token =
      client.handshake?.auth?.token ?? client.handshake?.headers?.authorization;

    if (!token) {
      this.logger.warn(
        `Client ${client.id} connected without auth token — allowing in demo mode`,
      );
    } else {
      this.logger.log(`Client ${client.id} connected (token present)`);
    }

    this.clientSubscriptions.set(client.id, new Set());

    client.emit('connectionStatus', {
      status: 'connected',
      feedsActive: ['SOFR', 'US_TREASURY', 'PR_DEPOSIT_INDEX'],
    });
  }

  handleDisconnect(client: Socket): void {
    const subs = this.clientSubscriptions.get(client.id);
    if (subs) {
      for (const instId of subs) {
        void client.leave(`institution:${instId}`);
      }
    }
    this.clientSubscriptions.delete(client.id);
    this.logger.log(`Client ${client.id} disconnected`);
  }

  // ─── Client → Server events ────────────────────────────────

  @SubscribeMessage('subscribe')
  async handleSubscribe(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: unknown,
  ): Promise<{ success: boolean; message: string }> {
    const parsed = SubscribePayloadSchema.safeParse(payload);
    if (!parsed.success) {
      return {
        success: false,
        message: 'Invalid payload: institutionId required',
      };
    }

    const { institutionId } = parsed.data;
    const roomName = `institution:${institutionId}`;

    await client.join(roomName);
    const subs = this.clientSubscriptions.get(client.id) ?? new Set<string>();
    subs.add(institutionId);
    this.clientSubscriptions.set(client.id, subs);

    this.logger.log(
      `Client ${client.id} subscribed to institution ${institutionId}`,
    );

    // Send latest cached recalc if available
    const lastRecalc = this.almRecalcService.getLastRecalc(institutionId);
    if (lastRecalc) {
      for (const [metric, value] of Object.entries(lastRecalc.metrics)) {
        const prev = lastRecalc.previousMetrics[metric] ?? value;
        client.emit('almRecalc', {
          institutionId,
          metric,
          newValue: value,
          previousValue: prev,
          delta: value - prev,
        });
      }
    }

    return { success: true, message: `Subscribed to ${institutionId}` };
  }

  @SubscribeMessage('unsubscribe')
  async handleUnsubscribe(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: unknown,
  ): Promise<{ success: boolean; message: string }> {
    const parsed = SubscribePayloadSchema.safeParse(payload);
    if (!parsed.success) {
      return {
        success: false,
        message: 'Invalid payload: institutionId required',
      };
    }

    const { institutionId } = parsed.data;
    await client.leave(`institution:${institutionId}`);

    const subs = this.clientSubscriptions.get(client.id);
    subs?.delete(institutionId);

    this.logger.log(
      `Client ${client.id} unsubscribed from institution ${institutionId}`,
    );
    return { success: true, message: `Unsubscribed from ${institutionId}` };
  }

  @SubscribeMessage('getLatestRates')
  async handleGetLatestRates(
    @ConnectedSocket() client: Socket,
  ): Promise<{ success: boolean; data: MarketDataSnapshot[] }> {
    try {
      const snapshots = await this.marketDataFeed.fetchLatestRates();
      return { success: true, data: snapshots };
    } catch (err) {
      this.logger.error(`Failed to fetch latest rates: ${err}`);
      return { success: false, data: [] };
    }
  }

  // ─── Server-push cycle ─────────────────────────────────────

  /**
   * Called each poll cycle: fetch rates, broadcast updates, recalc,
   * check alerts for each subscribed institution.
   */
  private async onPollCycle(): Promise<void> {
    try {
      const snapshots = await this.marketDataFeed.fetchLatestRates();

      // Broadcast rate updates to all connected clients
      for (const snap of snapshots) {
        const prev = snap.previousValue ?? snap.value;
        const changePct = prev !== 0 ? ((snap.value - prev) / prev) * 100 : 0;

        this.server.emit('rateUpdate', {
          dataType: snap.dataType,
          value: snap.value,
          previousValue: prev,
          changePercent: this.round(changePct),
          asOfDate: snap.asOfDate,
        });
      }

      // Collect institution rooms and trigger recalc + alerts
      const rooms = this.getSubscribedInstitutions();

      const rateResults: MarketRateResult[] = snapshots.map((s) => ({
        dataType: s.dataType,
        value: s.value,
        previousValue: s.previousValue ?? undefined,
        asOfDate: s.asOfDate,
        source: s.source,
      }));

      for (const institutionId of rooms) {
        await this.recalcAndAlert(institutionId, rateResults);
      }
    } catch (err) {
      this.logger.error(`Poll cycle error: ${err}`);
    }
  }

  /**
   * Recalculate ALM metrics for a single institution and emit events.
   */
  private async recalcAndAlert(
    institutionId: string,
    rates: MarketRateResult[],
  ): Promise<void> {
    const room = `institution:${institutionId}`;

    try {
      const result = await this.almRecalcService.recalculateOnRateChange(
        institutionId,
        rates,
      );

      // Emit per-metric recalc events
      for (const [metric, value] of Object.entries(result.metrics)) {
        const prev = result.previousMetrics[metric] ?? value;
        this.server.to(room).emit('almRecalc', {
          institutionId,
          metric,
          newValue: value,
          previousValue: prev,
          delta: this.round(value - prev),
        });
      }

      // Check alert thresholds
      const alerts = await this.rateAlertService.checkThresholds(
        institutionId,
        result.metrics as unknown as Record<string, number>,
      );

      for (const alert of alerts) {
        this.server.to(room).emit('alert', {
          institutionId,
          metric: alert.metric,
          level: alert.level,
          currentValue: alert.currentValue,
          threshold: alert.threshold,
          message: alert.message,
          messageEs: alert.messageEs,
        });
      }
    } catch (err) {
      this.logger.error(`Recalc/alert error for ${institutionId}: ${err}`);
    }
  }

  // ─── Helpers ───────────────────────────────────────────────

  private startPollCycle(): void {
    const intervalMs = this.parseInterval(
      process.env.ALM_REALTIME_POLL_MS,
      DEFAULT_POLL_MS,
    );

    this.pollTimer = setInterval(() => {
      void this.onPollCycle();
    }, intervalMs);
    if (this.pollTimer.unref) this.pollTimer.unref();

    // Immediate first cycle
    void this.onPollCycle();

    this.logger.log(`Poll cycle started (${intervalMs / 1000}s interval)`);
  }

  private getSubscribedInstitutions(): Set<string> {
    const institutions = new Set<string>();
    for (const subs of this.clientSubscriptions.values()) {
      for (const id of subs) institutions.add(id);
    }
    return institutions;
  }

  private parseInterval(raw: string | undefined, fallback: number): number {
    const parsed = parseInt(raw || '', 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
  }

  private round(n: number, decimals = 4): number {
    const factor = 10 ** decimals;
    return Math.round(n * factor) / factor;
  }
}
