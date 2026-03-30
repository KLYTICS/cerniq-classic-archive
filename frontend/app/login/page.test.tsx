import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { AnchorHTMLAttributes, ReactNode, SVGProps } from 'react';

const pushMock = vi.fn();
const backMock = vi.fn();
const replaceMock = vi.fn();
const setUserMock = vi.fn();
const loginMock = vi.fn();
const registerMock = vi.fn();
const identifyMock = vi.fn();
const trackMock = vi.fn();
const getCurrentSubscriptionMock = vi.fn();
const hasPaidPortalAccessMock = vi.fn();
const isRememberedPortalUserMock = vi.fn();
const rememberPortalUserMock = vi.fn();
const setLocaleMock = vi.fn();

let searchParams = new URLSearchParams();
let authState = {
  initialized: true,
  isAuthenticated: false,
  user: null as null | { id: string; email: string; name?: string },
};

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock, back: backMock, replace: replaceMock }),
  useSearchParams: () => searchParams,
  usePathname: () => '/login',
}));

vi.mock('next/link', () => ({
  default: ({
    children,
    ...props
  }: { children: ReactNode } & AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a {...props}>{children}</a>
  ),
}));

vi.mock('@/lib/api', () => ({
  apiClient: {
    login: loginMock,
    register: registerMock,
  },
}));

vi.mock('@/lib/analytics', () => ({
  analytics: { identify: identifyMock, track: trackMock },
  EVENTS: { LOGIN: 'Logged In', SIGNUP: 'Signed Up' },
}));

vi.mock('@/lib/billing', () => ({
  getCurrentSubscription: getCurrentSubscriptionMock,
}));

vi.mock('@/lib/subscription', () => ({
  hasPaidPortalAccess: hasPaidPortalAccessMock,
  isRememberedPortalUser: isRememberedPortalUserMock,
  rememberPortalUser: rememberPortalUserMock,
}));

vi.mock('@/components/brand/CerniqLogo', () => ({
  CerniqMark: () => <div data-testid="cerniq-mark" />,
}));

vi.mock('@/lib/store', () => ({
  useAuthStore: () => ({
    ...authState,
    setUser: setUserMock,
  }),
}));

vi.mock('@/lib/api-base', () => ({
  getPublicApiUrl: vi.fn((path: string) => `https://api.cerniq.test${path}`),
}));

