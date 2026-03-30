import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useCopyToClipboard } from './useCopyToClipboard';

describe('useCopyToClipboard', () => {
  beforeEach(() => {
    vi.useRealTimers();
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('starts with copied = false', () => {
    const { result } = renderHook(() => useCopyToClipboard());
    expect(result.current.copied).toBe(false);
  });

  it('sets copied to true after successful copy', async () => {
    const { result } = renderHook(() => useCopyToClipboard(0));

    await act(async () => {
      await result.current.copy('hello');
    });

    expect(result.current.copied).toBe(true);
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('hello');
  });

  it('reset sets copied back to false', async () => {
    const { result } = renderHook(() => useCopyToClipboard(0));

    await act(async () => {
      await result.current.copy('text');
    });
    expect(result.current.copied).toBe(true);

    act(() => {
      result.current.reset();
    });
    expect(result.current.copied).toBe(false);
  });

  it('auto-resets copied after the configured delay', async () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useCopyToClipboard(25));

    await act(async () => {
      await result.current.copy('desk-note');
    });
    expect(result.current.copied).toBe(true);

    act(() => {
      vi.advanceTimersByTime(25);
    });
    expect(result.current.copied).toBe(false);
  });

  it('warns when the Clipboard API is unavailable', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: undefined,
    });

    const { result } = renderHook(() => useCopyToClipboard());

    await act(async () => {
      await result.current.copy('blocked');
    });

    expect(warnSpy).toHaveBeenCalledWith(
      'useCopyToClipboard: Clipboard API not available',
    );
    expect(result.current.copied).toBe(false);
  });

  it('warns and keeps copied false when writeText fails', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockRejectedValue(new Error('clipboard denied')),
      },
    });

    const { result } = renderHook(() => useCopyToClipboard());

    await act(async () => {
      await result.current.copy('denied');
    });

    expect(warnSpy).toHaveBeenCalledWith(
      'useCopyToClipboard: copy failed',
      expect.any(Error),
    );
    expect(result.current.copied).toBe(false);
  });
});
