'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { apiClient } from '@/lib/api';
import { analytics, EVENTS } from '@/lib/analytics';
import { getCurrentSubscription } from '@/lib/billing';
import { CerniqMark } from '@/components/brand/CerniqLogo';
import { useAuthStore } from '@/lib/store';
import { useTranslation } from '@/lib/i18n';
import { hasPaidPortalAccess, isRememberedPortalUser, rememberPortalUser } from '@/lib/subscription';
import { ArrowRight } from 'lucide-react';

const NODE_API_URL = (process.env.NEXT_PUBLIC_NODE_API_URL || '').trim().replace(/\/+$/, '');

function parseBooleanEnv(raw: string | undefined, fallback: boolean): boolean {
  const normalized = (raw || '').trim().toLowerCase();
  if (!normalized) {
    return fallback;
  }
  return normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on';
}

const ENABLE_GOOGLE_OAUTH = parseBooleanEnv(process.env.NEXT_PUBLIC_ENABLE_GOOGLE_OAUTH, true);
const ENABLE_GITHUB_OAUTH = parseBooleanEnv(process.env.NEXT_PUBLIC_ENABLE_GITHUB_OAUTH, false);

function getAuthErrorMessage(error: unknown) {
  if (
    typeof error === 'object' &&
    error !== null &&
    'response' in error &&
    typeof (error as { response?: unknown }).response === 'object'
  ) {
    const data = (error as { response?: { data?: { error?: string; message?: string; detail?: string } } }).response?.data;
    if (data?.error) {
      return data.error;
    }
    if (data?.message) {
      return data.message;
    }
    if (data?.detail) {
      return data.detail;
    }
  }

  return 'Authentication failed';
}

async function resolvePostLoginDestination({
  returnUrl,
  userId,
}: {
  returnUrl: string | null;
  userId: string;
}) {
  if (returnUrl) {
    return returnUrl;
  }

  if (isRememberedPortalUser()) {
    return '/portal';
  }

  try {
    const subscription = await getCurrentSubscription();
    if (hasPaidPortalAccess(subscription)) {
      rememberPortalUser();
      return '/portal';
    }
  } catch {
    // Fall back to the retail app flow when billing lookup is unavailable.
  }

  const onboardingComplete = localStorage.getItem(`capex_onboarding_${userId}`) === 'true';
  return onboardingComplete ? '/dashboard' : '/onboarding';
}

function LanguageToggle() {
  const { locale, setLocale } = useTranslation();

  return (
    <div className="flex items-center gap-1 rounded-xl border border-white/10 bg-white/5 p-1">
      <button
        onClick={() => setLocale('en')}
        className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
          locale === 'en' ? 'bg-cyan-400 text-slate-950' : 'text-slate-400 hover:text-white'
        }`}
      >
        EN
      </button>
      <button
        onClick={() => setLocale('es')}
        className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
          locale === 'es' ? 'bg-cyan-400 text-slate-950' : 'text-slate-400 hover:text-white'
        }`}
      >
        ES
      </button>
    </div>
  );
}

function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-[#071122] text-white">
      <div className="absolute inset-0 bg-[linear-gradient(rgba(148,163,184,0.06)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.06)_1px,transparent_1px)] bg-[size:140px_140px]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(34,211,238,0.12),transparent_28%),radial-gradient(circle_at_80%_70%,rgba(96,165,250,0.18),transparent_32%),radial-gradient(circle_at_50%_100%,rgba(255,255,255,0.08),transparent_26%)]" />
      <div className="relative z-10 flex min-h-screen items-center justify-center px-4 py-10">{children}</div>
    </div>
  );
}

