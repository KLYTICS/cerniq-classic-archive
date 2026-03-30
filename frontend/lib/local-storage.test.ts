import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  getStorageItem,
  removeStorageItem,
  setStorageItem,
} from './local-storage';

describe('local-storage helpers', () => {
  afterEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('reads stored values and falls back when nothing is present', () => {
    localStorage.setItem('desk', JSON.stringify({ theme: 'dark' }));

    expect(getStorageItem('desk', { theme: 'light' })).toEqual({
      theme: 'dark',
    });
    expect(getStorageItem('missing', 'fallback')).toBe('fallback');
  });

  it('returns the fallback when storage is unavailable or JSON is invalid', () => {
    localStorage.setItem('broken', '{bad-json');
    const getItemSpy = vi.spyOn(Storage.prototype, 'getItem');

    expect(getStorageItem('broken', 'fallback')).toBe('fallback');

    getItemSpy.mockImplementation(() => {
      throw new Error('blocked');
    });

    expect(getStorageItem('desk', 'fallback')).toBe('fallback');
  });

  it('writes and removes values while swallowing storage failures', () => {
    setStorageItem('desk', { enabled: true });
    expect(JSON.parse(localStorage.getItem('desk') || 'null')).toEqual({
      enabled: true,
    });

    removeStorageItem('desk');
    expect(localStorage.getItem('desk')).toBeNull();

    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota');
    });
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new Error('blocked');
    });

    expect(() => setStorageItem('desk', { enabled: false })).not.toThrow();
    expect(() => removeStorageItem('desk')).not.toThrow();
  });

  it('returns early when window is unavailable', () => {
    const originalWindow = globalThis.window;

    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: undefined,
    });

    expect(getStorageItem('desk', 'fallback')).toBe('fallback');
    expect(() => setStorageItem('desk', 'value')).not.toThrow();
    expect(() => removeStorageItem('desk')).not.toThrow();

    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: originalWindow,
    });
  });
});
