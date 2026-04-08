import Link from 'next/link';
import { Check } from 'lucide-react';

import { PinModuleButton } from '@/components/alm/PinModuleButton';
import type { Locale } from '@/lib/i18n';
import {
  ALM_CATEGORIES,
  MODULES_BY_CATEGORY,
  isMigrated,
  type AlmCategoryId,
  type AlmModule,
} from '@/lib/alm/registry';

/**
 * ModuleStatusGrid — registry-driven catalog of every ALM module.
 *
 * Replaces the hand-maintained `<ModuleCard>` lists that used to live in
 * the landing page and elsewhere. Every entry derives from ALM_MODULES so
 * adding a new module is a single edit to the registry.
 *
 * Server-component-compatible (no hooks). Accepts a filter prop to show
 * only migrated / unmigrated / all modules.
 *
 * Layout: one labeled section per populated category, each containing a
 * responsive grid of dense module cards. Migrated modules get a small
 * green check icon; unmigrated modules are visually muted (opacity-60)
 * and get a "soon" badge.
 */

export interface ModuleStatusGridProps {
  readonly locale: Locale;
  /** 'all' = every module, 'migrated' = only shell-ready, 'pending' = not-yet-migrated */
  readonly filter?: 'all' | 'migrated' | 'pending';
  /** Only render these category IDs (default: all populated) */
  readonly categories?: readonly AlmCategoryId[];
  /** Hide the category section headers (useful in constrained layouts) */
  readonly hideCategoryHeaders?: boolean;
  /** Compact mode — smaller card padding and icon size */
  readonly compact?: boolean;
  readonly className?: string;
}

interface ModuleCardProps {
  readonly mod: AlmModule;
  readonly locale: Locale;
  readonly migrated: boolean;
  readonly compact: boolean;
}

function ModuleCard({ mod, locale, migrated, compact }: ModuleCardProps) {
  const Icon = mod.icon;
  const paddingClass = compact ? 'p-2' : 'p-3';
  const iconBoxClass = compact ? 'h-6 w-6' : 'h-8 w-8';
  const iconClass = compact ? 'h-3 w-3' : 'h-4 w-4';
  const titleClass = compact ? 'text-[11px]' : 'text-xs';

  return (
    <div className={`group relative rounded-xl border border-slate-200 bg-white transition hover:border-slate-300 hover:shadow-sm ${migrated ? '' : 'opacity-70'}`}>
      <PinModuleButton
        slug={mod.slug}
        locale={locale}
        moduleName={mod.name[locale]}
        compact
        className="absolute right-2 top-2 z-10 opacity-0 shadow-sm group-hover:opacity-100 focus-visible:opacity-100"
      />
      <Link
        href={mod.href}
        className={`flex items-start gap-2 rounded-xl ${paddingClass} pr-10`}
      >
        <div className={`flex ${iconBoxClass} shrink-0 items-center justify-center rounded-lg border border-slate-100 bg-slate-50 group-hover:border-slate-200`}>
          <Icon className={`${iconClass} text-slate-500 group-hover:text-slate-700`} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1">
            <p className={`truncate ${titleClass} font-semibold text-slate-800 group-hover:text-slate-950`}>
              {mod.name[locale]}
            </p>
            {migrated ? (
              <Check
                className="h-2.5 w-2.5 shrink-0 text-emerald-600"
                aria-label={locale === 'es' ? 'Listo' : 'Ready'}
              />
            ) : null}
          </div>
          <p className="mt-0.5 line-clamp-1 text-[9px] text-slate-400">
            {mod.description[locale]}
          </p>
        </div>
        {mod.status !== 'ga' ? (
          <span className="absolute -right-0.5 -top-0.5 rounded border border-amber-200 bg-amber-50 px-1 py-px text-[7px] font-bold uppercase tracking-wider text-amber-700">
            {mod.status}
          </span>
        ) : null}
      </Link>
    </div>
  );
}

export function ModuleStatusGrid({
  locale,
  filter = 'all',
  categories,
  hideCategoryHeaders = false,
  compact = false,
  className,
}: ModuleStatusGridProps) {
  const effectiveCategories = (categories ?? ALM_CATEGORIES.map((c) => c.id));

  const filteredByCategory = effectiveCategories
    .map((catId) => {
      const allModules = MODULES_BY_CATEGORY[catId];
      const mods = allModules.filter((m) => {
        if (filter === 'all')      return true;
        if (filter === 'migrated') return isMigrated(m.slug);
        return !isMigrated(m.slug);
      });
      return { catId, modules: mods };
    })
    .filter((c) => c.modules.length > 0);

  if (filteredByCategory.length === 0) {
    return (
      <div className={`rounded-xl border border-slate-200 bg-white py-12 text-center text-xs text-slate-400 ${className ?? ''}`}>
        {locale === 'es' ? 'Sin módulos que mostrar' : 'No modules to display'}
      </div>
    );
  }

  return (
    <div className={`space-y-5 ${className ?? ''}`}>
      {filteredByCategory.map(({ catId, modules }) => {
        const cat = ALM_CATEGORIES.find((c) => c.id === catId);
        if (!cat) return null;
        const migratedInCat = modules.filter((m) => isMigrated(m.slug)).length;
        return (
          <section key={catId}>
            {hideCategoryHeaders ? null : (
              <div className="mb-2 flex items-center gap-2">
                <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500">
                  {cat.label[locale]}
                </p>
                <span className="text-[9px] text-slate-300">
                  {migratedInCat}/{modules.length}
                </span>
              </div>
            )}
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {modules.map((mod) => (
                <ModuleCard
                  key={mod.slug}
                  mod={mod}
                  locale={locale}
                  migrated={isMigrated(mod.slug)}
                  compact={compact}
                />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
