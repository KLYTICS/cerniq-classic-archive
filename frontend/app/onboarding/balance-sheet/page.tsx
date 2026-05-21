'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle,
  DollarSign,
  Building2,
  Landmark,
  TrendingUp,
  ClipboardList,
  RefreshCw,
  Globe,
  Percent,
  Calendar,
  Clock,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { apiClient } from '@/lib/api';
import { analytics, EVENTS } from '@/lib/analytics';

// ---------------------------------------------------------------------------
// i18n
// ---------------------------------------------------------------------------
type Lang = 'en' | 'es';

const T: Record<string, Record<Lang, string>> = {
  title: { en: 'Balance Sheet Entry', es: 'Entrada del Balance General' },
  subtitle: {
    en: 'Enter your institution’s financial data to generate ALM reports.',
    es: 'Ingrese los datos financieros de su institución para generar informes ALM.',
  },
  step: { en: 'Step', es: 'Paso' },
  of: { en: 'of', es: 'de' },
  back: { en: 'Back', es: 'Atrás' },
  next: { en: 'Next', es: 'Siguiente' },
  submit: { en: 'Submit Balance Sheet', es: 'Enviar Balance General' },
  submitting: { en: 'Submitting...', es: 'Enviando...' },
  skipStep: { en: 'Skip this step', es: 'Omitir este paso' },
  optional: { en: '(optional)', es: '(opcional)' },

  // Step names
  assets: { en: 'Assets', es: 'Activos' },
  liabilities: { en: 'Liabilities', es: 'Pasivos' },
  capital: { en: 'Capital', es: 'Capital' },
  income: { en: 'Income Statement', es: 'Estado de Resultados' },
  review: { en: 'Review & Submit', es: 'Revisar y Enviar' },

  // Asset fields
  cashEquivalents: { en: 'Cash & Equivalents', es: 'Efectivo y Equivalentes' },
  investmentSecurities: {
    en: 'Investment Securities',
    es: 'Valores de Inversión',
  },
  netLoansLeases: {
    en: 'Net Loans & Leases',
    es: 'Préstamos y Arrendamientos Netos',
  },
  fixedAssets: { en: 'Fixed Assets', es: 'Activos Fijos' },
  otherAssets: { en: 'Other Assets', es: 'Otros Activos' },
  totalAssets: { en: 'Total Assets', es: 'Activos Totales' },

  // Liability fields
  memberDeposits: {
    en: 'Member Deposits / Shares',
    es: 'Depósitos / Acciones de Miembros',
  },
  borrowedFunds: { en: 'Borrowed Funds', es: 'Fondos Prestados' },
  otherLiabilities: { en: 'Other Liabilities', es: 'Otros Pasivos' },
  totalLiabilities: { en: 'Total Liabilities', es: 'Pasivos Totales' },

  // Capital fields
  netWorthEquity: {
    en: 'Net Worth / Equity',
    es: 'Patrimonio Neto / Capital',
  },
  netWorthRatio: {
    en: 'Net Worth Ratio',
    es: 'Razón de Capital Neto',
  },

  // Income fields
  interestIncome: {
    en: 'Interest Income',
    es: 'Ingresos por Intereses',
  },
  interestExpense: {
    en: 'Interest Expense',
    es: 'Gastos por Intereses',
  },
  netInterestIncome: {
    en: 'Net Interest Income',
    es: 'Ingreso Neto por Intereses',
  },
  nonInterestIncome: {
    en: 'Non-Interest Income',
    es: 'Ingresos No Relacionados con Intereses',
  },
  nonInterestExpense: {
    en: 'Non-Interest Expense',
    es: 'Gastos No Relacionados con Intereses',
  },
  netIncome: { en: 'Net Income', es: 'Ingreso Neto' },

  // Review
  reviewSummary: { en: 'Summary', es: 'Resumen' },
  section: { en: 'Section', es: 'Sección' },
  field: { en: 'Field', es: 'Campo' },
  value: { en: 'Value', es: 'Valor' },
  autoCalculated: { en: 'Auto-calculated', es: 'Calculado automáticamente' },

  // Validation
  noNegative: {
    en: 'Values cannot be negative.',
    es: 'Los valores no pueden ser negativos.',
  },
  submitSuccess: {
    en: 'Balance sheet submitted successfully!',
    es: '¡Balance general enviado exitosamente!',
  },
  submitError: {
    en: 'Failed to submit. Please try again.',
    es: 'Error al enviar. Intente de nuevo.',
  },
  rateAndDuration: {
    en: 'Rate & Duration',
    es: 'Tasa y Duración',
  },
  avgRate: {
    en: 'Avg Rate (%)',
    es: 'Tasa Prom. (%)',
  },
  durationYrs: {
    en: 'Duration (yrs)',
    es: 'Duración (años)',
  },
  rateTypeLabel: {
    en: 'Rate Type',
    es: 'Tipo de Tasa',
  },
  fixed: {
    en: 'Fixed',
    es: 'Fija',
  },
  variable: {
    en: 'Variable',
    es: 'Variable',
  },
  institutionIdMissing: {
    en: 'No institution selected. Please complete previous onboarding steps.',
    es: 'No hay institución seleccionada. Complete los pasos anteriores.',
  },
};

function t(key: string, lang: Lang): string {
  return T[key]?.[lang] ?? key;
}

