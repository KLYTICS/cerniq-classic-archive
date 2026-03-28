'use client';

import { useState, useCallback } from 'react';

interface CopyToClipboardResult {
  /** Whether the last copy succeeded */
  copied: boolean;
  /** Copy text to the clipboard */
  copy: (text: string) => Promise<void>;
  /** Reset the copied state */
  reset: () => void;
}

/**
 * Copy text to the clipboard with success feedback.
 *
 * @param resetDelay - ms before `copied` resets to false (default 2000)
 *
 * @example
 * const { copied, copy } = useCopyToClipboard();
 * <button onClick={() => copy(value)}>{copied ? 'Copied!' : 'Copy'}</button>
 */
export function useCopyToClipboard(resetDelay = 2000): CopyToClipboardResult {
  const [copied, setCopied] = useState(false);

  const reset = useCallback(() => setCopied(false), []);

  const copy = useCallback(
    async (text: string) => {
      if (!navigator?.clipboard) {
        console.warn('useCopyToClipboard: Clipboard API not available');
        return;
      }

      try {
        await navigator.clipboard.writeText(text);
        setCopied(true);

        if (resetDelay > 0) {
          setTimeout(() => setCopied(false), resetDelay);
        }
      } catch (error) {
        console.warn('useCopyToClipboard: copy failed', error);
        setCopied(false);
      }
    },
    [resetDelay],
  );

  return { copied, copy, reset };
}
