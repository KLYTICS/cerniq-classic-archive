'use client';

/**
 * GlUploadModal — drag-drop CSV uploader for the org's GL snapshot table.
 *
 * Customer journey moment: Monday morning, first day of close. Maria
 * exports this month's trial balance from NetSuite as a CSV. She opens
 * the Close Cockpit, clicks "Upload GL CSV", drops the file, and within
 * 2 seconds sees "142 accounts inserted". From that moment every
 * "Pull from GL" button in the cockpit uses the real data — the `DEMO`
 * badges flip to green `SNAPSHOT` badges across the whole workspace.
 *
 * UX design:
 *   - Drag-drop zone with keyboard + click fallback
 *   - Inline format explainer (the 4 required columns)
 *   - Live result summary after upload: inserted / updated / errored
 *   - Per-row errors shown in a collapsible list so users can fix the
 *     CSV and re-upload
 *   - Re-runs are safe — the upsert key is (org, account, period)
 */

import { useRef, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Database,
  Loader2,
  Upload,
} from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { closeApi, type GlUploadResult } from '@/lib/close-api';

type Lang = 'en' | 'es';

interface GlUploadModalProps {
  open: boolean;
  orgId: string;
  lang: Lang;
  onClose: () => void;
  onUploaded?: (result: GlUploadResult) => void;
}

