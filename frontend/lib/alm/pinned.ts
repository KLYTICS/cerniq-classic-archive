/**
 * Pinned ALM modules — shared external store.
 *
 * Tracks a user-curated list of high-frequency modules so we can surface
 * them at the top of the sidebar tree, on the ALM landing page, and in
 * any future "favorites" workflow without duplicating persistence logic.
 *
 * Persistence: localStorage under `cerniq.alm.pinned.v1`.
 * Cross-tab sync: native `storage` event.
 * Same-tab sync: custom `cerniq:pinned-change` event.
 * SSR: returns a stable frozen empty array when `window` is undefined.
 */

import { useSyncExternalStore } from 'react';

import { MODULES_BY_SLUG, type AlmModuleSlug } from '@/lib/alm/registry';

const PINNED_STORAGE_KEY = 'cerniq.alm.pinned.v1';
const PINNED_EVENT = 'cerniq:pinned-change';
export const PINNED_MAX = 8;

const EMPTY_PINNED: readonly AlmModuleSlug[] = Object.freeze([]);

let pinnedCache: readonly AlmModuleSlug[] = EMPTY_PINNED;
let initializedFromStorage = false;

function isKnownSlug(value: string): value is AlmModuleSlug {
  return MODULES_BY_SLUG[value] != null;
}

export function loadPinned(): readonly AlmModuleSlug[] {
  if (typeof window === 'undefined') return EMPTY_PINNED;
  try {
    const raw = window.localStorage.getItem(PINNED_STORAGE_KEY);
    if (!raw) return EMPTY_PINNED;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return EMPTY_PINNED;
    const slugs = parsed
      .filter((value): value is string => typeof value === 'string')
      .filter(isKnownSlug)
      .slice(0, PINNED_MAX);
    return slugs.length === 0 ? EMPTY_PINNED : Object.freeze([...new Set(slugs)]);
  } catch {
    return EMPTY_PINNED;
  }
}

function savePinned(slugs: readonly AlmModuleSlug[]): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(PINNED_STORAGE_KEY, JSON.stringify(slugs.slice(0, PINNED_MAX)));
  } catch {
    // Storage blocked — silently ignore; the pins just will not persist.
  }
}

function broadcastPinnedChange(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event(PINNED_EVENT));
}

export function pinModule(slug: AlmModuleSlug): void {
  if (typeof window === 'undefined') return;
  if (!initializedFromStorage) {
    pinnedCache = loadPinned();
    initializedFromStorage = true;
  }
  if (pinnedCache.includes(slug)) return;
  const next = Object.freeze([slug, ...pinnedCache].slice(0, PINNED_MAX));
  pinnedCache = next;
  savePinned(next);
  broadcastPinnedChange();
}

export function unpinModule(slug: AlmModuleSlug): void {
  if (typeof window === 'undefined') return;
  if (!initializedFromStorage) {
    pinnedCache = loadPinned();
    initializedFromStorage = true;
  }
  if (!pinnedCache.includes(slug)) return;
  const next = Object.freeze(pinnedCache.filter((value) => value !== slug));
  pinnedCache = next.length === 0 ? EMPTY_PINNED : next;
  savePinned(pinnedCache);
  broadcastPinnedChange();
}

export function togglePinned(slug: AlmModuleSlug): void {
  if (getPinnedSnapshot().includes(slug)) {
    unpinModule(slug);
    return;
  }
  pinModule(slug);
}

export function clearPinned(): void {
  if (typeof window === 'undefined') return;
  pinnedCache = EMPTY_PINNED;
  savePinned(EMPTY_PINNED);
  initializedFromStorage = true;
  broadcastPinnedChange();
}

export function subscribePinned(onStoreChange: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  const handle = (e: Event) => {
    if (e.type === 'storage') {
      const storageEvent = e as StorageEvent;
      if (storageEvent.key !== PINNED_STORAGE_KEY) return;
      pinnedCache = loadPinned();
    }
    onStoreChange();
  };
  window.addEventListener(PINNED_EVENT, handle);
  window.addEventListener('storage', handle);
  return () => {
    window.removeEventListener(PINNED_EVENT, handle);
    window.removeEventListener('storage', handle);
  };
}

export function getPinnedSnapshot(): readonly AlmModuleSlug[] {
  if (typeof window === 'undefined') return EMPTY_PINNED;
  if (!initializedFromStorage) {
    pinnedCache = loadPinned();
    initializedFromStorage = true;
  }
  return pinnedCache;
}

export function getPinnedServerSnapshot(): readonly AlmModuleSlug[] {
  return EMPTY_PINNED;
}

export function usePinned(): readonly AlmModuleSlug[] {
  return useSyncExternalStore(subscribePinned, getPinnedSnapshot, getPinnedServerSnapshot);
}

export function __resetPinnedCacheForTesting(): void {
  pinnedCache = EMPTY_PINNED;
  initializedFromStorage = false;
}
