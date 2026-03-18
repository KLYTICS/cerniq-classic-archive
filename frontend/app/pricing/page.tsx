'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, CheckCircle2, ChevronRight, HelpCircle } from 'lucide-react';
import { createCheckoutSession } from '@/lib/billing';
import { CerniqMark } from '@/components/brand/CerniqLogo';

function getCtaLabel(tierId: string, lang: 'en' | 'es') {
  if (lang === 'en') {
    switch (tierId) {
      case 'one_time': return 'Start — $750';
      case 'monthly': return 'Subscribe — $299/mo';
      case 'annual': return 'Buy Annual — $2,400';
      case 'partner': return 'Contact Sales';
      default: return 'Get Started';
    }
  } else {
    switch (tierId) {
      case 'one_time': return 'Comenzar — $750';
      case 'monthly': return 'Suscribirse — $299/mes';
      case 'annual': return 'Comprar anual — $2,400';
      case 'partner': return 'Contactar ventas';
      default: return 'Comenzar';
    }
  }
}

export default function PricingPage() {
  const [loadingTier, setLoadingTier] = useState<string | null>(null);
  const [lang, setLang] = useState<'en' | 'es'>('en');

  const t = (en: string, es: string) => lang === 'en' ? en : es;

  const costComparison = lang === 'en'
    ? [
        { item: 'Quarterly ALM report', consultant: '$8,000 - $12,000', cerniq: '$750' },
        { item: 'Annual access (4 reports)', consultant: '$32,000 - $48,000', cerniq: '$2,400' },
        { item: 'Delivery time', consultant: '3-6 weeks', cerniq: '24 hours' },
        { item: 'Bilingual included', consultant: 'Extra charge', cerniq: 'Included' },
      ]
    : [
        { item: 'Informe ALM trimestral', consultant: '$8,000 - $12,000', cerniq: '$750' },
        { item: 'Acceso anual (4 informes)', consultant: '$32,000 - $48,000', cerniq: '$2,400' },
        { item: 'Tiempo de entrega', consultant: '3-6 semanas', cerniq: '24 horas' },
        { item: 'Bilingue incluido', consultant: 'Cargo adicional', cerniq: 'Incluido' },
      ];

  const tiers = [
    {
      id: 'one_time',
      name: t('ALM Report', 'Informe ALM'),
      price: '$750',
      cadence: t('one-time', 'unico'),
      featured: false,
      bullets: [
        t('One 14+ page bilingual ALM report', 'Un informe ALM bilingue de 14+ paginas'),
        t('Data review & guided setup', 'Revision de datos y configuracion guiada'),
        t('Board-ready bilingual PDF', 'PDF bilingue listo para junta'),
        t('12 COSSEC/NCUA ratios', '12 ratios COSSEC/NCUA'),
      ],
    },
    {
      id: 'monthly',
      name: t('Monthly ALM Platform', 'Plataforma ALM Mensual'),
      price: '$299',
      cadence: t('/month', '/mes'),
      featured: true,
      bullets: [
        t('Recurring upload-to-report workflow', 'Flujo recurrente de carga a informe'),
        t('Bilingual report delivery', 'Entrega bilingue de informes'),
        t('Portal access for report retrieval', 'Acceso al portal para recuperacion de informes'),
        t('12 COSSEC/NCUA ratios updated monthly', '12 ratios COSSEC/NCUA actualizados mensualmente'),
      ],
    },
    {
      id: 'annual',
      name: t('Annual ALM Platform', 'Plataforma ALM Anual'),
      price: '$2,400',
      cadence: t('/year', '/ano'),
      featured: false,
      bullets: [
        t('4+ annual reports included', '4+ informes anuales incluidos'),
        t('Predictable fixed pricing', 'Precio fijo predecible'),
        t('Priority support', 'Soporte prioritario'),
        t('Save $1,188 vs. monthly', 'Ahorre $1,188 vs. mensual'),
      ],
    },
    {
      id: 'partner',
      name: t('CPA Partner', 'Partner CPA'),
      price: '$499',
      cadence: t('/month', '/mes'),
      featured: false,
      bullets: [
        t('Multi-client workflow', 'Flujo de trabajo multi-cliente'),
        t('Partner access portal', 'Portal de acceso para partners'),
        t('White-label delivery support', 'Soporte de entrega white-label'),
        t('Client management dashboard', 'Panel de administracion de clientes'),
      ],
    },
  ];

  const faqItems = [
    {
      question: t('Why start with a pilot?', '¿Por que empezar con un piloto?'),
      answer: t(
        'A pilot report lets you validate the process with your institution\'s real data before committing to a recurring plan. You see the report quality, ratio accuracy, and bilingual format clarity with no risk.',
        'Un informe piloto permite validar el proceso con datos reales de su institucion antes de comprometerse a un plan recurrente. Usted ve la calidad del informe, la precision de los ratios y la claridad del formato bilingue sin riesgo.'
      ),
    },
    {
      question: t('What\'s in each report?', '¿Que incluye cada informe?'),
      answer: t(
        'Each report contains 14+ pages with all 12 key COSSEC/NCUA ratios, duration gap analysis, NII sensitivity, liquidity coverage, Monte Carlo stress scenarios, and recommendations. All in English and Spanish, ready for board and regulator.',
        'Cada informe contiene 14+ paginas con los 12 ratios clave COSSEC/NCUA, analisis de gap de duracion, sensibilidad NII, cobertura de liquidez, escenarios de estres Monte Carlo y recomendaciones. Todo en espanol e ingles, listo para junta y regulador.'
      ),
    },
    {
      question: t('How does the subscription work?', '¿Como funciona la suscripcion?'),
      answer: t(
        'The subscription is billed monthly through Stripe. You can cancel anytime with no penalty. While active, you have access to the full upload, analysis, and report delivery workflow.',
        'La suscripcion se factura mensualmente a traves de Stripe. Puede cancelar en cualquier momento sin penalidad. Mientras esta activa, tiene acceso al flujo completo de carga, analisis y entrega de informes.'
      ),
    },
  ];

  async function handleCheckout(tier: string) {
    setLoadingTier(tier);
    try {
      const checkoutUrl = await createCheckoutSession({
        tier: tier as 'one_time' | 'monthly' | 'annual' | 'partner',
        successUrl: '/portal?welcome=1',
        cancelUrl: '/pricing',
      });
      window.location.href = checkoutUrl;
    } catch {
      window.location.href = '/pricing';
    } finally {
      setLoadingTier(null);
    }
  }

  return (
    <div className="min-h-screen overflow-x-clip text-slate-950">
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-6 flex items-center justify-between gap-3 rounded-full border border-slate-200/80 bg-white/80 px-4 py-3 backdrop-blur-xl sm:px-6">
          <div className="flex items-center gap-3">
            <Link href="/" className="text-slate-500 transition hover:text-slate-950">
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <CerniqMark size="sm" />
            <div>
              <div className="font-display text-sm uppercase tracking-[0.4em] text-slate-950">Cerniq</div>
              <div className="text-[10px] uppercase tracking-[0.36em] text-cyan-700/60">{t('Plans & Pricing', 'Planes y precios')}</div>
            </div>
          </div>

          <div className="flex items-center gap-2">
          <Link
            href="/demo"
            className="hidden rounded-full border border-amber-300 bg-amber-50 px-4 py-2 text-xs font-semibold text-amber-700 transition hover:bg-amber-100 sm:inline-flex"
          >
            {t('Try Demo', 'Ver Demo')}
          </Link>

          {/* Language toggle */}
          <div className="flex items-center rounded-full border border-slate-200 text-xs">
            <button
              onClick={() => setLang('en')}
              className={`rounded-l-full px-2.5 py-1.5 font-semibold transition ${lang === 'en' ? 'bg-cyan-700 text-white' : 'text-slate-500 hover:text-slate-950'}`}
            >
              EN
            </button>
            <button
              onClick={() => setLang('es')}
              className={`rounded-r-full px-2.5 py-1.5 font-semibold transition ${lang === 'es' ? 'bg-cyan-700 text-white' : 'text-slate-500 hover:text-slate-950'}`}
            >
              ES
            </button>
          </div>
          </div>
        </div>

        <main className="space-y-6 pb-20">
          {/* -- HERO -- */}
          <section className="cerniq-shell p-4 sm:p-6 lg:p-8">
            <div className="cerniq-panel p-6 sm:p-8 lg:p-10">
              <div className="cerniq-data-wave opacity-55" />
              <div className="relative z-10 mx-auto max-w-4xl">
                <span className="cerniq-kicker mb-8 w-fit">{t('Plans & Pricing', 'Planes y precios')}</span>
                <h1 className="font-display text-3xl leading-tight text-slate-950 sm:text-5xl">
                  {t('Plans & Pricing', 'Planes y Precios')}
                </h1>
                <p className="mt-5 max-w-3xl text-base leading-8 text-slate-700">
                  {t(
                    'Start with a pilot report. Scale when ready.',
                    'Comience con un informe piloto. Escale cuando este listo.'
                  )}
                </p>

                <div className="mt-8 flex flex-wrap gap-3">
                  <span className="cerniq-mini-stat">
                    <strong>{t('Pilot', 'Piloto')}</strong> {t('to validate', 'para validar')}
                  </span>
                  <span className="cerniq-mini-stat">
                    <strong>{t('Recurring', 'Recurrente')}</strong> {t('for ongoing reports', 'para informes continuos')}
                  </span>
                  <span className="cerniq-mini-stat">
                    <strong>Partner</strong> {t('for multi-client firms', 'para firmas multi-cliente')}
                  </span>
                </div>
              </div>
            </div>
          </section>

          {/* -- TIER CARDS -- */}
          <section className="grid gap-6 lg:grid-cols-4">
            {tiers.map((tier) => (
              <div
                key={tier.id}
                className={`cerniq-panel cerniq-card-hover flex flex-col p-6 ${tier.featured ? 'border-cyan-300/25 shadow-[0_20px_60px_rgba(34,211,238,0.12)]' : ''}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="font-display text-2xl text-slate-950">{tier.name}</p>
                  {tier.featured ? (
                    <span className="rounded-full border border-cyan-200 bg-cyan-50 px-3 py-1 text-[11px] uppercase tracking-[0.26em] text-cyan-700">
                      {t('Recommended', 'Recomendado')}
                    </span>
                  ) : null}
                </div>

                <div className="mt-8">
                  <span className="font-display text-5xl text-slate-950">{tier.price}</span>
                  <span className="ml-2 text-sm uppercase tracking-[0.24em] text-slate-500">{tier.cadence}</span>
                </div>

                <div className="mt-8 flex-1 space-y-4">
                  {tier.bullets.map((bullet) => (
                    <div key={bullet} className="flex items-start gap-3 text-sm leading-7 text-slate-700">
                      <CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-cyan-700" />
                      <span>{bullet}</span>
                    </div>
                  ))}
                </div>

                {tier.id === 'partner' ? (
                  <a
                    href="mailto:erwin@cerniq.io?subject=Partner%20Access%20Inquiry"
                    className="mt-8 w-full cerniq-button-secondary text-center"
                  >
                    {getCtaLabel(tier.id, lang)}
                  </a>
                ) : (
                  <button
                    onClick={() => handleCheckout(tier.id)}
                    disabled={loadingTier === tier.id}
                    className={`mt-8 w-full ${tier.featured ? 'inline-flex items-center justify-center gap-2 rounded-full bg-amber-500 px-6 py-3 text-sm font-semibold text-white shadow-lg transition hover:bg-amber-600 hover:-translate-y-0.5' : 'inline-flex items-center justify-center gap-2 rounded-full bg-amber-500 px-6 py-3 text-sm font-semibold text-white shadow-lg transition hover:bg-amber-600 hover:-translate-y-0.5'} disabled:opacity-60`}
                  >
                    {loadingTier === tier.id ? t('Processing...', 'Procesando...') : getCtaLabel(tier.id, lang)}
                  </button>
                )}
              </div>
            ))}
          </section>

          {/* -- ROI / COST COMPARISON -- */}
          <section className="cerniq-panel cerniq-card-hover p-6 sm:p-8 lg:p-10">
            <div className="mx-auto max-w-4xl space-y-6">
              <div>
                <p className="cerniq-section-label">{t('Cost Comparison', 'Comparacion de costos')}</p>
                <h2 className="mt-4 font-display text-3xl text-slate-950 sm:text-4xl">
                  {t(
                    'Your institution spends $13,900-$33,000/year on ALM consultants. CERNIQ from $2,400/year.',
                    'Su institucion gasta $13,900-$33,000/ano en consultores ALM. CERNIQ desde $2,400/ano.'
                  )}
                </h2>
                <p className="mt-4 text-base leading-8 text-slate-700">
                  {t(
                    'Same ratios, same accuracy, fraction of the cost.',
                    'Mismos ratios, misma precision, fraccion del costo.'
                  )}
                </p>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-200">
                      <th className="py-3 pr-4 text-xs font-semibold uppercase tracking-wider text-slate-500" />
                      <th className="py-3 pr-4 text-xs font-semibold uppercase tracking-wider text-slate-500">
                        {t('Traditional Consultant', 'Consultor tradicional')}
                      </th>
                      <th className="py-3 text-xs font-semibold uppercase tracking-wider text-cyan-700">CERNIQ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {costComparison.map((row) => (
                      <tr key={row.item} className="border-b border-slate-100">
                        <td className="py-3 pr-4 font-medium text-slate-700">{row.item}</td>
                        <td className="py-3 pr-4 text-slate-500">{row.consultant}</td>
                        <td className="py-3 font-semibold text-cyan-700">{row.cerniq}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="rounded-2xl border border-emerald-200 bg-emerald-50/80 p-5 text-center">
                <p className="text-xs font-bold uppercase tracking-[0.24em] text-emerald-700">
                  {t('ESTIMATED SAVINGS: 83-93%', 'AHORRO ESTIMADO: 83-93%')}
                </p>
              </div>
            </div>
          </section>

          {/* -- FAQ -- */}
          <section className="cerniq-panel cerniq-card-hover p-6 sm:p-8 lg:p-10">
            <div className="mx-auto max-w-4xl space-y-6">
              <div className="flex items-center gap-3">
                <HelpCircle className="h-5 w-5 text-cyan-700" />
                <p className="cerniq-section-label">FAQ</p>
              </div>

              <div className="space-y-3">
                {faqItems.map((item) => (
                  <details key={item.question} className="group rounded-2xl border border-slate-200 bg-white/86">
                    <summary className="cursor-pointer list-none px-5 py-4 text-sm font-semibold text-slate-950 sm:text-base [&::-webkit-details-marker]:hidden">
                      <div className="flex items-center justify-between gap-4">
                        <span>{item.question}</span>
                        <ChevronRight className="h-4 w-4 shrink-0 text-slate-400 transition-transform group-open:rotate-90" />
                      </div>
                    </summary>
                    <div className="border-t border-slate-100 px-5 py-4">
                      <p className="text-sm leading-7 text-slate-700">{item.answer}</p>
                    </div>
                  </details>
                ))}
              </div>
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
              </div>

              <div className="flex flex-wrap gap-3">
                <button
                  onClick={() => handleCheckout('one_time')}
                  disabled={loadingTier === 'one_time'}
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-amber-500 px-6 py-3 text-sm font-semibold text-white shadow-lg transition hover:bg-amber-600 hover:-translate-y-0.5 disabled:opacity-60"
                >
                  {loadingTier === 'one_time' ? t('Processing...', 'Procesando...') : t('Start — $750', 'Comenzar — $750')}
                </button>
                <Link href="/" className="cerniq-button-secondary">
                  {t('Back to home', 'Volver al inicio')}
                </Link>
              </div>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
