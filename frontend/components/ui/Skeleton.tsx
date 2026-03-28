'use client';

import React from 'react';

export interface SkeletonProps {
  /** Width (Tailwind class or inline style) */
  width?: string;
  /** Height (Tailwind class or inline style) */
  height?: string;
  /** Shape variant */
  variant?: 'rectangular' | 'circular' | 'text';
  /** Number of text lines when variant is "text" */
  lines?: number;
  className?: string;
}

/**
 * Content skeleton loader for placeholder UI while data loads.
 */
export function Skeleton({
  width = 'w-full',
  height = 'h-4',
  variant = 'rectangular',
  lines = 3,
  className = '',
}: SkeletonProps) {
  const baseClasses = 'animate-pulse bg-slate-200';

  if (variant === 'circular') {
    return (
      <div
        className={`${baseClasses} rounded-full ${width} ${height} ${className}`}
      />
    );
  }

  if (variant === 'text') {
    return (
      <div className={`space-y-2 ${className}`}>
        {Array.from({ length: lines }).map((_, i) => (
          <div
            key={i}
            className={`${baseClasses} rounded ${height} ${
              i === lines - 1 ? 'w-3/4' : width
            }`}
          />
        ))}
      </div>
    );
  }

  // rectangular
  return (
    <div
      className={`${baseClasses} rounded-lg ${width} ${height} ${className}`}
    />
  );
}
