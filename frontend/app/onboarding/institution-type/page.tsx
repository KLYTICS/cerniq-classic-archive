'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api';
import { analytics, EVENTS } from '@/lib/analytics';
import {
  Landmark,
  Users,
  Briefcase,
  Building,
  ArrowRight,
  ArrowLeft,
  CheckCircle,
  Database,
  Calculator,
  FileText,
  Settings,
  Sparkles,
  Check,
} from 'lucide-react';

type InstitutionType = 'bank' | 'credit_union' | 'family_office' | 'cooperativa';

interface TypeOption {
  type: InstitutionType;
  icon: React.ElementType;
  title: string;
  description: string;
  size: string;
  color: string;
  borderColor: string;
  glowColor: string;
  manifest: string[];
}

const options: TypeOption[] = [
  {
    type: 'bank',
    icon: Landmark,
    title: 'Community Bank',
    description: 'Full ALM suite with duration gap, NII sensitivity, and Basel III regulatory stress testing.',
    size: '$500M–$5B Assets',
    color: 'from-amber-500/10 to-orange-500/5',
    borderColor: 'border-slate-800 hover:border-amber-500/40',
    glowColor: 'group-hover:shadow-amber-500/5',
    manifest: ['Seeds 8 balance sheet lines', 'Yield curve repricing shock scenario', 'FDIC / Basel IRRBB report templates'],
  },
  {
    type: 'credit_union',
    icon: Users,
    title: 'Credit Union',
    description: 'Member-focused ALM with deposit repricing, loan concentration, and CAMEL framework.',
    size: '$50M–$500M Assets',
    color: 'from-emerald-500/10 to-teal-500/5',
    borderColor: 'border-slate-800 hover:border-emerald-500/40',
    glowColor: 'group-hover:shadow-emerald-500/5',
    manifest: ['Seeds 7 balance sheet categories', 'Share deposit pricing sensitivity beta', 'NCUA CAMEL ratios worksheet'],
  },
  {
    type: 'cooperativa',
    icon: Building,
    title: 'Cooperativa PR',
    description: 'ALM para cooperativas de ahorro y crédito. COSSEC compliance, análisis de riesgo y reportes regulatorios.',
    size: '$50M–$500M Activos',
    color: 'from-cyan-500/10 to-blue-500/5',
    borderColor: 'border-slate-800 hover:border-cyan-500/40',
    glowColor: 'group-hover:shadow-cyan-500/5',
    manifest: ['Seeds 8 balance sheet lines (ES/EN)', 'COSSEC 12-ratio regulatory limits', 'Bilingual board-ready report template'],
  },
  {
    type: 'family_office',
    icon: Briefcase,
    title: 'Family Office',
    description: 'Portfolio-level risk with equity exposure, real estate duration, and liquidity monitoring.',
    size: '$10M–$500M AUM',
    color: 'from-purple-500/10 to-indigo-500/5',
    borderColor: 'border-slate-800 hover:border-purple-500/40',
    glowColor: 'group-hover:shadow-purple-500/5',
    manifest: ['Seeds 5 asset portfolios + cash lines', 'Equity index volatility models', 'Custom risk profile & AUM summary reports'],
  },
];

type PrimaryRegulator = 'COSSEC' | 'NCUA';

const regulatorOptions: Array<{ value: PrimaryRegulator; label: string; description: string }> = [
  {
    value: 'COSSEC',
    label: 'COSSEC (PR Cooperativas)',
    description: '12-ratio framework compliance reporting for Puerto Rico.',
  },
  {
    value: 'NCUA',
    label: 'NCUA (US Credit Unions)',
    description: 'CAMEL ratios and regulatory posture checklists.',
  },
];

interface SeedingStep {
  label: string;
  icon: React.ElementType;
}

const seedingSteps: SeedingStep[] = [
  { label: 'Provisioning secure workspace & API endpoints', icon: Settings },
  { label: 'Seeding mock financial balance sheet entries', icon: Database },
  { label: 'Applying regulatory framework ratio triggers', icon: Calculator },
  { label: 'Generating initial board-ready preview reports', icon: FileText },
  { label: 'Finalizing setup & routing to dashboard cockpit', icon: CheckCircle },
];

