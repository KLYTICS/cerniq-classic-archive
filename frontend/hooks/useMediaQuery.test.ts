import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import {
  getMediaQuerySnapshot,
  subscribeToMediaQuery,
  useIsDesktop,
  useIsMobile,
  useIsTablet,
  useMediaQuery,
} from './useMediaQuery';

describe('useMediaQuery', () => {
  let listeners: Array<(event: MediaQueryListEvent) => void>;
  let currentMatches: boolean;
  let removeEventListenerMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    listeners = [];
    currentMatches = false;
    removeEventListenerMock = vi.fn();
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: currentMatches,
        media: query,
        addEventListener: vi.fn(
          (_event: 'change', cb: (event: MediaQueryListEvent) => void) => {
            listeners.push(cb);
          },
        ),
        removeEventListener: removeEventListenerMock,
        onchange: null,
      })),
    });
  });

  it('returns false initially when media query does not match', () => {
    currentMatches = false;
    const { result } = renderHook(() => useMediaQuery('(min-width: 1024px)'));
    expect(result.current).toBe(false);
  });

  it('returns true initially when media query matches', () => {
    currentMatches = true;
    const { result } = renderHook(() => useMediaQuery('(min-width: 1024px)'));
    expect(result.current).toBe(true);
  });

  it('updates when the media query changes', () => {
    currentMatches = false;
    const { result } = renderHook(() => useMediaQuery('(min-width: 1024px)'));
    expect(result.current).toBe(false);

    act(() => {
      currentMatches = true;
      listeners.forEach((cb) => cb({ matches: true } as MediaQueryListEvent));
    });
    expect(result.current).toBe(true);
  });

  it('removes the media-query listener on unmount', () => {
    const { unmount } = renderHook(() => useMediaQuery('(min-width: 1024px)'));

    unmount();

    expect(removeEventListenerMock).toHaveBeenCalledWith(
      'change',
      expect.any(Function),
    );
  });

  it('exposes the convenience breakpoint hooks', () => {
    currentMatches = true;

    const { result: mobile } = renderHook(() => useIsMobile());
    const { result: tablet } = renderHook(() => useIsTablet());
    const { result: desktop } = renderHook(() => useIsDesktop());

    expect(window.matchMedia).toHaveBeenCalledWith('(max-width: 767px)');
    expect(window.matchMedia).toHaveBeenCalledWith(
      '(min-width: 768px) and (max-width: 1023px)',
    );
    expect(window.matchMedia).toHaveBeenCalledWith('(min-width: 1024px)');
    expect(mobile.current).toBe(true);
    expect(tablet.current).toBe(true);
    expect(desktop.current).toBe(true);
  });

  it('returns safe defaults when window is unavailable', () => {
    const originalWindow = globalThis.window;

    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: undefined,
    });

    expect(getMediaQuerySnapshot('(min-width: 1024px)')).toBe(false);
    expect(subscribeToMediaQuery('(min-width: 1024px)', vi.fn())()).toBeUndefined();

    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: originalWindow,
    });
  });
});
