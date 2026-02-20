'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/store';
import {
  BarChart3,
  Briefcase,
  Activity,
  Zap,
  CreditCard,
  Landmark,
  TrendingUp,
  Shield,
  DollarSign,
  AlertOctagon,
  User,
  Key,
  LogOut,
  ChevronDown,
  ChevronRight,
  X,
} from 'lucide-react';

interface NavItem {
  href: string;
  icon: React.ElementType;
  label: string;
  children?: NavItem[];
}

const mainNav: NavItem[] = [
  { href: '/dashboard', icon: BarChart3, label: 'Dashboard' },
  { href: '/portfolios', icon: Briefcase, label: 'Portfolios' },
  { href: '/risk-analytics', icon: Activity, label: 'Risk Analytics' },
  { href: '/execution-quality', icon: Zap, label: 'Execution Quality' },
  { href: '/spendcheck', icon: CreditCard, label: 'Expenses' },
];

const almNav: NavItem[] = [
  {
    href: '/alm',
    icon: Landmark,
    label: 'ALM Intelligence',
    children: [
      { href: '/alm', icon: BarChart3, label: 'Overview' },
      { href: '/alm/sensitivity', icon: TrendingUp, label: 'Rate Sensitivity' },
      { href: '/alm/liquidity', icon: Shield, label: 'Liquidity' },
      { href: '/alm/balance-sheet', icon: DollarSign, label: 'Balance Sheet' },
      { href: '/alm/stress-test', icon: AlertOctagon, label: 'Stress Testing' },
    ],
  },
];

const settingsNav: NavItem[] = [
  { href: '/onboarding', icon: User, label: 'Profile' },
  { href: '/settings/api-keys', icon: Key, label: 'API Keys' },
];

interface SidebarProps {
  open: boolean;
  onClose: () => void;
}

export default function Sidebar({ open, onClose }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { logout } = useAuthStore();
  const [almExpanded, setAlmExpanded] = useState(false);

  // Auto-expand ALM section when on an ALM route
  useEffect(() => {
    if (pathname.startsWith('/alm')) {
      setAlmExpanded(true);
    }
  }, [pathname]);

  const isActive = (href: string) => {
    if (href === '/alm' && pathname === '/alm') return true;
    if (href !== '/alm' && pathname.startsWith(href)) return true;
    return pathname === href;
  };

  const handleLogout = async () => {
    await logout();
    router.push('/login');
  };

  return (
    <>
      {/* Backdrop (mobile) */}
      {open && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed top-0 left-0 z-50 h-full w-64 bg-slate-900 border-r border-white/10 flex flex-col transition-transform duration-200 ${
          open ? 'translate-x-0' : '-translate-x-full'
        } lg:translate-x-0 lg:static lg:z-auto`}
      >
        {/* Logo */}
        <div className="p-5 border-b border-white/10 flex items-center justify-between">
          <Link href="/dashboard" className="flex items-center gap-2" onClick={onClose}>
            <div className="w-8 h-8 bg-gradient-to-br from-amber-400 to-orange-500 rounded-lg flex items-center justify-center">
              <span className="text-slate-900 font-bold text-sm">C</span>
            </div>
            <span className="text-white font-bold">CapexCycleOS</span>
          </Link>
          <button onClick={onClose} className="lg:hidden text-slate-400 hover:text-white">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-4">
          {/* Main */}
          <div className="px-4 mb-4">
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-2 px-2">Main</p>
            {mainNav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition mb-0.5 ${
                  isActive(item.href)
                    ? 'bg-amber-500/10 text-amber-300'
                    : 'text-slate-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
            ))}
          </div>

          {/* Enterprise */}
          <div className="px-4 mb-4">
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-2 px-2">Enterprise</p>
            {almNav.map((item) => (
              <div key={item.href}>
                <button
                  onClick={() => setAlmExpanded(!almExpanded)}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition mb-0.5 ${
                    pathname.startsWith('/alm')
                      ? 'bg-amber-500/10 text-amber-300'
                      : 'text-slate-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <item.icon className="h-4 w-4" />
                    {item.label}
                  </div>
                  {almExpanded ? (
                    <ChevronDown className="h-3.5 w-3.5" />
                  ) : (
                    <ChevronRight className="h-3.5 w-3.5" />
                  )}
                </button>
                {almExpanded && item.children && (
                  <div className="ml-4 pl-3 border-l border-white/10">
                    {item.children.map((child) => (
                      <Link
                        key={child.href + child.label}
                        href={child.href}
                        onClick={onClose}
                        className={`flex items-center gap-3 px-3 py-1.5 rounded-lg text-sm transition mb-0.5 ${
                          isActive(child.href) && (child.href !== '/alm' || pathname === '/alm')
                            ? 'text-amber-300'
                            : 'text-slate-500 hover:text-white'
                        }`}
                      >
                        <child.icon className="h-3.5 w-3.5" />
                        {child.label}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Settings */}
          <div className="px-4">
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-2 px-2">Settings</p>
            {settingsNav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition mb-0.5 ${
                  isActive(item.href)
                    ? 'bg-amber-500/10 text-amber-300'
                    : 'text-slate-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
            ))}
          </div>
        </nav>

        {/* Logout */}
        <div className="p-4 border-t border-white/10">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition"
          >
            <LogOut className="h-4 w-4" />
            Logout
          </button>
        </div>
      </aside>
    </>
  );
}
