'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, CheckCircle2, ChevronRight, FileText, PlayCircle, ShieldCheck, Upload, Languages, Clock } from 'lucide-react';
import { apiClient } from '@/lib/api';
import { createCheckoutSession, type CheckoutTier } from '@/lib/billing';
import { CerniqMark, CerniqLockup } from '@/components/brand/CerniqLogo';

const DEMO_VIDEO_URL = (process.env.NEXT_PUBLIC_CERNIQ_DEMO_VIDEO_URL || '').trim();

const institutionOptions = [
  { value: '', label: 'Institution type / Tipo de institucion' },
  { value: 'cooperativa', label: 'Cooperativa' },
  { value: 'credit_union', label: 'Credit union' },
  { value: 'cpa_consultant', label: 'CPA / consulting firm' },
  { value: 'community_bank', label: 'Community bank' },
  { value: 'other', label: 'Other / Otro' },
];

const assetRanges = [
  { value: '', label: 'Asset range / Rango de activos' },
  { value: '< $100M', label: '< $100M' },
  { value: '$100M - $500M', label: '$100M - $500M' },
  { value: '$500M - $1B', label: '$500M - $1B' },
  { value: '$1B - $5B', label: '$1B - $5B' },
  { value: '$5B+', label: '$5B+' },
];

const urgencyHooks = [
  'La proxima temporada de examenes COSSEC se acerca.',
  'La Fed movio tasas. ¿Sabe el impacto en su NIM?',
  'Prepare su proximo ALCO en 24 horas.',
];

const features = [
  {
    icon: ShieldCheck,
    titleEs: 'Cumplimiento COSSEC',
    titleEn: 'COSSEC Compliance',
    copyEs: '12 ratios calculados automaticamente desde su hoja de balance.',
    copyEn: '12 ratios calculated automatically from your balance sheet.',
  },
  {
    icon: Languages,
    titleEs: 'Bilingue por diseno',
    titleEn: 'Bilingual by design',
    copyEs: 'Espanol e ingles en el mismo informe, listo para junta y regulador.',
    copyEn: 'Spanish and English in the same report, ready for board and regulator.',
  },
  {
    icon: Clock,
    titleEs: 'Entrega en 24 horas',
    titleEn: '24-hour delivery',
    copyEs: 'Listo antes de su proximo comite ALCO.',
    copyEn: 'Ready before your next ALCO committee.',
  },
];

const workflow = [
  {
    titleEs: 'Cargue su CSV',
    titleEn: 'Upload your CSV',
    copyEs: 'Suba la hoja de balance de su institucion a traves de un flujo seguro.',
    copyEn: 'Upload your institution balance sheet through a secure workflow.',
    icon: Upload,
  },
  {
    titleEs: 'CERNIQ analiza',
    titleEn: 'CERNIQ analyzes',
    copyEs: 'La plataforma valida el archivo, aplica el motor ALM y prepara el borrador.',
    copyEn: 'The platform validates the file, applies the ALM engine, and prepares the draft.',
    icon: ShieldCheck,
  },
  {
    titleEs: 'Reciba su PDF bilingue',
    titleEn: 'Receive your bilingual PDF',
    copyEs: 'Un informe profesional en espanol e ingles para gerencia, comite o regulador.',
    copyEn: 'A professional report in Spanish and English for management, committee, or regulator.',
    icon: FileText,
  },
];

const costComparison = [
  {
    item: 'Informe ALM trimestral',
    itemEn: 'Quarterly ALM report',
    consultant: '$8,000 - $12,000',
    cerniq: '$750',
  },
  {
    item: 'Acceso anual (4 informes)',
    itemEn: 'Annual access (4 reports)',
    consultant: '$32,000 - $48,000',
    cerniq: '$2,400',
  },
  {
    item: 'Tiempo de entrega',
    itemEn: 'Delivery time',
    consultant: '3-6 semanas',
    cerniq: '24 horas',
  },
  {
    item: 'Bilingue incluido',
    itemEn: 'Bilingual included',
    consultant: 'Cargo adicional',
    cerniq: 'Incluido',
  },
];

