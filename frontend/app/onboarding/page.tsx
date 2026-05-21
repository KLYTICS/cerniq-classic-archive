'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/store';
import { apiClient } from '@/lib/api';
import { analytics, EVENTS } from '@/lib/analytics';
import {
  ACCESS_REQUIRED_ROUTE,
  hasFreeBuilderAccess,
  hasPlatformAccess,
  normalizePlatformAccess,
  prefersPortalExperience,
} from '@/lib/access';
import { isRememberedPortalUser, rememberPortalUser } from '@/lib/subscription';
import {
  Building,
  Landmark,
  Users,
  Briefcase,
  Globe,
  Sparkles,
  ArrowRight,
  Shield,
  ChevronRight,
  TrendingUp,
  Check,
} from 'lucide-react';

type InstitutionType = 'cooperativa' | 'credit_union' | 'bank' | 'family_office';

interface SelectOption {
  type: InstitutionType;
  icon: React.ElementType;
  title: string;
  description: string;
  badge: string;
}

const typeOptions: SelectOption[] = [
  {
    type: 'cooperativa',
    icon: Building,
    title: 'Cooperativa PR',
    description: 'COSSEC 12-ratio compliance rules, accounting structures, and local reports.',
    badge: 'COSSEC Rules',
  },
  {
    type: 'credit_union',
    icon: Users,
    title: 'Credit Union',
    description: 'NCUA-compliant CAMEL framework, deposit shares, and loan concentrations.',
    badge: 'NCUA / US',
  },
  {
    type: 'bank',
    icon: Landmark,
    title: 'Community Bank',
    description: 'Duration gaps, interest rate sensitivity profiles, and regulatory stress testing.',
    badge: 'IRRBB / FDIC',
  },
  {
    type: 'family_office',
    icon: Briefcase,
    title: 'Family Office',
    description: 'Portfolio-level risk metrics, equity tracking, and custom volatility profiles.',
    badge: 'AUM / Custom',
  },
];

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

  const [institutionName, setInstitutionName] = useState('');
  const [institutionType, setInstitutionType] = useState<InstitutionType>('cooperativa');
  const [primaryRegulator, setPrimaryRegulator] = useState<'COSSEC' | 'NCUA'>('COSSEC');
  const [totalAssets, setTotalAssets] = useState('');
  const [preferredLanguage, setPreferredLanguage] = useState<'es' | 'en' | 'both'>('es');
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
    if (access && !hasPlatformAccess(access) && !hasFreeBuilderAccess(access)) {
      router.replace(ACCESS_REQUIRED_ROUTE);
      return;
    }
    if (onboardingComplete) {
      router.replace(hasFreeBuilderAccess(access) ? '/alm' : '/dashboard');
      return;
    }

    let cancelled = false;
    const redirectPortalUsers = async () => {
      const portalUser =
        typeof window !== 'undefined' &&
        (isRememberedPortalUser() || new URLSearchParams(window.location.search).get('welcome') === '1');
      if (portalUser) {
        router.replace('/dashboard');
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

        if (!cancelled && nextAccess && !hasPlatformAccess(nextAccess) && !hasFreeBuilderAccess(nextAccess)) {
          router.replace(ACCESS_REQUIRED_ROUTE);
          return;
        }

        const shouldUsePortal = Boolean(
          nextAccess?.platformAccessAllowed && (isRememberedPortalUser() || prefersPortalExperience(nextAccess)),
        );

        if (!cancelled && shouldUsePortal) {
          rememberPortalUser();
          router.replace('/dashboard');
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

  const handleTypeSelect = (type: InstitutionType) => {
    setInstitutionType(type);
    if (type === 'cooperativa') {
      setPrimaryRegulator('COSSEC');
    } else if (type === 'credit_union') {
      setPrimaryRegulator('NCUA');
    }
  };

  const formatCurrency = (val: string) => {
    const clean = val.replace(/[^0-9]/g, '');
    if (!clean) return '';
    const num = Number(clean);
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
    }).format(num);
  };

  const handleAssetChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/[^0-9]/g, '');
    setTotalAssets(raw);
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!user) return;

    setSaving(true);
    setError('');

    try {
      const trimmedInstitutionName = institutionName.trim();
      const workspaceName = trimmedInstitutionName
        ? `${trimmedInstitutionName} Workspace`
        : `${user.email.split('@')[0]} Workspace`;
      const existingWorkspaces = await apiClient.getMyWorkspaces().catch(() => []);
      const primaryWorkspace =
        Array.isArray(existingWorkspaces) && existingWorkspaces.length > 0
          ? existingWorkspaces[0]
          : await apiClient.createMyWorkspace(workspaceName);
      const numericAssets = Number(totalAssets);
      const createdInstitution = await apiClient.createInstitution({
        name: trimmedInstitutionName,
        type: institutionType,
        totalAssets: Number.isFinite(numericAssets) ? numericAssets : 0,
        reportingDate: new Date().toISOString().slice(0, 10),
        workspaceId: primaryWorkspace.id,
        primaryRegulator,
        preferredLanguage,
      });

      localStorage.setItem(
        `cerniq_profile_${user.id}`,
        JSON.stringify({
          institutionName: trimmedInstitutionName,
          institutionType,
          primaryRegulator,
          totalAssets: totalAssets.trim() || null,
          preferredLanguage,
          completedAt: new Date().toISOString(),
        }),
      );
      setOnboardingComplete(true);
      analytics.track(EVENTS.ONBOARDING_COMPLETED, {
        institutionType,
        primaryRegulator,
        preferredLanguage,
      });
      router.push(
        hasFreeBuilderAccess(access)
          ? `/onboarding/balance-sheet?institutionId=${createdInstitution.id}`
          : '/dashboard',
      );
    } catch (submitError: unknown) {
      setError(getSubmitErrorMessage(submitError));
    } finally {
      setSaving(false);
    }
  };

  if (!initialized || !isAuthenticated || onboardingComplete) {
    return (
      <div className="min-h-screen bg-[#030712] flex items-center justify-center">
        <div className="relative flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-cyan-400" />
          <div className="absolute h-8 w-8 rounded-full bg-cyan-950/20 blur-sm" />
        </div>
      </div>
    );
  }

  // Find preview properties
  const selectedTypeOption = typeOptions.find((o) => o.type === institutionType);
  const TypeIcon = selectedTypeOption?.icon || Building;

  return (
    <div className="min-h-screen bg-[#020617] text-slate-100 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Decorative premium radial gradients */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-gradient-to-br from-cyan-500/10 to-transparent blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-gradient-to-br from-amber-500/5 to-transparent blur-[120px] pointer-events-none" />

      {/* Grid Pattern overlay */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b_1px,transparent_1px),linear-gradient(to_bottom,#1e293b_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] opacity-[0.15] pointer-events-none" />

      <div className="max-w-6xl w-full grid md:grid-cols-12 gap-8 items-stretch relative z-10 py-8">
        {/* Left Side: Form Container */}
        <div className="md:col-span-7 flex flex-col justify-between">
          <div className="bg-slate-900/60 backdrop-blur-md border border-slate-800/80 rounded-2xl p-6 sm:p-8 shadow-2xl relative">
            <div className="absolute top-0 right-8 h-[2px] w-24 bg-gradient-to-r from-transparent via-cyan-500/50 to-transparent" />
            
            {/* Logo and Greeting */}
            <div className="flex items-center gap-2.5 mb-5">
              <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-cyan-400 to-blue-600 flex items-center justify-center text-[#020617] font-extrabold text-lg shadow-lg shadow-cyan-500/20">
                C
              </div>
              <span className="text-sm font-semibold tracking-wider uppercase text-cyan-400 font-display">
                Cerniq Intelligence
              </span>
            </div>

            <h1 className="text-3xl font-extrabold tracking-tight text-white mb-2">
              Configure Your Institution
            </h1>
            <p className="text-slate-400 text-sm mb-6 leading-relaxed">
              Set up your institution profiles below. CERNIQ customizes your analysis engine, risk thresholds, and regulatory reporting suites.
            </p>

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Institution Name */}
              <div className="space-y-1.5 group">
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 group-focus-within:text-cyan-400 transition-colors">
                  Institution Name
                </label>
                <input
                  type="text"
                  value={institutionName}
                  onChange={(e) => setInstitutionName(e.target.value)}
                  placeholder="e.g. Cooperativa de Ahorro y Crédito Metropolitana"
                  className="w-full rounded-xl border border-slate-800 bg-slate-950/80 px-4 py-3 text-sm text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500 transition"
                  required
                />
              </div>

              {/* Institution Type Card Grid */}
              <div className="space-y-2">
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Institution Type
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {typeOptions.map((opt) => {
                    const Icon = opt.icon;
                    const isSelected = institutionType === opt.type;
                    return (
                      <button
                        key={opt.type}
                        type="button"
                        onClick={() => handleTypeSelect(opt.type)}
                        className={`text-left rounded-xl border-2 p-4 transition-all relative overflow-hidden group flex flex-col justify-between h-[120px] ${
                          isSelected
                            ? 'border-cyan-500 bg-cyan-950/20 shadow-lg shadow-cyan-500/10'
                            : 'border-slate-800 bg-slate-950/40 hover:border-slate-700 hover:bg-slate-950/70'
                        }`}
                      >
                        <div className="flex items-center justify-between w-full">
                          <Icon className={`h-5 w-5 ${isSelected ? 'text-cyan-400' : 'text-slate-500'}`} />
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                            isSelected ? 'bg-cyan-500/20 text-cyan-300' : 'bg-slate-800/80 text-slate-400'
                          }`}>
                            {opt.badge}
                          </span>
                        </div>
                        <div>
                          <h4 className="text-sm font-bold text-white mb-0.5">{opt.title}</h4>
                          <p className="text-xs text-slate-400 line-clamp-2 leading-tight">
                            {opt.description}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Assets and Language */}
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Approx. Total Assets (USD)
                  </label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 text-sm">$</span>
                    <input
                      type="text"
                      value={formatCurrency(totalAssets)}
                      onChange={handleAssetChange}
                      placeholder="$250,000,000"
                      className="w-full rounded-xl border border-slate-800 bg-slate-950/80 pl-7 pr-4 py-3 text-sm text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500 transition font-mono"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Preferred Language
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {(['es', 'en', 'both'] as const).map((langCode) => {
                      const isSelected = preferredLanguage === langCode;
                      const labels = { es: 'Español', en: 'English', both: 'Bilingual' };
                      return (
                        <button
                          key={langCode}
                          type="button"
                          onClick={() => setPreferredLanguage(langCode)}
                          className={`py-3 rounded-xl border text-xs font-bold transition flex items-center justify-center ${
                            isSelected
                              ? 'border-cyan-500 bg-cyan-950/30 text-cyan-300'
                              : 'border-slate-800 bg-slate-950/50 text-slate-400 hover:border-slate-700 hover:text-white'
                          }`}
                        >
                          {labels[langCode]}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Informational note */}
              <div className="rounded-xl border border-cyan-500/10 bg-cyan-950/10 px-4 py-3 text-xs text-cyan-300/80 flex items-start gap-2.5 leading-relaxed">
                <Shield className="h-4 w-4 text-cyan-400 mt-0.5 flex-shrink-0" />
                <div>
                  <span className="font-bold text-cyan-300">Intake Pathway active:</span> Free access remains preview-first. CERNIQ will construct your workspace, then transition into balance-sheet intake for mock ALM calculations.
                </div>
              </div>

              {error && (
                <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-xs text-red-400 font-medium">
                  {error}
                </div>
              )}

              {/* Actions */}
              <div className="pt-2 flex gap-3">
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 px-6 py-3.5 font-bold text-[#020617] disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-cyan-500/10 flex items-center justify-center gap-2 group transition"
                >
                  {saving ? (
                    <>
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-[#020617] border-t-transparent" />
                      Provisioning Workspace...
                    </>
                  ) : (
                    <>
                      Continue to Balance Sheet Intake
                      <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
                    </>
                  )}
                </button>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => {
                    setOnboardingComplete(true);
                    analytics.track(EVENTS.ONBOARDING_SKIPPED);
                    router.push('/alm');
                  }}
                  className="rounded-xl border border-slate-800 bg-slate-950/30 px-5 py-3.5 text-sm font-semibold text-slate-400 hover:text-white hover:border-slate-700 transition"
                >
                  Skip
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Right Side: Dynamic Interactive Preview Panel */}
        <div className="md:col-span-5 flex flex-col justify-center">
          <div className="bg-slate-900/40 border border-slate-800/60 rounded-2xl p-6 flex flex-col justify-between h-full relative overflow-hidden shadow-xl min-h-[400px]">
            {/* Visual background details */}
            <div className="absolute top-[-50px] right-[-50px] w-[200px] h-[200px] rounded-full bg-cyan-500/5 blur-3xl pointer-events-none" />
            
            <div>
              <div className="flex items-center gap-2 mb-6">
                <Sparkles className="h-4 w-4 text-amber-400" />
                <span className="text-xs font-bold uppercase tracking-wider text-amber-400">
                  Live Workspace Preview
                </span>
              </div>

              {/* Simulated Dashboard Frame */}
              <div className="border border-slate-800/80 rounded-xl bg-slate-950/80 p-5 shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-[3px] bg-gradient-to-r from-cyan-500 via-blue-500 to-transparent" />
                
                {/* Header preview */}
                <div className="flex items-center justify-between pb-4 border-b border-slate-900 mb-4">
                  <div className="flex items-center gap-2.5">
                    <div className="h-8 w-8 rounded-lg bg-cyan-950/60 border border-cyan-500/30 flex items-center justify-center shadow-inner">
                      <TypeIcon className="h-4 w-4 text-cyan-400" />
                    </div>
                    <div>
                      <h3 className="text-xs font-extrabold text-white truncate max-w-[150px]">
                        {institutionName.trim() || 'Your Institution'}
                      </h3>
                      <p className="text-[9px] text-slate-500 uppercase tracking-widest font-mono">
                        {institutionType.replace('_', ' ')}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 bg-cyan-500/10 px-2 py-0.5 rounded-full border border-cyan-500/20 text-[9px] font-bold text-cyan-400">
                    <Globe className="h-2.5 w-2.5" />
                    {preferredLanguage === 'both' ? 'Bilingual' : preferredLanguage === 'es' ? 'ES' : 'EN'}
                  </div>
                </div>

                {/* Subsystem status */}
                <div className="space-y-3">
                  <div className="flex justify-between items-center text-[11px]">
                    <span className="text-slate-500">Asset Size:</span>
                    <span className="font-semibold text-slate-300 font-mono">
                      {totalAssets ? formatCurrency(totalAssets) : 'Pending input...'}
                    </span>
                  </div>

                  <div className="flex justify-between items-center text-[11px]">
                    <span className="text-slate-500">Regulatory Framework:</span>
                    <span className="font-semibold text-cyan-400">
                      {primaryRegulator} Framework
                    </span>
                  </div>

                  <div className="flex justify-between items-center text-[11px] pb-3 border-b border-slate-900">
                    <span className="text-slate-500">Active Ratios Suite:</span>
                    <span className="font-semibold text-slate-300">
                      {institutionType === 'cooperativa'
                        ? '12-Ratio Rules (COSSEC)'
                        : institutionType === 'credit_union'
                          ? 'CAMEL Metrics (NCUA)'
                          : institutionType === 'bank'
                            ? 'LCR / IRRBB Standard'
                            : 'Asset Volatility Tracker'}
                    </span>
                  </div>
                </div>

                {/* Micro chart preview */}
                <div className="mt-4 bg-slate-900/60 rounded-lg p-3 border border-slate-900/80">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wide">
                      Dynamic Exposure Profile
                    </span>
                    <span className="text-[9px] text-emerald-400 flex items-center gap-0.5 font-bold">
                      <TrendingUp className="h-2.5 w-2.5" />
                      COSSEC compliant
                    </span>
                  </div>
                  <div className="flex items-end gap-1.5 h-12 pt-2">
                    {[30, 45, 60, 40, 75, 90, 80, 95].map((h, i) => (
                      <div
                        key={i}
                        style={{ height: `${h}%` }}
                        className={`w-full rounded-t-[2px] transition-all duration-500 ${
                          i % 2 === 0
                            ? 'bg-gradient-to-t from-cyan-500/20 to-cyan-500'
                            : 'bg-gradient-to-t from-blue-500/20 to-blue-500'
                        }`}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-6 border-t border-slate-800/40 pt-4">
              <div className="text-xs font-bold text-slate-400 mb-2 flex items-center gap-2">
                <Check className="h-3.5 w-3.5 text-cyan-400" />
                Workspace Features Activated
              </div>
              <ul className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-[11px] text-slate-500">
                <li className="flex items-center gap-1.5">
                  <ChevronRight className="h-3 w-3 text-cyan-500" />
                  Bilingual PDF Exports
                </li>
                <li className="flex items-center gap-1.5">
                  <ChevronRight className="h-3 w-3 text-cyan-500" />
                  Yield Curve Scenario Builder
                </li>
                <li className="flex items-center gap-1.5">
                  <ChevronRight className="h-3 w-3 text-cyan-500" />
                  Interest Rate Shock Solver
                </li>
                <li className="flex items-center gap-1.5">
                  <ChevronRight className="h-3 w-3 text-cyan-500" />
                  CAMEL / COSSEC Ratio Cards
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
