import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import Sidebar from './Sidebar';
import { __resetPinnedCacheForTesting } from '@/lib/alm/pinned';

const logoutMock = vi.fn();
const pushMock = vi.fn();

let pathnameMock = '/alm';

vi.mock('next/navigation', () => ({
  usePathname: () => pathnameMock,
  useRouter: () => ({
    push: pushMock,
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
    replace: vi.fn(),
  }),
}));

vi.mock('@/lib/store', () => ({
  useAuthStore: () => ({ logout: logoutMock }),
}));

vi.mock('@/lib/i18n', () => ({
  useTranslation: () => ({
    locale: 'en',
    t: (key: string) => {
      const dictionary: Record<string, string> = {
        'sidebar.description': 'ALM analysis, COSSEC compliance, and bilingual reports for cooperativas.',
        'sidebar.main': 'Main',
        'sidebar.enterprise': 'Enterprise',
        'sidebar.settings': 'Settings',
        'sidebar.dashboard': 'Dashboard',
        'sidebar.portfolios': 'Portfolios',
        'sidebar.riskAnalytics': 'Risk Analytics',
        'sidebar.executionQuality': 'Execution Quality',
        'sidebar.expenses': 'Expenses',
        'sidebar.almIntelligence': 'ALM Intelligence',
        'sidebar.profile': 'Profile',
        'sidebar.apiKeys': 'API Keys',
        'common.logout': 'Logout',
      };
      return dictionary[key] ?? key;
    },
  }),
}));

beforeEach(() => {
  pathnameMock = '/alm';
  pushMock.mockReset();
  logoutMock.mockReset();
  window.localStorage.removeItem('cerniq.alm.pinned.v1');
  __resetPinnedCacheForTesting();
});

describe('Sidebar pinned modules', () => {
  it('shows pinned modules above the category tree when storage already has pins', () => {
    window.localStorage.setItem('cerniq.alm.pinned.v1', JSON.stringify(['var', 'cecl']));

    render(<Sidebar open onClose={vi.fn()} />);

    expect(screen.getByText('Pinned')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Clear/i })).toBeInTheDocument();
    expect(screen.getAllByText('VaR Suite').length).toBeGreaterThan(0);
    expect(screen.getAllByText(/CECL/i).length).toBeGreaterThan(0);
  });

  it('pins a module from the ALM tree and updates the section immediately', async () => {
    const user = userEvent.setup();

    render(<Sidebar open onClose={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: 'Pin VaR Suite' }));

    expect(screen.getByText('Pinned')).toBeInTheDocument();
    expect(screen.queryByText(/Star up to 8 modules/i)).not.toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Unpin VaR Suite' }).length).toBeGreaterThan(0);
  });

  it('clears pinned modules and falls back to the empty-state hint', async () => {
    const user = userEvent.setup();
    window.localStorage.setItem('cerniq.alm.pinned.v1', JSON.stringify(['var']));

    render(<Sidebar open onClose={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: /Clear/i }));

    expect(screen.queryByRole('button', { name: /Clear/i })).not.toBeInTheDocument();
    expect(screen.getByText(/Star up to 8 modules to keep them at the top/i)).toBeInTheDocument();
  });
});
