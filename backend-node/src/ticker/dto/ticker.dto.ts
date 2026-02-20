export class TickerDto {
    ticker: string;
    name: string;
    sector?: string;
    industry?: string;
    assetType: 'stock' | 'etf' | 'crypto' | 'index';
    exchange?: string;
    country?: string;
    marketCap?: number;
    isActive: boolean;
    firstAdded: Date;
    lastUpdated: Date;
    metadata?: Record<string, any>;
}

export class CreateTickerDto {
    ticker: string;
    name: string;
    sector?: string;
    industry?: string;
    assetType: 'stock' | 'etf' | 'crypto' | 'index';
    exchange?: string;
    country?: string;
    marketCap?: number;
    metadata?: Record<string, any>;
}

export class UpdateTickerDto {
    name?: string;
    sector?: string;
    industry?: string;
    exchange?: string;
    country?: string;
    marketCap?: number;
    isActive?: boolean;
    metadata?: Record<string, any>;
}

export class TickerListQueryDto {
    assetType?: 'stock' | 'etf' | 'crypto' | 'index';
    sector?: string;
    isActive?: boolean;
    page?: number;
    limit?: number;
    search?: string;
}
