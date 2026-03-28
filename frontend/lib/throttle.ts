/**
 * Throttle utility — ensures a function runs at most once per interval.
 * Useful for scroll and resize handlers.
 */
export function throttle<T extends (...args: any[]) => void>(
  fn: T,
  intervalMs: number,
): T {
  let lastTime = 0;
  let timer: ReturnType<typeof setTimeout> | null = null;

  return ((...args: any[]) => {
    const now = Date.now();
    const remaining = intervalMs - (now - lastTime);

    if (remaining <= 0) {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      lastTime = now;
      fn(...args);
    } else if (!timer) {
      timer = setTimeout(() => {
        lastTime = Date.now();
        timer = null;
        fn(...args);
      }, remaining);
    }
  }) as T;
}