export default function InstitutionTypePage() {
  const router = useRouter();
  const [selected, setSelected] = useState<InstitutionType | null>(null);
  const [regulator, setRegulator] = useState<PrimaryRegulator>('COSSEC');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Simulated progressive stepper state
  const [activeStepIndex, setActiveStepIndex] = useState(0);

  const showRegulatorPicker = selected === 'credit_union' || selected === 'cooperativa';

  const handleSelect = (type: InstitutionType) => {
    setSelected(type);
    if (type === 'cooperativa') setRegulator('COSSEC');
    else if (type === 'credit_union') setRegulator('NCUA');
    analytics.track(EVENTS.INSTITUTION_TYPE_SELECTED, { type });
  };

  // Simulated setup step timer during seeding
  useEffect(() => {
    if (!loading) return;

    const interval = setInterval(() => {
      setActiveStepIndex((prev) => {
        if (prev < seedingSteps.length - 1) {
          return prev + 1;
        }
        return prev;
      });
    }, 800);

    return () => clearInterval(interval);
  }, [loading]);

  const handleContinue = async () => {
    if (!selected) return;
    setLoading(true);
    setError(null);
    setActiveStepIndex(0);

    try {
      // 1. Fetch workspaces or create demo workspace
      const existingWorkspaces = await apiClient.getMyWorkspaces().catch(() => []);
      const primaryWorkspace =
        Array.isArray(existingWorkspaces) && existingWorkspaces.length > 0
          ? existingWorkspaces[0]
          : await apiClient.createMyWorkspace(`${selected} Demo Workspace`);

      // 2. Call seed API
      const result = await apiClient.seedDemoInstitution(primaryWorkspace.id, selected);
      
      analytics.track(EVENTS.DEMO_DATA_SEEDED, {
        type: selected,
        institutionId: result.institutionId,
      });

      // 3. Ensure we finish simulated steps before routing to make it feel organic
      const waitTime = Math.max(0, (seedingSteps.length - 1 - activeStepIndex) * 800 + 400);
      setTimeout(() => {
        router.push(`/alm?id=${result.institutionId}`);
      }, waitTime);

    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to set up demo';
      setError(message);
      setLoading(false);
    }
  };

  const handleSkip = () => {
    analytics.track(EVENTS.ONBOARDING_SKIPPED, { step: 'institution-type' });
    router.push('/onboarding/balance-sheet');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#020617] text-white flex items-center justify-center p-6 relative overflow-hidden">
        {/* Gradients */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[350px] h-[350px] rounded-full bg-cyan-500/10 blur-[100px] pointer-events-none" />
        
        <div className="max-w-md w-full bg-slate-900/60 backdrop-blur-lg border border-slate-800/80 rounded-2xl p-8 shadow-2xl relative text-center">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 h-[2px] w-20 bg-cyan-500" />
          
          {/* Pulsing Loading Spinner */}
          <div className="flex justify-center mb-8 relative">
            <div className="h-16 w-16 rounded-full border-2 border-cyan-500/10 border-t-cyan-500 animate-spin" />
            <div className="absolute inset-0 flex items-center justify-center">
              <Sparkles className="h-5 w-5 text-cyan-400 animate-pulse" />
            </div>
          </div>

          <h2 className="text-xl font-bold mb-1 text-white">Seeding Demo Dataset</h2>
          <p className="text-xs text-slate-400 mb-8">
            Please wait while Cerniq provisions assets, balance tables, and regulatory rule configurations.
          </p>

          {/* Stepper Steps */}
          <div className="space-y-4 text-left max-w-sm mx-auto">
            {seedingSteps.map((step, idx) => {
              const StepIcon = step.icon;
              const isDone = idx < activeStepIndex;
              const isActive = idx === activeStepIndex;
              return (
                <div
                  key={idx}
                  className={`flex items-center gap-3 transition-all duration-300 ${
                    isDone ? 'opacity-100 text-emerald-400' : isActive ? 'opacity-100 text-cyan-400 font-medium' : 'opacity-40 text-slate-500'
                  }`}
                >
                  <div className={`h-6 w-6 rounded-full flex items-center justify-center border text-xs flex-shrink-0 transition-colors ${
                    isDone 
                      ? 'border-emerald-500 bg-emerald-500/10' 
                      : isActive 
                        ? 'border-cyan-500 bg-cyan-500/10 animate-pulse' 
                        : 'border-slate-800 bg-slate-950'
                  }`}>
                    {isDone ? <Check className="h-3 w-3" /> : idx + 1}
                  </div>
                  <div className="flex items-center gap-2 text-xs truncate">
                    <StepIcon className="h-3.5 w-3.5" />
                    <span>{step.label}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#020617] text-slate-100 flex items-center justify-center p-4 sm:p-6 relative overflow-hidden">
      {/* Background patterns */}
      <div className="absolute top-[10%] right-[10%] w-[40%] h-[40%] rounded-full bg-cyan-500/5 blur-[100px] pointer-events-none" />
      <div className="absolute bottom-[10%] left-[10%] w-[40%] h-[40%] rounded-full bg-blue-600/5 blur-[100px] pointer-events-none" />
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b_1px,transparent_1px),linear-gradient(to_bottom,#1e293b_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] opacity-[0.12] pointer-events-none" />

      <div className="max-w-5xl w-full relative z-10">
        
        {/* Header */}
        <div className="text-center mb-10 max-w-2xl mx-auto">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-cyan-500/20 bg-cyan-950/20 text-xs text-cyan-400 font-semibold mb-4">
            <Sparkles className="h-3.5 w-3.5" />
            Sandbox Demo Pipeline
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white mb-3">
            Choose a Demo Template
          </h1>
          <p className="text-slate-400 text-sm leading-relaxed">
            Fast-track your onboarding by seeding a pre-configured demo institution. Perfect for evaluating sandbox scenarios, bilingual PDF layouts, and risk solvers instantly.
          </p>
        </div>

        {/* Card Options */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          {options.map((opt) => {
            const Icon = opt.icon;
            const isSelected = selected === opt.type;
            return (
              <button
                key={opt.type}
                onClick={() => handleSelect(opt.type)}
                className={`text-left rounded-2xl border-2 p-6 transition-all duration-300 relative overflow-hidden group flex flex-col justify-between min-h-[220px] bg-gradient-to-br ${opt.color} ${opt.borderColor} ${
                  isSelected
                    ? 'border-cyan-500 ring-4 ring-cyan-500/10 bg-slate-900/60 shadow-xl'
                    : 'bg-slate-900/30 hover:bg-slate-900/50 shadow-md'
                }`}
              >
                {/* Selection Check Circle */}
                {isSelected && (
                  <div className="absolute top-4 right-4 h-6 w-6 rounded-full bg-cyan-500 flex items-center justify-center shadow-lg">
                    <Check className="h-3.5 w-3.5 text-[#020617] stroke-[3px]" />
                  </div>
                )}

                <div>
                  <div className="flex items-center gap-3 mb-4">
                    <div className={`p-2.5 rounded-xl border transition-colors ${
                      isSelected ? 'border-cyan-400/40 bg-cyan-950/40 text-cyan-400' : 'border-slate-800 bg-slate-950 text-slate-400 group-hover:text-white'
                    }`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-white leading-none mb-1">{opt.title}</h3>
                      <span className="text-[10px] uppercase font-mono tracking-wider text-slate-500 font-semibold">{opt.size}</span>
                    </div>
                  </div>
                  
                  <p className="text-xs text-slate-400 mb-5 leading-relaxed">
                    {opt.description}
                  </p>
                </div>

                {/* Data Manifest Labels */}
                <div className="border-t border-slate-800/60 pt-4 w-full">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2">
                    Included in Sandbox Seeding:
                  </div>
                  <ul className="space-y-1 text-[11px] text-slate-400">
                    {opt.manifest.map((item, i) => (
                      <li key={i} className="flex items-center gap-1.5 truncate">
                        <CheckCircle className="h-3 w-3 text-cyan-500/80 flex-shrink-0" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </button>
            );
          })}
        </div>

        {/* Primary Regulator Selection (For Credit Union & Cooperativa) */}
        {showRegulatorPicker && (
          <div className="mb-10 max-w-xl mx-auto bg-slate-900/40 backdrop-blur-md border border-slate-800/80 rounded-2xl p-5 animate-fade-in">
            <h3 className="text-sm font-semibold text-white mb-3 text-center">
              Select Regulatory Framework
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {regulatorOptions.map((opt) => {
                const isRegSelected = regulator === opt.value;
                return (
                  <button
                    key={opt.value}
                    onClick={() => setRegulator(opt.value)}
                    className={`text-left rounded-xl border p-4 transition-all ${
                      isRegSelected
                        ? 'border-cyan-500 bg-cyan-950/20 text-cyan-300 ring-2 ring-cyan-500/20'
                        : 'border-slate-800 hover:border-slate-700 bg-slate-950/40 text-slate-400 hover:text-white'
                    }`}
                  >
                    <h4 className="text-xs font-bold text-white mb-0.5">{opt.label}</h4>
                    <p className="text-[10px] text-slate-400 leading-tight">
                      {opt.description}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-red-400 text-xs mb-6 max-w-xl mx-auto">
            {error}
          </div>
        )}

        {/* Actions bar */}
        <div className="flex items-center justify-between border-t border-slate-800/60 pt-6">
          <button
            onClick={() => router.push('/onboarding')}
            className="flex items-center gap-2 text-slate-400 hover:text-white text-xs font-medium transition"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to profile entry
          </button>
          
          <div className="flex items-center gap-5">
            <button
              onClick={handleSkip}
              className="text-slate-500 hover:text-slate-300 text-xs transition"
            >
              Skip seeding — go to manual wizard
            </button>
            <button
              onClick={handleContinue}
              disabled={!selected}
              className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-[#020617] font-bold text-xs rounded-xl transition disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-cyan-500/10"
            >
              Load Demo Data
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
