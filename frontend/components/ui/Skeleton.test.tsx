import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { Skeleton } from './Skeleton';

describe('Skeleton', () => {
  it('renders rectangular variant by default', () => {
    const { container } = render(<Skeleton />);
    const el = container.firstChild as HTMLElement;
    expect(el.className).toContain('rounded-lg');
    expect(el.className).toContain('animate-pulse');
  });

  it('applies animate-pulse class', () => {
    const { container } = render(<Skeleton />);
    const el = container.firstChild as HTMLElement;
    expect(el.className).toContain('animate-pulse');
  });

  it('applies bg-slate-200 base class', () => {
    const { container } = render(<Skeleton />);
    const el = container.firstChild as HTMLElement;
    expect(el.className).toContain('bg-slate-200');
  });

  it('renders circular variant with rounded-full', () => {
    const { container } = render(<Skeleton variant="circular" />);
    const el = container.firstChild as HTMLElement;
    expect(el.className).toContain('rounded-full');
    expect(el.className).toContain('animate-pulse');
  });

  it('renders text variant with multiple lines', () => {
    const { container } = render(<Skeleton variant="text" lines={4} />);
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper.children).toHaveLength(4);
  });

  it('text variant defaults to 3 lines', () => {
    const { container } = render(<Skeleton variant="text" />);
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper.children).toHaveLength(3);
  });

  it('last text line is narrower (w-3/4)', () => {
    const { container } = render(<Skeleton variant="text" lines={3} />);
    const wrapper = container.firstChild as HTMLElement;
    const lastLine = wrapper.children[2] as HTMLElement;
    expect(lastLine.className).toContain('w-3/4');
  });

  it('applies custom width and height', () => {
    const { container } = render(
      <Skeleton width="w-48" height="h-8" />,
    );
    const el = container.firstChild as HTMLElement;
    expect(el.className).toContain('w-48');
    expect(el.className).toContain('h-8');
  });

  it('applies default w-full and h-4', () => {
    const { container } = render(<Skeleton />);
    const el = container.firstChild as HTMLElement;
    expect(el.className).toContain('w-full');
    expect(el.className).toContain('h-4');
  });

  it('accepts custom className', () => {
    const { container } = render(<Skeleton className="my-class" />);
    const el = container.firstChild as HTMLElement;
    expect(el.className).toContain('my-class');
  });
});
