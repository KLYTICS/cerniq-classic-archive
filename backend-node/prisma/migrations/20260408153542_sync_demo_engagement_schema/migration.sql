-- AlterTable
ALTER TABLE "balance_sheet_items" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "board_reports" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "cecl_vintage_allowances" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "cooperativa_benchmarks" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "data_deletion_requests" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "demo_requests" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "deposit_tiers" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "email_sequences" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "feedback" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "findings" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "institution_alerts" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "interest_rate_scenarios" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "invoices" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "liquidity_positions" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "loan_cohorts" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "loan_segments" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "magic_links" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "market_prices" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "password_reset_tokens" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "pipeline_runs" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "policy_breach_logs" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "prospect_analyses" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "refresh_tokens" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "regulatory_publications" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "report_jobs" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "reports" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "uploads" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "usage_meter_events" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "webhook_subscriptions" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "yield_curves" ALTER COLUMN "updated_at" DROP DEFAULT;

-- CreateTable
CREATE TABLE "demo_seat_engagement_events" (
    "id" TEXT NOT NULL,
    "prospect_institution_id" TEXT NOT NULL,
    "user_id" UUID,
    "event_type" TEXT NOT NULL,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "demo_seat_engagement_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "demo_seat_engagement_events_prospect_institution_id_created_idx" ON "demo_seat_engagement_events"("prospect_institution_id", "created_at");

-- CreateIndex
CREATE INDEX "demo_seat_engagement_events_event_type_idx" ON "demo_seat_engagement_events"("event_type");

-- CreateIndex
CREATE INDEX "demo_seat_engagement_events_user_id_idx" ON "demo_seat_engagement_events"("user_id");

-- AddForeignKey
ALTER TABLE "demo_seat_engagement_events" ADD CONSTRAINT "demo_seat_engagement_events_prospect_institution_id_fkey" FOREIGN KEY ("prospect_institution_id") REFERENCES "prospect_institutions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "gl_balance_snapshots_org_account_period_key" RENAME TO "gl_balance_snapshots_organization_id_account_period_year_pe_key";

-- RenameIndex
ALTER INDEX "gl_balance_snapshots_org_period_idx" RENAME TO "gl_balance_snapshots_organization_id_period_year_period_mon_idx";
