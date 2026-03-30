import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ALMProvider, { useALM } from './ALMProvider';

const mocks = vi.hoisted(() => ({
  push: vi.fn(),
  replace: vi.fn(),
  getInstitutions: vi.fn(),
}));
let searchParams = new URLSearchParams();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mocks.push, replace: mocks.replace, back: vi.fn() }),
  useSearchParams: () => searchParams,
  usePathname: () => '/alm',
}));

vi.mock('@/lib/api', () => ({
  apiClient: {
    getInstitutions: mocks.getInstitutions,
  },
}));

const defaultInstitutions = [
      { id: 'inst-1', name: 'Test CU', type: 'credit_union', totalAssets: 100_000_000 },
      { id: 'inst-2', name: 'Second CU', type: 'bank', totalAssets: 250_000_000 },
];

function Consumer() {
  const { selectedId, setSelectedId, loading, institutions, refresh, institution, selectInstitution } = useALM();
  return (
    <div>
      <span data-testid="loading">{String(loading)}</span>
      <span data-testid="selectedId">{selectedId}</span>
      <span data-testid="count">{institutions.length}</span>
      <span data-testid="institution-name">{institution?.name ?? ''}</span>
      <button onClick={() => setSelectedId('inst-2')}>Change</button>
      <button onClick={() => selectInstitution('inst-1')}>Select first</button>
      <button onClick={() => void refresh()}>Refresh</button>
    </div>
  );
}

describe('ALMProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    searchParams = new URLSearchParams();
    mocks.getInstitutions.mockResolvedValue(defaultInstitutions);
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
    expect(screen.getByTestId('count').textContent).toBe('2');
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

    await waitFor(() => {
      expect(screen.getByTestId('selectedId').textContent).toBe('inst-2');
    });
    expect(mocks.replace).toHaveBeenCalled();
  });

  it('handles an unmatched URL id without overwriting the selection', async () => {
    searchParams = new URLSearchParams('id=missing');

    render(
      <ALMProvider>
        <Consumer />
      </ALMProvider>,
    );

    await screen.findByText('false');
    expect(screen.getByTestId('selectedId').textContent).toBe('missing');
    expect(screen.getByTestId('institution-name').textContent).toBe('');
  });

  it('preserves a matching URL institution id from the search params', async () => {
    searchParams = new URLSearchParams('id=inst-2');

    render(
      <ALMProvider>
        <Consumer />
      </ALMProvider>,
    );

    await screen.findByText('false');
    expect(screen.getByTestId('selectedId').textContent).toBe('inst-2');
    expect(mocks.replace).not.toHaveBeenCalled();
  });

  it('keeps loading false when the institution list is empty', async () => {
    mocks.getInstitutions.mockReset();
    mocks.getInstitutions.mockResolvedValue([]);

    render(
      <ALMProvider>
        <Consumer />
      </ALMProvider>,
    );

    await screen.findByText('false');
    expect(screen.getByTestId('count').textContent).toBe('0');
    expect(screen.getByTestId('selectedId').textContent).toBe('');
  });

  it('falls back to an empty institution list when the fetch fails', async () => {
    mocks.getInstitutions.mockReset();
    mocks.getInstitutions.mockRejectedValue(new Error('network failed'));

    render(
      <ALMProvider>
        <Consumer />
      </ALMProvider>,
    );

    await screen.findByText('false');
    expect(screen.getByTestId('count').textContent).toBe('0');
    expect(screen.getByTestId('selectedId').textContent).toBe('');
  });

  it('exposes default context values outside the provider', async () => {
    function OrphanConsumer() {
      const alm = useALM();
      return (
        <div>
          <span data-testid="orphan-loading">{String(alm.loading)}</span>
          <button onClick={() => alm.setSelectedId('noop')}>Set orphan</button>
          <button onClick={() => alm.selectInstitution('noop')}>Select orphan</button>
          <button onClick={() => void alm.refresh()}>Refresh orphan</button>
        </div>
      );
    }

    render(<OrphanConsumer />);

    expect(screen.getByTestId('orphan-loading').textContent).toBe('true');
    expect(() => {
      screen.getByRole('button', { name: 'Set orphan' }).click();
      screen.getByRole('button', { name: 'Select orphan' }).click();
      screen.getByRole('button', { name: 'Refresh orphan' }).click();
    }).not.toThrow();
  });
});
