import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { AnchorHTMLAttributes, ReactNode, SVGProps } from 'react';
import PricingPage, {
  getCtaLabel,
  getInitialPricingLanguage,
} from './page';

const mocks = vi.hoisted(() => ({
  createCheckoutSession: vi.fn(),
  analyticsTrack: vi.fn(),
}));

vi.mock('next/link', () => ({
  default: ({
    children,
    ...props
  }: { children: ReactNode } & AnchorHTMLAttributes<HTMLAnchorElement>) => <a {...props}>{children}</a>,
}));

vi.mock('@/lib/billing', () => ({
  createCheckoutSession: mocks.createCheckoutSession,
}));

vi.mock('@/lib/analytics', () => ({
  analytics: { track: mocks.analyticsTrack },
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
  beforeEach(() => {
    mocks.createCheckoutSession.mockReset();
    mocks.analyticsTrack.mockReset();
    localStorage.clear();
  });

  it('renders all pricing tiers, pricing labels, and FAQ content', () => {
    render(<PricingPage />);

    expect(screen.getByText('ALM Report')).toBeInTheDocument();
    expect(screen.getByText('Monthly ALM Platform')).toBeInTheDocument();
    expect(screen.getByText('Annual ALM Platform')).toBeInTheDocument();
    expect(screen.getByText('CPA Partner')).toBeInTheDocument();
    expect(screen.getByLabelText('Pricing tiers')).toBeInTheDocument();
    expect(screen.getByText('FAQ')).toBeInTheDocument();
    expect(screen.getByText(/why start with a pilot/i)).toBeInTheDocument();
  });

  it('renders checkout actions plus the partner contact link', () => {
    render(<PricingPage />);

    expect(screen.getAllByRole('button', { name: /start — \$750/i }).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByRole('button', { name: /subscribe — \$299\/mo/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /buy annual — \$2,400/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /contact sales/i })).toHaveAttribute('href', '/contact');
  });

  it('starts in Spanish when the saved language preference is es and toggles labels', async () => {
    const user = userEvent.setup();
    localStorage.setItem('cerniq_lang', 'es');

    render(<PricingPage />);

    expect(screen.getByRole('heading', { name: /planes y precios/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cambiar a Espanol' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('link', { name: /contactar ventas/i })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Switch to English' }));

    expect(screen.getByRole('heading', { name: /plans & pricing/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Switch to English' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('exposes safe CTA defaults and defaults language to English without storage', async () => {
    const user = userEvent.setup();

    expect(getCtaLabel('unknown', 'en')).toBe('Get Started');
    expect(getCtaLabel('unknown', 'es')).toBe('Comenzar');
    expect(getInitialPricingLanguage(null)).toBe('en');

    render(<PricingPage />);

    await user.click(screen.getByRole('button', { name: 'Cambiar a Espanol' }));
    expect(screen.getByRole('button', { name: 'Cambiar a Espanol' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('starts checkout, shows processing state, and tracks analytics', async () => {
    const user = userEvent.setup();
    let resolveCheckout: ((value: string) => void) | undefined;
    mocks.createCheckoutSession.mockImplementation(
      () =>
        new Promise<string>((resolve) => {
          resolveCheckout = resolve;
        }),
    );

    render(<PricingPage />);

    await user.click(screen.getByRole('button', { name: /subscribe — \$299\/mo/i }));

    expect(mocks.analyticsTrack).toHaveBeenCalledWith('Checkout Started', {
      tier: 'monthly',
      source: 'pricing_page',
    });
    expect(mocks.createCheckoutSession).toHaveBeenCalledWith({
      tier: 'monthly',
      successUrl: '/portal?welcome=1',
      cancelUrl: '/pricing',
    });
    expect(screen.getByRole('button', { name: /processing/i })).toBeDisabled();

    resolveCheckout?.('https://checkout.stripe.test/session');

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /subscribe — \$299\/mo/i })).toBeInTheDocument();
    });
  });

  it('recovers back to the normal CTA when checkout creation fails', async () => {
    const user = userEvent.setup();
    mocks.createCheckoutSession.mockRejectedValue(new Error('checkout unavailable'));

    render(<PricingPage />);

    await user.click(screen.getByRole('button', { name: /buy annual — \$2,400/i }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /buy annual — \$2,400/i })).toBeInTheDocument();
    });
  });

  it('starts one-time checkout from the footer CTA', async () => {
    const user = userEvent.setup();
    mocks.createCheckoutSession.mockRejectedValue(new Error('checkout unavailable'));

    render(<PricingPage />);

    const footerButtons = screen.getAllByRole('button', { name: /start — \$750/i });
    await user.click(footerButtons[footerButtons.length - 1]);

    expect(mocks.createCheckoutSession).toHaveBeenCalledWith({
      tier: 'one_time',
      successUrl: '/portal?welcome=1',
      cancelUrl: '/pricing',
    });
  });
});
