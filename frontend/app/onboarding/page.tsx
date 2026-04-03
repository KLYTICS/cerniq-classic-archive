'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/store';
import { apiClient } from '@/lib/api';
import { analytics, EVENTS } from '@/lib/analytics';
import {
  ACCESS_REQUIRED_ROUTE,
  hasPlatformAccess,
  normalizePlatformAccess,
  prefersPortalExperience,
} from '@/lib/access';
import { isRememberedPortalUser, rememberPortalUser } from '@/lib/subscription';

export default function OnboardingPage() {
  const router = useRouter();
  const {
    initialized,
    isAuthenticated,
    onboardingComplete,
    user,
    access,
    setAccess,
    setOnboardingComplete,
  } = useAuthStore();

  const [companyName, setCompanyName] = useState('');
  const [role, setRole] = useState('Portfolio Manager');
  const [primaryGoal, setPrimaryGoal] = useState('risk_analytics');
  const [riskPreference, setRiskPreference] = useState('balanced');
  const [seedPortfolio, setSeedPortfolio] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const getSubmitErrorMessage = (submitError: unknown) => {
    if (
      typeof submitError === 'object' &&
      submitError !== null &&
      'response' in submitError &&
      typeof (submitError as { response?: { data?: { error?: unknown } } }).response?.data?.error === 'string'
    ) {
      return (submitError as { response?: { data?: { error: string } } }).response?.data?.error || 'Onboarding failed. Please retry.';
    }

    if (
      typeof submitError === 'object' &&
      submitError !== null &&
      'message' in submitError &&
      typeof (submitError as { message?: unknown }).message === 'string'
    ) {
      return (submitError as { message: string }).message;
    }

    return 'Onboarding failed. Please retry.';
  };

  useEffect(() => {
    if (!initialized) return;
    if (!isAuthenticated) {
      router.replace('/login');
      return;
    }
    if (access && !hasPlatformAccess(access)) {
      router.replace(ACCESS_REQUIRED_ROUTE);
      return;
    }
    if (onboardingComplete) {
      router.replace('/dashboard');
      return;
    }
    // ALM/billing subscription buyers should go to /portal, not onboarding
    // Check if user arrived via magic link (portal flow) or has a subscription indicator
    let cancelled = false;
    const redirectPortalUsers = async () => {
      const portalUser = typeof window !== 'undefined' &&
        (isRememberedPortalUser() ||
         new URLSearchParams(window.location.search).get('welcome') === '1');
      if (portalUser) {
        router.replace('/portal');
        return;
      }

      try {
        const profile = await apiClient.getCurrentUser();
        const nextAccess = normalizePlatformAccess(
          typeof profile === 'object' && profile !== null && 'access' in profile
            ? (profile as { access?: unknown }).access
            : null,
        );
        setAccess(nextAccess);

        if (!cancelled && nextAccess && !hasPlatformAccess(nextAccess)) {
          router.replace(ACCESS_REQUIRED_ROUTE);
          return;
        }

        const shouldUsePortal = Boolean(
          nextAccess?.platformAccessAllowed &&
          (isRememberedPortalUser() || prefersPortalExperience(nextAccess)),
        );

        if (!cancelled && shouldUsePortal) {
          rememberPortalUser();
          router.replace('/portal');
        }
      } catch {
        // If profile can't be loaded we keep the standard onboarding path.
      }
    };

    redirectPortalUsers();
    return () => {
      cancelled = true;
    };
  }, [initialized, isAuthenticated, onboardingComplete, router, access, setAccess]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!user) return;

    setSaving(true);
    setError('');

    try {
      if (companyName.trim()) {
        try {
          await apiClient.createWorkspace(user.id, {
            name: `${companyName.trim()} Workspace`,
            company_name: companyName.trim(),
          });
        } catch (workspaceError) {
          console.warn('Workspace provisioning failed during onboarding:', workspaceError);
        }
      }

      if (seedPortfolio) {
        try {
          const created = await apiClient.createPortfolio(user.id, {
            name: 'AI Macro Starter',
            description: 'Seeded by onboarding for VaR, CVaR, and Monte Carlo workflows',
            benchmark: 'QQQ',
            initial_capital: 250000,
            initialCash: 250000,
            currency: 'USD',
          });

          if (created?.id) {
            const starterPositions = [
              { symbol: 'NVDA', ticker: 'NVDA', quantity: 120, price: 860 },
              { symbol: 'MSFT', ticker: 'MSFT', quantity: 80, price: 415 },
              { symbol: 'AMZN', ticker: 'AMZN', quantity: 100, price: 180 },
              { symbol: 'TSM', ticker: 'TSM', quantity: 110, price: 145 },
            ];

            await Promise.all(
              starterPositions.map((position) =>
                apiClient.addPosition(created.id, user.id, position),
              ),
            );
          }
        } catch (portfolioError) {
          console.warn('Starter portfolio provisioning failed during onboarding:', portfolioError);
        }
      }

      localStorage.setItem(
        `cerniq_profile_${user.id}`,
        JSON.stringify({
          companyName: companyName.trim() || null,
          role,
          primaryGoal,
          riskPreference,
          completedAt: new Date().toISOString(),
        }),
      );
      setOnboardingComplete(true);
      analytics.track(EVENTS.ONBOARDING_COMPLETED, { role, primaryGoal, riskPreference });
      router.push('/dashboard');
    } catch (submitError: unknown) {
      setError(getSubmitErrorMessage(submitError));
    } finally {
      setSaving(false);
    }
  };

  if (!initialized || !isAuthenticated || onboardingComplete) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-cyan-400" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-cyan-950 text-white px-6 py-12">
      <div className="max-w-2xl mx-auto bg-slate-900/70 border border-cyan-500/20 rounded-2xl p-8">
        <h1 className="text-3xl font-bold mb-2">Welcome to CERNIQ</h1>
        <p className="text-slate-300 mb-8">
          Configure your workspace to unlock analisis ALM, Monte Carlo, VaR/CVaR, and cumplimiento COSSEC.
        </p>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm text-slate-300 mb-1">Firm / Team Name</label>
            <input
              type="text"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder="Aperture Capital"
              className="w-full rounded-lg bg-slate-800 border border-slate-700 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-cyan-500"
            />
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-slate-300 mb-1">Role</label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="w-full rounded-lg bg-slate-800 border border-slate-700 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-cyan-500"
              >
                <option>Portfolio Manager</option>
                <option>Risk Lead</option>
                <option>CIO</option>
                <option>Quant Analyst</option>
                <option>Treasury / ALM</option>
              </select>
            </div>
            <div>
              <label className="block text-sm text-slate-300 mb-1">Risk Preference</label>
              <select
                value={riskPreference}
                onChange={(e) => setRiskPreference(e.target.value)}
                className="w-full rounded-lg bg-slate-800 border border-slate-700 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-cyan-500"
              >
                <option value="conservative">Conservative</option>
                <option value="balanced">Balanced</option>
                <option value="aggressive">Aggressive</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm text-slate-300 mb-1">Primary Goal</label>
            <select
              value={primaryGoal}
              onChange={(e) => setPrimaryGoal(e.target.value)}
              className="w-full rounded-lg bg-slate-800 border border-slate-700 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-cyan-500"
            >
              <option value="risk_analytics">Risk Analytics (VaR/CVaR + Stress)</option>
              <option value="monte_carlo">Monte Carlo Scenario Planning</option>
              <option value="valuation">Cyclical Valuation Intelligence</option>
              <option value="spendcheck">SpendCheck Audit Automation</option>
              <option value="alm">ALM and Treasury Management</option>
            </select>
          </div>

          <label className="flex items-center gap-3 text-sm text-slate-300">
            <input
              type="checkbox"
              checked={seedPortfolio}
              onChange={(e) => setSeedPortfolio(e.target.checked)}
              className="h-4 w-4 rounded border-slate-600 bg-slate-800 text-cyan-500 focus:ring-cyan-500"
            />
            Seed a starter portfolio for immediate VaR/CVaR and Monte Carlo analysis
          </label>

          {error && (
            <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">
              {error}
            </div>
          )}

          <div className="pt-2 flex gap-3">
            <button
              type="submit"
              disabled={saving}
              className="flex-1 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-500 px-4 py-3 font-semibold text-white disabled:opacity-60"
            >
              {saving ? 'Provisioning Workspace...' : 'Complete Setup'}
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() => {
                setOnboardingComplete(true);
                analytics.track(EVENTS.ONBOARDING_SKIPPED);
                router.push('/dashboard');
              }}
              className="rounded-lg border border-slate-600 px-4 py-3 text-slate-200 hover:bg-slate-800 disabled:opacity-60"
            >
              Skip
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
