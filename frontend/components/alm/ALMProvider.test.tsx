import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ALMProvider, { useALM } from './ALMProvider';

const pushMock = vi.fn();
const replaceMock = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock, replace: replaceMock, back: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/alm',
}));

vi.mock('@/lib/api', () => ({
  apiClient: {
    getInstitutions: vi.fn().mockResolvedValue([
      { id: 'inst-1', name: 'Test CU', type: 'credit_union', totalAssets: 100_000_000 },
    ]),
  },
}));

function Consumer() {
  const { selectedId, setSelectedId, loading, institutions } = useALM();
  return (
    <div>
      <span data-testid="loading">{String(loading)}</span>
      <span data-testid="selectedId">{selectedId}</span>
      <span data-testid="count">{institutions.length}</span>
      <button onClick={() => setSelectedId('inst-2')}>Change</button>
    </div>
  );
}

describe('ALMProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('provides context values to children', async () => {
    render(
      <ALMProvider>
        <Consumer />
      </ALMProvider>,
    );

    // Initially loading
    expect(screen.getByTestId('loading').textContent).toBe('true');

    // After fetch resolves, loading becomes false and institutions are available
    await screen.findByText('false');
    expect(screen.getByTestId('count').textContent).toBe('1');
  });

  it('selects the first institution by default when none specified in URL', async () => {
    render(
      <ALMProvider>
        <Consumer />
      </ALMProvider>,
    );

    await screen.findByText('false');
    expect(screen.getByTestId('selectedId').textContent).toBe('inst-1');
  });

  it('updates selectedId and URL when setSelectedId is called', async () => {
    const user = userEvent.setup();
    render(
      <ALMProvider>
        <Consumer />
      </ALMProvider>,
    );

    await screen.findByText('false');
    await user.click(screen.getByRole('button', { name: /change/i }));

    expect(screen.getByTestId('selectedId').textContent).toBe('inst-2');
    expect(replaceMock).toHaveBeenCalled();
  });
});
