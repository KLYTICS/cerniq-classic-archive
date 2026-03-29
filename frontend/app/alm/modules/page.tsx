'use client';

import Link from 'next/link';
import { useTranslation } from '@/lib/i18n';
import {
  BarChart3, TrendingUp, Shield, DollarSign, Activity, AlertOctagon, Zap,
  Landmark, SlidersHorizontal, Target, Cpu, Brain, GitBranch, Gauge,
  Layers, ShieldCheck, TrendingDown, Link2, ArrowDownUp, ArrowUpDown,
  Timer, CloudLightning, FileText, Search,
} from 'lucide-react';

const CATEGORIES = [
  {
    id: 'core',
    en: 'Core Analytics',
    es: 'Analítica Central',
    color: 'cyan',
    modules: [
      { href: '/alm', icon: BarChart3, en: 'ALM Overview', es: 'Resumen ALM', desc_en: 'Health score, KPIs, risk alerts, module grid', desc_es: 'Puntaje salud, KPIs, alertas, módulos' },
      { href: '/alm/balance-sheet', icon: DollarSign, en: 'Balance Sheet', es: 'Hoja de Balance', desc_en: 'Import CSV/NCUA, asset-liability breakdown', desc_es: 'Importar CSV/NCUA, desglose activos-pasivos' },
      { href: '/alm/advisor-v2', icon: Zap, en: 'AI Advisor v2', es: 'Asesor IA v2', desc_en: 'Health Score 0-100, SSE streaming, risk pulse', desc_es: 'Puntuación 0-100, streaming SSE, pulso riesgo' },
      { href: '/alm/analyst', icon: Brain, en: 'AI Analyst Chat', es: 'Chat Analista IA', desc_en: 'Claude-powered conversational ALM analysis', desc_es: 'Análisis ALM conversacional con Claude' },
    ],
  },
  {
    id: 'rate',
    en: 'Rate Risk',
    es: 'Riesgo de Tasa',
    color: 'sky',
    modules: [
      { href: '/alm/sensitivity', icon: TrendingUp, en: 'Rate Sensitivity', es: 'Sensibilidad de Tasa', desc_en: 'NII/EVE impact across ±200bp parallel shifts', desc_es: 'Impacto NII/EVE en cambios ±200bp' },
      { href: '/alm/yield-curve', icon: TrendingUp, en: 'Yield Curve', es: 'Curva de Rendimiento', desc_en: 'Nelson-Siegel interpolation, 6 Basel IRRBB shocks', desc_es: 'Interpolación Nelson-Siegel, 6 choques Basel' },
      { href: '/alm/repricing-gap', icon: BarChart3, en: 'Repricing Gap', es: 'Brecha de Reprecio', desc_en: 'OCIF CC-2022-03 exact 7-bucket format', desc_es: 'Formato exacto OCIF CC-2022-03 7 cubetas' },
      { href: '/alm/rate-shock-v2', icon: Zap, en: 'Rate Shock v2', es: 'Choque de Tasa v2', desc_en: 'Non-parallel shocks: steepener, flattener, twist', desc_es: 'Choques no paralelos: empinamiento, aplanamiento' },
      { href: '/alm/key-rate-durations', icon: SlidersHorizontal, en: 'Key Rate Duration', es: 'Duración Tasa Clave', desc_en: 'KRD01 per tenor bucket, hedging precision', desc_es: 'KRD01 por tenor, precisión de cobertura' },
      { href: '/alm/behavioral-duration', icon: Timer, en: 'Behavioral Duration', es: 'Duración Conductual', desc_en: 'Hutchison-Pennacchi NMD model, EVE correction', desc_es: 'Modelo H-P NMD, corrección EVE' },
      { href: '/alm/sofr-exposure', icon: TrendingUp, en: 'SOFR Transition', es: 'Transición SOFR', desc_en: 'ISDA LIBOR→SOFR spread monitoring', desc_es: 'Monitoreo spread ISDA LIBOR→SOFR' },
      { href: '/alm/deposit-beta', icon: SlidersHorizontal, en: 'Deposit Beta', es: 'Beta de Depósitos', desc_en: 'OLS calibration vs 94-institution PR library', desc_es: 'Calibración OLS vs biblioteca 94 instituciones PR' },
    ],
  },
  {
    id: 'liquidity',
    en: 'Liquidity',
    es: 'Liquidez',
    color: 'emerald',
    modules: [
      { href: '/alm/liquidity', icon: Shield, en: 'LCR / NSFR', es: 'LCR / NSFR', desc_en: 'Basel III LCR + 1-year structural NSFR', desc_es: 'LCR Basel III + NSFR estructural 1 año' },
      { href: '/alm/stress-pack', icon: Shield, en: 'COSSEC Stress Pack', es: 'Pack Estrés COSSEC', desc_en: '5 pre-loaded PR scenarios incl. hurricane', desc_es: '5 escenarios PR incluyendo huracán' },
      { href: '/alm/ltp', icon: DollarSign, en: 'Liquidity Transfer', es: 'Transfer. Liquidez', desc_en: 'Internal liquidity transfer pricing framework', desc_es: 'Marco de precios de transferencia de liquidez' },
    ],
  },
  {
    id: 'credit',
    en: 'Credit Risk',
    es: 'Riesgo Crediticio',
    color: 'rose',
    modules: [
      { href: '/alm/cecl', icon: Shield, en: 'CECL', es: 'CECL', desc_en: '3 methods: WARM, Vintage, PD×LGD + macro scenarios', desc_es: '3 métodos: WARM, Vintage, PD×LGD + escenarios macro' },
      { href: '/alm/concentration', icon: AlertOctagon, en: 'Concentration', es: 'Concentración', desc_en: 'Sector/single-name exposure, HHI, policy limits', desc_es: 'Exposición sector/nombre, HHI, límites' },
      { href: '/alm/credit-risk', icon: Shield, en: 'Credit Risk Quant', es: 'Riesgo Crédito Quant', desc_en: 'PD logistic (6 types), LGD haircuts, Basel II UL', desc_es: 'PD logística (6 tipos), LGD, UL Basel II' },
      { href: '/alm/conc-var', icon: AlertOctagon, en: 'Concentration VaR', es: 'VaR Concentración', desc_en: 'Gordy granularity, sector-level VaR attribution', desc_es: 'Gordy granularidad, atribución VaR sector' },
    ],
  },
  {
    id: 'quant',
    en: 'Quant Engine',
    es: 'Motor Cuantitativo',
    color: 'red',
    modules: [
      { href: '/alm/monte-carlo', icon: Cpu, en: 'Monte Carlo', es: 'Monte Carlo', desc_en: '10K Vasicek paths, antithetic variates, VaR-95/CVaR-99', desc_es: '10K senderos Vasicek, variantes antitéticas' },
      { href: '/alm/var', icon: AlertOctagon, en: 'VaR Suite', es: 'Suite VaR', desc_en: 'Historical + Parametric + Monte Carlo, Kupiec backtest', desc_es: 'Histórico + Paramétrico + MC, backtest Kupiec' },
      { href: '/alm/oas', icon: Landmark, en: 'OAS Analysis', es: 'Análisis OAS', desc_en: 'BDT binomial tree, backward induction pricing', desc_es: 'Árbol binomial BDT, valoración por inducción' },
      { href: '/alm/optionality', icon: SlidersHorizontal, en: 'Optionality Suite', es: 'Suite Opcionalidad', desc_en: 'Embedded option analytics for MBS/callable bonds', desc_es: 'Analítica opciones embebidas MBS/bonos callable' },
    ],
  },
  {
    id: 'strategy',
    en: 'Strategy & Capital',
    es: 'Estrategia y Capital',
    color: 'amber',
    modules: [
      { href: '/alm/ftp', icon: DollarSign, en: 'FTP Analysis', es: 'Análisis FTP', desc_en: 'Matched-maturity FTP, spread decomposition', desc_es: 'FTP vencimiento coincidente, descomposición spread' },
      { href: '/alm/capital-optimizer', icon: Zap, en: 'Capital Optimizer', es: 'Optimizador Capital', desc_en: 'LP optimization under regulatory constraints', desc_es: 'Optimización LP bajo restricciones regulatorias' },
      { href: '/alm/nim-attribution', icon: DollarSign, en: 'NIM Attribution', es: 'Atribución NIM', desc_en: '7-factor waterfall decomposition of NIM changes', desc_es: 'Descomposición waterfall 7 factores de NIM' },
      { href: '/alm/nim-optimizer', icon: DollarSign, en: 'NIM Optimizer', es: 'Optimizador NIM', desc_en: 'Portfolio rebalancing to maximize net interest margin', desc_es: 'Rebalanceo portafolio para maximizar margen' },
      { href: '/alm/forward-sim', icon: TrendingUp, en: '3-Year Projection', es: 'Proyección 3 Años', desc_en: '12-quarter NII/EVE/LCR/NSFR under 3 rate paths', desc_es: '12 trimestres NII/EVE/LCR/NSFR en 3 senderos' },
    ],
  },
  {
    id: 'regulatory',
    en: 'Regulatory & Exam',
    es: 'Regulatorio y Examen',
    color: 'blue',
    modules: [
      { href: '/alm/exam-prep', icon: Shield, en: 'Exam Prep', es: 'Prep Examen', desc_en: 'COSSEC/NCUA exam readiness, CAMEL auto-scorer', desc_es: 'Preparación examen COSSEC/NCUA, CAMEL auto' },
      { href: '/alm/irr-policy', icon: AlertOctagon, en: 'IRR Policy Monitor', es: 'Monitor Política IRR', desc_en: 'EVE/NII/DurationGap limits, WATCH/WARNING/BREACH', desc_es: 'Límites EVE/NII/Duración, monitoreo brechas' },
      { href: '/alm/alerts', icon: Activity, en: 'Regulatory Alerts', es: 'Alertas Regulatorias', desc_en: 'Automated regulatory publication scanning', desc_es: 'Escaneo automático publicaciones regulatorias' },
      { href: '/alm/camel-forecast', icon: TrendingUp, en: 'CAMEL Forecast', es: 'Pronóstico CAMEL', desc_en: 'AR(2) 4-quarter CAMEL component prediction', desc_es: 'Predicción AR(2) 4 trimestres componentes CAMEL' },
      { href: '/alm/form-5300', icon: FileText, en: 'NCUA 5300', es: 'NCUA 5300', desc_en: 'Automated 5300 Call Report field mapping', desc_es: 'Mapeo automático campos Call Report 5300' },
      { href: '/alm/board-report', icon: FileText, en: 'Board Report', es: 'Informe Junta', desc_en: '20-page bilingual PDF, ALCO-ready', desc_es: 'PDF 20 páginas bilingüe, listo para ALCO' },
      { href: '/alm/rbc2', icon: Shield, en: 'NCUA RBC2', es: 'NCUA RBC2', desc_en: '8-component risk-based capital per Letter 15-CU-02', desc_es: 'Capital basado riesgo 8 componentes' },
    ],
  },
  {
    id: 'intelligence',
    en: 'Intelligence & Scenarios',
    es: 'Inteligencia y Escenarios',
    color: 'violet',
    modules: [
      { href: '/alm/peer-analytics', icon: Activity, en: 'Peer Analytics', es: 'Análisis de Pares', desc_en: '6 metrics, quartile benchmarks, percentile rank', desc_es: '6 métricas, benchmarks cuartil, rango percentil' },
      { href: '/alm/climate-risk', icon: CloudLightning, en: 'Climate Risk', es: 'Riesgo Climático', desc_en: 'Hurricane AAL (NOAA-calibrated), FEMA flood zones', desc_es: 'AAL huracanes (NOAA), zonas inundación FEMA' },
      { href: '/alm/macro-regime', icon: Activity, en: 'Macro Regime', es: 'Régimen Macro', desc_en: 'HMM Viterbi 4-state regime detection', desc_es: 'Detección régimen 4 estados HMM Viterbi' },
      { href: '/alm/stress-v2', icon: AlertOctagon, en: 'DFAST Stress 2.0', es: 'Estrés DFAST 2.0', desc_en: '9-quarter DFAST projection under 3 scenarios', desc_es: 'Proyección 9Q DFAST bajo 3 escenarios' },
      { href: '/alm/ews', icon: AlertOctagon, en: 'Early Warning', es: 'Alerta Temprana', desc_en: 'Multi-signal deterioration detection system', desc_es: 'Sistema detección deterioro multi-señal' },
      { href: '/alm/scenario-builder', icon: SlidersHorizontal, en: 'Scenario Builder', es: 'Constructor Escenarios', desc_en: 'Custom 4-slider scenarios with PR presets', desc_es: 'Escenarios personalizados 4 controles + PR' },
      { href: '/alm/scenario-compare', icon: BarChart3, en: 'Scenario Compare', es: 'Comparar Escenarios', desc_en: 'Side-by-side NIM/LCR/Capital comparison', desc_es: 'Comparación lado a lado NIM/LCR/Capital' },
    ],
  },
  {
    id: 'frontier',
    en: 'Quant Frontier',
    es: 'Frontera Cuantitativa',
    color: 'indigo',
    modules: [
      { href: '/alm/black-litterman', icon: Brain, en: 'Black-Litterman', es: 'Black-Litterman', desc_en: 'Bayesian posterior allocation, CAPM equilibrium views', desc_es: 'Asignación posterior Bayesiana, equilibrio CAPM' },
      { href: '/alm/cvar-optimizer', icon: Target, en: 'CVaR Optimizer', es: 'Optimizador CVaR', desc_en: 'Rockafellar-Uryasev efficient frontier', desc_es: 'Frontera eficiente Rockafellar-Uryasev' },
      { href: '/alm/hrp', icon: GitBranch, en: 'HRP', es: 'HRP', desc_en: 'López de Prado hierarchical risk parity', desc_es: 'Paridad riesgo jerárquica López de Prado' },
      { href: '/alm/credit-metrics', icon: Shield, en: 'CreditMetrics', es: 'CreditMetrics', desc_en: 'JP Morgan migration VaR with correlations', desc_es: 'VaR migración JP Morgan con correlaciones' },
      { href: '/alm/kmv-merton', icon: Gauge, en: 'KMV-Merton', es: 'KMV-Merton', desc_en: 'Structural model: Distance-to-Default per obligor', desc_es: 'Modelo estructural: Distancia al Incumplimiento' },
      { href: '/alm/pca-yield-curve', icon: Layers, en: 'PCA Yield Curve', es: 'PCA Curva', desc_en: '3-factor decomposition: level, slope, curvature', desc_es: 'Descomposición 3 factores: nivel, pendiente, curvatura' },
      { href: '/alm/frtb-ima', icon: ShieldCheck, en: 'FRTB-IMA', es: 'FRTB-IMA', desc_en: 'Basel III.1 Expected Shortfall with liquidity horizons', desc_es: 'Expected Shortfall Basel III.1 con horizontes liquidez' },
      { href: '/alm/fed-futures', icon: TrendingDown, en: 'Fed Futures', es: 'Futuros Fed', desc_en: 'Implied rate path vs FOMC dot plot + NII impact', desc_es: 'Trayectoria implícita vs dot plot + impacto NII' },
      { href: '/alm/copula-credit', icon: Link2, en: 'Credit Copula', es: 'Copula Crediticia', desc_en: 'Gaussian vs t-Student tail dependence analysis', desc_es: 'Análisis dependencia cola Gaussian vs t-Student' },
      { href: '/alm/wrong-way-risk', icon: ArrowDownUp, en: 'Wrong-Way Risk', es: 'Riesgo Wrong-Way', desc_en: 'Naive vs adjusted CVA with exposure-PD correlation', desc_es: 'CVA naive vs ajustado con correlación exposición-PD' },
      { href: '/alm/cap-floor', icon: ArrowUpDown, en: 'IR Cap/Floor', es: 'IR Cap/Floor', desc_en: 'Black-76 pricing, collar structure, NII protection', desc_es: 'Valoración Black-76, collar, protección NII' },
      { href: '/alm/macro-factors', icon: Activity, en: 'Macro Factors', es: 'Factores Macro', desc_en: 'Multi-factor regression: GDP, unemployment, rates → NII', desc_es: 'Regresión multi-factor: GDP, desempleo, tasas → NII' },
    ],
  },
];