const pricingTiers = [
  {
    id: 'one_time',
    nameEs: 'Informe Piloto',
    nameEn: 'Pilot Report',
    price: '$750',
    cadenceEs: 'unico',
    cadenceEn: 'one-time',
    descEs: 'Un informe ALM bilingue para validar el proceso con su institucion.',
    descEn: 'One bilingual ALM report to validate the process with your institution.',
    bullets: ['1 informe ALM bilingue', 'Revision de datos y setup', 'PDF listo para junta'],
    featured: false,
  },
  {
    id: 'monthly',
    nameEs: 'Plataforma Recurrente',
    nameEn: 'Recurring Platform',
    price: '$299',
    cadenceEs: '/mes',
    cadenceEn: '/month',
    descEs: 'Acceso continuo al flujo de carga, analisis y entrega de informes.',
    descEn: 'Ongoing access to the upload, analysis, and report delivery workflow.',
    bullets: ['Informes recurrentes', 'Portal de acceso', 'Entrega bilingue PDF'],
    featured: true,
  },
  {
    id: 'annual',
    nameEs: 'Plan Anual',
    nameEn: 'Annual Plan',
    price: '$2,400',
    cadenceEs: '/ano',
    cadenceEn: '/year',
    descEs: 'Ahorre $1,188 vs. plan mensual. Ideal para planificacion presupuestaria.',
    descEn: 'Save $1,188 vs. monthly plan. Ideal for budget planning.',
    bullets: ['4+ informes anuales', 'Precio fijo predecible', 'Soporte prioritario'],
    featured: false,
  },
];

