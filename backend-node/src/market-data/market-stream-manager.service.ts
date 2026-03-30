import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { EventEmitter } from 'events';
import {
  InstrumentProfileDto,
  NewsArticleDto,
  QuoteDto,
  StreamStatusDto,
} from './dto/quote.dto';
import { MarketDataService } from './market-data.service';

interface QuoteStreamEvent {
  ticker: string;
  quote: QuoteDto;
}

interface InstrumentStreamEvent {
  ticker: string;
  profile: InstrumentProfileDto;
  quote?: QuoteDto;
  timestamp: Date;
}

interface NewsStreamEvent {
  ticker: string;
  items: NewsArticleDto[];
  timestamp: Date;
}

interface StreamState {
  ticker: string;
  subscribers: number;
  startedAt: Date;
  quoteTimer?: NodeJS.Timeout;
  profileTimer?: NodeJS.Timeout;
  newsTimer?: NodeJS.Timeout;
  lastQuoteAt?: Date;
  lastProfileAt?: Date;
  lastNewsAt?: Date;
  lastErrorAt?: Date;
  lastErrorMessage?: string;
}

@Injectable()
export class MarketStreamManagerService implements OnModuleDestroy {
  private readonly logger = new Logger(MarketStreamManagerService.name);
  private readonly emitter = new EventEmitter();
  private readonly streams = new Map<string, StreamState>();
  private readonly quotePollIntervalMs = this.parseInterval(
    process.env.MARKET_STREAM_INTERVAL_MS,
    5000,
  );
  private readonly profilePollIntervalMs = this.parseInterval(
    process.env.MARKET_PROFILE_STREAM_INTERVAL_MS,
    15 * 60 * 1000,
  );
  private readonly newsPollIntervalMs = this.parseInterval(
    process.env.MARKET_NEWS_STREAM_INTERVAL_MS,
    5 * 60 * 1000,
  );

  constructor(private readonly marketDataService: MarketDataService) {
    this.emitter.setMaxListeners(0);
  }

