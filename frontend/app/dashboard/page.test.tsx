import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import type {
  AnchorHTMLAttributes,
  ReactNode,
  SVGProps,
} from 'react';
import DashboardPage from './page';

const { replaceMock } = vi.hoisted(() => ({
  replaceMock: vi.fn(),
}));

const authState = {
  initialized: true,
  isAuthenticated: false,
  onboardingComplete: false,
  hydrateFromStorage: vi.fn(),
};

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: replaceMock }),
}));

vi.mock('next/link', () => ({
  default: ({
    children,
    ...props
  }: { children: ReactNode } & AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a {...props}>{children}</a>
  ),
}));

vi.mock('@/lib/store', () => ({
  useAuthStore: () => authState,
}));

vi.mock('@/lib/i18n', () => ({
  useTranslation: () => ({ locale: 'en' }),
}));

vi.mock('lucide-react', () => {
  const Icon = (props: SVGProps<SVGSVGElement>) => <svg {...props} />;
  return {
    ArrowRight: Icon,
    CheckCircle2: Icon,
    LockKeyhole: Icon,
    Upload: Icon,
  };
});

describe('DashboardPage', () => {
  beforeEach(() => {
    replaceMock.mockReset();
    authState.initialized = true;
    authState.isAuthenticated = false;
    authState.onboardingComplete = false;
    authState.hydrateFromStorage.mockReset();
  });

  it('shows guest users the secure workspace entry points only', () => {
    render(<DashboardPage />);

    expect(
      screen.getByRole('heading', {
        name: /start your upload-to-report workflow/i,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: /sign in to open workspace/i }),
    ).toHaveAttribute('href', '/login?returnUrl=%2Fdashboard&mode=magic-link');
    expect(
      screen.getByRole('link', { name: /start pilot/i }),
    ).toHaveAttribute('href', '/get-started');
    expect(
      screen.getByRole('link', { name: /view interactive demo/i }),
    ).toHaveAttribute('href', '/demo');
    expect(screen.queryByText(/ALM Intelligence/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Generate ALM Report/i)).not.toBeInTheDocument();
    expect(replaceMock).not.toHaveBeenCalled();
  });

  it('routes authenticated users without onboarding to setup completion', () => {
    authState.isAuthenticated = true;
    authState.onboardingComplete = false;

    render(<DashboardPage />);

    expect(
      screen.getByRole('heading', {
        name: /finish institution setup before upload/i,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: /complete setup/i }),
    ).toHaveAttribute('href', '/onboarding');
    expect(
      screen.getByRole('link', { name: /review pilot steps/i }),
    ).toHaveAttribute('href', '/get-started');
    expect(replaceMock).not.toHaveBeenCalled();
  });

  it('hands authenticated onboarded users into the portal workspace', async () => {
    authState.isAuthenticated = true;
    authState.onboardingComplete = true;

    render(<DashboardPage />);

    await waitFor(() => {
      expect(replaceMock).toHaveBeenCalledWith('/portal/submit?createCycle=1');
    });

    expect(
      screen.getByRole('link', { name: /continue to reporting workspace/i }),
    ).toHaveAttribute('href', '/portal/submit?createCycle=1');
  });
});
