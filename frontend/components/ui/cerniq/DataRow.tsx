'use client';

import React, { type ReactNode } from 'react';

/**
 * DataRow — single high-density horizontal row primitive.
 *
 * Use this when you have a list of items where each item needs ~5–8 fields
 * visible at once (think: bond ticker line, JE line, reconciliation row).
 * Resists the urge to "card-ify" everything.
 *
 * Composition: caller provides cells; DataRow handles spacing, separators,
 * status pill, hover, and click affordances.
 */

export interface DataRowCell {
  label?: string; // shown above the value when present (mobile)
  content: ReactNode;
  /** Right-align numbers/currency for column scanning. */
  align?: 'left' | 'right';
  /** Tabular numerics + monospace for clean alignment of digits. */
  numeric?: boolean;
  /** Flex grow weight (default 1). Pin a column with weight 0. */
  weight?: number;
  /** Hide on small screens. */
  hideOnMobile?: boolean;
}

export interface DataRowStatus {
  label: string;
  tone: 'neutral' | 'good' | 'warn' | 'bad' | 'info';
}

export interface DataRowProps {
  cells: DataRowCell[];
  status?: DataRowStatus;
  onClick?: () => void;
  href?: string;
  selected?: boolean;
  ariaLabel?: string;
}

const TONE_CLASSES: Record<DataRowStatus['tone'], string> = {
  neutral: 'bg-[rgba(247,228,188,0.62)] cerniq-dashboard-subtext border-[var(--dashboard-border)]',
  good: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  warn: 'bg-amber-50 text-amber-800 border-amber-200',
  bad: 'bg-rose-50 text-rose-700 border-rose-200',
  info: 'bg-blue-50 text-blue-700 border-blue-200',
};

function StatusPill({ status }: { status: DataRowStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${TONE_CLASSES[status.tone]}`}
    >
      {status.label}
    </span>
  );
}

export function DataRow({
  cells,
  status,
  onClick,
  href,
  selected = false,
  ariaLabel,
}: DataRowProps) {
  const interactive = Boolean(onClick || href);
  const baseClass = `group flex items-center gap-3 border-b cerniq-dashboard-border px-4 py-2 text-sm last:border-b-0 ${
    selected ? 'bg-[rgba(247,228,188,0.82)]' : 'bg-[rgba(255,251,239,0.92)]'
  } ${interactive ? 'cursor-pointer hover:bg-[rgba(247,228,188,0.5)]' : ''}`;

  const inner = (
    <>
      {cells.map((cell, i) => {
        const align = cell.align === 'right' ? 'text-right justify-end' : 'text-left';
        const num = cell.numeric ? 'font-mono tabular-nums cerniq-dashboard-text' : 'cerniq-dashboard-subtext';
        const hide = cell.hideOnMobile ? 'hidden sm:flex' : 'flex';
        return (
          <div
            key={i}
            className={`${hide} flex-col ${align} ${num}`}
            style={{ flex: cell.weight ?? 1, minWidth: 0 }}
          >
            {cell.label ? (
              <span className="cerniq-dashboard-muted-text text-[10px] uppercase tracking-wide sm:hidden">
                {cell.label}
              </span>
            ) : null}
            <div className="truncate">{cell.content}</div>
          </div>
        );
      })}
      {status ? (
        <div className="shrink-0">
          <StatusPill status={status} />
        </div>
      ) : null}
    </>
  );

  if (href) {
    return (
      <a href={href} aria-label={ariaLabel} className={baseClass}>
        {inner}
      </a>
    );
  }
  if (onClick) {
    return (
      <button type="button" onClick={onClick} aria-label={ariaLabel} className={`${baseClass} w-full text-left`}>
        {inner}
      </button>
    );
  }
  return (
    <div role="row" aria-label={ariaLabel} className={baseClass}>
      {inner}
    </div>
  );
}