vi.mock('@/lib/i18n', () => ({
  useTranslation: () => ({
    locale: 'en',
    setLocale: setLocaleMock,
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

async function loadPage(env?: {
  google?: string;
  github?: string;
}) {
  vi.resetModules();
  if (env?.google === undefined) {
    delete process.env.NEXT_PUBLIC_ENABLE_GOOGLE_OAUTH;
  } else {
    process.env.NEXT_PUBLIC_ENABLE_GOOGLE_OAUTH = env.google;
  }
  if (env?.github === undefined) {
    delete process.env.NEXT_PUBLIC_ENABLE_GITHUB_OAUTH;
  } else {
    process.env.NEXT_PUBLIC_ENABLE_GITHUB_OAUTH = env.github;
  }
  return (await import('./page')).default;
}

describe('LoginPage', () => {
  beforeEach(() => {
    pushMock.mockReset();
    backMock.mockReset();
    replaceMock.mockReset();
    setUserMock.mockReset();
    loginMock.mockReset();
    registerMock.mockReset();
    identifyMock.mockReset();
    trackMock.mockReset();
    getCurrentSubscriptionMock.mockReset();
    hasPaidPortalAccessMock.mockReset();
    isRememberedPortalUserMock.mockReset();
    rememberPortalUserMock.mockReset();
    setLocaleMock.mockReset();
    localStorage.clear();
    sessionStorage.clear();
    window.history.pushState({}, '', '/login');
    searchParams = new URLSearchParams();
    authState = { initialized: true, isAuthenticated: false, user: null };
    getCurrentSubscriptionMock.mockResolvedValue(null);
    hasPaidPortalAccessMock.mockReturnValue(false);
    isRememberedPortalUserMock.mockReturnValue(false);
    process.env.NEXT_PUBLIC_ENABLE_GOOGLE_OAUTH = 'true';
    process.env.NEXT_PUBLIC_ENABLE_GITHUB_OAUTH = 'false';
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders the default login shell with email, password, and Google OAuth', async () => {
    const LoginPage = await loadPage();
    render(<LoginPage />);

    expect(screen.getByLabelText('Email')).toHaveAttribute('type', 'email');
    expect(screen.getByLabelText('Password')).toHaveAttribute('type', 'password');
    expect(screen.getByRole('button', { name: 'Sign In' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Google' })).toHaveAttribute(
      'href',
      'https://api.cerniq.test/api/auth/google',
    );
    expect(screen.queryByRole('link', { name: 'GitHub' })).not.toBeInTheDocument();
  });

  it('switches the language toggle through both operator actions', async () => {
    const LoginPage = await loadPage();
    render(<LoginPage />);

    fireEvent.click(screen.getByRole('button', { name: 'Switch to English' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cambiar a Espanol' }));

    expect(setLocaleMock).toHaveBeenNthCalledWith(1, 'en');
    expect(setLocaleMock).toHaveBeenNthCalledWith(2, 'es');
  });

  it('switches into signup mode from the query string', async () => {
    searchParams = new URLSearchParams('mode=signup');
    const LoginPage = await loadPage({ google: 'false', github: 'true' });
    render(<LoginPage />);

    expect(screen.getByRole('button', { name: 'Sign Up' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'GitHub' })).toHaveAttribute(
      'href',
      'https://api.cerniq.test/api/auth/github',
    );
    expect(
      screen.getByRole('button', { name: 'Already have an account?' }),
    ).toBeInTheDocument();
  });

  it('hides OAuth options when both providers are disabled', async () => {
    const LoginPage = await loadPage({ google: 'false', github: 'false' });
    render(<LoginPage />);

    expect(screen.queryByText('or continue with')).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Google' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'GitHub' })).not.toBeInTheDocument();
  });

  it('switches into signup mode from the toggle button', async () => {
    const LoginPage = await loadPage({ google: 'true', github: 'false' });
    render(<LoginPage />);

    fireEvent.click(screen.getByRole('button', { name: "Don't have an account?" }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Sign Up' })).toBeInTheDocument();
    });
  });

  it('submits login, identifies analytics, and routes to onboarding by default', async () => {
    loginMock.mockResolvedValue({
      access_token: 'desk-token',
      user: { id: 'user-1', email: 'quant@cerniq.io', name: 'Quant User' },
    });
    const LoginPage = await loadPage();
    render(<LoginPage />);

    fireEvent.change(screen.getByLabelText('Email'), {
      target: { value: 'quant@cerniq.io' },
    });
    fireEvent.change(screen.getByLabelText('Password'), {
      target: { value: 'StrongP@ss1' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Sign In' }));

    await waitFor(() => {
      expect(loginMock).toHaveBeenCalledWith('quant@cerniq.io', 'StrongP@ss1');
      expect(setUserMock).toHaveBeenCalledWith({
        id: 'user-1',
        email: 'quant@cerniq.io',
        name: 'Quant User',
      });
      expect(identifyMock).toHaveBeenCalledWith('user-1', {
        email: 'quant@cerniq.io',
        name: 'Quant User',
      });
      expect(trackMock).toHaveBeenCalledWith('Logged In', { method: 'email' });
      expect(pushMock).toHaveBeenCalledWith('/onboarding');
    });
  });

  it('routes successful signup to the dashboard when onboarding is already complete', async () => {
    searchParams = new URLSearchParams('mode=signup');
    localStorage.setItem('cerniq_onboarding_user-2', 'true');
    registerMock.mockResolvedValue({
      access_token: 'desk-token',
      user_id: 'user-2',
      email: 'ops@cerniq.io',
    });

    const LoginPage = await loadPage();
    render(<LoginPage />);

    fireEvent.change(screen.getByLabelText('Email'), {
      target: { value: 'ops@cerniq.io' },
    });
    fireEvent.change(screen.getByLabelText('Password'), {
      target: { value: 'StrongP@ss1' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Sign Up' }));

    await waitFor(() => {
      expect(registerMock).toHaveBeenCalledWith('ops@cerniq.io', 'StrongP@ss1');
      expect(trackMock).toHaveBeenCalledWith('Signed Up', { method: 'email' });
      expect(pushMock).toHaveBeenCalledWith('/dashboard');
    });
  });

  it('prioritizes returnUrl and remembered portal access for authenticated users', async () => {
    searchParams = new URLSearchParams('returnUrl=%2Fportal%2Fsubmit');
    authState = {
      initialized: true,
      isAuthenticated: true,
      user: { id: 'user-3', email: 'cfo@cerniq.io' },
    };
    isRememberedPortalUserMock.mockReturnValue(true);

    const LoginPage = await loadPage();
    render(<LoginPage />);

    await waitFor(() => {
      expect(pushMock).toHaveBeenCalledWith('/portal/submit');
    });
  });

  it('routes authenticated remembered portal users to the portal when no returnUrl is present', async () => {
    authState = {
      initialized: true,
      isAuthenticated: true,
      user: { id: 'user-portal', email: 'member@cerniq.io' },
    };
    isRememberedPortalUserMock.mockReturnValue(true);

    const LoginPage = await loadPage();
    render(<LoginPage />);

    await waitFor(() => {
      expect(pushMock).toHaveBeenCalledWith('/portal');
    });
  });

  it('routes to the paid portal and remembers the user after login when billing allows access', async () => {
    loginMock.mockResolvedValue({
      user: { id: 'user-4', email: 'paid@cerniq.io' },
    });
    getCurrentSubscriptionMock.mockResolvedValue({ tier: 'annual' });
    hasPaidPortalAccessMock.mockReturnValue(true);

    const LoginPage = await loadPage();
    render(<LoginPage />);

    fireEvent.change(screen.getByLabelText('Email'), {
      target: { value: 'paid@cerniq.io' },
    });
    fireEvent.change(screen.getByLabelText('Password'), {
      target: { value: 'StrongP@ss1' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Sign In' }));

    await waitFor(() => {
      expect(rememberPortalUserMock).toHaveBeenCalledTimes(1);
      expect(pushMock).toHaveBeenCalledWith('/portal');
    });
  });

  it('falls back to onboarding when billing lookup fails after login', async () => {
    loginMock.mockResolvedValue({
      user: { id: 'user-5', email: 'billing-fail@cerniq.io' },
    });
    getCurrentSubscriptionMock.mockRejectedValue(new Error('billing unavailable'));

    const LoginPage = await loadPage();
    render(<LoginPage />);

    fireEvent.change(screen.getByLabelText('Email'), {
      target: { value: 'billing-fail@cerniq.io' },
    });
    fireEvent.change(screen.getByLabelText('Password'), {
      target: { value: 'StrongP@ss1' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Sign In' }));

    await waitFor(() => {
      expect(pushMock).toHaveBeenCalledWith('/onboarding');
    });
  });

  it('renders backend auth messages when login fails', async () => {
    loginMock.mockRejectedValue({
      response: {
        data: {
          message: 'Desk access denied.',
        },
      },
    });
    const LoginPage = await loadPage();
    render(<LoginPage />);

    fireEvent.change(screen.getByLabelText('Email'), {
      target: { value: 'blocked@cerniq.io' },
    });
    fireEvent.change(screen.getByLabelText('Password'), {
      target: { value: 'WrongPass1!' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Sign In' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Desk access denied.',
    );
    expect(pushMock).not.toHaveBeenCalled();
  });

  it('prefers explicit backend error fields before detail and default fallbacks', async () => {
    const LoginPage = await loadPage();
    render(<LoginPage />);

    fireEvent.change(screen.getByLabelText('Email'), {
      target: { value: 'blocked@cerniq.io' },
    });
    fireEvent.change(screen.getByLabelText('Password'), {
      target: { value: 'WrongPass1!' },
    });

    loginMock.mockRejectedValueOnce({
      response: { data: { error: 'OAuth is disabled.' } },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Sign In' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('OAuth is disabled.');

    loginMock.mockRejectedValueOnce({
      response: { data: { detail: 'Quant desk approval required.' } },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Sign In' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Quant desk approval required.',
    );

    loginMock.mockRejectedValueOnce(new Error('network failed'));
    fireEvent.click(screen.getByRole('button', { name: 'Sign In' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Authentication failed',
    );
  });
});
