'use client';

import React from 'react';
import type { LucideIcon } from 'lucide-react';

export interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  titleEs?: string;
  description: string;
  descriptionEs?: string;
  actionLabel?: string;
  actionLabelEs?: string;
  onAction?: () => void;
}

export function EmptyState({
  icon: Icon,
  title,
  titleEs,
  description,
  descriptionEs,
  actionLabel,
  actionLabelEs,
  onAction,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white/80 px-6 py-12 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full border border-slate-200 bg-slate-50">
        <Icon className="h-7 w-7 text-slate-400" />
      </div>

      {/* Bilingual title: English primary */}
      <h3 className="font-display text-lg font-bold text-[#1B3A6B]">{title}</h3>
      {titleEs && (
        <p className="mt-0.5 text-xs text-slate-400">{titleEs}</p>
      )}

      {/* Bilingual description */}
      <p className="mt-3 max-w-sm text-sm leading-relaxed text-slate-500">{description}</p>
      {descriptionEs && (
        <p className="mt-1 max-w-sm text-xs text-slate-400">{descriptionEs}</p>
      )}

      {/* Amber CTA */}
      {(actionLabel || actionLabelEs) && onAction && (
        <button
          onClick={onAction}
          className="mt-6 inline-flex items-center gap-2 rounded-full bg-[#E8A020] px-6 py-3 text-sm font-bold text-white shadow-md transition hover:-translate-y-0.5 hover:bg-[#d4911c] hover:shadow-lg"
        >
          {actionLabel && <span>{actionLabel}</span>}
          {actionLabelEs && actionLabel && <span className="text-white/60">/</span>}
          {actionLabelEs && <span>{actionLabelEs}</span>}
        </button>
      )}
    </div>
  );
}
