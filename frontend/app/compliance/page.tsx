'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, CheckCircle2, AlertTriangle, XCircle, ChevronRight } from 'lucide-react';
import { CerniqMark } from '@/components/brand/CerniqLogo';

type Status = 'full' | 'partial' | 'none';
const StatusIcon = ({ s }: { s: Status }) =>
  s === 'full' ? <CheckCircle2 className="h-4 w-4 text-emerald-500" /> :
  s === 'partial' ? <AlertTriangle className="h-4 w-4 text-amber-500" /> :
  <XCircle className="h-4 w-4 text-slate-300" />;

interface Requirement {
  id: string;
  requirement: string;
  requirementEs: string;
  cossec: Status;
  ncua: Status;
  basel: Status;
  module: string;
  href: string;
}

const REQUIREMENTS: Requirement[] = [
  { id: 'R1', requirement: 'Net Worth Ratio', requirementEs: 'Ratio Patrimonio Neto', cossec: 'full', ncua: 'full', basel: 'full', module: 'COSSEC Ratios', href: '/alm/exam-prep' },
  { id: 'R2', requirement: 'Duration Gap Analysis', requirementEs: 'Análisis Gap de Duración', cossec: 'full', ncua: 'full', basel: 'full', module: 'Rate Sensitivity', href: '/alm/sensitivity' },
  { id: 'R3', requirement: 'NII Sensitivity (±200bp)', requirementEs: 'Sensibilidad NII (±200bp)', cossec: 'full', ncua: 'full', basel: 'full', module: 'Rate Sensitivity', href: '/alm/sensitivity' },
  { id: 'R4', requirement: 'EVE Sensitivity (±200bp)', requirementEs: 'Sensibilidad EVE (±200bp)', cossec: 'full', ncua: 'full', basel: 'full', module: 'Behavioral Duration', href: '/alm/behavioral-duration' },
  { id: 'R5', requirement: 'Liquidity Coverage Ratio (LCR)', requirementEs: 'Ratio Cobertura Liquidez (LCR)', cossec: 'full', ncua: 'full', basel: 'full', module: 'Liquidity', href: '/alm/liquidity' },
  { id: 'R6', requirement: 'Net Stable Funding Ratio (NSFR)', requirementEs: 'Ratio Fondeo Estable Neto (NSFR)', cossec: 'partial', ncua: 'full', basel: 'full', module: 'Liquidity Advanced', href: '/alm/liquidity' },
  { id: 'R7', requirement: 'Concentration Limits', requirementEs: 'Límites de Concentración', cossec: 'full', ncua: 'full', basel: 'full', module: 'Concentration', href: '/alm/concentration' },
  { id: 'R8', requirement: 'CECL / Allowance Adequacy', requirementEs: 'CECL / Adecuación de Reservas', cossec: 'full', ncua: 'full', basel: 'full', module: 'CECL 3-Method', href: '/alm/cecl' },
  { id: 'R9', requirement: 'Stress Testing (Regulatory)', requirementEs: 'Pruebas de Estrés (Regulatorio)', cossec: 'full', ncua: 'full', basel: 'full', module: 'Monte Carlo + DFAST', href: '/alm/stress-v2' },
  { id: 'R10', requirement: 'CAMEL Rating Components', requirementEs: 'Componentes Calificación CAMEL', cossec: 'full', ncua: 'full', basel: 'partial', module: 'Exam Prep + Forecast', href: '/alm/exam-prep' },
  { id: 'R11', requirement: 'Basel IRRBB 6 Standard Shocks', requirementEs: 'Basel IRRBB 6 Choques Estándar', cossec: 'partial', ncua: 'full', basel: 'full', module: 'Yield Curve', href: '/alm/yield-curve' },
  { id: 'R12', requirement: 'Repricing Gap (7-bucket)', requirementEs: 'Brecha Reprecio (7 cubetas)', cossec: 'full', ncua: 'full', basel: 'full', module: 'Repricing Gap', href: '/alm/repricing-gap' },
  { id: 'R13', requirement: 'FTP / Transfer Pricing', requirementEs: 'FTP / Precios de Transferencia', cossec: 'partial', ncua: 'full', basel: 'full', module: 'FTP Attribution', href: '/alm/ftp' },
  { id: 'R14', requirement: 'IRR Policy Monitoring', requirementEs: 'Monitoreo Política IRR', cossec: 'full', ncua: 'full', basel: 'full', module: 'IRR Policy Monitor', href: '/alm/irr-policy' },
  { id: 'R15', requirement: 'NCUA RBC2 Capital', requirementEs: 'Capital NCUA RBC2', cossec: 'none', ncua: 'full', basel: 'partial', module: 'NCUA RBC2', href: '/alm/rbc2' },
  { id: 'R16', requirement: 'NCUA 5300 Call Report', requirementEs: 'Call Report NCUA 5300', cossec: 'none', ncua: 'full', basel: 'none', module: 'Form 5300', href: '/alm/form-5300' },
  { id: 'R17', requirement: 'Board/ALCO Reporting', requirementEs: 'Informes Junta/ALCO', cossec: 'full', ncua: 'full', basel: 'full', module: 'Board Report', href: '/alm/board-report' },
  { id: 'R18', requirement: 'Climate Risk Assessment', requirementEs: 'Evaluación Riesgo Climático', cossec: 'partial', ncua: 'partial', basel: 'full', module: 'Climate Risk', href: '/alm/climate-risk' },
  { id: 'R19', requirement: 'Key Rate Duration', requirementEs: 'Duración Tasa Clave', cossec: 'partial', ncua: 'full', basel: 'full', module: 'Key Rate Duration', href: '/alm/key-rate-durations' },
  { id: 'R20', requirement: 'Deposit Beta Calibration', requirementEs: 'Calibración Beta Depósitos', cossec: 'partial', ncua: 'full', basel: 'full', module: 'Deposit Beta', href: '/alm/deposit-beta' },
];

