'use client';

import { useState, useEffect } from 'react';

/**
 * Debounce a rapidly-changing value.
 *
 * @param value - the value to debounce
 * @param delay - debounce delay in milliseconds (default 300)
 * @returns the debounced value
 *
 * @example
 * const [search, setSearch] = useState('');
 * const debouncedSearch = useDebounce(search, 400);
 */
export function useDebounce<T>(value: T, delay = 300): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
}
