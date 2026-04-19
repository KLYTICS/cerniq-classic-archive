"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  CheckCircle2,
  ChevronRight,
  FileText,
  PlayCircle,
  ShieldCheck,
  Upload,
  Languages,
  Clock,
} from "lucide-react";
import { apiClient } from "@/lib/api";
import { createCheckoutSession, type CheckoutTier } from "@/lib/billing";
import { analytics, EVENTS } from "@/lib/analytics";
import { PRICING, getCtaLabel } from "@/lib/pricing";
import { CerniqMark, CerniqLockup } from "@/components/brand/CerniqLogo";
import Footer from "@/components/layout/Footer";
import { getAcquisitionCopy } from "@/lib/acquisition-copy";

const DEMO_VIDEO_URL = (
  process.env.NEXT_PUBLIC_CERNIQ_DEMO_VIDEO_URL || ""
).trim();

const institutionOptionsEN = [
  { value: "", label: "Institution type" },
  { value: "cooperativa", label: "Cooperativa" },
  { value: "credit_union", label: "Credit Union" },
  { value: "cpa_consultant", label: "CPA / Consulting Firm" },
  { value: "community_bank", label: "Community Bank" },
  { value: "other", label: "Other" },
];

const institutionOptionsES = [
  { value: "", label: "Tipo de institucion" },
  { value: "cooperativa", label: "Cooperativa" },
  { value: "credit_union", label: "Credit Union" },
  { value: "cpa_consultant", label: "CPA / Consultora" },
  { value: "community_bank", label: "Banco comunitario" },
  { value: "other", label: "Otro" },
];

const assetRangesEN = [
  { value: "", label: "Asset range" },
  { value: "< $100M", label: "< $100M" },
  { value: "$100M - $500M", label: "$100M - $500M" },
  { value: "$500M - $1B", label: "$500M - $1B" },
  { value: "$1B - $5B", label: "$1B - $5B" },
  { value: "$5B+", label: "$5B+" },
];

const assetRangesES = [
  { value: "", label: "Rango de activos" },
  { value: "< $100M", label: "< $100M" },
  { value: "$100M - $500M", label: "$100M - $500M" },
  { value: "$500M - $1B", label: "$500M - $1B" },
  { value: "$1B - $5B", label: "$1B - $5B" },
  { value: "$5B+", label: "$5B+" },
];

const urgencyHooksEN = [
  "COSSEC exam season is approaching. Is your institution ready?",
  "The Fed moved rates. Do you know the impact on your NIM?",
  "Prepare your next ALCO meeting in 24 hours, not 3 weeks.",
];

const urgencyHooksES = [
  "La temporada de examenes COSSEC se acerca. ¿Esta lista su institucion?",
  "La Fed movio tasas. ¿Sabe el impacto en su NIM?",
  "Prepare su proximo ALCO en 24 horas, no 3 semanas.",
];

const costComparisonEN = [
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
];

