'use client';

import { useState, useEffect, createContext, useContext } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { BarChart3, Upload, CreditCard, Settings, LogOut, HelpCircle } from 'lucide-react';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { CerniqLockup } from '@/components/brand/CerniqLogo';
import PortalPaywall from '@/components/portal/PortalPaywall';
import { requiresPortalPaywall, type PortalSubscription } from '@/lib/subscription';
import { getPublicApiUrl } from '@/lib/api-base';
import { unwrapApiData } from '@/lib/api-response';

interface PortalUser {
  id: string;
  email: string;
  name?: string;
}

interface PortalContextType {
  user: PortalUser | null;
  subscription: PortalSubscription | null;
  loading: boolean;
}

const PortalContext = createContext<PortalContextType>({ user: null, subscription: null, loading: true });
export const usePortal = () => useContext(PortalContext);

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
  const isPortalLoginRoute = pathname === '/portal/login';

  useEffect(() => {
    // Skip auth check for login page to avoid redirect loop
    if (isPortalLoginRoute) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function loadUser() {
      try {
        const [profileRes, subRes] = await Promise.all([
          fetch(getPublicApiUrl('/api/auth/profile'), { credentials: 'include' }),
          fetch(getPublicApiUrl('/api/billing/subscription'), { credentials: 'include' }),
        ]);

        if (!profileRes.ok) {
          if (!cancelled) {
            setUser(null);
            setSubscription(null);
            router.replace('/portal/login');
          }
          return;
        }

        const profilePayload = unwrapApiData<PortalUser | null>(
          await profileRes.json().catch(() => null),
        );

        if (!profilePayload?.id || !profilePayload.email) {
          if (!cancelled) {
            setUser(null);
            setSubscription(null);
            router.replace('/portal/login');
          }
          return;
        }

        if (!cancelled) {
          setUser(profilePayload);
        }

        if (subRes.ok) {
          const subscriptionPayload = unwrapApiData<PortalSubscription | null>(
            await subRes.json().catch(() => null),
          );
          if (!cancelled) {
            setSubscription(subscriptionPayload);
          }
        }
      } catch {
        if (!cancelled) {
          setUser(null);
          setSubscription(null);
          router.replace('/portal/login');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadUser();

    return () => {
      cancelled = true;
    };
  }, [router, pathname, isPortalLoginRoute]);

  const logout = async () => {
    await fetch(getPublicApiUrl('/api/auth/logout'), { method: 'POST', credentials: 'include' });
    router.push('/');
  };

  if (loading || (!isPortalLoginRoute && !user)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f7fbff]">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-cyan-200 border-t-cyan-600" />
          <span className="text-sm text-slate-500">Loading portal...</span>
        </div>
      </div>
    );
  }

  // Login page renders without sidebar chrome
  if (isPortalLoginRoute) {
    return (
      <PortalContext.Provider value={{ user, subscription, loading }}>
        <ErrorBoundary context="portal">
          {children}
        </ErrorBoundary>
      </PortalContext.Provider>
    );
  }

  const showPortalPaywall = Boolean(user && requiresPortalPaywall(subscription));

  return (
    <PortalContext.Provider value={{ user, subscription, loading }}>
      <ErrorBoundary context="portal">
        <div className="flex min-h-screen bg-[#f7fbff] text-slate-950">
          <aside className="flex w-72 flex-col border-r border-slate-200/80 bg-[rgba(255,255,255,0.98)] shadow-[0_24px_80px_rgba(41,85,133,0.14)]">
            <div className="border-b border-slate-200/80 p-5">
              <Link href="/portal" className="inline-flex">
                <CerniqLockup compact tagline="Client Portal" />
              </Link>
              <div className="mt-4 rounded-[1.35rem] border border-cyan-200/60 bg-gradient-to-br from-cyan-50 via-white to-sky-50 px-4 py-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-cyan-700/80">Report delivery</p>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Submit balance-sheet files, track processing, and retrieve completed CERNIQ reports.
                </p>
              </div>
            </div>

            <nav className="flex-1 space-y-1 p-3">
              {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
                const active = pathname === href;
                return (
                  <Link
                    key={href}
                    href={href}
                    className={`flex items-center gap-3 rounded-2xl px-3.5 py-3 text-sm transition ${
                      active
                        ? 'border border-cyan-200/80 bg-gradient-to-r from-cyan-50 to-sky-50 font-medium text-cyan-800 shadow-[0_12px_28px_rgba(34,211,238,0.12)]'
                        : 'text-slate-600 hover:bg-slate-50 hover:text-slate-950'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    {label}
                  </Link>
                );
              })}
            </nav>

            <div className="space-y-1 border-t border-slate-200/80 p-3">
              <a
                href="mailto:soporte@cerniq.io"
                className="flex items-center gap-3 rounded-2xl px-3.5 py-3 text-sm text-slate-600 transition hover:bg-slate-50 hover:text-slate-950"
              >
                <HelpCircle className="h-4 w-4" />
                Get Help
              </a>
              <button
                onClick={logout}
                className="flex w-full items-center gap-3 rounded-2xl px-3.5 py-3 text-sm text-slate-600 transition hover:bg-slate-50 hover:text-slate-950"
              >
                <LogOut className="h-4 w-4" />
                Log out
              </button>
            </div>

            {user && (
              <div className="border-t border-slate-200/80 p-4">
                <p className="truncate text-xs text-slate-500">{user.email}</p>
                <p className="mt-0.5 text-[10px] capitalize text-slate-400">
                  {subscription?.tier || 'free'} plan
                </p>
              </div>
            )}
          </aside>

          <main className="flex-1 overflow-auto">
            <div className="min-h-screen px-4 py-6 sm:px-6 lg:px-8">
              <div className="mx-auto max-w-6xl">
                {showPortalPaywall && user ? (
                  <PortalPaywall
                    path={pathname}
                    subscription={subscription}
                    user={{ email: user.email, name: user.name }}
                  />
                ) : children}
              </div>
            </div>
          </main>
        </div>
      </ErrorBoundary>
    </PortalContext.Provider>
  );
}
