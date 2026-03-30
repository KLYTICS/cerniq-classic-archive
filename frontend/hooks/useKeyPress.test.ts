import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useKeyPress } from './useKeyPress';

describe('useKeyPress', () => {
  it('calls handler when the target key is pressed', () => {
    const handler = vi.fn();
    renderHook(() => useKeyPress('Escape', handler));

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('does not call handler for a different key', () => {
    const handler = vi.fn();
    renderHook(() => useKeyPress('Escape', handler));

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    });
    expect(handler).not.toHaveBeenCalled();
  });

  it('requires ctrlOrMeta modifier when specified', () => {
    const handler = vi.fn();
    renderHook(() => useKeyPress('k', handler, { ctrlOrMeta: true }));

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k' }));
    });
    expect(handler).not.toHaveBeenCalled();

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true }));
    });
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('does not fire when disabled', () => {
    const handler = vi.fn();
    renderHook(() => useKeyPress('Escape', handler, { disabled: true }));

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });
    expect(handler).not.toHaveBeenCalled();
  });

  it('supports shift and alt modifiers and prevents default when requested', () => {
    const handler = vi.fn();
    const event = new KeyboardEvent('keydown', {
      key: 'K',
      shiftKey: true,
      altKey: true,
      cancelable: true,
    });

    renderHook(() => useKeyPress('K', handler, { shift: true, alt: true, preventDefault: true }));

    act(() => {
      window.dispatchEvent(event);
    });

    expect(handler).toHaveBeenCalledTimes(1);
    expect(event.defaultPrevented).toBe(true);
  });

  it('does not fire when required shift or alt modifiers are missing', () => {
    const shiftHandler = vi.fn();
    const altHandler = vi.fn();

    renderHook(() => useKeyPress('K', shiftHandler, { shift: true }));
    renderHook(() => useKeyPress('K', altHandler, { alt: true }));

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'K' }));
    });

    expect(shiftHandler).not.toHaveBeenCalled();
    expect(altHandler).not.toHaveBeenCalled();
  });

  it('stops listening after unmount', () => {
    const handler = vi.fn();
    const { unmount } = renderHook(() => useKeyPress('Escape', handler));

    unmount();

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });

    expect(handler).not.toHaveBeenCalled();
  });
});
