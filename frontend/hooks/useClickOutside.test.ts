import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useClickOutside } from './useClickOutside';

describe('useClickOutside', () => {
  it('returns a ref object', () => {
    const handler = vi.fn();
    const { result } = renderHook(() => useClickOutside(handler));
    expect(result.current).toBeDefined();
    expect(result.current).toHaveProperty('current');
  });

  it('calls handler when clicking outside the element', () => {
    const handler = vi.fn();
    const { result } = renderHook(() => useClickOutside(handler));

    const el = document.createElement('div');
    (result.current as any).current = el;

    act(() => {
      document.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    });
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('does not call handler when clicking inside the element', () => {
    const handler = vi.fn();
    const { result } = renderHook(() => useClickOutside(handler));

    const el = document.createElement('div');
    document.body.appendChild(el);
    (result.current as any).current = el;

    act(() => {
      el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    });
    expect(handler).not.toHaveBeenCalled();

    document.body.removeChild(el);
  });
});
