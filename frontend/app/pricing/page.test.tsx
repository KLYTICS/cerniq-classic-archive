import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import PricingPage from './page';

vi.mock('next/link', () => ({
  default: ({ children, ...props }: any) => <a {...props}>{children}</a>,
}));

vi.mock('@/lib/billing', () => ({
  createCheckoutSession: vi.fn(),
}));

vi.mock('@/lib/analytics', () => ({
  analytics: { track: vi.fn() },
  EVENTS: { CHECKOUT_STARTED: 'Checkout Started' },
}));

vi.mock('@/components/brand/CerniqLogo', () => ({
  CerniqMark: () => <div data-testid="cerniq-mark" />,
}));

vi.mock('lucide-react', () => ({
  ArrowLeft: (props: any) => <svg {...props} />,
  CheckCircle2: (props: any) => <svg {...props} />,
  ChevronRight: (props: any) => <svg {...props} />,
  HelpCircle: (props: any) => <svg {...props} />,
}));

describe('PricingPage', () => {
  it('renders all four pricing tiers', () => {
    render(<PricingPage />);

    expect(screen.getByText('ALM Report')).toBeInTheDocument();
    expect(screen.getByText('Monthly ALM Platform')).toBeInTheDocument();
    expect(screen.getByText('Annual ALM Platform')).toBeInTheDocument();
    expect(screen.getByText('CPA Partner')).toBeInTheDocument();
  });

  it('displays prices for each tier', () => {
    render(<PricingPage />);

    // Prices appear in both the tier cards and CTA buttons, so use getAllByText
    expect(screen.getAllByText('$750').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('$299').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('$2,400').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('$499').length).toBeGreaterThanOrEqual(1);
  });

  it('renders CTA buttons for checkout tiers and contact link for partner', () => {
    render(<PricingPage />);

    // The "Start — $750" button appears in tier card AND bottom CTA, so use getAllByRole
    const startButtons = screen.getAllByRole('button', { name: /Start — \$750/i });
    expect(startButtons.length).toBeGreaterThanOrEqual(1);
    expect(screen.getByRole('button', { name: /Subscribe — \$299\/mo/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Buy Annual — \$2,400/i })).toBeInTheDocument();

    // Partner tier has a Contact Sales link
    expect(screen.getByRole('link', { name: /Contact Sales/i })).toBeInTheDocument();
  });

  it('renders the pricing tiers section with proper aria-label', () => {
    render(<PricingPage />);
    expect(screen.getByLabelText('Pricing tiers')).toBeInTheDocument();
  });

  it('renders the FAQ section', () => {
    render(<PricingPage />);
    expect(screen.getByText('FAQ')).toBeInTheDocument();
    expect(screen.getByText(/Why start with a pilot/i)).toBeInTheDocument();
  });
});
