import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import StockInsightsPopup from './StockInsightsPopup';

const mocks = vi.hoisted(() => ({
  getInsights: vi.fn(),
}));

vi.mock('@/lib/api', () => ({
  apiClient: {
    getInsights: mocks.getInsights,
  },
}));

describe('StockInsightsPopup', () => {
  beforeEach(() => {
    mocks.getInsights.mockReset();
  });

  it('fetches and renders insights when opened, then reuses the cached insight', async () => {
    const user = userEvent.setup();
    mocks.getInsights.mockResolvedValue({
      insights: [
        { title: 'Momentum', summary: 'Trend remains constructive.' },
        { title: 'Risk', summary: 'Watch support at 190.' },
      ],
    });

    render(
      <StockInsightsPopup
        ticker="AAPL"
        trigger={<button type="button">Open insight</button>}
      />,
    );

    await user.click(screen.getByRole('button', { name: /open insight/i }));

    expect(await screen.findByText(/momentum/i)).toBeInTheDocument();
    expect(screen.getByText(/powered by gpt-4/i)).toBeInTheDocument();
    expect(mocks.getInsights).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole('button', { name: '✕' }));
    await user.click(screen.getByRole('button', { name: /open insight/i }));

    expect(mocks.getInsights).toHaveBeenCalledTimes(1);
  });

  it('shows the loading skeleton and falls back when no insights are returned', async () => {
    const user = userEvent.setup();
    let resolveInsights: ((value: unknown) => void) | undefined;
    mocks.getInsights.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveInsights = resolve;
        }),
    );

    render(
      <StockInsightsPopup
        ticker="MSFT"
        trigger={<button type="button">Open insight</button>}
      />,
    );

    await user.click(screen.getByRole('button', { name: /open insight/i }));
    expect(document.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0);

    resolveInsights?.({ insights: [] });

    expect(
      await screen.findByText(/unable to generate insights at this time/i),
    ).toBeInTheDocument();
  });

  it('shows the fallback message when insight retrieval fails and closes from the backdrop', async () => {
    const user = userEvent.setup();
    const consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});
    mocks.getInsights.mockRejectedValue(new Error('provider unavailable'));

    render(
      <StockInsightsPopup
        ticker="NVDA"
        trigger={<button type="button">Open insight</button>}
      />,
    );

    await user.click(screen.getByRole('button', { name: /open insight/i }));

    expect(
      await screen.findByText(/unable to generate insights at this time/i),
    ).toBeInTheDocument();
    expect(consoleErrorSpy).toHaveBeenCalled();

    const backdrop = document.querySelector('.fixed.inset-0.z-40') as HTMLElement;
    await user.click(backdrop);

    await waitFor(() => {
      expect(
        screen.queryByText(/unable to generate insights at this time/i),
      ).toBeNull();
    });

    consoleErrorSpy.mockRestore();
  });
});
