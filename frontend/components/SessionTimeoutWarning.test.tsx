import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import SessionTimeoutWarning from './SessionTimeoutWarning';

const pushMock = vi.fn();
const logoutMock = vi.fn(() => Promise.resolve());
const useSessionTimeoutMock = vi.fn();
const resetTimersMock = vi.fn();

let authState = {
  isAuthenticated: true,
  authRevision: 1,
};

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock }),
}));

vi.mock('@/hooks/useSessionTimeout', () => ({
  useSessionTimeout: (options: unknown) => {
    useSessionTimeoutMock(options);
    return { resetTimers: resetTimersMock, lastActivity: { current: Date.now() } };
  },
}));

vi.mock('@/lib/store', () => ({
  useAuthStore: (
    selector: (state: {
      isAuthenticated: boolean;
      authRevision: number;
      logout: typeof logoutMock;
    }) => unknown,
  ) =>
    selector({
      ...authState,
      logout: logoutMock,
    }),
}));

vi.mock('lucide-react', () => ({
  Clock: () => <svg data-testid="clock-icon" />,
}));

describe('SessionTimeoutWarning', () => {
  beforeEach(() => {
    pushMock.mockReset();
    logoutMock.mockClear();
    useSessionTimeoutMock.mockReset();
    resetTimersMock.mockReset();
    authState = { isAuthenticated: true, authRevision: 1 };
    localStorage.clear();
    sessionStorage.clear();
  });

  it('invalidates the session through logout and redirects on timeout', async () => {
    render(<SessionTimeoutWarning />);

    const options = useSessionTimeoutMock.mock.calls[0]?.[0] as {
      onTimeout: () => void;
    };

    options.onTimeout();
    await Promise.resolve();

    expect(logoutMock).toHaveBeenCalledTimes(1);
    expect(pushMock).toHaveBeenCalledWith('/login?reason=timeout');
  });

  it('does not render when session timeout protection is disabled', () => {
    render(<SessionTimeoutWarning enabled={false} />);

    expect(useSessionTimeoutMock.mock.calls[0]?.[0]).toMatchObject({
      enabled: false,
    });
    expect(screen.queryByRole('alertdialog')).toBeNull();
  });

  it('does not render when the user is unauthenticated', () => {
    authState = { isAuthenticated: false, authRevision: 1 };

    render(<SessionTimeoutWarning />);

    expect(useSessionTimeoutMock.mock.calls[0]?.[0]).toMatchObject({
      enabled: false,
    });
    expect(screen.queryByRole('alertdialog')).toBeNull();
  });

  it('shows the warning on session-warning callbacks and resets timers when dismissed', () => {
    render(<SessionTimeoutWarning timeoutMinutes={45} />);

    const options = useSessionTimeoutMock.mock.calls[0]?.[0] as {
      onWarning: () => void;
    };

    act(() => {
      options.onWarning();
    });

    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    expect(screen.getByText('Your session will end in 5 minutes')).toBeInTheDocument();
    expect(
      screen.getByText(
        /inactive sessions are automatically ended after 45 minutes/i,
      ),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Continue Working' }));

    expect(resetTimersMock).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('alertdialog')).toBeNull();
  });

  it('logs out immediately when the user clicks the log out action', async () => {
    render(<SessionTimeoutWarning />);

    const options = useSessionTimeoutMock.mock.calls[0]?.[0] as {
      onWarning: () => void;
    };

    act(() => {
      options.onWarning();
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Log Out' }));
      await Promise.resolve();
    });

    expect(logoutMock).toHaveBeenCalledTimes(1);
    expect(pushMock).toHaveBeenCalledWith('/login?reason=timeout');
  });
});
