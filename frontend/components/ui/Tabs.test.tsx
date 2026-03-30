import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { Tabs } from './Tabs';

const tabs = [
  { value: 'overview', label: 'Overview', content: <p>Overview content</p> },
  { value: 'details', label: 'Details', content: <p>Details content</p> },
  { value: 'settings', label: 'Settings', content: <p>Settings content</p>, disabled: true },
];

describe('Tabs', () => {
  it('renders all tabs and selects the first tab by default', () => {
    render(<Tabs tabs={tabs} />);

    expect(screen.getByRole('tab', { name: 'Overview' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: 'Details' })).toHaveAttribute('aria-selected', 'false');
    expect(screen.getByRole('tabpanel')).toHaveTextContent('Overview content');
  });

  it('supports a controlled active tab', () => {
    render(<Tabs tabs={tabs} activeTab="details" />);

    expect(screen.getByRole('tab', { name: 'Details' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tabpanel')).toHaveTextContent('Details content');
    expect(screen.queryByText('Overview content')).not.toBeInTheDocument();
  });

  it('switches tabs on click and notifies onChange', () => {
    const onChange = vi.fn();
    render(<Tabs tabs={tabs} onChange={onChange} />);

    fireEvent.click(screen.getByRole('tab', { name: 'Details' }));

    expect(screen.getByRole('tabpanel')).toHaveTextContent('Details content');
    expect(onChange).toHaveBeenCalledWith('details');
  });

  it('marks disabled tabs as disabled', () => {
    render(<Tabs tabs={tabs} />);

    expect(screen.getByRole('tab', { name: 'Settings' })).toBeDisabled();
  });

  it('supports arrow, home, and end keyboard navigation while skipping disabled tabs', () => {
    render(<Tabs tabs={tabs} />);

    const overview = screen.getByRole('tab', { name: 'Overview' });
    const details = screen.getByRole('tab', { name: 'Details' });

    overview.focus();
    fireEvent.keyDown(overview, { key: 'ArrowRight' });
    expect(details).toHaveFocus();
    expect(screen.getByRole('tabpanel')).toHaveTextContent('Details content');

    fireEvent.keyDown(details, { key: 'ArrowRight' });
    expect(overview).toHaveFocus();
    expect(screen.getByRole('tabpanel')).toHaveTextContent('Overview content');

    fireEvent.keyDown(overview, { key: 'End' });
    expect(details).toHaveFocus();

    fireEvent.keyDown(details, { key: 'Home' });
    expect(overview).toHaveFocus();
  });

  it('supports left and up keyboard navigation', () => {
    render(<Tabs tabs={tabs} activeTab="details" />);

    const details = screen.getByRole('tab', { name: 'Details' });
    const overview = screen.getByRole('tab', { name: 'Overview' });

    details.focus();
    fireEvent.keyDown(details, { key: 'ArrowLeft' });
    expect(overview).toHaveFocus();

    fireEvent.keyDown(overview, { key: 'ArrowUp' });
    expect(details).toHaveFocus();
  });

  it('renders no panel when the active tab does not exist', () => {
    render(<Tabs tabs={tabs} activeTab="missing" />);

    expect(screen.queryByRole('tabpanel')).not.toBeInTheDocument();
  });

  it('uses an empty internal active value when there are no tabs', () => {
    render(<Tabs tabs={[]} />);

    expect(screen.queryByRole('tab')).not.toBeInTheDocument();
    expect(screen.queryByRole('tabpanel')).not.toBeInTheDocument();
  });

  it('ignores keyboard navigation when all tabs are disabled', () => {
    render(
      <Tabs
        tabs={[
          { value: 'disabled-1', label: 'Disabled 1', content: <p>One</p>, disabled: true },
          { value: 'disabled-2', label: 'Disabled 2', content: <p>Two</p>, disabled: true },
        ]}
      />,
    );

    const first = screen.getByRole('tab', { name: 'Disabled 1' });
    first.focus();
    fireEvent.keyDown(first, { key: 'End' });

    expect(first).toHaveFocus();
    expect(screen.getByRole('tabpanel')).toHaveTextContent('One');
  });
});
