"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  CheckCircle2,
  ChevronRight,
  HelpCircle,
} from "lucide-react";
import { createCheckoutSession } from "@/lib/billing";
import { analytics, EVENTS } from "@/lib/analytics";
import { CerniqMark } from "@/components/brand/CerniqLogo";
import { PRICING_TIERS, getCtaLabel } from "@/lib/pricing";
import { getAcquisitionCopy } from "@/lib/acquisition-copy";
import { PUBLIC_PATHS } from "@/lib/public-links";

export default function PricingPage() {
  const [loadingTier, setLoadingTier] = useState<string | null>(null);
  const [lang, setLang] = useState<"en" | "es">(() => {
    if (typeof window !== "undefined")
      return (localStorage.getItem("cerniq_lang") as "en" | "es") || "en";
    return "en";
  });

  const t = (en: string, es: string) => (lang === "en" ? en : es);
  const acquisition = getAcquisitionCopy(lang);

  const costComparison =
    lang === "en"
      ? [
          {
            item: "Quarterly ALM report",
            consultant: "$8,000 - $12,000",
            cerniq: "$750",
          },
          {
            item: "Annual access (4 reports)",
            consultant: "$32,000 - $48,000",
            cerniq: "$2,400",
          },
          {
            item: "Delivery time",
            consultant: "3-6 weeks",
            cerniq: "24 hours",
          },
          {
            item: "Bilingual included",
            consultant: "Extra charge",
            cerniq: "Included",
          },
        ]
      : [
          {
            item: "Informe ALM trimestral",
            consultant: "$8,000 - $12,000",
            cerniq: "$750",
          },
          {
            item: "Acceso anual (4 informes)",
            consultant: "$32,000 - $48,000",
            cerniq: "$2,400",
          },
          {
            item: "Tiempo de entrega",
            consultant: "3-6 semanas",
            cerniq: "24 horas",
          },
          {
            item: "Bilingue incluido",
            consultant: "Cargo adicional",
            cerniq: "Incluido",
          },
        ];

  // Pricing tiers from single source of truth (lib/pricing.ts)
  const tiers = PRICING_TIERS.map((tier) => ({
    id: tier.id,
    name: t(tier.description, tier.descriptionEs),
    price: t(tier.label, tier.labelEs),
    cadence: t(tier.cadence, tier.cadenceEs),
    featured: tier.featured,
    bullets: tier.bullets.map((b) => t(b.en, b.es)),
  }));

  const faqItems = [
    {
      question: t("Why start with a pilot?", "¿Por que empezar con un piloto?"),
      answer: t(
        "A pilot report lets you validate the process with your institution's real data before committing to a recurring plan. You see the report quality, ratio accuracy, and bilingual format clarity with no risk.",
        "Un informe piloto permite validar el proceso con datos reales de su institucion antes de comprometerse a un plan recurrente. Usted ve la calidad del informe, la precision de los ratios y la claridad del formato bilingue sin riesgo.",
      ),
    },
    {
      question: t("What's in each report?", "¿Que incluye cada informe?"),
      answer: t(
        "Each report contains 14+ pages with all 12 key COSSEC/NCUA ratios, duration gap analysis, NII sensitivity, liquidity coverage, Monte Carlo stress scenarios, and recommendations. All in English and Spanish, ready for board and regulator.",
        "Cada informe contiene 14+ paginas con los 12 ratios clave COSSEC/NCUA, analisis de gap de duracion, sensibilidad NII, cobertura de liquidez, escenarios de estres Monte Carlo y recomendaciones. Todo en espanol e ingles, listo para junta y regulador.",
      ),
    },
    {
      question: t(
        "How does the subscription work?",
        "¿Como funciona la suscripcion?",
      ),
      answer: t(
        "The subscription is billed monthly through Stripe. You can cancel anytime with no penalty. While active, you have access to the full upload, analysis, and report delivery workflow.",
        "La suscripcion se factura mensualmente a traves de Stripe. Puede cancelar en cualquier momento sin penalidad. Mientras esta activa, tiene acceso al flujo completo de carga, analisis y entrega de informes.",
      ),
    },
  ];

  async function handleCheckout(tier: string) {
    analytics.track(EVENTS.CHECKOUT_STARTED, { tier, source: "pricing_page" });
    setLoadingTier(tier);
    try {
      const checkoutUrl = await createCheckoutSession({
        tier: tier as "one_time" | "monthly" | "annual" | "partner",
        successUrl: "/login?billing=success&returnUrl=%2Fdashboard",
        cancelUrl: "/pricing",
      });
      window.location.href = checkoutUrl;
    } catch {
      window.location.href = "/pricing";
    } finally {
      setLoadingTier(null);
    }
  }

  return (
    <div className="min-h-screen overflow-x-clip text-slate-950">
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-6 flex items-center justify-between gap-3 rounded-full border border-slate-200/80 bg-white/80 px-4 py-3 backdrop-blur-xl sm:px-6">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="text-slate-500 transition hover:text-slate-950"
              aria-label={t("Back to home", "Volver al inicio")}
            >
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <CerniqMark size="sm" />
            <div>
              <div className="font-display text-sm uppercase tracking-[0.4em] text-slate-950">
                Cerniq
              </div>
              <div className="text-[10px] uppercase tracking-[0.36em] text-cyan-700/60">
                {t("Plans & Pricing", "Planes y precios")}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href={PUBLIC_PATHS.demo}
              className="hidden rounded-full border border-amber-300 bg-amber-50 px-4 py-2 text-xs font-semibold text-amber-700 transition hover:bg-amber-100 sm:inline-flex"
            >
              {acquisition.proofCta}
            </Link>

            {/* Language toggle */}
            <div className="flex items-center rounded-full border border-slate-200 text-xs">
              <button
                onClick={() => setLang("en")}
                className={`rounded-l-full px-2.5 py-1.5 font-semibold transition ${lang === "en" ? "bg-cyan-700 text-white" : "text-slate-500 hover:text-slate-950"}`}
                aria-label="Switch to English"
                aria-pressed={lang === "en"}
              >
                EN
              </button>
              <button
                onClick={() => setLang("es")}
                className={`rounded-r-full px-2.5 py-1.5 font-semibold transition ${lang === "es" ? "bg-cyan-700 text-white" : "text-slate-500 hover:text-slate-950"}`}
                aria-label="Cambiar a Espanol"
                aria-pressed={lang === "es"}
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
                <span className="cerniq-kicker mb-8 w-fit">
                  {t("Plans & Pricing", "Planes y precios")}
                </span>
                <h1 className="font-display text-3xl leading-tight text-slate-950 sm:text-5xl">
                  {acquisition.pricingHeroTitle}
                </h1>
                <p className="mt-5 max-w-3xl text-base leading-8 text-slate-700">
                  {acquisition.pricingHeroBody}
                </p>

                <div className="mt-8 flex flex-wrap gap-3">
                  <Link href="/get-started" className="inline-flex items-center justify-center gap-2 rounded-full bg-amber-500 px-6 py-3 text-sm font-semibold text-white shadow-lg transition hover:bg-amber-600 hover:-translate-y-0.5">
                    {acquisition.primaryCta}
                    <ChevronRight className="h-4 w-4" />
                  </Link>
                  <Link href={PUBLIC_PATHS.demo} className="inline-flex items-center justify-center gap-2 rounded-full border border-cyan-300 bg-cyan-50 px-6 py-3 text-sm font-semibold text-cyan-800 transition hover:bg-cyan-100">
                    {acquisition.proofCta}
                  </Link>
                  <Link href={PUBLIC_PATHS.contact} className="inline-flex items-center justify-center gap-2 rounded-full border border-slate-200 px-6 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:text-slate-950">
                    {acquisition.salesCta}
                  </Link>
                </div>

                <div className="mt-8 flex flex-wrap gap-3">
                  <span className="cerniq-mini-stat">
                    <strong>{t("Pilot", "Piloto")}</strong>{" "}
                    {t("to validate", "para validar")}
                  </span>
                  <span className="cerniq-mini-stat">
                    <strong>{t("Recurring", "Recurrente")}</strong>{" "}
                    {t("for ongoing reports", "para informes continuos")}
                  </span>
                  <span className="cerniq-mini-stat">
                    <strong>Partner</strong>{" "}
                    {t("for multi-client firms", "para firmas multi-cliente")}
                  </span>
                </div>
              </div>

              {/* Platform Depth Strip */}
              <div className="relative z-10 mt-6 grid grid-cols-2 sm:grid-cols-4 gap-3 mx-auto max-w-4xl">
                <div className="rounded-xl border border-cyan-200 bg-cyan-50/50 p-3 text-center">
                  <p className="text-2xl font-bold tabular-nums text-cyan-800">
                    61
                  </p>
                  <p className="text-[10px] text-cyan-600 font-semibold uppercase">
                    {t("ALM Modules", "Módulos ALM")}
                  </p>
                </div>
                <div className="rounded-xl border border-violet-200 bg-violet-50/50 p-3 text-center">
                  <p className="text-2xl font-bold tabular-nums text-violet-800">
                    34
                  </p>
                  <p className="text-[10px] text-violet-600 font-semibold uppercase">
                    {t("Quant Models", "Modelos Quant")}
                  </p>
                </div>
                <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-3 text-center">
                  <p className="text-2xl font-bold tabular-nums text-amber-800">
                    142
                  </p>
                  <p className="text-[10px] text-amber-600 font-semibold uppercase">
                    {t("API Endpoints", "Endpoints API")}
                  </p>
                </div>
                <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-3 text-center">
                  <p className="text-2xl font-bold tabular-nums text-emerald-800">
                    EN/ES
                  </p>
                  <p className="text-[10px] text-emerald-600 font-semibold uppercase">
                    {t("Bilingual Everything", "Todo Bilingüe")}
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* -- TIER CARDS -- */}
          <section
            className="grid gap-6 lg:grid-cols-4"
            aria-label={t("Pricing tiers", "Niveles de precios")}
          >
            {tiers.map((tier) => (
              <article
                key={tier.id}
                aria-label={tier.name}
                className={`cerniq-panel cerniq-card-hover flex flex-col p-6 ${tier.featured ? "border-cyan-300/25 shadow-[0_20px_60px_rgba(34,211,238,0.12)]" : ""}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="font-display text-2xl text-slate-950">
                    {tier.name}
                  </p>
                  {tier.featured ? (
                    <span className="rounded-full border border-cyan-200 bg-cyan-50 px-3 py-1 text-[11px] uppercase tracking-[0.26em] text-cyan-700">
                      {t("Recommended", "Recomendado")}
                    </span>
                  ) : null}
                </div>

                <div className="mt-8">
                  <span className="font-display text-5xl text-slate-950">
                    {tier.price}
                  </span>
                  <span className="ml-2 text-sm uppercase tracking-[0.24em] text-slate-500">
                    {tier.cadence}
                  </span>
                </div>

                <div className="mt-8 flex-1 space-y-4">
                  {tier.bullets.map((bullet) => (
                    <div
                      key={bullet}
                      className="flex items-start gap-3 text-sm leading-7 text-slate-700"
                    >
                      <CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-cyan-700" />
                      <span>{bullet}</span>
                    </div>
                  ))}
                </div>

                {tier.id === "partner" ? (
                  <a
                    href={PUBLIC_PATHS.contact}
                    rel="noopener noreferrer"
                    className="mt-8 w-full cerniq-button-secondary text-center"
                  >
                    {getCtaLabel(tier.id, lang)}
                  </a>
                ) : (
                  <button
                    onClick={() => handleCheckout(tier.id)}
                    disabled={loadingTier === tier.id}
                    className={`mt-8 w-full ${tier.featured ? "inline-flex items-center justify-center gap-2 rounded-full bg-amber-500 px-6 py-3 text-sm font-semibold text-white shadow-lg transition hover:bg-amber-600 hover:-translate-y-0.5" : "inline-flex items-center justify-center gap-2 rounded-full bg-amber-500 px-6 py-3 text-sm font-semibold text-white shadow-lg transition hover:bg-amber-600 hover:-translate-y-0.5"} disabled:opacity-60`}
                  >
                    {loadingTier === tier.id
                      ? t("Processing...", "Procesando...")
                      : getCtaLabel(tier.id, lang)}
                  </button>
                )}
              </article>
            ))}
          </section>

          {/* -- ROI / COST COMPARISON -- */}
          <section className="cerniq-panel cerniq-card-hover p-6 sm:p-8 lg:p-10">
            <div className="mx-auto max-w-4xl space-y-6">
              <div>
                <p className="cerniq-section-label">
                  {t("Cost Comparison", "Comparacion de costos")}
                </p>
                <h2 className="mt-4 font-display text-3xl text-slate-950 sm:text-4xl">
                  {t(
                    "Your institution spends $13,900-$33,000/year on ALM consultants. CERNIQ from $2,400/year.",
                    "Su institucion gasta $13,900-$33,000/ano en consultores ALM. CERNIQ desde $2,400/ano.",
                  )}
                </h2>
                <p className="mt-4 text-base leading-8 text-slate-700">
                  {t(
                    "Same ratios, same accuracy, fraction of the cost.",
                    "Mismos ratios, misma precision, fraccion del costo.",
                  )}
                </p>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-200">
                      <th
                        scope="col"
                        className="py-3 pr-4 text-xs font-semibold uppercase tracking-wider text-slate-500"
                      />
                      <th
                        scope="col"
                        className="py-3 pr-4 text-xs font-semibold uppercase tracking-wider text-slate-500"
                      >
                        {t("Traditional Consultant", "Consultor tradicional")}
                      </th>
                      <th
                        scope="col"
                        className="py-3 text-xs font-semibold uppercase tracking-wider text-cyan-700"
                      >
                        CERNIQ
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {costComparison.map((row) => (
                      <tr key={row.item} className="border-b border-slate-100">
                        <td className="py-3 pr-4 font-medium text-slate-700">
                          {row.item}
                        </td>
                        <td className="py-3 pr-4 text-slate-500">
                          {row.consultant}
                        </td>
                        <td className="py-3 font-semibold text-cyan-700">
                          {row.cerniq}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="rounded-2xl border border-emerald-200 bg-emerald-50/80 p-5 text-center">
                <p className="text-xs font-bold uppercase tracking-[0.24em] text-emerald-700">
                  {t("ESTIMATED SAVINGS: 83-93%", "AHORRO ESTIMADO: 83-93%")}
                </p>
              </div>
            </div>
          </section>

          {/* -- COMPETITIVE COMPARISON -- */}
          <section className="cerniq-panel cerniq-card-hover p-6 sm:p-8 lg:p-10">
            <div className="mx-auto max-w-5xl space-y-6">
              <div>
                <p className="cerniq-section-label">
                  {t("Capability Comparison", "Comparación de capacidades")}
                </p>
                <h2 className="mt-4 font-display text-2xl text-slate-950 sm:text-3xl">
                  {t(
                    "Same quant depth. 90% less cost.",
                    "Misma profundidad cuantitativa. 90% menos costo.",
                  )}
                </h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-200">
                      <th
                        scope="col"
                        className="py-3 pr-4 text-xs font-semibold uppercase tracking-wider text-slate-500 w-48"
                      >
                        {t("Capability", "Capacidad")}
                      </th>
                      <th
                        scope="col"
                        className="py-3 pr-4 text-xs font-semibold uppercase tracking-wider text-slate-400"
                      >
                        {t("Moody's / S&P", "Moody's / S&P")}
                      </th>
                      <th
                        scope="col"
                        className="py-3 pr-4 text-xs font-semibold uppercase tracking-wider text-slate-400"
                      >
                        QRM / Empyrean
                      </th>
                      <th
                        scope="col"
                        className="py-3 text-xs font-semibold uppercase tracking-wider text-cyan-700"
                      >
                        CERNIQ
                      </th>
                    </tr>
                  </thead>
                  <tbody className="text-xs">
                    {[
                      [
                        t("Monte Carlo Simulation", "Simulación Monte Carlo"),
                        "10K+",
                        "5K+",
                        "10K Vasicek",
                      ],
                      [
                        t("Yield Curve Models", "Modelos Curva Rendimiento"),
                        "Nelson-Siegel",
                        "Cubic Spline",
                        "Nelson-Siegel + PCA",
                      ],
                      ["CECL", "PD/LGD", "WARM + PD/LGD", "3 methods"],
                      [
                        t("Credit Portfolio VaR", "VaR Portafolio Crédito"),
                        "CreditMetrics",
                        "Basic",
                        "CreditMetrics + Copula",
                      ],
                      [
                        t("Structural Default", "Incumplimiento Estructural"),
                        "Merton",
                        "-",
                        "KMV-Merton",
                      ],
                      [
                        t("Portfolio Optimization", "Optimización Portafolio"),
                        "MVO",
                        "-",
                        "BL + CVaR + HRP",
                      ],
                      [
                        t("Market Risk Capital", "Capital Riesgo Mercado"),
                        "VaR",
                        "VaR",
                        "FRTB-IMA ES",
                      ],
                      [
                        t("Bilingual Reports", "Informes Bilingües"),
                        "-",
                        "-",
                        "EN/ES native",
                      ],
                      [
                        t("PR Regulatory", "Regulatorio PR"),
                        "-",
                        "-",
                        "COSSEC + NCUA",
                      ],
                      [
                        t("Climate Risk", "Riesgo Climático"),
                        t("Separate product", "Producto aparte"),
                        "-",
                        t(
                          "Built-in (Hurricane AAL)",
                          "Integrado (AAL Huracán)",
                        ),
                      ],
                      [
                        t("Minimum Contract", "Contrato mínimo"),
                        "$150K+/yr",
                        "$80K+/yr",
                        "$2,400/yr",
                      ],
                    ].map((row, i) => (
                      <tr key={i} className="border-b border-slate-100">
                        <td className="py-2.5 pr-4 font-medium text-slate-700">
                          {row[0]}
                        </td>
                        <td className="py-2.5 pr-4 text-slate-500">{row[1]}</td>
                        <td className="py-2.5 pr-4 text-slate-500">{row[2]}</td>
                        <td className="py-2.5 font-semibold text-cyan-700">
                          {row[3]}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
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
                  <details
                    key={item.question}
                    className="group rounded-2xl border border-slate-200 bg-white/86"
                  >
                    <summary className="cursor-pointer list-none px-5 py-4 text-sm font-semibold text-slate-950 sm:text-base [&::-webkit-details-marker]:hidden">
                      <div className="flex items-center justify-between gap-4">
                        <span>{item.question}</span>
                        <ChevronRight className="h-4 w-4 shrink-0 text-slate-400 transition-transform group-open:rotate-90" />
                      </div>
                    </summary>
                    <div className="border-t border-slate-100 px-5 py-4">
                      <p className="text-sm leading-7 text-slate-700">
                        {item.answer}
                      </p>
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
                    "One pilot-first path. One recurring upgrade when you are ready.",
                    "Un camino pilot-first. Una ruta de acceso recurrente cuando este listo.",
                  )}
                </h2>
              </div>

              <div className="flex flex-wrap gap-3">
                <Link
                  href="/get-started"
                  className="inline-flex items-center justify-center gap-2 rounded-full border border-cyan-300 bg-cyan-50 px-6 py-3 text-sm font-semibold text-cyan-800 transition hover:bg-cyan-100"
                >
                  {acquisition.primaryCta}
                  <ChevronRight className="h-4 w-4" />
                </Link>
                <Link href={PUBLIC_PATHS.demo} className="cerniq-button-secondary">
                  {acquisition.proofCta}
                </Link>
                <Link href={PUBLIC_PATHS.contact} className="inline-flex items-center justify-center gap-2 rounded-full border border-slate-200 px-6 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:text-slate-950">
                  {acquisition.salesCta}
                </Link>
              </div>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
