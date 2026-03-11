'use client';

import { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { usePortal } from './layout';
import { FileText, Upload, Download, Eye, ArrowRight, Lock, CheckCircle } from 'lucide-react';
import { useFeature } from '@/lib/features';
import type { SubscriptionTier } from '@/lib/features';

const NODE_API_URL = (process.env.NEXT_PUBLIC_NODE_API_URL || '').trim().replace(/\/+$/, '');

interface ReportJob {
  id: string;
  institutionName: string;
  status: string;
  completedAt?: string;
  createdAt: string;
}

function WelcomeBanner() {
  const searchParams = useSearchParams();
  const isWelcome = searchParams.get('welcome') === '1';

  // Mark this user as a portal/billing user so they skip retail onboarding
  if (isWelcome && typeof window !== 'undefined') {
    localStorage.setItem('cerniq_portal_user', 'true');
  }

  if (!isWelcome) return null;

  return (
    <div className="mb-6 bg-green-50 border border-green-200 rounded-xl p-4 flex items-start gap-3">
      <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
      <div>
        <p className="font-medium text-green-900">Payment confirmed — welcome to CERNIQ</p>
        <p className="text-sm text-green-700 mt-1">
          Your next step is to submit your balance sheet data to generate your ALM report.
        </p>
      </div>
    </div>
  );
}

export default function PortalHome() {
  const { user, subscription } = usePortal();
  const [jobs, setJobs] = useState<ReportJob[]>([]);
  const [loading, setLoading] = useState(true);

  const tier = (subscription?.tier || 'free') as SubscriptionTier;
  const trendFeature = useFeature(tier, 'trendCharts');

  useEffect(() => {
    async function loadJobs() {
      try {
        const res = await fetch(`${NODE_API_URL}/api/portal/jobs`, { credentials: 'include' });
        if (res.ok) setJobs(await res.json());
      } catch { /* silent */ }
      setLoading(false);
    }
    loadJobs();
  }, []);

  const latestJob = jobs[0];
  const completedJobs = jobs.filter(j => j.status === 'COMPLETE');

  return (
    <div className="max-w-4xl mx-auto p-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-1">
        Welcome back{user?.name ? `, ${user.name}` : ''}
      </h1>
      <p className="text-sm text-gray-500 mb-8 capitalize">
        {subscription?.tier || 'Free'} Plan
      </p>

      <Suspense fallback={null}>
        <WelcomeBanner />
      </Suspense>

      {/* State-aware banner */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-8">
        <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">Next Step</h2>

        {!latestJob && (
          <div>
            <p className="text-gray-700 mb-4">Get started by submitting your balance sheet data.</p>
            <div className="flex gap-3">
              <Link
                href="/portal/submit"
                className="inline-flex items-center gap-2 bg-[#1B3A6B] text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-[#15305a] transition"
              >
                <Upload className="h-4 w-4" /> Upload Your Data
              </Link>
            </div>
          </div>
        )}

        {latestJob?.status === 'AWAITING_DATA' && (
          <div>
            <p className="text-gray-700 mb-4">Submit your balance sheet to generate your report for <strong>{latestJob.institutionName}</strong>.</p>
            <div className="flex gap-3">
              <a
                href={`${NODE_API_URL}/api/alm/templates/cooperativa`}
                className="inline-flex items-center gap-2 border border-gray-300 text-gray-700 px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-gray-50 transition"
              >
                <Download className="h-4 w-4" /> Download CSV Template
              </a>
              <Link
                href="/portal/submit"
                className="inline-flex items-center gap-2 bg-[#1B3A6B] text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-[#15305a] transition"
              >
                <Upload className="h-4 w-4" /> Upload Your Data
              </Link>
            </div>
          </div>
        )}

        {latestJob && ['QUEUED', 'PROCESSING', 'GENERATING_PDF', 'UPLOADING', 'VALIDATING'].includes(latestJob.status) && (
          <div>
            <p className="text-gray-700 mb-4">Your report for <strong>{latestJob.institutionName}</strong> is being generated.</p>
            <div className="flex items-center gap-3 mb-2">
              <div className="flex-1 bg-gray-200 rounded-full h-2">
                <div
                  className="bg-[#1B3A6B] h-2 rounded-full transition-all animate-pulse"
                  style={{ width: latestJob.status === 'PROCESSING' ? '50%' : latestJob.status === 'GENERATING_PDF' ? '75%' : '90%' }}
                />
              </div>
              <span className="text-xs text-gray-500 capitalize">{latestJob.status.replace(/_/g, ' ').toLowerCase()}</span>
            </div>
            <p className="text-xs text-gray-400">Estimated delivery: 5 business days</p>
          </div>
        )}

        {latestJob?.status === 'COMPLETE' && (
          <div>
            <p className="text-gray-700 mb-4">Your ALM report for <strong>{latestJob.institutionName}</strong> is ready.</p>
            <div className="flex gap-3">
              <Link
                href={`/portal/reports/${latestJob.id}`}
                className="inline-flex items-center gap-2 bg-[#1B3A6B] text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-[#15305a] transition"
              >
                <Eye className="h-4 w-4" /> View Report
              </Link>
            </div>
          </div>
        )}

        {latestJob?.status === 'FAILED' && (
          <div>
            <p className="text-red-600 mb-4">There was an issue generating your report. Our team has been notified and will resolve this shortly.</p>
          </div>
        )}
      </div>

      {/* Trend Charts gate */}
      {!trendFeature.enabled && completedJobs.length > 0 && (
        <div className="relative bg-white rounded-xl border border-gray-200 p-6 mb-8 overflow-hidden">
          <div className="absolute inset-0 bg-white/80 backdrop-blur-sm flex items-center justify-center z-10">
            <div className="text-center p-6 max-w-xs">
              <Lock className="h-8 w-8 text-amber-500 mx-auto mb-3" />
              <p className="text-gray-900 text-sm font-medium mb-2">{trendFeature.upgradePrompt}</p>
              <Link href="/portal/billing" className="text-amber-600 text-xs hover:underline">
                Upgrade your plan <ArrowRight className="inline h-3 w-3" />
              </Link>
            </div>
          </div>
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">Quarterly Trends</h2>
          <div className="h-48 bg-gray-100 rounded-lg" />
        </div>
      )}

      {/* Report History */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Report History</h2>
        </div>
        {loading ? (
          <div className="p-6 text-center text-sm text-gray-400">Loading...</div>
        ) : completedJobs.length === 0 ? (
          <div className="p-6 text-center">
            <FileText className="h-10 w-10 text-gray-300 mx-auto mb-3" />
            <p className="text-sm text-gray-400">No reports yet. Submit your data to generate your first report.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {completedJobs.map(job => (
              <div key={job.id} className="px-6 py-4 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-900">{job.institutionName}</p>
                  <p className="text-xs text-gray-400">
                    Generated {job.completedAt ? new Date(job.completedAt).toLocaleDateString() : '---'}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Link
                    href={`/portal/reports/${job.id}`}
                    className="text-xs text-[#1B3A6B] hover:underline"
                  >
                    View
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
