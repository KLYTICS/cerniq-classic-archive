'use client';

import { Suspense, useEffect, useState, useRef } from 'react';
import { apiClient } from '@/lib/api';
import { useRouter, useSearchParams } from 'next/navigation';
import { Building2, CheckCircle, ChevronRight, Shield, TrendingUp, Droplets } from 'lucide-react';

const PRESETS: Record<string, { name: string; assets: string; assetBucket: string; type: string }> = {
  'banco-comunidad': { name: 'Banco Comunidad PR', assets: '$1.2B', assetBucket: '$1B - $5B', type: 'bank' },
  bank: { name: 'Banco Comunidad PR', assets: '$1.2B', assetBucket: '$1B - $5B', type: 'bank' },
  credit_union: { name: 'Cooperativa del Pueblo', assets: '$180M', assetBucket: '$100M - $500M', type: 'credit_union' },
  family_office: { name: 'Caribbean Family Capital', assets: '$45M', assetBucket: 'Under $100M', type: 'family_office' },
};

const PROGRESS_STEPS = [
  { text: 'Loading balance sheet positions', delay: 600 },
  { text: 'Running NII sensitivity scenarios', delay: 800 },
  { text: 'Calculating Basel III compliance', delay: 700 },
  { text: 'Generating risk assessment', delay: 500 },
];

function DemoContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [step, setStep] = useState(1);
  const [error, setError] = useState<string | null>(null);

  // Step 1 form state
  const preset = searchParams.get('preset') || searchParams.get('type') || 'bank';
  const defaults = PRESETS[preset] || PRESETS.bank;
  const [instName, setInstName] = useState(defaults.name);
  const [instType, setInstType] = useState(defaults.type);

  // Step 2 progress state
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);
  const [progressPct, setProgressPct] = useState(0);

  // Step 3 results
  const [results, setResults] = useState<{
    riskScore: number;
    lcr: number;
    durationGap: number;
    niiImpact: string;
    institutionId: string;
  } | null>(null);

  const runningRef = useRef(false);

  const startSetup = async () => {
    if (runningRef.current) return;
    runningRef.current = true;
    setStep(2);
    setCompletedSteps([]);
    setProgressPct(0);
    setError(null);

    try {
      // Auto-register with generated credentials
      const ts = Date.now();
      const email = `demo-${ts}@capexcycle.demo`;
      const password = `Demo${ts}X`;

      // Check if already logged in
      let loggedIn = false;
      try {
        await apiClient.getCurrentUser();
        loggedIn = true;
      } catch {
        // Not logged in
      }

      if (!loggedIn) {
        try {
          await apiClient.register(email, password);
        } catch {
          // May already exist — try login
          try {
            await apiClient.login(email, password);
          } catch {
            // Last resort — try with existing session
          }
        }
      }

      // Animate step 0
      setCompletedSteps([0]);
      setProgressPct(25);

      // Get or create workspace
      let workspaceId: string;
      try {
        const workspaces = await apiClient.getMyWorkspaces();
        if (Array.isArray(workspaces) && workspaces.length > 0) {
          workspaceId = workspaces[0].id;
        } else {
          const created = await apiClient.createMyWorkspace('Demo Workspace');
          workspaceId = created.id;
        }
      } catch {
        const created = await apiClient.createMyWorkspace('Demo Workspace');
        workspaceId = created.id;
      }

      // Check if already seeded
      let institutions: any[] = [];
      try {
        institutions = await apiClient.getInstitutions();
      } catch { /* */ }

      // Animate step 1
      setCompletedSteps([0, 1]);
      setProgressPct(50);

      let institutionId: string;
      if (institutions.length > 0) {
        institutionId = institutions[0].id;
      } else {
        const result = await apiClient.seedDemoInstitution(workspaceId, instType as 'bank' | 'credit_union' | 'family_office');
        institutionId = result?.institutionId || result?.institution?.id || result?.id;
      }

      // Animate step 2
      setCompletedSteps([0, 1, 2]);
      setProgressPct(75);

      // Fetch summary for results preview
      let riskScore = 87, lcr = 118.1, durationGap = 0.12, niiImpact = '+$4.2M';
      try {
        const summary = await apiClient.getALMSummary(institutionId);
        riskScore = summary.riskScore || 87;
        lcr = summary.liquidity?.lcr || 118.1;
        durationGap = summary.durationGap?.durationGap || 0.12;
        const scenario100 = summary.niiSensitivity?.scenarios?.find((s: any) => s.shiftBps === 100);
        if (scenario100) {
          niiImpact = `${scenario100.niImpact >= 0 ? '+' : ''}$${Math.abs(scenario100.niImpact).toFixed(1)}M`;
        }
      } catch { /* use defaults */ }

      // Animate step 3
      setCompletedSteps([0, 1, 2, 3]);
      setProgressPct(100);

      // Brief pause to let the animation complete
      await new Promise((r) => setTimeout(r, 400));

      setResults({ riskScore, lcr, durationGap, niiImpact, institutionId });
      setStep(3);
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Setup failed. Please try again.');
      runningRef.current = false;
    }
  };

  if (error) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-center px-6">
        <div className="w-12 h-12 bg-red-500/20 rounded-xl flex items-center justify-center mb-6">
          <span className="text-red-400 font-bold text-xl">!</span>
        </div>
        <h2 className="text-white text-xl font-bold mb-2">Setup Failed</h2>
        <p className="text-slate-400 text-sm mb-6 max-w-md">{error}</p>
        <button
          onClick={() => { setError(null); setStep(1); runningRef.current = false; }}
          className="bg-amber-500 hover:bg-amber-400 text-slate-900 font-semibold px-6 py-2.5 rounded-lg transition"
        >
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        {/* Brand */}
        <div className="text-center mb-8">
          <div className="w-10 h-10 bg-gradient-to-br from-amber-400 to-orange-500 rounded-xl flex items-center justify-center mx-auto mb-3">
            <span className="text-slate-900 font-bold text-lg">C</span>
          </div>
          <p className="text-[11px] text-slate-600 uppercase tracking-widest">CapexCycleOS</p>
        </div>

        {/* Step 1: Institution Setup */}
        {step === 1 && (
          <div className="bg-slate-900/60 border border-white/[0.08] rounded-2xl p-6">
            <h2 className="text-lg font-bold text-white mb-1">Set up your institution</h2>
            <p className="text-xs text-slate-500 mb-6">Takes about 10 seconds</p>

            <div className="space-y-4">
              <div>
                <label className="block text-[11px] uppercase tracking-wider text-slate-500 mb-1.5">Institution Name</label>
                <input
                  type="text"
                  value={instName}
                  onChange={(e) => setInstName(e.target.value)}
                  className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-amber-500/50 transition"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] uppercase tracking-wider text-slate-500 mb-1.5">Asset Size</label>
                  <select
                    defaultValue={defaults.assetBucket}
                    className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-amber-500/50 transition appearance-none"
                  >
                    <option className="bg-slate-800">Under $100M</option>
                    <option className="bg-slate-800">$100M - $500M</option>
                    <option className="bg-slate-800">$500M - $1B</option>
                    <option className="bg-slate-800">$1B - $5B</option>
                    <option className="bg-slate-800">$5B+</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] uppercase tracking-wider text-slate-500 mb-1.5">Type</label>
                  <select
                    value={instType}
                    onChange={(e) => setInstType(e.target.value)}
                    className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-amber-500/50 transition appearance-none"
                  >
                    <option value="bank" className="bg-slate-800">Community Bank</option>
                    <option value="credit_union" className="bg-slate-800">Credit Union</option>
                    <option value="family_office" className="bg-slate-800">Family Office</option>
                  </select>
                </div>
              </div>
            </div>

            <button
              onClick={startSetup}
              className="w-full mt-6 flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-400 text-slate-900 font-semibold py-3 rounded-lg transition text-sm"
            >
              Continue <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Step 2: Animated Progress */}
        {step === 2 && (
          <div className="bg-slate-900/60 border border-white/[0.08] rounded-2xl p-6">
            <h2 className="text-lg font-bold text-white mb-1">Creating your ALM profile</h2>
            <p className="text-xs text-slate-500 mb-6">{instName}</p>

            {/* Progress bar */}
            <div className="h-1.5 bg-white/[0.04] rounded-full overflow-hidden mb-6">
              <div
                className="h-full bg-amber-500 rounded-full transition-all duration-700 ease-out"
                style={{ width: `${progressPct}%` }}
              />
            </div>

            {/* Sequential messages */}
            <div className="space-y-3">
              {PROGRESS_STEPS.map((s, i) => {
                const done = completedSteps.includes(i);
                const current = !done && completedSteps.length === i;
                return (
                  <div
                    key={i}
                    className={`flex items-center gap-3 transition-all duration-300 ${
                      done ? 'opacity-100' : current ? 'opacity-70' : 'opacity-20'
                    }`}
                  >
                    {done ? (
                      <CheckCircle className="h-4 w-4 text-emerald-400 shrink-0" />
                    ) : current ? (
                      <div className="w-4 h-4 border-2 border-amber-500/40 border-t-amber-500 rounded-full animate-spin shrink-0" />
                    ) : (
                      <div className="w-4 h-4 rounded-full border border-white/[0.08] shrink-0" />
                    )}
                    <span className={`text-sm ${done ? 'text-slate-300' : 'text-slate-500'}`}>
                      {s.text}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Step 3: Results Preview */}
        {step === 3 && results && (
          <div className="bg-slate-900/60 border border-white/[0.08] rounded-2xl p-6">
            <div className="flex items-center gap-2 mb-1">
              <CheckCircle className="h-5 w-5 text-emerald-400" />
              <h2 className="text-lg font-bold text-white">Your ALM dashboard is ready</h2>
            </div>
            <p className="text-xs text-slate-500 mb-6">{instName}</p>

            {/* Risk Score Badge */}
            <div className="flex items-center justify-center mb-6">
              <div className="relative">
                <div className="w-24 h-24 rounded-full border-4 border-amber-500/30 flex items-center justify-center">
                  <div className="text-center">
                    <span className="text-3xl font-bold text-white tabular-nums">{results.riskScore}</span>
                    <span className="text-xs text-slate-500 block -mt-0.5">/100</span>
                  </div>
                </div>
                <span className="absolute -bottom-2 left-1/2 -translate-x-1/2 text-[10px] font-bold uppercase tracking-wider bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded-full whitespace-nowrap">
                  Moderate
                </span>
              </div>
            </div>

            {/* Highlight Stats */}
            <div className="grid grid-cols-3 gap-px bg-white/[0.03] rounded-xl overflow-hidden border border-white/[0.06] mb-6">
              <div className="bg-slate-900/80 p-3 text-center">
                <div className="flex items-center justify-center gap-1 mb-1">
                  <Shield className="h-3 w-3 text-emerald-400" />
                  <span className="text-[10px] text-slate-500 uppercase">LCR</span>
                </div>
                <span className="text-lg font-bold text-emerald-400 tabular-nums">{results.lcr.toFixed(1)}%</span>
                <CheckCircle className="h-3 w-3 text-emerald-400 mx-auto mt-0.5" />
              </div>
              <div className="bg-slate-900/80 p-3 text-center">
                <div className="flex items-center justify-center gap-1 mb-1">
                  <TrendingUp className="h-3 w-3 text-cyan-400" />
                  <span className="text-[10px] text-slate-500 uppercase">Gap</span>
                </div>
                <span className="text-lg font-bold text-white tabular-nums">+{results.durationGap}yr</span>
                <span className="text-[10px] text-slate-500 block mt-0.5">Neutral</span>
              </div>
              <div className="bg-slate-900/80 p-3 text-center">
                <div className="flex items-center justify-center gap-1 mb-1">
                  <Droplets className="h-3 w-3 text-amber-400" />
                  <span className="text-[10px] text-slate-500 uppercase">NII</span>
                </div>
                <span className="text-lg font-bold text-amber-400 tabular-nums">{results.niiImpact}</span>
                <span className="text-[10px] text-slate-500 block mt-0.5">at +100bps</span>
              </div>
            </div>

            <button
              onClick={() => router.push(`/alm?id=${results.institutionId}`)}
              className="w-full flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-400 text-slate-900 font-semibold py-3 rounded-lg transition text-sm"
            >
              <Building2 className="h-4 w-4" />
              Open ALM Dashboard
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function DemoPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-950 flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-amber-500" />
        </div>
      }
    >
      <DemoContent />
    </Suspense>
  );
}
