/**
 * Tests for lib/alm/pinned — the shared pinned-modules external store.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  __resetPinnedCacheForTesting,
  clearPinned,
  getPinnedServerSnapshot,
  getPinnedSnapshot,
  loadPinned,
  pinModule,
  PINNED_MAX,
  subscribePinned,
  togglePinned,
  unpinModule,
} from './pinned';

const KEY = 'cerniq.alm.pinned.v1';

beforeEach(() => {
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    // ignore
  }
  __resetPinnedCacheForTesting();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('loadPinned', () => {
  it('returns empty for uninitialized localStorage', () => {
    expect(loadPinned()).toEqual([]);
  });

  it('reads a valid array of slugs', () => {
    window.localStorage.setItem(KEY, JSON.stringify(['var', 'cecl']));
    expect(loadPinned()).toEqual(['var', 'cecl']);
  });

  it('filters non-string and unknown entries', () => {
    window.localStorage.setItem(KEY, JSON.stringify(['var', 42, 'not-real', 'cecl']));
    expect(loadPinned()).toEqual(['var', 'cecl']);
  });

  it('deduplicates stored slugs while preserving first-seen order', () => {
    window.localStorage.setItem(KEY, JSON.stringify(['var', 'cecl', 'var']));
    expect(loadPinned()).toEqual(['var', 'cecl']);
  });

  it('caps at PINNED_MAX entries', () => {
    const many = ['var', 'cecl', 'liquidity', 'stress-v2', 'nim-attribution', 'alerts', 'overview', 'yield-curve', 'ftp', 'monte-carlo'];
    window.localStorage.setItem(KEY, JSON.stringify(many));
    expect(loadPinned()).toHaveLength(PINNED_MAX);
  });

  it('returns empty on corrupt JSON', () => {
    window.localStorage.setItem(KEY, 'not valid json');
    expect(loadPinned()).toEqual([]);
  });

  it('returns a frozen array', () => {
    window.localStorage.setItem(KEY, JSON.stringify(['var']));
    expect(Object.isFrozen(loadPinned())).toBe(true);
  });
});

describe('pinModule', () => {
  it('adds a module to the front', () => {
    pinModule('var');
    expect(getPinnedSnapshot()).toEqual(['var']);
  });

  it('is a no-op when the module is already pinned', () => {
    pinModule('var');
    const before = getPinnedSnapshot();
    pinModule('var');
    expect(getPinnedSnapshot()).toBe(before);
  });

  it('caps at PINNED_MAX', () => {
    const slugs = ['var', 'cecl', 'liquidity', 'stress-v2', 'nim-attribution', 'alerts', 'overview', 'yield-curve', 'ftp', 'monte-carlo'] as const;
    for (const slug of slugs) pinModule(slug);
    expect(getPinnedSnapshot()).toHaveLength(PINNED_MAX);
  });

  it('persists the new list to localStorage', () => {
    pinModule('var');
    pinModule('cecl');
    expect(JSON.parse(window.localStorage.getItem(KEY)!)).toEqual(['cecl', 'var']);
  });

  it('dispatches the same-tab change event', () => {
    const listener = vi.fn();
    window.addEventListener('cerniq:pinned-change', listener);
    pinModule('var');
    expect(listener).toHaveBeenCalledTimes(1);
    window.removeEventListener('cerniq:pinned-change', listener);
  });
});

describe('unpinModule and togglePinned', () => {
  it('removes a pinned module', () => {
    pinModule('var');
    pinModule('cecl');
    unpinModule('var');
    expect(getPinnedSnapshot()).toEqual(['cecl']);
  });

  it('togglePinned pins an unpinned module', () => {
    togglePinned('var');
    expect(getPinnedSnapshot()).toEqual(['var']);
  });

  it('togglePinned unpins a pinned module', () => {
    pinModule('var');
    togglePinned('var');
    expect(getPinnedSnapshot()).toEqual([]);
  });

  it('clearPinned empties the store', () => {
    pinModule('var');
    clearPinned();
    expect(getPinnedSnapshot()).toEqual([]);
  });
});

describe('snapshots', () => {
  it('returns a stable reference between reads', () => {
    pinModule('var');
    const a = getPinnedSnapshot();
    const b = getPinnedSnapshot();
    expect(a).toBe(b);
  });

  it('returns a stable empty server snapshot', () => {
    expect(getPinnedServerSnapshot()).toBe(getPinnedServerSnapshot());
  });
});

describe('subscribePinned', () => {
  it('fires when pinModule runs', () => {
    const listener = vi.fn();
    const unsubscribe = subscribePinned(listener);
    pinModule('var');
    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
  });

  it('fires on storage events for our key', () => {
    const listener = vi.fn();
    const unsubscribe = subscribePinned(listener);
    window.dispatchEvent(new StorageEvent('storage', { key: KEY, newValue: '["var"]' }));
    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
  });

  it('ignores storage events for other keys', () => {
    const listener = vi.fn();
    const unsubscribe = subscribePinned(listener);
    window.dispatchEvent(new StorageEvent('storage', { key: 'something-else', newValue: '[]' }));
    expect(listener).not.toHaveBeenCalled();
    unsubscribe();
  });
});
