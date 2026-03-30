'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { FileText, Download, ArrowLeft, Clock, AlertTriangle, Globe } from 'lucide-react';
import { analytics, EVENTS } from '@/lib/analytics';
import { getPublicApiUrl } from '@/lib/api-base';
import { unwrapApiData } from '@/lib/api-response';

interface JobDetail {
  id: string;
  institutionName: string;
  status: string;
  reportUrl: string | null;
  reportUrlEn: string | null;
  reportLang: string;
  completedAt: string | null;
  createdAt: string;
  errorMessage: string | null;
}

export default function ReportViewer() {
  const params = useParams();
  const [job, setJob] = useState<JobDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [pdfLang, setPdfLang] = useState<'es' | 'en'>('es');

  useEffect(() => {
    async function loadJob() {
      try {
        const res = await fetch(getPublicApiUrl(`/api/portal/jobs/${params.id}`), { credentials: 'include' });
        if (res.ok) {
          const data = unwrapApiData<JobDetail | null>(await res.json().catch(() => null));
          if (!data) {
            return;
          }
          setJob(data);
          if (data.reportLang === 'en') setPdfLang('en');
          analytics.track(EVENTS.PORTAL_REPORT_VIEWED, { jobId: data.id, status: data.status });
        }
      } catch { /* silent */ }
      setLoading(false);
    }
    loadJob();
  }, [params.id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px]">
        <div className="w-8 h-8 border-2 border-[#1B3A6B] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!job) {
    return (
      <div className="max-w-2xl mx-auto p-8 text-center">
        <AlertTriangle className="h-10 w-10 text-gray-300 mx-auto mb-3" />
        <p className="text-gray-500 mb-4">Report not found.</p>
        <Link href="/portal" className="text-sm text-[#1B3A6B] hover:underline">Back to dashboard</Link>
      </div>
    );
  }

  const currentUrl = pdfLang === 'en' ? job.reportUrlEn : job.reportUrl;
  const isProcessing = ['QUEUED', 'PROCESSING', 'GENERATING_PDF', 'UPLOADING', 'VALIDATING'].includes(job.status);

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <Link href="/portal" className="text-gray-400 hover:text-gray-600">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-sm font-semibold text-gray-900">{job.institutionName}</h1>
            <p className="text-xs text-gray-400">
              {job.completedAt ? `Generated ${new Date(job.completedAt).toLocaleDateString()}` : `Status: ${job.status.replace(/_/g, ' ')}`}
            </p>
          </div>
        </div>

        {job.status === 'COMPLETE' && (
          <div className="flex items-center gap-2">
            {/* Language toggle */}
            {job.reportUrlEn && job.reportUrl && (
              <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
                <button
                  onClick={() => setPdfLang('es')}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium transition ${pdfLang === 'es' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'}`}
                >
                  <Globe className="h-3 w-3" /> ES
                </button>
                <button
                  onClick={() => setPdfLang('en')}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium transition ${pdfLang === 'en' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'}`}
                >
                  <Globe className="h-3 w-3" /> EN
                </button>
              </div>
            )}
            {currentUrl && (
              <a
                href={currentUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 bg-[#1B3A6B] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#15305a] transition"
              >
                <Download className="h-4 w-4" /> Download PDF
              </a>
            )}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {job.status === 'COMPLETE' && currentUrl ? (
          <iframe
            src={currentUrl}
            className="w-full h-full min-h-[800px]"
            title={`ALM Report — ${job.institutionName}`}
          />
        ) : isProcessing ? (
          <div className="flex items-center justify-center h-full min-h-[400px]">
            <div className="text-center max-w-sm">
              <Clock className="h-12 w-12 text-[#1B3A6B]/30 mx-auto mb-4 animate-pulse" />
              <h2 className="text-lg font-semibold text-gray-900 mb-2">Report in Progress</h2>
              <p className="text-sm text-gray-500 mb-2">
                Your report for <strong>{job.institutionName}</strong> is being generated.
              </p>
              <p className="text-xs text-gray-400">
                Status: {job.status.replace(/_/g, ' ')} — Estimated delivery: 5 business days
              </p>
            </div>
          </div>
        ) : job.status === 'FAILED' ? (
          <div className="flex items-center justify-center h-full min-h-[400px]">
            <div className="text-center max-w-sm">
              <AlertTriangle className="h-12 w-12 text-red-300 mx-auto mb-4" />
              <h2 className="text-lg font-semibold text-gray-900 mb-2">Generation Failed</h2>
              <p className="text-sm text-gray-500 mb-2">
                There was an issue generating this report. Our team has been notified.
              </p>
              {job.errorMessage && (
                <p className="text-xs text-red-500 bg-red-50 p-3 rounded-lg">{job.errorMessage}</p>
              )}
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center h-full min-h-[400px]">
            <div className="text-center max-w-sm">
              <FileText className="h-12 w-12 text-gray-200 mx-auto mb-4" />
              <h2 className="text-lg font-semibold text-gray-900 mb-2">Awaiting Data</h2>
              <p className="text-sm text-gray-500 mb-4">
                Submit your balance sheet data to start generating this report.
              </p>
              <Link
                href="/portal/submit"
                className="inline-flex items-center gap-2 bg-[#1B3A6B] text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-[#15305a] transition"
              >
                Submit Data
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
