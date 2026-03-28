'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/store';
import { useTranslation } from '@/lib/i18n';
import { CerniqLockup } from '@/components/brand/CerniqLogo';
import {
  Activity,
  AlertOctagon,
  BarChart3,
  Briefcase,
  ChevronDown,
  ChevronRight,
  CreditCard,
  DollarSign,
  Key,
  Landmark,
  LogOut,
  Shield,
  SlidersHorizontal,
  TrendingUp,
  User,
  X,
  Zap,
} from 'lucide-react';

interface NavItem {
  href: string;
  icon: React.ElementType;
  labelKey: string;
  children?: NavItem[];
}

const mainNav: NavItem[] = [
  { href: '/dashboard', icon: BarChart3, labelKey: 'sidebar.dashboard' },
  { href: '/portfolios', icon: Briefcase, labelKey: 'sidebar.portfolios' },
  { href: '/risk-analytics', icon: Activity, labelKey: 'sidebar.riskAnalytics' },
  { href: '/execution-quality', icon: Zap, labelKey: 'sidebar.executionQuality' },
  { href: '/spendcheck', icon: CreditCard, labelKey: 'sidebar.expenses' },
];

const almNav: NavItem[] = [
  {
    href: '/alm',
    icon: Landmark,
    labelKey: 'sidebar.almIntelligence',
    children: [
      // Core
      { href: '/alm', icon: BarChart3, labelKey: 'sidebar.overview' },
      { href: '/alm/modules', icon: BarChart3, labelKey: 'sidebar.moduleIndex' },
      { href: '/alm/balance-sheet', icon: DollarSign, labelKey: 'sidebar.balanceSheet' },
      { href: '/alm/advisor-v2', icon: Zap, labelKey: 'sidebar.aiAdvisor' },
      { href: '/alm/analyst', icon: Zap, labelKey: 'sidebar.aiAdvisor' },
      // Rate Risk
      { href: '/alm/sensitivity', icon: TrendingUp, labelKey: 'sidebar.rateSensitivity' },
      { href: '/alm/yield-curve', icon: TrendingUp, labelKey: 'sidebar.yieldCurve' },
      { href: '/alm/repricing-gap', icon: BarChart3, labelKey: 'sidebar.repricingGap' },
      { href: '/alm/rate-shock-v2', icon: Zap, labelKey: 'sidebar.rateShockV2' },
      { href: '/alm/key-rate-durations', icon: SlidersHorizontal, labelKey: 'sidebar.keyRateDuration' },
      { href: '/alm/behavioral-duration', icon: Activity, labelKey: 'sidebar.behavioralDuration' },
      { href: '/alm/sofr-exposure', icon: TrendingUp, labelKey: 'sidebar.sofrExposure' },
      // Liquidity
      { href: '/alm/liquidity', icon: Shield, labelKey: 'sidebar.liquidity' },
      { href: '/alm/stress-pack', icon: Shield, labelKey: 'sidebar.stressPack' },
      { href: '/alm/ltp', icon: DollarSign, labelKey: 'sidebar.ltp' },
      { href: '/alm/nsfr', icon: Shield, labelKey: 'sidebar.nsfr' },
      // Credit
      { href: '/alm/cecl', icon: Shield, labelKey: 'sidebar.cecl' },
      { href: '/alm/concentration', icon: AlertOctagon, labelKey: 'sidebar.concentration' },
      { href: '/alm/credit-risk', icon: Shield, labelKey: 'sidebar.creditRisk' },
      { href: '/alm/conc-var', icon: AlertOctagon, labelKey: 'sidebar.concVar' },
      // Quant Engine
      { href: '/alm/monte-carlo', icon: Activity, labelKey: 'sidebar.monteCarlo' },
      { href: '/alm/var', icon: AlertOctagon, labelKey: 'sidebar.var' },
      { href: '/alm/oas', icon: Landmark, labelKey: 'sidebar.oas' },
      { href: '/alm/optionality', icon: SlidersHorizontal, labelKey: 'sidebar.optionality' },
      // Strategy
      { href: '/alm/ftp', icon: DollarSign, labelKey: 'sidebar.ftp' },
      { href: '/alm/capital-optimizer', icon: Zap, labelKey: 'sidebar.capitalOptimizer' },
      { href: '/alm/nim-attribution', icon: DollarSign, labelKey: 'sidebar.nimAttribution' },
      { href: '/alm/nim-optimizer', icon: DollarSign, labelKey: 'sidebar.nimOptimizer' },
      { href: '/alm/forward-sim', icon: TrendingUp, labelKey: 'sidebar.forwardSim' },
      // Regulatory
      { href: '/alm/exam-prep', icon: Shield, labelKey: 'sidebar.examPrep' },
      { href: '/alm/irr-policy', icon: AlertOctagon, labelKey: 'sidebar.irrPolicy' },
      { href: '/alm/alerts', icon: Activity, labelKey: 'sidebar.alerts' },
      { href: '/alm/camel-forecast', icon: TrendingUp, labelKey: 'sidebar.camelForecast' },
      { href: '/alm/form-5300', icon: Shield, labelKey: 'sidebar.form5300' },
      { href: '/alm/board-report', icon: BarChart3, labelKey: 'sidebar.boardReport' },
      // Intelligence
      { href: '/alm/peer-analytics', icon: Activity, labelKey: 'sidebar.peerAnalytics' },
      { href: '/alm/climate-risk', icon: AlertOctagon, labelKey: 'sidebar.climateRisk' },
      { href: '/alm/macro-regime', icon: Activity, labelKey: 'sidebar.macroRegime' },
      { href: '/alm/stress-v2', icon: AlertOctagon, labelKey: 'sidebar.stressV2' },
      { href: '/alm/ews', icon: AlertOctagon, labelKey: 'sidebar.ews' },
      { href: '/alm/scenario-builder', icon: SlidersHorizontal, labelKey: 'sidebar.scenarioBuilder' },
      // Quant Frontier
      { href: '/alm/black-litterman', icon: TrendingUp, labelKey: 'sidebar.blackLitterman' },
      { href: '/alm/cvar-optimizer', icon: AlertOctagon, labelKey: 'sidebar.cvarOptimizer' },
      { href: '/alm/hrp', icon: Activity, labelKey: 'sidebar.hrp' },
      { href: '/alm/credit-metrics', icon: Shield, labelKey: 'sidebar.creditMetrics' },
      { href: '/alm/kmv-merton', icon: AlertOctagon, labelKey: 'sidebar.kmvMerton' },
      { href: '/alm/pca-yield-curve', icon: TrendingUp, labelKey: 'sidebar.pcaYieldCurve' },
      { href: '/alm/frtb-ima', icon: Shield, labelKey: 'sidebar.frtbIma' },
      { href: '/alm/fed-futures', icon: TrendingUp, labelKey: 'sidebar.fedFutures' },
      { href: '/alm/copula-credit', icon: Activity, labelKey: 'sidebar.copulaCredit' },
      { href: '/alm/wrong-way-risk', icon: AlertOctagon, labelKey: 'sidebar.wrongWayRisk' },
      { href: '/alm/cap-floor', icon: SlidersHorizontal, labelKey: 'sidebar.capFloor' },
      { href: '/alm/rbc2', icon: Shield, labelKey: 'sidebar.rbc2' },
      { href: '/alm/macro-factors', icon: Activity, labelKey: 'sidebar.macroFactors' },
      { href: '/alm/garch', icon: Activity, labelKey: 'sidebar.garch' },
    ],
  },
];

