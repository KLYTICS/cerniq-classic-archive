'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { apiClient } from '@/lib/api';
import {
  ArrowLeft, X, Copy, Check, RefreshCw,
  Users, Building2, CalendarClock, Flame, LayoutGrid, Table2,
  ChevronDown, ArrowUpDown, Filter, Eye,
} from 'lucide-react';
import { EmptyState, ErrorBanner } from '@/components/ui/cerniq';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface Prospect {
  id: string;
  name: string;
  assets: number;
  location: string;
  contactRole: string;
  stage: 'OUTBOUND' | 'ENGAGED' | 'DEMO_SCHEDULED' | 'PROPOSAL' | 'CLOSED_WON' | 'CHURNED';
  urgencyScore: number;
  knownPain: string;
  outreachDraft: string;
  outreachSentAt: string | null;
  examDate: string | null;
}

type SortKey = 'urgency' | 'stale' | 'assets';
type ViewMode = 'table' | 'kanban';
type Lang = 'en' | 'es';

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const STAGES: { value: Prospect['stage']; label: string; color: string; bg: string; border: string }[] = [
  { value: 'OUTBOUND',       label: 'OUTBOUND',       color: 'text-slate-300',   bg: 'bg-slate-500/20',   border: 'border-slate-500/30' },
  { value: 'ENGAGED',        label: 'ENGAGED',        color: 'text-[#1ABFFF]',  bg: 'bg-[#1ABFFF]/15',  border: 'border-[#1ABFFF]/30' },
  { value: 'DEMO_SCHEDULED', label: 'DEMO_SCHEDULED', color: 'text-[#E8A020]',  bg: 'bg-[#E8A020]/15',  border: 'border-[#E8A020]/30' },
  { value: 'PROPOSAL',       label: 'PROPOSAL',       color: 'text-[#1ABFFF]',  bg: 'bg-[#1ABFFF]/20',  border: 'border-[#1ABFFF]/40' },
  { value: 'CLOSED_WON',     label: 'CLOSED_WON',     color: 'text-[#18C87A]',  bg: 'bg-[#18C87A]/15',  border: 'border-[#18C87A]/30' },
  { value: 'CHURNED',        label: 'CHURNED',        color: 'text-red-400',     bg: 'bg-red-500/15',     border: 'border-red-500/30' },
];

const STAGE_MAP = Object.fromEntries(STAGES.map((s) => [s.value, s]));

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function daysSince(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const diff = Date.now() - new Date(dateStr).getTime();
  return Math.max(0, Math.floor(diff / 86_400_000));
}

function urgencyColor(score: number): string {
  if (score >= 70) return 'bg-[#18C87A]';
  if (score >= 40) return 'bg-[#E8A020]';
  return 'bg-red-500';
}

function urgencyTextColor(score: number): string {
  if (score >= 70) return 'text-[#18C87A]';
  if (score >= 40) return 'text-[#E8A020]';
  return 'text-red-400';
}

/* ------------------------------------------------------------------ */
/*  Skeleton loader                                                    */
/* ------------------------------------------------------------------ */

function SkeletonRow() {
  return (
    <tr className="border-b border-white/[0.04]">
      {[...Array(6)].map((_, i) => (
        <td key={i} className="px-4 py-4">
          <div className="h-4 bg-white/[0.06] rounded animate-pulse" style={{ width: `${50 + Math.random() * 40}%` }} />
        </td>
      ))}
    </tr>
  );
}

