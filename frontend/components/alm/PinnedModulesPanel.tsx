'use client';

import Link from 'next/link';
import { ChevronRight, Star } from 'lucide-react';

import { useTranslation } from '@/lib/i18n';
import { usePinned } from '@/lib/alm/pinned';
import { MODULES_BY_SLUG } from '@/lib/alm/registry';
import { PinModuleButton } from '@/components/alm/PinModuleButton';

export interface PinnedModulesPanelProps {
  readonly className?: string;
  readonly max?: number;
}

/**
 * PinnedModulesPanel — curated shortcuts for the modules a user reaches
 * for every day. Reads from the shared pinned store so the landing page
 * and sidebar stay synchronized.
 */
export function PinnedModulesPanel({ className, max = 6 }: PinnedModulesPanelProps) {
  const { locale } = useTranslation();
  const pinned = usePinned();

  const items = pinned
    .slice(0, max)
    .map((slug) => MODULES_BY_SLUG[slug])
    .filter((mod): mod is NonNullable<typeof mod> => mod != null);

  return (
    <section className={`rounded-xl border border-slate-200 bg-white p-4 ${className ?? ''}`}>
      <div className="mb-3 flex items-center gap-2">
        <Star className="h-3.5 w-3.5 text-amber-500" aria-hidden />
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
          {locale === 'es' ? 'Módulos Fijados' : 'Pinned Modules'}
        </p>
        {items.length > 0 ? <span className="text-[9px] text-slate-300">{items.length}</span> : null}
      </div>

      {items.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-6 text-center">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-amber-200 bg-amber-50">
            <Star className="h-4 w-4 text-amber-500" />
          </div>
          <p className="text-[11px] text-slate-500">
            {locale === 'es'
              ? 'Fije módulos desde el explorador o la barra lateral.'
              : 'Pin modules from the explorer or sidebar.'}
          </p>
          <p className="text-[10px] text-slate-400">
            {locale === 'es'
              ? 'Sus atajos aparecerán aquí y arriba del árbol ALM.'
              : 'Your shortcuts will show up here and at the top of the ALM tree.'}
          </p>
        </div>
      ) : (
        <div className="space-y-1">
          {items.map((mod, index) => {
            const Icon = mod.icon;
            return (
              <div
                key={mod.slug}
                className="group flex items-center gap-2 rounded-lg border border-transparent px-2 py-1.5 transition hover:border-slate-200 hover:bg-slate-50"
              >
                <span className="w-3 text-right font-mono text-[9px] text-slate-300">{index + 1}</span>
                <Link href={mod.href} className="flex min-w-0 flex-1 items-center gap-3">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-slate-100 bg-slate-50 group-hover:border-slate-200">
                    <Icon className="h-3.5 w-3.5 text-slate-500 group-hover:text-slate-700" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-medium text-slate-800 group-hover:text-slate-950">
                      {mod.name[locale]}
                    </p>
                    <p className="truncate text-[10px] text-slate-400">{mod.description[locale]}</p>
                  </div>
                </Link>
                <PinModuleButton
                  slug={mod.slug}
                  locale={locale}
                  moduleName={mod.name[locale]}
                  compact
                  className="shrink-0"
                />
                <ChevronRight className="h-3.5 w-3.5 shrink-0 text-slate-300 group-hover:text-slate-500" />
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
