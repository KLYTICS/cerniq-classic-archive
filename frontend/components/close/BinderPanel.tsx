'use client';

/**
 * BinderPanel — audit binder export center for the dynamic cycle workspace.
 *
 * Customer journey moment: External CPA emails Maria asking for the close
 * pack. She opens this tab, hits Download. JSON binder lands in her email
 * draft 5 seconds later. The CPA opens it, sees every artifact in one
 * deterministic file, and stops asking follow-up questions.
 */

import { useState } from 'react';
import { Download, Loader2, ShieldCheck } from 'lucide-react';
import { MetricStrip } from '@/components/ui/cerniq';
import { closeApi, type CloseCycleDetail } from '@/lib/close-api';

type Lang = 'en' | 'es';

interface BinderPanelProps {
  cycle: CloseCycleDetail;
  lang: Lang;
}

export function BinderPanel({ cycle, lang }: BinderPanelProps) {
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const tasks = cycle.tasks ?? [];
  const recs = cycle.reconciliations ?? [];
  const jes = cycle.journalEntries ?? [];
  const flux = cycle.fluxNarratives ?? [];
  const materialFlux = flux.filter((f) => f.isMaterial).length;

  async function downloadJson() {
    if (downloading) return;
    setDownloading(true);
    setError(null);
    try {
      const pack = await closeApi.binder(cycle.id);
      const blob = new Blob([JSON.stringify(pack, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `audit-binder-${cycle.periodYear}-${String(cycle.periodMonth).padStart(2, '0')}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Download failed');
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="space-y-4">
      <MetricStrip
        items={[
          { label: lang === 'en' ? 'Tasks' : 'Tareas', value: tasks.length },
          { label: lang === 'en' ? 'Recs' : 'Concil.', value: recs.length },
          { label: 'JEs', value: jes.length },
          {
            label: lang === 'en' ? 'Material' : 'Material',
            value: materialFlux,
            delta: materialFlux,
            deltaFormat: 'number',
          },
        ]}
        density="comfortable"
      />

      <section className="rounded-xl border border-slate-200 bg-white p-6">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-emerald-50">
            <ShieldCheck className="h-6 w-6 text-emerald-600" />
          </div>
          <div className="flex-1">
            <h3 className="text-base font-semibold text-slate-900">
              {lang === 'en' ? 'Examiner-ready binder' : 'Carpeta lista para examinador'}
            </h3>
            <p className="mt-1 text-sm text-slate-600">
              {lang === 'en'
                ? 'Deterministic JSON pack containing every artifact your auditor and the COSSEC examiner will request.'
                : 'Paquete JSON determinista con todos los artefactos que pedirán su auditor y el examinador COSSEC.'}
            </p>

            <dl className="mt-4 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
              <ManifestRow
                label={lang === 'en' ? 'Period' : 'Período'}
                value={`${cycle.periodYear}-${String(cycle.periodMonth).padStart(2, '0')}`}
                mono
              />
              <ManifestRow label={lang === 'en' ? 'Status' : 'Estado'} value={cycle.status} />
              <ManifestRow
                label={lang === 'en' ? 'Materiality $' : 'Materialidad $'}
                value={new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(
                  Number(cycle.materialityAbs),
                )}
                mono
              />
              <ManifestRow
                label={lang === 'en' ? 'Materiality %' : 'Materialidad %'}
                value={`${(cycle.materialityPct * 100).toFixed(1)}%`}
                mono
              />
              <ManifestRow label={lang === 'en' ? 'Tasks' : 'Tareas'} value={String(tasks.length)} mono />
              <ManifestRow label={lang === 'en' ? 'Recs' : 'Concil.'} value={String(recs.length)} mono />
              <ManifestRow label="JEs" value={String(jes.length)} mono />
              <ManifestRow
                label={lang === 'en' ? 'Material flux' : 'Flujo material'}
                value={String(materialFlux)}
                mono
              />
            </dl>

            {error ? <p className="mt-3 text-xs text-rose-600">{error}</p> : null}

            <div className="mt-5">
              <button
                type="button"
                onClick={downloadJson}
                disabled={downloading}
                className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-5 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
              >
                {downloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                {lang === 'en' ? 'Download JSON pack' : 'Descargar paquete JSON'}
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function ManifestRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex justify-between gap-3 border-b border-slate-100 py-1.5">
      <dt className="text-slate-500">{label}</dt>
      <dd className={mono ? 'font-mono text-slate-900' : 'font-medium text-slate-900'}>{value}</dd>
    </div>
  );
}