const settingsNav: NavItem[] = [
  { href: '/onboarding', icon: User, labelKey: 'sidebar.profile' },
  { href: '/settings/api-keys', icon: Key, labelKey: 'sidebar.apiKeys' },
];

interface SidebarProps {
  open: boolean;
  onClose: () => void;
}

export default function Sidebar({ open, onClose }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { logout } = useAuthStore();
  const { t } = useTranslation();
  const [almExpanded, setAlmExpanded] = useState(false);
  const isAlmRoute = pathname.startsWith('/alm');
  const isAlmExpanded = isAlmRoute || almExpanded;

  const isActive = (href: string) => {
    if (href === '/alm' && pathname === '/alm') {
      return true;
    }
    if (href !== '/alm' && pathname.startsWith(href)) {
      return true;
    }
    return pathname === href;
  };

  const handleLogout = async () => {
    await logout();
    router.push('/login');
  };

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
            <button onClick={onClose} className="text-slate-400 transition hover:text-slate-950 lg:hidden" aria-label="Close navigation menu">
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="rounded-[1.2rem] border border-cyan-200/70 bg-gradient-to-br from-cyan-50 via-white to-sky-50 px-3.5 py-3.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]">
            <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-cyan-800/80">CERNIQ ALM</p>
            <p className="mt-2 text-xs leading-5 text-slate-600">
              {t('sidebar.description')}
            </p>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto py-3">
          <div className="mb-4 px-3">
            <p className="mb-2 px-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500">{t('sidebar.main')}</p>
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

          <div className="mb-4 px-3">
            <p className="mb-2 px-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500">
              {t('sidebar.enterprise')}
            </p>
            {almNav.map((item) => (
              <div key={item.href}>
                <button
                  onClick={() => {
                    if (!isAlmRoute) {
                      setAlmExpanded(!almExpanded);
                    }
                  }}
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
                      <item.icon className="h-4 w-4" />
                    </span>
                    {t(item.labelKey)}
                  </div>
                  {isAlmExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                </button>

                {isAlmExpanded && item.children ? (
                  <div className="ml-6 border-l border-slate-200 pl-3">
                    {item.children.map((child) => (
                      <Link
                        key={child.href + child.labelKey}
                        href={child.href}
                        onClick={onClose}
                        className={`mb-1 flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition ${
                          isActive(child.href) && (child.href !== '/alm' || pathname === '/alm')
                            ? 'bg-cyan-50/80 font-medium text-cyan-800'
                            : 'text-slate-500 hover:bg-slate-50 hover:text-slate-950'
                        }`}
                      >
                        <child.icon className="h-3.5 w-3.5" />
                        {t(child.labelKey)}
                      </Link>
                    ))}
                  </div>
                ) : null}
              </div>
            ))}
          </div>

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
