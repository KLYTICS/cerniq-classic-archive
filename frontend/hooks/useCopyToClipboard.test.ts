import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useCopyToClipboard } from './useCopyToClipboard';

describe('useCopyToClipboard', () => {
  beforeEach(() => {
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    });
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
});
