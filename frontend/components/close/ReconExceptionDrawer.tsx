'use client';

/**
 * ReconExceptionDrawer — slide-in drill-down for a single reconciliation.
 *
 * Customer journey moment: Maria scans the tie-out panel and sees one
 * row glowing red: "Money Market · EXCEPTION · −$250". She clicks it.
 * The drawer slides in from the right showing the unmatched items
 * straight from the backend, plus a quick explanation of what
 * "EXCEPTION" means and a link back to the calendar task that owns
 * the rec. She now knows exactly which dollar to chase.
 *
 * Read-only for now: the full "mark unmatched item resolved" workflow
 * is a backend follow-up. This drawer unblocks the most common need
 * ("tell me what's unmatched") without that round-trip.
 */

import { useEffect, useState } from 'react';
import { ClipboardCheck, Link2, Loader2, X } from 'lucide-react';
import { closeApi, type CloseReconciliation } from '@/lib/close-api';

type Lang = 'en' | 'es';

interface ReconExceptionDrawerProps {
  recon: CloseReconciliation | null;
  cycleId: string;
  lang: Lang;
  open: boolean;
  locked: boolean;
  onClose: () => void;
  onReviewed?: (updated: CloseReconciliation) => void;
  onToast?: (message: string, variant: 'success' | 'error') => void;
}

interface UnmatchedLine {
  description?: string;
  amount?: number;
  side?: 'gl' | 'ext';
}

function fmtUsd(n: string | number): string {
  const v = typeof n === 'string' ? Number(n) : n;
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(v);
}

function fmtSigned(n: string | number): string {
  const v = typeof n === 'string' ? Number(n) : n;
  if (v === 0) return '$0.00';
  const f = fmtUsd(Math.abs(v));
  return v > 0 ? `+${f}` : `−${f}`;
}

