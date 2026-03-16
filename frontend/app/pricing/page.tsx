'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, CheckCircle2, ChevronRight, HelpCircle } from 'lucide-react';
import { createCheckoutSession } from '@/lib/billing';
import { CerniqMark } from '@/components/brand/CerniqLogo';

const TIERS = [
  {
    id: 'one_time',
    nameEs: 'Informe Piloto',
    nameEn: 'Pilot Report',
    price: '$750',
    cadenceEs: 'unico',
    cadenceEn: 'one-time',
    featured: false,
    bullets: [
      'Un informe ALM completo de 14+ paginas',
      'Revision de datos y configuracion guiada',
      'Entrega de PDF bilingue listo para junta',
    ],
    ctaEs: 'Comenzar — $750',
    ctaEn: null,
  },
  {
    id: 'monthly',
    nameEs: 'Plataforma Recurrente',
    nameEn: 'Recurring Platform',
    price: '$299',
    cadenceEs: '/mes',
    cadenceEn: '/month',
    featured: true,
    bullets: [
      'Flujo de trabajo recurrente de carga a informe',
      'Entrega bilingue de informes',
      'Acceso al portal para recuperacion de informes',
      '12 ratios COSSEC actualizados mensualmente',
    ],
    ctaEs: 'Suscribirse — $299/mes',
    ctaEn: null,
  },
  {
    id: 'partner',
    nameEs: 'Acceso Partner',
    nameEn: 'Partner Access',
    price: '$499',
    cadenceEs: '/mes',
    cadenceEn: '/month',
    featured: false,
    bullets: [
      'Flujo de trabajo multi-cliente',
      'Portal de acceso para partners',
      'Soporte de entrega white-label',
      'Panel de administracion de clientes',
    ],
    ctaEs: 'Contactar ventas',
    ctaEn: 'Contact sales',
  },
] as const;

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

const faqItems = [
  {
    questionEs: '¿Por que empezar con un piloto?',
    questionEn: 'Why start with a pilot?',
    answerEs: 'Un informe piloto permite validar el proceso con datos reales de su institucion antes de comprometerse a un plan recurrente. Usted ve la calidad del informe, la precision de los ratios y la claridad del formato bilingue sin riesgo.',
    answerEn: 'A pilot report lets you validate the process with your institution\'s real data before committing to a recurring plan. You see the report quality, ratio accuracy, and bilingual format clarity with no risk.',
  },
  {
    questionEs: '¿Que incluye cada informe?',
    questionEn: 'What\'s in each report?',
    answerEs: 'Cada informe contiene 14+ paginas con los 12 ratios clave COSSEC, analisis de gap de duracion, sensibilidad NII, cobertura de liquidez, escenarios de estres y recomendaciones. Todo en espanol e ingles, listo para junta y regulador.',
    answerEn: 'Each report contains 14+ pages with all 12 key COSSEC ratios, duration gap analysis, NII sensitivity, liquidity coverage, stress scenarios, and recommendations. All in Spanish and English, ready for board and regulator.',
  },
  {
    questionEs: '¿Como funciona la suscripcion?',
    questionEn: 'How does the subscription work?',
    answerEs: 'La suscripcion se factura mensualmente a traves de Stripe. Puede cancelar en cualquier momento sin penalidad. Mientras esta activa, tiene acceso al flujo completo de carga, analisis y entrega de informes.',
    answerEn: 'The subscription is billed monthly through Stripe. You can cancel anytime with no penalty. While active, you have access to the full upload, analysis, and report delivery workflow.',
  },
];

