'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/store';
import { useTranslation } from '@/lib/i18n';
import { CerniqLockup } from '@/components/brand/CerniqLogo';
import {
  Activity,
  BarChart3,
  Briefcase,
  ChevronDown,
  ChevronRight,
  CreditCard,
  Key,
  Landmark,
  LogOut,
  Star,
  User,
  X,
  Zap,
} from 'lucide-react';

import {
  ALM_CATEGORIES,
  type AlmModule,
  MODULES_BY_SLUG,
  MODULES_BY_CATEGORY,
} from '@/lib/alm/registry';
import {
  PINNED_MAX,
  clearPinned,
  togglePinned,
  usePinned,
} from '@/lib/alm/pinned';

interface NavItem {
  href: string;
  icon: React.ElementType;
  labelKey: string;
  children?: NavItem[];
}

const mainNav: NavItem[] = [
  { href: '/dashboard',        icon: BarChart3, labelKey: 'sidebar.dashboard' },
  { href: '/portfolios',       icon: Briefcase, labelKey: 'sidebar.portfolios' },
  { href: '/risk-analytics',   icon: Activity,  labelKey: 'sidebar.riskAnalytics' },
  { href: '/execution-quality',icon: Zap,       labelKey: 'sidebar.executionQuality' },
  { href: '/spendcheck',       icon: CreditCard,labelKey: 'sidebar.expenses' },
];

const settingsNav: NavItem[] = [
  { href: '/onboarding',       icon: User, labelKey: 'sidebar.profile' },
  { href: '/settings/api-keys',icon: Key,  labelKey: 'sidebar.apiKeys' },
];

interface SidebarProps {
  open: boolean;
  onClose: () => void;
}

interface AlmModuleNavRowProps {
  readonly active: boolean;
  readonly locale: 'en' | 'es';
  readonly module: AlmModule;
  readonly onClose: () => void;
  readonly pinned: boolean;
}

function AlmModuleNavRow({ active, locale, module, onClose, pinned }: AlmModuleNavRowProps) {
  const Icon = module.icon;
  const pinLabel = pinned
    ? (locale === 'es' ? `Desfijar ${module.name[locale]}` : `Unpin ${module.name[locale]}`)
    : (locale === 'es' ? `Fijar ${module.name[locale]}` : `Pin ${module.name[locale]}`);

  return (
    <div className="group mb-0.5 flex items-center gap-1 rounded-xl">
      <Link
        href={module.href}
        onClick={onClose}
        className={`flex min-w-0 flex-1 items-center gap-2 rounded-xl px-2 py-1.5 text-[12px] transition ${
          active
            ? 'bg-cyan-50/80 font-medium text-cyan-800'
            : 'text-slate-500 hover:bg-slate-50 hover:text-slate-950'
        }`}
      >
        <Icon className="h-3 w-3 shrink-0" />
        <span className="truncate">{module.name[locale]}</span>
        {module.status !== 'ga' ? (
          <span className="ml-auto rounded border border-amber-200 bg-amber-50 px-1 py-px text-[8px] font-bold uppercase tracking-wider text-amber-600">
            {module.status}
          </span>
        ) : null}
      </Link>
      <button
        type="button"
        onClick={() => togglePinned(module.slug)}
        aria-label={pinLabel}
        title={pinLabel}
        className={`mr-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-md border transition ${
          pinned
            ? 'border-amber-200 bg-amber-50 text-amber-500 hover:border-amber-300 hover:text-amber-600'
            : 'border-transparent text-slate-300 hover:border-slate-200 hover:bg-white hover:text-slate-500'
        }`}
      >
        <Star className="h-3.5 w-3.5" fill={pinned ? 'currentColor' : 'none'} />
      </button>
    </div>
  );
}

/**
 * Sidebar. The ALM module tree is derived from lib/alm/registry.ts — never
 * hardcode module labels or icons in this file. To add or rename a module,
 * edit the registry and this nav updates automatically.
 */