export function ReconExceptionDrawer({
  recon,
  cycleId,
  lang,
  open,
  locked,
  onClose,
  onReviewed,
  onToast,
}: ReconExceptionDrawerProps) {
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Reset the notes input each time a different recon is opened so old
  // drafts don't bleed across investigations.
  useEffect(() => {
    setNotes('');
  }, [recon?.id]);

  // Escape key + body scroll lock — same UX contract as the task drawer.
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!recon) return null;
  // Narrow once so the closures below see a non-null value.
  const r = recon;

  async function markReviewed() {
    if (locked || submitting) return;
    setSubmitting(true);
    try {
      const updated = await closeApi.reviewReconciliation(cycleId, r.id, notes.trim() || undefined);
      onReviewed?.(updated);
      onToast?.(
        lang === 'en'
          ? `Reconciliation ${r.account} marked reviewed`
          : `Conciliación ${r.account} marcada como revisada`,
        'success',
      );
      onClose();
    } catch (err) {
      onToast?.(err instanceof Error ? err.message : 'Review failed', 'error');
    } finally {
      setSubmitting(false);
    }
  }

  const canReview = !locked && r.status !== 'REVIEWED' && r.status !== 'SIGNED_OFF';

  const items: UnmatchedLine[] = Array.isArray(r.unmatchedItems)
    ? (r.unmatchedItems as UnmatchedLine[])
    : [];

  const glSide = items.filter((i) => i.side === 'gl');
  const extSide = items.filter((i) => i.side === 'ext');
  const unsided = items.filter((i) => i.side !== 'gl' && i.side !== 'ext');

  return (
    <>
      <div
        className={`fixed inset-0 z-50 bg-black/30 backdrop-blur-sm transition-opacity ${
          open ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
        onClick={onClose}
        aria-hidden
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={lang === 'en' ? 'Reconciliation detail' : 'Detalle de conciliación'}
        className={`fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col overflow-y-auto bg-white shadow-2xl transition-transform ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <header className="sticky top-0 z-10 border-b border-slate-100 bg-white px-5 py-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                {r.reconType}
              </div>
              <h2 className="mt-0.5 font-mono text-base font-bold text-slate-900">{r.account}</h2>
              <div className="mt-2 inline-flex items-center rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-rose-700">
                {r.status}
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              aria-label={lang === 'en' ? 'Close' : 'Cerrar'}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </header>

        <div className="flex-1 space-y-5 px-5 py-5">
          <section>
            <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              {lang === 'en' ? 'Balances' : 'Saldos'}
            </div>
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                <dt className="text-[10px] uppercase tracking-wider text-slate-500">GL</dt>
                <dd className="mt-0.5 font-mono text-base tabular-nums text-slate-900">
                  {fmtUsd(r.glBalance)}
                </dd>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                <dt className="text-[10px] uppercase tracking-wider text-slate-500">
                  {lang === 'en' ? 'External' : 'Externo'}
                </dt>
                <dd className="mt-0.5 font-mono text-base tabular-nums text-slate-900">
                  {fmtUsd(r.externalBalance)}
                </dd>
              </div>
              <div className="col-span-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2">
                <dt className="text-[10px] uppercase tracking-wider text-rose-600">
                  {lang === 'en' ? 'Difference' : 'Diferencia'}
                </dt>
                <dd className="mt-0.5 font-mono text-base tabular-nums text-rose-700">
                  {fmtSigned(r.difference)}
                </dd>
              </div>
            </dl>
          </section>

          <section>
            <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              {lang === 'en' ? 'Unmatched items' : 'Partidas no conciliadas'}
            </div>
            {items.length === 0 ? (
              <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500">
                {lang === 'en'
                  ? 'No line-level unmatched items were captured for this tie-out. The difference comes from the summary balances only.'
                  : 'Esta conciliación no capturó partidas no conciliadas al nivel de línea. La diferencia proviene solo de los saldos resumidos.'}
              </p>
            ) : (
              <div className="space-y-3">
                {glSide.length > 0 ? (
                  <Group
                    title={lang === 'en' ? 'GL side' : 'Lado GL'}
                    items={glSide}
                  />
                ) : null}
                {extSide.length > 0 ? (
                  <Group
                    title={lang === 'en' ? 'External side' : 'Lado externo'}
                    items={extSide}
                  />
                ) : null}
                {unsided.length > 0 ? (
                  <Group
                    title={lang === 'en' ? 'Other' : 'Otro'}
                    items={unsided}
                  />
                ) : null}
              </div>
            )}
          </section>

          <section>
            <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              {lang === 'en' ? 'What "EXCEPTION" means' : 'Qué significa "EXCEPCIÓN"'}
            </div>
            <p className="text-xs leading-relaxed text-slate-600">
              {lang === 'en'
                ? 'The tie-out engine could not match every GL line against an external statement line, or the summary balances disagree beyond the penny tolerance. Resolve it by posting the missing JE, then re-run this tie-out — the status will flip to TIE automatically.'
                : 'El motor de conciliación no pudo emparejar cada línea GL con una línea del estado externo, o los saldos resumidos difieren más allá de la tolerancia de centavos. Resuélvalo registrando el asiento faltante y corra la conciliación de nuevo — el estado cambiará a CUADRADO automáticamente.'}
            </p>
          </section>

          {/* Mark reviewed action */}
          {canReview ? (
            <section>
              <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                {lang === 'en' ? 'Mark as reviewed' : 'Marcar como revisada'}
              </div>
              <p className="mb-2 text-xs leading-relaxed text-slate-500">
                {lang === 'en'
                  ? 'Use this when you\u2019ve investigated and the variance is acceptable (e.g. timing difference) without needing a JE.'
                  : 'Use esto cuando ha investigado y la variación es aceptable (p. ej., diferencia de tiempo) sin necesitar un asiento.'}
              </p>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={
                  lang === 'en'
                    ? 'Optional notes — stored on the activity log forever.'
                    : 'Notas opcionales — almacenadas en el historial.'
                }
                rows={3}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
              />
            </section>
          ) : null}
        </div>

        {canReview ? (
          <footer className="sticky bottom-0 border-t border-slate-100 bg-white px-5 py-4">
            <button
              type="button"
              onClick={markReviewed}
              disabled={submitting}
              className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ClipboardCheck className="h-4 w-4" />}
              {lang === 'en' ? 'Mark reviewed' : 'Marcar revisada'}
            </button>
          </footer>
        ) : null}
      </aside>
    </>
  );
}

function Group({ title, items }: { title: string; items: UnmatchedLine[] }) {
  return (
    <div>
      <div className="mb-1 text-[10px] uppercase tracking-wider text-slate-400">{title}</div>
      <ul className="space-y-1">
        {items.map((item, i) => (
          <li
            key={`${item.description ?? 'item'}-${i}`}
            className="flex items-center justify-between gap-3 rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs"
          >
            <span className="flex min-w-0 items-center gap-1.5 truncate">
              <Link2 className="h-3 w-3 shrink-0 text-slate-400" />
              <span className="truncate">
                {item.description ?? (item.side === 'gl' ? 'GL line' : 'External line')}
              </span>
            </span>
            {item.amount != null ? (
              <span className="shrink-0 font-mono tabular-nums text-slate-900">
                {fmtUsd(item.amount)}
              </span>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
