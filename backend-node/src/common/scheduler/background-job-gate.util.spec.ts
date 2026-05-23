import { areBackgroundJobsDisabled } from './background-job-gate.util';

describe('areBackgroundJobsDisabled', () => {
  it.each(['true', '1', 'yes', 'on', 'TRUE', ' Yes '])(
    'treats %p as disabled',
    (value) => {
      expect(
        areBackgroundJobsDisabled({ BACKGROUND_JOBS_DISABLED: value } as any),
      ).toBe(true);
    },
  );

  it.each(['false', '0', 'no', 'off', '', undefined])(
    'treats %p as enabled',
    (value) => {
      expect(
        areBackgroundJobsDisabled({
          BACKGROUND_JOBS_DISABLED: value,
        } as any),
      ).toBe(false);
    },
  );
});
