'use client';

import { useCallback, useSyncExternalStore } from 'react';

export function subscribeToMediaQuery(
  query: string,
  onStoreChange: () => void,
) {
  if (typeof window === 'undefined') {
    return () => {};
  }

  const mql = window.matchMedia(query);
  const handler = () => onStoreChange();
  mql.addEventListener('change', handler);
  return () => mql.removeEventListener('change', handler);
}

export function getMediaQuerySnapshot(query: string): boolean {
  if (typeof window === 'undefined') {
    return false;
  }

  return window.matchMedia(query).matches;
}

/**
 * Subscribe to a CSS media query and return whether it matches.
 *
 * @param query - media query string, e.g. "(min-width: 768px)"
 * @returns `true` when the query matches
 *
 * @example
 * const isDesktop = useMediaQuery('(min-width: 1024px)');
 */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onStoreChange: () => void) => subscribeToMediaQuery(query, onStoreChange),
    [query],
  );
  const getSnapshot = useCallback(() => getMediaQuerySnapshot(query), [query]);

  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}

/** Convenience breakpoint helpers */
export const useIsMobile = () => useMediaQuery('(max-width: 767px)');
export const useIsTablet = () => useMediaQuery('(min-width: 768px) and (max-width: 1023px)');
export const useIsDesktop = () => useMediaQuery('(min-width: 1024px)');
