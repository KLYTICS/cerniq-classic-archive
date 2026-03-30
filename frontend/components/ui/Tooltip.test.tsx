import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Tooltip } from './Tooltip';

describe('Tooltip', () => {
  it('renders the trigger element', () => {
    render(
      <Tooltip content="Help text">
        <button>Hover me</button>
      </Tooltip>,
    );
    expect(screen.getByText('Hover me')).toBeInTheDocument();
  });

  it('does not show tooltip content by default', () => {
    render(
      <Tooltip content="Help text">
        <button>Hover me</button>
      </Tooltip>,
    );
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('shows tooltip on mouse enter and hides on mouse leave', () => {
    render(
      <Tooltip content="Help text">
        <button>Hover me</button>
      </Tooltip>,
    );

    const wrapper = screen.getByText('Hover me').parentElement!;
    fireEvent.mouseEnter(wrapper);
    expect(screen.getByRole('tooltip')).toHaveTextContent('Help text');

    fireEvent.mouseLeave(wrapper);
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('shows tooltip on focus and hides on blur', () => {
    render(
      <Tooltip content="Keyboard help" position="right">
        <button>Focus me</button>
      </Tooltip>,
    );

    const wrapper = screen.getByText('Focus me').parentElement!;
    fireEvent.focus(wrapper);
    expect(screen.getByRole('tooltip')).toHaveTextContent('Keyboard help');
    expect(screen.getByRole('tooltip')).toHaveClass('left-full');

    fireEvent.blur(wrapper);
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('applies custom positioning and class names', () => {
    render(
      <Tooltip content="Left help" position="left" className="desk-tooltip">
        <button>Custom tooltip</button>
      </Tooltip>,
    );

    const wrapper = screen.getByText('Custom tooltip').parentElement!;
    fireEvent.mouseEnter(wrapper);

    const tooltip = screen.getByRole('tooltip');
    expect(tooltip).toHaveClass('right-full');
    expect(tooltip).toHaveClass('desk-tooltip');
  });
});
