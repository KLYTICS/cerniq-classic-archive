'use client';

import React from 'react';

export interface EmptyStateProps {
  /** Main heading */
  title: string;
  /** Supporting description */
  description?: string;
  /** Optional icon element */
  icon?: React.ReactNode;
  /** Optional CTA */
  action?: React.ReactNode;
  className?: string;
}

/**
 * Lightweight empty-state placeholder for empty lists, search results, etc.
 * (Separate from the bilingual cerniq/EmptyState.)
 */
export function EmptyState({ title, description, icon, action, className = '' }: EmptyStateProps) {
  return (
    <div
      className={`flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white/80 px-6 py-12 text-center ${className}`}
    >
      {icon && (
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full border border-slate-200 bg-slate-50 text-slate-400">
          {icon}
        </div>
      )}
      <h3 className="font-display text-lg font-bold text-[#1B3A6B]">{title}</h3>
      {description && (
        <p className="mt-3 max-w-sm text-sm leading-relaxed text-slate-500">{description}</p>
      )}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
