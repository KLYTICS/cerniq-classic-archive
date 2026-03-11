'use client';

import { useState } from 'react';
import Link from 'next/link';
import { CheckCircle, ArrowLeft, Shield, Star, Zap, Building2 } from 'lucide-react';

const NODE_API_URL = (process.env.NEXT_PUBLIC_NODE_API_URL || '').trim().replace(/\/+$/, '');

const TIERS = [
  {
    id: 'one_time',
    name: 'Informe ALM',
    nameEn: 'ALM Report',
    price: '$750',
    period: 'único / one-time',
    badge: null,
    icon: Zap,
    iconColor: 'text-amber-400',
    borderColor: 'border-amber-500/30',
    features: [
      'Informe ALM completo (ES + EN)',
      'COSSEC: 12 ratios con cumplimiento',
      'Stress test: +100, +200, +300 bps',
      'PDF listo para junta directiva',
      'Entrega en 2 días hábiles',
    ],
    cta: 'Comenzar — $750',
    ctaClass: 'bg-amber-500 hover:bg-amber-400 text-slate-900',
  },
  {
    id: 'monthly',
    name: 'Plataforma Mensual',
    nameEn: 'Monthly Platform',
    price: '$299',
    period: '/mes · /month',
    badge: { text: 'MÁS POPULAR', color: 'bg-[#18C87A]' },
    icon: Star,
    iconColor: 'text-[#18C87A]',
    borderColor: 'border-[#18C87A]/40',
    features: [
      'Todos los módulos activos',
      'Informes ilimitados',
      'Dashboard ALM en tiempo real',
      'Alertas de entorno de tasas',
      'Monitoreo COSSEC continuo',
      'Datos de mercado en vivo',
    ],
    cta: 'Suscribirse — $299/mes',
    ctaClass: 'bg-[#18C87A] hover:bg-[#18C87A]/90 text-slate-900',
  },
  {
    id: 'annual',
    name: 'Paquete Anual',
    nameEn: 'Annual Package',
    price: '$2,400',
    period: '/año · $200/mes',
    badge: { text: 'MEJOR VALOR', color: 'bg-amber-500' },
    icon: Shield,
    iconColor: 'text-amber-400',
    borderColor: 'border-amber-500/30',
    features: [
      'Todo en Plataforma Mensual',
      'Soporte prioritario',
      'Benchmark trimestral vs sector PR',
      'Paquete ALCO para junta directiva',
      'Ahorre $1,188/año vs mensual',
    ],
    cta: 'Suscribirse — $2,400/año',
    ctaClass: 'bg-amber-500 hover:bg-amber-400 text-slate-900',
  },
  {
    id: 'partner',
    name: 'Acceso Partner',
    nameEn: 'Partner Access',
    price: '$499',
    period: '/mes · para firmas CPA',
    badge: null,
    icon: Building2,
    iconColor: 'text-[#1ABFFF]',
    borderColor: 'border-[#1ABFFF]/30',
    features: [
      'Dashboard multi-cliente',
      'Exportación white-label',
      'Portal para partners',
      'Precios por volumen',
      'Informes con su marca',
    ],
    cta: 'Contactar — $499/mes',
    ctaClass: 'bg-[#1ABFFF]/20 hover:bg-[#1ABFFF]/30 text-[#1ABFFF] border border-[#1ABFFF]/30',
  },
] as const;