const faqItems = [
  {
    questionEs: '¿Que datos necesito para generar un informe?',
    questionEn: 'What data do I need to generate a report?',
    answerEs: 'Solo necesita su hoja de balance en formato CSV. CERNIQ valida el archivo, identifica las categorias y ejecuta los calculos ALM automaticamente.',
    answerEn: 'You only need your balance sheet in CSV format. CERNIQ validates the file, identifies categories, and runs ALM calculations automatically.',
  },
  {
    questionEs: '¿El informe cumple con los requisitos de COSSEC?',
    questionEn: 'Does the report meet COSSEC requirements?',
    answerEs: 'Si. El informe incluye los 12 ratios clave que COSSEC evalua, incluyendo gap de duracion, sensibilidad NII, cobertura de liquidez y escenarios de estres.',
    answerEn: 'Yes. The report includes the 12 key ratios COSSEC evaluates, including duration gap, NII sensitivity, liquidity coverage, and stress scenarios.',
  },
  {
    questionEs: '¿Cuanto tiempo toma recibir el informe?',
    questionEn: 'How long does it take to receive the report?',
    answerEs: 'El informe se entrega en 24 horas o menos desde que carga su archivo. Los consultores tradicionales toman de 3 a 6 semanas.',
    answerEn: 'The report is delivered within 24 hours of uploading your file. Traditional consultants take 3 to 6 weeks.',
  },
  {
    questionEs: '¿Mis datos estan seguros?',
    questionEn: 'Is my data secure?',
    answerEs: 'Si. Los archivos se transmiten con encriptacion TLS, se procesan en servidores aislados y no se comparten con terceros. Los datos se eliminan despues de generar el informe.',
    answerEn: 'Yes. Files are transmitted with TLS encryption, processed on isolated servers, and not shared with third parties. Data is deleted after report generation.',
  },
  {
    questionEs: '¿Pueden generar informes para multiples instituciones?',
    questionEn: 'Can you generate reports for multiple institutions?',
    answerEs: 'Si. Nuestro plan anual y acceso de socios estan disenados para firmas CPA y consultoras que sirven a multiples cooperativas o credit unions.',
    answerEn: 'Yes. Our annual plan and partner access are designed for CPA firms and consultancies serving multiple cooperativas or credit unions.',
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
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [loading, setLoading] = useState(false);
  const [checkoutTier, setCheckoutTier] = useState<CheckoutTier | null>(null);
  const [urgencyIndex, setUrgencyIndex] = useState(0);
  const [urgencyFade, setUrgencyFade] = useState(true);
  const router = useRouter();
  const embedUrl = getVideoEmbedUrl(DEMO_VIDEO_URL);
  const hasVideo = Boolean(DEMO_VIDEO_URL);

  useEffect(() => {
    const interval = setInterval(() => {
      setUrgencyFade(false);
      setTimeout(() => {
        setUrgencyIndex((prev) => (prev + 1) % urgencyHooks.length);
        setUrgencyFade(true);
      }, 400);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const getSubmitErrorMessage = (error: unknown) => {
    if (
      typeof error === 'object' &&
      error !== null &&
      'response' in error &&
      typeof (error as { response?: unknown }).response === 'object' &&
      (error as { response?: { data?: unknown } }).response?.data &&
      typeof (error as { response?: { data?: { message?: unknown } } }).response?.data?.message === 'string'
    ) {
      return (error as { response?: { data?: { message?: string } } }).response?.data?.message;
    }

    return 'Failed to submit. Please try again. / No se pudo enviar. Intente de nuevo.';
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
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
      setSubmitted(true);
    } catch (error: unknown) {
      setSubmitError(getSubmitErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  const getPricingCtaLabel = (tier: CheckoutTier) => {
    switch (tier) {
      case 'monthly':
        return 'Suscribirse ahora';
      case 'annual':
        return 'Comprar anual';
      default:
        return 'Comprar ahora';
    }
  };

  async function handleCheckout(tier: CheckoutTier) {
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
        {/* ── NAV ── */}
        <nav className="mb-6 flex items-center justify-between gap-4 rounded-full border border-slate-200/80 bg-white/80 px-4 py-3 backdrop-blur-xl sm:px-6">
          <button onClick={() => router.push('/')} className="flex items-center gap-3 text-left" aria-label="CERNIQ home">
            <CerniqMark size="sm" />
            <div>
              <div className="font-display text-sm uppercase tracking-[0.4em] text-slate-950">Cerniq</div>
              <div className="text-[10px] uppercase tracking-[0.36em] text-cyan-700/60">ALM Reporting</div>
            </div>
          </button>

          <div className="flex items-center gap-2 sm:gap-3">
            <button
              onClick={() => document.getElementById('pricing')?.scrollIntoView({ behavior: 'smooth' })}
              className="hidden rounded-full border border-slate-200 px-4 py-2 text-sm text-slate-600 transition hover:border-cyan-300/50 hover:text-slate-950 sm:inline-flex"
            >
              Precios
            </button>
            <button
              onClick={() => document.getElementById('faq')?.scrollIntoView({ behavior: 'smooth' })}
              className="hidden rounded-full border border-slate-200 px-4 py-2 text-sm text-slate-600 transition hover:border-cyan-300/50 hover:text-slate-950 sm:inline-flex"
            >
              FAQ
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
              Solicitar Demo
            </button>
          </div>
        </nav>

        <main className="space-y-4 pb-16">
          {/* ── HERO ── */}
          <section className="cerniq-shell p-3 sm:p-4 lg:p-6">
            <div className="cerniq-panel min-h-[320px] p-5 sm:p-6 lg:p-8">
              <div className="cerniq-data-wave opacity-55" />
              <div className="relative z-10 mx-auto flex max-w-4xl flex-col">
                <span className="cerniq-kicker mb-4 w-fit">Informes ALM para cooperativas y credit unions</span>
                <CerniqLockup tagline="Bilingual ALM Reporting" />
                <div className="mt-5 space-y-3">
                  <h1 className="font-display text-2xl leading-tight text-slate-950 sm:text-4xl">
                    Informes ALM bilingues para cooperativas y credit unions de Puerto Rico
                  </h1>
                  <p className="max-w-3xl text-sm leading-7 text-slate-700">
                    Cargue su hoja de balance. Genere su informe COSSEC-compliant en horas, no semanas.
                  </p>
                  <p className="max-w-3xl text-xs leading-6 text-slate-500">
                    Upload your balance sheet. Generate your COSSEC-compliant report in hours, not weeks.
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
                    Solicitar analisis gratuito
                    <ArrowRight className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleCheckout('one_time')}
                    disabled={checkoutTier === 'one_time'}
                    className="cerniq-button-secondary disabled:opacity-60"
                  >
                    {checkoutTier === 'one_time' ? 'Procesando...' : 'Comenzar — $750'}
                  </button>
                </div>
              </div>
            </div>
          </section>

          {/* ── SOCIAL PROOF BAR ── */}
          <section className="cerniq-panel py-3 px-6 sm:px-8">
            <div className="mx-auto flex max-w-4xl flex-col items-center gap-3 text-center sm:flex-row sm:justify-center sm:gap-8">
              <span className="text-sm font-semibold text-slate-700">3 cooperativas en piloto</span>
              <span className="hidden h-4 w-px bg-slate-300 sm:block" />
              <span className="text-sm font-semibold text-slate-700">Activos analizados: $1.1B+</span>
              <span className="hidden h-4 w-px bg-slate-300 sm:block" />
              <span className="text-sm font-semibold text-slate-700">Informes entregados: 12+</span>
            </div>
            <p className="mt-2 text-center text-xs text-slate-400">3 cooperativas in pilot -- Assets analyzed: $1.1B+ -- Reports delivered: 12+</p>
          </section>

          {/* ── PAIN / COST SECTION ── */}
          <section className="cerniq-panel cerniq-card-hover p-4 sm:p-6 lg:p-8">
            <div className="mx-auto max-w-4xl space-y-4">
              <div>
                <p className="cerniq-section-label">Cost comparison / Comparacion de costos</p>
                <h2 className="mt-3 font-display text-2xl text-slate-950 sm:text-3xl">
                  How much does your institution spend on ALM analysis?
                </h2>
                <p className="mt-2 text-sm text-slate-500">¿Cuanto gasta su institucion en analisis ALM?</p>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-200">
                      <th className="py-2 pr-4 text-xs font-semibold uppercase tracking-wider text-slate-500" />
                      <th className="py-3 pr-4 text-xs font-semibold uppercase tracking-wider text-slate-500">Consultor tradicional</th>
                      <th className="py-3 text-xs font-semibold uppercase tracking-wider text-cyan-700">CERNIQ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {costComparison.map((row) => (
                      <tr key={row.item} className="border-b border-slate-100">
                        <td className="py-2 pr-4">
                          <span className="font-medium text-slate-700">{row.itemEn}</span>
                          <span className="block text-xs text-slate-400">{row.item}</span>
                        </td>
                        <td className="py-3 pr-4 text-slate-500">{row.consultant}</td>
                        <td className="py-3 font-semibold text-cyan-700">{row.cerniq}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="rounded-2xl border border-emerald-200 bg-emerald-50/80 p-3 text-center">
                <p className="text-xs font-bold uppercase tracking-[0.24em] text-emerald-700">AHORRO ESTIMADO: 83-93%</p>
                <p className="mt-1 text-xs text-emerald-600">Estimated savings: 83-93%</p>
              </div>
            </div>
          </section>

          {/* ── THREE FEATURES ── */}
          <section className="grid gap-4 sm:grid-cols-3">
            {features.map((feat) => (
              <div key={feat.titleEs} className="cerniq-panel cerniq-card-hover p-4">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-cyan-200 bg-cyan-50">
                  <feat.icon className="h-5 w-5 text-cyan-700" />
                </div>
                <p className="mt-3 font-display text-lg text-slate-950">{feat.titleEn}</p>
                <p className="mt-0.5 text-xs text-slate-400">{feat.titleEs}</p>
                <p className="mt-2 text-sm leading-6 text-slate-700">{feat.copyEn}</p>
                <p className="mt-0.5 text-xs leading-5 text-slate-400">{feat.copyEs}</p>
              </div>
            ))}
          </section>

          {/* ── HOW IT WORKS ── */}
          <section className="cerniq-panel cerniq-card-hover p-4 sm:p-6 lg:p-8">
            <div className="mx-auto max-w-4xl">
              <div>
                <p className="cerniq-section-label">How it works / Como funciona</p>
                <h2 className="mt-3 font-display text-2xl text-slate-950 sm:text-3xl">
                  De carga a informe terminado en 3 pasos
                </h2>
                <p className="mt-2 text-sm text-slate-500">From upload to finished report in 3 steps</p>
              </div>

              <div className="mt-5 grid gap-4 sm:grid-cols-3">
                {workflow.map((step, index) => (
                  <div key={step.titleEs} className="rounded-2xl border border-slate-200 bg-white/86 p-4 text-center">
                    <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-2xl border border-cyan-200 bg-cyan-50">
                      <step.icon className="h-5 w-5 text-cyan-700" />
                    </div>
                    <p className="mt-2 text-xs font-bold uppercase tracking-[0.24em] text-slate-400">Paso {index + 1}</p>
                    <h3 className="mt-1 font-display text-lg text-slate-950">{step.titleEn}</h3>
                    <p className="mt-0.5 text-xs text-slate-400">{step.titleEs}</p>
                    <p className="mt-2 text-sm leading-6 text-slate-600">{step.copyEn}</p>
                    <p className="mt-0.5 text-xs leading-5 text-slate-400">{step.copyEs}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* ── WALKTHROUGH VIDEO ── */}
          <section className="cerniq-panel cerniq-card-hover p-4 sm:p-6 lg:p-8">
            <div className="mx-auto space-y-4">
              <div className="max-w-4xl">
                <p className="cerniq-section-label">Walkthrough / Demostracion</p>
                <h2 className="mt-3 font-display text-2xl text-slate-950 sm:text-3xl">
                  Vea el flujo de carga a informe en accion
                </h2>
                <p className="mt-2 text-sm text-slate-500">See the upload-to-report workflow in action</p>
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
                    <p className="font-display text-2xl text-slate-950">Video de demostracion ALM proximamente</p>
                    <p className="text-sm text-slate-500">ALM walkthrough video coming soon</p>
                    <p className="max-w-2xl text-base leading-7 text-slate-600">
                      Add <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-sm">NEXT_PUBLIC_CERNIQ_DEMO_VIDEO_URL</code> once the upload-to-report walkthrough is ready.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* ── PRICING ── */}
          <section id="pricing" className="cerniq-shell p-3 sm:p-4 lg:p-6">
            <div className="mx-auto max-w-4xl">
              <div className="mb-5">
                <p className="cerniq-section-label">Pricing / Precios</p>
                <h2 className="mt-3 font-display text-2xl text-slate-950 sm:text-3xl">
                  Comience con un piloto o elija acceso recurrente
                </h2>
                <p className="mt-2 text-sm text-slate-500">Start with a pilot or choose recurring access</p>
              </div>

              <div className="grid gap-5 sm:grid-cols-3">
                {pricingTiers.map((tier) => (
                  <div
                    key={tier.id}
                    className={`cerniq-panel cerniq-card-hover flex flex-col p-5 ${tier.featured ? 'border-cyan-300/25 shadow-[0_20px_60px_rgba(34,211,238,0.12)]' : ''}`}
                  >
                    {tier.featured && (
                      <span className="mb-3 w-fit rounded-full border border-cyan-200 bg-cyan-50 px-3 py-1 text-[11px] uppercase tracking-[0.26em] text-cyan-700">
                        Recomendado
                      </span>
                    )}
                    <p className="font-display text-xl text-slate-950">{tier.nameEs}</p>
                    <p className="text-xs text-slate-400">{tier.nameEn}</p>

                    <div className="mt-4">
                      <span className="font-display text-4xl text-slate-950">{tier.price}</span>
                      <span className="ml-1 text-sm text-slate-500">{tier.cadenceEs}</span>
                    </div>

                    <p className="mt-3 text-sm leading-6 text-slate-600">{tier.descEs}</p>
                    <p className="mt-1 text-xs leading-5 text-slate-400">{tier.descEn}</p>

                    <div className="mt-5 flex-1 space-y-3">
                      {tier.bullets.map((bullet) => (
                        <div key={bullet} className="flex items-center gap-2 text-sm text-slate-700">
                          <CheckCircle2 className="h-4 w-4 shrink-0 text-cyan-700" />
                          {bullet}
                        </div>
                      ))}
                    </div>

                    <button
                      onClick={() => handleCheckout(tier.id as CheckoutTier)}
                      disabled={checkoutTier === tier.id}
                      className={`mt-6 w-full ${tier.featured ? 'cerniq-button-primary' : 'cerniq-button-secondary'} disabled:opacity-60`}
                    >
                      {checkoutTier === tier.id ? 'Procesando...' : getPricingCtaLabel(tier.id as CheckoutTier)}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* ── FAQ ── */}
          <section id="faq" className="cerniq-panel cerniq-card-hover p-6 sm:p-8 lg:p-10">
            <div className="mx-auto max-w-4xl space-y-6">
              <div>
                <p className="cerniq-section-label">FAQ / Preguntas frecuentes</p>
                <h2 className="mt-4 font-display text-3xl text-slate-950 sm:text-4xl">
                  Respuestas a preguntas comunes
                </h2>
                <p className="mt-2 text-sm text-slate-500">Answers to common questions</p>
              </div>

              <div className="space-y-3">
                {faqItems.map((item) => (
                  <details key={item.questionEs} className="group rounded-2xl border border-slate-200 bg-white/86">
                    <summary className="cursor-pointer list-none px-5 py-4 text-sm font-semibold text-slate-950 sm:text-base [&::-webkit-details-marker]:hidden">
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <span>{item.questionEn}</span>
                          <span className="ml-2 text-xs font-normal text-slate-400">/ {item.questionEs}</span>
                        </div>
                        <ChevronRight className="h-4 w-4 shrink-0 text-slate-400 transition-transform group-open:rotate-90" />
                      </div>
                    </summary>
                    <div className="border-t border-slate-100 px-5 py-4">
                      <p className="text-sm leading-7 text-slate-700">{item.answerEn}</p>
                      <p className="mt-2 text-xs leading-6 text-slate-400">{item.answerEs}</p>
                    </div>
                  </details>
                ))}
              </div>
            </div>
          </section>

          {/* ── DEMO FORM ── */}
          <section id="demo" className="cerniq-panel cerniq-card-hover p-6 sm:p-8">
            <p className="cerniq-section-label">Request demo / Solicitar demo</p>
            <h2 className="mt-4 font-display text-3xl text-slate-950 sm:text-4xl">Bring your institution into the workflow</h2>
            <p className="mt-1 text-sm text-slate-500">Conecte su institucion al flujo de trabajo</p>
            <p className="mt-4 max-w-3xl text-base leading-8 text-slate-600">
              Diganos quien es y programaremos una demostracion enfocada en la carga ALM, el informe bilingue y el camino de piloto para su institucion.
            </p>
            <p className="mt-2 max-w-3xl text-sm leading-7 text-slate-400">
              Tell us who you are and we&apos;ll schedule a focused walkthrough around the ALM upload, bilingual report output, and pilot path for your institution.
            </p>

            <div className="mt-8">
              {submitted ? (
                <div className="rounded-[1.5rem] border border-emerald-300 bg-emerald-50 p-6 text-emerald-800">
                  <CheckCircle2 className="h-9 w-9 text-emerald-500" />
                  <h3 className="mt-4 font-display text-2xl">Request received / Solicitud recibida</h3>
                  <p className="mt-3 text-sm leading-7 text-emerald-700">
                    Le daremos seguimiento en 24 horas para programar su demostracion CERNIQ ALM.
                  </p>
                  <p className="mt-1 text-xs text-emerald-600">
                    We&apos;ll follow up within 24 hours to schedule your CERNIQ ALM walkthrough.
                  </p>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                  {submitError ? (
                    <div className="rounded-2xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700">{submitError}</div>
                  ) : null}

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="mb-2 block text-xs uppercase tracking-[0.24em] text-slate-500">Name / Nombre</label>
                      <input type="text" placeholder="Maria Rodriguez" className="cerniq-input" value={name} onChange={(event) => setName(event.target.value)} />
                    </div>
                    <div>
                      <label className="mb-2 block text-xs uppercase tracking-[0.24em] text-slate-500">Work email / Correo institucional</label>
                      <input type="email" required placeholder="maria@cooperativa.com" className="cerniq-input" value={email} onChange={(event) => setEmail(event.target.value)} />
                    </div>
                  </div>

                  <div>
                    <label className="mb-2 block text-xs uppercase tracking-[0.24em] text-slate-500">Institution name / Nombre de institucion</label>
                    <input type="text" placeholder="Cooperativa de Ahorro y Credito" className="cerniq-input" value={institutionName} onChange={(event) => setInstitutionName(event.target.value)} />
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="mb-2 block text-xs uppercase tracking-[0.24em] text-slate-500">Institution type / Tipo de institucion</label>
                      <select className="cerniq-input" value={institutionType} onChange={(event) => setInstitutionType(event.target.value)}>
                        {institutionOptions.map((option) => (
                          <option key={option.value || 'default'} value={option.value} className="bg-white">
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="mb-2 block text-xs uppercase tracking-[0.24em] text-slate-500">Asset range / Rango de activos</label>
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
                    {loading ? 'Submitting... / Enviando...' : 'Request free analysis / Solicitar analisis gratuito'}
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </form>
              )}
            </div>
          </section>

          {/* ── BOTTOM CTA ── */}
          <section className="cerniq-panel cerniq-card-hover overflow-hidden px-6 py-8 sm:px-8 lg:px-10">
            <div className="cerniq-data-wave opacity-90" />
            <div className="relative z-10 flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-3xl">
                <p className="cerniq-section-label">CERNIQ</p>
                <h2 className="mt-4 font-display text-3xl text-slate-950 sm:text-4xl">
                  Bilingual ALM reports. COSSEC-ready. In 24 hours.
                </h2>
                <p className="mt-2 text-sm text-slate-500">Informes ALM bilingues. Listos para COSSEC. En 24 horas.</p>
                <p className="mt-5 max-w-2xl text-sm leading-8 text-slate-600 sm:text-base">
                  CERNIQ es software de informes ALM bilingues para cooperativas y credit unions. Un flujo enfocado, una entrega clara, un producto que su institucion entiende de inmediato.
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                <button onClick={() => document.getElementById('demo')?.scrollIntoView({ behavior: 'smooth' })} className="inline-flex items-center justify-center gap-2 rounded-full bg-amber-500 px-6 py-3 text-sm font-semibold text-white shadow-lg transition hover:bg-amber-600 hover:-translate-y-0.5">
                  Solicitar Demo
                </button>
                <button onClick={() => handleCheckout('one_time')} disabled={checkoutTier === 'one_time'} className="cerniq-button-secondary disabled:opacity-60">
                  {checkoutTier === 'one_time' ? 'Procesando...' : 'Comenzar — $750'}
                </button>
              </div>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
