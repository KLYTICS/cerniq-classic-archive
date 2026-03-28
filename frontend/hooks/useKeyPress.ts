'use client';

import { useEffect, useCallback } from 'react';

interface KeyPressOptions {
  /** If true, event.preventDefault() is called */
  preventDefault?: boolean;
  /** Only fire when Ctrl (or Cmd on Mac) is held */
  ctrlOrMeta?: boolean;
  /** Only fire when Shift is held */
  shift?: boolean;
  /** Only fire when Alt is held */
  alt?: boolean;
  /** Disable the listener */
  disabled?: boolean;
}

/**
 * Listen for a keyboard shortcut and invoke a callback.
 *
 * @param targetKey - the `event.key` value to listen for
 * @param handler - callback when the key combo is pressed
 * @param options - modifier key requirements
 *
 * @example
 * useKeyPress('k', () => openSearch(), { ctrlOrMeta: true });
 * useKeyPress('Escape', () => closeModal());
 */
export function useKeyPress(
  targetKey: string,
  handler: (event: KeyboardEvent) => void,
  options: KeyPressOptions = {},
): void {
  const { preventDefault = false, ctrlOrMeta = false, shift = false, alt = false, disabled = false } = options;

  const onKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (disabled) return;
      if (event.key !== targetKey) return;
      if (ctrlOrMeta && !(event.ctrlKey || event.metaKey)) return;
      if (shift && !event.shiftKey) return;
      if (alt && !event.altKey) return;

      if (preventDefault) event.preventDefault();
      handler(event);
    },
    [targetKey, handler, preventDefault, ctrlOrMeta, shift, alt, disabled],
  );

  useEffect(() => {
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onKeyDown]);
}
