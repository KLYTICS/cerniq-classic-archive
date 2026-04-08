import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { AnchorHTMLAttributes, ReactNode, SVGProps } from 'react';
import PortalLogin from './page';

const searchParams = new URLSearchParams();

vi.mock('next/navigation', () => ({
  useSearchParams: () => searchParams,
}));

vi.mock('next/link', () => ({
  default: ({
    children,
    ...props
  }: { children: ReactNode } & AnchorHTMLAttributes<HTMLAnchorElement>) => <a {...props}>{children}</a>,
}));

vi.mock('@/lib/analytics', () => ({
  analytics: { track: vi.fn() },
  EVENTS: { PORTAL_LOGIN_REQUESTED: 'Portal Login Requested' },
}));

vi.mock('lucide-react', () => {
  const Icon = (props: SVGProps<SVGSVGElement>) => <svg {...props} />;
  return {
    Mail: Icon,
    ArrowLeft: Icon,
    CheckCircle: Icon,
  };
});

describe('PortalLogin', () => {
  beforeEach(() => {
    searchParams.delete('billing');
  });

  it('renders the standard portal login copy', () => {
    render(<PortalLogin />);

    expect(screen.getByText('Sign in')).toBeInTheDocument();
    expect(
      screen.getByText('Enter your email to receive a secure login link.'),
    ).toBeInTheDocument();
    expect(screen.queryByText('Payment confirmed')).not.toBeInTheDocument();
  });

  it('shows post-checkout guidance when billing success is present', () => {
    searchParams.set('billing', 'success');

    render(<PortalLogin />);

    expect(screen.getByText('Payment confirmed')).toBeInTheDocument();
    expect(
      screen.getByText(
        /Your subscription is active\. Enter the same email you used at checkout/i,
      ),
    ).toBeInTheDocument();
  });
});
