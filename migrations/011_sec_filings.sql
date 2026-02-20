-- SEC filings table
CREATE TABLE IF NOT EXISTS sec_filings (
    id SERIAL PRIMARY KEY,
    ticker VARCHAR(10) NOT NULL,
    cik VARCHAR(20) NOT NULL,
    form_type VARCHAR(10) NOT NULL,
    filing_date DATE NOT NULL,
    fiscal_period VARCHAR(10),
    fiscal_year INTEGER NOT NULL,
    accession_number VARCHAR(50) NOT NULL,
    filing_url TEXT NOT NULL,
    processed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(ticker, accession_number)
);

-- Financial metrics table
CREATE TABLE IF NOT EXISTS financial_metrics (
    id SERIAL PRIMARY KEY,
    filing_id INTEGER NOT NULL REFERENCES sec_filings(id) ON DELETE CASCADE,
    ticker VARCHAR(10) NOT NULL,
    period_end DATE NOT NULL,
    
    -- Income Statement
    revenue NUMERIC(20, 2),
    cost_of_revenue NUMERIC(20, 2),
    gross_profit NUMERIC(20, 2),
    operating_income NUMERIC(20, 2),
    net_income NUMERIC(20, 2),
    eps_basic NUMERIC(10, 4),
    eps_diluted NUMERIC(10, 4),
    
    -- Balance Sheet
    total_assets NUMERIC(20, 2),
    total_liabilities NUMERIC(20, 2),
    shareholders_equity NUMERIC(20, 2),
    cash_and_equivalents NUMERIC(20, 2),
    total_debt NUMERIC(20, 2),
    
    -- Cash Flow
    operating_cash_flow NUMERIC(20, 2),
    investing_cash_flow NUMERIC(20, 2),
    financing_cash_flow NUMERIC(20, 2),
    free_cash_flow NUMERIC(20, 2),
    capex NUMERIC(20, 2),
    
    -- Other
    shares_outstanding NUMERIC(20, 2),
    rd_expense NUMERIC(20, 2),
    backlog NUMERIC(20, 2),
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(filing_id)
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_sec_filings_ticker ON sec_filings(ticker, filing_date DESC);
CREATE INDEX IF NOT EXISTS idx_sec_filings_form_type ON sec_filings(form_type, filing_date DESC);
CREATE INDEX IF NOT EXISTS idx_financial_metrics_ticker ON financial_metrics(ticker, period_end DESC);

-- Comments
COMMENT ON TABLE sec_filings IS 'SEC filing metadata (10-K, 10-Q)';
COMMENT ON TABLE financial_metrics IS 'Extracted financial metrics from SEC filings';
