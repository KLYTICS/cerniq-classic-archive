'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import Sidebar from '@/components/layout/Sidebar';
import ALMProvider, { useALM } from '@/components/alm/ALMProvider';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { Download, Menu, Building2, ChevronDown, RefreshCw } from 'lucide-react';
import { apiClient } from '@/lib/api';
import { analytics, EVENTS } from '@/lib/analytics';
import { useTranslation } from '@/lib/i18n';
import { usePDFExport } from '@/hooks/usePDFExport';

function LanguageToggle() {
  const { locale, setLocale } = useTranslation();
  return (
    <div className="flex items-center gap-0.5 bg-white/[0.04] border border-white/[0.08] rounded-lg p-0.5">
      <button
        onClick={() => setLocale('en')}
        className={`px-2 py-0.5 rounded text-[11px] font-semibold transition ${locale === 'en' ? 'bg-amber-500 text-slate-900' : 'text-slate-400 hover:text-white'
          }`}
      >
        EN
      </button>
      <button
        onClick={() => setLocale('es')}
        className={`px-2 py-0.5 rounded text-[11px] font-semibold transition ${locale === 'es' ? 'bg-amber-500 text-slate-900' : 'text-slate-400 hover:text-white'
          }`}
      >
        ES
      </button>
    </div>
  );
}

function ALMTopBar() {
  const { institutions, selectedId, institution, setSelectedId } = useALM();
  const { t, locale } = useTranslation();
  const { exportToPDF, isExporting } = usePDFExport();

  const handleExport = async () => {
    if (!selectedId) return;
    analytics.track(EVENTS.ALM_REPORT_DOWNLOADED, { institutionId: selectedId });
    try {
      await apiClient.downloadALMReport(selectedId, locale);
    } catch {
      exportToPDF({
        elementId: 'alm-report-content',
        filename: `ALM_Report_${institution?.name?.replace(/\s+/g, '_') || selectedId}.pdf`,
      });
    }
  };

  return (
    <div className="h-14 border-b border-white/[0.06] bg-slate-900/70 backdrop-blur-md flex items-center justify-between px-6 shrink-0">
      {/* Left: Institution info */}
      <div className="flex items-center gap-3">
        {institution && (
          <>
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-500/20 to-orange-500/20 border border-amber-500/20 flex items-center justify-center">
              <Building2 className="h-4 w-4 text-amber-400" />
            </div>
            <div className="hidden sm:block">
              <p className="text-sm font-semibold text-white leading-tight">{institution.name}</p>
              <p className="text-[11px] text-slate-500 capitalize">{institution.type.replace('_', ' ')}</p>
            </div>
          </>
        )}
      </div>

      {/* Right: Controls */}
      <div className="flex items-center gap-2">
        {institutions.length > 1 && (
          <div className="relative">
            <select
              value={selectedId}
              onChange={(e) => setSelectedId(e.target.value)}
              className="appearance-none bg-white/[0.04] hover:bg-white/[0.07] border border-white/[0.08] rounded-lg pl-3 pr-8 py-1.5 text-xs text-slate-300 focus:outline-none focus:ring-1 focus:ring-amber-500/50 cursor-pointer transition"
            >
              {institutions.map((inst) => (
                <option key={inst.id} value={inst.id} className="bg-slate-800">
                  {inst.name}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-3 w-3 text-slate-500 pointer-events-none" />
          </div>
        )}
        <LanguageToggle />
        <Link
          href="/pricing"
          className="text-[11px] text-slate-500 hover:text-amber-400 transition hidden sm:inline"
        >
          {t('alm.pricing')}
        </Link>
        {selectedId && (
          <button
            onClick={handleExport}
            disabled={isExporting}
            className="flex items-center gap-1.5 bg-white/[0.04] hover:bg-white/[0.07] border border-white/[0.08] text-slate-400 hover:text-slate-200 px-3 py-1.5 rounded-lg text-xs transition disabled:opacity-50"
          >
            {isExporting ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
            <span className="hidden sm:inline">{isExporting ? 'Generating...' : t('alm.exportPdf')}</span>
          </button>
        )}
      </div>
    </div>
  );
}

function DemoBanner() {
  const { t } = useTranslation();
  return (
    <div className="bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent border-b border-amber-500/10 px-6 py-2 flex items-center gap-2">
      <div className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
      <p className="text-[11px] text-amber-400/80 font-medium tracking-wide uppercase">
        {t('alm.demoBanner')}
      </p>
    </div>
  );
}

function MobileHeader({ onOpenSidebar }: { onOpenSidebar: () => void }) {
  const { institution } = useALM();
  const { t } = useTranslation();
  return (
    <div className="lg:hidden flex items-center justify-between h-12 px-4 border-b border-white/[0.06] bg-slate-900/70">
      <div className="flex items-center gap-3">
        <button
          onClick={onOpenSidebar}
          className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition"
        >
          <Menu className="h-5 w-5" />
        </button>
        <span className="text-sm font-semibold text-white">{t('alm.almIntelligence')}</span>
      </div>
      {institution && (
        <span className="text-[11px] text-slate-500 truncate max-w-[140px]">{institution.name}</span>
      )}
    </div>
  );
}

function ALMShell({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex h-screen bg-slate-950 overflow-hidden">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <MobileHeader onOpenSidebar={() => setSidebarOpen(true)} />

        <DemoBanner />
        <ALMTopBar />

        {/* Page content */}
        <main id="alm-report-content" className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}

export default function ALMLayout({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation();
  return (
    <Suspense
      fallback={
        <div className="flex h-screen bg-slate-950 items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-2 border-amber-500/30 border-t-amber-500 rounded-full animate-spin" />
            <p className="text-sm text-slate-500">{t('alm.loadingAlm')}</p>
          </div>
        </div>
      }
    >
      <ALMProvider>
        <ALMShell>
          <ErrorBoundary context="alm">
            {children}
          </ErrorBoundary>
        </ALMShell>
      </ALMProvider>
    </Suspense>
  );
}
