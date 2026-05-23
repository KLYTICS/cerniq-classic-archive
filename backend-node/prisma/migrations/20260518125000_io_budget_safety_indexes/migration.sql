-- Reduce repeated disk reads from idle cron/dashboard paths on small Supabase
-- compute tiers. All indexes are additive and match existing Prisma query
-- shapes; no table rewrites or data changes.

CREATE INDEX IF NOT EXISTS "prospect_institutions_demo_user_expires_converted_idx"
  ON "prospect_institutions"("demo_user_id", "demo_expires_at", "demo_converted_at");

CREATE INDEX IF NOT EXISTS "prospect_institutions_demo_provisioned_at_idx"
  ON "prospect_institutions"("demo_provisioned_at");

CREATE INDEX IF NOT EXISTS "analysis_runs_created_at_idx"
  ON "analysis_runs"("created_at");

CREATE INDEX IF NOT EXISTS "report_jobs_status_created_at_idx"
  ON "report_jobs"("status", "created_at");

CREATE INDEX IF NOT EXISTS "report_jobs_status_processing_started_at_idx"
  ON "report_jobs"("status", "processing_started_at");

CREATE INDEX IF NOT EXISTS "email_sequences_cancelled_sent_at_scheduled_at_idx"
  ON "email_sequences"("cancelled", "sent_at", "scheduled_at");

CREATE INDEX IF NOT EXISTS "audit_logs_created_at_idx"
  ON "audit_logs"("created_at");

