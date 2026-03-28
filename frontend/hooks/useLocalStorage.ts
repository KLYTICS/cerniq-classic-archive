'use client';

import { useCallback, useSyncExternalStore } from 'react';

const LOCAL_STORAGE_CHANGE_EVENT = 'cerniq:local-storage-change';

function readStoredValue<T>(key: string, initialValue: T): T {
  if (typeof window === 'undefined') {
    return initialValue;
  }

  try {
    const item = window.localStorage.getItem(key);
    return item !== null ? (JSON.parse(item) as T) : initialValue;
  } catch (error) {
    console.warn(`useLocalStorage: error reading key "${key}"`, error);
    return initialValue;
  }
}

function notifyLocalStorageChange(key: string) {
  if (typeof window === 'undefined') {
    return;
  }

  window.dispatchEvent(
    new CustomEvent<{ key: string }>(LOCAL_STORAGE_CHANGE_EVENT, {
      detail: { key },
    }),
  );
}

function readStoredValueRaw(key: string): string | null {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    return window.localStorage.getItem(key);
  } catch (error) {
    console.warn(`useLocalStorage: error reading key "${key}"`, error);
    return null;
  }
}

/**
 * Type-safe localStorage hook with SSR support.
 *
 * @param key - localStorage key
 * @param initialValue - fallback when no stored value exists
 */
export function useLocalStorage<T>(key: string, initialValue: T) {
  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      if (typeof window === 'undefined') {
        return () => {};
      }

      const handleStorage = (event: StorageEvent) => {
        if (event.storageArea === window.localStorage && event.key === key) {
          onStoreChange();
        }
      };

      const handleLocalChange = (event: Event) => {
        const customEvent = event as CustomEvent<{ key?: string }>;
        if (!customEvent.detail?.key || customEvent.detail.key === key) {
          onStoreChange();
        }
      };

      window.addEventListener('storage', handleStorage);
      window.addEventListener(LOCAL_STORAGE_CHANGE_EVENT, handleLocalChange);

      return () => {
        window.removeEventListener('storage', handleStorage);
        window.removeEventListener(LOCAL_STORAGE_CHANGE_EVENT, handleLocalChange);
      };
    },
    [key],
  );

  const rawValue = useSyncExternalStore(
    subscribe,
    () => readStoredValueRaw(key),
    () => null,
  );
  const storedValue =
    rawValue === null
      ? initialValue
      : (() => {
          try {
            return JSON.parse(rawValue) as T;
          } catch (error) {
            console.warn(`useLocalStorage: error reading key "${key}"`, error);
            return initialValue;
          }
        })();

  const setValue = useCallback(
    (value: T | ((prev: T) => T)) => {
      try {
        const valueToStore =
          typeof value === 'function'
            ? (value as (prev: T) => T)(readStoredValue(key, initialValue))
            : value;
        window.localStorage.setItem(key, JSON.stringify(valueToStore));
        notifyLocalStorageChange(key);
      } catch (error) {
        console.warn(`useLocalStorage: error setting key "${key}"`, error);
      }
    },
    [initialValue, key],
  );

  const removeValue = useCallback(() => {
    try {
      window.localStorage.removeItem(key);
      notifyLocalStorageChange(key);
    } catch (error) {
      console.warn(`useLocalStorage: error removing key "${key}"`, error);
    }
  }, [key]);

  return [storedValue, setValue, removeValue] as const;
}
