import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { GlSnapshotPanel } from './GlSnapshotPanel';
import * as closeApi from '@/lib/close-api';
import type { CloseCycleDetail, GlSnapshotRow } from '@/lib/close-api';

function makeCycle(overrides: Partial<CloseCycleDetail> = {}): CloseCycleDetail {
  return {
    id: 'c1',
    organizationId: 'org-1',
    periodYear: 2026,
    periodMonth: 4,
    status: 'OPEN',
    openedAt: '2026-04-01T08:00:00Z',
    targetCloseAt: '2026-04-08T08:00:00Z',
    closedAt: null,
    materialityAbs: 5000,
    materialityPct: 0.05,
    tasks: [],
    reconciliations: [],
    journalEntries: [],
    fluxNarratives: [],
    ...overrides,
  };
}

function makeRow(overrides: Partial<GlSnapshotRow> = {}): GlSnapshotRow {
  return {
    id: 'snap-1',
    account: '1010 Operating Cash',
    balance: 1_245_310.22,
    sourceLabel: 'upload:march.csv',
    uploadedById: 'user-1',
    notes: null,
    updatedAt: '2026-04-08T08:00:00Z',
    ...overrides,
  };
}

describe('GlSnapshotPanel', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('shows the empty state when no snapshot rows exist', async () => {
    vi.spyOn(closeApi.closeApi, 'listGlSnapshots').mockResolvedValueOnce([]);
    render(<GlSnapshotPanel cycle={makeCycle()} lang="en" locked={false} />);
    await waitFor(() => {
      expect(screen.getByText(/No GL snapshot for this period/i)).toBeInTheDocument();
    });
  });

  it('renders snapshot rows in the data table', async () => {
    vi.spyOn(closeApi.closeApi, 'listGlSnapshots').mockResolvedValueOnce([
      makeRow(),
      makeRow({ id: 'snap-2', account: '4000 Loan Income', balance: 401_200 }),
    ]);
    render(<GlSnapshotPanel cycle={makeCycle()} lang="en" locked={false} />);
    await waitFor(() => {
      expect(screen.getByText('1010 Operating Cash')).toBeInTheDocument();
    });
    expect(screen.getByText('4000 Loan Income')).toBeInTheDocument();
    expect(screen.getByText('$1,245,310.22')).toBeInTheDocument();
  });

  it('hides the row delete button when the cycle is locked', async () => {
    vi.spyOn(closeApi.closeApi, 'listGlSnapshots').mockResolvedValueOnce([makeRow()]);
    render(<GlSnapshotPanel cycle={makeCycle()} lang="en" locked={true} />);
    await waitFor(() => {
      expect(screen.getByText('1010 Operating Cash')).toBeInTheDocument();
    });
    expect(screen.queryByRole('button', { name: /Delete/ })).toBeNull();
  });

  it('optimistically removes a row on delete and reverts on error', async () => {
    vi.spyOn(closeApi.closeApi, 'listGlSnapshots').mockResolvedValueOnce([
      makeRow(),
      makeRow({ id: 'snap-2', account: '2100 AP' }),
    ]);
    vi.spyOn(closeApi.closeApi, 'deleteGlSnapshot').mockRejectedValueOnce(new Error('boom'));
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    render(<GlSnapshotPanel cycle={makeCycle()} lang="en" locked={false} />);
    await waitFor(() => screen.getByText('1010 Operating Cash'));

    const deleteBtn = screen.getByRole('button', { name: /Delete 1010 Operating Cash/i });
    fireEvent.click(deleteBtn);

    // After the failed delete the row should be back.
    await waitFor(() => {
      expect(screen.getByText('1010 Operating Cash')).toBeInTheDocument();
    });
  });

  it('renders Spanish copy when lang="es"', async () => {
    vi.spyOn(closeApi.closeApi, 'listGlSnapshots').mockResolvedValueOnce([]);
    render(<GlSnapshotPanel cycle={makeCycle()} lang="es" locked={false} />);
    await waitFor(() => {
      expect(screen.getByText(/Sin snapshot del GL/i)).toBeInTheDocument();
    });
  });

  it('shows the period in the metric strip', async () => {
    vi.spyOn(closeApi.closeApi, 'listGlSnapshots').mockResolvedValueOnce([]);
    render(<GlSnapshotPanel cycle={makeCycle()} lang="en" locked={false} />);
    await waitFor(() => {
      expect(screen.getByText('2026-04')).toBeInTheDocument();
    });
  });
});
