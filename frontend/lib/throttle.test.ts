import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { throttle } from './throttle';

describe('throttle', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-30T12:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('runs immediately on the first call and schedules a trailing call inside the interval', () => {
    const fn = vi.fn();
    const throttled = throttle(fn, 100);

    throttled('first');
    throttled('second');

    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith('first');

    vi.advanceTimersByTime(100);

    expect(fn).toHaveBeenCalledTimes(2);
    expect(fn).toHaveBeenLastCalledWith('second');
  });

  it('clears a pending timer when a fresh immediate execution becomes available', () => {
    const fn = vi.fn();
    const clearTimeoutSpy = vi.spyOn(global, 'clearTimeout');
    const throttled = throttle(fn, 100);

    throttled('first');
    throttled('second');

    vi.setSystemTime(new Date('2026-03-30T12:00:00.250Z'));
    throttled('third');

    expect(fn).toHaveBeenLastCalledWith('third');
    expect(clearTimeoutSpy).toHaveBeenCalled();
  });

  it('does not create duplicate trailing timers while one is already pending', () => {
    const fn = vi.fn();
    const setTimeoutSpy = vi.spyOn(global, 'setTimeout');
    const throttled = throttle(fn, 100);

    throttled('first');
    throttled('second');
    throttled('third');

    expect(setTimeoutSpy).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(100);

    expect(fn).toHaveBeenCalledTimes(2);
    expect(fn).toHaveBeenLastCalledWith('second');
  });
});
