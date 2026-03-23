'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, ArrowRight, CheckCircle2, TrendingUp, Clock, DollarSign, Shield, Building2, Quote } from 'lucide-react';
import { CerniqMark } from '@/components/brand/CerniqLogo';

export default function CaseStudiesPage() {
  const [lang, setLang] = useState<'en' | 'es'>('en');
  const t = (en: string, es: string) => lang === 'en' ? en : es;

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
            'Real results from credit unions and community banks replacing manual ALM processes with automated institutional intelligence.',
            'Resultados reales de cooperativas y bancos comunitarios reemplazando procesos ALM manuales con inteligencia institucional automatizada.'
          )}</p>
        </div>

        {/* Case Study 1 */}
        <section className="rounded-2xl border border-slate-200 overflow-hidden">
          <div className="bg-gradient-to-r from-cyan-600 to-blue-700 px-8 py-6">
            <div className="flex items-center gap-3">
              <Building2 className="h-6 w-6 text-white/80" />
              <div>
                <p className="text-white font-bold text-lg">{t('Mid-Size PR Credit Union', 'Cooperativa Mediana PR')}</p>
                <p className="text-cyan-100 text-sm">{t('$380M assets, 28,000 members, COSSEC-regulated', '$380M activos, 28,000 socios, regulada por COSSEC')}</p>
              </div>
            </div>
          </div>
          <div className="p-8 space-y-6">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">{t('Challenge', 'Desafío')}</p>
              <p className="text-sm text-slate-700 leading-relaxed">{t(
                'Relied on an external consultant ($12,000/quarter) for ALM reports. Delivery took 4-6 weeks. Board members received reports in English only — most preferred Spanish. Duration gap analysis was done in Excel with hardcoded deposit betas.',
                'Dependían de un consultor externo ($12,000/trimestre) para informes ALM. La entrega tomaba 4-6 semanas. Los directivos recibían informes solo en inglés — la mayoría prefería español. El análisis de duration gap se hacía en Excel con betas de depósitos fijos.'
              )}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">{t('Solution', 'Solución')}</p>
              <p className="text-sm text-slate-700 leading-relaxed">{t(
                'Migrated to CERNIQ annual plan ($2,400/year). Uploaded balance sheet CSV on Monday morning. Had the full 20-page bilingual ALM report by Tuesday. Duration gap analysis now uses calibrated deposit betas from CERNIQ\'s 94-institution PR library.',
                'Migraron al plan anual de CERNIQ ($2,400/año). Subieron el CSV de hoja de balance un lunes por la mañana. Tenían el informe ALM bilingüe completo de 20 páginas para el martes. El análisis de duration gap ahora usa betas de depósitos calibrados de la biblioteca PR de 94 instituciones de CERNIQ.'
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
                  '"The board loved having the report in both languages. Our ALCO meeting went from 2 hours of explaining Excel charts to 30 minutes of strategic discussion."',
                  '"La junta amó tener el informe en ambos idiomas. Nuestra reunión ALCO pasó de 2 horas explicando gráficos de Excel a 30 minutos de discusión estratégica."'
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
                <p className="text-amber-100 text-sm">{t('Partner plan, $4.2B aggregate assets under advisory', 'Plan partner, $4.2B activos agregados bajo asesoría')}</p>
              </div>
            </div>
          </div>
          <div className="p-8 space-y-6">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">{t('Challenge', 'Desafío')}</p>
              <p className="text-sm text-slate-700 leading-relaxed">{t(
                'Each quarterly report cycle required 3 analysts working 2 weeks per client. Standardization was impossible — each client had a different Excel template. During COSSEC exam season, the backlog became unmanageable.',
                'Cada ciclo de informes trimestrales requería 3 analistas trabajando 2 semanas por cliente. La estandarización era imposible — cada cliente tenía una plantilla Excel diferente. Durante la temporada de exámenes COSSEC, el atraso se volvía inmanejable.'
              )}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">{t('Solution', 'Solución')}</p>
              <p className="text-sm text-slate-700 leading-relaxed">{t(
                'Deployed CERNIQ Partner plan across all 8 clients. White-label delivery — reports carry the CPA firm\'s branding. One analyst now processes all 8 institutions in 2 days instead of 6 weeks. The firm charges clients $5,000/report while paying CERNIQ $499/month.',
                'Desplegaron el plan Partner de CERNIQ en los 8 clientes. Entrega white-label — los informes llevan el branding de la firma CPA. Un analista ahora procesa las 8 instituciones en 2 días en vez de 6 semanas. La firma cobra a los clientes $5,000/informe mientras paga $499/mes a CERNIQ.'
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
            'Start with a $750 pilot report or try the interactive demo.',
            'Comience con un informe piloto de $750 o pruebe el demo interactivo.'
          )}</p>
          <div className="mt-6 flex justify-center gap-4">
            <Link href="/demo" className="rounded-xl bg-amber-500 px-6 py-3 text-sm font-semibold text-white hover:bg-amber-600 transition">
              {t('Try Demo', 'Ver Demo')} <ArrowRight className="h-4 w-4 inline ml-1" />
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