// ---------------------------------------------------------------------------
// Formatters
// ---------------------------------------------------------------------------
function fmtDollar(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function fmtPct(value: number): string {
  return `${value.toFixed(2)}%`;
}

// ---------------------------------------------------------------------------
// Step definitions
// ---------------------------------------------------------------------------
const STEP_KEYS = ['assets', 'liabilities', 'capital', 'income', 'review'] as const;
type StepKey = (typeof STEP_KEYS)[number];

const STEP_ICONS: Record<StepKey, React.ElementType> = {
  assets: DollarSign,
  liabilities: Building2,
  capital: Landmark,
  income: TrendingUp,
  review: ClipboardList,
};

// ---------------------------------------------------------------------------
// Currency input component (Restyled for modern glassmorphic look)
// ---------------------------------------------------------------------------
function CurrencyInput({
  id,
  label,
  value,
  onChange,
  readOnly = false,
  computed = false,
  error,
}: {
  id: string;
  label: string;
  value: number;
  onChange?: (v: number) => void;
  readOnly?: boolean;
  computed?: boolean;
  error?: string;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="flex justify-between items-center text-xs font-semibold uppercase tracking-wider text-slate-400">
        <span>{label}</span>
        {computed && (
          <span className="text-[10px] bg-cyan-500/10 text-cyan-400 px-2 py-0.5 rounded-full font-bold uppercase tracking-widest scale-90">
            Calculated
          </span>
        )}
      </label>
      <div className="relative group">
        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 text-sm font-semibold">
          $
        </span>
        <input
          id={id}
          type="number"
          inputMode="numeric"
          min={0}
          step={1}
          value={value || ''}
          onChange={(e) => {
            if (onChange) {
              const raw = e.target.value;
              onChange(raw === '' ? 0 : Math.max(0, Number(raw)));
            }
          }}
          readOnly={readOnly}
          tabIndex={readOnly ? -1 : 0}
          placeholder="0"
          className={`w-full rounded-xl border pl-7 pr-4 py-3 text-sm focus:outline-none focus:ring-2 font-mono transition ${
            readOnly
              ? 'bg-slate-950/60 border-slate-900 text-cyan-400 cursor-default focus:ring-transparent'
              : error
                ? 'bg-slate-950/40 border-red-500/60 text-white focus:ring-red-500/50'
                : 'bg-slate-950/40 border-slate-800 text-white focus:ring-cyan-500/40 focus:border-cyan-500'
          }`}
        />
      </div>
      {error && <p className="mt-1 text-xs text-red-400">{error}</p>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Rate & Duration inline row — grouped in card segments
// ---------------------------------------------------------------------------
function RateDurationRow({
  rate,
  onRateChange,
  duration,
  onDurationChange,
  rateType,
  onRateTypeChange,
  lang,
  visible,
}: {
  rate: number;
  onRateChange: (v: number) => void;
  duration: number;
  onDurationChange: (v: number) => void;
  rateType: 'fixed' | 'variable';
  onRateTypeChange: (v: 'fixed' | 'variable') => void;
  lang: Lang;
  visible: boolean;
}) {
  if (!visible) return null;
  return (
    <div className="mt-2.5 grid grid-cols-3 gap-2.5 rounded-xl border border-slate-800 bg-slate-950/50 p-3 animate-fade-in">
      <div className="space-y-1">
        <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1">
          <Percent className="h-3 w-3" />
          {t('avgRate', lang)}
        </label>
        <input
          type="number"
          step={0.1}
          min={0}
          max={100}
          value={rate || ''}
          onChange={(e) => onRateChange(e.target.value === '' ? 0 : Math.max(0, Number(e.target.value)))}
          className="w-full rounded-lg border border-slate-800 bg-slate-950 px-2.5 py-1.5 text-xs text-white font-mono focus:outline-none focus:ring-1 focus:ring-cyan-500 focus:border-cyan-500"
          placeholder="0.0"
        />
      </div>
      <div className="space-y-1">
        <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1">
          <Clock className="h-3 w-3" />
          {t('durationYrs', lang)}
        </label>
        <input
          type="number"
          step={0.1}
          min={0}
          max={50}
          value={duration || ''}
          onChange={(e) => onDurationChange(e.target.value === '' ? 0 : Math.max(0, Number(e.target.value)))}
          className="w-full rounded-lg border border-slate-800 bg-slate-950 px-2.5 py-1.5 text-xs text-white font-mono focus:outline-none focus:ring-1 focus:ring-cyan-500 focus:border-cyan-500"
          placeholder="0.0"
        />
      </div>
      <div className="space-y-1">
        <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1">
          <Calendar className="h-3 w-3" />
          {t('rateTypeLabel', lang)}
        </label>
        <select
          value={rateType}
          onChange={(e) => onRateTypeChange(e.target.value as 'fixed' | 'variable')}
          className="w-full rounded-lg border border-slate-800 bg-slate-950 px-2.5 py-1.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-cyan-500 focus:border-cyan-500"
        >
          <option value="fixed">{t('fixed', lang)}</option>
          <option value="variable">{t('variable', lang)}</option>
        </select>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main wizard
// ---------------------------------------------------------------------------
export default function BalanceSheetWizard() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedInstitutionId = searchParams.get('institutionId') || '';
  // ---- Auto-save key ----
  const autoSaveKey = `cerniq_bs_wizard_${requestedInstitutionId || 'draft'}`;

  function loadSaved<T>(field: string, fallback: T): T {
    if (typeof window === 'undefined') return fallback;
    try {
      const raw = localStorage.getItem(autoSaveKey);
      if (!raw) return fallback;
      const parsed = JSON.parse(raw);
      return field in parsed ? parsed[field] : fallback;
    } catch { return fallback; }
  }

  const [lang, setLang] = useState<Lang>(() => loadSaved('lang', 'en' as Lang));
  const [step, setStep] = useState(() => loadSaved('step', 0));
  const [submitting, setSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState<'success' | 'error' | null>(null);
  const [institutionId, setInstitutionId] = useState(requestedInstitutionId);

  // ---- Assets ----
  const [cashEquivalents, setCashEquivalents] = useState(() => loadSaved('cashEquivalents', 0));
  const [investmentSecurities, setInvestmentSecurities] = useState(() => loadSaved('investmentSecurities', 0));
  const [netLoansLeases, setNetLoansLeases] = useState(() => loadSaved('netLoansLeases', 0));
  const [fixedAssets, setFixedAssets] = useState(() => loadSaved('fixedAssets', 0));
  const [otherAssets, setOtherAssets] = useState(() => loadSaved('otherAssets', 0));

  // ---- Liabilities ----
  const [memberDeposits, setMemberDeposits] = useState(() => loadSaved('memberDeposits', 0));
  const [borrowedFunds, setBorrowedFunds] = useState(() => loadSaved('borrowedFunds', 0));
  const [otherLiabilities, setOtherLiabilities] = useState(() => loadSaved('otherLiabilities', 0));

  // ---- Rate & Duration per item (sensible defaults per subcategory) ----
  const [cashRate, setCashRate] = useState(() => loadSaved('cashRate', 1.5));
  const [cashDuration, setCashDuration] = useState(() => loadSaved('cashDuration', 0.1));
  const [cashRateType, setCashRateType] = useState<'fixed' | 'variable'>(() => loadSaved('cashRateType', 'variable'));

  const [investRate, setInvestRate] = useState(() => loadSaved('investRate', 3.5));
  const [investDuration, setInvestDuration] = useState(() => loadSaved('investDuration', 3.5));
  const [investRateType, setInvestRateType] = useState<'fixed' | 'variable'>(() => loadSaved('investRateType', 'fixed'));

  const [loanRate, setLoanRate] = useState(() => loadSaved('loanRate', 5.5));
  const [loanDuration, setLoanDuration] = useState(() => loadSaved('loanDuration', 4.2));
  const [loanRateType, setLoanRateType] = useState<'fixed' | 'variable'>(() => loadSaved('loanRateType', 'fixed'));

  const [fixedAssetRate, setFixedAssetRate] = useState(() => loadSaved('fixedAssetRate', 0));
  const [fixedAssetDuration, setFixedAssetDuration] = useState(() => loadSaved('fixedAssetDuration', 0));
  const [fixedAssetRateType, setFixedAssetRateType] = useState<'fixed' | 'variable'>(() => loadSaved('fixedAssetRateType', 'fixed'));

  const [otherAssetRate, setOtherAssetRate] = useState(() => loadSaved('otherAssetRate', 0));
  const [otherAssetDuration, setOtherAssetDuration] = useState(() => loadSaved('otherAssetDuration', 0));
  const [otherAssetRateType, setOtherAssetRateType] = useState<'fixed' | 'variable'>(() => loadSaved('otherAssetRateType', 'fixed'));

  const [depositRate, setDepositRate] = useState(() => loadSaved('depositRate', 2.0));
  const [depositDuration, setDepositDuration] = useState(() => loadSaved('depositDuration', 1.5));
  const [depositRateType, setDepositRateType] = useState<'fixed' | 'variable'>(() => loadSaved('depositRateType', 'variable'));

  const [borrowRate, setBorrowRate] = useState(() => loadSaved('borrowRate', 4.0));
  const [borrowDuration, setBorrowDuration] = useState(() => loadSaved('borrowDuration', 2.0));
  const [borrowRateType, setBorrowRateType] = useState<'fixed' | 'variable'>(() => loadSaved('borrowRateType', 'fixed'));

  const [otherLiabRate, setOtherLiabRate] = useState(() => loadSaved('otherLiabRate', 0));
  const [otherLiabDuration, setOtherLiabDuration] = useState(() => loadSaved('otherLiabDuration', 0));
  const [otherLiabRateType, setOtherLiabRateType] = useState<'fixed' | 'variable'>(() => loadSaved('otherLiabRateType', 'fixed'));

  // ---- Income ----
  const [interestIncome, setInterestIncome] = useState(() => loadSaved('interestIncome', 0));
  const [interestExpense, setInterestExpense] = useState(() => loadSaved('interestExpense', 0));
  const [nonInterestIncome, setNonInterestIncome] = useState(() => loadSaved('nonInterestIncome', 0));
  const [nonInterestExpense, setNonInterestExpense] = useState(() => loadSaved('nonInterestExpense', 0));

  // Collapsible review sections state
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    assets: true,
    liabilities: true,
    capital: true,
    income: false,
  });

  const toggleSection = (sec: string) => {
    setOpenSections((prev) => ({ ...prev, [sec]: !prev[sec] }));
  };

  // ---- Auto-save effect ----
  useEffect(() => {
    if (submitting || submitResult === 'success') return;
    try {
      localStorage.setItem(autoSaveKey, JSON.stringify({
        lang, step, cashEquivalents, investmentSecurities, netLoansLeases,
        fixedAssets, otherAssets, memberDeposits, borrowedFunds, otherLiabilities,
        interestIncome, interestExpense, nonInterestIncome, nonInterestExpense,
        cashRate, cashDuration, cashRateType,
        investRate, investDuration, investRateType,
        loanRate, loanDuration, loanRateType,
        fixedAssetRate, fixedAssetDuration, fixedAssetRateType,
        otherAssetRate, otherAssetDuration, otherAssetRateType,
        depositRate, depositDuration, depositRateType,
        borrowRate, borrowDuration, borrowRateType,
        otherLiabRate, otherLiabDuration, otherLiabRateType,
      }));
    } catch { /* localStorage full — degrade silently */ }
  }, [
    autoSaveKey, lang, step, submitting, submitResult,
    cashEquivalents, investmentSecurities, netLoansLeases, fixedAssets, otherAssets,
    memberDeposits, borrowedFunds, otherLiabilities,
    interestIncome, interestExpense, nonInterestIncome, nonInterestExpense,
    cashRate, cashDuration, cashRateType,
    investRate, investDuration, investRateType,
    loanRate, loanDuration, loanRateType,
    fixedAssetRate, fixedAssetDuration, fixedAssetRateType,
    otherAssetRate, otherAssetDuration, otherAssetRateType,
    depositRate, depositDuration, depositRateType,
    borrowRate, borrowDuration, borrowRateType,
    otherLiabRate, otherLiabDuration, otherLiabRateType,
  ]);

  useEffect(() => {
    let cancelled = false;

    const resolveInstitution = async () => {
      if (requestedInstitutionId) {
        setInstitutionId(requestedInstitutionId);
        return;
      }

      try {
        const institutions = await apiClient.getInstitutions();
        if (!cancelled && Array.isArray(institutions) && institutions.length > 0) {
          setInstitutionId(institutions[0].id);
        }
      } catch {
        if (!cancelled) {
          setInstitutionId('');
        }
      }
    };

    void resolveInstitution();
    return () => {
      cancelled = true;
    };
  }, [requestedInstitutionId]);

  // ---- Computed values ----
  const totalAssets = useMemo(
    () => cashEquivalents + investmentSecurities + netLoansLeases + fixedAssets + otherAssets,
    [cashEquivalents, investmentSecurities, netLoansLeases, fixedAssets, otherAssets],
  );

  const totalLiabilities = useMemo(
    () => memberDeposits + borrowedFunds + otherLiabilities,
    [memberDeposits, borrowedFunds, otherLiabilities],
  );

  const netWorthEquity = useMemo(
    () => totalAssets - totalLiabilities,
    [totalAssets, totalLiabilities],
  );

  const netWorthRatio = useMemo(
    () => (totalAssets > 0 ? (netWorthEquity / totalAssets) * 100 : 0),
    [netWorthEquity, totalAssets],
  );

  const netInterestIncome = useMemo(
    () => interestIncome - interestExpense,
    [interestIncome, interestExpense],
  );

  const netIncome = useMemo(
    () => netInterestIncome + nonInterestIncome - nonInterestExpense,
    [netInterestIncome, nonInterestIncome, nonInterestExpense],
  );

  // ---- Validation ----
  const stepValid = useCallback(
    (s: number): boolean => {
      switch (s) {
        case 0: // Assets
          return totalAssets > 0;
        case 1: // Liabilities
          return totalLiabilities >= 0;
        case 2: // Capital — always valid (computed)
          return true;
        case 3: // Income — optional
          return true;
        case 4: // Review
          return totalAssets > 0;
        default:
          return true;
      }
    },
    [totalAssets, totalLiabilities],
  );

  const currentStepKey = STEP_KEYS[step];
  const StepIcon = STEP_ICONS[currentStepKey];
  const isLast = step === STEP_KEYS.length - 1;
  const progressPct = ((step + 1) / STEP_KEYS.length) * 100;

  // ---- Navigation ----
  const goNext = () => {
    if (step < STEP_KEYS.length - 1) setStep((s) => s + 1);
  };
  const goBack = () => {
    if (step > 0) setStep((s) => s - 1);
  };

  // ---- Submit ----
  const handleSubmit = async () => {
    setSubmitting(true);
    setSubmitResult(null);

    if (!institutionId) {
      setSubmitResult('error');
      setSubmitting(false);
      return;
    }

    const items = [
      // Assets
      { category: 'asset', subcategory: 'cash', name: 'Cash & Equivalents', balance: cashEquivalents, rateType: cashRateType, rate: cashRate / 100, duration: cashDuration },
      { category: 'asset', subcategory: 'investments', name: 'Investment Securities', balance: investmentSecurities, rateType: investRateType, rate: investRate / 100, duration: investDuration },
      { category: 'asset', subcategory: 'loans', name: 'Net Loans & Leases', balance: netLoansLeases, rateType: loanRateType, rate: loanRate / 100, duration: loanDuration },
      { category: 'asset', subcategory: 'fixed_assets', name: 'Fixed Assets', balance: fixedAssets, rateType: fixedAssetRateType, rate: fixedAssetRate / 100, duration: fixedAssetDuration },
      { category: 'asset', subcategory: 'other', name: 'Other Assets', balance: otherAssets, rateType: otherAssetRateType, rate: otherAssetRate / 100, duration: otherAssetDuration },
      // Liabilities
      { category: 'liability', subcategory: 'deposits', name: 'Member Deposits / Shares', balance: memberDeposits, rateType: depositRateType, rate: depositRate / 100, duration: depositDuration },
      { category: 'liability', subcategory: 'borrowings', name: 'Borrowed Funds', balance: borrowedFunds, rateType: borrowRateType, rate: borrowRate / 100, duration: borrowDuration },
      { category: 'liability', subcategory: 'other', name: 'Other Liabilities', balance: otherLiabilities, rateType: otherLiabRateType, rate: otherLiabRate / 100, duration: otherLiabDuration },
    ].filter((item) => item.balance > 0);

    try {
      await apiClient.importBalanceSheetItems(institutionId, items);
      analytics.track(EVENTS.PORTAL_DATA_SUBMITTED, {
        source: 'balance_sheet_wizard',
        institutionId,
        totalAssets,
        totalLiabilities,
        netWorthRatio: netWorthRatio.toFixed(2),
      });
      setSubmitResult('success');
      try { localStorage.removeItem(autoSaveKey); } catch {}
      setTimeout(() => router.push(`/alm?id=${institutionId}`), 1500);
    } catch {
      setSubmitResult('error');
    } finally {
      setSubmitting(false);
    }
  };

  // Capital adequacy description
  const capitalAdequacyLabel = useMemo(() => {
    if (netWorthRatio >= 7) return { label: 'Well Capitalized', desc: 'Net Worth ratio meets COSSEC / NCUA top adequacy standard.', color: 'text-emerald-400 border-emerald-500/20 bg-emerald-500/5' };
    if (netWorthRatio >= 5) return { label: 'Adequately Capitalized', desc: 'Net worth ratio is positive but close to regulatory caution gates.', color: 'text-amber-400 border-amber-500/20 bg-amber-500/5' };
    return { label: 'Undercapitalized', desc: 'Capital adequacy ratio sits below safe thresholds. Potential regulatory action.', color: 'text-red-400 border-red-500/20 bg-red-500/5' };
  }, [netWorthRatio]);

  // ---- Render ----
  return (
    <div className="min-h-screen bg-[#020617] text-slate-100 px-4 py-8 sm:px-6 sm:py-12 relative overflow-hidden flex flex-col items-center justify-center">
      {/* Premium backdrop circles */}
      <div className="absolute top-[5%] right-[5%] w-[350px] h-[350px] rounded-full bg-cyan-500/5 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[5%] left-[5%] w-[350px] h-[350px] rounded-full bg-blue-500/5 blur-[120px] pointer-events-none" />
      
      <div className="max-w-2xl w-full relative z-10">
        {/* Language & Exit Header */}
        <div className="flex justify-between items-center mb-6">
          <button
            type="button"
            onClick={() => router.push('/onboarding')}
            className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-white transition"
          >
            <ArrowLeft className="h-3 w-3" />
            Back to Profile
          </button>
          
          <button
            type="button"
            onClick={() => setLang((l) => (l === 'en' ? 'es' : 'en'))}
            className="flex items-center gap-1.5 px-3 py-1 rounded-xl border border-slate-800 bg-slate-950/80 text-xs text-slate-400 hover:text-cyan-400 hover:border-cyan-500/20 transition font-bold"
            aria-label="Toggle language"
          >
            <Globe className="h-3.5 w-3.5 text-cyan-400" />
            {lang === 'en' ? 'ESPAÑOL' : 'ENGLISH'}
          </button>
        </div>

        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">{t('title', lang)}</h1>
          <p className="text-slate-400 mt-1.5 text-sm sm:text-base max-w-md mx-auto leading-relaxed">
            {t('subtitle', lang)}
          </p>
          {!institutionId && (
            <p className="mt-3 text-xs text-amber-400 font-medium">
              ⚠️ {lang === 'en' ? 'No active institution workspace connected. Free builders path enabled.' : 'Ninguna institución activa vinculada. Acceso para constructores libres activo.'}
            </p>
          )}
        </div>

        {/* High-Polished Stepper Nodes */}
        <div className="mb-8 bg-slate-900/40 backdrop-blur-md border border-slate-800/80 rounded-2xl p-4 sm:p-5 shadow-xl">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-4">
            <span>
              {t('step', lang)} {step + 1} {t('of', lang)} {STEP_KEYS.length}
            </span>
            <span className="flex items-center gap-1.5 font-bold uppercase tracking-wider text-cyan-400">
              <StepIcon className="h-3.5 w-3.5" />
              {t(currentStepKey, lang)}
              {currentStepKey === 'income' && (
                <span className="text-slate-500 font-normal ml-1">({t('optional', lang)})</span>
              )}
            </span>
          </div>

          {/* Stepper Nodes Line layout */}
          <div className="flex items-center justify-between relative mt-2 px-1">
            <div className="absolute top-1/2 left-0 right-0 h-[2px] bg-slate-800 -translate-y-1/2 z-0" />
            <div
              className="absolute top-1/2 left-0 h-[2px] bg-gradient-to-r from-cyan-500 to-blue-500 -translate-y-1/2 z-0 transition-all duration-350"
              style={{ width: `${(step / (STEP_KEYS.length - 1)) * 100}%` }}
            />
            
            {STEP_KEYS.map((key, i) => {
              const Icon = STEP_ICONS[key];
              const done = i < step;
              const active = i === step;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => {
                    if (i <= step || stepValid(step)) setStep(i);
                  }}
                  className={`relative z-10 flex flex-col items-center transition ${
                    active ? 'text-cyan-400' : done ? 'text-emerald-400 hover:text-emerald-300' : 'text-slate-600'
                  }`}
                  aria-label={t(key, lang)}
                >
                  <span
                    className={`flex items-center justify-center h-8 w-8 rounded-full border transition-all duration-300 ${
                      active
                        ? 'border-cyan-400 bg-cyan-950/80 ring-4 ring-cyan-500/20 text-cyan-400 font-bold scale-110 shadow-lg'
                        : done
                          ? 'border-emerald-500 bg-emerald-950/80 text-emerald-400'
                          : 'border-slate-800 bg-slate-950 text-slate-600'
                    }`}
                  >
                    {done ? (
                      <CheckCircle className="h-4 w-4" />
                    ) : (
                      <Icon className="h-4 w-4" />
                    )}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Card Body Container */}
        <div className="bg-slate-900/60 backdrop-blur-md border border-slate-800/80 rounded-2xl p-6 sm:p-8 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 left-0 h-[2px] bg-gradient-to-r from-cyan-500 to-blue-500 transition-all duration-350" style={{ width: `${progressPct}%` }} />
          <div className="absolute top-0 right-8 h-[1px] w-16 bg-gradient-to-r from-transparent via-cyan-500/30 to-transparent" />
          
          {/* -------- STEP 0 — Assets -------- */}
          {step === 0 && (
            <div className="space-y-6">
              <h2 className="text-lg font-bold flex items-center gap-2 text-white border-b border-slate-800/60 pb-3">
                <DollarSign className="h-5 w-5 text-cyan-400" />
                {t('assets', lang)}
              </h2>
              
              <div className="space-y-4">
                {/* Cash Segment */}
                <div className="bg-slate-900/30 border border-slate-800/40 rounded-xl p-4 transition-all hover:border-slate-800">
                  <CurrencyInput id="cashEquivalents" label={t('cashEquivalents', lang)} value={cashEquivalents} onChange={setCashEquivalents} />
                  <RateDurationRow rate={cashRate} onRateChange={setCashRate} duration={cashDuration} onDurationChange={setCashDuration} rateType={cashRateType} onRateTypeChange={setCashRateType} lang={lang} visible={cashEquivalents > 0} />
                </div>

                {/* Investments Segment */}
                <div className="bg-slate-900/30 border border-slate-800/40 rounded-xl p-4 transition-all hover:border-slate-800">
                  <CurrencyInput id="investmentSecurities" label={t('investmentSecurities', lang)} value={investmentSecurities} onChange={setInvestmentSecurities} />
                  <RateDurationRow rate={investRate} onRateChange={setInvestRate} duration={investDuration} onDurationChange={setInvestDuration} rateType={investRateType} onRateTypeChange={setInvestRateType} lang={lang} visible={investmentSecurities > 0} />
                </div>

                {/* Loans Segment */}
                <div className="bg-slate-900/30 border border-slate-800/40 rounded-xl p-4 transition-all hover:border-slate-800">
                  <CurrencyInput id="netLoansLeases" label={t('netLoansLeases', lang)} value={netLoansLeases} onChange={setNetLoansLeases} />
                  <RateDurationRow rate={loanRate} onRateChange={setLoanRate} duration={loanDuration} onDurationChange={setLoanDuration} rateType={loanRateType} onRateTypeChange={setLoanRateType} lang={lang} visible={netLoansLeases > 0} />
                </div>

                {/* Fixed Assets Segment */}
                <div className="bg-slate-900/30 border border-slate-800/40 rounded-xl p-4 transition-all hover:border-slate-800">
                  <CurrencyInput id="fixedAssets" label={t('fixedAssets', lang)} value={fixedAssets} onChange={setFixedAssets} />
                  <RateDurationRow rate={fixedAssetRate} onRateChange={setFixedAssetRate} duration={fixedAssetDuration} onDurationChange={setFixedAssetDuration} rateType={fixedAssetRateType} onRateTypeChange={setFixedAssetRateType} lang={lang} visible={fixedAssets > 0} />
                </div>

                {/* Other Assets Segment */}
                <div className="bg-slate-900/30 border border-slate-800/40 rounded-xl p-4 transition-all hover:border-slate-800">
                  <CurrencyInput id="otherAssets" label={t('otherAssets', lang)} value={otherAssets} onChange={setOtherAssets} />
                  <RateDurationRow rate={otherAssetRate} onRateChange={setOtherAssetRate} duration={otherAssetDuration} onDurationChange={setOtherAssetDuration} rateType={otherAssetRateType} onRateTypeChange={setOtherAssetRateType} lang={lang} visible={otherAssets > 0} />
                </div>

                {/* Combined Total */}
                <div className="pt-2">
                  <CurrencyInput id="totalAssets" label={t('totalAssets', lang)} value={totalAssets} readOnly computed />
                </div>
              </div>
            </div>
          )}

          {/* -------- STEP 1 — Liabilities -------- */}
          {step === 1 && (
            <div className="space-y-6">
              <h2 className="text-lg font-bold flex items-center gap-2 text-white border-b border-slate-800/60 pb-3">
                <Building2 className="h-5 w-5 text-cyan-400" />
                {t('liabilities', lang)}
              </h2>
              
              <div className="space-y-4">
                {/* Deposits Segment */}
                <div className="bg-slate-900/30 border border-slate-800/40 rounded-xl p-4 transition-all hover:border-slate-800">
                  <CurrencyInput id="memberDeposits" label={t('memberDeposits', lang)} value={memberDeposits} onChange={setMemberDeposits} />
                  <RateDurationRow rate={depositRate} onRateChange={setDepositRate} duration={depositDuration} onDurationChange={setDepositDuration} rateType={depositRateType} onRateTypeChange={setDepositRateType} lang={lang} visible={memberDeposits > 0} />
                </div>

                {/* Borrowings Segment */}
                <div className="bg-slate-900/30 border border-slate-800/40 rounded-xl p-4 transition-all hover:border-slate-800">
                  <CurrencyInput id="borrowedFunds" label={t('borrowedFunds', lang)} value={borrowedFunds} onChange={setBorrowedFunds} />
                  <RateDurationRow rate={borrowRate} onRateChange={setBorrowRate} duration={borrowDuration} onDurationChange={setBorrowDuration} rateType={borrowRateType} onRateTypeChange={setBorrowRateType} lang={lang} visible={borrowedFunds > 0} />
                </div>

                {/* Other Liabilities Segment */}
                <div className="bg-slate-900/30 border border-slate-800/40 rounded-xl p-4 transition-all hover:border-slate-800">
                  <CurrencyInput id="otherLiabilities" label={t('otherLiabilities', lang)} value={otherLiabilities} onChange={setOtherLiabilities} />
                  <RateDurationRow rate={otherLiabRate} onRateChange={setOtherLiabRate} duration={otherLiabDuration} onDurationChange={setOtherLiabDuration} rateType={otherLiabRateType} onRateTypeChange={setOtherLiabRateType} lang={lang} visible={otherLiabilities > 0} />
                </div>

                {/* Combined Total */}
                <div className="pt-2">
                  <CurrencyInput id="totalLiabilities" label={t('totalLiabilities', lang)} value={totalLiabilities} readOnly computed />
                </div>
              </div>
            </div>
          )}

          {/* -------- STEP 2 — Capital / Gauge -------- */}
          {step === 2 && (
            <div className="space-y-6 animate-fade-in">
              <h2 className="text-lg font-bold flex items-center gap-2 text-white border-b border-slate-800/60 pb-3">
                <Landmark className="h-5 w-5 text-cyan-400" />
                {t('capital', lang)}
              </h2>
              <p className="text-xs text-slate-400">
                {t('autoCalculated', lang)} from Asset and Liability inputs.
              </p>
              
              <div className="grid gap-4 sm:grid-cols-2">
                <CurrencyInput
                  id="netWorthEquity"
                  label={t('netWorthEquity', lang)}
                  value={netWorthEquity}
                  readOnly
                  computed
                />
                
                <div className="space-y-1.5">
                  <label htmlFor="netWorthRatio" className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
                    {t('netWorthRatio', lang)}
                    <span className="ml-2 text-[10px] text-cyan-400 font-bold uppercase tracking-widest scale-90">(auto)</span>
                  </label>
                  <input
                    id="netWorthRatio"
                    type="text"
                    readOnly
                    tabIndex={-1}
                    value={fmtPct(netWorthRatio)}
                    className="w-full rounded-xl border border-slate-900 pl-4 pr-4 py-3 text-sm bg-slate-950/60 text-cyan-400 font-mono cursor-default focus:outline-none"
                  />
                </div>
              </div>

              {/* Capital Adequacy Gauge (Overhauled visual segmented representation) */}
              <div className="mt-6 p-5 rounded-2xl border border-slate-800/80 bg-slate-950/40 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                  <div>
                    <span className="text-slate-500 text-[10px] uppercase font-bold tracking-wider">
                      Capital Adequacy Status
                    </span>
                    <h3 className={`text-md font-bold ${
                      netWorthRatio >= 7 ? 'text-emerald-400' : netWorthRatio >= 5 ? 'text-amber-400' : 'text-red-400'
                    }`}>
                      {capitalAdequacyLabel.label}
                    </h3>
                  </div>
                  <div className={`px-3 py-1 rounded-xl border text-xs font-medium leading-relaxed max-w-sm ${capitalAdequacyLabel.color}`}>
                    {capitalAdequacyLabel.desc}
                  </div>
                </div>

                {/* Progress bar gauge */}
                <div className="space-y-2">
                  <div className="h-3 rounded-full bg-slate-950 border border-slate-900 overflow-hidden relative">
                    <div
                      className={`h-full rounded-full transition-all duration-500 bg-gradient-to-r ${
                        netWorthRatio >= 7
                          ? 'from-cyan-500 to-emerald-500'
                          : netWorthRatio >= 5
                            ? 'from-cyan-500 to-amber-500'
                            : 'from-cyan-500 to-red-500'
                      }`}
                      style={{ width: `${Math.min(Math.max(netWorthRatio, 0), 20) * 5}%` }}
                    />
                    
                    {/* Ticks overlay */}
                    <div className="absolute top-0 bottom-0 left-[25%] w-[1px] bg-slate-800" />
                    <div className="absolute top-0 bottom-0 left-[35%] w-[1px] bg-slate-800" />
                    <div className="absolute top-0 bottom-0 left-[50%] w-[1px] bg-slate-800" />
                  </div>
                  
                  {/* Gauge Legends */}
                  <div className="flex justify-between text-[9px] font-bold text-slate-500 font-mono">
                    <span>0% (Crit)</span>
                    <span>5% (Adeq)</span>
                    <span>7% (Well)</span>
                    <span>10%</span>
                    <span>20%+</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* -------- STEP 3 — Income Statement -------- */}
          {step === 3 && (
            <div className="space-y-6 animate-fade-in">
              <h2 className="text-lg font-bold flex items-center gap-2 text-white border-b border-slate-800/60 pb-3">
                <TrendingUp className="h-5 w-5 text-cyan-400" />
                {t('income', lang)}
                <span className="text-xs text-slate-500 font-normal">
                  ({t('optional', lang)})
                </span>
              </h2>
              
              <div className="grid gap-4 sm:grid-cols-2">
                <CurrencyInput id="interestIncome" label={t('interestIncome', lang)} value={interestIncome} onChange={setInterestIncome} />
                <CurrencyInput id="interestExpense" label={t('interestExpense', lang)} value={interestExpense} onChange={setInterestExpense} />
                <div className="sm:col-span-2 border-t border-slate-800/40 my-1 pt-1" />
                <CurrencyInput id="netInterestIncome" label={t('netInterestIncome', lang)} value={netInterestIncome} readOnly computed />
                <div className="sm:col-span-2 border-t border-slate-800/40 my-1 pt-1" />
                <CurrencyInput id="nonInterestIncome" label={t('nonInterestIncome', lang)} value={nonInterestIncome} onChange={setNonInterestIncome} />
                <CurrencyInput id="nonInterestExpense" label={t('nonInterestExpense', lang)} value={nonInterestExpense} onChange={setNonInterestExpense} />
                <div className="sm:col-span-2 border-t border-slate-800/40 my-1 pt-1" />
                <CurrencyInput id="netIncome" label={t('netIncome', lang)} value={netIncome} readOnly computed />
              </div>
            </div>
          )}

          {/* -------- STEP 4 — Collapsible Review -------- */}
          {step === 4 && (
            <div className="space-y-6 animate-fade-in">
              <h2 className="text-lg font-bold flex items-center gap-2 text-white border-b border-slate-800/60 pb-2">
                <ClipboardList className="h-5 w-5 text-cyan-400" />
                {t('review', lang)}
              </h2>

              <div className="space-y-3">
                {/* 1. Assets Collapsible Card */}
                <div className="border border-slate-850 rounded-xl overflow-hidden bg-slate-950/40">
                  <button
                    type="button"
                    onClick={() => toggleSection('assets')}
                    className="w-full flex items-center justify-between p-4 text-sm font-bold text-white hover:bg-slate-900/30 transition-colors"
                  >
                    <span className="flex items-center gap-2">
                      <DollarSign className="h-4 w-4 text-cyan-400" />
                      {t('assets', lang)}
                    </span>
                    <span className="flex items-center gap-2 text-xs font-mono font-normal text-slate-400">
                      Total: {fmtDollar(totalAssets)}
                      {openSections.assets ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </span>
                  </button>
                  {openSections.assets && (
                    <div className="px-4 pb-4 border-t border-slate-900 divide-y divide-slate-900/60 text-xs animate-fade-in">
                      <div className="flex justify-between py-2.5">
                        <span className="text-slate-400">{t('cashEquivalents', lang)}</span>
                        <span className="text-white font-mono">{fmtDollar(cashEquivalents)}</span>
                      </div>
                      <div className="flex justify-between py-2.5">
                        <span className="text-slate-400">{t('investmentSecurities', lang)}</span>
                        <span className="text-white font-mono">{fmtDollar(investmentSecurities)}</span>
                      </div>
                      <div className="flex justify-between py-2.5">
                        <span className="text-slate-400">{t('netLoansLeases', lang)}</span>
                        <span className="text-white font-mono">{fmtDollar(netLoansLeases)}</span>
                      </div>
                      <div className="flex justify-between py-2.5">
                        <span className="text-slate-400">{t('fixedAssets', lang)}</span>
                        <span className="text-white font-mono">{fmtDollar(fixedAssets)}</span>
                      </div>
                      <div className="flex justify-between py-2.5">
                        <span className="text-slate-400">{t('otherAssets', lang)}</span>
                        <span className="text-white font-mono">{fmtDollar(otherAssets)}</span>
                      </div>
                      <div className="flex justify-between py-2.5 font-bold text-cyan-400 bg-cyan-950/5 rounded px-2 -mx-2">
                        <span>{t('totalAssets', lang)}</span>
                        <span className="font-mono">{fmtDollar(totalAssets)}</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* 2. Liabilities Collapsible Card */}
                <div className="border border-slate-850 rounded-xl overflow-hidden bg-slate-950/40">
                  <button
                    type="button"
                    onClick={() => toggleSection('liabilities')}
                    className="w-full flex items-center justify-between p-4 text-sm font-bold text-white hover:bg-slate-900/30 transition-colors"
                  >
                    <span className="flex items-center gap-2">
                      <Building2 className="h-4 w-4 text-cyan-400" />
                      {t('liabilities', lang)}
                    </span>
                    <span className="flex items-center gap-2 text-xs font-mono font-normal text-slate-400">
                      Total: {fmtDollar(totalLiabilities)}
                      {openSections.liabilities ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </span>
                  </button>
                  {openSections.liabilities && (
                    <div className="px-4 pb-4 border-t border-slate-900 divide-y divide-slate-900/60 text-xs animate-fade-in">
                      <div className="flex justify-between py-2.5">
                        <span className="text-slate-400">{t('memberDeposits', lang)}</span>
                        <span className="text-white font-mono">{fmtDollar(memberDeposits)}</span>
                      </div>
                      <div className="flex justify-between py-2.5">
                        <span className="text-slate-400">{t('borrowedFunds', lang)}</span>
                        <span className="text-white font-mono">{fmtDollar(borrowedFunds)}</span>
                      </div>
                      <div className="flex justify-between py-2.5">
                        <span className="text-slate-400">{t('otherLiabilities', lang)}</span>
                        <span className="text-white font-mono">{fmtDollar(otherLiabilities)}</span>
                      </div>
                      <div className="flex justify-between py-2.5 font-bold text-cyan-400 bg-cyan-950/5 rounded px-2 -mx-2">
                        <span>{t('totalLiabilities', lang)}</span>
                        <span className="font-mono">{fmtDollar(totalLiabilities)}</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* 3. Capital adequacy section */}
                <div className="border border-slate-850 rounded-xl overflow-hidden bg-slate-950/40">
                  <button
                    type="button"
                    onClick={() => toggleSection('capital')}
                    className="w-full flex items-center justify-between p-4 text-sm font-bold text-white hover:bg-slate-900/30 transition-colors"
                  >
                    <span className="flex items-center gap-2">
                      <Landmark className="h-4 w-4 text-cyan-400" />
                      {t('capital', lang)}
                    </span>
                    <span className="flex items-center gap-2 text-xs font-mono font-normal text-slate-400">
                      Ratio: {fmtPct(netWorthRatio)}
                      {openSections.capital ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </span>
                  </button>
                  {openSections.capital && (
                    <div className="px-4 pb-4 border-t border-slate-900 divide-y divide-slate-900/60 text-xs animate-fade-in">
                      <div className="flex justify-between py-2.5">
                        <span className="text-slate-400">{t('netWorthEquity', lang)}</span>
                        <span className="text-white font-mono">{fmtDollar(netWorthEquity)}</span>
                      </div>
                      <div className="flex justify-between py-2.5">
                        <span className="text-slate-400">{t('netWorthRatio', lang)}</span>
                        <span className="text-cyan-400 font-mono font-bold">{fmtPct(netWorthRatio)}</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* 4. Income statement collapsible (optional) */}
                <div className="border border-slate-850 rounded-xl overflow-hidden bg-slate-950/40">
                  <button
                    type="button"
                    onClick={() => toggleSection('income')}
                    className="w-full flex items-center justify-between p-4 text-sm font-bold text-white hover:bg-slate-900/30 transition-colors"
                  >
                    <span className="flex items-center gap-2">
                      <TrendingUp className="h-4 w-4 text-cyan-400" />
                      {t('income', lang)}
                    </span>
                    <span className="flex items-center gap-2 text-xs font-mono font-normal text-slate-400">
                      {openSections.income ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </span>
                  </button>
                  {openSections.income && (
                    <div className="px-4 pb-4 border-t border-slate-900 divide-y divide-slate-900/60 text-xs animate-fade-in">
                      <div className="flex justify-between py-2.5">
                        <span className="text-slate-400">{t('interestIncome', lang)}</span>
                        <span className="text-white font-mono">{fmtDollar(interestIncome)}</span>
                      </div>
                      <div className="flex justify-between py-2.5">
                        <span className="text-slate-400">{t('interestExpense', lang)}</span>
                        <span className="text-white font-mono">{fmtDollar(interestExpense)}</span>
                      </div>
                      <div className="flex justify-between py-2.5">
                        <span className="text-slate-400">{t('netInterestIncome', lang)}</span>
                        <span className="text-white font-mono">{fmtDollar(netInterestIncome)}</span>
                      </div>
                      <div className="flex justify-between py-2.5">
                        <span className="text-slate-400">{t('nonInterestIncome', lang)}</span>
                        <span className="text-white font-mono">{fmtDollar(nonInterestIncome)}</span>
                      </div>
                      <div className="flex justify-between py-2.5">
                        <span className="text-slate-400">{t('nonInterestExpense', lang)}</span>
                        <span className="text-white font-mono">{fmtDollar(nonInterestExpense)}</span>
                      </div>
                      <div className="flex justify-between py-2.5 font-bold text-cyan-400 bg-cyan-950/5 rounded px-2 -mx-2">
                        <span>{t('netIncome', lang)}</span>
                        <span className="font-mono">{fmtDollar(netIncome)}</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Submit result messages */}
              {submitResult === 'success' && (
                <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3.5 text-xs text-emerald-300 flex items-center gap-2.5 animate-fade-in font-medium">
                  <CheckCircle className="h-4 w-4 text-emerald-400 flex-shrink-0" />
                  {t('submitSuccess', lang)}
                </div>
              )}
              {submitResult === 'error' && (
                <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3.5 text-xs text-red-400 animate-fade-in font-medium">
                  {!localStorage.getItem('cerniq_current_institution_id')
                    ? t('institutionIdMissing', lang)
                    : t('submitError', lang)}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Wizard Controls */}
        <div className="flex items-center justify-between mt-6">
          <button
            type="button"
            onClick={goBack}
            disabled={step === 0}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-800 text-slate-450 text-xs font-bold uppercase tracking-wider hover:text-white hover:border-slate-700 transition disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            {t('back', lang)}
          </button>

          {/* Skip button for income step */}
          {step === 3 && (
            <button
              type="button"
              onClick={goNext}
              className="text-slate-500 hover:text-slate-300 text-xs transition"
            >
              {t('skipStep', lang)}
            </button>
          )}

          {isLast ? (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting || !stepValid(step) || submitResult === 'success'}
              className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-[#020617] font-bold text-xs rounded-xl transition disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-cyan-500/10"
            >
              {submitting ? (
                <>
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                  {t('submitting', lang)}
                </>
              ) : (
                <>
                  <CheckCircle className="h-3.5 w-3.5" />
                  {t('submit', lang)}
                </>
              )}
            </button>
          ) : (
            <button
              type="button"
              onClick={goNext}
              disabled={!stepValid(step)}
              className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-[#020617] font-bold text-xs rounded-xl transition disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-cyan-500/10"
            >
              {t('next', lang)}
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
