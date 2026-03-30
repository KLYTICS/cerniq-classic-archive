import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import {
  createLocalStorageSubscription,
  getLocalStorageServerSnapshot,
  notifyLocalStorageChange,
  readStoredValue,
  readStoredValueRaw,
  useLocalStorage,
} from './useLocalStorage';

function createStorageEvent(key: string) {
  const event = new Event('storage') as StorageEvent;
  Object.defineProperty(event, 'key', { value: key });
  Object.defineProperty(event, 'storageArea', { value: window.localStorage });
  return event;
}

describe('useLocalStorage', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('returns initial value when nothing is stored', () => {
    const { result } = renderHook(() => useLocalStorage('key', 'default'));
    expect(result.current[0]).toBe('default');
  });

  it('reads existing value from localStorage on mount', () => {
    localStorage.setItem('key', JSON.stringify('stored'));
    const { result } = renderHook(() => useLocalStorage('key', 'default'));
    // After effect runs
    expect(result.current[0]).toBe('stored');
  });

  it('writes to localStorage when setValue is called', () => {
    const { result } = renderHook(() => useLocalStorage('key', 'initial'));

    act(() => {
      result.current[1]('updated');
    });

    expect(result.current[0]).toBe('updated');
    expect(JSON.parse(localStorage.getItem('key')!)).toBe('updated');
  });

  it('supports functional updater', () => {
    const { result } = renderHook(() => useLocalStorage('count', 0));

    act(() => {
      result.current[1]((prev: number) => prev + 1);
    });

    expect(result.current[0]).toBe(1);
    expect(JSON.parse(localStorage.getItem('count')!)).toBe(1);
  });

  it('removes value from localStorage', () => {
    localStorage.setItem('key', JSON.stringify('value'));
    const { result } = renderHook(() => useLocalStorage('key', 'default'));

    act(() => {
      result.current[2](); // removeValue
    });

    expect(result.current[0]).toBe('default');
    expect(localStorage.getItem('key')).toBeNull();
  });

  it('handles complex objects', () => {
    const obj = { name: 'Cerniq', version: 2 };
    const { result } = renderHook(() => useLocalStorage('config', obj));

    const updated = { name: 'Cerniq', version: 3 };
    act(() => {
      result.current[1](updated);
    });

    expect(result.current[0]).toEqual(updated);
    expect(JSON.parse(localStorage.getItem('config')!)).toEqual(updated);
  });

  it('updates when the browser storage event changes the same key', () => {
    localStorage.setItem('desk', JSON.stringify('initial'));
    const { result } = renderHook(() => useLocalStorage('desk', 'default'));

    act(() => {
      localStorage.setItem('desk', JSON.stringify('updated'));
      window.dispatchEvent(createStorageEvent('desk'));
    });

    expect(result.current[0]).toBe('updated');
  });

  it('updates when the app dispatches a matching custom local-storage event', () => {
    const { result } = renderHook(() => useLocalStorage('desk', 'default'));

    act(() => {
      localStorage.setItem('desk', JSON.stringify('coordinated'));
      window.dispatchEvent(
        new CustomEvent('cerniq:local-storage-change', {
          detail: { key: 'desk' },
        }),
      );
    });

    expect(result.current[0]).toBe('coordinated');
  });

  it('updates when the app dispatches a custom event without a key detail', () => {
    const { result } = renderHook(() => useLocalStorage('desk', 'default'));

    act(() => {
      localStorage.setItem('desk', JSON.stringify('broadcast'));
      window.dispatchEvent(new CustomEvent('cerniq:local-storage-change'));
    });

    expect(result.current[0]).toBe('broadcast');
  });

  it('ignores storage updates for different keys', () => {
    const { result } = renderHook(() => useLocalStorage('desk', 'default'));

    act(() => {
      localStorage.setItem('other', JSON.stringify('changed'));
      window.dispatchEvent(createStorageEvent('other'));
    });

    expect(result.current[0]).toBe('default');
  });

  it('ignores storage updates from a different storage area', () => {
    const { result } = renderHook(() => useLocalStorage('desk', 'default'));
    const event = new Event('storage') as StorageEvent;
    Object.defineProperty(event, 'key', { value: 'desk' });
    Object.defineProperty(event, 'storageArea', { value: sessionStorage });

    act(() => {
      localStorage.setItem('desk', JSON.stringify('changed'));
      window.dispatchEvent(event);
    });

    expect(result.current[0]).toBe('default');
  });

  it('falls back to the initial value when stored JSON is invalid', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    localStorage.setItem('broken', '{not-json');

    const { result } = renderHook(() => useLocalStorage('broken', 'fallback'));

    expect(result.current[0]).toBe('fallback');
    expect(warnSpy).toHaveBeenCalled();
  });

  it('handles localStorage errors gracefully', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });

    const { result } = renderHook(() => useLocalStorage('key', 'default'));

    act(() => {
      result.current[1]('too-large');
    });

    expect(warnSpy).toHaveBeenCalled();
  });

  it('handles localStorage read errors gracefully', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('read failed');
    });

    const { result } = renderHook(() => useLocalStorage('key', 'default'));

    expect(result.current[0]).toBe('default');
    expect(warnSpy).toHaveBeenCalled();
  });

  it('covers direct helper read failures in readStoredValue', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('read failed');
    });

    expect(readStoredValue('desk', 'fallback')).toBe('fallback');
    expect(warnSpy).toHaveBeenCalled();
  });

  it('handles localStorage remove errors gracefully', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new Error('remove failed');
    });

    const { result } = renderHook(() => useLocalStorage('key', 'default'));

    act(() => {
      result.current[2]();
    });

    expect(warnSpy).toHaveBeenCalled();
  });

  it('exposes helper fallbacks when browser storage is unavailable', () => {
    const originalWindow = globalThis.window;
    Reflect.deleteProperty(globalThis, 'window');

    try {
      expect(readStoredValue('desk', 'fallback')).toBe('fallback');
      expect(readStoredValueRaw('desk')).toBeNull();
      expect(() => notifyLocalStorageChange('desk')).not.toThrow();
    } finally {
      Object.defineProperty(globalThis, 'window', {
        configurable: true,
        value: originalWindow,
      });
    }
  });

  it('parses helper reads when valid JSON is present', () => {
    localStorage.setItem('desk', JSON.stringify({ live: true }));

    expect(readStoredValue('desk', { live: false })).toEqual({ live: true });
    expect(readStoredValueRaw('desk')).toBe('{"live":true}');
  });
  it('returns a noop unsubscribe and null server snapshot without window access', () => {
    const originalWindow = globalThis.window;
    Reflect.deleteProperty(globalThis, 'window');

    try {
      const unsubscribe = createLocalStorageSubscription('desk', vi.fn());
      expect(getLocalStorageServerSnapshot()).toBeNull();
      expect(() => unsubscribe()).not.toThrow();
    } finally {
      Object.defineProperty(globalThis, 'window', {
        configurable: true,
        value: originalWindow,
      });
    }
  });
});
