import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useMediaQuery } from './useMediaQuery';

describe('useMediaQuery', () => {
  let listeners: Array<(e: { matches: boolean }) => void>;
  let currentMatches: boolean;

  beforeEach(() => {
    listeners = [];
    currentMatches = false;
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: currentMatches,
        media: query,
        addEventListener: vi.fn((_event: string, cb: any) => listeners.push(cb)),
        removeEventListener: vi.fn(),
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
      listeners.forEach((cb) => cb({ matches: true }));
    });
    expect(result.current).toBe(true);
  });
});
