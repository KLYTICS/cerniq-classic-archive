'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { CerniqMark } from '@/components/brand/CerniqLogo';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, LineChart, Line } from 'recharts';
import { Shield, TrendingUp, AlertTriangle, CheckCircle2, Download } from 'lucide-react';
import { usePDFExport } from '@/hooks/usePDFExport';

// Pre-built institution previews for top prospects
const INSTITUTION_DATA: Record<string, {
  name: string; nameEs: string; assets: number; location: string;
  capitalRatio: number; loanToShare: number; lcr: number; nim: number;
  durationGap: number; niiSensitivity: number; camelScore: number;
  niiTrend: Array<{ quarter: string; nii: number; peer: number }>;
  rateShock: Array<{ scenario: string; niiChange: number; eveChange: number }>;
}> = {
  'cooperativa-oriental': {
    name: 'Cooperativa de Ahorro y Credito Oriental', nameEs: 'Cooperativa Oriental',
    assets: 1200, location: 'Humacao, PR', capitalRatio: 10.1, loanToShare: 68.4,
    lcr: 118, nim: 3.62, durationGap: 1.8, niiSensitivity: -4.2, camelScore: 2,
    niiTrend: [
      { quarter: 'Q1-25', nii: 10.2, peer: 9.8 }, { quarter: 'Q2-25', nii: 10.5, peer: 9.9 },
      { quarter: 'Q3-25', nii: 10.8, peer: 10.1 }, { quarter: 'Q4-25', nii: 10.4, peer: 10.0 },
      { quarter: 'Q1-26', nii: 10.9, peer: 10.2 }, { quarter: 'Q2-26', nii: 11.1, peer: 10.3 },
    ],
    rateShock: [
      { scenario: '+200 bps', niiChange: -4.2, eveChange: -8.1 },
      { scenario: '+100 bps', niiChange: -2.1, eveChange: -4.3 },
      { scenario: '-100 bps', niiChange: 1.8, eveChange: 3.5 },
      { scenario: '-200 bps', niiChange: 3.2, eveChange: 6.8 },
    ],
  },
  'cooperativa-caguas': {
    name: 'Cooperativa de Ahorro y Credito de Caguas', nameEs: 'Cooperativa Caguas',
    assets: 2800, location: 'Caguas, PR', capitalRatio: 11.3, loanToShare: 72.1,
    lcr: 125, nim: 3.48, durationGap: 2.1, niiSensitivity: -5.1, camelScore: 2,
    niiTrend: [
      { quarter: 'Q1-25', nii: 24.1, peer: 9.8 }, { quarter: 'Q2-25', nii: 24.8, peer: 9.9 },
      { quarter: 'Q3-25', nii: 25.2, peer: 10.1 }, { quarter: 'Q4-25', nii: 24.6, peer: 10.0 },
      { quarter: 'Q1-26', nii: 25.5, peer: 10.2 }, { quarter: 'Q2-26', nii: 25.9, peer: 10.3 },
    ],
    rateShock: [
      { scenario: '+200 bps', niiChange: -5.1, eveChange: -9.4 },
      { scenario: '+100 bps', niiChange: -2.6, eveChange: -4.8 },
      { scenario: '-100 bps', niiChange: 2.2, eveChange: 4.1 },
      { scenario: '-200 bps', niiChange: 3.8, eveChange: 7.6 },
    ],
  },
  'cooperativa-bayamon': {
    name: 'Cooperativa de Ahorro y Credito de Bayamon', nameEs: 'Cooperativa Bayamon',
    assets: 950, location: 'Bayamon, PR', capitalRatio: 9.4, loanToShare: 75.3,
    lcr: 108, nim: 3.78, durationGap: 1.5, niiSensitivity: -3.8, camelScore: 2,
    niiTrend: [
      { quarter: 'Q1-25', nii: 8.9, peer: 9.8 }, { quarter: 'Q2-25', nii: 9.1, peer: 9.9 },
      { quarter: 'Q3-25', nii: 9.4, peer: 10.1 }, { quarter: 'Q4-25', nii: 9.2, peer: 10.0 },
      { quarter: 'Q1-26', nii: 9.6, peer: 10.2 }, { quarter: 'Q2-26', nii: 9.8, peer: 10.3 },
    ],
    rateShock: [
      { scenario: '+200 bps', niiChange: -3.8, eveChange: -7.2 },
      { scenario: '+100 bps', niiChange: -1.9, eveChange: -3.7 },
      { scenario: '-100 bps', niiChange: 1.5, eveChange: 2.9 },
      { scenario: '-200 bps', niiChange: 2.8, eveChange: 5.6 },
    ],
  },
};