const costComparisonES = [
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

function getVideoEmbedUrl(url: string) {
  if (!url) {
    return "";
  }

  if (url.includes("youtube.com/watch?v=")) {
    const videoId = new URL(url).searchParams.get("v");
    return videoId ? `https://www.youtube.com/embed/${videoId}` : url;
  }

  if (url.includes("youtu.be/")) {
    const videoId = url.split("youtu.be/")[1]?.split(/[?&]/)[0];
    return videoId ? `https://www.youtube.com/embed/${videoId}` : url;
  }

  if (url.includes("vimeo.com/")) {
    const videoId = url.split("vimeo.com/")[1]?.split(/[?&/]/)[0];
    return videoId ? `https://player.vimeo.com/video/${videoId}` : url;
  }

  if (url.includes("loom.com/share/")) {
    const videoId = url.split("loom.com/share/")[1]?.split(/[?&]/)[0];
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
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [institutionName, setInstitutionName] = useState("");
  const [institutionType, setInstitutionType] = useState("");
  const [totalAssets, setTotalAssets] = useState("");
  const [honeypot, setHoneypot] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [loading, setLoading] = useState(false);
  const [checkoutTier, setCheckoutTier] = useState<CheckoutTier | null>(null);
  const [urgencyIndex, setUrgencyIndex] = useState(0);
  const [urgencyFade, setUrgencyFade] = useState(true);
  const [lang, setLang] = useState<"en" | "es">(() => {
    if (typeof window !== "undefined") {
      return (localStorage.getItem("cerniq_lang") as "en" | "es") || "en";
    }
    return "en";
  });
  const router = useRouter();
  const embedUrl = getVideoEmbedUrl(DEMO_VIDEO_URL);
  const hasVideo = Boolean(DEMO_VIDEO_URL);

  const t = (en: string, es: string) => (lang === "en" ? en : es);
  const acquisition = getAcquisitionCopy(lang);

  useEffect(() => {
    localStorage.setItem("cerniq_lang", lang);
  }, [lang]);

  const urgencyHooks = lang === "en" ? urgencyHooksEN : urgencyHooksES;
  const costComparison = lang === "en" ? costComparisonEN : costComparisonES;
  const institutionOptions =
    lang === "en" ? institutionOptionsEN : institutionOptionsES;
  const assetRanges = lang === "en" ? assetRangesEN : assetRangesES;

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
      typeof error === "object" &&
      error !== null &&
      "response" in error &&
      typeof (error as { response?: unknown }).response === "object" &&
      (error as { response?: { data?: unknown } }).response?.data &&
      typeof (error as { response?: { data?: { message?: unknown } } }).response
        ?.data?.message === "string"
    ) {
      const message = (error as { response?: { data?: { message?: string } } })
        .response?.data?.message;
      if (message) {
        return message;
      }
    }

    return t(
      "Failed to submit. Please try again.",
      "No se pudo enviar. Intente de nuevo.",
    );
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (honeypot) return; // Bot trap
    setSubmitError("");
    setLoading(true);

    try {
      await apiClient.submitDemoRequest({
        email,
        name,
        institutionName,
        institutionType,
        totalAssets,
      });
      analytics.track(EVENTS.LEAD_FORM_SUBMITTED, {
        institutionType,
        totalAssets,
        source: "landing_page_pilot_intake",
      });
      setSubmitted(true);
    } catch (error: unknown) {
      setSubmitError(getSubmitErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  async function handleCheckout(tier: CheckoutTier) {
    analytics.track(EVENTS.CHECKOUT_STARTED, { tier, source: "landing_page" });
    setCheckoutTier(tier);
    try {
      const checkoutUrl = await createCheckoutSession({
        tier,
        successUrl: "/login?billing=success&returnUrl=%2Fdashboard",
        cancelUrl: "/pricing",
      });
      window.location.href = checkoutUrl;
    } catch {
      window.location.href = "/#pricing";
    } finally {
      setCheckoutTier(null);
    }
  }

  return (
    <div className="cerniq-dashboard-page min-h-screen overflow-x-clip text-[var(--dashboard-text-primary)]">
      <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
        <nav
          aria-label="Main navigation"
          className="sticky top-3 z-30 mb-5 flex items-center justify-between gap-4 rounded-full border border-[rgba(216,192,139,0.76)] bg-[rgba(255,251,239,0.84)] px-4 py-3 shadow-[0_16px_40px_rgba(113,88,40,0.08)] backdrop-blur-xl sm:px-6"
        >
          <button
            onClick={() => router.push("/")}
            className="flex items-center gap-3 text-left"
            aria-label="CERNIQ home"
          >
            <CerniqMark size="sm" />
            <div>
              <div className="font-display text-sm uppercase tracking-[0.4em] text-slate-950">
                Cerniq
              </div>
              <div className="text-[10px] uppercase tracking-[0.36em] text-cyan-700/60">
                ALM Intelligence
              </div>
            </div>
          </button>

          <div className="flex items-center gap-2 sm:gap-3">
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
            <button
              onClick={() => router.push("/demo")}
              className="hidden px-2 py-2 text-sm text-[var(--dashboard-text-secondary)] transition hover:text-[var(--dashboard-text-primary)] sm:inline-flex"
            >
              {acquisition.proofCta}
            </button>
            <button
              onClick={() =>
                document
                  .getElementById("pricing")
                  ?.scrollIntoView({ behavior: "smooth" })
              }
              className="hidden rounded-full border border-[rgba(216,192,139,0.72)] px-4 py-2 text-sm text-[var(--dashboard-text-secondary)] transition hover:border-cyan-300/50 hover:text-[var(--dashboard-text-primary)] sm:inline-flex"
            >
              {t("Pricing", "Precios")}
            </button>
            <button
              onClick={() => router.push("/why-cerniq")}
              className="hidden rounded-full border border-[rgba(216,192,139,0.72)] px-4 py-2 text-sm text-[var(--dashboard-text-secondary)] transition hover:border-cyan-300/50 hover:text-[var(--dashboard-text-primary)] sm:inline-flex"
            >
              {t("Why CERNIQ", "Por qué CERNIQ")}
            </button>
            <button
              onClick={() => router.push("/compliance")}
              className="hidden rounded-full border border-[rgba(216,192,139,0.72)] px-4 py-2 text-sm text-[var(--dashboard-text-secondary)] transition hover:border-cyan-300/50 hover:text-[var(--dashboard-text-primary)] lg:inline-flex"
            >
              {t("Compliance", "Cumplimiento")}
            </button>
            <button
              onClick={() => router.push("/roi")}
              className="hidden rounded-full border border-[rgba(216,192,139,0.72)] px-4 py-2 text-sm text-[var(--dashboard-text-secondary)] transition hover:border-cyan-300/50 hover:text-[var(--dashboard-text-primary)] lg:inline-flex"
            >
              {t("ROI Calculator", "Calculadora ROI")}
            </button>
            <button
              onClick={() => router.push("/login")}
              className="rounded-full border border-[rgba(216,192,139,0.72)] px-4 py-2 text-sm text-[var(--dashboard-text-secondary)] transition hover:border-cyan-300/50 hover:text-[var(--dashboard-text-primary)]"
            >
              Sign In
            </button>
            <button
              onClick={() => router.push("/get-started")}
              className="cerniq-button-primary"
            >
              {acquisition.primaryCta}
            </button>
          </div>
        </nav>

        <main className="space-y-5 pb-16">
          <section className="-mx-4 overflow-hidden rounded-b-[2.75rem] border-b border-[rgba(216,192,139,0.72)] sm:-mx-6 lg:-mx-8">
            <div className="relative isolate min-h-[calc(100svh-7rem)] overflow-hidden bg-[linear-gradient(180deg,rgba(255,248,235,0.96)_0%,rgba(254,241,215,0.96)_44%,rgba(249,236,208,0.98)_100%)]">
              <div className="absolute inset-0 bg-[linear-gradient(rgba(216,192,139,0.14)_1px,transparent_1px),linear-gradient(90deg,rgba(216,192,139,0.14)_1px,transparent_1px)] bg-[size:10rem_10rem] opacity-50" />
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_12%_18%,rgba(255,251,239,0.96),transparent_26rem),radial-gradient(circle_at_78%_18%,rgba(232,160,32,0.12),transparent_24rem),radial-gradient(circle_at_78%_68%,rgba(27,58,107,0.1),transparent_22rem)]" />
              <div className="absolute right-[-6rem] top-12 h-72 w-72 rounded-full border border-white/40 bg-white/20 blur-3xl" />
              <div className="absolute left-[-4rem] bottom-[-5rem] h-80 w-80 rounded-full bg-[radial-gradient(circle,rgba(247,228,188,0.66),rgba(247,228,188,0))]" />

              <div className="relative z-10 mx-auto flex max-w-7xl px-4 py-10 sm:px-6 lg:min-h-[calc(100svh-7rem)] lg:items-center lg:px-8 lg:py-14">
                <div className="max-w-4xl animate-fade-in">
                  <span className="cerniq-kicker w-fit">
                    {t(
                      "Dashboard-native ALM Intelligence",
                      "Inteligencia ALM nativa del dashboard",
                    )}
                  </span>
                  <div className="mt-6">
                    <CerniqLockup
                      tagline={t(
                        "Institutional ALM Intelligence",
                        "Inteligencia ALM Institucional",
                      )}
                    />
                  </div>
                  <h1 className="mt-8 max-w-4xl font-display text-[clamp(2.6rem,6vw,4.9rem)] leading-[0.94] tracking-[-0.04em] text-[var(--dashboard-text-primary)]">
                    {t(
                      "From one balance sheet upload to your first board-ready bilingual ALM report.",
                      "De una sola carga de balance a su primer informe ALM bilingue listo para junta.",
                    )}
                  </h1>
                  <p className="mt-6 max-w-2xl text-base leading-8 text-[var(--dashboard-text-secondary)] sm:text-lg">
                    {acquisition.pilotPathDescription}{" "}
                    {t(
                      "Start with a pilot, then move into recurring access when your team trusts the workflow.",
                      "Comience con un piloto y pase a acceso recurrente cuando su equipo confie en el flujo.",
                    )}
                  </p>

                  <div className="mt-5 flex h-6 items-center">
                    <p
                      className={`text-sm font-semibold text-[#9b742f] transition-opacity duration-400 ${urgencyFade ? "opacity-100" : "opacity-0"}`}
                    >
                      {urgencyHooks[urgencyIndex]}
                    </p>
                  </div>

                  <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                    <button
                      onClick={() => router.push("/get-started")}
                      className="inline-flex items-center justify-center gap-2 rounded-full bg-[#d39a2b] px-6 py-3.5 text-sm font-semibold text-white shadow-[0_18px_36px_rgba(211,154,43,0.24)] transition hover:-translate-y-0.5 hover:bg-[#bb891f]"
                    >
                      {acquisition.primaryCta}
                      <ArrowRight className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => router.push("/demo")}
                      className="cerniq-button-secondary disabled:opacity-60"
                    >
                      {acquisition.proofCta}
                    </button>
                  </div>

                  <div className="mt-8 flex flex-wrap gap-3 text-sm">
                    <span className="cerniq-mini-stat">14-page board report</span>
                    <span className="cerniq-mini-stat">COSSEC 12-ratio engine</span>
                    <span className="cerniq-mini-stat">EN / ES bilingual</span>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* -- PLATFORM STATS BAR -- */}
          <section className="cerniq-panel py-4 px-6 sm:px-8">
            <div className="mx-auto grid max-w-5xl grid-cols-2 sm:grid-cols-4 gap-4 text-center">
              <div>
                <p className="text-3xl font-bold tabular-nums text-slate-950">
                  14
                </p>
                <p className="text-xs text-slate-500">
                  {t("Page Board Report", "Páginas de Informe")}
                </p>
              </div>
              <div>
                <p className="text-3xl font-bold tabular-nums text-slate-950">
                  12
                </p>
                <p className="text-xs text-slate-500">
                  {t("COSSEC Ratios", "Razones COSSEC")}
                </p>
              </div>
              <div>
                <p className="text-3xl font-bold tabular-nums text-slate-950">
                  &lt;5 min
                </p>
                <p className="text-xs text-slate-500">
                  {t("Upload to Report", "Carga a Informe")}
                </p>
              </div>
              <div>
                <p className="text-3xl font-bold tabular-nums text-slate-950">
                  EN/ES
                </p>
                <p className="text-xs text-slate-500">
                  {t("Bilingual Reports", "Informes Bilingües")}
                </p>
              </div>
            </div>
          </section>

          {/* -- SOCIAL PROOF BAR -- */}
          <section className="cerniq-panel py-3 px-6 sm:px-8">
            <div className="mx-auto flex max-w-4xl flex-col items-center gap-3 text-center sm:flex-row sm:justify-center sm:gap-8">
              <span className="text-sm font-semibold text-slate-700">
                {t("3 institutions in pilot", "3 instituciones en piloto")}
              </span>
              <span className="hidden h-4 w-px bg-slate-300 sm:block" />
              <span className="text-sm font-semibold text-slate-700">
                {t("$1.1B+ assets analyzed", "$1.1B+ en activos analizados")}
              </span>
              <span className="hidden h-4 w-px bg-slate-300 sm:block" />
              <span className="text-sm font-semibold text-slate-700">
                {t("12+ reports delivered", "12+ informes entregados")}
              </span>
            </div>
          </section>

          {/* -- PAIN / COST SECTION -- */}
          <section className="cerniq-panel cerniq-card-hover p-4 sm:p-6 lg:p-8">
            <div className="mx-auto max-w-4xl space-y-4">
              <div>
                <p className="cerniq-section-label">
                  {t("Cost Comparison", "Comparacion de costos")}
                </p>
                <h2 className="mt-3 font-display text-2xl text-slate-950 sm:text-3xl">
                  {t(
                    "How much does your institution spend on ALM analysis?",
                    "¿Cuanto gasta su institucion en analisis ALM?",
                  )}
                </h2>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-200">
                      <th className="py-2 pr-4 text-xs font-semibold uppercase tracking-wider text-slate-500" />
                      <th className="py-3 pr-4 text-xs font-semibold uppercase tracking-wider text-slate-500">
                        {t("Traditional Consultant", "Consultor tradicional")}
                      </th>
                      <th className="py-3 text-xs font-semibold uppercase tracking-wider text-cyan-700">
                        CERNIQ
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {costComparison.map((row) => (
                      <tr key={row.item} className="border-b border-slate-100">
                        <td className="py-2 pr-4 font-medium text-slate-700">
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

              <div className="rounded-2xl border border-emerald-200 bg-emerald-50/80 p-3 text-center">
                <p className="text-xs font-bold uppercase tracking-[0.24em] text-emerald-700">
                  {t("ESTIMATED SAVINGS: 83-93%", "AHORRO ESTIMADO: 83-93%")}
                </p>
              </div>
            </div>
          </section>

          {/* -- THREE FEATURES -- */}
          <section className="grid gap-4 sm:grid-cols-3">
            {/* Regulatory Compliance */}
            <a
              href="/compliance"
              className="cerniq-panel cerniq-card-hover p-4 block"
            >
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-cyan-200 bg-cyan-50">
                <ShieldCheck className="h-5 w-5 text-cyan-700" />
              </div>
              <p className="mt-3 font-display text-lg text-slate-950">
                {t("Regulatory Compliance", "Cumplimiento regulatorio")}
              </p>
              <p className="mt-2 text-sm leading-6 text-slate-700">
                {t(
                  "20 regulatory requirements covered across COSSEC, NCUA & Basel III.",
                  "20 requisitos regulatorios cubiertos en COSSEC, NCUA y Basel III.",
                )}
              </p>
              <span className="mt-2 inline-flex items-center text-xs text-cyan-700 font-medium">
                {t("View compliance matrix", "Ver matriz de cumplimiento")}{" "}
                <ChevronRight className="h-3 w-3 ml-1" />
              </span>
            </a>
            {/* Bilingual by Design */}
            <div className="cerniq-panel cerniq-card-hover p-4">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-cyan-200 bg-cyan-50">
                <Languages className="h-5 w-5 text-cyan-700" />
              </div>
              <p className="mt-3 font-display text-lg text-slate-950">
                {t("Bilingual by Design", "Bilingue por diseno")}
              </p>
              <p className="mt-2 text-sm leading-6 text-slate-700">
                {t(
                  "English and Spanish in the same report, board-ready for any audience.",
                  "Espanol e ingles en el mismo informe, listo para junta y regulador.",
                )}
              </p>
            </div>
            {/* 24-Hour Delivery */}
            <div className="cerniq-panel cerniq-card-hover p-4">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-cyan-200 bg-cyan-50">
                <Clock className="h-5 w-5 text-cyan-700" />
              </div>
              <p className="mt-3 font-display text-lg text-slate-950">
                {t("24-Hour Delivery", "Entrega en 24 horas")}
              </p>
              <p className="mt-2 text-sm leading-6 text-slate-700">
                {t(
                  "Complete ALM analysis ready before your next ALCO meeting.",
                  "Analisis ALM completo listo antes de su proximo comite ALCO.",
                )}
              </p>
            </div>
          </section>

          {/* -- QUANT ENGINE SHOWCASE -- */}
          <section className="cerniq-panel p-4 sm:p-6 lg:p-8">
            <div className="mx-auto max-w-5xl">
              <p className="cerniq-section-label">
                {t("Quant Engine", "Motor Cuantitativo")}
              </p>
              <h2 className="mt-3 font-display text-2xl text-slate-950 sm:text-3xl">
                {t(
                  "Best-in-class ALM models, credit union pricing",
                  "Modelos ALM de primer nivel, precio de cooperativa",
                )}
              </h2>
              <div className="mt-6 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {[
                  {
                    name: "Nelson-Siegel",
                    desc: t(
                      "Yield curve interpolation",
                      "Interpolación curva rendimiento",
                    ),
                  },
                  {
                    name: "Vasicek Monte Carlo",
                    desc: t(
                      "10K stochastic rate paths",
                      "10K senderos estocásticos",
                    ),
                  },
                  {
                    name: "Black-Litterman",
                    desc: t(
                      "Bayesian portfolio allocation",
                      "Asignación Bayesiana",
                    ),
                  },
                  {
                    name: "CVaR Optimizer",
                    desc: t(
                      "Rockafellar-Uryasev tail risk",
                      "Riesgo de cola R-U",
                    ),
                  },
                  {
                    name: "CreditMetrics",
                    desc: t(
                      "JP Morgan migration VaR",
                      "VaR migración JP Morgan",
                    ),
                  },
                  {
                    name: "KMV-Merton",
                    desc: t(
                      "Distance-to-Default structural",
                      "Distancia al incumplimiento",
                    ),
                  },
                  {
                    name: "FRTB Expected Shortfall",
                    desc: t(
                      "Basel III.1 market capital",
                      "Capital mercado Basel III.1",
                    ),
                  },
                  {
                    name: "HMM Regime Detection",
                    desc: t(
                      "Viterbi macro state machine",
                      "Máquina estados Viterbi",
                    ),
                  },
                  {
                    name: "PCA Yield Curve",
                    desc: t(
                      "3-factor decomposition",
                      "Descomposición 3 factores",
                    ),
                  },
                  {
                    name: "Copula Credit",
                    desc: t(
                      "Gaussian vs t-Student tail",
                      "Cola Gaussian vs t-Student",
                    ),
                  },
                  {
                    name: "NCUA RBC2",
                    desc: t(
                      "8-component risk capital",
                      "Capital riesgo 8 componentes",
                    ),
                  },
                  {
                    name: "CECL 3-Method",
                    desc: t(
                      "WARM + Vintage + PD×LGD",
                      "WARM + Vintage + PD×LGD",
                    ),
                  },
                ].map((m) => (
                  <div
                    key={m.name}
                    className="rounded-xl border border-slate-200 bg-white p-3"
                  >
                    <p className="text-xs font-bold text-slate-800">{m.name}</p>
                    <p className="text-[10px] text-slate-500 mt-0.5">
                      {m.desc}
                    </p>
                  </div>
                ))}
              </div>
              <p className="mt-4 text-center text-xs text-slate-500">
                {t(
                  "+ 22 more models across duration, liquidity, credit, and market risk",
                  "+ 22 modelos más en duración, liquidez, crédito y riesgo de mercado",
                )}
              </p>
            </div>
          </section>

          {/* -- HOW IT WORKS -- */}
          <section className="cerniq-panel cerniq-card-hover p-4 sm:p-6 lg:p-8">
            <div className="mx-auto max-w-4xl">
              <div>
                <p className="cerniq-section-label">
                  {t("How It Works", "Como funciona")}
                </p>
                <h2 className="mt-3 font-display text-2xl text-slate-950 sm:text-3xl">
                  {t(
                    "Upload CSV. CERNIQ Analyzes. Receive Bilingual PDF.",
                    "Cargue CSV. CERNIQ analiza. Reciba PDF bilingue.",
                  )}
                </h2>
              </div>

              <div className="mt-5 grid gap-4 sm:grid-cols-3">
                {/* Step 1 */}
                <div className="rounded-2xl border border-slate-200 bg-white/86 p-4 text-center">
                  <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-2xl border border-cyan-200 bg-cyan-50">
                    <Upload className="h-5 w-5 text-cyan-700" />
                  </div>
                  <p className="mt-2 text-xs font-bold uppercase tracking-[0.24em] text-slate-400">
                    {t("Step 1", "Paso 1")}
                  </p>
                  <h3 className="mt-1 font-display text-lg text-slate-950">
                    {t("Upload Your CSV", "Cargue su CSV")}
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    {t(
                      "Upload your institution balance sheet through a secure workflow.",
                      "Suba la hoja de balance de su institucion a traves de un flujo seguro.",
                    )}
                  </p>
                </div>
                {/* Step 2 */}
                <div className="rounded-2xl border border-slate-200 bg-white/86 p-4 text-center">
                  <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-2xl border border-cyan-200 bg-cyan-50">
                    <ShieldCheck className="h-5 w-5 text-cyan-700" />
                  </div>
                  <p className="mt-2 text-xs font-bold uppercase tracking-[0.24em] text-slate-400">
                    {t("Step 2", "Paso 2")}
                  </p>
                  <h3 className="mt-1 font-display text-lg text-slate-950">
                    {t("CERNIQ Analyzes", "CERNIQ analiza")}
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    {t(
                      "The platform validates the file, applies the ALM engine, and prepares the draft.",
                      "La plataforma valida el archivo, aplica el motor ALM y prepara el borrador.",
                    )}
                  </p>
                </div>
                {/* Step 3 */}
                <div className="rounded-2xl border border-slate-200 bg-white/86 p-4 text-center">
                  <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-2xl border border-cyan-200 bg-cyan-50">
                    <FileText className="h-5 w-5 text-cyan-700" />
                  </div>
                  <p className="mt-2 text-xs font-bold uppercase tracking-[0.24em] text-slate-400">
                    {t("Step 3", "Paso 3")}
                  </p>
                  <h3 className="mt-1 font-display text-lg text-slate-950">
                    {t("Receive Your Bilingual PDF", "Reciba su PDF bilingue")}
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    {t(
                      "A professional report in English and Spanish for management, committee, or regulator.",
                      "Un informe profesional en espanol e ingles para gerencia, comite o regulador.",
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
                <p className="cerniq-section-label">
                  {t("Walkthrough", "Demostracion")}
                </p>
                <h2 className="mt-3 font-display text-2xl text-slate-950 sm:text-3xl">
                  {t(
                    "See the upload-to-report workflow in action",
                    "Vea el flujo de carga a informe en accion",
                  )}
                </h2>
              </div>

              <div className="overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white">
                {hasVideo ? (
                  <div
                    className="w-full bg-slate-100"
                    style={{ aspectRatio: "16/9" }}
                  >
                    {isDirectVideoFile(DEMO_VIDEO_URL) ? (
                      <video
                        className="h-full w-full"
                        controls
                        preload="metadata"
                        playsInline
                        src={DEMO_VIDEO_URL}
                      />
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
                      {t(
                        "ALM walkthrough video coming soon",
                        "Video de demostracion ALM proximamente",
                      )}
                    </p>
                    <p className="max-w-2xl text-base leading-7 text-slate-600">
                      Add{" "}
                      <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-sm">
                        NEXT_PUBLIC_CERNIQ_DEMO_VIDEO_URL
                      </code>{" "}
                      once the upload-to-report walkthrough is ready.
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
                <p className="cerniq-section-label">
                  {t("Pricing", "Precios")}
                </p>
                <h2 className="mt-3 font-display text-2xl text-slate-950 sm:text-3xl">
                  {t(
                    "Start with a pilot. Upgrade to recurring access when the workflow is trusted.",
                    "Comience con un piloto. Active acceso recurrente cuando el flujo ya este validado.",
                  )}
                </h2>
              </div>

              <div className="grid gap-5 sm:grid-cols-3">
                {/* ALM Report - $750 */}
                <div className="cerniq-panel cerniq-card-hover flex flex-col p-5">
                  <p className="font-display text-xl text-slate-950">
                    {t("ALM Report", "Informe ALM")}
                  </p>
                  <div className="mt-4">
                    <span className="font-display text-4xl text-slate-950">
                      $750
                    </span>
                    <span className="ml-1 text-sm text-slate-500">
                      {t("one-time", "unico")}
                    </span>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-slate-600">
                    {t(
                      "One bilingual ALM report to validate the process with your institution.",
                      "Un informe ALM bilingue para validar el proceso con su institucion.",
                    )}
                  </p>
                  <div className="mt-5 flex-1 space-y-3">
                    <div className="flex items-center gap-2 text-sm text-slate-700">
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-cyan-700" />
                      {t("1 bilingual ALM report", "1 informe ALM bilingue")}
                    </div>
                    <div className="flex items-center gap-2 text-sm text-slate-700">
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-cyan-700" />
                      {t(
                        "Data review & guided setup",
                        "Revision de datos y setup guiado",
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-sm text-slate-700">
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-cyan-700" />
                      {t("Board-ready PDF", "PDF listo para junta")}
                    </div>
                  </div>
                  <button
                    onClick={() => handleCheckout("one_time")}
                    disabled={checkoutTier === "one_time"}
                    className="mt-6 w-full cerniq-button-secondary disabled:opacity-60"
                  >
                    {checkoutTier === "one_time"
                      ? t("Processing...", "Procesando...")
                      : getCtaLabel("one_time", lang)}
                  </button>
                </div>

                {/* Pilot — Bible-mandated $2,500/mo */}
                <div className="cerniq-panel cerniq-card-hover flex flex-col p-5 border-cyan-300/25 shadow-[0_20px_60px_rgba(34,211,238,0.12)]">
                  <span className="mb-3 w-fit rounded-full border border-cyan-200 bg-cyan-50 px-3 py-1 text-[11px] uppercase tracking-[0.26em] text-cyan-700">
                    {t("Recommended", "Recomendado")}
                  </span>
                  <p className="font-display text-xl text-slate-950">
                    {t(PRICING.PILOT.description, PRICING.PILOT.descriptionEs)}
                  </p>
                  <div className="mt-4">
                    <span className="font-display text-4xl text-slate-950">
                      {PRICING.PILOT.label}
                    </span>
                    <span className="ml-1 text-sm text-slate-500">
                      {t(PRICING.PILOT.cadence, PRICING.PILOT.cadenceEs)}
                    </span>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-slate-600">
                    {t(
                      "Full platform access. 90-day pilot, cancel anytime.",
                      "Acceso completo a la plataforma. Piloto de 90 dias, cancele en cualquier momento.",
                    )}
                  </p>
                  <div className="mt-5 flex-1 space-y-3">
                    {PRICING.PILOT.bullets.map((b) => (
                      <div key={b.en} className="flex items-center gap-2 text-sm text-slate-700">
                        <CheckCircle2 className="h-4 w-4 shrink-0 text-cyan-700" />
                        {t(b.en, b.es)}
                      </div>
                    ))}
                  </div>
                  <button
                    onClick={() => handleCheckout("monthly")}
                    disabled={checkoutTier === "monthly"}
                    className="mt-6 w-full cerniq-button-primary disabled:opacity-60"
                  >
                    {checkoutTier === "monthly"
                      ? t("Processing...", "Procesando...")
                      : getCtaLabel("monthly", lang)}
                  </button>
                </div>

                {/* Standard — Bible-mandated $3,500/mo annual contract */}
                <div className="cerniq-panel cerniq-card-hover flex flex-col p-5">
                  <p className="font-display text-xl text-slate-950">
                    {t(PRICING.STANDARD.description, PRICING.STANDARD.descriptionEs)}
                  </p>
                  <div className="mt-4">
                    <span className="font-display text-4xl text-slate-950">
                      {PRICING.STANDARD.label}
                    </span>
                    <span className="ml-1 text-sm text-slate-500">
                      {t(PRICING.STANDARD.cadence, PRICING.STANDARD.cadenceEs)}
                    </span>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-slate-600">
                    {t(
                      "Annual commitment with priority support and unlimited users.",
                      "Compromiso anual con soporte prioritario y usuarios ilimitados.",
                    )}
                  </p>
                  <div className="mt-5 flex-1 space-y-3">
                    {PRICING.STANDARD.bullets.map((b) => (
                      <div key={b.en} className="flex items-center gap-2 text-sm text-slate-700">
                        <CheckCircle2 className="h-4 w-4 shrink-0 text-cyan-700" />
                        {t(b.en, b.es)}
                      </div>
                    ))}
                  </div>
                  <button
                    onClick={() => handleCheckout("annual")}
                    disabled={checkoutTier === "annual"}
                    className="mt-6 w-full cerniq-button-secondary disabled:opacity-60"
                  >
                    {checkoutTier === "annual"
                      ? t("Processing...", "Procesando...")
                      : getCtaLabel("annual", lang)}
                  </button>
                </div>
              </div>
            </div>
          </section>

          {/* -- FAQ -- */}
          <section
            id="faq"
            className="cerniq-panel cerniq-card-hover p-6 sm:p-8 lg:p-10"
          >
            <div className="mx-auto max-w-4xl space-y-6">
              <div>
                <p className="cerniq-section-label">FAQ</p>
                <h2 className="mt-4 font-display text-3xl text-slate-950 sm:text-4xl">
                  {t("Frequently Asked Questions", "Preguntas frecuentes")}
                </h2>
              </div>

              <div className="space-y-3">
                {/* FAQ 1 */}
                <details className="group rounded-2xl border border-slate-200 bg-white/86">
                  <summary className="cursor-pointer list-none px-5 py-4 text-sm font-semibold text-slate-950 sm:text-base [&::-webkit-details-marker]:hidden">
                    <div className="flex items-center justify-between gap-4">
                      <span>
                        {t(
                          "What data do I need to generate a report?",
                          "¿Que datos necesito para generar un informe?",
                        )}
                      </span>
                      <ChevronRight className="h-4 w-4 shrink-0 text-slate-400 transition-transform group-open:rotate-90" />
                    </div>
                  </summary>
                  <div className="border-t border-slate-100 px-5 py-4">
                    <p className="text-sm leading-7 text-slate-700">
                      {t(
                        "You only need your balance sheet in CSV format. CERNIQ validates the file, identifies categories, and runs ALM calculations automatically. No proprietary templates required.",
                        "Solo necesita su hoja de balance en formato CSV. CERNIQ valida el archivo, identifica las categorias y ejecuta los calculos ALM automaticamente. No se requieren plantillas propietarias.",
                      )}
                    </p>
                  </div>
                </details>

                {/* FAQ 2 */}
                <details className="group rounded-2xl border border-slate-200 bg-white/86">
                  <summary className="cursor-pointer list-none px-5 py-4 text-sm font-semibold text-slate-950 sm:text-base [&::-webkit-details-marker]:hidden">
                    <div className="flex items-center justify-between gap-4">
                      <span>
                        {t(
                          "Does the report meet regulatory requirements?",
                          "¿El informe cumple con los requisitos regulatorios?",
                        )}
                      </span>
                      <ChevronRight className="h-4 w-4 shrink-0 text-slate-400 transition-transform group-open:rotate-90" />
                    </div>
                  </summary>
                  <div className="border-t border-slate-100 px-5 py-4">
                    <p className="text-sm leading-7 text-slate-700">
                      {t(
                        "Yes. The report includes 12 key ratios evaluated by COSSEC and NCUA, including duration gap, NII sensitivity, liquidity coverage, and stress scenarios. Designed for regulatory compliance across jurisdictions.",
                        "Si. El informe incluye los 12 ratios clave que COSSEC y NCUA evaluan, incluyendo gap de duracion, sensibilidad NII, cobertura de liquidez y escenarios de estres. Disenado para cumplimiento regulatorio en multiples jurisdicciones.",
                      )}
                    </p>
                  </div>
                </details>

                {/* FAQ 3 */}
                <details className="group rounded-2xl border border-slate-200 bg-white/86">
                  <summary className="cursor-pointer list-none px-5 py-4 text-sm font-semibold text-slate-950 sm:text-base [&::-webkit-details-marker]:hidden">
                    <div className="flex items-center justify-between gap-4">
                      <span>
                        {t(
                          "How long does it take to receive the report?",
                          "¿Cuanto tiempo toma recibir el informe?",
                        )}
                      </span>
                      <ChevronRight className="h-4 w-4 shrink-0 text-slate-400 transition-transform group-open:rotate-90" />
                    </div>
                  </summary>
                  <div className="border-t border-slate-100 px-5 py-4">
                    <p className="text-sm leading-7 text-slate-700">
                      {t(
                        "The report is delivered within 24 hours of uploading your file. Traditional consultants take 3 to 6 weeks and charge $8,000-$12,000 per engagement.",
                        "El informe se entrega en 24 horas desde que carga su archivo. Los consultores tradicionales toman de 3 a 6 semanas y cobran $8,000-$12,000 por compromiso.",
                      )}
                    </p>
                  </div>
                </details>

                {/* FAQ 4 */}
                <details className="group rounded-2xl border border-slate-200 bg-white/86">
                  <summary className="cursor-pointer list-none px-5 py-4 text-sm font-semibold text-slate-950 sm:text-base [&::-webkit-details-marker]:hidden">
                    <div className="flex items-center justify-between gap-4">
                      <span>
                        {t("Is my data secure?", "¿Mis datos estan seguros?")}
                      </span>
                      <ChevronRight className="h-4 w-4 shrink-0 text-slate-400 transition-transform group-open:rotate-90" />
                    </div>
                  </summary>
                  <div className="border-t border-slate-100 px-5 py-4">
                    <p className="text-sm leading-7 text-slate-700">
                      {t(
                        "Yes. Files are transmitted with TLS encryption, processed on isolated servers, and not shared with third parties. Data is deleted after report generation.",
                        "Si. Los archivos se transmiten con encriptacion TLS, se procesan en servidores aislados y no se comparten con terceros. Los datos se eliminan despues de generar el informe.",
                      )}
                    </p>
                  </div>
                </details>

                {/* FAQ 5 */}
                <details className="group rounded-2xl border border-slate-200 bg-white/86">
                  <summary className="cursor-pointer list-none px-5 py-4 text-sm font-semibold text-slate-950 sm:text-base [&::-webkit-details-marker]:hidden">
                    <div className="flex items-center justify-between gap-4">
                      <span>
                        {t(
                          "Can you generate reports for multiple institutions?",
                          "¿Pueden generar informes para multiples instituciones?",
                        )}
                      </span>
                      <ChevronRight className="h-4 w-4 shrink-0 text-slate-400 transition-transform group-open:rotate-90" />
                    </div>
                  </summary>
                  <div className="border-t border-slate-100 px-5 py-4">
                    <p className="text-sm leading-7 text-slate-700">
                      {t(
                        "Yes. Our annual plan and partner access are designed for CPA firms and consultancies serving multiple credit unions, cooperativas, or community banks.",
                        "Si. Nuestro plan anual y acceso de socios estan disenados para firmas CPA y consultoras que sirven a multiples credit unions, cooperativas o bancos comunitarios.",
                      )}
                    </p>
                  </div>
                </details>
              </div>
            </div>
          </section>

          {/* -- DEMO FORM -- */}
          <section
            id="pilot-intake"
            className="cerniq-panel cerniq-card-hover p-6 sm:p-8"
          >
            <p className="cerniq-section-label">
              {acquisition.pilotFormSectionLabel}
            </p>
            <h2 className="mt-4 font-display text-3xl text-slate-950 sm:text-4xl">
              {acquisition.pilotFormHeading}
            </h2>
            <p className="mt-4 max-w-3xl text-base leading-8 text-slate-600">
              {acquisition.pilotFormIntro}
            </p>

            <div className="mt-8">
              {submitted ? (
                <div className="rounded-[1.5rem] border border-emerald-300 bg-emerald-50 p-6 text-emerald-800">
                  <CheckCircle2 className="h-9 w-9 text-emerald-500" />
                  <h3 className="mt-4 font-display text-2xl">
                    {acquisition.pilotFormSuccessTitle}
                  </h3>
                  <p className="mt-3 text-sm leading-7 text-emerald-700">
                    {acquisition.pilotFormSuccessBody}
                  </p>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                  {/* Honeypot anti-spam */}
                  <div className="absolute -left-[9999px]" aria-hidden="true">
                    <input
                      type="text"
                      name="website"
                      tabIndex={-1}
                      autoComplete="off"
                      value={honeypot}
                      onChange={(e) => setHoneypot(e.target.value)}
                    />
                  </div>
                  {submitError ? (
                    <div
                      role="alert"
                      className="rounded-2xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700"
                    >
                      {submitError}
                    </div>
                  ) : null}

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label
                        htmlFor="landing-name"
                        className="mb-2 block text-xs uppercase tracking-[0.24em] text-slate-500"
                      >
                        {t("Name", "Nombre")}
                      </label>
                      <input
                        id="landing-name"
                        type="text"
                        placeholder="Maria Rodriguez"
                        className="cerniq-input"
                        value={name}
                        onChange={(event) => setName(event.target.value)}
                      />
                    </div>
                    <div>
                      <label
                        htmlFor="landing-email"
                        className="mb-2 block text-xs uppercase tracking-[0.24em] text-slate-500"
                      >
                        {t("Work Email", "Correo institucional")}
                      </label>
                      <input
                        id="landing-email"
                        type="email"
                        required
                        placeholder="maria@institution.com"
                        className="cerniq-input"
                        value={email}
                        onChange={(event) => setEmail(event.target.value)}
                      />
                    </div>
                  </div>

                  <div>
                    <label
                      htmlFor="landing-institution"
                      className="mb-2 block text-xs uppercase tracking-[0.24em] text-slate-500"
                    >
                      {t("Institution Name", "Nombre de institucion")}
                    </label>
                    <input
                      id="landing-institution"
                      type="text"
                      placeholder={t(
                        "Your institution name",
                        "Nombre de su institucion",
                      )}
                      className="cerniq-input"
                      value={institutionName}
                      onChange={(event) =>
                        setInstitutionName(event.target.value)
                      }
                    />
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="mb-2 block text-xs uppercase tracking-[0.24em] text-slate-500">
                        {t("Type", "Tipo")}
                      </label>
                      <select
                        className="cerniq-input"
                        value={institutionType}
                        onChange={(event) =>
                          setInstitutionType(event.target.value)
                        }
                      >
                        {institutionOptions.map((option) => (
                          <option
                            key={option.value || "default"}
                            value={option.value}
                            className="bg-white"
                          >
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="mb-2 block text-xs uppercase tracking-[0.24em] text-slate-500">
                        {t("Asset Range", "Rango de activos")}
                      </label>
                      <select
                        className="cerniq-input"
                        value={totalAssets}
                        onChange={(event) => setTotalAssets(event.target.value)}
                      >
                        {assetRanges.map((option) => (
                          <option
                            key={option.value || "default"}
                            value={option.value}
                            className="bg-white"
                          >
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-amber-500 px-6 py-3 text-sm font-semibold text-white shadow-lg transition hover:bg-amber-600 hover:-translate-y-0.5 disabled:opacity-60"
                  >
                    {loading
                      ? t("Submitting...", "Enviando...")
                      : acquisition.pilotFormSubmit}
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
                    "Start your pilot with one balance sheet upload.",
                    "Comience su piloto con una sola carga de balance.",
                  )}
                </h2>
                <p className="mt-5 max-w-2xl text-sm leading-8 text-slate-600 sm:text-base">
                  {acquisition.pilotPathDescription}{" "}
                  {t(
                    "Use the demo as proof, then move into the pilot when you are ready for real data.",
                    "Use el demo como prueba y luego pase al piloto cuando este listo para usar datos reales.",
                  )}
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                <button
                  onClick={() => router.push("/get-started")}
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-amber-500 px-6 py-3 text-sm font-semibold text-white shadow-lg transition hover:bg-amber-600 hover:-translate-y-0.5"
                >
                  {acquisition.primaryCta}
                </button>
                <button
                  onClick={() => router.push("/demo")}
                  className="cerniq-button-secondary disabled:opacity-60"
                >
                  {acquisition.proofCta}
                </button>
              </div>
            </div>
          </section>
        </main>

        <Footer t={t} />
      </div>
    </div>
  );
}
