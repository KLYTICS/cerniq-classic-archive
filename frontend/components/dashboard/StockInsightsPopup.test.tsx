import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import StockInsightsPopup from './StockInsightsPopup';

vi.mock('@/lib/api', () => ({
  apiClient: {
    getInsights: vi.fn().mockResolvedValue({
      insights: [
        { title: 'Strong Earnings', summary: 'Q4 beat expectations by 12%.' },
      ],
    }),
  },
}));

describe('StockInsightsPopup', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the trigger element', () => {
    render(
      <StockInsightsPopup
        ticker="AAPL"
        trigger={<button>View Insights</button>}
      />,
    );

    expect(screen.getByRole('button', { name: /view insights/i })).toBeInTheDocument();
  });

  it('does not show the popup initially', () => {
    render(
      <StockInsightsPopup
        ticker="AAPL"
        trigger={<button>View Insights</button>}
      />,
    );

    expect(screen.queryByText(/AI Analysis/i)).not.toBeInTheDocument();
  });

  it('opens the popup when trigger is clicked', async () => {
    const user = userEvent.setup();
    render(
      <StockInsightsPopup
        ticker="AAPL"
        trigger={<button>View Insights</button>}
      />,
    );

    await user.click(screen.getByRole('button', { name: /view insights/i }));

    expect(screen.getByText(/AI Analysis: AAPL/i)).toBeInTheDocument();
  });

  it('displays fetched insight data after loading', async () => {
    const user = userEvent.setup();
    render(
      <StockInsightsPopup
        ticker="AAPL"
        trigger={<button>View Insights</button>}
      />,
    );

    await user.click(screen.getByRole('button', { name: /view insights/i }));

    // Wait for the insight text to appear (after async fetch resolves)
    await screen.findByText(/Strong Earnings/);
    expect(screen.getByText(/Q4 beat expectations/)).toBeInTheDocument();
  });
});
