'use client';

import React, { useState } from 'react';
import Image, { type ImageLoaderProps } from 'next/image';

export interface AvatarProps {
  /** Full name used for initials fallback */
  name: string;
  /** Image URL */
  src?: string | null;
  /** Diameter: sm=32px, md=40px, lg=56px */
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizeMap = { sm: 'h-8 w-8 text-xs', md: 'h-10 w-10 text-sm', lg: 'h-14 w-14 text-lg' } as const;

export function getAvatarImageSizes(size: NonNullable<AvatarProps['size']>) {
  return size === 'sm' ? '32px' : size === 'md' ? '40px' : '56px';
}

export function passthroughImageLoader({ src }: ImageLoaderProps): string {
  return src;
}

export function getInitials(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return '?';
  const parts = trimmed.split(/\s+/);
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/**
 * User avatar with image support and initials fallback.
 */
export function Avatar({ name, src, size = 'md', className = '' }: AvatarProps) {
  const [imgError, setImgError] = useState(false);
  const showImage = src && !imgError;

  return (
    <div
      className={`relative inline-flex flex-shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#1B3A6B] font-semibold text-white ${sizeMap[size]} ${className}`}
      title={name}
    >
      {showImage ? (
        <Image
          src={src}
          alt={name}
          fill
          unoptimized
          loader={passthroughImageLoader}
          sizes={getAvatarImageSizes(size)}
          className="rounded-full object-cover"
          onError={() => setImgError(true)}
        />
      ) : (
        <span>{getInitials(name)}</span>
      )}
    </div>
  );
}
