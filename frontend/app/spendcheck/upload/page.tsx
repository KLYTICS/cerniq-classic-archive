'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import PlatformPage from '@/components/layout/PlatformPage';
import UploadZone from '@/components/spendcheck/UploadZone';
import { spendcheckApi, AnalysisResult, Workspace } from '@/lib/spendcheck-api';

function UploadContent() {
  const searchParams = useSearchParams();
  const workspaceId = searchParams.get('workspace');

  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (workspaceId) {
      void loadWorkspace(workspaceId);
    }
  }, [workspaceId]);

  async function loadWorkspace(id: string) {
    try {
      const data = await spendcheckApi.getWorkspace(id);
      setWorkspace(data);
    } catch (err) {
      console.error('Failed to load workspace:', err);
      setError('Workspace not found');
    }
  }

  async function handleUploadAndAnalyze() {
    if (!file || !workspaceId) {
      return;
    }

    setUploading(true);
    setProgress(10);

    try {
      setProgress(30);
      const uploadResponse = await spendcheckApi.uploadFile(workspaceId, file);

      setUploading(false);
      setAnalyzing(true);
      setProgress(60);

      const result = await spendcheckApi.runAnalysis(uploadResponse.id, workspaceId);
      setProgress(100);
      setAnalysisResult(result);
    } catch (err) {
      console.error('Process failed:', err);
      setError('Failed to process file. Please try again.');
    } finally {
      setUploading(false);
      setAnalyzing(false);
    }
  }

  if (!workspaceId) {
    return (
      <section className="cerniq-empty-state">
        <h2 className="font-display text-3xl text-slate-950">No workspace selected</h2>
        <p className="mt-3 text-sm leading-7 text-slate-600">Return to SpendCheck and choose a workspace before uploading files.</p>
        <Link href="/spendcheck" className="cerniq-button-secondary mt-6 px-5 py-3 text-sm">
          Return to SpendCheck
        </Link>
      </section>
    );
  }

  return (
    <PlatformPage
      kicker="SpendCheck upload"
      title="Upload AP exports and push them straight into the SpendCheck analysis engine."
      description="This flow keeps the ingestion path simple: confirm the workspace, drop the CSV, and watch CERNIQ move from upload to leak detection in one clear sequence."
      meta={
        workspace ? (
          <span className="cerniq-mini-stat">
            <strong>{workspace.name}</strong>
          </span>
        ) : undefined
      }
      actions={
        <Link href="/spendcheck" className="cerniq-button-secondary px-5 py-3 text-sm">
          Back to SpendCheck
        </Link>
      }
    >
      {!analysisResult ? (
        <div className="space-y-6">
          <section className="cerniq-panel p-6">
            <div className="grid gap-4 md:grid-cols-3">
              {[
                ['1', 'Select file', file ? 'CSV attached and ready for processing.' : 'Choose the AP export you want to analyze.'],
                ['2', 'Run analysis', analyzing ? 'Leak detection is running now.' : 'CERNIQ validates the file and starts the findings engine.'],
                ['3', 'Review results', analysisResult ? 'Results are available.' : 'Move directly into findings once the run completes.'],
              ].map(([step, title, copy]) => (
                <div key={step} className="rounded-[1.25rem] border border-slate-200 bg-white/86 p-5">
                  <span className="cerniq-chip">{step}</span>
                  <h2 className="mt-4 font-display text-2xl text-slate-950">{title}</h2>
                  <p className="mt-3 text-sm leading-7 text-slate-600">{copy}</p>
                </div>
              ))}
            </div>
          </section>

          {error ? (
            <section className="rounded-[1.5rem] border border-rose-200 bg-rose-50/90 p-5 text-sm text-rose-700">
              {error}
            </section>
          ) : null}

          {!file ? (
            <UploadZone onFileSelect={(selectedFile) => {
              setFile(selectedFile);
              setError(null);
            }} isUploading={uploading} />
          ) : (
            <section className="cerniq-panel p-8 text-center">
              <div className="text-5xl">📄</div>
              <h2 className="mt-5 font-display text-3xl text-slate-950">{file.name}</h2>
              <p className="mt-3 text-sm text-slate-500">{(file.size / 1024).toFixed(1)} KB · CSV</p>

              {!uploading && !analyzing ? (
                <div className="mt-8 flex flex-wrap justify-center gap-3">
                  <button onClick={() => setFile(null)} className="cerniq-button-secondary px-5 py-3 text-sm">
                    Change file
                  </button>
                  <button onClick={handleUploadAndAnalyze} className="cerniq-button-primary px-5 py-3 text-sm">
                    Run analysis
                  </button>
                </div>
              ) : (
                <div className="mx-auto mt-8 max-w-md">
                  <div className="mb-2 flex items-center justify-between text-sm">
                    <span className="text-cyan-700">{uploading ? 'Uploading…' : 'Detecting spend leaks…'}</span>
                    <span className="text-slate-500">{progress}%</span>
                  </div>
                  <div className="cerniq-progress-track">
                    <div className="cerniq-progress-bar" style={{ width: `${progress}%` }} />
                  </div>
                  <p className="mt-4 text-xs text-slate-500">
                    Analyzing supplier patterns, duplicate charges, and price drift across the file.
                  </p>
                </div>
              )}
            </section>
          )}
        </div>
      ) : (
        <section className="cerniq-panel p-8 text-center">
          <div className="text-6xl">🎉</div>
          <h2 className="mt-5 font-display text-4xl text-slate-950">Analysis complete</h2>
          <p className="mt-3 text-sm leading-7 text-slate-600">
            CERNIQ processed <strong>{analysisResult.invoices_parsed}</strong> invoices and found{' '}
            <strong>{analysisResult.findings_found}</strong> potential leaks.
          </p>

          <div className="mx-auto mt-8 grid max-w-3xl gap-4 md:grid-cols-2">
            <div className="rounded-[1.25rem] border border-slate-200 bg-white/86 p-6">
              <p className="cerniq-caption">Potential savings</p>
              <p className="mt-3 text-3xl font-bold text-emerald-700">
                {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(analysisResult.total_potential_savings)}
              </p>
            </div>
            <div className="rounded-[1.25rem] border border-slate-200 bg-white/86 p-6 text-left">
              <p className="cerniq-caption">Breakdown</p>
              <div className="mt-4 space-y-2">
                {Object.entries(analysisResult.findings_by_type).map(([type, count]) => (
                  <div key={type} className="flex items-center justify-between text-sm">
                    <span className="capitalize text-slate-600">{type.replace(/_/g, ' ')}</span>
                    <span className="font-semibold text-slate-950">{count}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link
              href={`/spendcheck/upload?workspace=${workspaceId}`}
              onClick={() => {
                setFile(null);
                setAnalysisResult(null);
              }}
              className="cerniq-button-secondary px-5 py-3 text-sm"
            >
              Upload another
            </Link>
            <Link href={`/spendcheck/findings?workspace=${workspaceId}`} className="cerniq-button-primary px-5 py-3 text-sm">
              View findings
            </Link>
          </div>
        </section>
      )}
    </PlatformPage>
  );
}

export default function UploadPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[#f7fbff]">
          <div className="h-12 w-12 animate-spin rounded-full border-2 border-cyan-200 border-t-cyan-600" />
        </div>
      }
    >
      <UploadContent />
    </Suspense>
  );
}