function SkeletonCard() {
  return (
    <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4 animate-pulse space-y-3">
      <div className="h-4 bg-white/[0.06] rounded w-3/4" />
      <div className="h-3 bg-white/[0.04] rounded w-1/2" />
      <div className="h-3 bg-white/[0.04] rounded w-1/3" />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Component                                                     */
/* ------------------------------------------------------------------ */

export default function ProspectsDashboard() {
  const [lang, setLang] = useState<Lang>('en');
  const t = (en: string, es: string) => lang === 'en' ? en : es;

  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<ViewMode>('table');

  // Filters
  const [scoreFilter, setScoreFilter] = useState(false); // >= 40
  const [stageFilter, setStageFilter] = useState<string>('');
  const [sortKey, setSortKey] = useState<SortKey>('urgency');

  // Modal
  const [outreachProspect, setOutreachProspect] = useState<Prospect | null>(null);
  const [copied, setCopied] = useState(false);

  /* ---- data fetch ---- */
  const fetchProspects = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiClient.getProspects();
      setProspects(Array.isArray(data) ? data : []);
    } catch (err: any) {
      setError(err?.response?.status === 401 ? t('Invalid admin key', 'Clave de administrador invalida') : t('Failed to load prospects', 'No se pudo cargar los prospectos'));
    } finally {
      setLoading(false);
    }
  }, [lang]);

  useEffect(() => {
    fetchProspects();
  }, [fetchProspects]);

  /* ---- derived ---- */
  const filtered = useMemo(() => {
    let list = [...prospects];
    if (scoreFilter) list = list.filter((p) => p.urgencyScore >= 40);
    if (stageFilter) list = list.filter((p) => p.stage === stageFilter);
    list.sort((a, b) => {
      if (sortKey === 'urgency') return b.urgencyScore - a.urgencyScore;
      if (sortKey === 'assets') return b.assets - a.assets;
      // stale: longest since contact first
      const da = daysSince(a.outreachSentAt) ?? 9999;
      const db = daysSince(b.outreachSentAt) ?? 9999;
      return db - da;
    });
    return list;
  }, [prospects, scoreFilter, stageFilter, sortKey]);

  const activeCount = prospects.filter((p) => p.stage !== 'CHURNED').length;
  const avgUrgency = prospects.length
    ? Math.round(prospects.reduce((s, p) => s + p.urgencyScore, 0) / prospects.length)
    : 0;
  const weekAgo = Date.now() - 7 * 86_400_000;
  const thisWeekCount = prospects.filter(
    (p) => p.outreachSentAt && new Date(p.outreachSentAt).getTime() >= weekAgo,
  ).length;
  const demoPendingCount = prospects.filter((p) => p.stage === 'DEMO_SCHEDULED').length;

  /* ---- clipboard ---- */
  const copyOutreach = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  /* ================================================================ */
  /*  RENDER                                                           */
  /* ================================================================ */

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="max-w-[90rem] mx-auto px-4 sm:px-6 py-6 sm:py-8">

        {/* ---- Header ---- */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div className="flex items-center gap-3">
            <Link href="/admin" className="text-slate-500 hover:text-white transition">
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <div>
              <h1 className="text-xl font-bold flex items-center gap-2">
                <Building2 className="h-5 w-5 text-[#1ABFFF]" /> {t('Institutional Sales Dashboard', 'Panel de Ventas Institucional')}
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">
                CERNIQ CRM &mdash; {prospects.length} {t('prospect', 'prospecto')}{prospects.length !== 1 ? 's' : ''} {t('in pipeline', 'en pipeline')}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setLang(lang === 'en' ? 'es' : 'en')}
              className="flex items-center bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-slate-400 hover:text-slate-200 px-3 py-1.5 rounded-lg text-xs transition font-semibold uppercase tracking-wider"
            >
              {lang === 'en' ? 'ES' : 'EN'}
            </button>
            <button
              onClick={fetchProspects}
              disabled={loading}
              className="flex items-center gap-1.5 self-start bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-slate-400 hover:text-slate-200 px-3 py-1.5 rounded-lg text-xs transition"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} /> {t('Refresh', 'Actualizar')}
            </button>
          </div>
        </div>

        {/* ---- Error banner ---- */}
        {error && (
          <div className="mb-6">
            <ErrorBanner
              titleEs={t('Failed to load prospects', 'No se pudo cargar los prospectos')}
              error={error}
              onRetry={fetchProspects}
              onDismiss={() => setError(null)}
            />
          </div>
        )}

        {/* ================================================================ */}
        {/*  1. PIPELINE STATS BAR                                           */}
        {/* ================================================================ */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-8">
          {/* Active Prospects */}
          <div className="bg-slate-900/60 border border-white/[0.08] rounded-xl p-4 sm:p-5">
            <div className="flex items-center gap-2 text-slate-400 text-[11px] uppercase tracking-wider font-medium mb-2">
              <Users className="h-3.5 w-3.5 text-[#1ABFFF]" /> {t('Active Prospects', 'Prospectos Activos')}
            </div>
            {loading ? (
              <div className="h-8 w-16 bg-white/[0.06] rounded animate-pulse" />
            ) : (
              <div className="text-3xl font-bold tabular-nums">{activeCount}</div>
            )}
          </div>

          {/* Avg Urgency */}
          <div className="bg-slate-900/60 border border-white/[0.08] rounded-xl p-4 sm:p-5">
            <div className="flex items-center gap-2 text-slate-400 text-[11px] uppercase tracking-wider font-medium mb-2">
              <Flame className="h-3.5 w-3.5 text-[#E8A020]" /> {t('Avg Urgency', 'Urgencia Media')}
            </div>
            {loading ? (
              <div className="h-8 w-16 bg-white/[0.06] rounded animate-pulse" />
            ) : (
              <div className={`text-3xl font-bold tabular-nums ${urgencyTextColor(avgUrgency)}`}>{avgUrgency}</div>
            )}
          </div>

          {/* This Week */}
          <div className="bg-slate-900/60 border border-white/[0.08] rounded-xl p-4 sm:p-5">
            <div className="flex items-center gap-2 text-slate-400 text-[11px] uppercase tracking-wider font-medium mb-2">
              <CalendarClock className="h-3.5 w-3.5 text-[#18C87A]" /> {t('This Week', 'Esta Semana')}
            </div>
            {loading ? (
              <div className="h-8 w-16 bg-white/[0.06] rounded animate-pulse" />
            ) : (
              <div className="text-3xl font-bold tabular-nums">{thisWeekCount}</div>
            )}
          </div>

          {/* Pending Demos */}
          <div className="bg-slate-900/60 border border-white/[0.08] rounded-xl p-4 sm:p-5">
            <div className="flex items-center gap-2 text-slate-400 text-[11px] uppercase tracking-wider font-medium mb-2">
              <LayoutGrid className="h-3.5 w-3.5 text-[#1ABFFF]" /> {t('Pending Demos', 'Demos Pendientes')}
            </div>
            {loading ? (
              <div className="h-8 w-16 bg-white/[0.06] rounded animate-pulse" />
            ) : (
              <div className="text-3xl font-bold tabular-nums">{demoPendingCount}</div>
            )}
          </div>
        </div>

        {/* ================================================================ */}
        {/*  TOOLBAR: filters + view toggle                                  */}
        {/* ================================================================ */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
          {/* Left: filters */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Score >= 40 toggle */}
            <button
              onClick={() => setScoreFilter(!scoreFilter)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition ${
                scoreFilter
                  ? 'bg-[#E8A020]/15 border-[#E8A020]/30 text-[#E8A020]'
                  : 'bg-white/[0.04] border-white/[0.08] text-slate-400 hover:text-white hover:bg-white/[0.06]'
              }`}
            >
              <Filter className="h-3 w-3" /> Score &ge; 40
            </button>

            {/* Stage dropdown */}
            <div className="relative">
              <select
                value={stageFilter}
                onChange={(e) => setStageFilter(e.target.value)}
                className="appearance-none bg-white/[0.04] border border-white/[0.08] rounded-lg pl-3 pr-7 py-1.5 text-xs text-slate-300 focus:outline-none focus:ring-1 focus:ring-[#1ABFFF]/50 cursor-pointer"
              >
                <option value="">{t('All Stages', 'Todas las Etapas')}</option>
                {STAGES.map((s) => (
                  <option key={s.value} value={s.value} className="bg-slate-900">{s.label}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-3 w-3 text-slate-500 pointer-events-none" />
            </div>

            {/* Sort */}
            <div className="relative">
              <select
                value={sortKey}
                onChange={(e) => setSortKey(e.target.value as SortKey)}
                className="appearance-none bg-white/[0.04] border border-white/[0.08] rounded-lg pl-3 pr-7 py-1.5 text-xs text-slate-300 focus:outline-none focus:ring-1 focus:ring-[#1ABFFF]/50 cursor-pointer"
              >
                <option value="urgency" className="bg-slate-900">{t('Sort: Urgency', 'Orden: Urgencia')}</option>
                <option value="stale" className="bg-slate-900">{t('Sort: Days Stale', 'Orden: Dias Inactivo')}</option>
                <option value="assets" className="bg-slate-900">{t('Sort: Assets', 'Orden: Activos')}</option>
              </select>
              <ArrowUpDown className="absolute right-2 top-1/2 -translate-y-1/2 h-3 w-3 text-slate-500 pointer-events-none" />
            </div>
          </div>

          {/* Right: view toggle */}
          <div className="flex items-center bg-white/[0.04] border border-white/[0.08] rounded-lg p-0.5">
            <button
              onClick={() => setView('table')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition ${
                view === 'table' ? 'bg-[#1B3A6B] text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              <Table2 className="h-3.5 w-3.5" /> Table
            </button>
            <button
              onClick={() => setView('kanban')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition ${
                view === 'kanban' ? 'bg-[#1B3A6B] text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              <LayoutGrid className="h-3.5 w-3.5" /> Kanban
            </button>
          </div>
        </div>

        {/* ================================================================ */}
        {/*  2. TABLE VIEW                                                   */}
        {/* ================================================================ */}
        {view === 'table' && (
          <div className="bg-slate-900/60 border border-white/[0.08] rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[800px]">
                <thead>
                  <tr className="border-b border-white/[0.08] text-left">
                    <th className="px-4 py-3 text-[11px] uppercase tracking-wider text-slate-500 font-medium">{t('Institution', 'Institucion')}</th>
                    <th className="px-4 py-3 text-[11px] uppercase tracking-wider text-slate-500 font-medium">{t('Assets', 'Activos')}</th>
                    <th className="px-4 py-3 text-[11px] uppercase tracking-wider text-slate-500 font-medium">{t('Stage', 'Etapa')}</th>
                    <th className="px-4 py-3 text-[11px] uppercase tracking-wider text-slate-500 font-medium">{t('Urgency Score', 'Puntuacion Urgencia')}</th>
                    <th className="px-4 py-3 text-[11px] uppercase tracking-wider text-slate-500 font-medium">{t('Days Since Contact', 'Dias Sin Contacto')}</th>
                    <th className="px-4 py-3 text-[11px] uppercase tracking-wider text-slate-500 font-medium">{t('Actions', 'Acciones')}</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <>
                      <SkeletonRow />
                      <SkeletonRow />
                      <SkeletonRow />
                      <SkeletonRow />
                      <SkeletonRow />
                    </>
                  ) : filtered.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-8">
                        <EmptyState
                          icon={Users}
                          titleEs={t('No prospects match the current filters', 'No hay prospectos')}
                          title={t('No prospects match the current filters', 'No hay prospectos')}
                          descriptionEs={t('Adjust your filters or refresh to see available prospects.', 'Ajuste sus filtros o recargue para ver prospectos disponibles.')}
                          description={t('Adjust your filters or refresh to see available prospects.', 'Ajuste sus filtros o recargue para ver prospectos disponibles.')}
                          actionLabelEs={t('Clear filters', 'Limpiar filtros')}
                          actionLabel={t('Clear filters', 'Limpiar filtros')}
                          onAction={() => { setScoreFilter(false); setStageFilter(''); }}
                        />
                      </td>
                    </tr>
                  ) : (
                    filtered.map((p) => {
                      const stageInfo = STAGE_MAP[p.stage] || STAGES[0];
                      const days = daysSince(p.outreachSentAt);
                      return (
                        <tr key={p.id} className="border-b border-white/[0.04] hover:bg-white/[0.02] group">
                          {/* Institution */}
                          <td className="px-4 py-3">
                            <span className="text-white font-semibold">{p.name}</span>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-[11px] text-slate-500">{p.location}</span>
                              {p.contactRole && (
                                <span className="text-[11px] text-slate-600">&middot; {p.contactRole}</span>
                              )}
                            </div>
                          </td>

                          {/* Assets */}
                          <td className="px-4 py-3 text-slate-300 font-medium tabular-nums">
                            ${p.assets}M
                          </td>

                          {/* Stage Badge */}
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium ${stageInfo.bg} ${stageInfo.color}`}>
                              {stageInfo.label}
                            </span>
                          </td>

                          {/* Urgency Score */}
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2.5 min-w-[120px]">
                              <div className="flex-1 h-2 bg-white/[0.06] rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full transition-all ${urgencyColor(p.urgencyScore)}`}
                                  style={{ width: `${p.urgencyScore}%` }}
                                />
                              </div>
                              <span className={`text-xs font-bold tabular-nums w-7 text-right ${urgencyTextColor(p.urgencyScore)}`}>
                                {p.urgencyScore}
                              </span>
                            </div>
                          </td>

                          {/* Days Since Contact */}
                          <td className="px-4 py-3">
                            {days !== null ? (
                              <span className={`text-sm tabular-nums ${days > 14 ? 'text-red-400 font-semibold' : days > 7 ? 'text-[#E8A020]' : 'text-slate-400'}`}>
                                {days}d {t('ago', 'hace')}
                              </span>
                            ) : (
                              <span className="text-xs text-slate-600">{t('Never', 'Nunca')}</span>
                            )}
                          </td>

                          {/* Actions */}
                          <td className="px-4 py-3">
                            <button
                              onClick={() => setOutreachProspect(p)}
                              className="flex items-center gap-1.5 text-xs bg-[#1B3A6B]/60 hover:bg-[#1B3A6B] border border-[#1ABFFF]/20 hover:border-[#1ABFFF]/40 text-[#1ABFFF] px-3 py-1.5 rounded-lg transition font-medium"
                            >
                              <Eye className="h-3 w-3" /> {t('View Outreach', 'Ver Outreach')}
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ================================================================ */}
        {/*  3. KANBAN VIEW                                                  */}
        {/* ================================================================ */}
        {view === 'kanban' && (
          <div className="overflow-x-auto pb-4 -mx-4 px-4 sm:mx-0 sm:px-0">
            <div className="flex gap-3 min-w-[1100px]">
              {STAGES.map((stage) => {
                const cards = filtered.filter((p) => p.stage === stage.value);
                return (
                  <div key={stage.value} className="flex-1 min-w-[180px]">
                    {/* Column header */}
                    <div className={`flex items-center justify-between px-3 py-2 rounded-t-xl border-b-2 ${stage.border} bg-white/[0.02]`}>
                      <span className={`text-xs font-semibold ${stage.color}`}>{stage.label}</span>
                      <span className="text-[10px] text-slate-600 tabular-nums">{cards.length}</span>
                    </div>
                    {/* Cards */}
                    <div className="space-y-2 pt-2 min-h-[120px]">
                      {loading ? (
                        <>
                          <SkeletonCard />
                          <SkeletonCard />
                        </>
                      ) : cards.length === 0 ? (
                        <div className="text-center py-6 text-[11px] text-slate-600">
                          <Users className="mx-auto h-5 w-5 text-slate-700 mb-1" />
                          <span>{t('No prospects', 'Sin prospectos')}</span>
                        </div>
                      ) : (
                        cards.map((p) => {
                          const days = daysSince(p.outreachSentAt);
                          return (
                            <button
                              key={p.id}
                              onClick={() => setOutreachProspect(p)}
                              className="w-full text-left bg-slate-900/60 border border-white/[0.06] hover:border-[#1ABFFF]/30 rounded-xl p-3 transition group/card"
                            >
                              <div className="flex items-start justify-between gap-2 mb-1.5">
                                <span className="text-sm font-semibold text-white leading-tight">{p.name}</span>
                                <span className={`flex-shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded ${urgencyColor(p.urgencyScore)} text-slate-950`}>
                                  {p.urgencyScore}
                                </span>
                              </div>
                              <div className="text-xs text-slate-500 mb-1">${p.assets}M &middot; {p.location}</div>
                              <div className="text-[11px] text-slate-600">
                                {days !== null ? (
                                  <span className={days > 14 ? 'text-red-400' : days > 7 ? 'text-[#E8A020]' : ''}>
                                    {t('Contacted', 'Contactado')} {days}d {t('ago', 'hace')}
                                  </span>
                                ) : (
                                  t('Never contacted', 'Nunca contactado')
                                )}
                              </div>
                            </button>
                          );
                        })
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ================================================================ */}
        {/*  5. OUTREACH MODAL                                               */}
        {/* ================================================================ */}
        {outreachProspect && (
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={() => { setOutreachProspect(null); setCopied(false); }}
          >
            <div
              className="bg-slate-900 border border-white/[0.1] rounded-2xl w-full max-w-lg max-h-[90vh] flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal header */}
              <div className="flex items-start justify-between p-5 pb-0">
                <div>
                  <h3 className="text-lg font-bold text-white">{outreachProspect.name}</h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    ${outreachProspect.assets}M &middot; {outreachProspect.location} &middot; {outreachProspect.contactRole}
                  </p>
                </div>
                <button
                  onClick={() => { setOutreachProspect(null); setCopied(false); }}
                  className="text-slate-500 hover:text-white transition p-1"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Stage + Urgency */}
              <div className="flex items-center gap-3 px-5 pt-3">
                {(() => {
                  const si = STAGE_MAP[outreachProspect.stage] || STAGES[0];
                  return (
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium ${si.bg} ${si.color}`}>
                      {si.label}
                    </span>
                  );
                })()}
                <span className={`text-xs font-bold ${urgencyTextColor(outreachProspect.urgencyScore)}`}>
                  {t('Urgency', 'Urgencia')}: {outreachProspect.urgencyScore}/100
                </span>
                {outreachProspect.examDate && (
                  <span className="text-xs text-slate-500">
                    {t('Exam', 'Examen')}: {new Date(outreachProspect.examDate).toLocaleDateString()}
                  </span>
                )}
              </div>

              {/* Known Pain */}
              {outreachProspect.knownPain && (
                <div className="px-5 pt-3">
                  <p className="text-[11px] uppercase tracking-wider text-slate-500 font-medium mb-1">{t('Known Pain', 'Necesidad Identificada')}</p>
                  <p className="text-sm text-slate-300 leading-relaxed">{outreachProspect.knownPain}</p>
                </div>
              )}

              {/* Outreach Draft */}
              <div className="px-5 pt-4 pb-5 flex-1 overflow-y-auto">
                <p className="text-[11px] uppercase tracking-wider text-slate-500 font-medium mb-2">{t('Outreach Draft', 'Borrador de Contacto')}</p>
                <div className="bg-slate-800/60 border border-white/[0.06] rounded-xl p-4 text-sm text-slate-200 leading-relaxed whitespace-pre-wrap">
                  {outreachProspect.outreachDraft || t('No outreach draft available.', 'No hay borrador de contacto disponible.')}
                </div>
              </div>

              {/* Footer */}
              <div className="border-t border-white/[0.08] px-5 py-4 flex items-center justify-between">
                <div className="text-[11px] text-slate-600">
                  {outreachProspect.outreachSentAt
                    ? `${t('Last sent', 'Ultimo envio')}: ${new Date(outreachProspect.outreachSentAt).toLocaleDateString()}`
                    : t('Never sent', 'Nunca enviado')}
                </div>
                <button
                  onClick={() => copyOutreach(outreachProspect.outreachDraft || '')}
                  disabled={!outreachProspect.outreachDraft}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition ${
                    copied
                      ? 'bg-[#18C87A]/20 text-[#18C87A] border border-[#18C87A]/30'
                      : 'bg-[#1ABFFF]/15 hover:bg-[#1ABFFF]/25 text-[#1ABFFF] border border-[#1ABFFF]/30'
                  } disabled:opacity-40 disabled:cursor-not-allowed`}
                >
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  {copied ? t('Copied', 'Copiado') : t('Copy to clipboard', 'Copiar al portapapeles')}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
