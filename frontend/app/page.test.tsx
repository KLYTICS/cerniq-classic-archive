import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type { SVGProps } from 'react';
import LandingPage from './page';
import { PUBLIC_PATHS } from '@/lib/public-links';

const { pushMock } = vi.hoisted(() => ({
  pushMock: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock }),
}));

vi.mock('@/lib/api', () => ({
  apiClient: {
    submitDemoRequest: vi.fn(),
  },
}));

vi.mock('@/lib/billing', () => ({
  createCheckoutSession: vi.fn(),
}));

vi.mock('@/lib/analytics', () => ({
  analytics: { track: vi.fn() },
  EVENTS: {
    LEAD_FORM_SUBMITTED: 'Lead Form Submitted',
    CHECKOUT_STARTED: 'Checkout Started',
  },
}));

vi.mock('@/components/brand/CerniqLogo', () => ({
  CerniqMark: () => <div data-testid="cerniq-mark" />,
  CerniqLockup: ({ tagline }: { tagline: string }) => <div>{tagline}</div>,
}));

vi.mock('lucide-react', () => {
  const Icon = (props: SVGProps<SVGSVGElement>) => <svg {...props} />;
  return {
    ArrowRight: Icon,
    CheckCircle2: Icon,
    ChevronRight: Icon,
    FileText: Icon,
    PlayCircle: Icon,
    ShieldCheck: Icon,
    Upload: Icon,
    Languages: Icon,
    Clock: Icon,
  };
});

describe('LandingPage', () => {
  beforeEach(() => {
    pushMock.mockReset();
    window.localStorage.clear();
  });

  it('keeps the homepage focused on the pilot-first acquisition path', () => {
    render(<LandingPage />);

    expect(
      screen.getAllByText(/Upload your balance sheet to generate your first bilingual ALM report\./i).length,
    ).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByRole('button', { name: /Start Pilot/i }).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/View Interactive Demo/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/Start Your Pilot/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/Tell Us About Your Institution/i)).toBeInTheDocument();
    expect(screen.queryByText(/Request Free Analysis/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Request Demo/i)).not.toBeInTheDocument();
  });

  it('routes compliance navigation through the public compliance path', () => {
    render(<LandingPage />);

    fireEvent.click(screen.getByRole('button', { name: /Compliance/i }));
    expect(pushMock).toHaveBeenCalledWith(PUBLIC_PATHS.compliance);

    const complianceLink = screen
      .getByText(/View compliance matrix/i)
      .closest('a');

    expect(complianceLink).toHaveAttribute('href', PUBLIC_PATHS.compliance);
  });

  it('routes the $750 pilot CTA into the get-started intake flow', () => {
    render(<LandingPage />);

    fireEvent.click(
      screen.getByRole('button', { name: /Start Pilot — \$750/i }),
    );

    expect(pushMock).toHaveBeenCalledWith('/get-started');
  });
});
