'use client';

import React from 'react';

export interface ProgressBarProps {
  /** Progress value between 0 and 100 */
  value: number;
  /** Visual variant */
  variant?: 'default' | 'success' | 'warning' | 'error';
  /** Show percentage label */
  showLabel?: boolean;
  /** Height: sm=4px, md=8px, lg=12px */
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const barColors: Record<string, string> = {
  default: 'bg-[#1B3A6B]',
  success: 'bg-emerald-500',
  warning: 'bg-amber-500',
  error: 'bg-red-500',
};

const sizeMap = { sm: 'h-1', md: 'h-2', lg: 'h-3' } as const;

/**
 * Animated progress bar for loading states and upload progress.
 */
export function ProgressBar({
  value,
  variant = 'default',
  showLabel = false,
  size = 'md',
  className = '',
}: ProgressBarProps) {
  const clamped = Math.min(100, Math.max(0, value));

  return (
    <div className={className}>
      {showLabel && (
        <div className="mb-1 flex justify-between text-xs text-slate-500">
          <span>Progress</span>
          <span>{Math.round(clamped)}%</span>
        </div>
      )}
      <div
        className={`w-full overflow-hidden rounded-full bg-slate-200 ${sizeMap[size]}`}
        role="progressbar"
        aria-valuenow={clamped}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className={`${sizeMap[size]} rounded-full transition-all duration-300 ease-out ${barColors[variant]}`}
          style={{ width: `${clamped}%` }}
        />
      </div>
    </div>
  );
}