const COLORS = { green: '#10b981', amber: '#f59e0b', red: '#ef4444', cyan: '#0e7490', slate: '#475569' };

export default function InstitutionPreview() {
  const params = useParams();
  const slug = params.institution as string;
  const [lang, setLang] = useState<'en' | 'es'>('es');
  const { exportToPDF, isExporting } = usePDFExport();
  const t = (en: string, es: string) => lang === 'en' ? en : es;

  const inst = INSTITUTION_DATA[slug];
  if (!inst) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center">
          <AlertTriangle className="h-12 w-12 text-amber-500 mx-auto mb-4" />
          <h1 className="text-lg font-bold text-slate-950">Institution not found</h1>
          <p className="text-sm text-slate-500 mt-2">Available: cooperativa-oriental, cooperativa-caguas, cooperativa-bayamon</p>
        </div>
      </div>
    );
  }

  const camelColor = inst.camelScore <= 2 ? COLORS.green : inst.camelScore <= 3 ? COLORS.amber : COLORS.red;

  return (
    <div className="min-h-screen bg-white">
      {/* Controls bar — hidden in PDF */}
      <div className="print:hidden border-b border-slate-200 px-6 py-3 flex items-center justify-between bg-slate-50">
        <div className="flex items-center gap-3">
          <CerniqMark size="sm" />
          <span className="text-sm font-bold text-slate-950">CERNIQ</span>
          <span className="text-xs text-slate-400">|</span>
          <span className="text-xs text-slate-500">{t('Sample Report Preview', 'Vista Previa del Informe')}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center rounded-full border border-slate-200 text-xs">
            <button onClick={() => setLang('en')} className={`rounded-l-full px-2.5 py-1.5 font-semibold transition ${lang === 'en' ? 'bg-cyan-700 text-white' : 'text-slate-500'}`} aria-label="Switch to English" aria-pressed={lang === 'en'}>EN</button>
            <button onClick={() => setLang('es')} className={`rounded-r-full px-2.5 py-1.5 font-semibold transition ${lang === 'es' ? 'bg-cyan-700 text-white' : 'text-slate-500'}`} aria-label="Cambiar a Espanol" aria-pressed={lang === 'es'}>ES</button>
          </div>
          <button onClick={() => exportToPDF({ elementId: 'report-preview', filename: `CERNIQ_Preview_${inst.nameEs}.pdf` })} disabled={isExporting}
            className="flex items-center gap-1.5 rounded-lg bg-amber-500 px-3 py-2 text-xs font-semibold text-white hover:bg-amber-600 disabled:opacity-50 transition">
            <Download className="h-3.5 w-3.5" />
            {isExporting ? 'Generating...' : 'PDF'}
          </button>
        </div>
      </div>

      {/* Report content */}
      <div id="report-preview" className="max-w-4xl mx-auto px-8 py-10">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-slate-200 pb-6 mb-8">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <CerniqMark size="sm" />
              <span className="font-display text-xs uppercase tracking-[0.3em] text-slate-400">CERNIQ ALM Intelligence</span>
            </div>
            <h1 className="text-2xl font-bold text-slate-950">{t('ALM Report Preview', 'Vista Previa — Informe ALM')}</h1>
            <p className="text-lg font-semibold text-cyan-700 mt-1">{inst.name}</p>
            <p className="text-sm text-slate-500">{inst.location} | ${inst.assets}M {t('in assets', 'en activos')} | {new Date().toLocaleDateString(lang === 'es' ? 'es-PR' : 'en-US', { year: 'numeric', month: 'long' })}</p>
          </div>
          <div className="text-right">
            <div className="inline-flex items-center gap-2 rounded-full border px-3 py-1.5" style={{ borderColor: camelColor }}>
              <Shield className="h-4 w-4" style={{ color: camelColor }} />
              <span className="text-sm font-bold" style={{ color: camelColor }}>CAMEL {inst.camelScore}</span>
            </div>
            <p className="text-[10px] text-slate-400 mt-1">{t('Composite Score', 'Puntaje Compuesto')}</p>
          </div>
        </div>

        {/* KPI Grid */}
        <div className="grid grid-cols-3 md:grid-cols-6 gap-3 mb-8">
          {[
            { label: t('Capital Ratio', 'Ratio Capital'), value: `${inst.capitalRatio}%`, benchmark: '9.2%', ok: inst.capitalRatio >= 7 },
            { label: t('Loan/Share', 'Prest/Acciones'), value: `${inst.loanToShare}%`, benchmark: '72.5%', ok: inst.loanToShare <= 85 },
            { label: 'LCR', value: `${inst.lcr}%`, benchmark: '100%', ok: inst.lcr >= 100 },
            { label: 'NIM', value: `${inst.nim}%`, benchmark: '3.8%', ok: inst.nim >= 3.0 },
            { label: t('Duration Gap', 'Brecha Duracion'), value: `${inst.durationGap}yr`, benchmark: '<3yr', ok: inst.durationGap <= 3 },
            { label: t('NII Sensitivity', 'Sensibilidad NII'), value: `${inst.niiSensitivity}%`, benchmark: '<-5%', ok: inst.niiSensitivity > -5 },
          ].map(kpi => (
            <div key={kpi.label} className="rounded-lg border border-slate-200 p-2.5 text-center">
              <p className="text-[9px] font-medium uppercase text-slate-400 mb-1">{kpi.label}</p>
              <p className="text-lg font-bold tabular-nums text-slate-950">{kpi.value}</p>
              <div className="flex items-center justify-center gap-1 mt-1">
                {kpi.ok ? <CheckCircle2 className="h-3 w-3 text-emerald-500" /> : <AlertTriangle className="h-3 w-3 text-amber-500" />}
                <span className="text-[9px] text-slate-400">{t('Median', 'Mediana')}: {kpi.benchmark}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <div className="rounded-xl border border-slate-200 p-4">
            <h3 className="text-sm font-bold text-slate-950 mb-3">{t('NII Trend vs. Sector Median ($M)', 'Tendencia NII vs. Mediana Sector ($M)')}</h3>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={inst.niiTrend}>
                <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.3} />
                <XAxis dataKey="quarter" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip />
                <Line type="monotone" dataKey="nii" name={inst.nameEs} stroke={COLORS.cyan} strokeWidth={2} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="peer" name={t('Sector Median', 'Mediana Sector')} stroke={COLORS.slate} strokeWidth={1.5} strokeDasharray="4 3" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="rounded-xl border border-slate-200 p-4">
            <h3 className="text-sm font-bold text-slate-950 mb-3">{t('Rate Shock Impact (NII %)', 'Impacto Shock de Tasas (NII %)')}</h3>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={inst.rateShock}>
                <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.3} />
                <XAxis dataKey="scenario" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} tickFormatter={(v: number) => `${v}%`} />
                <Tooltip formatter={(v: any) => `${v}%`} />
                <Bar dataKey="niiChange" name="NII">
                  {inst.rateShock.map((entry, i) => (
                    <Cell key={i} fill={entry.niiChange < 0 ? COLORS.red : COLORS.green} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* CTA */}
        <div className="rounded-xl border-2 border-cyan-200 bg-cyan-50/50 p-6 text-center">
          <h3 className="text-lg font-bold text-slate-950">{t('Want the full 14-page report?', 'Desea el informe completo de 14 paginas?')}</h3>
          <p className="text-sm text-slate-600 mt-2 max-w-lg mx-auto">
            {t(
              'This is a preview based on public COSSEC data. The full report includes Monte Carlo stress testing, CECL analysis, duration decomposition, and board-ready recommendations.',
              'Esta es una vista previa basada en datos publicos de COSSEC. El informe completo incluye pruebas de estres Monte Carlo, analisis CECL, descomposicion de duracion y recomendaciones listas para la junta.'
            )}
          </p>
          <div className="mt-4 flex items-center justify-center gap-3 print:hidden">
            <a href="/contact" className="inline-flex items-center gap-2 rounded-full bg-amber-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-amber-600 transition">
              {t('Book 15-Min Demo', 'Agendar Demo 15 Min')}
            </a>
            <a href="/demo" className="inline-flex items-center gap-2 rounded-full border border-slate-300 px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition">
              {t('Try Interactive Demo', 'Probar Demo Interactivo')}
            </a>
          </div>
          <p className="mt-4 text-xs text-slate-400">erwin@cerniq.io | cerniq.io | KLYTICS LLC, San Juan PR</p>
        </div>

        {/* Disclaimer */}
        <p className="mt-6 text-[9px] text-slate-400 leading-4">
          {t(
            'DISCLAIMER: This preview is generated from publicly available COSSEC data and sector benchmarks. Figures are approximate and for illustrative purposes only. CERNIQ does not provide financial, legal, or regulatory advice. Consult qualified professionals before making decisions based on this information.',
            'AVISO: Esta vista previa se genera a partir de datos publicos de COSSEC y benchmarks del sector. Las cifras son aproximadas y solo con fines ilustrativos. CERNIQ no provee asesoramiento financiero, legal o regulatorio. Consulte profesionales calificados antes de tomar decisiones basadas en esta informacion.'
          )}
        </p>
      </div>
    </div>
  );
}