const TOTAL_MODULES = CATEGORIES.reduce((sum, c) => sum + c.modules.length, 0);

export default function ModuleIndexPage() {
  const { locale } = useTranslation();
  const en = locale === 'en';

  return (
    <div className="p-6 space-y-6 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500 to-indigo-600">
              <Search className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-950">{en ? 'ALM Module Index' : 'Índice de Módulos ALM'}</h1>
              <p className="text-xs text-slate-500">{en ? 'Every analytical capability in one view' : 'Todas las capacidades analíticas en una vista'}</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-4 text-center">
          <div>
            <p className="text-2xl font-bold text-slate-950 tabular-nums">{TOTAL_MODULES}</p>
            <p className="text-[9px] font-semibold uppercase tracking-wider text-slate-400">{en ? 'Modules' : 'Módulos'}</p>
          </div>
          <div className="h-8 w-px bg-slate-200" />
          <div>
            <p className="text-2xl font-bold text-slate-950 tabular-nums">{CATEGORIES.length}</p>
            <p className="text-[9px] font-semibold uppercase tracking-wider text-slate-400">{en ? 'Domains' : 'Dominios'}</p>
          </div>
          <div className="h-8 w-px bg-slate-200" />
          <div>
            <p className="text-2xl font-bold text-slate-950 tabular-nums">34</p>
            <p className="text-[9px] font-semibold uppercase tracking-wider text-slate-400">{en ? 'Quant Models' : 'Modelos Quant'}</p>
          </div>
        </div>
      </div>

      {/* Category Grid */}
      {CATEGORIES.map((cat) => (
        <div key={cat.id}>
          <div className="flex items-center gap-2 mb-3">
            <div className={`h-1.5 w-1.5 rounded-full bg-${cat.color}-500`} />
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500">
              {en ? cat.en : cat.es} <span className="text-slate-300">({cat.modules.length})</span>
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2">
            {cat.modules.map((mod) => (
              <Link
                key={mod.href}
                href={mod.href}
                className="group flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-3 transition hover:border-slate-300 hover:shadow-sm"
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-100 bg-slate-50 group-hover:border-slate-200">
                  <mod.icon className="h-4 w-4 text-slate-500 group-hover:text-slate-700" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-slate-800 group-hover:text-slate-950 truncate">
                    {en ? mod.en : mod.es}
                  </p>
                  <p className="text-[10px] text-slate-400 leading-relaxed mt-0.5 line-clamp-2">
                    {en ? mod.desc_en : mod.desc_es}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
