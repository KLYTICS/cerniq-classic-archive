import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ConfirmSignOffModal } from './ConfirmSignOffModal';
import type { CloseCycleDetail } from '@/lib/close-api';

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
    tasks: [
      { id: '1', kind: 'cutoff', titleEn: 'Cutoff', titleEs: 'Corte', ownerId: null, dueAt: null, status: 'DONE', blockedByIds: [], evidenceUrls: [], completedAt: null },
    ],
    reconciliations: [
      { id: '1', account: '1010', reconType: 'BANK', glBalance: 0, externalBalance: 0, difference: 0, unmatchedItems: [], status: 'TIE' },
    ],
    journalEntries: [],
    fluxNarratives: [],
    ...overrides,
  };
}

describe('ConfirmSignOffModal', () => {
  it('renders nothing when closed', () => {
    render(
      <ConfirmSignOffModal
        open={false}
        cycle={makeCycle()}
        lang="en"
        onCancel={() => undefined}
        onConfirm={() => undefined}
      />,
    );
    expect(screen.queryByText(/Lock close period/i)).toBeNull();
  });

  it('shows the destructive-action warning and counts when open', () => {
    render(
      <ConfirmSignOffModal
        open={true}
        cycle={makeCycle()}
        lang="en"
        onCancel={() => undefined}
        onConfirm={() => undefined}
      />,
    );
    expect(screen.getByText(/Lock close period/i)).toBeInTheDocument();
    expect(screen.getByText(/destructive action/i)).toBeInTheDocument();
    expect(screen.getByText('2026-04')).toBeInTheDocument();
  });

  it('calls onCancel when the cancel button is clicked', () => {
    const onCancel = vi.fn();
    render(
      <ConfirmSignOffModal
        open={true}
        cycle={makeCycle()}
        lang="en"
        onCancel={onCancel}
        onConfirm={() => undefined}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /^Cancel$/i }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('calls onConfirm only after the confirm button is clicked', () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    render(
      <ConfirmSignOffModal
        open={true}
        cycle={makeCycle()}
        lang="en"
        onCancel={onCancel}
        onConfirm={onConfirm}
      />,
    );
    // Sanity: no accidental firing on mount
    expect(onConfirm).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: /Lock period/i }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onCancel).not.toHaveBeenCalled();
  });

  it('disables both buttons while submitting', () => {
    render(
      <ConfirmSignOffModal
        open={true}
        cycle={makeCycle()}
        lang="en"
        onCancel={() => undefined}
        onConfirm={() => undefined}
        submitting
      />,
    );
    const cancel = screen.getByRole('button', { name: /^Cancel$/i }) as HTMLButtonElement;
    const confirm = screen.getByRole('button', { name: /Lock period/i }) as HTMLButtonElement;
    expect(cancel.disabled).toBe(true);
    expect(confirm.disabled).toBe(true);
  });

  it('renders Spanish copy when lang="es"', () => {
    render(
      <ConfirmSignOffModal
        open={true}
        cycle={makeCycle()}
        lang="es"
        onCancel={() => undefined}
        onConfirm={() => undefined}
      />,
    );
    // "Cerrar período" appears twice (modal title + confirm button label)
    expect(screen.getAllByText(/Cerrar período/i).length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText(/destructiva/i)).toBeInTheDocument();
  });

  it('formats materiality in USD + percent', () => {
    render(
      <ConfirmSignOffModal
        open={true}
        cycle={makeCycle({ materialityAbs: 12_500, materialityPct: 0.075 })}
        lang="en"
        onCancel={() => undefined}
        onConfirm={() => undefined}
      />,
    );
    expect(screen.getByText(/\$12,500.*7\.5%/)).toBeInTheDocument();
  });
});