export function GlUploadModal({ open, orgId, lang, onClose, onUploaded }: GlUploadModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [selected, setSelected] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<GlUploadResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showAllErrors, setShowAllErrors] = useState(false);

  function reset() {
    setSelected(null);
    setResult(null);
    setError(null);
    setShowAllErrors(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  function handleFile(file: File | undefined) {
    if (!file) return;
    if (!/\.csv$/i.test(file.name)) {
      setError(lang === 'en' ? 'Only .csv files are accepted' : 'Solo se aceptan archivos .csv');
      return;
    }
    setSelected(file);
    setError(null);
    setResult(null);
  }

  async function submit() {
    if (!selected || uploading) return;
    setUploading(true);
    setError(null);
    try {
      const res = await closeApi.uploadGlCsv(orgId, selected);
      setResult(res);
      onUploaded?.(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  }

  function closeAndReset() {
    reset();
    onClose();
  }

  return (
    <Modal
      open={open}
      onClose={uploading ? () => undefined : closeAndReset}
      title={lang === 'en' ? 'Upload GL CSV' : 'Cargar CSV del GL'}
      maxWidth="max-w-xl"
    >
      <div className="space-y-4">
        {/* Format explainer */}
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
          <div className="mb-1 font-semibold uppercase tracking-wider text-slate-500">
            {lang === 'en' ? 'CSV format' : 'Formato CSV'}
          </div>
          <p className="mb-2 leading-relaxed">
            {lang === 'en'
              ? 'Required columns: account, period_year, period_month, balance. Optional: notes. Re-uploads upsert safely.'
              : 'Columnas requeridas: account, period_year, period_month, balance. Opcional: notes. Re-cargas actualizan sin duplicar.'}
          </p>
          <pre className="overflow-x-auto rounded bg-white px-2 py-1 font-mono text-[10px] text-slate-700">
account,period_year,period_month,balance{'\n'}
1010 Operating Cash,2026,4,1245310.22{'\n'}
1200 Accounts Receivable,2026,4,522900.00
          </pre>
        </div>

        {/* Drop zone */}
        {!result ? (
          <div
            role="button"
            tabIndex={0}
            onClick={() => fileInputRef.current?.click()}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                fileInputRef.current?.click();
              }
            }}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              handleFile(e.dataTransfer.files[0]);
            }}
            className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-6 text-center transition ${
              dragOver
                ? 'border-slate-900 bg-slate-50'
                : 'border-slate-300 bg-white hover:border-slate-400 hover:bg-slate-50'
            }`}
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100">
              <Upload className="h-5 w-5 text-slate-600" />
            </div>
            {selected ? (
              <div>
                <div className="text-sm font-semibold text-slate-900">{selected.name}</div>
                <div className="text-[11px] text-slate-500">
                  {(selected.size / 1024).toFixed(1)} KB
                </div>
              </div>
            ) : (
              <div className="text-sm text-slate-600">
                {lang === 'en'
                  ? 'Drop CSV here, or click to browse'
                  : 'Arrastre el CSV aquí, o haga clic para buscar'}
              </div>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              className="hidden"
              onChange={(e) => handleFile(e.target.files?.[0])}
            />
          </div>
        ) : null}

        {error ? (
          <div className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        ) : null}

        {/* Result summary */}
        {result ? (
          <div className="space-y-3">
            <div
              className={`flex items-start gap-3 rounded-xl border p-4 ${
                result.errored === 0
                  ? 'border-emerald-200 bg-emerald-50'
                  : 'border-amber-200 bg-amber-50'
              }`}
            >
              <div
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
                  result.errored === 0 ? 'bg-emerald-100' : 'bg-amber-100'
                }`}
              >
                {result.errored === 0 ? (
                  <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                ) : (
                  <AlertTriangle className="h-5 w-5 text-amber-600" />
                )}
              </div>
              <div className="flex-1">
                <div className="text-sm font-semibold text-slate-900">
                  {lang === 'en'
                    ? `${result.inserted + result.updated} of ${result.rows} rows processed`
                    : `${result.inserted + result.updated} de ${result.rows} filas procesadas`}
                </div>
                <div className="mt-1.5 grid grid-cols-3 gap-2 text-[11px] font-semibold uppercase tracking-wider">
                  <Stat label={lang === 'en' ? 'Inserted' : 'Insertadas'} value={result.inserted} tone="ok" />
                  <Stat label={lang === 'en' ? 'Updated' : 'Actualizadas'} value={result.updated} tone="info" />
                  <Stat
                    label={lang === 'en' ? 'Errored' : 'Con error'}
                    value={result.errored}
                    tone={result.errored > 0 ? 'bad' : 'ok'}
                  />
                </div>
              </div>
            </div>

            {result.errors.length > 0 ? (
              <div className="rounded-lg border border-slate-200 bg-white">
                <button
                  type="button"
                  onClick={() => setShowAllErrors((v) => !v)}
                  className="flex w-full items-center justify-between px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  <span>
                    {lang === 'en' ? 'Row errors' : 'Errores de fila'} ({result.errors.length})
                  </span>
                  <span className="text-slate-400">{showAllErrors ? '−' : '+'}</span>
                </button>
                {showAllErrors ? (
                  <ul className="max-h-48 space-y-0.5 overflow-y-auto border-t border-slate-100 px-3 py-2 text-[11px]">
                    {result.errors.slice(0, 100).map((e, i) => (
                      <li key={i} className="flex items-start gap-2 text-rose-700">
                        <span className="shrink-0 font-mono text-slate-400">row {e.rowNumber}</span>
                        <span>{e.message}</span>
                      </li>
                    ))}
                    {result.errors.length > 100 ? (
                      <li className="pt-1 text-[10px] italic text-slate-500">
                        … {result.errors.length - 100} more
                      </li>
                    ) : null}
                  </ul>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}

        {/* Actions */}
        <div className="flex items-center justify-end gap-2">
          {result ? (
            <>
              <button
                type="button"
                onClick={reset}
                className="rounded-full border border-slate-200 bg-white px-4 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
              >
                {lang === 'en' ? 'Upload another' : 'Cargar otro'}
              </button>
              <button
                type="button"
                onClick={closeAndReset}
                className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-5 py-1.5 text-sm font-semibold text-white hover:bg-slate-800"
              >
                {lang === 'en' ? 'Done' : 'Listo'}
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={closeAndReset}
                disabled={uploading}
                className="rounded-full border border-slate-200 bg-white px-4 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-60"
              >
                {lang === 'en' ? 'Cancel' : 'Cancelar'}
              </button>
              <button
                type="button"
                onClick={submit}
                disabled={!selected || uploading}
                className="inline-flex items-center gap-2 rounded-full bg-emerald-600 px-5 py-1.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Database className="h-4 w-4" />}
                {lang === 'en' ? 'Upload' : 'Cargar'}
              </button>
            </>
          )}
        </div>
      </div>
    </Modal>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: 'ok' | 'info' | 'bad';
}) {
  const color =
    tone === 'ok'
      ? 'text-emerald-700'
      : tone === 'bad'
        ? 'text-rose-700'
        : 'text-blue-700';
  return (
    <div className="rounded-md bg-white/60 px-2 py-1">
      <div className="text-[9px] text-slate-500">{label}</div>
      <div className={`font-mono text-sm tabular-nums ${color}`}>{value}</div>
    </div>
  );
}
