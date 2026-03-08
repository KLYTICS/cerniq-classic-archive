'use client';

import { useState, useEffect, createContext, useContext } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { BarChart3, Upload, CreditCard, Settings, LogOut, HelpCircle } from 'lucide-react';
import { ErrorBoundary } from '@/components/ErrorBoundary';

interface PortalUser {
  id: string;
  email: string;
  name?: string;
}

interface PortalSubscription {
  tier: string;
  status: string;
  currentPeriodEnd?: string;
  reportsUsed?: number;
}

interface PortalContextType {
  user: PortalUser | null;
  subscription: PortalSubscription | null;
  loading: boolean;
}

const PortalContext = createContext<PortalContextType>({ user: null, subscription: null, loading: true });
export const usePortal = () => useContext(PortalContext);

const NODE_API_URL = (process.env.NEXT_PUBLIC_NODE_API_URL || '').trim().replace(/\/+$/, '');

const NAV_ITEMS = [
  { href: '/portal', label: 'My Reports', icon: BarChart3 },
  { href: '/portal/submit', label: 'Submit Data', icon: Upload },
  { href: '/portal/billing', label: 'Billing', icon: CreditCard },
  { href: '/portal/settings', label: 'Settings', icon: Settings },
];

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<PortalUser | null>(null);
  const [subscription, setSubscription] = useState<PortalSubscription | null>(null);
  const [loading, setLoading] = useState(true);
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    // Skip auth check for login page to avoid redirect loop
    if (pathname === '/portal/login') {
      setLoading(false);
      return;
    }

    async function loadUser() {
      try {
        const [profileRes, subRes] = await Promise.all([
          fetch(`${NODE_API_URL}/api/auth/profile`, { credentials: 'include' }),
          fetch(`${NODE_API_URL}/api/billing/subscription`, { credentials: 'include' }),
        ]);
        if (profileRes.ok) {
          setUser(await profileRes.json());
          if (subRes.ok) setSubscription(await subRes.json());
        } else {
          router.push('/portal/login');
        }
      } catch {
        router.push('/portal/login');
      } finally {
        setLoading(false);
      }
    }
    loadUser();
  }, [router, pathname]);

  const logout = async () => {
    await fetch(`${NODE_API_URL}/api/auth/logout`, { method: 'POST', credentials: 'include' });
    router.push('/');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
          <span className="text-sm text-gray-500">Loading portal...</span>
        </div>
      </div>
    );
  }

  // Login page renders without sidebar chrome
  if (pathname === '/portal/login') {
    return (
      <PortalContext.Provider value={{ user, subscription, loading }}>
        <ErrorBoundary context="portal">
          {children}
        </ErrorBoundary>
      </PortalContext.Provider>
    );
  }

  return (
    <PortalContext.Provider value={{ user, subscription, loading }}>
      <ErrorBoundary context="portal">
        <div className="min-h-screen bg-gray-50 flex">
          {/* Sidebar */}
          <aside className="w-60 bg-white border-r border-gray-200 flex flex-col">
            <div className="p-5 border-b border-gray-100">
              <Link href="/portal" className="flex items-center gap-2">
                <div className="w-8 h-8 bg-[#1B3A6B] rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold text-sm">C</span>
                </div>
                <span className="font-bold text-[#1B3A6B]">CERNIQ</span>
              </Link>
            </div>

            <nav className="flex-1 p-3 space-y-1">
              {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
                const active = pathname === href;
                return (
                  <Link
                    key={href}
                    href={href}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition ${
                      active
                        ? 'bg-blue-50 text-[#1B3A6B] font-medium'
                        : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    {label}
                  </Link>
                );
              })}
            </nav>

            <div className="p-3 border-t border-gray-100 space-y-1">
              <a
                href="mailto:erwin@klytics.io"
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-gray-600 hover:bg-gray-50"
              >
                <HelpCircle className="h-4 w-4" />
                Get Help
              </a>
              <button
                onClick={logout}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-gray-600 hover:bg-gray-50"
              >
                <LogOut className="h-4 w-4" />
                Log out
              </button>
            </div>

            {user && (
              <div className="p-4 border-t border-gray-100">
                <p className="text-xs text-gray-500 truncate">{user.email}</p>
                <p className="text-[10px] text-gray-400 capitalize mt-0.5">
                  {subscription?.tier || 'free'} plan
                </p>
              </div>
            )}
          </aside>

          {/* Main content */}
          <main className="flex-1 overflow-auto">
            {children}
          </main>
        </div>
      </ErrorBoundary>
    </PortalContext.Provider>
  );
}
