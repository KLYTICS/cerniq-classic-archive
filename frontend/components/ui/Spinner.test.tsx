import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Spinner } from './Spinner';

describe('Spinner', () => {
  it('renders with role="status"', () => {
    render(<Spinner />);
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('has accessible label', () => {
    render(<Spinner />);
    expect(screen.getByLabelText('Loading')).toBeInTheDocument();
  });

  it('applies animate-spin class', () => {
    render(<Spinner />);
    const svg = screen.getByRole('status');
    expect(svg.className).toContain('animate-spin');
  });

  it('applies medium size by default', () => {
    render(<Spinner />);
    const svg = screen.getByRole('status');
    expect(svg.className).toContain('h-6');
    expect(svg.className).toContain('w-6');
  });

  it('applies small size', () => {
    render(<Spinner size="sm" />);
    const svg = screen.getByRole('status');
    expect(svg.className).toContain('h-4');
    expect(svg.className).toContain('w-4');
  });

  it('applies large size', () => {
    render(<Spinner size="lg" />);
    const svg = screen.getByRole('status');
    expect(svg.className).toContain('h-10');
    expect(svg.className).toContain('w-10');
  });

  it('accepts custom className', () => {
    render(<Spinner className="text-blue-500" />);
    const svg = screen.getByRole('status');
    expect(svg.className).toContain('text-blue-500');
  });
});
