-- Market data table with TimescaleDB hypertable support
CREATE TABLE IF NOT EXISTS market_data (
    ticker VARCHAR(10) NOT NULL,
    date DATE NOT NULL,
    open NUMERIC(12, 4) NOT NULL,
    high NUMERIC(12, 4) NOT NULL,
    low NUMERIC(12, 4) NOT NULL,
    close NUMERIC(12, 4) NOT NULL,
    adj_close NUMERIC(12, 4) NOT NULL,
    volume BIGINT NOT NULL,
    source VARCHAR(50) NOT NULL DEFAULT 'yfinance',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (ticker, date)
);

-- Create index for efficient time-range queries
CREATE INDEX IF NOT EXISTS idx_market_data_ticker_date ON market_data(ticker, date DESC);

-- Create index for date-based queries
CREATE INDEX IF NOT EXISTS idx_market_data_date ON market_data(date DESC);

-- Add comment
COMMENT ON TABLE market_data IS 'Historical price data for all tracked tickers';
