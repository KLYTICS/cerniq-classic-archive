'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronRight, Landmark } from 'lucide-react';
import { useTranslation } from '@/lib/i18n';

const MODULE_LABELS: Record<string, { en: string; es: string }> = {
  'sensitivity': { en: 'Rate Sensitivity', es: 'Sensibilidad Tasas' },
  'yield-curve': { en: 'Yield Curve', es: 'Curva de Rendimiento' },
  'repricing-gap': { en: 'Repricing Gap', es: 'Brecha de Repricing' },
  'rate-shock-v2': { en: 'Rate Shock', es: 'Shock de Tasas' },
  'key-rate-durations': { en: 'Key Rate Durations', es: 'Duraciones Clave' },
  'behavioral-duration': { en: 'Behavioral Duration', es: 'Duracion Conductual' },
  'sofr-exposure': { en: 'SOFR Exposure', es: 'Exposicion SOFR' },
  'liquidity': { en: 'Liquidity', es: 'Liquidez' },
  'stress-pack': { en: 'Stress Pack', es: 'Paquete Estres' },
  'ltp': { en: 'Transfer Pricing', es: 'Precios Transferencia' },
  'cecl': { en: 'CECL', es: 'CECL' },
  'concentration': { en: 'Concentration', es: 'Concentracion' },
  'credit-risk': { en: 'Credit Risk', es: 'Riesgo Crediticio' },
  'conc-var': { en: 'Conc. VaR', es: 'VaR Concentracion' },
  'monte-carlo': { en: 'Monte Carlo', es: 'Monte Carlo' },
  'var': { en: 'Value at Risk', es: 'Valor en Riesgo' },
  'oas': { en: 'OAS', es: 'OAS' },
  'optionality': { en: 'Optionality', es: 'Opcionalidad' },
  'ftp': { en: 'FTP', es: 'FTP' },
  'capital-optimizer': { en: 'Capital Optimizer', es: 'Optimizador Capital' },
  'nim-attribution': { en: 'NIM Attribution', es: 'Atribucion NIM' },
  'nim-optimizer': { en: 'NIM Optimizer', es: 'Optimizador NIM' },
  'forward-sim': { en: 'Forward Simulation', es: 'Simulacion Forward' },
  'exam-prep': { en: 'Exam Prep', es: 'Prep. Examen' },
  'irr-policy': { en: 'IRR Policy', es: 'Politica IRR' },
  'alerts': { en: 'Alerts', es: 'Alertas' },
  'camel-forecast': { en: 'CAMEL Forecast', es: 'Pronostico CAMEL' },
  'form-5300': { en: 'Form 5300', es: 'Formulario 5300' },
  'board-report': { en: 'Board Report', es: 'Informe Junta' },
  'peer-analytics': { en: 'Peer Analytics', es: 'Analisis Pares' },
  'climate-risk': { en: 'Climate Risk', es: 'Riesgo Climatico' },
  'macro-regime': { en: 'Macro Regime', es: 'Regimen Macro' },
  'stress-v2': { en: 'Stress Testing', es: 'Pruebas Estres' },
  'ews': { en: 'Early Warning', es: 'Alerta Temprana' },
  'scenario-builder': { en: 'Scenario Builder', es: 'Constructor Escenarios' },
  'scenario-compare': { en: 'Scenario Compare', es: 'Comparar Escenarios' },
  'deposit-beta': { en: 'Deposit Beta', es: 'Beta Depositos' },
  'network': { en: 'Network Intel', es: 'Intel Red' },
  'stress-test': { en: 'Stress Test', es: 'Prueba Estres' },
  'black-litterman': { en: 'Black-Litterman', es: 'Black-Litterman' },
  'cvar-optimizer': { en: 'CVaR Optimizer', es: 'Optimizador CVaR' },
  'hrp': { en: 'HRP', es: 'HRP' },
  'credit-metrics': { en: 'CreditMetrics', es: 'CreditMetrics' },
  'kmv-merton': { en: 'KMV-Merton', es: 'KMV-Merton' },
  'pca-yield-curve': { en: 'PCA Yield Curve', es: 'PCA Curva' },
  'frtb-ima': { en: 'FRTB-IMA', es: 'FRTB-IMA' },
  'fed-futures': { en: 'Fed Futures', es: 'Futuros Fed' },
  'copula-credit': { en: 'Copula Credit', es: 'Copula Crediticia' },
  'wrong-way-risk': { en: 'Wrong-Way Risk', es: 'Riesgo Wrong-Way' },
  'cap-floor': { en: 'Cap/Floor', es: 'Cap/Floor' },
  'rbc2': { en: 'RBC2', es: 'RBC2' },
  'macro-factors': { en: 'Macro Factors', es: 'Factores Macro' },
  'svensson': { en: 'Svensson', es: 'Svensson' },
  'hull-white': { en: 'Hull-White', es: 'Hull-White' },
  'balance-sheet': { en: 'Balance Sheet', es: 'Hoja de Balance' },
  'advisor-v2': { en: 'AI Advisor', es: 'Asesor IA' },
  'analyst': { en: 'AI Analyst', es: 'Analista IA' },
  'modules': { en: 'Module Index', es: 'Indice Modulos' },
};

export default function ALMBreadcrumb() {
  const pathname = usePathname();
  const { locale } = useTranslation();

  if (!pathname.startsWith('/alm/')) return null;

  const slug = pathname.replace('/alm/', '').split('/')[0];
  const label = MODULE_LABELS[slug];
  if (!label) return null;

  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 px-6 py-2 text-[11px] text-slate-400 border-b border-slate-100">
      <Link href="/alm" className="flex items-center gap-1 hover:text-cyan-700 transition">
        <Landmark className="h-3 w-3" />
        <span>ALM</span>
      </Link>
      <ChevronRight className="h-3 w-3" />
      <span className="text-slate-700 font-medium">{locale === 'es' ? label.es : label.en}</span>
    </nav>
  );
}
