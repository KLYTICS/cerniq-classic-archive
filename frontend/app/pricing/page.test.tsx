import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { AnchorHTMLAttributes, ReactNode, SVGProps } from 'react';
import PricingPage from './page';
import { PRICING_TIERS } from '@/lib/pricing';

vi.mock('next/link', () => ({
  default: ({
    children,
    ...props
  }: { children: ReactNode } & AnchorHTMLAttributes<HTMLAnchorElement>) => <a {...props}>{children}</a>,
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
  ArrowLeft: (props: SVGProps<SVGSVGElement>) => <svg {...props} />,
  CheckCircle2: (props: SVGProps<SVGSVGElement>) => <svg {...props} />,
  ChevronRight: (props: SVGProps<SVGSVGElement>) => <svg {...props} />,
  HelpCircle: (props: SVGProps<SVGSVGElement>) => <svg {...props} />,
}));

describe('PricingPage', () => {
  it('renders all four pricing tiers from lib/pricing.ts', () => {
    render(<PricingPage />);

    // Assert from the single source of truth — PRICING_TIERS
    for (const tier of PRICING_TIERS) {
      expect(screen.getAllByText(tier.label).length).toBeGreaterThanOrEqual(1);
    }
  });

  it('renders CTA buttons for checkout tiers and contact link for partner', () => {
    render(<PricingPage />);

    // Setup tier — "Start — $750"
    const startButtons = screen.getAllByRole('button', { name: /Start/i });
    expect(startButtons.length).toBeGreaterThanOrEqual(1);

    // Pilot tier — Subscribe CTA
    const subscribeButtons = screen.getAllByRole('button', { name: /Subscribe/i });
    expect(subscribeButtons.length).toBeGreaterThanOrEqual(1);

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
