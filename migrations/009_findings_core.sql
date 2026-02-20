-- Findings Enums
CREATE TYPE finding_status AS ENUM ('new', 'triaged', 'investigating', 'resolved', 'ignored');
CREATE TYPE finding_type AS ENUM ('duplicate_payment', 'subscription_drift', 'spend_spike', 'vendor_anomaly', 'data_quality');

-- Findings Table (The Product)
CREATE TABLE findings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id),
    
    -- Taxonomy
    type finding_type NOT NULL,
    severity INTEGER NOT NULL CHECK (severity BETWEEN 0 AND 100),
    status finding_status NOT NULL DEFAULT 'new',
    
    -- Entity Context
    entity_id TEXT, -- e.g., "vendor_uuid" or "position_ticker"
    entity_name TEXT, -- e.g., "AWS", "NVDA"
    
    -- Time Window
    window_start TIMESTAMPTZ,
    window_end TIMESTAMPTZ,
    
    -- Content
    title TEXT NOT NULL, 
    explanation TEXT NOT NULL, 
    evidence JSONB NOT NULL, 
    recommended_action TEXT,
    
    -- Value
    potential_savings_amount NUMERIC(20, 2),
    
    -- Metadata
    hash TEXT, -- For idempotency (hash of type + entity + window)
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(workspace_id, hash)
);

-- Feedback Loop
CREATE TABLE finding_feedback (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    finding_id UUID REFERENCES findings(id),
    user_id UUID REFERENCES users(id),
    is_true_positive BOOLEAN,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Briefs (Exportable Artifacts)
CREATE TABLE briefs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID REFERENCES workspaces(id),
    title TEXT,
    findings_snapshot JSONB,
    public_token TEXT UNIQUE,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
