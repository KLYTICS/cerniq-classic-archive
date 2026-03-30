import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { getFocusableElements, Modal } from './Modal';

describe('Modal', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    document.body.style.overflow = '';
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders nothing when closed', () => {
    render(
      <Modal open={false} onClose={vi.fn()}>
        <p>Content</p>
      </Modal>,
    );

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('renders title, content, aria metadata, and custom width classes when open', () => {
    render(
      <Modal open={true} onClose={vi.fn()} title="Confirm trade" maxWidth="max-w-2xl" className="desk-modal">
        <p>Approve this rebalance?</p>
      </Modal>,
    );

    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAttribute('aria-label', 'Confirm trade');
    expect(dialog).toHaveClass('max-w-2xl');
    expect(dialog).toHaveClass('desk-modal');
    expect(screen.getByText('Approve this rebalance?')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Close' })).toBeInTheDocument();
  });

  it('omits the header controls when no title is provided', () => {
    render(
      <Modal open={true} onClose={vi.fn()}>
        <p>Body only</p>
      </Modal>,
    );

    expect(screen.queryByRole('button', { name: 'Close' })).not.toBeInTheDocument();
    expect(screen.getByText('Body only')).toBeInTheDocument();
  });

  it('calls onClose from the close button, backdrop click, and Escape key', () => {
    const onClose = vi.fn();
    const { container } = render(
      <Modal open={true} onClose={onClose} title="Close paths">
        <p>Body</p>
      </Modal>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    fireEvent.click(container.querySelector('[aria-hidden="true"]') as HTMLElement);
    fireEvent.keyDown(document, { key: 'Escape' });

    expect(onClose).toHaveBeenCalledTimes(3);
  });

  it('locks body scroll while open and restores it on unmount', () => {
    const { unmount } = render(
      <Modal open={true} onClose={vi.fn()} title="Scroll lock">
        <button>Primary action</button>
      </Modal>,
    );

    expect(document.body.style.overflow).toBe('hidden');

    unmount();

    expect(document.body.style.overflow).toBe('');
  });

  it('auto-focuses the first focusable element and traps tab navigation', () => {
    render(
      <Modal open={true} onClose={vi.fn()}>
        <div>
          <button>First action</button>
          <button>Last action</button>
        </div>
      </Modal>,
    );

    const first = screen.getByRole('button', { name: 'First action' });
    const last = screen.getByRole('button', { name: 'Last action' });

    vi.advanceTimersByTime(60);
    expect(first).toHaveFocus();

    last.focus();
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(first).toHaveFocus();

    first.focus();
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
    expect(last).toHaveFocus();
  });

  it('ignores focus-trap tab events when there are no focusable elements', () => {
    render(
      <Modal open={true} onClose={vi.fn()}>
        <p>No controls inside</p>
      </Modal>,
    );

    expect(() => fireEvent.keyDown(document, { key: 'Tab' })).not.toThrow();
    expect(screen.getByText('No controls inside')).toBeInTheDocument();
  });

  it('exposes focusable-element helper fallbacks for null and empty dialogs', () => {
    expect(getFocusableElements(null)).toEqual([]);
    expect(getFocusableElements(document.createElement('div'))).toEqual([]);
  });
});
