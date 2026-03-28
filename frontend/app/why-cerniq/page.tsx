'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft, ArrowRight, CheckCircle2, Shield, Zap, DollarSign,
  Brain, Layers, Globe, ChevronRight, TrendingUp, Cpu, Users,
} from 'lucide-react';
import { CerniqMark } from '@/components/brand/CerniqLogo';

export default function WhyCerniqPage() {
  const [lang, setLang] = useState<'en' | 'es'>(() => {
    if (typeof window !== 'undefined') return (localStorage.getItem('cerniq_lang') as 'en' | 'es') || 'en';
    return 'en';
  });
  const t = (en: string, es: string) => lang === 'en' ? en : es;

  return (
    <div className="min-h-screen bg-white">
      <nav className="border-b border-slate-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/" className="text-slate-400 hover:text-slate-700"><ArrowLeft className="h-5 w-5" /></Link>
          <CerniqMark size="sm" />
          <div>
            <div className="font-display text-sm uppercase tracking-[0.4em] text-slate-950">CERNIQ</div>
            <div className="text-[10px] uppercase tracking-[0.36em] text-cyan-700/60">{t('Why CERNIQ', 'Por qué CERNIQ')}</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/demo" className="hidden sm:inline-flex rounded-full border border-amber-300 bg-amber-50 px-4 py-2 text-xs font-semibold text-amber-700 hover:bg-amber-100 transition">
            {t('Try Demo', 'Ver Demo')}
          </Link>
          <div className="flex items-center rounded-full border border-slate-200 text-xs">
            <button onClick={() => setLang('en')} className={`rounded-l-full px-2.5 py-1.5 font-semibold transition ${lang === 'en' ? 'bg-cyan-700 text-white' : 'text-slate-500'}`} aria-label="Switch to English" aria-pressed={lang === 'en'}>EN</button>
            <button onClick={() => setLang('es')} className={`rounded-r-full px-2.5 py-1.5 font-semibold transition ${lang === 'es' ? 'bg-cyan-700 text-white' : 'text-slate-500'}`} aria-label="Cambiar a Espanol" aria-pressed={lang === 'es'}>ES</button>
          </div>
        </div>
      </nav>

      <main className="max-w-5xl mx-auto px-6 py-12 space-y-12">
        {/* Hero */}
        <section className="text-center max-w-3xl mx-auto">
          <h1 className="text-4xl font-bold text-slate-950 leading-tight">
            {t('The ALM platform your examiner wishes you had', 'La plataforma ALM que su examinador desearía que tuviera')}
          </h1>
          <p className="mt-4 text-lg text-slate-600 leading-relaxed">
            {t(
              '62 analytical modules, 34 quant models, bilingual reporting — all for less than what you pay a consultant for one report.',
              '62 módulos analíticos, 34 modelos cuantitativos, informes bilingües — todo por menos de lo que paga a un consultor por un informe.'
            )}
          </p>
        </section>

        {/* Platform Numbers */}
        <section className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { value: '62', label: t('ALM Modules', 'Módulos ALM'), icon: Layers, color: 'cyan' },
            { value: '34', label: t('Quant Models', 'Modelos Quant'), icon: Cpu, color: 'violet' },
            { value: '142', label: t('API Endpoints', 'Endpoints API'), icon: Zap, color: 'amber' },
            { value: '$2,400', label: t('/year starting', '/año desde'), icon: DollarSign, color: 'emerald' },
          ].map((s) => (
            <div key={s.label} className={`rounded-xl border border-${s.color}-200 bg-${s.color}-50/50 p-5 text-center`}>
              <s.icon className={`h-5 w-5 text-${s.color}-600 mx-auto mb-2`} />
              <p className="text-3xl font-bold tabular-nums text-slate-950">{s.value}</p>
              <p className="text-xs text-slate-500 mt-1">{s.label}</p>
            </div>
          ))}
        </section>

        {/* 6 Reasons */}
        <section className="space-y-6">
          <h2 className="text-2xl font-bold text-slate-950 text-center">{t('6 reasons institutions choose CERNIQ', '6 razones por las que las instituciones eligen CERNIQ')}</h2>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[
              {
                icon: Shield,
                title: t('Exam-Ready Compliance', 'Cumplimiento Listo para Examen'),
                body: t(
                  '20 regulatory requirements mapped across COSSEC, NCUA, and Basel III. Your examiner sees structured, professional output — not spreadsheet screenshots.',
                  '20 requisitos regulatorios mapeados en COSSEC, NCUA y Basel III. Su examinador ve output estructurado y profesional — no capturas de pantalla de Excel.'
                ),
              },
              {
                icon: Cpu,
                title: t('Goldman-Grade Quant Engine', 'Motor Cuantitativo Nivel Goldman'),
                body: t(
                  'Nelson-Siegel yield curves, Vasicek Monte Carlo, CreditMetrics, KMV-Merton, FRTB Expected Shortfall, Black-Litterman — the same math used by the largest banks.',
                  'Curvas Nelson-Siegel, Monte Carlo Vasicek, CreditMetrics, KMV-Merton, FRTB Expected Shortfall, Black-Litterman — la misma matemática de los bancos más grandes.'
                ),
              },
              {
                icon: Globe,
                title: t('Bilingual Native', 'Bilingüe Nativo'),
                body: t(
                  'Every page, every report, every label in English and Spanish. Not translated after the fact — built bilingual from day one.',
                  'Cada página, cada informe, cada etiqueta en inglés y español. No traducido después — construido bilingüe desde el día uno.'
                ),
              },
              {
                icon: DollarSign,
                title: t('90% Cost Reduction', 'Reducción de Costos 90%'),
                body: t(
                  "Moody's charges $150K+/year. QRM charges $80K+. CERNIQ: $2,400/year for the same analytical depth. We automated what consultants do manually.",
                  "Moody's cobra $150K+/año. QRM cobra $80K+. CERNIQ: $2,400/año por la misma profundidad analítica. Automatizamos lo que los consultores hacen manualmente."
                ),
              },
              {
                icon: TrendingUp,
                title: t('PR-Specific Intelligence', 'Inteligencia Específica para PR'),
                body: t(
                  '94-institution deposit beta library, hurricane AAL (NOAA-calibrated), FEMA flood zone overlays, COSSEC 12-schedule compliance. Built for the Caribbean.',
                  'Biblioteca de beta de depósitos de 94 instituciones, AAL de huracanes (calibrado NOAA), capas de zonas de inundación FEMA, cumplimiento COSSEC 12 schedules. Construido para el Caribe.'
                ),
              },
              {
                icon: Brain,
                title: t('AI-Powered Analysis', 'Análisis Impulsado por IA'),
                body: t(
                  'Claude-powered AI advisor that understands your balance sheet. Ask questions in natural language, get instant ALCO-ready insights.',
                  'Asesor IA impulsado por Claude que entiende su hoja de balance. Haga preguntas en lenguaje natural, obtenga insights listos para ALCO.'
                ),
              },
            ].map((reason, i) => (
              <div key={i} className="rounded-xl border border-slate-200 p-5 hover:shadow-sm transition">
                <reason.icon className="h-6 w-6 text-cyan-600 mb-3" />
                <h3 className="text-sm font-bold text-slate-950 mb-2">{reason.title}</h3>
                <p className="text-xs text-slate-600 leading-relaxed">{reason.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Social Proof */}
        <section className="rounded-xl border border-slate-200 bg-slate-50 p-6 text-center">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">{t('Built in Puerto Rico, for the world', 'Construido en Puerto Rico, para el mundo')}</p>
          <div className="flex flex-wrap justify-center gap-6">
            {[
              { label: t('Institutions in pilot', 'Instituciones en piloto'), value: '3' },
              { label: t('Assets analyzed', 'Activos analizados'), value: '$1.1B+' },
              { label: t('Reports delivered', 'Informes entregados'), value: '12+' },
              { label: t('Uptime', 'Disponibilidad'), value: '99.9%' },
            ].map(s => (
              <div key={s.label}>
                <p className="text-xl font-bold text-slate-950 tabular-nums">{s.value}</p>
                <p className="text-[10px] text-slate-500">{s.label}</p>
              </div>
            ))}
          </div>
        </section>

        {/* CTAs */}
        <section className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link href="/demo" className="inline-flex items-center gap-2 rounded-xl bg-amber-500 px-8 py-4 text-sm font-semibold text-white shadow-lg hover:bg-amber-600 transition">
            {t('Try the Interactive Demo', 'Probar Demo Interactivo')} <ArrowRight className="h-4 w-4" />
          </Link>
          <Link href="/pricing" className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-8 py-4 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition">
            {t('View Pricing', 'Ver Precios')} <ChevronRight className="h-4 w-4" />
          </Link>
          <Link href="/compliance" className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-8 py-4 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition">
            {t('Compliance Matrix', 'Matriz Cumplimiento')} <Shield className="h-4 w-4" />
          </Link>
        </section>
      </main>
    </div>
  );
}
