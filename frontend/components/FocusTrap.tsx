'use client';

import { useEffect, useRef, type ReactNode } from 'react';

/**
 * Traps keyboard focus within a container (for modals, drawers, dialogs).
 * On mount, moves focus to the first focusable element.
 * On Tab / Shift+Tab, cycles focus within the container.
 * On Escape, calls onEscape if provided.
 */
export default function FocusTrap({
  children,
  active = true,
  onEscape,
}: {
  children: ReactNode;
  active?: boolean;
  onEscape?: () => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!active) return;

    const container = containerRef.current;
    if (!container) return;

    const focusableSelector =
      'a[href], button:not([disabled]), textarea, input:not([disabled]), select, [tabindex]:not([tabindex="-1"])';

    const getFocusableElements = () =>
      Array.from(container.querySelectorAll<HTMLElement>(focusableSelector));

    // Focus the first focusable element on mount
    const elements = getFocusableElements();
    if (elements.length > 0) elements[0].focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && onEscape) {
        onEscape();
        return;
      }

      if (e.key !== 'Tab') return;

      const focusable = getFocusableElements();
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    container.addEventListener('keydown', handleKeyDown);
    return () => container.removeEventListener('keydown', handleKeyDown);
  }, [active, onEscape]);

  return (
    <div ref={containerRef} role="dialog" aria-modal="true">
      {children}
    </div>
  );
}