export default function PricingPage() {
  const [loadingTier, setLoadingTier] = useState<string | null>(null);

  async function handleCheckout(tier: string) {
    setLoadingTier(tier);
    try {
      const res = await fetch(`${NODE_API_URL}/api/billing/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tier,
          successUrl: '/portal?welcome=1',
          cancelUrl: '/pricing',
        }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      }
    } catch {
      // Fall back to landing page checkout if API fails
      window.location.href = '/#pricing';
    } finally {
      setLoadingTier(null);
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* Header */}
      <div className="border-b border-white/[0.06] bg-slate-900/70">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center gap-3">
          <Link href="/" className="text-slate-500 hover:text-white transition">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div className="w-8 h-8 bg-gradient-to-br from-amber-400 to-orange-500 rounded-lg flex items-center justify-center">
            <span className="text-slate-900 font-bold text-sm">C</span>
          </div>
          <span className="text-sm font-semibold tracking-wide">CERNIQ</span>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-16">
        {/* Heading */}
        <div className="text-center mb-4">
          <h1 className="text-3xl font-bold mb-3">
            Planes y Precios
          </h1>
          <p className="text-slate-400 text-sm max-w-lg mx-auto">
            Inteligencia de riesgo institucional para cooperativas y bancos comunitarios de Puerto Rico.
          </p>
          <p className="text-slate-500 text-xs mt-1">
            Institutional risk intelligence for PR cooperativas and community banks.
          </p>
        </div>

        {/* ROI Banner */}
        <div className="max-w-2xl mx-auto mb-12 bg-[#1B3A6B]/20 border border-[#1B3A6B]/40 rounded-xl px-6 py-4 text-center">
          <p className="text-sm text-slate-300">
            Su institución gasta <span className="text-amber-400 font-semibold">$13,900–$33,000/año</span> en consultores ALM, terminales de datos, y auditorías manuales.
          </p>
          <p className="text-xs text-slate-500 mt-1">
            CERNIQ reemplaza todo eso desde $2,400/año — <span className="text-[#18C87A]">ahorro del 83–93%</span>.
          </p>
        </div>

        {/* Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {TIERS.map((tier) => {
            const Icon = tier.icon;
            return (
              <div
                key={tier.id}
                className={`bg-slate-900/60 border-2 ${tier.borderColor} rounded-2xl p-6 relative flex flex-col`}
              >
                {tier.badge && (
                  <div className="absolute -top-3 left-5">
                    <span className={`${tier.badge.color} text-slate-900 text-[10px] font-bold uppercase tracking-wider px-3 py-1 rounded-full`}>
                      {tier.badge.text}
                    </span>
                  </div>
                )}

                <div className="flex items-center gap-2 mb-4">
                  <Icon className={`h-5 w-5 ${tier.iconColor}`} />
                  <div>
                    <h2 className="text-lg font-bold">{tier.name}</h2>
                    <p className="text-[11px] text-slate-500">{tier.nameEn}</p>
                  </div>
                </div>

                <div className="flex items-baseline gap-1 mb-1">
                  <span className="text-3xl font-bold">{tier.price}</span>
                  <span className="text-slate-400 text-xs">{tier.period}</span>
                </div>

                <ul className="space-y-2.5 my-6 flex-1">
                  {tier.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm text-slate-300">
                      <CheckCircle className={`h-4 w-4 ${tier.iconColor} shrink-0 mt-0.5`} />
                      {f}
                    </li>
                  ))}
                </ul>

                <button
                  onClick={() => handleCheckout(tier.id)}
                  disabled={loadingTier === tier.id}
                  className={`w-full text-center font-semibold py-3 rounded-lg transition text-sm disabled:opacity-60 ${tier.ctaClass}`}
                >
                  {loadingTier === tier.id ? 'Cargando...' : tier.cta}
                </button>
              </div>
            );
          })}
        </div>

        {/* Trust */}
        <div className="text-center mt-12 space-y-2">
          <div className="flex items-center justify-center gap-4 text-[11px] text-slate-600">
            <span className="flex items-center gap-1"><Shield className="h-3 w-3" /> COSSEC Compliant</span>
            <span>·</span>
            <span>Hecho en Puerto Rico</span>
            <span>·</span>
            <span>OCIF Aware</span>
          </div>
          <p className="text-[10px] text-slate-700">
            ¿Preguntas? hello@cerniq.io · KLYTICS LLC · San Juan, Puerto Rico
          </p>
        </div>
      </div>
    </div>
  );
}