export default function CompliancePage() {
  const [lang, setLang] = useState<'en' | 'es'>(() => {
    if (typeof window !== 'undefined') return (localStorage.getItem('cerniq_lang') as 'en' | 'es') || 'en';
    return 'en';
  });
  const [framework, setFramework] = useState<'all' | 'cossec' | 'ncua' | 'basel'>('all');
  const t = (en: string, es: string) => lang === 'en' ? en : es;

  const fullCount = (fw: 'cossec' | 'ncua' | 'basel') => REQUIREMENTS.filter(r => r[fw] === 'full').length;
  const partialCount = (fw: 'cossec' | 'ncua' | 'basel') => REQUIREMENTS.filter(r => r[fw] === 'partial').length;
  const coveragePct = (fw: 'cossec' | 'ncua' | 'basel') => Math.round((fullCount(fw) + partialCount(fw) * 0.5) / REQUIREMENTS.length * 100);

  const filtered = framework === 'all' ? REQUIREMENTS :
    REQUIREMENTS.filter(r => r[framework] === 'full' || r[framework] === 'partial');

  return (
    <div className="min-h-screen bg-white">
      <nav className="border-b border-slate-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/" className="text-slate-400 hover:text-slate-700"><ArrowLeft className="h-5 w-5" /></Link>
          <CerniqMark size="sm" />
          <div>
            <div className="font-display text-sm uppercase tracking-[0.4em] text-slate-950">CERNIQ</div>
            <div className="text-[10px] uppercase tracking-[0.36em] text-cyan-700/60">{t('Compliance Coverage', 'Cobertura Regulatoria')}</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center rounded-full border border-slate-200 text-xs">
            <button onClick={() => setLang('en')} className={`rounded-l-full px-2.5 py-1.5 font-semibold transition ${lang === 'en' ? 'bg-cyan-700 text-white' : 'text-slate-500'}`} aria-label="Switch to English" aria-pressed={lang === 'en'}>EN</button>
            <button onClick={() => setLang('es')} className={`rounded-r-full px-2.5 py-1.5 font-semibold transition ${lang === 'es' ? 'bg-cyan-700 text-white' : 'text-slate-500'}`} aria-label="Cambiar a Espanol" aria-pressed={lang === 'es'}>ES</button>
          </div>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto px-6 py-10 space-y-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-950">{t('Regulatory Compliance Matrix', 'Matriz de Cumplimiento Regulatorio')}</h1>
          <p className="mt-2 text-slate-600 max-w-3xl">{t(
            'CERNIQ covers 20 regulatory requirements across COSSEC, NCUA, and Basel III frameworks. Below is our coverage map — every green check is a module you can open right now.',
            'CERNIQ cubre 20 requisitos regulatorios en los marcos COSSEC, NCUA y Basel III. Abajo está nuestro mapa de cobertura — cada marca verde es un módulo que puede abrir ahora mismo.'
          )}</p>
        </div>

        {/* Framework Coverage Scores */}
        <div className="grid grid-cols-3 gap-4">
          {([
            { fw: 'cossec' as const, name: 'COSSEC', desc: t('PR Cooperativas', 'Cooperativas PR'), color: 'cyan' },
            { fw: 'ncua' as const, name: 'NCUA', desc: t('US Credit Unions', 'Credit Unions EEUU'), color: 'indigo' },
            { fw: 'basel' as const, name: 'Basel III / IRRBB', desc: t('International', 'Internacional'), color: 'violet' },
          ]).map(f => (
            <button key={f.fw} onClick={() => setFramework(framework === f.fw ? 'all' : f.fw)}
              className={`rounded-xl border p-5 text-left transition ${framework === f.fw ? `border-${f.color}-300 bg-${f.color}-50 ring-2 ring-${f.color}-200` : 'border-slate-200 bg-white hover:border-slate-300'}`}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-lg font-bold text-slate-950">{f.name}</p>
                  <p className="text-xs text-slate-500">{f.desc}</p>
                </div>
                <div className="text-right">
                  <p className="text-3xl font-bold tabular-nums text-slate-950">{coveragePct(f.fw)}%</p>
                  <p className="text-[10px] text-slate-400">{fullCount(f.fw)} full / {partialCount(f.fw)} partial</p>
                </div>
              </div>
            </button>
          ))}
        </div>

        {/* Requirements Table */}
        <div className="rounded-xl border border-slate-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="py-3 px-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 w-8">#</th>
                <th className="py-3 px-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">{t('Requirement', 'Requisito')}</th>
                <th className="py-3 px-4 text-center text-xs font-semibold uppercase tracking-wider text-slate-500 w-20">COSSEC</th>
                <th className="py-3 px-4 text-center text-xs font-semibold uppercase tracking-wider text-slate-500 w-20">NCUA</th>
                <th className="py-3 px-4 text-center text-xs font-semibold uppercase tracking-wider text-slate-500 w-20">Basel</th>
                <th className="py-3 px-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">{t('CERNIQ Module', 'Módulo CERNIQ')}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((req, i) => (
                <tr key={req.id} className={`border-b border-slate-100 ${i % 2 === 0 ? '' : 'bg-slate-50/50'} hover:bg-cyan-50/30 transition`}>
                  <td className="py-2.5 px-4 text-xs text-slate-400 font-mono">{req.id}</td>
                  <td className="py-2.5 px-4 text-slate-700 font-medium">{lang === 'en' ? req.requirement : req.requirementEs}</td>
                  <td className="py-2.5 px-4 text-center"><StatusIcon s={req.cossec} /></td>
                  <td className="py-2.5 px-4 text-center"><StatusIcon s={req.ncua} /></td>
                  <td className="py-2.5 px-4 text-center"><StatusIcon s={req.basel} /></td>
                  <td className="py-2.5 px-4">
                    <Link href={req.href} className="flex items-center gap-1 text-xs text-cyan-700 hover:text-cyan-900 font-medium">
                      {req.module} <ChevronRight className="h-3 w-3" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-6 text-xs text-slate-500">
          <span className="flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> {t('Full Coverage', 'Cobertura Total')}</span>
          <span className="flex items-center gap-1.5"><AlertTriangle className="h-3.5 w-3.5 text-amber-500" /> {t('Partial Coverage', 'Cobertura Parcial')}</span>
          <span className="flex items-center gap-1.5"><XCircle className="h-3.5 w-3.5 text-slate-300" /> {t('Not Applicable', 'No Aplica')}</span>
        </div>

        {/* CTA */}
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-6 flex items-center justify-between">
          <div>
            <p className="text-lg font-bold text-white">{t('Ready for your next exam?', '¿Listo para su próximo examen?')}</p>
            <p className="text-sm text-slate-400 mt-1">{t('Upload your balance sheet and get a compliance-ready ALM report in 24 hours.', 'Suba su hoja de balance y obtenga un informe ALM listo para regulador en 24 horas.')}</p>
          </div>
          <Link href="/pricing" className="shrink-0 rounded-xl bg-amber-500 px-6 py-3 text-sm font-semibold text-white hover:bg-amber-600 transition">
            {t('View Plans', 'Ver Planes')}
          </Link>
        </div>
      </main>
    </div>
  );
}
