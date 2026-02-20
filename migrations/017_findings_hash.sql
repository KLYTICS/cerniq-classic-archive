-- Add hash column to findings table for deduplication

ALTER TABLE findings ADD COLUMN IF NOT EXISTS hash VARCHAR(64);
CREATE INDEX IF NOT EXISTS idx_findings_hash ON findings(hash);
CREATE INDEX IF NOT EXISTS idx_findings_workspace_hash ON findings(workspace_id, hash);
