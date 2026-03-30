import { afterEach, describe, it, expect, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { ToastProvider, useToast } from './Toast';

function TestConsumer() {
  const { toast } = useToast();
  return (
    <button onClick={() => toast('Hello!', 'success')}>Show Toast</button>
  );
}

describe('Toast', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders children inside the provider', () => {
    render(
      <ToastProvider>
        <p>App content</p>
      </ToastProvider>,
    );
    expect(screen.getByText('App content')).toBeInTheDocument();
  });

  it('useToast throws when used outside provider', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => {
      render(<TestConsumer />);
    }).toThrow('useToast must be used within a <ToastProvider>');
    spy.mockRestore();
  });

  it('shows a toast when triggered', async () => {
    render(
      <ToastProvider>
        <TestConsumer />
      </ToastProvider>,
    );

    const button = screen.getByText('Show Toast');
    button.click();

    expect(await screen.findByText('Hello!')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('supports different variants and manual dismissal', async () => {
    function VariantConsumer() {
      const { toast } = useToast();
      return (
        <>
          <button onClick={() => toast('Heads up', 'warning')}>Warn</button>
          <button onClick={() => toast('Problem', 'error')}>Error</button>
        </>
      );
    }

    render(
      <ToastProvider>
        <VariantConsumer />
      </ToastProvider>,
    );

    fireEvent.click(screen.getByText('Warn'));
    fireEvent.click(screen.getByText('Error'));

    expect(await screen.findByText('Heads up')).toBeInTheDocument();
    expect(screen.getByText('Problem')).toBeInTheDocument();
    expect(screen.getByText('!')).toBeInTheDocument();
    expect(screen.getByText('✗')).toBeInTheDocument();

    fireEvent.click(screen.getAllByRole('button', { name: 'Dismiss' })[0]);
    expect(screen.queryByText('Heads up')).not.toBeInTheDocument();
  });

  it('auto-removes toasts after the timeout elapses', async () => {
    vi.useFakeTimers();

    render(
      <ToastProvider>
        <TestConsumer />
      </ToastProvider>,
    );

    fireEvent.click(screen.getByText('Show Toast'));
    expect(screen.getByText('Hello!')).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(4000);
    });

    expect(screen.queryByText('Hello!')).not.toBeInTheDocument();
  });
});
