'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, CheckCircle2, ChevronRight, FileText, PlayCircle, ShieldCheck, Upload, Languages, Clock } from 'lucide-react';
import { apiClient } from '@/lib/api';
import { createCheckoutSession, type CheckoutTier } from '@/lib/billing';
import { analytics, EVENTS } from '@/lib/analytics';
import { CerniqMark, CerniqLockup } from '@/components/brand/CerniqLogo';

const DEMO_VIDEO_URL = (process.env.NEXT_PUBLIC_CERNIQ_DEMO_VIDEO_URL || '').trim();

const institutionOptionsEN = [
  { value: '', label: 'Institution type' },
  { value: 'cooperativa', label: 'Cooperativa' },
  { value: 'credit_union', label: 'Credit Union' },
  { value: 'cpa_consultant', label: 'CPA / Consulting Firm' },
  { value: 'community_bank', label: 'Community Bank' },
  { value: 'other', label: 'Other' },
];

const institutionOptionsES = [
  { value: '', label: 'Tipo de institucion' },
  { value: 'cooperativa', label: 'Cooperativa' },
  { value: 'credit_union', label: 'Credit Union' },
  { value: 'cpa_consultant', label: 'CPA / Consultora' },
  { value: 'community_bank', label: 'Banco comunitario' },
  { value: 'other', label: 'Otro' },
];

const assetRangesEN = [
  { value: '', label: 'Asset range' },
  { value: '< $100M', label: '< $100M' },
  { value: '$100M - $500M', label: '$100M - $500M' },
  { value: '$500M - $1B', label: '$500M - $1B' },
  { value: '$1B - $5B', label: '$1B - $5B' },
  { value: '$5B+', label: '$5B+' },
];

const assetRangesES = [
  { value: '', label: 'Rango de activos' },
  { value: '< $100M', label: '< $100M' },
  { value: '$100M - $500M', label: '$100M - $500M' },
  { value: '$500M - $1B', label: '$500M - $1B' },
  { value: '$1B - $5B', label: '$1B - $5B' },
  { value: '$5B+', label: '$5B+' },
];

const urgencyHooksEN = [
  'COSSEC exam season is approaching. Is your institution ready?',
  'The Fed moved rates. Do you know the impact on your NIM?',
  'Prepare your next ALCO meeting in 24 hours, not 3 weeks.',
];

const urgencyHooksES = [
  'La temporada de examenes COSSEC se acerca. ¿Esta lista su institucion?',
  'La Fed movio tasas. ¿Sabe el impacto en su NIM?',
  'Prepare su proximo ALCO en 24 horas, no 3 semanas.',
];

const costComparisonEN = [
  {
    item: 'Quarterly ALM report',
    consultant: '$8,000 - $12,000',
    cerniq: '$750',
  },
  {
    item: 'Annual access (4 reports)',
    consultant: '$32,000 - $48,000',
    cerniq: '$2,400',
  },
  {
    item: 'Delivery time',
    consultant: '3-6 weeks',
    cerniq: '24 hours',
  },
  {
    item: 'Bilingual included',
    consultant: 'Extra charge',
    cerniq: 'Included',
  },
];

const costComparisonES = [
  {
    item: 'Informe ALM trimestral',
    consultant: '$8,000 - $12,000',
    cerniq: '$750',
  },
  {
    item: 'Acceso anual (4 informes)',
    consultant: '$32,000 - $48,000',
    cerniq: '$2,400',
  },
  {
    item: 'Tiempo de entrega',
    consultant: '3-6 semanas',
    cerniq: '24 horas',
  },
  {
    item: 'Bilingue incluido',
    consultant: 'Cargo adicional',
    cerniq: 'Incluido',
  },
];

function getVideoEmbedUrl(url: string) {
  if (!url) {
    return '';
  }

  if (url.includes('youtube.com/watch?v=')) {
    const videoId = new URL(url).searchParams.get('v');
    return videoId ? `https://www.youtube.com/embed/${videoId}` : url;
  }

  if (url.includes('youtu.be/')) {
    const videoId = url.split('youtu.be/')[1]?.split(/[?&]/)[0];
    return videoId ? `https://www.youtube.com/embed/${videoId}` : url;
  }

  if (url.includes('vimeo.com/')) {
    const videoId = url.split('vimeo.com/')[1]?.split(/[?&/]/)[0];
    return videoId ? `https://player.vimeo.com/video/${videoId}` : url;
  }

  if (url.includes('loom.com/share/')) {
    const videoId = url.split('loom.com/share/')[1]?.split(/[?&]/)[0];
    return videoId ? `https://www.loom.com/embed/${videoId}` : url;
  }

  return url;
}

function isDirectVideoFile(url: string) {
  return /\.(mp4|webm|ogg|webp)(\?.*)?$/i.test(url);
}

function isHtmlPage(url: string) {
  return /\.html?(\\?.*)?$/i.test(url) || /\/demo-video\/?(\?.*)?$/i.test(url);
}

