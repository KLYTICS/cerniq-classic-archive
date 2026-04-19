import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { SVGProps } from 'react';
import LandingPage from './page';

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
});
