import { describe, expect, it, vi } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import type { AnchorHTMLAttributes, ReactNode, SVGProps } from 'react';
import PortalLogin from './page';

const mockReplace = vi.fn();
const mockUseAuthStore = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mockReplace }),
}));

vi.mock('next/link', () => ({
  default: ({
    children,
    ...props
  }: { children: ReactNode } & AnchorHTMLAttributes<HTMLAnchorElement>) => <a {...props}>{children}</a>,
}));

vi.mock('@/lib/store', () => ({
  useAuthStore: (selector: (state: { initialized: boolean; isAuthenticated: boolean }) => unknown) =>
    selector(mockUseAuthStore()),
}));

vi.mock('@/lib/analytics', () => ({
  analytics: { track: vi.fn() },
  EVENTS: { PORTAL_LOGIN_REQUESTED: 'portal_login_requested' },
}));

vi.mock('lucide-react', () => ({
  Mail: (props: SVGProps<SVGSVGElement>) => <svg {...props} />,
  ArrowLeft: (props: SVGProps<SVGSVGElement>) => <svg {...props} />,
  CheckCircle: (props: SVGProps<SVGSVGElement>) => <svg {...props} />,
}));

describe('PortalLogin', () => {
  it('redirects authenticated users to the portal home', async () => {
    mockReplace.mockReset();
    mockUseAuthStore.mockReturnValue({
      initialized: true,
      isAuthenticated: true,
    });

    render(<PortalLogin />);

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/portal');
    });
  });
});