  private parseInterval(
    rawValue: string | undefined,
    fallbackMs: number,
  ): number {
    const parsed = Number.parseInt(rawValue || '', 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallbackMs;
  }

  private emitQuote(event: QuoteStreamEvent) {
    this.emitter.emit('quote', event);
  }

  private emitInstrument(event: InstrumentStreamEvent) {
    this.emitter.emit('instrument', event);
  }

  private emitNews(event: NewsStreamEvent) {
    this.emitter.emit('news', event);
  }

  onQuote(listener: (event: QuoteStreamEvent) => void) {
    this.emitter.on('quote', listener);
    return () => this.emitter.off('quote', listener);
  }

  onInstrument(listener: (event: InstrumentStreamEvent) => void) {
    this.emitter.on('instrument', listener);
    return () => this.emitter.off('instrument', listener);
  }

  onNews(listener: (event: NewsStreamEvent) => void) {
    this.emitter.on('news', listener);
    return () => this.emitter.off('news', listener);
  }

  async subscribe(
    rawTicker: string,
  ): Promise<{ ticker: string; subscribers: number }> {
    const ticker = this.marketDataService.normalizeTicker(rawTicker);
    const existing = this.streams.get(ticker);
    if (existing) {
      existing.subscribers += 1;
      return { ticker, subscribers: existing.subscribers };
    }

    const state: StreamState = {
      ticker,
      subscribers: 1,
      startedAt: new Date(),
    };
    this.streams.set(ticker, state);

    await Promise.allSettled([
      this.publishQuote(ticker),
      this.publishProfileAndNews(ticker),
    ]);

    state.quoteTimer = setInterval(() => {
      void this.publishQuote(ticker);
    }, this.quotePollIntervalMs);
    state.profileTimer = setInterval(() => {
      void this.publishProfile(ticker);
    }, this.profilePollIntervalMs);
    state.newsTimer = setInterval(() => {
      void this.publishNews(ticker);
    }, this.newsPollIntervalMs);
    state.quoteTimer.unref?.();
    state.profileTimer.unref?.();
    state.newsTimer.unref?.();

    this.logger.log(`Started managed market stream for ${ticker}`);
    return { ticker, subscribers: 1 };
  }

  unsubscribe(rawTicker: string): { ticker: string; subscribers: number } {
    const ticker = this.marketDataService.normalizeTicker(rawTicker);
    const state = this.streams.get(ticker);
    if (!state) {
      return { ticker, subscribers: 0 };
    }

    state.subscribers = Math.max(0, state.subscribers - 1);
    if (state.subscribers === 0) {
      this.stopStream(ticker);
    }

    return { ticker, subscribers: state.subscribers };
  }

  getStreamStatus(): StreamStatusDto[] {
    return Array.from(this.streams.values())
      .map((stream) => ({
        ticker: stream.ticker,
        subscribers: stream.subscribers,
        quotePollIntervalMs: this.quotePollIntervalMs,
        profilePollIntervalMs: this.profilePollIntervalMs,
        newsPollIntervalMs: this.newsPollIntervalMs,
        startedAt: stream.startedAt,
        lastQuoteAt: stream.lastQuoteAt,
        lastProfileAt: stream.lastProfileAt,
        lastNewsAt: stream.lastNewsAt,
        lastErrorAt: stream.lastErrorAt,
        lastErrorMessage: stream.lastErrorMessage,
      }))
      .sort((a, b) => a.ticker.localeCompare(b.ticker));
  }

  private async publishQuote(ticker: string) {
    const state = this.streams.get(ticker);
    if (!state) {
      return;
    }

    try {
      const quote = await this.marketDataService.getRealtimeQuote(ticker);
      state.lastQuoteAt = new Date();
      this.emitQuote({ ticker, quote });
    } catch (error: any) {
      state.lastErrorAt = new Date();
      state.lastErrorMessage =
        error?.message || `Failed to stream quote for ${ticker}`;
      this.logger.error(state.lastErrorMessage, error?.stack);
    }
  }

  private async publishProfile(ticker: string) {
    const state = this.streams.get(ticker);
    if (!state) {
      return;
    }

    try {
      const profile = await this.marketDataService.getInstrumentProfile(ticker);
      state.lastProfileAt = new Date();
      this.emitInstrument({
        ticker,
        profile,
        timestamp: new Date(),
      });
    } catch (error: any) {
      state.lastErrorAt = new Date();
      state.lastErrorMessage =
        error?.message || `Failed to stream instrument profile for ${ticker}`;
      this.logger.error(state.lastErrorMessage, error?.stack);
    }
  }

  private async publishNews(ticker: string) {
    const state = this.streams.get(ticker);
    if (!state) {
      return;
    }

    try {
      const items = await this.marketDataService.getNews(ticker, 8);
      state.lastNewsAt = new Date();
      this.emitNews({
        ticker,
        items,
        timestamp: new Date(),
      });
    } catch (error: any) {
      state.lastErrorAt = new Date();
      state.lastErrorMessage =
        error?.message || `Failed to stream news for ${ticker}`;
      this.logger.error(state.lastErrorMessage, error?.stack);
    }
  }

  private async publishProfileAndNews(ticker: string) {
    const [profileResult, newsResult, quoteResult] = await Promise.allSettled([
      this.marketDataService.getInstrumentProfile(ticker),
      this.marketDataService.getNews(ticker, 8),
      this.marketDataService.getRealtimeQuote(ticker),
    ]);

    const state = this.streams.get(ticker);
    if (!state) {
      return;
    }

    if (quoteResult.status === 'fulfilled') {
      state.lastQuoteAt = new Date();
      this.emitQuote({ ticker, quote: quoteResult.value });
    }

    if (profileResult.status === 'fulfilled') {
      state.lastProfileAt = new Date();
      this.emitInstrument({
        ticker,
        profile: profileResult.value,
        quote:
          quoteResult.status === 'fulfilled' ? quoteResult.value : undefined,
        timestamp: new Date(),
      });
    }

    if (newsResult.status === 'fulfilled') {
      state.lastNewsAt = new Date();
      this.emitNews({
        ticker,
        items: newsResult.value,
        timestamp: new Date(),
      });
    }
  }

  private stopStream(ticker: string) {
    const state = this.streams.get(ticker);
    if (!state) {
      return;
    }

    if (state.quoteTimer) {
      clearInterval(state.quoteTimer);
    }
    if (state.profileTimer) {
      clearInterval(state.profileTimer);
    }
    if (state.newsTimer) {
      clearInterval(state.newsTimer);
    }

    this.streams.delete(ticker);
    this.logger.log(`Stopped managed market stream for ${ticker}`);
  }

  onModuleDestroy() {
    for (const ticker of [...this.streams.keys()]) {
      this.stopStream(ticker);
    }
  }
}
