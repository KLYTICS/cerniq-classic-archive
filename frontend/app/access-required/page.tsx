'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { CreditCard, Lock, LogOut, ShieldAlert } from 'lucide-react';
import { useAuthStore } from '@/lib/store';
import {
  ACCESS_REQUIRED_ROUTE,
  hasFreeBuilderAccess,
  hasPlatformAccess,
  prefersPortalExperience,
  resolveAuthenticatedDestination,
} from '@/lib/access';
import { isRememberedPortalUser, rememberPortalUser } from '@/lib/subscription';
import { getPublicApiUrl } from '@/lib/api-base';

const AUTH_SETTLE_GRACE_MS = 1200;

function hasStoredAuthHint() {
  if (typeof window === 'undefined') {
    return false;
  }

  return [
    sessionStorage.getItem('cerniq_access_token'),
    sessionStorage.getItem('capex_access_token'),
    localStorage.getItem('cerniq_auth_user'),
    localStorage.getItem('capex_auth_user'),
  ].some(Boolean);
}

function reasonCopy(reason: string | undefined) {
  switch (reason) {
    case 'subscription_past_due':
      return 'Your subscription is past due. Update billing to reopen the platform.';
    case 'subscription_cancelled':
      return 'Your paid plan is no longer active. Reactivate billing to regain access.';
    case 'subscription_required':
    default:
      return 'CERNIQ is now closed unless the account is paid or on the CEO master account.';
  }
}

export default function AccessRequiredPage() {
  const router = useRouter();
  const { initialized, isAuthenticated, user, access, onboardingComplete, logout } = useAuthStore();
  const [openingBilling, setOpeningBilling] = useState(false);
  const [billingError, setBillingError] = useState('');
  const [allowGuestRedirect, setAllowGuestRedirect] = useState(false);

  useEffect(() => {
    if (!initialized || isAuthenticated) {
      setAllowGuestRedirect(false);
      return;
    }

    if (!hasStoredAuthHint()) {
      setAllowGuestRedirect(true);
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setAllowGuestRedirect(true);
    }, AUTH_SETTLE_GRACE_MS);

    return () => window.clearTimeout(timeoutId);
  }, [initialized, isAuthenticated]);

  useEffect(() => {
    if (!initialized) {
      return;
    }

    if (!isAuthenticated) {
      if (allowGuestRedirect) {
        router.replace('/login');
      }
      return;
    }

    if (hasPlatformAccess(access) || hasFreeBuilderAccess(access)) {
      router.replace(
        resolveAuthenticatedDestination({
          access,
          onboardingComplete,
          portalPreferred: Boolean(
            isRememberedPortalUser() || prefersPortalExperience(access),
          ),
        }),
      );
    }
  }, [initialized, isAuthenticated, access, onboardingComplete, router, allowGuestRedirect]);

  const billingRecoveryAvailable = useMemo(() => {
    return Boolean(access?.effectiveTier !== 'free' || access?.effectiveStatus);
  }, [access]);

  const openBillingPortal = async () => {
    setOpeningBilling(true);
    setBillingError('');

    try {
      const res = await fetch(getPublicApiUrl('/api/billing/portal'), {
        method: 'POST',
        credentials: 'include',
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok || typeof data.portalUrl !== 'string') {
        throw new Error(
          typeof data?.message === 'string'
            ? data.message
            : 'No billing account was found for this user.',
        );
      }

      rememberPortalUser();
      window.location.href = data.portalUrl;
    } catch (error) {
      setBillingError(
        error instanceof Error
          ? error.message
          : 'Unable to open billing recovery right now.',
      );
    } finally {
      setOpeningBilling(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    router.replace('/login');
  };

  if (!initialized || (!isAuthenticated && !allowGuestRedirect)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#071122] text-white">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-cyan-200 border-t-cyan-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#071122] px-4 py-10 text-white">
      <div className="mx-auto flex max-w-3xl flex-col gap-6">
        <div className="rounded-[2rem] border border-[#2b4168] bg-[#121c33]/95 p-8 shadow-[0_30px_120px_rgba(0,0,0,0.45)] backdrop-blur-xl sm:p-10">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-300">
            <ShieldAlert className="h-7 w-7" />
          </div>

          <p className="mt-6 text-xs font-semibold uppercase tracking-[0.28em] text-cyan-200/70">
            Platform Closed
          </p>
          <h1 className="mt-3 font-display text-4xl text-white sm:text-5xl">
            Access now requires a paid plan.
          </h1>
          <p className="mt-5 max-w-2xl text-sm leading-7 text-slate-300 sm:text-base">
            {reasonCopy(access?.reason)}
          </p>

          <div className="mt-8 grid gap-4 rounded-3xl border border-white/10 bg-white/5 p-5 sm:grid-cols-3">
            <div>
              <p className="text-[11px] uppercase tracking-[0.24em] text-slate-400">
                Account
              </p>
              <p className="mt-2 text-sm text-white">{user?.email || 'Unknown user'}</p>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-[0.24em] text-slate-400">
                Tier
              </p>
              <p className="mt-2 text-sm capitalize text-white">
                {access?.effectiveTier || 'free'}
              </p>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-[0.24em] text-slate-400">
                Status
              </p>
              <p className="mt-2 text-sm capitalize text-white">
                {access?.effectiveStatus || 'none'}
              </p>
            </div>
          </div>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/pricing"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#E8A020] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#d19218]"
            >
              <Lock className="h-4 w-4" />
              Upgrade plan
            </Link>

            {billingRecoveryAvailable && (
              <button
                onClick={openBillingPortal}
                disabled={openingBilling}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/12 bg-white/8 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/12 disabled:opacity-60"
              >
                <CreditCard className="h-4 w-4" />
                {openingBilling ? 'Opening billing...' : 'Recover billing'}
              </button>
            )}

            <button
              onClick={() => void handleLogout()}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-transparent px-5 py-3 text-sm font-semibold text-slate-300 transition hover:bg-white/6 hover:text-white"
            >
              <LogOut className="h-4 w-4" />
              Log out
            </button>
          </div>

          {billingError && (
            <p className="mt-4 text-sm text-rose-300">{billingError}</p>
          )}
        </div>

        <p className="px-2 text-center text-xs text-slate-400">
          Public pages like pricing and checkout remain available. Protected app routes will keep redirecting to {ACCESS_REQUIRED_ROUTE}.
        </p>
      </div>
    </div>
  );
}
