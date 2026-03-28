import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Badge } from './Badge';

describe('Badge', () => {
  it('renders children text', () => {
    render(<Badge>Active</Badge>);
    expect(screen.getByText('Active')).toBeInTheDocument();
  });

  it('applies default variant styles', () => {
    render(<Badge>Default</Badge>);
    const badge = screen.getByText('Default');
    expect(badge.className).toContain('bg-slate-100');
    expect(badge.className).toContain('text-slate-700');
  });

  it('applies success variant', () => {
    render(<Badge variant="success">OK</Badge>);
    const badge = screen.getByText('OK');
    expect(badge.className).toContain('bg-emerald-50');
    expect(badge.className).toContain('text-emerald-700');
  });

  it('applies warning variant', () => {
    render(<Badge variant="warning">Caution</Badge>);
    const badge = screen.getByText('Caution');
    expect(badge.className).toContain('bg-amber-50');
    expect(badge.className).toContain('text-amber-700');
  });

  it('applies error variant', () => {
    render(<Badge variant="error">Fail</Badge>);
    const badge = screen.getByText('Fail');
    expect(badge.className).toContain('bg-red-50');
    expect(badge.className).toContain('text-red-700');
  });

  it('applies info variant', () => {
    render(<Badge variant="info">Info</Badge>);
    const badge = screen.getByText('Info');
    expect(badge.className).toContain('bg-blue-50');
    expect(badge.className).toContain('text-blue-700');
  });

  it('renders as a span element', () => {
    render(<Badge>Tag</Badge>);
    const badge = screen.getByText('Tag');
    expect(badge.tagName).toBe('SPAN');
  });

  it('includes rounded-full and text-xs classes', () => {
    render(<Badge>Pill</Badge>);
    const badge = screen.getByText('Pill');
    expect(badge.className).toContain('rounded-full');
    expect(badge.className).toContain('text-xs');
    expect(badge.className).toContain('font-semibold');
  });

  it('accepts custom className', () => {
    render(<Badge className="ml-2">Custom</Badge>);
    const badge = screen.getByText('Custom');
    expect(badge.className).toContain('ml-2');
  });
});
