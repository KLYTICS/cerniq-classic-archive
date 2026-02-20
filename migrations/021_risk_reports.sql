-- Risk Reports for VaR/CVaR Feature

CREATE TABLE IF NOT EXISTS risk_reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    portfolio_id UUID REFERENCES portfolios(id) ON DELETE SET NULL,
    report_type VARCHAR(50) NOT NULL,
    var_95 DECIMAL(15,2),
    cvar_95 DECIMAL(15,2),
    var_99 DECIMAL(15,2),
    cvar_99 DECIMAL(15,2),
    monte_carlo_paths INTEGER DEFAULT 10000,
    confidence_level DECIMAL(5,2),
    time_horizon INTEGER DEFAULT 1,
    portfolio_value DECIMAL(15,2),
    simulation_data JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_risk_reports_user ON risk_reports(user_id);
CREATE INDEX idx_risk_reports_portfolio ON risk_reports(portfolio_id);
