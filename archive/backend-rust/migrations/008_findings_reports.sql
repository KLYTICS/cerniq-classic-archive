-- Add findings (detected leaks) and reports tables

CREATE TABLE IF NOT EXISTS findings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    vendor_id UUID REFERENCES vendors(id),
    finding_type VARCHAR(100) NOT NULL, -- 'duplicate_payment', 'price_drift', 'auto_renew_risk', etc.
    severity VARCHAR(20) DEFAULT 'medium', -- 'low', 'medium', 'high', 'critical'
    amount NUMERIC(15,2),
    confidence NUMERIC(3,2) CHECK (confidence >= 0 AND confidence <= 1), -- 0.0 to 1.0
    evidence JSONB, -- Structured evidence (invoice IDs, dates, etc.)
    description TEXT,
    status VARCHAR(50) DEFAULT 'open', -- 'open', 'investigating', 'resolved', 'false_positive'
    created_at TIMESTAMPTZ DEFAULT NOW(),
    resolved_at TIMESTAMPTZ
);

CREATE INDEX idx_findings_workspace ON findings(workspace_id);
CREATE INDEX idx_findings_type ON findings(finding_type);
CREATE INDEX idx_findings_severity ON findings(severity);
CREATE INDEX idx_findings_status ON findings(status);
CREATE INDEX idx_findings_amount ON findings(amount DESC);

CREATE TABLE IF NOT EXISTS reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    report_type VARCHAR(50) DEFAULT 'leak_audit', -- 'leak_audit', 'monthly_summary', etc.
    total_spend_analyzed NUMERIC(15,2),
    total_leaks_found NUMERIC(15,2),
    leaks_percentage NUMERIC(5,2),
    findings_count INT,
    report_data JSONB, -- Full report structure
    generated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_reports_workspace ON reports(workspace_id);
CREATE INDEX idx_reports_generated ON reports(generated_at DESC);

CREATE TABLE IF NOT EXISTS events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id),
    workspace_id UUID REFERENCES workspaces(id),
    event_type VARCHAR(100) NOT NULL,
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_events_user ON events(user_id);
CREATE INDEX idx_events_workspace ON events(workspace_id);
CREATE INDEX idx_events_type ON events(event_type);
CREATE INDEX idx_events_created ON events(created_at DESC);
