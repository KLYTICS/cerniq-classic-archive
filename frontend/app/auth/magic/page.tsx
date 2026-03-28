'use client';

import { Suspense, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { analytics, EVENTS } from '@/lib/analytics';

function MagicLinkInner() {
  const searchParams = useSearchParams();

  useEffect(() => {
    const token = searchParams.get('token');
    if (token) {
      analytics.track(EVENTS.MAGIC_LINK_CLICKED);
      window.location.href = `/auth/magic?token=${encodeURIComponent(token)}`;
    } else {
      window.location.href = '/auth/expired';
    }
  }, [searchParams]);

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="w-8 h-8 border-2 border-[#1B3A6B] border-t-transparent rounded-full animate-spin" />
      <span className="text-sm text-gray-500">Verifying your login link...</span>
    </div>
  );
}

export default function MagicLinkHandler() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <Suspense fallback={
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-[#1B3A6B] border-t-transparent rounded-full animate-spin" />
          <span className="text-sm text-gray-500">Loading...</span>
        </div>
      }>
        <MagicLinkInner />
      </Suspense>
    </div>
  );
}
