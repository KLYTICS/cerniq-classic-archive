import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { EmptyState } from './EmptyState';

describe('EmptyState', () => {
  it('renders the title', () => {
    render(<EmptyState title="No results found" />);
    expect(screen.getByText('No results found')).toBeInTheDocument();
  });

  it('renders description when provided', () => {
    render(
      <EmptyState
        title="Empty"
        description="Try adjusting your filters"
      />,
    );
    expect(screen.getByText('Try adjusting your filters')).toBeInTheDocument();
  });

  it('does not render description when omitted', () => {
    const { container } = render(<EmptyState title="Empty" />);
    expect(container.querySelectorAll('p')).toHaveLength(0);
  });

  it('renders icon when provided', () => {
    render(
      <EmptyState
        title="No data"
        icon={<span data-testid="icon">Icon</span>}
      />,
    );
    expect(screen.getByTestId('icon')).toBeInTheDocument();
  });

  it('does not render icon wrapper when omitted', () => {
    const { container } = render(<EmptyState title="No data" />);
    // The icon wrapper has a specific class
    expect(container.querySelector('.rounded-full')).toBeNull();
  });

  it('renders action when provided', () => {
    render(
      <EmptyState
        title="Empty"
        action={<button>Create new</button>}
      />,
    );
    expect(screen.getByText('Create new')).toBeInTheDocument();
  });

  it('applies dashed border styling', () => {
    const { container } = render(<EmptyState title="Empty" />);
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper.className).toContain('border-dashed');
  });

  it('accepts custom className', () => {
    const { container } = render(
      <EmptyState title="Empty" className="my-custom-class" />,
    );
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper.className).toContain('my-custom-class');
  });
});
