import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { AnchorHTMLAttributes, ReactNode, SVGProps } from 'react';
import LoginPage from './page';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), back: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/login',
}));

vi.mock('next/link', () => ({
  default: ({
    children,
    ...props
  }: { children: ReactNode } & AnchorHTMLAttributes<HTMLAnchorElement>) => <a {...props}>{children}</a>,
}));

vi.mock('@/lib/api', () => ({
  apiClient: {
    login: vi.fn(),
    register: vi.fn(),
  },
}));

vi.mock('@/lib/analytics', () => ({
  analytics: { identify: vi.fn(), track: vi.fn() },
  EVENTS: { LOGIN: 'Logged In', SIGNUP: 'Signed Up' },
}));

vi.mock('@/lib/billing', () => ({
  getCurrentSubscription: vi.fn().mockResolvedValue(null),
}));

vi.mock('@/lib/subscription', () => ({
  hasPaidPortalAccess: vi.fn().mockReturnValue(false),
  isRememberedPortalUser: vi.fn().mockReturnValue(false),
  rememberPortalUser: vi.fn(),
}));

vi.mock('@/components/brand/CerniqLogo', () => ({
  CerniqMark: () => <div data-testid="cerniq-mark" />,
}));

vi.mock('@/lib/store', () => ({
  useAuthStore: () => ({
    initialized: true,
    isAuthenticated: false,
    user: null,
    setUser: vi.fn(),
  }),
}));

vi.mock('@/lib/i18n', () => ({
  useTranslation: () => ({
    locale: 'en',
    setLocale: vi.fn(),
    t: (key: string) => {
      const map: Record<string, string> = {
        'login.tagline': 'ALM Intelligence',
        'login.signInToAccount': 'Sign in to your account',
        'login.createAccount': 'Create your account',
        'login.email': 'Email',
        'login.emailPlaceholder': 'you@institution.com',
        'login.password': 'Password',
        'login.signIn': 'Sign In',
        'login.signUp': 'Sign Up',
        'login.noAccount': "Don't have an account?",
        'login.hasAccount': 'Already have an account?',
        'login.orContinueWith': 'or continue with',
        'login.featureALM': 'Full ALM analysis',
        'login.featureRatios': '12 COSSEC/NCUA ratios',
        'login.featureReports': 'Board-ready reports',
        'login.featureEncryption': 'Bank-grade encryption',
        'common.processing': 'Processing...',
        'common.google': 'Google',
        'common.github': 'GitHub',
      };
      return map[key] || key;
    },
  }),
}));

vi.mock('lucide-react', () => ({
  ArrowRight: (props: SVGProps<SVGSVGElement>) => <svg {...props} />,
}));

describe('LoginPage', () => {
  it('renders the email and password fields', () => {
    render(<LoginPage />);

    expect(screen.getByLabelText('Email')).toBeInTheDocument();
    expect(screen.getByLabelText('Password')).toBeInTheDocument();
  });

  it('renders the email input with correct type', () => {
    render(<LoginPage />);

    const emailInput = screen.getByLabelText('Email');
    expect(emailInput).toHaveAttribute('type', 'email');
  });

  it('renders the password input with correct type', () => {
    render(<LoginPage />);

    const passwordInput = screen.getByLabelText('Password');
    expect(passwordInput).toHaveAttribute('type', 'password');
  });

  it('renders a submit button', () => {
    render(<LoginPage />);

    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
  });

  it('renders toggle between login and signup modes', () => {
    render(<LoginPage />);

    expect(screen.getByText(/Don't have an account/i)).toBeInTheDocument();
  });
});
