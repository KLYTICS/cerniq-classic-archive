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
    <div className="flex items-center gap-0.5 rounded-full border border-slate-200 bg-white p-1 shadow-sm">
      <button
        onClick={() => setLocale('en')}
        className={`rounded-full px-2.5 py-1 text-[11px] font-semibold transition ${locale === 'en' ? 'bg-cyan-500 text-slate-950' : 'text-slate-500 hover:text-slate-950'
          }`}
        aria-label="Switch to English" aria-pressed={locale === 'en'}
      >
        EN
      </button>
      <button
        onClick={() => setLocale('es')}
        className={`rounded-full px-2.5 py-1 text-[11px] font-semibold transition ${locale === 'es' ? 'bg-cyan-500 text-slate-950' : 'text-slate-500 hover:text-slate-950'
          }`}
        aria-label="Cambiar a Espanol" aria-pressed={locale === 'es'}
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

    const isDemoInstitution = selectedId.startsWith('demo-');

    analytics.track(EVENTS.ALM_REPORT_DOWNLOADED, { institutionId: selectedId });

    if (!isDemoInstitution) {
      try {
        await apiClient.downloadALMReport(selectedId, locale);
        return;
      } catch {
        // Fall back to client-side export below.
      }
    }

    exportToPDF({
      elementId: 'alm-report-content',
      filename: `ALM_Report_${institution?.name?.replace(/\s+/g, '_') || selectedId}.pdf`,
    });
  };

  return (
    <div className="flex h-16 shrink-0 items-center justify-between border-b border-slate-200/80 bg-white/90 px-6 backdrop-blur-md">
      <div className="flex items-center gap-3">
        {institution && (
          <>
            <div className="flex h-9 w-9 items-center justify-center rounded-2xl border border-cyan-200 bg-cyan-50">
              <Building2 className="h-4 w-4 text-cyan-700" />
            </div>
            <div className="hidden sm:block">
              <p className="text-sm font-semibold leading-tight text-slate-950">{institution.name}</p>
              <p className="text-[11px] capitalize text-slate-500">{institution.type.replace('_', ' ')}</p>
            </div>
          </>
        )}
      </div>

      <div className="flex items-center gap-2">
        {institutions.length > 1 && (
          <div className="relative">
            <select
              value={selectedId}
              onChange={(e) => setSelectedId(e.target.value)}
              className="cerniq-field cerniq-select cursor-pointer py-2 pl-3 pr-8 text-xs"
            >
              {institutions.map((inst) => (
                <option key={inst.id} value={inst.id}>
                  {inst.name}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-3 w-3 -translate-y-1/2 text-slate-500" />
          </div>
        )}
        <LanguageToggle />
        <Link
          href="/pricing"
          className="hidden text-[11px] text-slate-500 transition hover:text-cyan-700 sm:inline"
        >
          {t('alm.pricing')}
        </Link>
        {selectedId && (
          <button
            onClick={handleExport}
            disabled={isExporting}
            className="flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600 transition hover:border-cyan-300 hover:text-cyan-700 disabled:opacity-50"
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
    <div className="flex items-center gap-2 border-b border-cyan-100 bg-cyan-50/70 px-6 py-2">
      <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-cyan-500" />
      <p className="text-[11px] font-medium uppercase tracking-wide text-cyan-800/80">
        {t('alm.demoBanner')}
      </p>
    </div>
  );
}

function MobileHeader({ onOpenSidebar }: { onOpenSidebar: () => void }) {
  const { institution } = useALM();
  const { t } = useTranslation();
  return (
    <div className="flex h-12 items-center justify-between border-b border-slate-200/80 bg-white/90 px-4 lg:hidden">
      <div className="flex items-center gap-3">
        <button
          onClick={onOpenSidebar}
          className="rounded-xl p-1.5 text-slate-500 transition hover:bg-slate-100 hover:text-slate-950"
          aria-label="Open navigation menu"
        >
          <Menu className="h-5 w-5" />
        </button>
        <span className="text-sm font-semibold text-slate-950">{t('alm.almIntelligence')}</span>
      </div>
      {institution && (
        <span className="max-w-[140px] truncate text-[11px] text-slate-500">{institution.name}</span>
      )}
    </div>
  );
}

function ALMShell({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden bg-[#f7fbff] text-slate-950">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <MobileHeader onOpenSidebar={() => setSidebarOpen(true)} />

        <DemoBanner />
        <ALMTopBar />

        <main id="alm-report-content" className="flex-1 overflow-y-auto bg-transparent">
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
        <div className="flex h-screen items-center justify-center bg-[#f7fbff]">
          <div className="flex flex-col items-center gap-3">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-cyan-200 border-t-cyan-600" />
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
