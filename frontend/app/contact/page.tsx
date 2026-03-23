'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Send, CheckCircle2, Calendar, Mail, Building2 } from 'lucide-react';
import { CerniqMark } from '@/components/brand/CerniqLogo';

export default function ContactPage() {
  const [lang, setLang] = useState<'en' | 'es'>('en');
  const [form, setForm] = useState({ name: '', email: '', institution: '', assets: '', message: '' });
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const t = (en: string, es: string) => lang === 'en' ? en : es;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const NODE = (process.env.NEXT_PUBLIC_NODE_API_URL || '').trim().replace(/\/+$/, '');
      await fetch(`${NODE}/api/leads/demo-request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: form.email,
          name: form.name,
          institutionName: form.institution,
          totalAssets: form.assets,
          message: form.message,
          source: 'contact_page',
        }),
      });
    } catch {
      // Always show success to prevent information leakage
    }
    setSubmitted(true);
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-white">
      <nav className="border-b border-slate-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/" className="text-slate-400 hover:text-slate-700"><ArrowLeft className="h-5 w-5" /></Link>
          <CerniqMark size="sm" />
          <div>
            <div className="font-display text-sm uppercase tracking-[0.4em] text-slate-950">CERNIQ</div>
            <div className="text-[10px] uppercase tracking-[0.36em] text-cyan-700/60">{t('Book a Demo', 'Agendar Demo')}</div>
          </div>
        </div>
        <div className="flex items-center rounded-full border border-slate-200 text-xs">
          <button onClick={() => setLang('en')} className={`rounded-l-full px-2.5 py-1.5 font-semibold transition ${lang === 'en' ? 'bg-cyan-700 text-white' : 'text-slate-500'}`}>EN</button>
          <button onClick={() => setLang('es')} className={`rounded-r-full px-2.5 py-1.5 font-semibold transition ${lang === 'es' ? 'bg-cyan-700 text-white' : 'text-slate-500'}`}>ES</button>
        </div>
      </nav>

      <main className="max-w-5xl mx-auto px-6 py-12">
        <div className="grid lg:grid-cols-2 gap-12">
          {/* Left: Info */}
          <div className="space-y-8">
            <div>
              <h1 className="text-3xl font-bold text-slate-950">{t('Book a Personalized Demo', 'Agende un Demo Personalizado')}</h1>
              <p className="mt-3 text-slate-600 leading-relaxed">{t(
                "We'll pre-load your institution's profile so you can see real outputs — not generic slides. 20 minutes, no commitment.",
                'Pre-cargaremos el perfil de su institución para que vea resultados reales — no diapositivas genéricas. 20 minutos, sin compromiso.'
              )}</p>
            </div>

            <div className="space-y-4">
              {[
                { icon: Calendar, title: t('20-Minute Walkthrough', 'Recorrido de 20 Minutos'), desc: t('See your institution\'s data in CERNIQ — duration gap, NII sensitivity, CAMEL score, and stress tests with your real numbers.', 'Vea los datos de su institución en CERNIQ — brecha de duración, sensibilidad NII, puntaje CAMEL y pruebas de estrés con sus números reales.') },
                { icon: Building2, title: t('Pre-Loaded Profile', 'Perfil Pre-Cargado'), desc: t('We pull your 5300 Call Report or COSSEC data automatically. No manual upload needed for the demo.', 'Extraemos automáticamente su Call Report 5300 o datos COSSEC. No necesita cargar datos manualmente para el demo.') },
                { icon: Mail, title: t('Sample Report Included', 'Informe de Muestra Incluido'), desc: t('After the call, receive a watermarked sample ALM report for your institution — free, no strings attached.', 'Después de la llamada, reciba un informe ALM de muestra con marca de agua para su institución — gratis, sin compromisos.') },
              ].map((item, i) => (
                <div key={i} className="flex gap-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-cyan-200 bg-cyan-50">
                    <item.icon className="h-5 w-5 text-cyan-700" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-800">{item.title}</p>
                    <p className="text-xs text-slate-500 leading-relaxed mt-0.5">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-5">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">{t('Direct Contact', 'Contacto Directo')}</p>
              <p className="text-sm text-slate-700">Erwin Kiess-Alfonso</p>
              <p className="text-sm text-slate-500">Founder, KLYTICS LLC</p>
              <a href="mailto:erwin@cerniq.io" className="text-sm text-cyan-600 hover:text-cyan-800 mt-1 block">erwin@cerniq.io</a>
            </div>
          </div>

          {/* Right: Form */}
          <div>
            {submitted ? (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-10 text-center">
                <CheckCircle2 className="h-12 w-12 text-emerald-500 mx-auto mb-4" />
                <h2 className="text-xl font-bold text-slate-950">{t('Request Received', 'Solicitud Recibida')}</h2>
                <p className="mt-2 text-sm text-slate-600">{t(
                  "We'll get back to you within 24 hours with a pre-loaded demo link for your institution.",
                  'Le responderemos dentro de 24 horas con un enlace de demo pre-cargado para su institución.'
                )}</p>
                <div className="mt-6 flex justify-center gap-3">
                  <Link href="/demo" className="rounded-xl bg-cyan-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-cyan-700 transition">
                    {t('Try Interactive Demo Now', 'Probar Demo Interactivo Ahora')}
                  </Link>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="rounded-2xl border border-slate-200 p-6 space-y-4">
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 block mb-1.5">{t('Your Name', 'Su Nombre')}</label>
                  <input type="text" required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                    className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm focus:border-cyan-400 focus:ring-1 focus:ring-cyan-300 outline-none"
                    placeholder={t('John Rivera', 'Juan Rivera')} />
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 block mb-1.5">{t('Work Email', 'Email Laboral')}</label>
                  <input type="email" required value={form.email} onChange={e => setForm({ ...form, email: e.target.value })}
                    className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm focus:border-cyan-400 focus:ring-1 focus:ring-cyan-300 outline-none"
                    placeholder="name@institution.com" />
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 block mb-1.5">{t('Institution Name', 'Nombre Institución')}</label>
                  <input type="text" required value={form.institution} onChange={e => setForm({ ...form, institution: e.target.value })}
                    className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm focus:border-cyan-400 focus:ring-1 focus:ring-cyan-300 outline-none"
                    placeholder={t('Cooperativa Oriental', 'Cooperativa Oriental')} />
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 block mb-1.5">{t('Asset Size', 'Tamaño de Activos')}</label>
                  <select value={form.assets} onChange={e => setForm({ ...form, assets: e.target.value })}
                    className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm focus:border-cyan-400 focus:ring-1 focus:ring-cyan-300 outline-none">
                    <option value="">{t('Select range', 'Seleccione rango')}</option>
                    <option value="< $100M">&lt; $100M</option>
                    <option value="$100M - $500M">$100M - $500M</option>
                    <option value="$500M - $1B">$500M - $1B</option>
                    <option value="$1B - $5B">$1B - $5B</option>
                    <option value="$5B+">$5B+</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 block mb-1.5">{t('Message (optional)', 'Mensaje (opcional)')}</label>
                  <textarea value={form.message} onChange={e => setForm({ ...form, message: e.target.value })} rows={3}
                    className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm focus:border-cyan-400 focus:ring-1 focus:ring-cyan-300 outline-none resize-none"
                    placeholder={t('Interested in CECL compliance and stress testing...', 'Interesado en cumplimiento CECL y pruebas de estrés...')} />
                </div>
                <button type="submit" disabled={loading}
                  className="w-full rounded-xl bg-amber-500 py-3.5 text-sm font-semibold text-white hover:bg-amber-600 transition disabled:opacity-50 flex items-center justify-center gap-2">
                  {loading ? t('Sending...', 'Enviando...') : <><Send className="h-4 w-4" /> {t('Request Demo', 'Solicitar Demo')}</>}
                </button>
                <p className="text-[10px] text-slate-400 text-center">{t('No credit card required. We respond within 24 hours.', 'Sin tarjeta de crédito. Respondemos en 24 horas.')}</p>
              </form>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
