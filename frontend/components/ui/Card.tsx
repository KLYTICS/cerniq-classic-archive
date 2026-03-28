'use client';

import React from 'react';

export interface CardProps {
  children: React.ReactNode;
  /** Optional card title */
  title?: string;
  /** Optional subtitle or description */
  subtitle?: string;
  /** Optional actions rendered in the header area */
  actions?: React.ReactNode;
  /** Additional padding variant */
  padding?: 'sm' | 'md' | 'lg';
  /** Whether the card has a hover lift effect */
  hoverable?: boolean;
  className?: string;
}

const paddingMap = {
  sm: 'p-4',
  md: 'p-5',
  lg: 'p-6',
} as const;

/**
 * Standard card container consistent with the Cerniq design system.
 */
export function Card({
  children,
  title,
  subtitle,
  actions,
  padding = 'md',
  hoverable = false,
  className = '',
}: CardProps) {
  return (
    <div
      className={`rounded-2xl border border-slate-200 bg-white shadow-sm ${paddingMap[padding]} ${
        hoverable ? 'transition hover:-translate-y-0.5 hover:shadow-md' : ''
      } ${className}`}
    >
      {/* Header */}
      {(title || actions) && (
        <div className="mb-4 flex items-start justify-between">
          <div>
            {title && (
              <h3 className="font-display text-base font-bold text-[#1B3A6B]">{title}</h3>
            )}
            {subtitle && (
              <p className="mt-0.5 text-sm text-slate-500">{subtitle}</p>
            )}
          </div>
          {actions && <div className="flex-shrink-0">{actions}</div>}
        </div>
      )}

      {children}
    </div>
  );
}
