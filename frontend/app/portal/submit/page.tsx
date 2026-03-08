'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePortal } from '../layout';
import { Upload, Download, FileText, CheckCircle, AlertTriangle, ArrowRight } from 'lucide-react';
import { analytics, EVENTS } from '@/lib/analytics';

const NODE_API_URL = (process.env.NEXT_PUBLIC_NODE_API_URL || '').trim().replace(/\/+$/, '');

interface ReportJob {
  id: string;
  institutionName: string;
  status: string;
  createdAt: string;
}

export default function PortalSubmit() {
  const { user } = usePortal();
  const [jobs, setJobs] = useState<ReportJob[]>([]);
  const [selectedJob, setSelectedJob] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<{ valid: boolean; status: string; errors?: string[]; itemsImported?: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    async function loadJobs() {
      try {
        const res = await fetch(`${NODE_API_URL}/api/portal/jobs`, { credentials: 'include' });
        if (res.ok) {
          const allJobs: ReportJob[] = await res.json();
          const awaitingJobs = allJobs.filter(j => j.status === 'AWAITING_DATA' || j.status === 'VALIDATION_FAILED');
          setJobs(awaitingJobs);
          if (awaitingJobs.length === 1) setSelectedJob(awaitingJobs[0].id);
        }
      } catch { /* silent */ }
      setLoading(false);
    }
    loadJobs();
  }, []);

  const handleUpload = async () => {
    if (!selectedJob || !file) return;
    setUploading(true);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch(`${NODE_API_URL}/api/portal/jobs/${selectedJob}/submit`, {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });

      const data = await res.json();
      setResult(data);

      if (data.valid) {
        analytics.track(EVENTS.PORTAL_DATA_SUBMITTED, { jobId: selectedJob, items: data.itemsImported });
        // Remove job from awaiting list
        setJobs(prev => prev.filter(j => j.id !== selectedJob));
        setSelectedJob(null);
        setFile(null);
      }
      if (!data.valid) {
        analytics.track(EVENTS.PORTAL_DATA_VALIDATION_FAILED, { jobId: selectedJob });
      }
    } catch {
      setResult({ valid: false, status: 'ERROR', errors: ['Network error. Please try again.'] });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto p-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Submit Data</h1>
      <p className="text-sm text-gray-500 mb-8">
        Upload your institution&apos;s balance sheet to generate your ALM report.
      </p>

      {/* Step 1: Download Template */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <div className="flex items-start gap-4">
          <div className="w-8 h-8 rounded-full bg-[#1B3A6B] text-white flex items-center justify-center text-sm font-bold shrink-0">1</div>
          <div className="flex-1">
            <h2 className="text-sm font-semibold text-gray-900 mb-1">Download CSV Template</h2>
            <p className="text-sm text-gray-500 mb-3">
              Fill in your balance sheet data using our template. Includes columns for asset/liability type, amount, rate, and maturity.
            </p>
            <a
              href={`${NODE_API_URL}/api/alm/templates/cooperativa`}
              className="inline-flex items-center gap-2 border border-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 transition"
            >
              <Download className="h-4 w-4" /> Download Template (Cooperativa)
            </a>
          </div>
        </div>
      </div>

      {/* Step 2: Select Job */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <div className="flex items-start gap-4">
          <div className="w-8 h-8 rounded-full bg-[#1B3A6B] text-white flex items-center justify-center text-sm font-bold shrink-0">2</div>
          <div className="flex-1">
            <h2 className="text-sm font-semibold text-gray-900 mb-1">Select Report</h2>
            {loading ? (
              <p className="text-sm text-gray-400">Loading...</p>
            ) : jobs.length === 0 ? (
              <div className="text-sm text-gray-500">
                <p>No reports awaiting data. All your reports are either in progress or complete.</p>
                <Link href="/portal" className="text-[#1B3A6B] hover:underline mt-2 inline-block">
                  View your reports <ArrowRight className="inline h-3 w-3" />
                </Link>
              </div>
            ) : (
              <div className="space-y-2">
                {jobs.map(job => (
                  <button
                    key={job.id}
                    onClick={() => { setSelectedJob(job.id); setResult(null); }}
                    className={`w-full text-left px-4 py-3 rounded-lg border text-sm transition ${
                      selectedJob === job.id
                        ? 'border-[#1B3A6B] bg-blue-50 text-[#1B3A6B]'
                        : 'border-gray-200 hover:border-gray-300 text-gray-700'
                    }`}
                  >
                    <span className="font-medium">{job.institutionName}</span>
                    {job.status === 'VALIDATION_FAILED' && (
                      <span className="ml-2 text-xs text-red-500">Validation failed — retry</span>
                    )}
                    <span className="block text-xs text-gray-400 mt-0.5">
                      Created {new Date(job.createdAt).toLocaleDateString()}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Step 3: Upload */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <div className="flex items-start gap-4">
          <div className="w-8 h-8 rounded-full bg-[#1B3A6B] text-white flex items-center justify-center text-sm font-bold shrink-0">3</div>
          <div className="flex-1">
            <h2 className="text-sm font-semibold text-gray-900 mb-1">Upload Your Data</h2>
            <p className="text-sm text-gray-500 mb-3">
              Upload the completed CSV file. Max file size: 2MB.
            </p>

            <input
              ref={fileRef}
              type="file"
              accept=".csv"
              className="hidden"
              onChange={(e) => { setFile(e.target.files?.[0] || null); setResult(null); }}
            />

            <div
              onClick={() => fileRef.current?.click()}
              className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center cursor-pointer hover:border-[#1B3A6B] transition"
            >
              {file ? (
                <div className="flex items-center justify-center gap-2 text-sm text-gray-700">
                  <FileText className="h-5 w-5 text-[#1B3A6B]" />
                  <span className="font-medium">{file.name}</span>
                  <span className="text-gray-400">({(file.size / 1024).toFixed(1)} KB)</span>
                </div>
              ) : (
                <div>
                  <Upload className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                  <p className="text-sm text-gray-500">Click to select CSV file</p>
                </div>
              )}
            </div>

            {/* Result */}
            {result && (
              <div className={`mt-4 p-4 rounded-lg ${result.valid ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
                {result.valid ? (
                  <div className="flex items-start gap-2">
                    <CheckCircle className="h-5 w-5 text-green-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-green-800">Data submitted successfully</p>
                      <p className="text-xs text-green-600 mt-1">
                        {result.itemsImported} items imported. Your report is now queued for processing.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-red-800">Validation failed</p>
                      {result.errors?.map((err, i) => (
                        <p key={i} className="text-xs text-red-600 mt-1">{err}</p>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            <button
              onClick={handleUpload}
              disabled={!selectedJob || !file || uploading}
              className="mt-4 w-full bg-[#1B3A6B] text-white py-2.5 rounded-lg text-sm font-medium hover:bg-[#15305a] transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {uploading ? 'Uploading & Validating...' : 'Submit Data'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
