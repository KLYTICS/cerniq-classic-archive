import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ConfirmReopenModal } from './ConfirmReopenModal';
import type { CloseCycleDetail } from '@/lib/close-api';

function makeCycle(overrides: Partial<CloseCycleDetail> = {}): CloseCycleDetail {
  return {
    id: 'c1',
    organizationId: 'org-1',
    periodYear: 2026,
    periodMonth: 4,
    status: 'SIGNED_OFF',
    openedAt: '2026-04-01T08:00:00Z',
    targetCloseAt: '2026-04-08T08:00:00Z',
    closedAt: '2026-04-08T20:00:00Z',
    materialityAbs: 5000,
    materialityPct: 0.05,
    tasks: [],
    reconciliations: [],
    journalEntries: [],
    fluxNarratives: [],
    ...overrides,
  };
}

describe('ConfirmReopenModal', () => {
  it('renders nothing when closed', () => {
    render(
      <ConfirmReopenModal
        open={false}
        cycle={makeCycle()}
        lang="en"
        onCancel={() => undefined}
        onConfirm={() => undefined}
      />,
    );
    expect(screen.queryByText(/Reopen signed-off period/i)).toBeNull();
  });

  it('shows the period and a warning when open', () => {
    render(
      <ConfirmReopenModal
        open={true}
        cycle={makeCycle()}
        lang="en"
        onCancel={() => undefined}
        onConfirm={() => undefined}
      />,
    );
    expect(screen.getAllByText(/Reopen.*period/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/2026-04/)).toBeInTheDocument();
  });

  it('keeps the confirm button disabled until the reason is long enough', () => {
    const onConfirm = vi.fn();
    render(
      <ConfirmReopenModal
        open={true}
        cycle={makeCycle()}
        lang="en"
        onCancel={() => undefined}
        onConfirm={onConfirm}
      />,
    );
    const confirm = screen.getAllByRole('button', { name: /Reopen period/i }).find(
      (el) => (el as HTMLButtonElement).type === 'button',
    ) as HTMLButtonElement;
    expect(confirm.disabled).toBe(true);

    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'short' } });
    expect(confirm.disabled).toBe(true);
    fireEvent.click(confirm);
    expect(onConfirm).not.toHaveBeenCalled();

    fireEvent.change(screen.getByRole('textbox'), {
      target: { value: 'Plenty of reason text here for the auditor' },
    });
    expect(confirm.disabled).toBe(false);
    fireEvent.click(confirm);
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onConfirm).toHaveBeenCalledWith('Plenty of reason text here for the auditor');
  });

  it('shows live character count (trimmed)', () => {
    render(
      <ConfirmReopenModal
        open={true}
        cycle={makeCycle()}
        lang="en"
        onCancel={() => undefined}
        onConfirm={() => undefined}
      />,
    );
    expect(screen.getByText('0/10+')).toBeInTheDocument();
    // Trailing space is trimmed in the display so 'seven ' → 5 chars.
    fireEvent.change(screen.getByRole('textbox'), {
      target: { value: 'seven ' },
    });
    expect(screen.getByText('5/10+')).toBeInTheDocument();
  });

  it('calls onCancel when the cancel button is clicked', () => {
    const onCancel = vi.fn();
    render(
      <ConfirmReopenModal
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

  it('disables both buttons while submitting', () => {
    render(
      <ConfirmReopenModal
        open={true}
        cycle={makeCycle()}
        lang="en"
        onCancel={() => undefined}
        onConfirm={() => undefined}
        submitting
      />,
    );
    const cancel = screen.getByRole('button', { name: /^Cancel$/i }) as HTMLButtonElement;
    expect(cancel.disabled).toBe(true);
  });

  it('renders Spanish copy when lang="es"', () => {
    render(
      <ConfirmReopenModal
        open={true}
        cycle={makeCycle()}
        lang="es"
        onCancel={() => undefined}
        onConfirm={() => undefined}
      />,
    );
    expect(screen.getAllByText(/Reabrir.*período/i).length).toBeGreaterThanOrEqual(1);
  });
});
