-- Add vendors and invoices tables from parsed data

CREATE TABLE IF NOT EXISTS vendors (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    vendor_name VARCHAR(255) NOT NULL,
    normalized_name VARCHAR(255), -- For fuzzy matching
    vendor_id VARCHAR(100), -- From AP system
    total_spend NUMERIC(15,2),
    invoice_count INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_vendors_workspace ON vendors(workspace_id);
CREATE INDEX idx_vendors_normalized ON vendors(normalized_name);

CREATE TABLE IF NOT EXISTS invoices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    upload_id UUID REFERENCES uploads(id),
    vendor_id UUID REFERENCES vendors(id),
    invoice_number VARCHAR(100),
    invoice_date DATE,
    amount NUMERIC(15,2),
    currency VARCHAR(10) DEFAULT 'USD',
    description TEXT,
    category VARCHAR(100),
    raw_data JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_invoices_workspace ON invoices(workspace_id);
CREATE INDEX idx_invoices_vendor ON invoices(vendor_id);
CREATE INDEX idx_invoices_number ON invoices(invoice_number);
CREATE INDEX idx_invoices_date ON invoices(invoice_date DESC);

CREATE TABLE IF NOT EXISTS contracts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    upload_id UUID REFERENCES uploads(id),
    vendor_id UUID REFERENCES vendors(id),
    contract_name VARCHAR(255),
    start_date DATE,
    end_date DATE,
    renewal_date DATE,
    auto_renew BOOLEAN DEFAULT false,
    annual_value NUMERIC(15,2),
    terms TEXT, -- Extracted terms
    raw_data JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_contracts_workspace ON contracts(workspace_id);
CREATE INDEX idx_contracts_vendor ON contracts(vendor_id);
CREATE INDEX idx_contracts_renewal ON contracts(renewal_date);