function LoginContent() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLogin, setIsLogin] = useState(true);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const { initialized, isAuthenticated, user, setUser } = useAuthStore();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t } = useTranslation();
  const returnUrl = searchParams.get('returnUrl');
  const currentUserId = user?.id;

  useEffect(() => {
    const mode = searchParams.get('mode');
    if (mode === 'signup') {
      setIsLogin(false);
    }

    if (!loading && initialized && isAuthenticated && currentUserId) {
      let cancelled = false;
      (async () => {
        const destination = await resolvePostLoginDestination({ returnUrl, userId: currentUserId });
        if (!cancelled) {
          router.push(destination);
        }
      })();
      return () => {
        cancelled = true;
      };
    }
  }, [searchParams, router, initialized, isAuthenticated, loading, returnUrl, currentUserId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = isLogin
        ? await apiClient.login(email, password)
        : await apiClient.register(email, password);

      const user = response.user || {
        id: response.user_id || email,
        email: response.email || email,
      };

      setUser(user);

      analytics.identify(user.id, { email: user.email, name: user.name });
      analytics.track(isLogin ? EVENTS.LOGIN : EVENTS.SIGNUP, {
        method: 'email',
      });

      const destination = await resolvePostLoginDestination({ returnUrl, userId: user.id });
      router.push(destination);
    } catch (err: unknown) {
      setError(getAuthErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell>
      <div className="w-full max-w-xl rounded-[2rem] border border-[#3b4f72] bg-[#121c33]/96 p-6 shadow-[0_30px_120px_rgba(0,0,0,0.45)] backdrop-blur-xl sm:p-8">
        <div className="mb-10 flex items-start justify-between gap-4">
          <Link href="/" className="flex items-center gap-3">
            <CerniqMark size="sm" />
            <div>
              <div className="font-display text-3xl uppercase tracking-[0.08em] text-white">Cerniq</div>
              <div className="text-xs uppercase tracking-[0.34em] text-cyan-200/70">{t('login.tagline')}</div>
            </div>
          </Link>
          <LanguageToggle />
        </div>

        <div className="space-y-5 text-center">
          <h1 className="font-display text-3xl text-white">
            {isLogin ? t('login.signInToAccount') : t('login.createAccount')}
          </h1>
          <ul className="mx-auto max-w-sm space-y-2 text-sm text-slate-400">
            <li className="flex items-center gap-2">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-cyan-400" />
              {t('login.featureALM')}
            </li>
            <li className="flex items-center gap-2">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-cyan-400" />
              {t('login.featureRatios')}
            </li>
            <li className="flex items-center gap-2">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-cyan-400" />
              {t('login.featureReports')}
            </li>
            <li className="flex items-center gap-2">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-cyan-400" />
              {t('login.featureEncryption')}
            </li>
          </ul>
        </div>

        <form onSubmit={handleSubmit} className="mt-10 space-y-6">
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-200">{t('login.email')}</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-2xl border border-[#41577d] bg-[#202a43] px-5 py-4 text-white placeholder:text-slate-500 focus:border-cyan-300 focus:outline-none focus:ring-2 focus:ring-cyan-300/20"
              placeholder={t('login.emailPlaceholder')}
              required
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-200">{t('login.password')}</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-2xl border border-[#41577d] bg-[#202a43] px-5 py-4 text-white placeholder:text-slate-500 focus:border-cyan-300 focus:outline-none focus:ring-2 focus:ring-cyan-300/20"
              placeholder="••••••••"
              required
              minLength={8}
            />
          </div>

          {error ? (
            <div role="alert" className="rounded-2xl border border-red-400/30 bg-red-500/12 px-4 py-3 text-sm text-red-200">
              {error}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={!initialized || loading}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-cyan-400 to-sky-500 px-5 py-4 text-lg font-semibold text-slate-950 transition hover:brightness-105 disabled:opacity-50"
          >
            {loading ? t('common.processing') : isLogin ? t('login.signIn') : t('login.signUp')}
            {!loading ? <ArrowRight className="h-4 w-4" /> : null}
          </button>
        </form>

        {(ENABLE_GOOGLE_OAUTH || ENABLE_GITHUB_OAUTH) ? (
          <>
            <div className="my-8 flex items-center gap-4">
              <div className="h-px flex-1 bg-white/12" />
              <span className="text-sm text-slate-400">{t('login.orContinueWith')}</span>
              <div className="h-px flex-1 bg-white/12" />
            </div>

            <div className={`grid gap-3 ${ENABLE_GOOGLE_OAUTH && ENABLE_GITHUB_OAUTH ? 'grid-cols-2' : 'grid-cols-1'}`}>
              {ENABLE_GOOGLE_OAUTH ? (
                <a
                  href={`${NODE_API_URL}/api/auth/google`}
                  className="flex items-center justify-center gap-3 rounded-2xl border border-[#41577d] bg-[#202a43] px-4 py-4 text-base font-medium text-white transition hover:bg-[#27324e]"
                >
                  <svg className="h-5 w-5" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                  </svg>
                  {t('common.google')}
                </a>
              ) : null}

              {ENABLE_GITHUB_OAUTH ? (
                <a
                  href={`${NODE_API_URL}/api/auth/github`}
                  className="flex items-center justify-center gap-3 rounded-2xl border border-[#41577d] bg-[#202a43] px-4 py-4 text-base font-medium text-white transition hover:bg-[#27324e]"
                >
                  <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                    <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0 1 12 6.844a9.59 9.59 0 0 1 2.504.337c1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0 0 22 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" />
                  </svg>
                  {t('common.github')}
                </a>
              ) : null}
            </div>
          </>
        ) : null}

        <button
          type="button"
          onClick={() => setIsLogin(!isLogin)}
          className="mt-8 w-full text-center text-sm text-slate-400 transition hover:text-white"
        >
          {isLogin ? t('login.noAccount') : t('login.hasAccount')}
        </button>
      </div>
    </AuthShell>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <AuthShell>
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-cyan-300/20 border-t-cyan-200" />
        </AuthShell>
      }
    >
      <LoginContent />
    </Suspense>
  );
}
