-- Migration: Universal Ticker Metadata and Market Data Cache
-- Purpose: Support all stocks, ETFs, and crypto with intelligent caching

-- Ticker metadata for universal coverage
CREATE TABLE IF NOT EXISTS tickers (
    ticker VARCHAR(10) PRIMARY KEY,
    name TEXT NOT NULL,
    sector VARCHAR(100),
    industry VARCHAR(100),
    asset_type VARCHAR(20) NOT NULL CHECK (asset_type IN ('stock', 'etf', 'crypto', 'index')),
    exchange VARCHAR(50),
    country VARCHAR(2),
    market_cap BIGINT,
    is_active BOOLEAN DEFAULT true,
    first_added TIMESTAMPTZ DEFAULT NOW(),
    last_updated TIMESTAMPTZ DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX idx_tickers_asset_type ON tickers(asset_type);
CREATE INDEX idx_tickers_sector ON tickers(sector) WHERE sector IS NOT NULL;
CREATE INDEX idx_tickers_active ON tickers(is_active) WHERE is_active = true;

-- Market data cache for performance
CREATE TABLE IF NOT EXISTS market_data_cache (
    ticker VARCHAR(10) NOT NULL,
    data_type VARCHAR(50) NOT NULL, -- 'price', 'fundamentals', 'quarterly_financials', 'key_stats'
    data JSONB NOT NULL,
    source VARCHAR(50) NOT NULL, -- 'yahoo_finance', 'alpha_vantage', 'sec_edgar'
    fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ, -- NULL = never expires
    PRIMARY KEY (ticker, data_type),
    FOREIGN KEY (ticker) REFERENCES tickers(ticker) ON DELETE CASCADE
);

CREATE INDEX idx_market_data_expires ON market_data_cache(expires_at) WHERE expires_at IS NOT NULL;
CREATE INDEX idx_market_data_fetched ON market_data_cache(fetched_at);

-- Watchlist for user-tracked tickers
CREATE TABLE IF NOT EXISTS watchlists (
    id SERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    is_default BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, name)
);

CREATE TABLE IF NOT EXISTS watchlist_items (
    id SERIAL PRIMARY KEY,
    watchlist_id INTEGER NOT NULL REFERENCES watchlists(id) ON DELETE CASCADE,
    ticker VARCHAR(10) NOT NULL REFERENCES tickers(ticker) ON DELETE CASCADE,
    added_at TIMESTAMPTZ DEFAULT NOW(),
    notes TEXT,
    target_price DECIMAL(12, 2),
    alert_enabled BOOLEAN DEFAULT false,
    UNIQUE(watchlist_id, ticker)
);

CREATE INDEX idx_watchlist_items_watchlist ON watchlist_items(watchlist_id);
CREATE INDEX idx_watchlist_items_ticker ON watchlist_items(ticker);

-- Seed with popular tickers
INSERT INTO tickers (ticker, name, sector, industry, asset_type, exchange) VALUES
    ('AAPL', 'Apple Inc.', 'Technology', 'Consumer Electronics', 'stock', 'NASDAQ'),
    ('MSFT', 'Microsoft Corporation', 'Technology', 'Software', 'stock', 'NASDAQ'),
    ('GOOGL', 'Alphabet Inc.', 'Technology', 'Internet', 'stock', 'NASDAQ'),
    ('AMZN', 'Amazon.com Inc.', 'Consumer Cyclical', 'Internet Retail', 'stock', 'NASDAQ'),
    ('NVDA', 'NVIDIA Corporation', 'Technology', 'Semiconductors', 'stock', 'NASDAQ'),
    ('TSLA', 'Tesla Inc.', 'Consumer Cyclical', 'Auto Manufacturers', 'stock', 'NASDAQ'),
    ('META', 'Meta Platforms Inc.', 'Technology', 'Internet', 'stock', 'NASDAQ'),
    ('LRCX', 'Lam Research Corporation', 'Technology', 'Semiconductor Equipment', 'stock', 'NASDAQ'),
    ('AMAT', 'Applied Materials Inc.', 'Technology', 'Semiconductor Equipment', 'stock', 'NASDAQ'),
    ('KLAC', 'KLA Corporation', 'Technology', 'Semiconductor Equipment', 'stock', 'NASDAQ'),
    ('ASML', 'ASML Holding N.V.', 'Technology', 'Semiconductor Equipment', 'stock', 'NASDAQ'),
    ('SPY', 'SPDR S&P 500 ETF Trust', 'Diversified', 'ETF', 'etf', 'NYSE'),
    ('QQQ', 'Invesco QQQ Trust', 'Technology', 'ETF', 'etf', 'NASDAQ'),
    ('VOO', 'Vanguard S&P 500 ETF', 'Diversified', 'ETF', 'etf', 'NYSE'),
    ('IWM', 'iShares Russell 2000 ETF', 'Diversified', 'ETF', 'etf', 'NYSE'),
    ('BTC', 'Bitcoin', 'Cryptocurrency', 'Layer 1', 'crypto', 'CRYPTO'),
    ('ETH', 'Ethereum', 'Cryptocurrency', 'Layer 1', 'crypto', 'CRYPTO')
ON CONFLICT (ticker) DO NOTHING;
