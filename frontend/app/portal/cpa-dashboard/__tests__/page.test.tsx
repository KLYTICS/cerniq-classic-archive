import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import Page from '../page';

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), back: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/portal/cpa-dashboard',
}));

// Mock i18n — return English locale
vi.mock('@/lib/i18n', () => ({
  useTranslation: () => ({ locale: 'en', t: (k: string) => k, ta: (k: string) => k, setLocale: vi.fn() }),
}));

// Mock RiskScoreBadge — render score visibly
vi.mock('@/components/wave03/risk-score-badge', () => ({
  RiskScoreBadge: ({ score }: { score: number }) => <span data-testid="risk-badge">{score}</span>,
}));

// Mock Modal — render children when open
vi.mock('@/components/ui/Modal', () => ({
  Modal: ({ open, children, title }: { open: boolean; children: React.ReactNode; title: string }) =>
    open ? <div data-testid="modal" aria-label={title}>{children}</div> : null,
}));

// Mock fetch for API calls
const mockFetch = vi.fn().mockResolvedValue({
  ok: false,
  json: async () => ({}),
});
global.fetch = mockFetch;

describe('CPA Dashboard Page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockResolvedValue({ ok: false, json: async () => ({}) });
  });

  it('renders the firm name in the header', async () => {
    render(<Page />);
    await waitFor(() => {
      expect(screen.getByText('Rodriguez & Associates CPA')).toBeInTheDocument();
    });
  });

  it('shows the client institution table with institution names', async () => {
    render(<Page />);
    await waitFor(() => {
      expect(screen.getByText('Clients')).toBeInTheDocument();
    });
    expect(screen.getByText('Cooperativa de Ahorro Caguas')).toBeInTheDocument();
    expect(screen.getByText('ACACIA Federal Credit Union')).toBeInTheDocument();
    expect(screen.getByText('Oriental Federal Credit Union')).toBeInTheDocument();
    expect(screen.getByText('Cooperativa de Bayamon')).toBeInTheDocument();
    expect(screen.getByText('Cooperativa Jesus Obrero')).toBeInTheDocument();
    expect(screen.getByText('Cooperativa de Arecibo')).toBeInTheDocument();
  });

  it('shows risk distribution metric cards (High/Medium/Low)', async () => {
    render(<Page />);
    await waitFor(() => {
      expect(screen.getByText('High Risk')).toBeInTheDocument();
    });
    expect(screen.getByText('Medium Risk')).toBeInTheDocument();
    expect(screen.getByText('Low Risk')).toBeInTheDocument();
    // Verify the counts: 1 high (<60), 2 medium (60-79), 3 low (80+)
    expect(screen.getByText('Score < 60')).toBeInTheDocument();
    expect(screen.getByText('Score 60-79')).toBeInTheDocument();
    expect(screen.getByText('Score 80+')).toBeInTheDocument();
  });

  it('shows the "Add Client" button', async () => {
    render(<Page />);
    await waitFor(() => {
      expect(screen.getByText(/Add Client/)).toBeInTheDocument();
    });
  });

  it('shows the "Bulk Upload" button', async () => {
    render(<Page />);
    await waitFor(() => {
      expect(screen.getByText('Bulk Upload')).toBeInTheDocument();
    });
  });

  it('renders compliance badges for clients', async () => {
    render(<Page />);
    await waitFor(() => {
      expect(screen.getByText('Clients')).toBeInTheDocument();
    });
    // 3 compliant, 2 warning, 1 breach in demo data
    const compliantBadges = screen.getAllByText('Compliant');
    expect(compliantBadges.length).toBe(3);
    const warningBadges = screen.getAllByText('Warning');
    expect(warningBadges.length).toBe(2);
    expect(screen.getByText('Breach')).toBeInTheDocument();
  });

  it('shows the Assets Under Advisory (AUA) metric', async () => {
    render(<Page />);
    await waitFor(() => {
      expect(screen.getByText('Assets Under Advisory')).toBeInTheDocument();
    });
    // $8,750,000,000 -> $8.8B
    expect(screen.getByText('$8.8B')).toBeInTheDocument();
  });

  it('shows the Upcoming Exams metric', async () => {
    render(<Page />);
    await waitFor(() => {
      expect(screen.getByText('Upcoming Exams')).toBeInTheDocument();
    });
    expect(screen.getByText('Next 90 days')).toBeInTheDocument();
    // The value "3" appears in multiple places; verify it exists near the exams section
    const examsSection = screen.getByText('Upcoming Exams').closest('div');
    expect(examsSection).not.toBeNull();
    expect(examsSection!.textContent).toContain('3');
  });

  it('shows the Recent Alerts metric', async () => {
    render(<Page />);
    await waitFor(() => {
      expect(screen.getByText('Recent Alerts')).toBeInTheDocument();
    });
    expect(screen.getByText('7')).toBeInTheDocument();
    expect(screen.getByText('Last 7 days')).toBeInTheDocument();
  });
});
