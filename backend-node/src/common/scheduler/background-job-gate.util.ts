// Global kill switch for cron-driven background work.
//
// Micro Supabase projects have a small sustained Disk I/O baseline. For
// non-customer-facing deployments, cron jobs should be opt-in so idle apps do
// not burn daily I/O budget by polling queues, dashboards, and stale records.

export function areBackgroundJobsDisabled(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  const raw = (env.BACKGROUND_JOBS_DISABLED ?? '').trim().toLowerCase();
  return raw === 'true' || raw === '1' || raw === 'yes' || raw === 'on';
}
