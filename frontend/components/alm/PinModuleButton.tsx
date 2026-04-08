'use client';

import { Star } from 'lucide-react';

import type { Locale } from '@/lib/i18n';
import { togglePinned, usePinned } from '@/lib/alm/pinned';
import type { AlmModuleSlug } from '@/lib/alm/registry';

export interface PinModuleButtonProps {
  readonly slug: AlmModuleSlug;
  readonly locale: Locale;
  readonly moduleName: string;
  readonly className?: string;
  readonly compact?: boolean;
}

/**
 * Small shared toggle for the pinned-modules store.
 *
 * Used anywhere a module needs a one-click "keep this in my workflow"
 * affordance without duplicating local state or storage plumbing.
 */
export function PinModuleButton({
  slug,
  locale,
  moduleName,
  className,
  compact = false,
}: PinModuleButtonProps) {
  const pinned = usePinned();
  const active = pinned.includes(slug);

  return (
    <button
      type="button"
      aria-pressed={active}
      aria-label={
        active
          ? locale === 'es'
            ? `Quitar ${moduleName} de fijados`
            : `Unpin ${moduleName}`
          : locale === 'es'
            ? `Fijar ${moduleName}`
            : `Pin ${moduleName}`
      }
      title={
        active
          ? locale === 'es'
            ? 'Quitar de fijados'
            : 'Unpin'
          : locale === 'es'
            ? 'Fijar'
            : 'Pin'
      }
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        togglePinned(slug);
      }}
      className={`inline-flex items-center justify-center rounded-md border transition ${
        compact ? 'h-6 w-6' : 'h-7 w-7'
      } ${
        active
          ? 'border-amber-200 bg-amber-50 text-amber-600 hover:border-amber-300 hover:bg-amber-100'
          : 'border-slate-200 bg-white text-slate-300 hover:border-slate-300 hover:text-slate-500'
      } ${className ?? ''}`}
    >
      <Star className={`shrink-0 ${compact ? 'h-3 w-3' : 'h-3.5 w-3.5'} ${active ? 'fill-current' : ''}`} />
    </button>
  );
}
