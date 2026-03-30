import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Avatar, getAvatarImageSizes, getInitials, passthroughImageLoader } from './Avatar';

describe('Avatar', () => {
  it('renders initials when no src is provided', () => {
    render(<Avatar name="John Doe" />);
    expect(screen.getByText('JD')).toBeInTheDocument();
  });

  it('renders single initial for single-word name', () => {
    render(<Avatar name="Alice" />);
    expect(screen.getByText('A')).toBeInTheDocument();
  });

  it('handles blank and lowercase names in the initials helper', () => {
    expect(getInitials('')).toBe('?');
    expect(getInitials('alice')).toBe('A');
  });

  it('renders image when src is provided', () => {
    render(<Avatar name="John Doe" src="https://example.com/avatar.jpg" />);
    const img = screen.getByRole('img');
    expect(img).toHaveAttribute('src', 'https://example.com/avatar.jpg');
    expect(img).toHaveAttribute('alt', 'John Doe');
  });

  it('falls back to initials on image error', () => {
    render(<Avatar name="John Doe" src="https://example.com/broken.jpg" />);
    const img = screen.getByRole('img');

    fireEvent.error(img);
    expect(screen.getByText('JD')).toBeInTheDocument();
  });

  it('uses size-specific image hints and passthrough loader output', () => {
    const { rerender } = render(<Avatar name="John Doe" src="https://example.com/avatar.jpg" size="sm" />);
    expect(getAvatarImageSizes('sm')).toBe('32px');

    rerender(<Avatar name="John Doe" src="https://example.com/avatar.jpg" size="lg" />);
    expect(getAvatarImageSizes('md')).toBe('40px');
    expect(getAvatarImageSizes('lg')).toBe('56px');
    expect(passthroughImageLoader({ src: 'https://example.com/raw.jpg', width: 40, quality: 75 })).toBe(
      'https://example.com/raw.jpg',
    );
  });
});
