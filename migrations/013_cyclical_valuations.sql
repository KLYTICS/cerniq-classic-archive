-- Cyclical valuations table
CREATE TABLE IF NOT EXISTS cyclical_valuations (
    id SERIAL PRIMARY KEY,
    ticker VARCHAR(10) NOT NULL,
    as_of_date DATE NOT NULL,
    
    -- Cycle Analysis
    cycles_detected INTEGER NOT NULL,
    avg_cycle_duration_quarters NUMERIC(10, 2),
    current_cycle_position VARCHAR(20),
    quarters_into_cycle INTEGER,
    
    -- Normalized Mid-Cycle Metrics
    mid_cycle_revenue NUMERIC(20, 2),
    mid_cycle_eps NUMERIC(10, 4),
    mid_cycle_margin NUMERIC(10, 2),
    
    -- Current vs Mid-Cycle
    revenue_vs_midcycle_pct NUMERIC(10, 2),
    eps_vs_midcycle_pct NUMERIC(10, 2),
    
    -- Valuation
    current_price NUMERIC(12, 2),
    mid_cycle_pe NUMERIC(10, 2),
    fair_value_base NUMERIC(12, 2),
    fair_value_low NUMERIC(12, 2),
    fair_value_high NUMERIC(12, 2),
    upside_downside_pct NUMERIC(10, 2),
    
    -- Regime-Specific Multiple
    applied_multiple NUMERIC(10, 2),
    cycle_adjustment_factor NUMERIC(5, 4),
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(ticker, as_of_date)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_cyclical_valuations_ticker ON cyclical_valuations(ticker, as_of_date DESC);

-- Comments
COMMENT ON TABLE cyclical_valuations IS 'Cyclical valuation analysis results';
COMMENT ON COLUMN cyclical_valuations.mid_cycle_eps IS 'Normalized EPS at mid-cycle';
COMMENT ON COLUMN cyclical_valuations.current_cycle_position IS 'EarlyCycle, MidCycle, LateCycle, Peak, or Downturn';
