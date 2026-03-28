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
});
