'use client';

import { Suspense, useEffect, useState, useRef, useCallback } from 'react';
import { apiClient } from '@/lib/api';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Building2, CheckCircle, ChevronRight, Shield, TrendingUp,
  Droplets, Download, Clock, MessageSquare, Flag, ArrowRight,
} from 'lucide-react';
import { useTranslation } from '@/lib/i18n';
import { analytics, EVENTS } from '@/lib/analytics';

const PRESETS: Record<string, { name: string; assets: string; assetBucket: string; type: string; members?: string }> = {
  'banco-comunidad': { name: 'Banco Comunidad PR', assets: '$1.2B', assetBucket: '$1B - $5B', type: 'bank' },
  bank: { name: 'Banco Comunidad PR', assets: '$1.2B', assetBucket: '$1B - $5B', type: 'bank' },
  firstbank: { name: 'FirstBank Puerto Rico', assets: '$12.8B', assetBucket: '$5B+', type: 'bank' },
  credit_union: { name: 'Cooperativa del Pueblo', assets: '$180M', assetBucket: '$100M - $500M', type: 'credit_union', members: '28,000' },
  cooperativa: { name: 'CoopAhorro San Juan', assets: '$250M', assetBucket: '$100M - $500M', type: 'cooperativa', members: '35,000' },
  family_office: { name: 'Caribbean Family Capital', assets: '$45M', assetBucket: 'Under $100M', type: 'family_office' },
};

// Sales companion talking points per calculation phase
const SALES_TALKING_POINTS: Record<string, { point: string; question: string }[]> = {
  seed: [
    { point: 'Balance sheet was loaded from public regulatory filings', question: 'How often does your team update balance sheet positions?' },
    { point: 'All 10 asset and liability line items are mapped automatically', question: 'Do you currently use a spreadsheet or vendor software for this?' },
  ],
  calc: [
    { point: 'NII sensitivity runs 8 rate scenarios simultaneously', question: 'What rate scenarios does COSSEC require in your exams?' },
    { point: 'Duration gap shows your net interest rate exposure', question: 'When was your last ALCO committee meeting?' },
  ],
  results: [
    { point: 'COSSEC compliance checks run against all 4 regulatory ratios', question: 'When is your next COSSEC examination?' },
    { point: 'The risk score combines rate risk, liquidity, and capital adequacy', question: 'What keeps you up at night about your risk position?' },
  ],
  report: [
    { point: 'PDF is bilingual — board members can read EN or ES version', question: 'Does your board prefer English or Spanish reports?' },
    { point: 'This exact report format is what we deliver for $750', question: 'Would this be useful for your upcoming board presentation?' },
  ],
};

function DemoContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t, ta, locale } = useTranslation();

  const preset = searchParams.get('preset') || searchParams.get('type') || 'bank';
  const isSalesMode = searchParams.get('mode') === 'sales';
  const defaults = PRESETS[preset] || PRESETS.bank;

  const [step, setStep] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [instName, setInstName] = useState(defaults.name);
  const [instType, setInstType] = useState(defaults.type);
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);
  const [progressPct, setProgressPct] = useState(0);
  const [salesPhase, setSalesPhase] = useState<string>('seed');
  const [flaggedPoints, setFlaggedPoints] = useState<string[]>([]);
  const [results, setResults] = useState<{
    riskScore: number;
    lcr: number;
    durationGap: number;
    niiImpact: string;
    capitalRatio: number;
    cossecPassed: number;
    institutionId: string;
    itemCount: number;
  } | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [demoStartTime] = useState(Date.now());

  const runningRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const progressSteps = ta('demo.progressSteps');

  // Timer for sales mode
  useEffect(() => {
    if (isSalesMode && step >= 2) {
      timerRef.current = setInterval(() => {
        setElapsedMs(Date.now() - demoStartTime);
      }, 100);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [isSalesMode, step, demoStartTime]);

  // Auto-start if ?type= is set and matches a preset
  useEffect(() => {
    const autoType = searchParams.get('type');
    if (autoType && PRESETS[autoType] && !runningRef.current) {
      const p = PRESETS[autoType];
      setInstName(p.name);
      setInstType(p.type);
      // Small delay so the UI renders before auto-starting
      const timer = setTimeout(() => startSetup(), 300);
      return () => clearTimeout(timer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startSetup = useCallback(async () => {
    if (runningRef.current) return;
    runningRef.current = true;
    setStep(2);
    setCompletedSteps([]);
    setProgressPct(0);
    setError(null);

    const startTime = Date.now();
    analytics.track(EVENTS.DEMO_STARTED, { institutionType: instType, institutionName: instName });

    try {
      // Auto-register with generated credentials
      const ts = Date.now();
      const email = `demo-${ts}@cerniq.demo`;
      const password = `Demo${ts}X`;

      let loggedIn = false;
      try {
        await apiClient.getCurrentUser();
        loggedIn = true;
      } catch { /* Not logged in */ }

      if (!loggedIn) {
        try { await apiClient.register(email, password); }
        catch { try { await apiClient.login(email, password); } catch { /* fallback */ } }
      }

      // Step 0 — Account ready
      setCompletedSteps([0]);
      setProgressPct(20);
      setSalesPhase('seed');

      // Get or create workspace
      let workspaceId: string;
      try {
        const workspaces = await apiClient.getMyWorkspaces();
        workspaceId = (Array.isArray(workspaces) && workspaces.length > 0)
          ? workspaces[0].id
          : (await apiClient.createMyWorkspace('Demo Workspace')).id;
      } catch {
        workspaceId = (await apiClient.createMyWorkspace('Demo Workspace')).id;
      }

      // Check existing institutions
      let institutions: any[] = [];
      try { institutions = await apiClient.getInstitutions(); } catch { /* */ }

      setCompletedSteps([0, 1]);
      setProgressPct(40);

      let institutionId: string;
      let itemCount = 10;
      if (institutions.length > 0) {
        institutionId = institutions[0].id;
      } else {
        const result = await apiClient.seedDemoInstitution(
          workspaceId,
          instType as 'bank' | 'credit_union' | 'family_office' | 'cooperativa',
        );
        institutionId = result?.institutionId || result?.institution?.id;
        itemCount = result?.institution?.balanceSheetItems?.length || 10;
      }

      const seedMs = Date.now() - startTime;
      analytics.track(EVENTS.DEMO_SEED_COMPLETE, { msElapsed: seedMs, itemCount });
      setSalesPhase('calc');

      // Step 2 — Running calculations
      setCompletedSteps([0, 1, 2]);
      setProgressPct(60);

      // Fetch summary (all calculations happen server-side)
      let riskScore = 72, lcr = 117.9, durationGap = 1.8, niiImpact = '-$1.2M';
      let capitalRatio = 10.0, cossecPassed = 4;
      try {
        const summary = await apiClient.getALMSummary(institutionId);
        riskScore = summary.riskScore || 72;
        lcr = summary.liquidity?.lcr || 117.9;
        durationGap = summary.durationGap?.durationGap || 1.8;
        capitalRatio = summary.capitalRatio || 10.0;
        cossecPassed = summary.cossecPassed ?? 4;
        const scenario200 = summary.niiSensitivity?.scenarios?.find((s: any) => s.shiftBps === 200);
        if (scenario200) {
          niiImpact = `${scenario200.niImpact >= 0 ? '+' : '-'}$${Math.abs(scenario200.niImpact).toFixed(1)}M`;
        }
      } catch { /* use defaults */ }

      setCompletedSteps([0, 1, 2, 3]);
      setProgressPct(100);
      setSalesPhase('results');

      const calcMs = Date.now() - startTime;
      analytics.track(EVENTS.DEMO_CALC_COMPLETE, {
        msElapsed: calcMs, riskScore,
        flagsTriggered: [
          durationGap > 2 && 'high_duration_gap',
          lcr < 100 && 'lcr_breach',
          capitalRatio < 6 && 'capital_deficiency',
        ].filter(Boolean),
      });

      // Brief pause for animation
      await new Promise((r) => setTimeout(r, 500));

      setResults({ riskScore, lcr, durationGap, niiImpact, capitalRatio, cossecPassed, institutionId, itemCount });
      setStep(3);

      // Auto-advance to step 4 (report ready) after 2s
      setTimeout(() => {
        setStep(4);
        setSalesPhase('report');
        const totalMs = Date.now() - startTime;
        analytics.track(EVENTS.DEMO_COMPLETED, {
          totalMs, convertedToLeadForm: false,
        });
      }, 2500);
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Setup failed. Please try again.');
      runningRef.current = false;
    }
  }, [instType, instName]);

  const handleDownloadPDF = async (lang: 'en' | 'es') => {
    if (!results) return;
    analytics.track(EVENTS.DEMO_PDF_DOWNLOADED, {
      language: lang, msSinceDemoStart: Date.now() - demoStartTime,
    });
    try {
      await apiClient.downloadALMReport(results.institutionId, lang);
    } catch {
      // Fallback: open report URL in new tab
      window.open(apiClient.getALMReportUrl(results.institutionId, lang), '_blank');
    }
  };

  const handleLeadFormClick = (source: string) => {
    analytics.track(EVENTS.DEMO_LEAD_FORM_OPENED, { source });
    router.push('/#demo');
  };

  const formatTimer = (ms: number) => {
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    return `${m}:${String(s % 60).padStart(2, '0')}`;
  };

  // ── Error state ──
  if (error) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-center px-6">
        <div className="w-12 h-12 bg-red-500/20 rounded-xl flex items-center justify-center mb-6">
          <span className="text-red-400 font-bold text-xl">!</span>
        </div>
        <h2 className="text-white text-xl font-bold mb-2">{t('demo.setupFailed')}</h2>
        <p className="text-slate-400 text-sm mb-6 max-w-md">{error}</p>
        <button
          onClick={() => { setError(null); setStep(1); runningRef.current = false; }}
          className="bg-amber-500 hover:bg-amber-400 text-slate-900 font-semibold px-6 py-2.5 rounded-lg transition"
        >
          {t('common.tryAgain')}
        </button>
      </div>
    );
  }

  // ── Sales companion sidebar ──
  const SalesCompanion = () => {
    if (!isSalesMode) return null;
    const points = SALES_TALKING_POINTS[salesPhase] || [];
    return (
      <div className="fixed right-0 top-0 w-80 h-full bg-slate-900/95 border-l border-amber-500/20 p-4 overflow-y-auto z-50">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-amber-400" />
            <span className="text-xs font-bold text-amber-400 uppercase tracking-wider">{t('demo.salesMode')}</span>
          </div>
          <div className="flex items-center gap-1.5 bg-slate-800 px-2 py-1 rounded-md">
            <Clock className="h-3 w-3 text-slate-400" />
            <span className="text-xs text-slate-300 font-mono tabular-nums">{formatTimer(elapsedMs)}</span>
          </div>
        </div>

        <div className="text-[10px] text-slate-600 uppercase tracking-widest mb-3">
          Phase: {salesPhase}
        </div>

        <div className="space-y-3">
          {points.map((tp, i) => (
            <div key={i} className="bg-slate-800/60 border border-white/[0.06] rounded-lg p-3">
              <p className="text-xs text-slate-300 mb-2">{tp.point}</p>
              <p className="text-xs text-amber-400/80 italic mb-2">&ldquo;{tp.question}&rdquo;</p>
              <button
                onClick={() => setFlaggedPoints(p => [...p, tp.question])}
                className="flex items-center gap-1 text-[10px] text-slate-500 hover:text-amber-400 transition"
              >
                <Flag className="h-3 w-3" /> Flag for follow-up
              </button>
            </div>
          ))}
        </div>

        {flaggedPoints.length > 0 && (
          <div className="mt-6 border-t border-white/[0.06] pt-4">
            <p className="text-[10px] text-slate-500 uppercase tracking-widest mb-2">Flagged ({flaggedPoints.length})</p>
            {flaggedPoints.map((f, i) => (
              <p key={i} className="text-xs text-amber-300/70 mb-1">- {f}</p>
            ))}
          </div>
        )}
      </div>
    );
  };

  // ── Metrics overlay strip ──
  const MetricsStrip = () => {
    if (!results) return null;
    const presetData = PRESETS[instType] || defaults;
    return (
      <div className="bg-slate-800/60 border border-white/[0.08] rounded-xl p-4 mb-6">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
          <div className="flex items-center gap-2">
            <Building2 className="h-3.5 w-3.5 text-slate-500" />
            <div>
              <p className="font-semibold text-white">{instName}</p>
              <p className="text-slate-500">{presetData.assets} Assets{presetData.members ? ` · ${presetData.members} Members` : ''}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm">
              {results.riskScore >= 80 ? '🟢' : results.riskScore >= 60 ? '🟡' : '🔴'}
            </span>
            <div>
              <p className="text-slate-400">{t('demo.riskScore')}</p>
              <p className="font-bold text-white">{results.riskScore}/100</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Shield className="h-3.5 w-3.5 text-emerald-400" />
            <div>
              <p className="text-slate-400">{t('demo.capital')}</p>
              <p className="font-bold text-white">{results.capitalRatio.toFixed(1)}% <CheckCircle className="inline h-3 w-3 text-emerald-400" /></p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Shield className="h-3.5 w-3.5 text-emerald-400" />
            <div>
              <p className="text-slate-400">LCR</p>
              <p className="font-bold text-white">{results.lcr.toFixed(1)}% <CheckCircle className="inline h-3 w-3 text-emerald-400" /></p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Droplets className="h-3.5 w-3.5 text-amber-400" />
            <div>
              <p className="text-slate-400">{t('demo.niiLabel')} (+200bps)</p>
              <p className="font-bold text-white">{results.niiImpact}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <TrendingUp className="h-3.5 w-3.5 text-cyan-400" />
            <div>
              <p className="text-slate-400">{t('alm.durationGap')}</p>
              <p className="font-bold text-white">{results.durationGap > 0 ? '+' : ''}{results.durationGap}yr {results.durationGap > 2 ? '⚠' : ''}</p>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // ── Social proof footer ──
  const SocialProof = () => {
    if (!results) return null;
    const elapsed = ((Date.now() - demoStartTime) / 1000).toFixed(1);
    const dateStr = new Date().toLocaleDateString(locale === 'es' ? 'es-PR' : 'en-US', {
      year: 'numeric', month: 'long', day: 'numeric',
    });
    return (
      <div className="text-center mt-4">
        <p className="text-[11px] text-slate-600">
          {locale === 'es'
            ? `Generado en ${elapsed}s · ${dateStr} · ${t('demo.cossecCompliance')}: ${results.cossecPassed}/4`
            : `Generated in ${elapsed}s · ${dateStr} · ${t('demo.cossecCompliance')}: ${results.cossecPassed}/4 ratios passed`
          }
        </p>
      </div>
    );
  };

  return (
    <div className={`min-h-screen bg-slate-950 flex items-center justify-center px-4 ${isSalesMode ? 'pr-84' : ''}`}>
      <SalesCompanion />

      <div className="w-full max-w-md">
        {/* Brand */}
        <div className="text-center mb-8">
          <div className="w-10 h-10 bg-gradient-to-br from-amber-400 to-orange-500 rounded-xl flex items-center justify-center mx-auto mb-3">
            <span className="text-slate-900 font-bold text-lg">C</span>
          </div>
          <p className="text-[11px] text-slate-600 uppercase tracking-widest">CERNIQ</p>
        </div>

        {/* Step 1: Institution Select */}
        {step === 1 && (
          <div className="bg-slate-900/60 border border-white/[0.08] rounded-2xl p-6">
            <h2 className="text-lg font-bold text-white mb-1">{t('demo.setupInstitution')}</h2>
            <p className="text-xs text-slate-500 mb-6">{t('demo.takesAbout')}</p>

            <div className="space-y-4">
              <div>
                <label className="block text-[11px] uppercase tracking-wider text-slate-500 mb-1.5">{t('demo.institutionName')}</label>
                <input
                  type="text"
                  value={instName}
                  onChange={(e) => setInstName(e.target.value)}
                  className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-amber-500/50 transition"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] uppercase tracking-wider text-slate-500 mb-1.5">{t('demo.assetSize')}</label>
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
                  <label className="block text-[11px] uppercase tracking-wider text-slate-500 mb-1.5">{t('demo.type')}</label>
                  <select
                    value={instType}
                    onChange={(e) => {
                      setInstType(e.target.value);
                      const p = PRESETS[e.target.value];
                      if (p) setInstName(p.name);
                    }}
                    className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-amber-500/50 transition appearance-none"
                  >
                    <option value="bank" className="bg-slate-800">{t('demo.communityBank')}</option>
                    <option value="credit_union" className="bg-slate-800">{t('demo.creditUnion')}</option>
                    <option value="cooperativa" className="bg-slate-800">Cooperativa PR</option>
                    <option value="family_office" className="bg-slate-800">{t('demo.familyOffice')}</option>
                  </select>
                </div>
              </div>
            </div>

            <button
              onClick={startSetup}
              className="w-full mt-6 flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-400 text-slate-900 font-semibold py-3 rounded-lg transition text-sm"
            >
              {t('common.continue')} <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Step 2: Animated Progress */}
        {step === 2 && (
          <div className="bg-slate-900/60 border border-white/[0.08] rounded-2xl p-6">
            <h2 className="text-lg font-bold text-white mb-1">{t('demo.creatingProfile')}</h2>
            <p className="text-xs text-slate-500 mb-6">{instName}</p>

            <div className="h-1.5 bg-white/[0.04] rounded-full overflow-hidden mb-6">
              <div
                className="h-full bg-amber-500 rounded-full transition-all duration-700 ease-out"
                style={{ width: `${progressPct}%` }}
              />
            </div>

            <div className="space-y-3">
              {progressSteps.map((text, i) => {
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
                      {text}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Step 3: Results Preview (brief — auto-transitions to step 4) */}
        {step === 3 && results && (
          <div className="bg-slate-900/60 border border-white/[0.08] rounded-2xl p-6">
            <div className="flex items-center gap-2 mb-4">
              <CheckCircle className="h-5 w-5 text-emerald-400" />
              <h2 className="text-lg font-bold text-white">{t('demo.dashboardReady')}</h2>
            </div>
            <MetricsStrip />
            <div className="flex items-center justify-center">
              <div className="w-4 h-4 border-2 border-amber-500/40 border-t-amber-500 rounded-full animate-spin" />
              <span className="text-xs text-slate-500 ml-2">{t('demo.preparingReport')}</span>
            </div>
          </div>
        )}

        {/* Step 4: Report Ready + Full Results */}
        {step === 4 && results && (
          <div className="space-y-4">
            {/* Metrics overlay */}
            <MetricsStrip />

            {/* Risk Score Badge */}
            <div className="bg-slate-900/60 border border-white/[0.08] rounded-2xl p-6">
              <div className="flex items-center justify-center mb-6">
                <div className="relative">
                  <div className="w-24 h-24 rounded-full border-4 border-amber-500/30 flex items-center justify-center">
                    <div className="text-center">
                      <span className="text-3xl font-bold text-white tabular-nums">{results.riskScore}</span>
                      <span className="text-xs text-slate-500 block -mt-0.5">/100</span>
                    </div>
                  </div>
                  <span className="absolute -bottom-2 left-1/2 -translate-x-1/2 text-[10px] font-bold uppercase tracking-wider bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded-full whitespace-nowrap">
                    {t('common.moderate')}
                  </span>
                </div>
              </div>

              {/* Key metrics grid */}
              <div className="grid grid-cols-3 gap-px bg-white/[0.03] rounded-xl overflow-hidden border border-white/[0.06] mb-6">
                <div className="bg-slate-900/80 p-3 text-center">
                  <div className="flex items-center justify-center gap-1 mb-1">
                    <Shield className="h-3 w-3 text-emerald-400" />
                    <span className="text-[10px] text-slate-500 uppercase">{t('alm.lcr')}</span>
                  </div>
                  <span className="text-lg font-bold text-emerald-400 tabular-nums">{results.lcr.toFixed(1)}%</span>
                  <CheckCircle className="h-3 w-3 text-emerald-400 mx-auto mt-0.5" />
                </div>
                <div className="bg-slate-900/80 p-3 text-center">
                  <div className="flex items-center justify-center gap-1 mb-1">
                    <TrendingUp className="h-3 w-3 text-cyan-400" />
                    <span className="text-[10px] text-slate-500 uppercase">{t('alm.gap')}</span>
                  </div>
                  <span className="text-lg font-bold text-white tabular-nums">+{results.durationGap}yr</span>
                  <span className="text-[10px] text-slate-500 block mt-0.5">{t('common.neutral')}</span>
                </div>
                <div className="bg-slate-900/80 p-3 text-center">
                  <div className="flex items-center justify-center gap-1 mb-1">
                    <Droplets className="h-3 w-3 text-amber-400" />
                    <span className="text-[10px] text-slate-500 uppercase">NII</span>
                  </div>
                  <span className="text-lg font-bold text-amber-400 tabular-nums">{results.niiImpact}</span>
                  <span className="text-[10px] text-slate-500 block mt-0.5">at +200bps</span>
                </div>
              </div>

              {/* Report ready banner */}
              <div className="bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/20 rounded-xl p-4 mb-4">
                <p className="text-sm font-bold text-amber-300 mb-1">
                  {locale === 'es' ? 'Tu informe ALM est\u00e1 listo' : 'Your ALM Report is Ready'}
                </p>
                <p className="text-xs text-slate-400">
                  {locale === 'es'
                    ? 'Descarga el informe completo en formato PDF.'
                    : 'Download the full board-ready PDF report.'}
                </p>
              </div>

              {/* PDF download buttons */}
              <div className="grid grid-cols-2 gap-3 mb-4">
                <button
                  onClick={() => handleDownloadPDF('es')}
                  className="flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-400 text-slate-900 font-semibold py-3 rounded-lg transition text-sm"
                >
                  <Download className="h-4 w-4" /> PDF (ES)
                </button>
                <button
                  onClick={() => handleDownloadPDF('en')}
                  className="flex items-center justify-center gap-2 bg-white/[0.06] hover:bg-white/[0.1] border border-white/[0.1] text-white font-semibold py-3 rounded-lg transition text-sm"
                >
                  <Download className="h-4 w-4" /> PDF (EN)
                </button>
              </div>

              {/* Open dashboard */}
              <button
                onClick={() => router.push(`/alm?id=${results.institutionId}`)}
                className="w-full flex items-center justify-center gap-2 bg-white/[0.04] hover:bg-white/[0.07] border border-white/[0.08] text-slate-300 hover:text-white py-3 rounded-lg transition text-sm mb-3"
              >
                <Building2 className="h-4 w-4" />
                {t('demo.openDashboard')}
                <ChevronRight className="h-4 w-4" />
              </button>

              {/* Lead form CTA */}
              <button
                onClick={() => handleLeadFormClick('demo_banner')}
                className="w-full flex items-center justify-center gap-2 text-amber-400 hover:text-amber-300 text-xs transition py-2"
              >
                {locale === 'es'
                  ? 'Solicita este an\u00e1lisis para tu instituci\u00f3n'
                  : 'Request this analysis for your institution'}
                <ArrowRight className="h-3 w-3" />
              </button>
            </div>

            <SocialProof />
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
