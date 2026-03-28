'use client';

import { useEffect, useRef, type RefObject } from 'react';

/**
 * Invoke a callback when a click/touch occurs outside the referenced element.
 * Useful for closing modals, dropdowns, and popovers.
 *
 * @param handler - callback fired on outside click
 * @returns ref to attach to the target element
 *
 * @example
 * const ref = useClickOutside(() => setOpen(false));
 * return <div ref={ref}>...</div>;
 */
export function useClickOutside<T extends HTMLElement = HTMLDivElement>(
  handler: () => void,
): RefObject<T | null> {
  const ref = useRef<T | null>(null);

  useEffect(() => {
    const listener = (event: MouseEvent | TouchEvent) => {
      const el = ref.current;
      if (!el || el.contains(event.target as Node)) return;
      handler();
    };

    document.addEventListener('mousedown', listener);
    document.addEventListener('touchstart', listener);

    return () => {
      document.removeEventListener('mousedown', listener);
      document.removeEventListener('touchstart', listener);
    };
  }, [handler]);

  return ref;
}
