import { isGtmSchedulerDisabled } from './gtm-scheduler-flag.util';

describe('gtm-scheduler-flag.util', () => {
  const original = process.env.GTM_SCHEDULER_DISABLED;

  afterEach(() => {
    if (original === undefined) {
      delete process.env.GTM_SCHEDULER_DISABLED;
    } else {
      process.env.GTM_SCHEDULER_DISABLED = original;
    }
  });

  it('defaults to enabled', () => {
    delete process.env.GTM_SCHEDULER_DISABLED;
    expect(isGtmSchedulerDisabled()).toBe(false);
  });

  it('respects GTM_SCHEDULER_DISABLED=true', () => {
    process.env.GTM_SCHEDULER_DISABLED = 'true';
    expect(isGtmSchedulerDisabled()).toBe(true);
  });
});
