const TRUTHY = new Set(['true', '1', 'yes']);

export function isGtmSchedulerDisabled(): boolean {
  const raw = process.env.GTM_SCHEDULER_DISABLED?.trim().toLowerCase();
  return raw ? TRUTHY.has(raw) : false;
}
