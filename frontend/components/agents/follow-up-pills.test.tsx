import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import FollowUpPills, {
  getDefaultSuggestions,
  type FollowUpSuggestion,
} from './follow-up-pills';

/* ── Fixtures ───────────────────────────────────────────────────────────────── */

const mockSuggestions: FollowUpSuggestion[] = [
  { id: 'pill1', textEn: 'First action', textEs: 'Primera accion', icon: 'search' },
  { id: 'pill2', textEn: 'Second action', textEs: 'Segunda accion', icon: 'trending_up' },
  { id: 'pill3', textEn: 'Third action', textEs: 'Tercera accion', icon: 'activity' },
  { id: 'pill4', textEn: 'Fourth action', textEs: 'Cuarta accion', icon: 'bar_chart' },
];

/* ── Tests ───────────────────────────────────────────────────────────────────── */

describe('FollowUpPills', () => {
  it('renders 4 pills', () => {
    const onSelect = vi.fn();
    render(
      <FollowUpPills
        suggestions={mockSuggestions}
        onSelect={onSelect}
        animate={false}
      />,
    );

    expect(screen.getByTestId('pill-pill1')).toBeInTheDocument();
    expect(screen.getByTestId('pill-pill2')).toBeInTheDocument();
    expect(screen.getByTestId('pill-pill3')).toBeInTheDocument();
    expect(screen.getByTestId('pill-pill4')).toBeInTheDocument();
  });

  it('displays English text by default', () => {
    const onSelect = vi.fn();
    render(
      <FollowUpPills
        suggestions={mockSuggestions}
        onSelect={onSelect}
        animate={false}
      />,
    );

    expect(screen.getByText('First action')).toBeInTheDocument();
    expect(screen.getByText('Second action')).toBeInTheDocument();
    expect(screen.getByText('Third action')).toBeInTheDocument();
    expect(screen.getByText('Fourth action')).toBeInTheDocument();
  });

  it('displays Spanish text when locale is es', () => {
    const onSelect = vi.fn();
    render(
      <FollowUpPills
        suggestions={mockSuggestions}
        onSelect={onSelect}
        locale="es"
        animate={false}
      />,
    );

    expect(screen.getByText('Primera accion')).toBeInTheDocument();
    expect(screen.getByText('Segunda accion')).toBeInTheDocument();
    expect(screen.getByText('Tercera accion')).toBeInTheDocument();
    expect(screen.getByText('Cuarta accion')).toBeInTheDocument();
  });

  it('fires onSelect with correct suggestion when clicked', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(
      <FollowUpPills
        suggestions={mockSuggestions}
        onSelect={onSelect}
        animate={false}
      />,
    );

    await user.click(screen.getByTestId('pill-pill2'));

    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith(mockSuggestions[1]);
  });

  it('fires onSelect for each pill independently', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(
      <FollowUpPills
        suggestions={mockSuggestions}
        onSelect={onSelect}
        animate={false}
      />,
    );

    await user.click(screen.getByTestId('pill-pill1'));
    await user.click(screen.getByTestId('pill-pill4'));

    expect(onSelect).toHaveBeenCalledTimes(2);
    expect(onSelect).toHaveBeenNthCalledWith(1, mockSuggestions[0]);
    expect(onSelect).toHaveBeenNthCalledWith(2, mockSuggestions[3]);
  });

  it('renders nothing when suggestions array is empty', () => {
    const onSelect = vi.fn();
    const { container } = render(
      <FollowUpPills suggestions={[]} onSelect={onSelect} animate={false} />,
    );

    expect(container.innerHTML).toBe('');
  });

  it('renders the aria-label group for accessibility (EN)', () => {
    const onSelect = vi.fn();
    render(
      <FollowUpPills
        suggestions={mockSuggestions}
        onSelect={onSelect}
        animate={false}
      />,
    );

    expect(screen.getByRole('group', { name: 'Follow-up suggestions' })).toBeInTheDocument();
  });

  it('renders the aria-label group for accessibility (ES)', () => {
    const onSelect = vi.fn();
    render(
      <FollowUpPills
        suggestions={mockSuggestions}
        onSelect={onSelect}
        locale="es"
        animate={false}
      />,
    );

    expect(screen.getByRole('group', { name: 'Sugerencias de seguimiento' })).toBeInTheDocument();
  });
});

/* ── getDefaultSuggestions helper ────────────────────────────────────────────── */

describe('getDefaultSuggestions', () => {
  it('returns 4 suggestions for risk_alert context', () => {
    const suggestions = getDefaultSuggestions('risk_alert', 'en');
    expect(suggestions).toHaveLength(4);
    expect(suggestions[0].textEn).toBe('Drill into details');
    expect(suggestions[2].textEn).toBe('Run stress test');
  });

  it('returns 4 suggestions for alm_summary context', () => {
    const suggestions = getDefaultSuggestions('alm_summary', 'en');
    expect(suggestions).toHaveLength(4);
    expect(suggestions[0].textEn).toBe('Compare to peers');
    expect(suggestions[2].textEn).toBe('Generate board report');
  });

  it('returns 4 suggestions for compliance context', () => {
    const suggestions = getDefaultSuggestions('compliance', 'en');
    expect(suggestions).toHaveLength(4);
    expect(suggestions[0].textEn).toBe('View findings');
    expect(suggestions[3].textEn).toBe('Show remediation plan');
  });

  it('returns 4 suggestions for default context', () => {
    const suggestions = getDefaultSuggestions('default', 'en');
    expect(suggestions).toHaveLength(4);
    expect(suggestions[0].textEn).toBe('What are the top risks?');
  });

  it('returns different suggestions for different contexts', () => {
    const riskAlert = getDefaultSuggestions('risk_alert', 'en');
    const almSummary = getDefaultSuggestions('alm_summary', 'en');
    const compliance = getDefaultSuggestions('compliance', 'en');
    const defaultCtx = getDefaultSuggestions('default', 'en');

    const ids = [riskAlert, almSummary, compliance, defaultCtx].map((set) =>
      set.map((s) => s.id).join(','),
    );
    // All 4 sets should be unique
    expect(new Set(ids).size).toBe(4);
  });

  it('suggestions have both English and Spanish text', () => {
    const suggestions = getDefaultSuggestions('risk_alert', 'es');
    suggestions.forEach((s) => {
      expect(s.textEn).toBeTruthy();
      expect(s.textEs).toBeTruthy();
      expect(s.textEn).not.toBe(s.textEs);
    });
  });
});
