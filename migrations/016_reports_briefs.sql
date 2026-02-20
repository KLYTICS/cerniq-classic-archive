-- Add missing columns for reports and briefs functionality

-- Add title column to reports table
ALTER TABLE reports ADD COLUMN IF NOT EXISTS title VARCHAR(255);

-- Create briefs table for shareable public links
CREATE TABLE IF NOT EXISTS briefs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    report_id UUID REFERENCES reports(id) ON DELETE CASCADE,
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    token VARCHAR(50) UNIQUE NOT NULL,
    title VARCHAR(255),
    summary_data JSONB,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_briefs_token ON briefs(token);
CREATE INDEX IF NOT EXISTS idx_briefs_workspace ON briefs(workspace_id);
CREATE INDEX IF NOT EXISTS idx_briefs_expires ON briefs(expires_at);