export default function LandingPage() {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [institutionName, setInstitutionName] = useState('');
  const [institutionType, setInstitutionType] = useState('');
  const [totalAssets, setTotalAssets] = useState('');
  const [honeypot, setHoneypot] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [loading, setLoading] = useState(false);
  const [checkoutTier, setCheckoutTier] = useState<CheckoutTier | null>(null);
  const [urgencyIndex, setUrgencyIndex] = useState(0);
  const [urgencyFade, setUrgencyFade] = useState(true);
  const [lang, setLang] = useState<'en' | 'es'>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('cerniq_lang') as 'en' | 'es') || 'en';
    }
    return 'en';
  });
  const router = useRouter();
  const embedUrl = getVideoEmbedUrl(DEMO_VIDEO_URL);
  const hasVideo = Boolean(DEMO_VIDEO_URL);

  const t = (en: string, es: string) => lang === 'en' ? en : es;

  useEffect(() => { localStorage.setItem('cerniq_lang', lang); }, [lang]);

  const urgencyHooks = lang === 'en' ? urgencyHooksEN : urgencyHooksES;
  const costComparison = lang === 'en' ? costComparisonEN : costComparisonES;
  const institutionOptions = lang === 'en' ? institutionOptionsEN : institutionOptionsES;
  const assetRanges = lang === 'en' ? assetRangesEN : assetRangesES;

  useEffect(() => {
    const interval = setInterval(() => {
      setUrgencyFade(false);
      setTimeout(() => {
        setUrgencyIndex((prev) => (prev + 1) % urgencyHooks.length);
        setUrgencyFade(true);
      }, 400);
    }, 5000);
    return () => clearInterval(interval);
  }, [urgencyHooks.length]);

  const getSubmitErrorMessage = (error: unknown): string => {
    if (
      typeof error === 'object' &&
      error !== null &&
      'response' in error &&
      typeof (error as { response?: unknown }).response === 'object' &&
      (error as { response?: { data?: unknown } }).response?.data &&
      typeof (error as { response?: { data?: { message?: unknown } } }).response?.data?.message === 'string'
    ) {
      const message =
        (error as { response?: { data?: { message?: string } } }).response?.data
          ?.message;
      if (message) {
        return message;
      }
    }

    return t('Failed to submit. Please try again.', 'No se pudo enviar. Intente de nuevo.');
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (honeypot) return; // Bot trap
    setSubmitError('');
    setLoading(true);

    try {
      await apiClient.submitDemoRequest({
        email,
        name,
        institutionName,
        institutionType,
        totalAssets,
      });
      analytics.track(EVENTS.LEAD_FORM_SUBMITTED, { institutionType, totalAssets, source: 'landing_page' });
      setSubmitted(true);
    } catch (error: unknown) {
      setSubmitError(getSubmitErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  async function handleCheckout(tier: CheckoutTier) {
    analytics.track(EVENTS.CHECKOUT_STARTED, { tier, source: 'landing_page' });
    setCheckoutTier(tier);
    try {
      const checkoutUrl = await createCheckoutSession({
        tier,
        successUrl: '/portal?welcome=1',
        cancelUrl: '/pricing',
      });
      window.location.href = checkoutUrl;
    } catch {
      window.location.href = '/#pricing';
    } finally {
      setCheckoutTier(null);
    }
  }

  return (
    <div className="min-h-screen overflow-x-clip text-slate-950">
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
        {/* -- NAV -- */}
        <nav aria-label="Main navigation" className="mb-6 flex items-center justify-between gap-4 rounded-full border border-slate-200/80 bg-white/80 px-4 py-3 backdrop-blur-xl sm:px-6">
          <button onClick={() => router.push('/')} className="flex items-center gap-3 text-left" aria-label="CERNIQ home">
            <CerniqMark size="sm" />
            <div>
              <div className="font-display text-sm uppercase tracking-[0.4em] text-slate-950">Cerniq</div>
              <div className="text-[10px] uppercase tracking-[0.36em] text-cyan-700/60">ALM Intelligence</div>
            </div>
          </button>

          <div className="flex items-center gap-2 sm:gap-3">
            {/* Language toggle */}
            <div className="flex items-center rounded-full border border-slate-200 text-xs">
              <button
                onClick={() => setLang('en')}
                className={`rounded-l-full px-2.5 py-1.5 font-semibold transition ${lang === 'en' ? 'bg-cyan-700 text-white' : 'text-slate-500 hover:text-slate-950'}`}
                aria-label="Switch to English"
                aria-pressed={lang === 'en'}
              >
                EN
              </button>
              <button
                onClick={() => setLang('es')}
                className={`rounded-r-full px-2.5 py-1.5 font-semibold transition ${lang === 'es' ? 'bg-cyan-700 text-white' : 'text-slate-500 hover:text-slate-950'}`}
                aria-label="Cambiar a Espanol"
                aria-pressed={lang === 'es'}
              >
                ES
              </button>
            </div>
            <button
              onClick={() => router.push('/demo')}
              className="hidden rounded-full border border-amber-300 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-700 transition hover:bg-amber-100 sm:inline-flex"
            >
              {t('Try Demo', 'Ver Demo')}
            </button>
            <button
              onClick={() => document.getElementById('pricing')?.scrollIntoView({ behavior: 'smooth' })}
              className="hidden rounded-full border border-slate-200 px-4 py-2 text-sm text-slate-600 transition hover:border-cyan-300/50 hover:text-slate-950 sm:inline-flex"
            >
              {t('Pricing', 'Precios')}
            </button>
            <button
              onClick={() => router.push('/why-cerniq')}
              className="hidden rounded-full border border-slate-200 px-4 py-2 text-sm text-slate-600 transition hover:border-cyan-300/50 hover:text-slate-950 sm:inline-flex"
            >
              {t('Why CERNIQ', 'Por qué CERNIQ')}
            </button>
            <button
              onClick={() => router.push('/compliance')}
              className="hidden rounded-full border border-slate-200 px-4 py-2 text-sm text-slate-600 transition hover:border-cyan-300/50 hover:text-slate-950 lg:inline-flex"
            >
              {t('Compliance', 'Cumplimiento')}
            </button>
            <button
              onClick={() => router.push('/roi')}
              className="hidden rounded-full border border-slate-200 px-4 py-2 text-sm text-slate-600 transition hover:border-cyan-300/50 hover:text-slate-950 lg:inline-flex"
            >
              {t('ROI Calculator', 'Calculadora ROI')}
            </button>
            <button
              onClick={() => router.push('/login')}
              className="rounded-full border border-slate-200 px-4 py-2 text-sm text-slate-600 transition hover:border-cyan-300/50 hover:text-slate-950"
            >
              Login
            </button>
            <button
              onClick={() => document.getElementById('demo')?.scrollIntoView({ behavior: 'smooth' })}
              className="cerniq-button-primary"
            >
              {t('Request Demo', 'Solicitar Demo')}
            </button>
          </div>
        </nav>

        <main className="space-y-4 pb-16">
          {/* -- HERO -- */}
          <section className="cerniq-shell p-3 sm:p-4 lg:p-6">
            <div className="cerniq-panel min-h-[320px] p-5 sm:p-6 lg:p-8">
              <div className="cerniq-data-wave opacity-55" />
              <div className="relative z-10 mx-auto flex max-w-4xl flex-col">
                <span className="cerniq-kicker mb-4 w-fit">
                  {t('ALM Intelligence for Credit Unions & Community Banks', 'Inteligencia ALM para cooperativas, credit unions y bancos comunitarios')}
                </span>
                <CerniqLockup tagline={t('Institutional ALM Intelligence', 'Inteligencia ALM Institucional')} />
                <div className="mt-5 space-y-3">
                  <h1 className="font-display text-2xl leading-tight text-slate-950 sm:text-4xl">
                    {t(
                      'Institutional ALM Intelligence for Credit Unions & Cooperativas',
                      'Inteligencia ALM institucional para cooperativas y credit unions'
                    )}
                  </h1>
                  <p className="max-w-3xl text-sm leading-7 text-slate-700">
                    {t(
                      'Upload your balance sheet. Get a 14-page compliance-ready ALM report with 12 regulatory ratios, Monte Carlo stress testing, and sector benchmarking — in hours, not weeks.',
                      'Cargue su hoja de balance. Reciba un informe ALM de 14 paginas con 12 ratios regulatorios, pruebas de estres Monte Carlo y benchmarking sectorial — en horas, no semanas.'
                    )}
                  </p>

                  {/* Urgency hook rotator */}
                  <div className="h-6 flex items-center">
                    <p
                      className={`text-sm font-semibold text-amber-600 transition-opacity duration-400 ${urgencyFade ? 'opacity-100' : 'opacity-0'}`}
                    >
                      {urgencyHooks[urgencyIndex]}
                    </p>
                  </div>
                </div>

                <div className="mt-5 flex flex-col gap-3 sm:flex-row">
                  <button
                    onClick={() => document.getElementById('demo')?.scrollIntoView({ behavior: 'smooth' })}
                    className="inline-flex items-center justify-center gap-2 rounded-full bg-amber-500 px-6 py-3 text-sm font-semibold text-white shadow-lg transition hover:bg-amber-600 hover:-translate-y-0.5"
                  >
                    {t('Request Free Analysis', 'Solicitar analisis gratuito')}
                    <ArrowRight className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleCheckout('one_time')}
                    disabled={checkoutTier === 'one_time'}
                    className="cerniq-button-secondary disabled:opacity-60"
                  >
                    {checkoutTier === 'one_time' ? t('Processing...', 'Procesando...') : t('Start — $750', 'Comenzar — $750')}
                  </button>
                </div>
              </div>
            </div>
          </section>

          {/* -- PLATFORM STATS BAR -- */}
          <section className="cerniq-panel py-4 px-6 sm:px-8">
            <div className="mx-auto grid max-w-5xl grid-cols-2 sm:grid-cols-4 gap-4 text-center">
              <div>
                <p className="text-3xl font-bold tabular-nums text-slate-950">70+</p>
                <p className="text-xs text-slate-500">{t('ALM Modules', 'Módulos ALM')}</p>
              </div>
              <div>
                <p className="text-3xl font-bold tabular-nums text-slate-950">50</p>
                <p className="text-xs text-slate-500">{t('Quant Models', 'Modelos Cuantitativos')}</p>
              </div>
              <div>
                <p className="text-3xl font-bold tabular-nums text-slate-950">142</p>
                <p className="text-xs text-slate-500">{t('API Endpoints', 'Endpoints API')}</p>
              </div>
              <div>
                <p className="text-3xl font-bold tabular-nums text-slate-950">EN/ES</p>
                <p className="text-xs text-slate-500">{t('Bilingual Reports', 'Informes Bilingües')}</p>
              </div>
            </div>
          </section>

          {/* -- SOCIAL PROOF BAR -- */}
          <section className="cerniq-panel py-3 px-6 sm:px-8">
            <div className="mx-auto flex max-w-4xl flex-col items-center gap-3 text-center sm:flex-row sm:justify-center sm:gap-8">
              <span className="text-sm font-semibold text-slate-700">
                {t('3 institutions in pilot', '3 instituciones en piloto')}
              </span>
              <span className="hidden h-4 w-px bg-slate-300 sm:block" />
              <span className="text-sm font-semibold text-slate-700">
                {t('$1.1B+ assets analyzed', '$1.1B+ en activos analizados')}
              </span>
              <span className="hidden h-4 w-px bg-slate-300 sm:block" />
              <span className="text-sm font-semibold text-slate-700">
                {t('12+ reports delivered', '12+ informes entregados')}
              </span>
            </div>
          </section>

          {/* -- PAIN / COST SECTION -- */}
          <section className="cerniq-panel cerniq-card-hover p-4 sm:p-6 lg:p-8">
            <div className="mx-auto max-w-4xl space-y-4">
              <div>
                <p className="cerniq-section-label">{t('Cost Comparison', 'Comparacion de costos')}</p>
                <h2 className="mt-3 font-display text-2xl text-slate-950 sm:text-3xl">
                  {t(
                    'How much does your institution spend on ALM analysis?',
                    '¿Cuanto gasta su institucion en analisis ALM?'
                  )}
                </h2>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-200">
                      <th className="py-2 pr-4 text-xs font-semibold uppercase tracking-wider text-slate-500" />
                      <th className="py-3 pr-4 text-xs font-semibold uppercase tracking-wider text-slate-500">
                        {t('Traditional Consultant', 'Consultor tradicional')}
                      </th>
                      <th className="py-3 text-xs font-semibold uppercase tracking-wider text-cyan-700">CERNIQ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {costComparison.map((row) => (
                      <tr key={row.item} className="border-b border-slate-100">
                        <td className="py-2 pr-4 font-medium text-slate-700">{row.item}</td>
                        <td className="py-3 pr-4 text-slate-500">{row.consultant}</td>
                        <td className="py-3 font-semibold text-cyan-700">{row.cerniq}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="rounded-2xl border border-emerald-200 bg-emerald-50/80 p-3 text-center">
                <p className="text-xs font-bold uppercase tracking-[0.24em] text-emerald-700">
                  {t('ESTIMATED SAVINGS: 83-93%', 'AHORRO ESTIMADO: 83-93%')}
                </p>
              </div>
            </div>
          </section>

          {/* -- THREE FEATURES -- */}
          <section className="grid gap-4 sm:grid-cols-3">
            {/* Regulatory Compliance */}
            <a href="/compliance" className="cerniq-panel cerniq-card-hover p-4 block">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-cyan-200 bg-cyan-50">
                <ShieldCheck className="h-5 w-5 text-cyan-700" />
              </div>
              <p className="mt-3 font-display text-lg text-slate-950">
                {t('Regulatory Compliance', 'Cumplimiento regulatorio')}
              </p>
              <p className="mt-2 text-sm leading-6 text-slate-700">
                {t(
                  '20 regulatory requirements covered across COSSEC, NCUA & Basel III.',
                  '20 requisitos regulatorios cubiertos en COSSEC, NCUA y Basel III.'
                )}
              </p>
              <span className="mt-2 inline-flex items-center text-xs text-cyan-700 font-medium">
                {t('View compliance matrix', 'Ver matriz de cumplimiento')} <ChevronRight className="h-3 w-3 ml-1" />
              </span>
            </a>
            {/* Bilingual by Design */}
            <div className="cerniq-panel cerniq-card-hover p-4">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-cyan-200 bg-cyan-50">
                <Languages className="h-5 w-5 text-cyan-700" />
              </div>
              <p className="mt-3 font-display text-lg text-slate-950">
                {t('Bilingual by Design', 'Bilingue por diseno')}
              </p>
              <p className="mt-2 text-sm leading-6 text-slate-700">
                {t(
                  'English and Spanish in the same report, board-ready for any audience.',
                  'Espanol e ingles en el mismo informe, listo para junta y regulador.'
                )}
              </p>
            </div>
            {/* 24-Hour Delivery */}
            <div className="cerniq-panel cerniq-card-hover p-4">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-cyan-200 bg-cyan-50">
                <Clock className="h-5 w-5 text-cyan-700" />
              </div>
              <p className="mt-3 font-display text-lg text-slate-950">
                {t('24-Hour Delivery', 'Entrega en 24 horas')}
              </p>
              <p className="mt-2 text-sm leading-6 text-slate-700">
                {t(
                  'Complete ALM analysis ready before your next ALCO meeting.',
                  'Analisis ALM completo listo antes de su proximo comite ALCO.'
                )}
              </p>
            </div>
          </section>

          {/* -- QUANT ENGINE SHOWCASE -- */}
          <section className="cerniq-panel p-4 sm:p-6 lg:p-8">
            <div className="mx-auto max-w-5xl">
              <p className="cerniq-section-label">{t('Quant Engine', 'Motor Cuantitativo')}</p>
              <h2 className="mt-3 font-display text-2xl text-slate-950 sm:text-3xl">
                {t('Goldman Sachs-grade models, credit union pricing', 'Modelos nivel Goldman Sachs, precio de cooperativa')}
              </h2>
              <div className="mt-6 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {[
                  { name: 'Nelson-Siegel', desc: t('Yield curve interpolation', 'Interpolación curva rendimiento') },
                  { name: 'Vasicek Monte Carlo', desc: t('10K stochastic rate paths', '10K senderos estocásticos') },
                  { name: 'Black-Litterman', desc: t('Bayesian portfolio allocation', 'Asignación Bayesiana') },
                  { name: 'CVaR Optimizer', desc: t('Rockafellar-Uryasev tail risk', 'Riesgo de cola R-U') },
                  { name: 'CreditMetrics', desc: t('JP Morgan migration VaR', 'VaR migración JP Morgan') },
                  { name: 'KMV-Merton', desc: t('Distance-to-Default structural', 'Distancia al incumplimiento') },
                  { name: 'FRTB Expected Shortfall', desc: t('Basel III.1 market capital', 'Capital mercado Basel III.1') },
                  { name: 'HMM Regime Detection', desc: t('Viterbi macro state machine', 'Máquina estados Viterbi') },
                  { name: 'PCA Yield Curve', desc: t('3-factor decomposition', 'Descomposición 3 factores') },
                  { name: 'Copula Credit', desc: t('Gaussian vs t-Student tail', 'Cola Gaussian vs t-Student') },
                  { name: 'NCUA RBC2', desc: t('8-component risk capital', 'Capital riesgo 8 componentes') },
                  { name: 'CECL 3-Method', desc: t('WARM + Vintage + PD×LGD', 'WARM + Vintage + PD×LGD') },
                ].map((m) => (
                  <div key={m.name} className="rounded-xl border border-slate-200 bg-white p-3">
                    <p className="text-xs font-bold text-slate-800">{m.name}</p>
                    <p className="text-[10px] text-slate-500 mt-0.5">{m.desc}</p>
                  </div>
                ))}
              </div>
              <p className="mt-4 text-center text-xs text-slate-500">
                {t('+ 22 more models across duration, liquidity, credit, and market risk', '+ 22 modelos más en duración, liquidez, crédito y riesgo de mercado')}
              </p>
            </div>
          </section>

          {/* -- HOW IT WORKS -- */}
          <section className="cerniq-panel cerniq-card-hover p-4 sm:p-6 lg:p-8">
            <div className="mx-auto max-w-4xl">
              <div>
                <p className="cerniq-section-label">{t('How It Works', 'Como funciona')}</p>
                <h2 className="mt-3 font-display text-2xl text-slate-950 sm:text-3xl">
                  {t(
                    'Upload CSV. CERNIQ Analyzes. Receive Bilingual PDF.',
                    'Cargue CSV. CERNIQ analiza. Reciba PDF bilingue.'
                  )}
                </h2>
              </div>

              <div className="mt-5 grid gap-4 sm:grid-cols-3">
                {/* Step 1 */}
                <div className="rounded-2xl border border-slate-200 bg-white/86 p-4 text-center">
                  <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-2xl border border-cyan-200 bg-cyan-50">
                    <Upload className="h-5 w-5 text-cyan-700" />
                  </div>
                  <p className="mt-2 text-xs font-bold uppercase tracking-[0.24em] text-slate-400">{t('Step 1', 'Paso 1')}</p>
                  <h3 className="mt-1 font-display text-lg text-slate-950">{t('Upload Your CSV', 'Cargue su CSV')}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    {t(
                      'Upload your institution balance sheet through a secure workflow.',
                      'Suba la hoja de balance de su institucion a traves de un flujo seguro.'
                    )}
                  </p>
                </div>
                {/* Step 2 */}
                <div className="rounded-2xl border border-slate-200 bg-white/86 p-4 text-center">
                  <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-2xl border border-cyan-200 bg-cyan-50">
                    <ShieldCheck className="h-5 w-5 text-cyan-700" />
                  </div>
                  <p className="mt-2 text-xs font-bold uppercase tracking-[0.24em] text-slate-400">{t('Step 2', 'Paso 2')}</p>
                  <h3 className="mt-1 font-display text-lg text-slate-950">{t('CERNIQ Analyzes', 'CERNIQ analiza')}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    {t(
                      'The platform validates the file, applies the ALM engine, and prepares the draft.',
                      'La plataforma valida el archivo, aplica el motor ALM y prepara el borrador.'
                    )}
                  </p>
                </div>
                {/* Step 3 */}
                <div className="rounded-2xl border border-slate-200 bg-white/86 p-4 text-center">
                  <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-2xl border border-cyan-200 bg-cyan-50">
                    <FileText className="h-5 w-5 text-cyan-700" />
                  </div>
                  <p className="mt-2 text-xs font-bold uppercase tracking-[0.24em] text-slate-400">{t('Step 3', 'Paso 3')}</p>
                  <h3 className="mt-1 font-display text-lg text-slate-950">{t('Receive Your Bilingual PDF', 'Reciba su PDF bilingue')}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    {t(
                      'A professional report in English and Spanish for management, committee, or regulator.',
                      'Un informe profesional en espanol e ingles para gerencia, comite o regulador.'
                    )}
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* -- WALKTHROUGH VIDEO -- */}
          <section className="cerniq-panel cerniq-card-hover p-4 sm:p-6 lg:p-8">
            <div className="mx-auto space-y-4">
              <div className="max-w-4xl">
                <p className="cerniq-section-label">{t('Walkthrough', 'Demostracion')}</p>
                <h2 className="mt-3 font-display text-2xl text-slate-950 sm:text-3xl">
                  {t(
                    'See the upload-to-report workflow in action',
                    'Vea el flujo de carga a informe en accion'
                  )}
                </h2>
              </div>

              <div className="overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white">
                {hasVideo ? (
                  <div className="w-full bg-slate-100" style={{ aspectRatio: '16/9' }}>
                    {isDirectVideoFile(DEMO_VIDEO_URL) ? (
                      <video className="h-full w-full" controls preload="metadata" playsInline src={DEMO_VIDEO_URL} />
                    ) : isHtmlPage(DEMO_VIDEO_URL) ? (
                      <iframe
                        className="h-full w-full border-0"
                        src={DEMO_VIDEO_URL}
                        title="CERNIQ platform walkthrough"
                        allow="autoplay"
                        loading="lazy"
                        scrolling="no"
                      />
                    ) : (
                      <iframe
                        className="h-full w-full"
                        src={embedUrl}
                        title="CERNIQ ALM walkthrough"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                        referrerPolicy="strict-origin-when-cross-origin"
                        allowFullScreen
                      />
                    )}
                  </div>
                ) : (
                  <div className="flex aspect-video w-full flex-col items-center justify-center gap-4 bg-[linear-gradient(180deg,#ffffff_0%,#f4fbff_100%)] px-6 text-center">
                    <div className="rounded-full border border-cyan-200 bg-cyan-50 p-4">
                      <PlayCircle className="h-9 w-9 text-cyan-700" />
                    </div>
                    <p className="font-display text-2xl text-slate-950">
                      {t('ALM walkthrough video coming soon', 'Video de demostracion ALM proximamente')}
                    </p>
                    <p className="max-w-2xl text-base leading-7 text-slate-600">
                      Add <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-sm">NEXT_PUBLIC_CERNIQ_DEMO_VIDEO_URL</code> once the upload-to-report walkthrough is ready.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* -- PRICING -- */}
          <section id="pricing" className="cerniq-shell p-3 sm:p-4 lg:p-6">
            <div className="mx-auto max-w-4xl">
              <div className="mb-5">
                <p className="cerniq-section-label">{t('Pricing', 'Precios')}</p>
                <h2 className="mt-3 font-display text-2xl text-slate-950 sm:text-3xl">
                  {t(
                    'Start with a pilot report. Scale when ready.',
                    'Comience con un informe piloto. Escale cuando este listo.'
                  )}
                </h2>
              </div>

              <div className="grid gap-5 sm:grid-cols-3">
                {/* ALM Report - $750 */}
                <div className="cerniq-panel cerniq-card-hover flex flex-col p-5">
                  <p className="font-display text-xl text-slate-950">{t('ALM Report', 'Informe ALM')}</p>
                  <div className="mt-4">
                    <span className="font-display text-4xl text-slate-950">$750</span>
                    <span className="ml-1 text-sm text-slate-500">{t('one-time', 'unico')}</span>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-slate-600">
                    {t(
                      'One bilingual ALM report to validate the process with your institution.',
                      'Un informe ALM bilingue para validar el proceso con su institucion.'
                    )}
                  </p>
                  <div className="mt-5 flex-1 space-y-3">
                    <div className="flex items-center gap-2 text-sm text-slate-700">
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-cyan-700" />
                      {t('1 bilingual ALM report', '1 informe ALM bilingue')}
                    </div>
                    <div className="flex items-center gap-2 text-sm text-slate-700">
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-cyan-700" />
                      {t('Data review & guided setup', 'Revision de datos y setup guiado')}
                    </div>
                    <div className="flex items-center gap-2 text-sm text-slate-700">
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-cyan-700" />
                      {t('Board-ready PDF', 'PDF listo para junta')}
                    </div>
                  </div>
                  <button
                    onClick={() => handleCheckout('one_time')}
                    disabled={checkoutTier === 'one_time'}
                    className="mt-6 w-full cerniq-button-secondary disabled:opacity-60"
                  >
                    {checkoutTier === 'one_time' ? t('Processing...', 'Procesando...') : t('Start — $750', 'Comenzar — $750')}
                  </button>
                </div>

                {/* Monthly ALM Platform - $299/mo */}
                <div className="cerniq-panel cerniq-card-hover flex flex-col p-5 border-cyan-300/25 shadow-[0_20px_60px_rgba(34,211,238,0.12)]">
                  <span className="mb-3 w-fit rounded-full border border-cyan-200 bg-cyan-50 px-3 py-1 text-[11px] uppercase tracking-[0.26em] text-cyan-700">
                    {t('Recommended', 'Recomendado')}
                  </span>
                  <p className="font-display text-xl text-slate-950">{t('Monthly ALM Platform', 'Plataforma ALM Mensual')}</p>
                  <div className="mt-4">
                    <span className="font-display text-4xl text-slate-950">$299</span>
                    <span className="ml-1 text-sm text-slate-500">{t('/month', '/mes')}</span>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-slate-600">
                    {t(
                      'Ongoing access to the upload, analysis, and report delivery workflow.',
                      'Acceso continuo al flujo de carga, analisis y entrega de informes.'
                    )}
                  </p>
                  <div className="mt-5 flex-1 space-y-3">
                    <div className="flex items-center gap-2 text-sm text-slate-700">
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-cyan-700" />
                      {t('Recurring reports', 'Informes recurrentes')}
                    </div>
                    <div className="flex items-center gap-2 text-sm text-slate-700">
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-cyan-700" />
                      {t('Portal access', 'Acceso al portal')}
                    </div>
                    <div className="flex items-center gap-2 text-sm text-slate-700">
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-cyan-700" />
                      {t('Bilingual PDF delivery', 'Entrega bilingue PDF')}
                    </div>
                  </div>
                  <button
                    onClick={() => handleCheckout('monthly')}
                    disabled={checkoutTier === 'monthly'}
                    className="mt-6 w-full cerniq-button-primary disabled:opacity-60"
                  >
                    {checkoutTier === 'monthly' ? t('Processing...', 'Procesando...') : t('Subscribe — $299/mo', 'Suscribirse — $299/mes')}
                  </button>
                </div>

                {/* Annual ALM Platform - $2,400/yr */}
                <div className="cerniq-panel cerniq-card-hover flex flex-col p-5">
                  <p className="font-display text-xl text-slate-950">{t('Annual ALM Platform', 'Plataforma ALM Anual')}</p>
                  <div className="mt-4">
                    <span className="font-display text-4xl text-slate-950">$2,400</span>
                    <span className="ml-1 text-sm text-slate-500">{t('/year', '/ano')}</span>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-slate-600">
                    {t(
                      'Save $1,188 vs. monthly plan. Ideal for budget planning.',
                      'Ahorre $1,188 vs. plan mensual. Ideal para planificacion presupuestaria.'
                    )}
                  </p>
                  <div className="mt-5 flex-1 space-y-3">
                    <div className="flex items-center gap-2 text-sm text-slate-700">
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-cyan-700" />
                      {t('4+ annual reports', '4+ informes anuales')}
                    </div>
                    <div className="flex items-center gap-2 text-sm text-slate-700">
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-cyan-700" />
                      {t('Predictable fixed price', 'Precio fijo predecible')}
                    </div>
                    <div className="flex items-center gap-2 text-sm text-slate-700">
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-cyan-700" />
                      {t('Priority support', 'Soporte prioritario')}
                    </div>
                  </div>
                  <button
                    onClick={() => handleCheckout('annual')}
                    disabled={checkoutTier === 'annual'}
                    className="mt-6 w-full cerniq-button-secondary disabled:opacity-60"
                  >
                    {checkoutTier === 'annual' ? t('Processing...', 'Procesando...') : t('Buy Annual — $2,400', 'Comprar anual — $2,400')}
                  </button>
                </div>
              </div>
            </div>
          </section>

          {/* -- FAQ -- */}
          <section id="faq" className="cerniq-panel cerniq-card-hover p-6 sm:p-8 lg:p-10">
            <div className="mx-auto max-w-4xl space-y-6">
              <div>
                <p className="cerniq-section-label">FAQ</p>
                <h2 className="mt-4 font-display text-3xl text-slate-950 sm:text-4xl">
                  {t('Frequently Asked Questions', 'Preguntas frecuentes')}
                </h2>
              </div>

              <div className="space-y-3">
                {/* FAQ 1 */}
                <details className="group rounded-2xl border border-slate-200 bg-white/86">
                  <summary className="cursor-pointer list-none px-5 py-4 text-sm font-semibold text-slate-950 sm:text-base [&::-webkit-details-marker]:hidden">
                    <div className="flex items-center justify-between gap-4">
                      <span>{t(
                        'What data do I need to generate a report?',
                        '¿Que datos necesito para generar un informe?'
                      )}</span>
                      <ChevronRight className="h-4 w-4 shrink-0 text-slate-400 transition-transform group-open:rotate-90" />
                    </div>
                  </summary>
                  <div className="border-t border-slate-100 px-5 py-4">
                    <p className="text-sm leading-7 text-slate-700">
                      {t(
                        'You only need your balance sheet in CSV format. CERNIQ validates the file, identifies categories, and runs ALM calculations automatically. No proprietary templates required.',
                        'Solo necesita su hoja de balance en formato CSV. CERNIQ valida el archivo, identifica las categorias y ejecuta los calculos ALM automaticamente. No se requieren plantillas propietarias.'
                      )}
                    </p>
                  </div>
                </details>

                {/* FAQ 2 */}
                <details className="group rounded-2xl border border-slate-200 bg-white/86">
                  <summary className="cursor-pointer list-none px-5 py-4 text-sm font-semibold text-slate-950 sm:text-base [&::-webkit-details-marker]:hidden">
                    <div className="flex items-center justify-between gap-4">
                      <span>{t(
                        'Does the report meet regulatory requirements?',
                        '¿El informe cumple con los requisitos regulatorios?'
                      )}</span>
                      <ChevronRight className="h-4 w-4 shrink-0 text-slate-400 transition-transform group-open:rotate-90" />
                    </div>
                  </summary>
                  <div className="border-t border-slate-100 px-5 py-4">
                    <p className="text-sm leading-7 text-slate-700">
                      {t(
                        'Yes. The report includes 12 key ratios evaluated by COSSEC and NCUA, including duration gap, NII sensitivity, liquidity coverage, and stress scenarios. Designed for regulatory compliance across jurisdictions.',
                        'Si. El informe incluye los 12 ratios clave que COSSEC y NCUA evaluan, incluyendo gap de duracion, sensibilidad NII, cobertura de liquidez y escenarios de estres. Disenado para cumplimiento regulatorio en multiples jurisdicciones.'
                      )}
                    </p>
                  </div>
                </details>

                {/* FAQ 3 */}
                <details className="group rounded-2xl border border-slate-200 bg-white/86">
                  <summary className="cursor-pointer list-none px-5 py-4 text-sm font-semibold text-slate-950 sm:text-base [&::-webkit-details-marker]:hidden">
                    <div className="flex items-center justify-between gap-4">
                      <span>{t(
                        'How long does it take to receive the report?',
                        '¿Cuanto tiempo toma recibir el informe?'
                      )}</span>
                      <ChevronRight className="h-4 w-4 shrink-0 text-slate-400 transition-transform group-open:rotate-90" />
                    </div>
                  </summary>
                  <div className="border-t border-slate-100 px-5 py-4">
                    <p className="text-sm leading-7 text-slate-700">
                      {t(
                        'The report is delivered within 24 hours of uploading your file. Traditional consultants take 3 to 6 weeks and charge $8,000-$12,000 per engagement.',
                        'El informe se entrega en 24 horas desde que carga su archivo. Los consultores tradicionales toman de 3 a 6 semanas y cobran $8,000-$12,000 por compromiso.'
                      )}
                    </p>
                  </div>
                </details>

                {/* FAQ 4 */}
                <details className="group rounded-2xl border border-slate-200 bg-white/86">
                  <summary className="cursor-pointer list-none px-5 py-4 text-sm font-semibold text-slate-950 sm:text-base [&::-webkit-details-marker]:hidden">
                    <div className="flex items-center justify-between gap-4">
                      <span>{t(
                        'Is my data secure?',
                        '¿Mis datos estan seguros?'
                      )}</span>
                      <ChevronRight className="h-4 w-4 shrink-0 text-slate-400 transition-transform group-open:rotate-90" />
                    </div>
                  </summary>
                  <div className="border-t border-slate-100 px-5 py-4">
                    <p className="text-sm leading-7 text-slate-700">
                      {t(
                        'Yes. Files are transmitted with TLS encryption, processed on isolated servers, and not shared with third parties. Data is deleted after report generation.',
                        'Si. Los archivos se transmiten con encriptacion TLS, se procesan en servidores aislados y no se comparten con terceros. Los datos se eliminan despues de generar el informe.'
                      )}
                    </p>
                  </div>
                </details>

                {/* FAQ 5 */}
                <details className="group rounded-2xl border border-slate-200 bg-white/86">
                  <summary className="cursor-pointer list-none px-5 py-4 text-sm font-semibold text-slate-950 sm:text-base [&::-webkit-details-marker]:hidden">
                    <div className="flex items-center justify-between gap-4">
                      <span>{t(
                        'Can you generate reports for multiple institutions?',
                        '¿Pueden generar informes para multiples instituciones?'
                      )}</span>
                      <ChevronRight className="h-4 w-4 shrink-0 text-slate-400 transition-transform group-open:rotate-90" />
                    </div>
                  </summary>
                  <div className="border-t border-slate-100 px-5 py-4">
                    <p className="text-sm leading-7 text-slate-700">
                      {t(
                        'Yes. Our annual plan and partner access are designed for CPA firms and consultancies serving multiple credit unions, cooperativas, or community banks.',
                        'Si. Nuestro plan anual y acceso de socios estan disenados para firmas CPA y consultoras que sirven a multiples credit unions, cooperativas o bancos comunitarios.'
                      )}
                    </p>
                  </div>
                </details>
              </div>
            </div>
          </section>

          {/* -- DEMO FORM -- */}
          <section id="demo" className="cerniq-panel cerniq-card-hover p-6 sm:p-8">
            <p className="cerniq-section-label">{t('Request Demo', 'Solicitar demo')}</p>
            <h2 className="mt-4 font-display text-3xl text-slate-950 sm:text-4xl">
              {t('Bring your institution into the workflow', 'Conecte su institucion al flujo de trabajo')}
            </h2>
            <p className="mt-4 max-w-3xl text-base leading-8 text-slate-600">
              {t(
                'Tell us who you are and we\'ll schedule a focused walkthrough around the ALM upload, bilingual report output, and pilot path for your institution.',
                'Diganos quien es y programaremos una demostracion enfocada en la carga ALM, el informe bilingue y el camino de piloto para su institucion.'
              )}
            </p>

            <div className="mt-8">
              {submitted ? (
                <div className="rounded-[1.5rem] border border-emerald-300 bg-emerald-50 p-6 text-emerald-800">
                  <CheckCircle2 className="h-9 w-9 text-emerald-500" />
                  <h3 className="mt-4 font-display text-2xl">
                    {t('Request received', 'Solicitud recibida')}
                  </h3>
                  <p className="mt-3 text-sm leading-7 text-emerald-700">
                    {t(
                      'We\'ll follow up within 24 hours to schedule your CERNIQ ALM walkthrough.',
                      'Le daremos seguimiento en 24 horas para programar su demostracion CERNIQ ALM.'
                    )}
                  </p>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                  {/* Honeypot anti-spam */}
                  <div className="absolute -left-[9999px]" aria-hidden="true">
                    <input type="text" name="website" tabIndex={-1} autoComplete="off" value={honeypot} onChange={(e) => setHoneypot(e.target.value)} />
                  </div>
                  {submitError ? (
                    <div role="alert" className="rounded-2xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700">{submitError}</div>
                  ) : null}

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="mb-2 block text-xs uppercase tracking-[0.24em] text-slate-500">
                        {t('Name', 'Nombre')}
                      </label>
                      <input type="text" placeholder="Maria Rodriguez" className="cerniq-input" value={name} onChange={(event) => setName(event.target.value)} />
                    </div>
                    <div>
                      <label className="mb-2 block text-xs uppercase tracking-[0.24em] text-slate-500">
                        {t('Work Email', 'Correo institucional')}
                      </label>
                      <input type="email" required placeholder="maria@institution.com" className="cerniq-input" value={email} onChange={(event) => setEmail(event.target.value)} />
                    </div>
                  </div>

                  <div>
                    <label className="mb-2 block text-xs uppercase tracking-[0.24em] text-slate-500">
                      {t('Institution Name', 'Nombre de institucion')}
                    </label>
                    <input type="text" placeholder={t('Your institution name', 'Nombre de su institucion')} className="cerniq-input" value={institutionName} onChange={(event) => setInstitutionName(event.target.value)} />
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="mb-2 block text-xs uppercase tracking-[0.24em] text-slate-500">
                        {t('Type', 'Tipo')}
                      </label>
                      <select className="cerniq-input" value={institutionType} onChange={(event) => setInstitutionType(event.target.value)}>
                        {institutionOptions.map((option) => (
                          <option key={option.value || 'default'} value={option.value} className="bg-white">
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="mb-2 block text-xs uppercase tracking-[0.24em] text-slate-500">
                        {t('Asset Range', 'Rango de activos')}
                      </label>
                      <select className="cerniq-input" value={totalAssets} onChange={(event) => setTotalAssets(event.target.value)}>
                        {assetRanges.map((option) => (
                          <option key={option.value || 'default'} value={option.value} className="bg-white">
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <button type="submit" disabled={loading} className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-amber-500 px-6 py-3 text-sm font-semibold text-white shadow-lg transition hover:bg-amber-600 hover:-translate-y-0.5 disabled:opacity-60">
                    {loading ? t('Submitting...', 'Enviando...') : t('Request Free Analysis', 'Solicitar analisis gratuito')}
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </form>
              )}
            </div>
          </section>

          {/* -- BOTTOM CTA -- */}
          <section className="cerniq-panel cerniq-card-hover overflow-hidden px-6 py-8 sm:px-8 lg:px-10">
            <div className="cerniq-data-wave opacity-90" />
            <div className="relative z-10 flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-3xl">
                <p className="cerniq-section-label">CERNIQ</p>
                <h2 className="mt-4 font-display text-3xl text-slate-950 sm:text-4xl">
                  {t(
                    'Compliance-ready ALM reports. Bilingual. In 24 hours.',
                    'Informes ALM listos para cumplimiento. Bilingues. En 24 horas.'
                  )}
                </h2>
                <p className="mt-5 max-w-2xl text-sm leading-8 text-slate-600 sm:text-base">
                  {t(
                    'CERNIQ is institutional ALM intelligence for credit unions, cooperativas, and community banks. One focused workflow, one clear deliverable, one product your institution understands immediately.',
                    'CERNIQ es inteligencia ALM institucional para cooperativas, credit unions y bancos comunitarios. Un flujo enfocado, una entrega clara, un producto que su institucion entiende de inmediato.'
                  )}
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                <button onClick={() => document.getElementById('demo')?.scrollIntoView({ behavior: 'smooth' })} className="inline-flex items-center justify-center gap-2 rounded-full bg-amber-500 px-6 py-3 text-sm font-semibold text-white shadow-lg transition hover:bg-amber-600 hover:-translate-y-0.5">
                  {t('Request Demo', 'Solicitar Demo')}
                </button>
                <button onClick={() => handleCheckout('one_time')} disabled={checkoutTier === 'one_time'} className="cerniq-button-secondary disabled:opacity-60">
                  {checkoutTier === 'one_time' ? t('Processing...', 'Procesando...') : t('Start — $750', 'Comenzar — $750')}
                </button>
              </div>
            </div>
          </section>
        </main>

        {/* Footer */}
        <footer className="border-t border-slate-200 bg-slate-50 py-8 px-6">
          <div className="mx-auto max-w-6xl grid grid-cols-2 sm:grid-cols-4 gap-6 text-xs">
            <div>
              <p className="font-bold text-slate-800 mb-3 uppercase tracking-wider text-[10px]">{t('Product', 'Producto')}</p>
              <div className="space-y-2">
                <a href="/demo" className="block text-slate-500 hover:text-slate-800">{t('Interactive Demo', 'Demo Interactivo')}</a>
                <a href="/pricing" className="block text-slate-500 hover:text-slate-800">{t('Pricing', 'Precios')}</a>
                <a href="/roi" className="block text-slate-500 hover:text-slate-800">{t('ROI Calculator', 'Calculadora ROI')}</a>
                <a href="/developers" className="block text-slate-500 hover:text-slate-800">{t('API Docs', 'Documentación API')}</a>
                <a href="/changelog" className="block text-slate-500 hover:text-slate-800">{t("What's New", 'Novedades')}</a>
              </div>
            </div>
            <div>
              <p className="font-bold text-slate-800 mb-3 uppercase tracking-wider text-[10px]">{t('Platform', 'Plataforma')}</p>
              <div className="space-y-2">
                <a href="/why-cerniq" className="block text-slate-500 hover:text-slate-800">{t('Why CERNIQ', 'Por qué CERNIQ')}</a>
                <a href="/compliance" className="block text-slate-500 hover:text-slate-800">{t('Compliance Matrix', 'Matriz Cumplimiento')}</a>
                <a href="/case-studies" className="block text-slate-500 hover:text-slate-800">{t('Case Studies', 'Casos de Estudio')}</a>
                <a href="/alm/modules" className="block text-slate-500 hover:text-slate-800">{t('62 ALM Modules', '62 Módulos ALM')}</a>
              </div>
            </div>
            <div>
              <p className="font-bold text-slate-800 mb-3 uppercase tracking-wider text-[10px]">{t('Compliance', 'Cumplimiento')}</p>
              <div className="space-y-2">
                <span className="block text-slate-500">COSSEC (PR)</span>
                <span className="block text-slate-500">NCUA (US)</span>
                <span className="block text-slate-500">Basel III / IRRBB</span>
                <span className="block text-slate-500">FASB 326 (CECL)</span>
              </div>
            </div>
            <div>
              <p className="font-bold text-slate-800 mb-3 uppercase tracking-wider text-[10px]">{t('Company', 'Empresa')}</p>
              <div className="space-y-2">
                <span className="block text-slate-500">KLYTICS LLC</span>
                <span className="block text-slate-500">San Juan, PR</span>
                <a href="/contact" className="block text-cyan-600 hover:text-cyan-800">{t('Book a Demo', 'Agendar Demo')}</a>
                <a href="mailto:erwin@cerniq.io" className="block text-slate-500 hover:text-slate-800">erwin@cerniq.io</a>
                <a href="/status" className="block text-slate-500 hover:text-slate-800">{t('System Status', 'Estado del Sistema')}</a>
              </div>
            </div>
          </div>
          {/* Legal + Social */}
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-slate-200 pt-6">
            <div className="flex flex-wrap items-center gap-4 text-[10px] text-slate-400">
              <span>&copy; {new Date().getFullYear()} KLYTICS LLC. CERNIQ&trade;</span>
              <a href="/terms" className="hover:text-slate-600">{t('Terms of Service', 'Terminos de Servicio')}</a>
              <a href="/privacy" className="hover:text-slate-600">{t('Privacy Policy', 'Politica de Privacidad')}</a>
              <a href="/security" className="hover:text-slate-600">{t('Security', 'Seguridad')}</a>
            </div>
            <div className="flex items-center gap-3">
              <a href="https://linkedin.com/company/klytics" target="_blank" rel="noopener noreferrer" className="text-slate-400 hover:text-slate-600" aria-label="LinkedIn">
                <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
              </a>
              <a href="https://github.com/monykiss/cerniq" target="_blank" rel="noopener noreferrer" className="text-slate-400 hover:text-slate-600" aria-label="GitHub">
                <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"/></svg>
              </a>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
