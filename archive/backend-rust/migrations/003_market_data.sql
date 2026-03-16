-- Create market_data table with TimescaleDB hypertable

CREATE TABLE IF NOT EXISTS market_data (
    time TIMESTAMPTZ NOT NULL,
    ticker VARCHAR(10) NOT NULL,
    price NUMERIC(20,8) NOT NULL,
    volume BIGINT,
    source VARCHAR(50) NOT NULL
);

-- Create hypertable for time-series data
SELECT create_hypertable('market_data', 'time', if_not_exists => TRUE);

-- Create indexes for efficient queries
CREATE INDEX idx_market_data_ticker_time ON market_data (ticker, time DESC);
CREATE INDEX idx_market_data_source ON market_data(source);

-- Add compression policy (compress data older than 7 days)
ALTER TABLE market_data SET (
    timescaledb.compress,
    timescaledb.compress_segmentby = 'ticker,source'
);

SELECT add_compression_policy('market_data', INTERVAL '7 days', if_not_exists => TRUE);

-- Add retention policy (keep data for 5 years)
SELECT add_retention_policy('market_data', INTERVAL '5 years', if_not_exists => TRUE);
