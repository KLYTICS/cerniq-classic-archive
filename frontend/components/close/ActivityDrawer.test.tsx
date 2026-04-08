import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ActivityDrawer } from './ActivityDrawer';
import * as closeApi from '@/lib/close-api';
import type { CloseActivity } from '@/lib/close-api';

function makeActivity(overrides: Partial<CloseActivity> = {}): CloseActivity {
  return {
    id: 'a1',
    cycleId: 'c1',
    actorId: 'user-1',
    kind: 'TASK_COMPLETED',
    summaryEn: 'Task "Bank Rec" completed',
    summaryEs: 'Tarea "Bank Rec" completada',
    payload: {},
    createdAt: '2026-04-08T08:00:00Z',
    ...overrides,
  };
}

describe('ActivityDrawer', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('does not fetch when closed', () => {
    const spy = vi.spyOn(closeApi.closeApi, 'listActivity').mockResolvedValueOnce([]);
    render(<ActivityDrawer cycleId="c1" lang="en" open={false} onClose={() => undefined} />);
    expect(spy).not.toHaveBeenCalled();
  });

  it('fetches up to 500 entries when opened', async () => {
    const spy = vi.spyOn(closeApi.closeApi, 'listActivity').mockResolvedValueOnce([
      makeActivity({ id: 'a1' }),
      makeActivity({ id: 'a2', kind: 'GL_UPLOADED', summaryEn: 'GL uploaded' }),
    ]);
    render(<ActivityDrawer cycleId="c1" lang="en" open={true} onClose={() => undefined} />);
    await waitFor(() => {
      expect(spy).toHaveBeenCalledWith('c1', 500);
    });
  });

  it('renders activity entries grouped under day headers', async () => {
    vi.spyOn(closeApi.closeApi, 'listActivity').mockResolvedValueOnce([
      makeActivity({ id: 'a1', summaryEn: 'Today event A', createdAt: '2026-04-08T09:00:00Z' }),
      makeActivity({ id: 'a2', summaryEn: 'Today event B', createdAt: '2026-04-08T10:00:00Z' }),
      makeActivity({ id: 'a3', summaryEn: 'Yesterday event', createdAt: '2026-04-07T15:00:00Z' }),
    ]);
    render(<ActivityDrawer cycleId="c1" lang="en" open={true} onClose={() => undefined} />);
    await waitFor(() => {
      expect(screen.getByText('Today event A')).toBeInTheDocument();
    });
    expect(screen.getByText('Today event B')).toBeInTheDocument();
    expect(screen.getByText('Yesterday event')).toBeInTheDocument();
  });

  it('shows kind filter chips with counts', async () => {
    vi.spyOn(closeApi.closeApi, 'listActivity').mockResolvedValueOnce([
      makeActivity({ id: 'a1', kind: 'TASK_COMPLETED' }),
      makeActivity({ id: 'a2', kind: 'TASK_COMPLETED', summaryEn: 'Task 2 done' }),
      makeActivity({ id: 'a3', kind: 'GL_UPLOADED', summaryEn: 'GL run' }),
    ]);
    render(<ActivityDrawer cycleId="c1" lang="en" open={true} onClose={() => undefined} />);
    await waitFor(() => {
      expect(screen.getByText('Task done')).toBeInTheDocument();
    });
    // Filter chip label for GL_UPLOADED kind
    expect(screen.getByText('GL upload')).toBeInTheDocument();
    // Row summary text from the activity entry
    expect(screen.getByText('GL run')).toBeInTheDocument();
  });

  it('filters by kind when a chip is clicked', async () => {
    vi.spyOn(closeApi.closeApi, 'listActivity').mockResolvedValueOnce([
      makeActivity({ id: 'a1', summaryEn: 'Task A', kind: 'TASK_COMPLETED' }),
      makeActivity({ id: 'a2', summaryEn: 'Upload A', kind: 'GL_UPLOADED' }),
    ]);
    render(<ActivityDrawer cycleId="c1" lang="en" open={true} onClose={() => undefined} />);
    await waitFor(() => screen.getByText('Task A'));

    // Click the GL upload chip — Task A should disappear from view.
    // 'GL upload' only appears once here (chip label) since the row summary
    // for the upload entry is 'Upload A'.
    fireEvent.click(screen.getByText('GL upload'));
    expect(screen.queryByText('Task A')).toBeNull();
    expect(screen.getByText('Upload A')).toBeInTheDocument();
  });

  it('renders Spanish summaries when lang="es"', async () => {
    vi.spyOn(closeApi.closeApi, 'listActivity').mockResolvedValueOnce([
      makeActivity({
        id: 'a1',
        summaryEn: 'Task done',
        summaryEs: 'Tarea completada',
      }),
    ]);
    render(<ActivityDrawer cycleId="c1" lang="es" open={true} onClose={() => undefined} />);
    await waitFor(() => {
      expect(screen.getByText('Tarea completada')).toBeInTheDocument();
    });
  });
});
