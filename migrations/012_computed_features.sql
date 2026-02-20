-- Computed features table
CREATE TABLE IF NOT EXISTS computed_features (
    id SERIAL PRIMARY KEY,
    ticker VARCHAR(10) NOT NULL,
    as_of_date DATE NOT NULL,
    
    -- Growth Metrics (%)
    revenue_growth_qoq NUMERIC(10, 2),
    revenue_growth_yoy NUMERIC(10, 2),
    eps_growth_qoq NUMERIC(10, 2),
    eps_growth_yoy NUMERIC(10, 2),
    fcf_growth_yoy NUMERIC(10, 2),
    
    -- Valuation Metrics
    price_to_earnings NUMERIC(10, 2),
    price_to_sales NUMERIC(10, 2),
    price_to_book NUMERIC(10, 2),
    ev_to_ebitda NUMERIC(10, 2),
    fcf_yield NUMERIC(10, 2),
    
    -- Margins (%)
    gross_margin NUMERIC(10, 2),
    operating_margin NUMERIC(10, 2),
    net_margin NUMERIC(10, 2),
    
    -- Capital Efficiency
    return_on_equity NUMERIC(10, 2),
    return_on_assets NUMERIC(10, 2),
    asset_turnover NUMERIC(10, 4),
    
    -- Technical Indicators
    ma_50_day NUMERIC(12, 2),
    ma_200_day NUMERIC(12, 2),
    volatility_30_day NUMERIC(10, 2),
    rsi_14_day NUMERIC(10, 2),
    
    -- Percentile Rankings (0-100)
    pe_percentile NUMERIC(5, 2),
    price_percentile NUMERIC(5, 2),
    volume_percentile NUMERIC(5, 2),
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(ticker, as_of_date)
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_computed_features_ticker ON computed_features(ticker, as_of_date DESC);
CREATE INDEX IF NOT EXISTS idx_computed_features_date ON computed_features(as_of_date DESC);

-- Comments
COMMENT ON TABLE computed_features IS 'Calculated features for valuation and KPI scoring';
COMMENT ON COLUMN computed_features.revenue_growth_yoy IS 'Year-over-year revenue growth %';
COMMENT ON COLUMN computed_features.price_to_earnings IS 'P/E ratio (price / EPS)';
COMMENT ON COLUMN computed_features.pe_percentile IS '5-year percentile rank of P/E ratio';
