import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Card } from './Card';

describe('Card', () => {
  it('renders children', () => {
    render(<Card><p>Card content</p></Card>);
    expect(screen.getByText('Card content')).toBeInTheDocument();
  });

  it('renders title when provided', () => {
    render(<Card title="Portfolio Summary"><p>Body</p></Card>);
    expect(screen.getByText('Portfolio Summary')).toBeInTheDocument();
  });

  it('renders subtitle when provided', () => {
    render(
      <Card title="Title" subtitle="Subtitle text">
        <p>Body</p>
      </Card>,
    );
    expect(screen.getByText('Subtitle text')).toBeInTheDocument();
  });

  it('renders actions when provided', () => {
    render(
      <Card title="Report" actions={<button>Export</button>}>
        <p>Body</p>
      </Card>,
    );
    expect(screen.getByText('Export')).toBeInTheDocument();
  });

  it('applies medium padding by default', () => {
    const { container } = render(<Card><p>Body</p></Card>);
    const card = container.firstChild as HTMLElement;
    expect(card.className).toContain('p-5');
  });

  it('applies small padding', () => {
    const { container } = render(<Card padding="sm"><p>Body</p></Card>);
    const card = container.firstChild as HTMLElement;
    expect(card.className).toContain('p-4');
  });

  it('applies large padding', () => {
    const { container } = render(<Card padding="lg"><p>Body</p></Card>);
    const card = container.firstChild as HTMLElement;
    expect(card.className).toContain('p-6');
  });

  it('applies hover classes when hoverable', () => {
    const { container } = render(<Card hoverable><p>Body</p></Card>);
    const card = container.firstChild as HTMLElement;
    expect(card.className).toContain('hover:-translate-y-0.5');
    expect(card.className).toContain('hover:shadow-md');
  });

  it('does not apply hover classes by default', () => {
    const { container } = render(<Card><p>Body</p></Card>);
    const card = container.firstChild as HTMLElement;
    expect(card.className).not.toContain('hover:-translate-y-0.5');
  });

  it('applies base card styles', () => {
    const { container } = render(<Card><p>Body</p></Card>);
    const card = container.firstChild as HTMLElement;
    expect(card.className).toContain('rounded-2xl');
    expect(card.className).toContain('border');
    expect(card.className).toContain('shadow-sm');
  });

  it('accepts custom className', () => {
    const { container } = render(
      <Card className="mt-8"><p>Body</p></Card>,
    );
    const card = container.firstChild as HTMLElement;
    expect(card.className).toContain('mt-8');
  });
});
