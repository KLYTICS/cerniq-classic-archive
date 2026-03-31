import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import type { AnchorHTMLAttributes, ReactNode } from 'react';
import PortalLayout from './layout';
import {
  ACCESS_TOKEN_KEY,
  AUTH_USER_STORAGE_KEY,
  PORTAL_USER_STORAGE_KEY,
} from '@/lib/auth-storage';

const mockReplace = vi.fn();
const mockPathname = vi.fn();
const fetchMock = vi.fn();

vi.mock('next/navigation', () => ({
  usePathname: () => mockPathname(),
  useRouter: () => ({ replace: mockReplace, push: vi.fn() }),
}));

vi.mock('next/link', () => ({
  default: ({
    children,
    ...props
  }: { children: ReactNode } & AnchorHTMLAttributes<HTMLAnchorElement>) => <a {...props}>{children}</a>,
}));

vi.mock('@/components/ErrorBoundary', () => ({
  ErrorBoundary: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

vi.mock('@/components/brand/CerniqLogo', () => ({
  CerniqLockup: () => <div data-testid="cerniq-lockup" />,
}));

vi.mock('@/components/portal/PortalPaywall', () => ({
  default: () => <div data-testid="portal-paywall" />,
}));

describe('PortalLayout', () => {
  beforeEach(() => {
    mockReplace.mockReset();
    mockPathname.mockReturnValue('/portal');
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  it('redirects to portal login once and clears stale auth when profile loading fails', async () => {
    window.localStorage.setItem(
      AUTH_USER_STORAGE_KEY,
      JSON.stringify({ id: 'stale-user', email: 'stale@cerniq.io' }),
    );
    window.localStorage.setItem(PORTAL_USER_STORAGE_KEY, 'true');
    window.sessionStorage.setItem(ACCESS_TOKEN_KEY, 'stale-token');
    fetchMock
      .mockResolvedValueOnce({ ok: false, json: async () => ({}) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ tier: 'free', status: 'active' }) });

    const { rerender } = render(
      <PortalLayout>
        <div>portal</div>
      </PortalLayout>,
    );

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/portal/login');
    });

    rerender(
      <PortalLayout>
        <div>portal</div>
      </PortalLayout>,
    );

    expect(mockReplace).toHaveBeenCalledTimes(1);
    expect(window.localStorage.getItem(AUTH_USER_STORAGE_KEY)).toBeNull();
    expect(window.localStorage.getItem(PORTAL_USER_STORAGE_KEY)).toBeNull();
    expect(window.sessionStorage.getItem(ACCESS_TOKEN_KEY)).toBeNull();
  });
});
