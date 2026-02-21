'use client';

import { Suspense, useEffect, useState } from 'react';
import { apiClient } from '@/lib/api';
import { useRouter, useSearchParams } from 'next/navigation';

function DemoContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState('Checking authentication...');
  const [error, setError] = useState<string | null>(null);

  const type = searchParams.get('type') || 'bank';
  const institutionLabels: Record<string, { name: string; assets: string }> = {
    bank: { name: 'Banco Comunidad PR', assets: '$1.2B' },
    credit_union: { name: 'Cooperativa del Pueblo', assets: '$180M' },
    family_office: { name: 'Caribbean Family Capital', assets: '$45M' },
  };
  const label = institutionLabels[type] || institutionLabels.bank;

  useEffect(() => {
    let cancelled = false;

    async function setup() {
      // 1. Check if logged in
      try {
        setStatus('Checking authentication...');
        await apiClient.getCurrentUser();
      } catch {
        // Not logged in — redirect to signup with return URL
        const returnUrl = `/demo?type=${type}`;
        router.push(`/login?mode=signup&returnUrl=${encodeURIComponent(returnUrl)}`);
        return;
      }

      if (cancelled) return;

      // 2. Get or create workspace, then seed demo institution
      try {
        setStatus('Setting up your demo environment...');

        // Get existing institutions — if any exist, skip seeding and go to ALM
        let institutions: any[] = [];
        try {
          institutions = await apiClient.getInstitutions();
        } catch {
          // No institutions yet
        }

        if (cancelled) return;

        if (institutions.length > 0) {
          // Already seeded — redirect to ALM
          setStatus('Redirecting to ALM dashboard...');
          setTimeout(() => router.push(`/alm?id=${institutions[0].id}`), 800);
          return;
        }

        // Need a workspace — get existing or create one
        let workspaceId: string;
        try {
          const workspaces = await apiClient.getMyWorkspaces();
          if (Array.isArray(workspaces) && workspaces.length > 0) {
            workspaceId = workspaces[0].id;
          } else {
            const created = await apiClient.createMyWorkspace('Demo Workspace');
            workspaceId = created.id;
          }
        } catch {
          // Fallback: create a workspace
          const created = await apiClient.createMyWorkspace('Demo Workspace');
          workspaceId = created.id;
        }

        if (cancelled) return;

        const result = await apiClient.seedDemoInstitution(workspaceId, type as 'bank' | 'credit_union' | 'family_office');
        if (cancelled) return;

        setStatus('Redirecting to ALM dashboard...');
        const institutionId = result?.institutionId || result?.institution?.id || result?.id;
        setTimeout(() => {
          router.push(institutionId ? `/alm?id=${institutionId}` : '/alm');
        }, 1000);
      } catch (err: any) {
        if (cancelled) return;
        setError(err?.response?.data?.message || 'Failed to set up demo. Please try again.');
      }
    }

    setup();
    return () => { cancelled = true; };
  }, [type, router]);

  if (error) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-center px-6">
        <div className="w-12 h-12 bg-red-500/20 rounded-xl flex items-center justify-center mb-6">
          <span className="text-red-400 font-bold text-xl">!</span>
        </div>
        <h2 className="text-white text-xl font-bold mb-2">Setup Failed</h2>
        <p className="text-slate-400 text-sm mb-6">{error}</p>
        <button
          onClick={() => window.location.reload()}
          className="bg-amber-500 hover:bg-amber-400 text-slate-900 font-semibold px-6 py-2 rounded-lg transition"
        >
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center">
      <div className="w-12 h-12 bg-gradient-to-br from-amber-400 to-orange-500 rounded-xl flex items-center justify-center mb-6">
        <span className="text-slate-900 font-bold text-xl">C</span>
      </div>
      <h2 className="text-white text-xl font-bold mb-2">Setting Up Your Demo</h2>
      <p className="text-slate-400 text-sm mb-8">
        Loading {label.name} — {label.assets} institution
      </p>
      <div className="flex gap-1 mb-6">
        {[...Array(3)].map((_, i) => (
          <div
            key={i}
            className="w-2 h-2 bg-amber-400 rounded-full animate-bounce"
            style={{ animationDelay: `${i * 0.15}s` }}
          />
        ))}
      </div>
      <p className="text-slate-500 text-xs">{status}</p>
    </div>
  );
}

export default function DemoPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-950 flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-amber-500" />
        </div>
      }
    >
      <DemoContent />
    </Suspense>
  );
}
