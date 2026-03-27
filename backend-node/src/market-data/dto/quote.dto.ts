export type AssetType = 'stock' | 'etf' | 'crypto' | 'index';
export type FreshnessState =
  | 'NEAR_REALTIME'
  | 'DELAYED'
  | 'STALE'
  | 'DISCONNECTED'
  | 'UNAVAILABLE';
export type MarketSession =
  | 'PREMARKET'
  | 'REGULAR'
  | 'AFTER_HOURS'
  | 'CLOSED'
  | 'CRYPTO'
  | 'UNKNOWN';

export class QuoteDto {
  ticker: string;
  assetType?: AssetType;
  shortName?: string;
  longName?: string;
  exchange?: string;
  currency?: string;
  marketState?: string;
  session?: MarketSession;
  freshnessState?: FreshnessState;
  provider?: string;
  quoteTimestamp?: Date;
  serverTimestamp?: Date;
  ageMs?: number;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  marketCap?: number;
  high: number;
  low: number;
  open: number;
  previousClose: number;
  timestamp: Date;
}

export class HistoricalPriceDto {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  adjustedClose: number;
}

export class FundamentalsDto {
  ticker: string;
  assetType?: AssetType;
  marketCap: number;
  peRatio?: number;
  forwardPE?: number;
  pbRatio?: number;
  dividendYield?: number;
  eps?: number;
  beta?: number;
  fiftyTwoWeekHigh?: number;
  fiftyTwoWeekLow?: number;
  averageVolume?: number;
  sector?: string;
  industry?: string;
}

export class TickerSearchResultDto {
  ticker: string;
  name: string;
  assetType: AssetType;
  exchange?: string;
  sector?: string;
}

export class NewsArticleDto {
  id: string;
  title: string;
  publisher: string;
  link: string;
  publishedAt: Date;
  relatedTickers?: string[];
  thumbnailUrl?: string;
}

export class EtfHoldingDto {
  symbol: string;
  name: string;
  weight: number;
}

export class InstrumentProfileDto {
  ticker: string;
  assetType: AssetType;
  shortName?: string;
  longName?: string;
  exchange?: string;
  currency?: string;
  marketState?: string;
  sector?: string;
  industry?: string;
  categoryName?: string;
  family?: string;
  description?: string;
  website?: string;
  marketCap?: number;
  totalAssets?: number;
  expenseRatio?: number;
  yield?: number;
  ytdReturn?: number;
  topHoldings?: EtfHoldingDto[];
}

export class MarketSnapshotDto {
  quote: QuoteDto;
  profile: InstrumentProfileDto;
  news: NewsArticleDto[];
}

export class ProviderHealthDto {
  provider: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  successRate: number;
  avgLatencyMs: number;
  lastSuccessAt?: Date;
  lastFailureAt?: Date;
  consecutiveFailures: number;
}

export class StreamStatusDto {
  ticker: string;
  subscribers: number;
  quotePollIntervalMs: number;
  profilePollIntervalMs: number;
  newsPollIntervalMs: number;
  startedAt: Date;
  lastQuoteAt?: Date;
  lastProfileAt?: Date;
  lastNewsAt?: Date;
  lastErrorAt?: Date;
  lastErrorMessage?: string;
}

export class MarketDataHealthDto {
  status: 'healthy' | 'degraded' | 'unhealthy';
  freshnessSummary: {
    activeStreams: number;
    staleStreams: number;
    delayedStreams: number;
  };
  providers: ProviderHealthDto[];
  streams: StreamStatusDto[];
  generatedAt: Date;
}
