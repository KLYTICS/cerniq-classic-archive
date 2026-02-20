-- Bring portfolio schema in line with runtime route expectations.
-- Safe to run repeatedly.

ALTER TABLE portfolios
    ADD COLUMN IF NOT EXISTS description TEXT,
    ADD COLUMN IF NOT EXISTS benchmark VARCHAR(32) DEFAULT 'SPY',
    ADD COLUMN IF NOT EXISTS initial_capital NUMERIC(18, 2) DEFAULT 0;

ALTER TABLE positions
    ADD COLUMN IF NOT EXISTS symbol VARCHAR(16),
    ADD COLUMN IF NOT EXISTS quantity NUMERIC(18, 8) DEFAULT 0,
    ADD COLUMN IF NOT EXISTS avg_cost NUMERIC(18, 4) DEFAULT 0,
    ADD COLUMN IF NOT EXISTS current_price NUMERIC(18, 4),
    ADD COLUMN IF NOT EXISTS opened_at TIMESTAMPTZ DEFAULT NOW(),
    ADD COLUMN IF NOT EXISTS closed_at TIMESTAMPTZ;

-- Backfill symbol for existing rows if they were created with ticker-only schema.
UPDATE positions
SET symbol = COALESCE(symbol, ticker)
WHERE symbol IS NULL;

ALTER TABLE positions
    ALTER COLUMN symbol SET NOT NULL;

ALTER TABLE positions
    ALTER COLUMN weight SET DEFAULT 0;

CREATE TABLE IF NOT EXISTS transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    portfolio_id UUID NOT NULL REFERENCES portfolios(id) ON DELETE CASCADE,
    position_id UUID REFERENCES positions(id) ON DELETE SET NULL,
    symbol VARCHAR(16) NOT NULL,
    action VARCHAR(16) NOT NULL,
    quantity NUMERIC(18, 8) NOT NULL,
    price NUMERIC(18, 4) NOT NULL,
    fees NUMERIC(18, 4),
    notes TEXT,
    executed_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_transactions_portfolio_id ON transactions(portfolio_id);
CREATE INDEX IF NOT EXISTS idx_transactions_position_id ON transactions(position_id);
