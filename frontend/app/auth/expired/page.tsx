'use client';

import Link from 'next/link';
import { Clock, ArrowRight } from 'lucide-react';
import { analytics, EVENTS } from '@/lib/analytics';

export default function MagicLinkExpired() {
  if (typeof window !== 'undefined') analytics.track(EVENTS.MAGIC_LINK_EXPIRED);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm text-center">
        <div className="w-12 h-12 bg-[#1B3A6B] rounded-xl flex items-center justify-center mx-auto mb-6">
          <span className="text-white font-bold text-lg">C</span>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <Clock className="h-10 w-10 text-amber-500 mx-auto mb-3" />
          <h1 className="text-lg font-semibold text-gray-900 mb-2">Link Expired</h1>
          <p className="text-sm text-gray-500 mb-6">
            This login link has expired or has already been used. Login links are valid for 24 hours and can only be used once.
          </p>
          <Link
            href="/portal/login"
            className="inline-flex items-center gap-2 bg-[#1B3A6B] text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-[#15305a] transition"
          >
            Request New Link <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}
