'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, ArrowRight, CheckCircle2, TrendingUp, Clock, DollarSign, Shield, Building2, Quote } from 'lucide-react';
import { CerniqMark } from '@/components/brand/CerniqLogo';
import { getAcquisitionCopy } from '@/lib/acquisition-copy';

export default function CaseStudiesPage() {
  const [lang, setLang] = useState<'en' | 'es'>(() => {
    if (typeof window !== 'undefined') return (localStorage.getItem('cerniq_lang') as 'en' | 'es') || 'en';
    return 'en';
  });
  const t = (en: string, es: string) => lang === 'en' ? en : es;
  const acquisition = getAcquisitionCopy(lang);

  return (
    <div className="min-h-screen bg-white">
      <nav className="border-b border-slate-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/" className="text-slate-400 hover:text-slate-700"><ArrowLeft className="h-5 w-5" /></Link>
          <CerniqMark size="sm" />
          <div>
            <div className="font-display text-sm uppercase tracking-[0.4em] text-slate-950">CERNIQ</div>
            <div className="text-[10px] uppercase tracking-[0.36em] text-cyan-700/60">{t('Case Studies', 'Casos de Estudio')}</div>
          </div>
        </div>
        <div className="flex items-center rounded-full border border-slate-200 text-xs">
          <button onClick={() => setLang('en')} className={`rounded-l-full px-2.5 py-1.5 font-semibold transition ${lang === 'en' ? 'bg-cyan-700 text-white' : 'text-slate-500'}`} aria-label="Switch to English" aria-pressed={lang === 'en'}>EN</button>
          <button onClick={() => setLang('es')} className={`rounded-r-full px-2.5 py-1.5 font-semibold transition ${lang === 'es' ? 'bg-cyan-700 text-white' : 'text-slate-500'}`} aria-label="Cambiar a Espanol" aria-pressed={lang === 'es'}>ES</button>
        </div>
      </nav>

      <main className="max-w-5xl mx-auto px-6 py-12 space-y-12">
        <div className="text-center max-w-3xl mx-auto">
          <h1 className="text-3xl font-bold text-slate-950">{t('How Institutions Use CERNIQ', 'Cómo las Instituciones Usan CERNIQ')}</h1>
          <p className="mt-3 text-slate-600">{t(
            'Real results from finance teams using CERNIQ to replace fragmented reporting, review, and delivery workflows with one institutional operating surface.',
            'Resultados reales de equipos financieros usando CERNIQ para reemplazar flujos fragmentados de reporte, revision y entrega con una sola superficie operativa institucional.'
          )}</p>
        </div>

        {/* Case Study 1 */}
        <section className="rounded-2xl border border-slate-200 overflow-hidden">
          <div className="bg-gradient-to-r from-cyan-600 to-blue-700 px-8 py-6">
            <div className="flex items-center gap-3">
              <Building2 className="h-6 w-6 text-white/80" />
              <div>
              <p className="text-white font-bold text-lg">{t('Mid-Size PR Credit Union', 'Cooperativa Mediana PR')}</p>
              <p className="text-cyan-100 text-sm">{t('$380M assets, treasury + ALCO workflow under strain', '$380M en activos, flujo de tesoreria + ALCO bajo presion')}</p>
              </div>
            </div>
          </div>
          <div className="p-8 space-y-6">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">{t('Challenge', 'Desafío')}</p>
              <p className="text-sm text-slate-700 leading-relaxed">{t(
                'The team had reporting, risk review, and board preparation spread across Excel, consultant cycles, and one-off commentary. Delivery took weeks, bilingual output was inconsistent, and the portfolio conversation lived outside the reporting packet.',
                'El equipo tenia reportes, revision de riesgo y preparacion para junta repartidos entre Excel, ciclos de consultoria y comentarios aislados. La entrega tomaba semanas, la salida bilingue era inconsistente y la conversacion de portafolio vivia fuera del paquete de reportes.'
              )}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">{t('Solution', 'Solución')}</p>
              <p className="text-sm text-slate-700 leading-relaxed">{t(
                'Migrated to CERNIQ as the institution command surface. Uploaded balance sheet data on Monday, reviewed treasury posture and committee output on Tuesday, and kept the discussion tied to one shared operating view instead of disconnected files.',
                'Migraron a CERNIQ como superficie de mando institucional. Subieron datos el lunes, revisaron postura de tesoreria y salida para comite el martes, y mantuvieron la discusion atada a una sola vista operativa en vez de archivos desconectados.'
              )}</p>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { icon: DollarSign, value: '$45,600', label: t('Annual savings', 'Ahorro anual'), color: 'emerald' },
                { icon: Clock, value: '96%', label: t('Time reduction', 'Reducción tiempo'), color: 'cyan' },
                { icon: Shield, value: '12/12', label: t('COSSEC ratios pass', 'Ratios COSSEC aprobados'), color: 'blue' },
                { icon: TrendingUp, value: '82/100', label: t('Risk score', 'Puntaje riesgo'), color: 'violet' },
              ].map(s => (
                <div key={s.label} className={`rounded-xl border border-${s.color}-200 bg-${s.color}-50/50 p-4 text-center`}>
                  <s.icon className={`h-5 w-5 text-${s.color}-600 mx-auto mb-1`} />
                  <p className="text-xl font-bold text-slate-950 tabular-nums">{s.value}</p>
                  <p className="text-[10px] text-slate-500">{s.label}</p>
                </div>
              ))}
            </div>
            <div className="rounded-xl bg-slate-50 p-5 flex gap-4">
              <Quote className="h-6 w-6 text-cyan-500 shrink-0 mt-1" />
              <div>
                <p className="text-sm text-slate-700 italic leading-relaxed">{t(
                  '"The board finally saw one clean operating story instead of a stack of disconnected explanations. CERNIQ shortened the prep work and improved the actual conversation."',
                  '"La junta por fin vio una sola historia operativa clara en vez de una pila de explicaciones desconectadas. CERNIQ redujo la preparacion y mejoro la conversacion real."'
                )}</p>
                <p className="mt-2 text-xs font-semibold text-slate-500">{t('— CFO, PR Credit Union ($380M)', '— CFO, Cooperativa PR ($380M)')}</p>
              </div>
            </div>
          </div>
        </section>

        {/* Case Study 2 */}
        <section className="rounded-2xl border border-slate-200 overflow-hidden">
          <div className="bg-gradient-to-r from-amber-500 to-orange-600 px-8 py-6">
            <div className="flex items-center gap-3">
              <Building2 className="h-6 w-6 text-white/80" />
              <div>
              <p className="text-white font-bold text-lg">{t('CPA Firm Serving 8 Credit Unions', 'Firma CPA Sirviendo 8 Cooperativas')}</p>
              <p className="text-amber-100 text-sm">{t('Partner workflow, $4.2B aggregate assets under advisory', 'Flujo partner, $4.2B en activos agregados bajo asesoria')}</p>
              </div>
            </div>
          </div>
          <div className="p-8 space-y-6">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">{t('Challenge', 'Desafío')}</p>
              <p className="text-sm text-slate-700 leading-relaxed">{t(
                'Each client engagement had its own reporting file set, delivery process, and review ritual. Standardization was weak, analyst time was expensive, and the firm had no clean institutional operating layer across clients.',
                'Cada engagement de cliente tenia su propio set de archivos, proceso de entrega y ritual de revision. La estandarizacion era debil, el tiempo analista era caro y la firma no tenia una capa operativa institucional limpia entre clientes.'
              )}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">{t('Solution', 'Solución')}</p>
              <p className="text-sm text-slate-700 leading-relaxed">{t(
                'Deployed CERNIQ across all 8 clients as the shared operating layer. White-label delivery stayed intact, but the real win was standardizing intake, review, and board-ready output under one workflow the firm could run repeatedly.',
                'Desplegaron CERNIQ en los 8 clientes como capa operativa compartida. La entrega white-label se mantuvo, pero la verdadera ganancia fue estandarizar ingreso, revision y salida lista para junta bajo un flujo repetible.'
              )}</p>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { icon: DollarSign, value: '$154K', label: t('Margin generated/yr', 'Margen generado/año'), color: 'amber' },
                { icon: Clock, value: '2 days', label: t('vs 6 weeks before', 'vs 6 semanas antes'), color: 'cyan' },
                { icon: Building2, value: '8', label: t('Institutions served', 'Instituciones servidas'), color: 'indigo' },
                { icon: CheckCircle2, value: '100%', label: t('On-time delivery', 'Entrega a tiempo'), color: 'emerald' },
              ].map(s => (
                <div key={s.label} className={`rounded-xl border border-${s.color}-200 bg-${s.color}-50/50 p-4 text-center`}>
                  <s.icon className={`h-5 w-5 text-${s.color}-600 mx-auto mb-1`} />
                  <p className="text-xl font-bold text-slate-950 tabular-nums">{s.value}</p>
                  <p className="text-[10px] text-slate-500">{s.label}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="rounded-xl border border-slate-800 bg-slate-900 p-8 text-center">
          <h2 className="text-2xl font-bold text-white">{t('Ready to see your own results?', '¿Listo para ver sus propios resultados?')}</h2>
          <p className="mt-2 text-slate-400">{t(
            'Start with the $750 pilot, then use the demo as supporting proof if you need to show the workflow internally.',
            'Comience con el piloto de $750 y use el demo como prueba de apoyo si necesita mostrar el flujo internamente.'
          )}</p>
          <div className="mt-6 flex justify-center gap-4">
            <Link href="/get-started" className="rounded-xl bg-amber-500 px-6 py-3 text-sm font-semibold text-white hover:bg-amber-600 transition">
              {acquisition.primaryCta} <ArrowRight className="h-4 w-4 inline ml-1" />
            </Link>
            <Link href="/demo" className="rounded-xl border border-white/20 px-6 py-3 text-sm font-semibold text-white hover:bg-white/5 transition">
              {acquisition.proofCta}
            </Link>
            <Link href="/roi" className="rounded-xl border border-white/20 px-6 py-3 text-sm font-semibold text-white hover:bg-white/5 transition">
              {t('Calculate ROI', 'Calcular ROI')}
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}
