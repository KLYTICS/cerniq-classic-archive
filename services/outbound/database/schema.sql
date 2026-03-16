-- CERNIQ Outbound Engine — CRM Schema
-- Tracks leads, outreach history, and pipeline stages.

CREATE TABLE IF NOT EXISTS leads (
    id              SERIAL PRIMARY KEY,
    institution     TEXT NOT NULL,
    institution_type TEXT NOT NULL DEFAULT 'cooperativa',
    contact_name    TEXT,
    role            TEXT DEFAULT 'CFO',
    email           TEXT,
    phone           TEXT,
    linkedin        TEXT,
    location        TEXT,
    region          TEXT,
    estimated_assets BIGINT,
    stage           TEXT NOT NULL DEFAULT 'new',
    priority        TEXT DEFAULT 'medium',
    source          TEXT DEFAULT 'seed',
    language        TEXT DEFAULT 'es',
    last_contact    TIMESTAMP,
    next_action     TIMESTAMP,
    notes           TEXT,
    created_at      TIMESTAMP DEFAULT NOW(),
    updated_at      TIMESTAMP DEFAULT NOW()
);

-- Outreach history log
CREATE TABLE IF NOT EXISTS outreach_log (
    id          SERIAL PRIMARY KEY,
    lead_id     INTEGER REFERENCES leads(id),
    channel     TEXT NOT NULL,           -- email, linkedin, phone
    message_type TEXT NOT NULL,          -- cold, followup_1, followup_2, final
    subject     TEXT,
    body        TEXT,
    sent_at     TIMESTAMP DEFAULT NOW(),
    status      TEXT DEFAULT 'sent',     -- sent, delivered, opened, replied, bounced
    metadata    JSONB
);

-- Pipeline stages reference
-- new -> contacted -> replied -> demo_booked -> proposal -> negotiating -> closed_won -> closed_lost

CREATE INDEX idx_leads_stage ON leads(stage);
CREATE INDEX idx_leads_priority ON leads(priority);
CREATE INDEX idx_leads_next_action ON leads(next_action);
CREATE INDEX idx_outreach_lead_id ON outreach_log(lead_id);
CREATE INDEX idx_outreach_sent_at ON outreach_log(sent_at);