export default function Sidebar({ open, onClose }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { logout } = useAuthStore();
  const { t, locale } = useTranslation();
  const pinnedSlugs = usePinned();
  const [almExpanded, setAlmExpanded] = useState(false);
  const isAlmRoute = pathname.startsWith('/alm');
  const isAlmExpanded = isAlmRoute || almExpanded;

  const isActive = (href: string) => {
    if (href === '/alm' && pathname === '/alm') return true;
    if (href !== '/alm' && pathname.startsWith(href)) return true;
    return pathname === href;
  };

  const handleLogout = async () => {
    await logout();
    router.push('/login');
  };

  // Categories ordered by the canonical registry ordering, skipping any
  // empty buckets. This makes the sidebar panel structurally identical to
  // the /alm/modules index page.
  const populatedCategories = ALM_CATEGORIES.filter(
    (cat) => MODULES_BY_CATEGORY[cat.id].length > 0,
  );
  const pinnedModules = pinnedSlugs
    .map((slug) => MODULES_BY_SLUG[slug])
    .filter((mod): mod is AlmModule => mod != null);

  return (
    <>
      {open ? <div className="fixed inset-0 z-40 bg-slate-950/15 lg:hidden" onClick={onClose} aria-hidden="true" /> : null}

      <aside
        role="navigation"
        aria-label="Main navigation"
        className={`fixed top-0 left-0 z-50 flex h-full w-64 flex-col border-r border-slate-200/80 bg-[rgba(255,255,255,0.98)] shadow-[0_24px_80px_rgba(41,85,133,0.14)] backdrop-blur-xl transition-transform duration-200 ${
          open ? 'translate-x-0' : '-translate-x-full'
        } lg:static lg:z-auto lg:translate-x-0`}
      >
        <div className="border-b border-slate-200/80 p-4">
          <div className="mb-3 flex items-center justify-between">
            <Link href="/dashboard" className="flex items-center gap-2" onClick={onClose}>
              <CerniqLockup compact />
            </Link>
            <button
              onClick={onClose}
              className="text-slate-400 transition hover:text-slate-950 lg:hidden"
              aria-label="Close navigation menu"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="rounded-[1.2rem] border border-cyan-200/70 bg-gradient-to-br from-cyan-50 via-white to-sky-50 px-3.5 py-3.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]">
            <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-cyan-800/80">CERNIQ ALM</p>
            <p className="mt-2 text-xs leading-5 text-slate-600">{t('sidebar.description')}</p>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto py-3">
          {/* Main nav */}
          <div className="mb-4 px-3">
            <p className="mb-2 px-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500">
              {t('sidebar.main')}
            </p>
            {mainNav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                className={`group relative mb-1 flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm transition ${
                  isActive(item.href)
                    ? 'border border-cyan-300/90 bg-cyan-50 text-slate-950 shadow-[0_12px_24px_rgba(34,211,238,0.14)]'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-950'
                }`}
              >
                <span
                  className={`flex h-8 w-8 items-center justify-center rounded-xl border transition ${
                    isActive(item.href)
                      ? 'border-cyan-300 bg-white text-cyan-700'
                      : 'border-slate-200 bg-white text-slate-500 group-hover:border-slate-300 group-hover:text-slate-900'
                  }`}
                >
                  <item.icon className="h-4 w-4" />
                </span>
                {t(item.labelKey)}
                {isActive(item.href) ? <span className="ml-auto h-2 w-2 rounded-full bg-cyan-500" /> : null}
              </Link>
            ))}
          </div>

          {/* ALM tree — derived from the canonical registry. */}
          <div className="mb-4 px-3">
            <p className="mb-2 px-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500">
              {t('sidebar.enterprise')}
            </p>
            <div>
              <button
                onClick={() => {
                  if (!isAlmRoute) setAlmExpanded(!almExpanded);
                }}
                aria-expanded={isAlmExpanded}
                aria-controls="alm-module-tree"
                className={`group mb-1 flex w-full items-center justify-between rounded-2xl px-3 py-2.5 text-sm transition ${
                  isAlmRoute
                    ? 'border border-cyan-300/90 bg-cyan-50 text-slate-950 shadow-[0_12px_24px_rgba(34,211,238,0.14)]'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-950'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span
                    className={`flex h-8 w-8 items-center justify-center rounded-xl border transition ${
                      isAlmRoute
                        ? 'border-cyan-300 bg-white text-cyan-700'
                        : 'border-slate-200 bg-white text-slate-500 group-hover:border-slate-300 group-hover:text-slate-900'
                    }`}
                  >
                    <Landmark className="h-4 w-4" />
                  </span>
                  {t('sidebar.almIntelligence')}
                </div>
                {isAlmExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
              </button>

              {isAlmExpanded ? (
                <div id="alm-module-tree" className="ml-6 border-l border-slate-200 pl-3">
                  <div className="mb-3">
                    <div className="mb-1 flex items-center justify-between px-1">
                      <div className="flex items-center gap-1.5">
                        <Star className="h-2.5 w-2.5 text-amber-500" fill={pinnedModules.length > 0 ? 'currentColor' : 'none'} />
                        <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                          {locale === 'es' ? 'Fijados' : 'Pinned'}
                        </p>
                        {pinnedModules.length > 0 ? (
                          <span className="text-[9px] text-slate-300">{pinnedModules.length}</span>
                        ) : null}
                      </div>
                      {pinnedModules.length > 0 ? (
                        <button
                          type="button"
                          onClick={clearPinned}
                          className="text-[9px] font-medium uppercase tracking-[0.14em] text-slate-400 transition hover:text-slate-600"
                        >
                          {locale === 'es' ? 'Limpiar' : 'Clear'}
                        </button>
                      ) : null}
                    </div>

                    {pinnedModules.length > 0 ? (
                      <div>
                        {pinnedModules.map((mod) => (
                          <AlmModuleNavRow
                            key={`pinned-${mod.slug}`}
                            module={mod}
                            locale={locale}
                            active={isActive(mod.href) && (mod.href !== '/alm' || pathname === '/alm')}
                            onClose={onClose}
                            pinned
                          />
                        ))}
                      </div>
                    ) : (
                      <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/70 px-2 py-2 text-[10px] leading-relaxed text-slate-400">
                        {locale === 'es'
                          ? `Marque hasta ${PINNED_MAX} módulos para mantenerlos arriba.`
                          : `Star up to ${PINNED_MAX} modules to keep them at the top.`}
                      </div>
                    )}
                  </div>

                  {populatedCategories.map((cat) => {
                    const modules = MODULES_BY_CATEGORY[cat.id];
                    return (
                      <div key={cat.id} className="mb-2">
                        <p className="mb-1 mt-2 px-1 text-[9px] font-semibold uppercase tracking-[0.18em] text-slate-400 first:mt-0">
                          {cat.label[locale]}
                        </p>
                        {modules.map((mod) => {
                          const active = isActive(mod.href) && (mod.href !== '/alm' || pathname === '/alm');
                          return (
                            <AlmModuleNavRow
                              key={mod.slug}
                              module={mod}
                              locale={locale}
                              active={active}
                              onClose={onClose}
                              pinned={pinnedSlugs.includes(mod.slug)}
                            />
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              ) : null}
            </div>
          </div>

          {/* Settings */}
          <div className="px-3">
            <p className="mb-2 px-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500">
              {t('sidebar.settings')}
            </p>
            {settingsNav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                className={`group relative mb-1 flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm transition ${
                  isActive(item.href)
                    ? 'border border-cyan-300/90 bg-cyan-50 text-slate-950 shadow-[0_12px_24px_rgba(34,211,238,0.14)]'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-950'
                }`}
              >
                <span
                  className={`flex h-8 w-8 items-center justify-center rounded-xl border transition ${
                    isActive(item.href)
                      ? 'border-cyan-300 bg-white text-cyan-700'
                      : 'border-slate-200 bg-white text-slate-500 group-hover:border-slate-300 group-hover:text-slate-900'
                  }`}
                >
                  <item.icon className="h-4 w-4" />
                </span>
                {t(item.labelKey)}
                {isActive(item.href) ? <span className="ml-auto h-2 w-2 rounded-full bg-cyan-500" /> : null}
              </Link>
            ))}
          </div>
        </nav>

        <div className="border-t border-slate-200/80 p-3">
          <button
            onClick={handleLogout}
            className="flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-sm text-slate-600 transition hover:bg-cyan-50 hover:text-cyan-800"
          >
            <LogOut className="h-4 w-4" />
            {t('common.logout')}
          </button>
        </div>
      </aside>
    </>
  );
}
