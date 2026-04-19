'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, CheckCircle2, LockKeyhole, Upload } from 'lucide-react';
import { buildLoginUrlForReturnUrl } from '@/lib/auth-redirect';
import { useTranslation } from '@/lib/i18n';
import { useAuthStore } from '@/lib/store';

const PORTAL_WORKSPACE_HREF = '/portal/submit?createCycle=1';

function DashboardCard({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow: string;
  title: string;
  description: string;
  actions: ReactNode;
}) {
  return (
    <section className="cerniq-dashboard-elevated-surface w-full max-w-3xl rounded-[2rem] border p-6 shadow-[0_30px_120px_rgba(113,88,40,0.18)] sm:p-8">
      <p className="text-xs font-semibold uppercase tracking-[0.28em] text-cyan-700/80">
        {eyebrow}
      </p>
      <h1 className="mt-4 font-display text-3xl text-[var(--dashboard-text-primary)] sm:text-4xl">
        {title}
      </h1>
      <p className="mt-4 max-w-2xl text-sm leading-7 text-[var(--dashboard-text-secondary)] sm:text-base">
        {description}
      </p>
      <div className="mt-8 flex flex-wrap gap-3">{actions}</div>
    </section>
  );
}

export default function DashboardPage() {
  const {
    initialized,
    isAuthenticated,
    onboardingComplete,
    hydrateFromStorage,
  } = useAuthStore();
  const router = useRouter();
  const { locale } = useTranslation();
  const t = (en: string, es: string) => (locale === 'en' ? en : es);

  useEffect(() => {
    if (!initialized) {
      void hydrateFromStorage();
    }
  }, [hydrateFromStorage, initialized]);

  useEffect(() => {
    if (!initialized) {
      return;
    }

    if (isAuthenticated && onboardingComplete) {
      router.replace(PORTAL_WORKSPACE_HREF);
    }
  }, [initialized, isAuthenticated, onboardingComplete, router]);

  if (!initialized) {
    return (
      <div className="cerniq-dashboard-page flex min-h-screen items-center justify-center px-6">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-cyan-200 border-t-cyan-600" />
          <p className="text-sm text-[var(--dashboard-text-secondary)]">
            {t('Loading reporting workspace...', 'Cargando workspace de informes...')}
          </p>
        </div>
      </div>
    );
  }

  if (isAuthenticated && onboardingComplete) {
    return (
      <div className="cerniq-dashboard-page flex min-h-screen items-center justify-center px-6 py-10">
        <DashboardCard
          eyebrow={t('Workspace Handoff', 'Handoff del workspace')}
          title={t(
            'Opening your reporting workspace',
            'Abriendo su workspace de informes',
          )}
          description={t(
            'CERNIQ now routes upload, processing, and report delivery through the secure portal workspace. If the redirect takes a moment, continue manually below.',
            'CERNIQ ahora enruta la carga, el procesamiento y la entrega del informe a traves del portal seguro. Si el redireccionamiento tarda un momento, continue manualmente abajo.',
          )}
          actions={
            <>
              <Link
                href={PORTAL_WORKSPACE_HREF}
                className="inline-flex items-center gap-2 rounded-full bg-[#1B3A6B] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#163258]"
              >
                <Upload className="h-4 w-4" />
                {t(
                  'Continue to reporting workspace',
                  'Continuar al workspace de informes',
                )}
              </Link>
              <Link
                href="/portal"
                className="inline-flex items-center gap-2 rounded-full border border-[var(--dashboard-border)] bg-[rgba(255,251,239,0.88)] px-6 py-3 text-sm font-semibold text-[var(--dashboard-text-primary)] transition hover:bg-white"
              >
                {t('Open report portal', 'Abrir portal de informes')}
              </Link>
            </>
          }
        />
      </div>
    );
  }

  if (isAuthenticated && !onboardingComplete) {
    return (
      <div className="cerniq-dashboard-page flex min-h-screen items-center justify-center px-6 py-10">
        <DashboardCard
          eyebrow={t('Setup Required', 'Configuracion requerida')}
          title={t(
            'Finish institution setup before upload',
            'Complete la configuracion antes de cargar',
          )}
          description={t(
            'The reporting workspace is live, but CERNIQ still needs your institution profile before it can open a real upload-to-report cycle.',
            'El workspace de informes ya esta listo, pero CERNIQ todavia necesita el perfil de su institucion antes de abrir un ciclo real de carga a informe.',
          )}
          actions={
            <>
              <Link
                href="/onboarding"
                className="inline-flex items-center gap-2 rounded-full bg-cyan-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-cyan-700"
              >
                <CheckCircle2 className="h-4 w-4" />
                {t('Complete setup', 'Completar configuracion')}
              </Link>
              <Link
                href="/get-started"
                className="inline-flex items-center gap-2 rounded-full border border-[var(--dashboard-border)] bg-[rgba(255,251,239,0.88)] px-6 py-3 text-sm font-semibold text-[var(--dashboard-text-primary)] transition hover:bg-white"
              >
                {t('Review pilot steps', 'Revisar pasos del piloto')}
              </Link>
            </>
          }
        />
      </div>
    );
  }

  return (
    <div className="cerniq-dashboard-page flex min-h-screen items-center justify-center px-6 py-10">
      <DashboardCard
        eyebrow={t('Secure Reporting Workspace', 'Workspace seguro de informes')}
        title={t(
          'Start your upload-to-report workflow',
          'Comience su flujo de carga a informe',
        )}
        description={t(
          'CERNIQ now keeps the reporting journey in one secure workspace: sign in, open your report cycle, upload the balance sheet CSV, and retrieve the bilingual report from the same place.',
          'CERNIQ ahora mantiene el recorrido completo en un solo workspace seguro: inicie sesion, abra el ciclo de informe, cargue el CSV del balance y recupere el informe bilingue desde el mismo lugar.',
        )}
        actions={
          <>
            <Link
              href={buildLoginUrlForReturnUrl('/dashboard', {
                forceMagicLink: true,
              })}
              className="inline-flex items-center gap-2 rounded-full bg-[#1B3A6B] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#163258]"
            >
              <LockKeyhole className="h-4 w-4" />
              {t('Sign in to open workspace', 'Inicie sesion para abrir el workspace')}
            </Link>
            <Link
              href="/get-started"
              className="inline-flex items-center gap-2 rounded-full bg-amber-500 px-6 py-3 text-sm font-semibold text-white transition hover:bg-amber-600"
            >
              {t('Start pilot', 'Comenzar piloto')}
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/demo"
              className="inline-flex items-center gap-2 rounded-full border border-[var(--dashboard-border)] bg-[rgba(255,251,239,0.88)] px-6 py-3 text-sm font-semibold text-[var(--dashboard-text-primary)] transition hover:bg-white"
            >
              {t('View interactive demo', 'Ver demo interactivo')}
            </Link>
          </>
        }
      />
    </div>
  );
}