export default function PricingPage() {
  const [loadingTier, setLoadingTier] = useState<string | null>(null);

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
        <div className="mb-6 flex items-center gap-3 rounded-full border border-slate-200/80 bg-white/80 px-4 py-3 backdrop-blur-xl sm:px-6">
          <Link href="/" className="text-slate-500 transition hover:text-slate-950">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <CerniqMark size="sm" />
          <div>
            <div className="font-display text-sm uppercase tracking-[0.4em] text-slate-950">Cerniq</div>
            <div className="text-[10px] uppercase tracking-[0.36em] text-cyan-700/60">Pricing / Precios</div>
          </div>
        </div>

        <main className="space-y-6 pb-20">
          {/* ── HERO ── */}
          <section className="cerniq-shell p-4 sm:p-6 lg:p-8">
            <div className="cerniq-panel p-6 sm:p-8 lg:p-10">
              <div className="cerniq-data-wave opacity-55" />
              <div className="relative z-10 mx-auto max-w-4xl">
                <span className="cerniq-kicker mb-8 w-fit">Pricing / Precios</span>
                <h1 className="font-display text-3xl leading-tight text-slate-950 sm:text-5xl">
                  Plans &amp; Pricing
                </h1>
                <p className="mt-1 text-lg text-slate-500">Planes y Precios</p>
                <p className="mt-5 max-w-3xl text-base leading-8 text-slate-700">
                  Start with a pilot report. Scale when ready.
                </p>
                <p className="mt-1 max-w-3xl text-sm leading-7 text-slate-500">
                  Comience con un informe piloto. Escale cuando este listo.
                </p>

                <div className="mt-8 flex flex-wrap gap-3">
                  <span className="cerniq-mini-stat">
                    <strong>Piloto</strong> para validar
                  </span>
                  <span className="cerniq-mini-stat">
                    <strong>Recurrente</strong> para informes continuos
                  </span>
                  <span className="cerniq-mini-stat">
                    <strong>Partner</strong> para firmas multi-cliente
                  </span>
                </div>
              </div>
            </div>
          </section>

          {/* ── TIER CARDS ── */}
          <section className="grid gap-6 lg:grid-cols-3">
            {TIERS.map((tier) => (
              <div
                key={tier.id}
                className={`cerniq-panel cerniq-card-hover flex flex-col p-6 ${tier.featured ? 'border-cyan-300/25 shadow-[0_20px_60px_rgba(34,211,238,0.12)]' : ''}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-display text-2xl text-slate-950">{tier.nameEn}</p>
                    <p className="mt-1 text-xs text-slate-400">{tier.nameEs}</p>
                  </div>
                  {tier.featured ? (
                    <span className="rounded-full border border-cyan-200 bg-cyan-50 px-3 py-1 text-[11px] uppercase tracking-[0.26em] text-cyan-700">
                      Recommended / Recomendado
                    </span>
                  ) : null}
                </div>

                <div className="mt-8">
                  <span className="font-display text-5xl text-slate-950">{tier.price}</span>
                  <span className="ml-2 text-sm uppercase tracking-[0.24em] text-slate-500">{tier.cadenceEn}</span>
                  {tier.cadenceEn !== tier.cadenceEs && (
                    <span className="ml-1 text-xs text-slate-400">/ {tier.cadenceEs}</span>
                  )}
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
                    href="mailto:erwin@cerniq.io?subject=Acceso%20Partner%20/%20Partner%20Access"
                    className="mt-8 w-full cerniq-button-secondary text-center"
                  >
                    {tier.ctaEn} / {tier.ctaEs}
                  </a>
                ) : (
                  <button
                    onClick={() => handleCheckout(tier.id)}
                    disabled={loadingTier === tier.id}
                    className={`mt-8 w-full ${tier.featured ? 'inline-flex items-center justify-center gap-2 rounded-full bg-amber-500 px-6 py-3 text-sm font-semibold text-white shadow-lg transition hover:bg-amber-600 hover:-translate-y-0.5' : 'inline-flex items-center justify-center gap-2 rounded-full bg-amber-500 px-6 py-3 text-sm font-semibold text-white shadow-lg transition hover:bg-amber-600 hover:-translate-y-0.5'} disabled:opacity-60`}
                  >
                    {loadingTier === tier.id ? 'Procesando...' : tier.ctaEs}
                  </button>
                )}
              </div>
            ))}
          </section>

          {/* ── ROI / COST COMPARISON ── */}
          <section className="cerniq-panel cerniq-card-hover p-6 sm:p-8 lg:p-10">
            <div className="mx-auto max-w-4xl space-y-6">
              <div>
                <p className="cerniq-section-label">Cost comparison / Comparacion de costos</p>
                <h2 className="mt-4 font-display text-3xl text-slate-950 sm:text-4xl">
                  Your institution spends between $13,900 and $33,000/year on ALM analysis with consultants
                </h2>
                <p className="mt-2 text-sm text-slate-500">
                  Su institucion gasta entre $13,900 y $33,000 al ano en analisis ALM con consultores
                </p>
                <p className="mt-4 text-base leading-8 text-slate-700">
                  CERNIQ from $2,400/year. Same ratios, same accuracy, fraction of the cost.
                </p>
                <p className="mt-1 text-sm text-slate-500">
                  CERNIQ desde $2,400/ano. Mismos ratios, misma precision, fraccion del costo.
                </p>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-200">
                      <th className="py-3 pr-4 text-xs font-semibold uppercase tracking-wider text-slate-500" />
                      <th className="py-3 pr-4 text-xs font-semibold uppercase tracking-wider text-slate-500">Consultor tradicional</th>
                      <th className="py-3 text-xs font-semibold uppercase tracking-wider text-cyan-700">CERNIQ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {costComparison.map((row) => (
                      <tr key={row.item} className="border-b border-slate-100">
                        <td className="py-3 pr-4">
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

              <div className="rounded-2xl border border-emerald-200 bg-emerald-50/80 p-5 text-center">
                <p className="text-xs font-bold uppercase tracking-[0.24em] text-emerald-700">AHORRO ESTIMADO: 83-93%</p>
                <p className="mt-1 text-xs text-emerald-600">Estimated savings: 83-93%</p>
              </div>
            </div>
          </section>

          {/* ── FAQ ── */}
          <section className="cerniq-panel cerniq-card-hover p-6 sm:p-8 lg:p-10">
            <div className="mx-auto max-w-4xl space-y-6">
              <div className="flex items-center gap-3">
                <HelpCircle className="h-5 w-5 text-cyan-700" />
                <p className="cerniq-section-label">FAQ / Preguntas frecuentes</p>
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
              </div>

              <div className="flex flex-wrap gap-3">
                <button
                  onClick={() => handleCheckout('one_time')}
                  disabled={loadingTier === 'one_time'}
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-amber-500 px-6 py-3 text-sm font-semibold text-white shadow-lg transition hover:bg-amber-600 hover:-translate-y-0.5 disabled:opacity-60"
                >
                  {loadingTier === 'one_time' ? 'Procesando...' : 'Comenzar — $750'}
                </button>
                <Link href="/" className="cerniq-button-secondary">
                  Back to home / Volver al inicio
                </Link>
              </div>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
