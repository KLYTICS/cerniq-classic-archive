'use client';

import Link from 'next/link';
import { Lock, ArrowRight } from 'lucide-react';
import { useFeature } from '@/lib/features';
import type { SubscriptionTier, FeatureKey } from '@/lib/features';
import { analytics, EVENTS } from '@/lib/analytics';

interface FeatureGateProps {
  tier: SubscriptionTier | undefined;
  feature: FeatureKey;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export function FeatureGate({ tier, feature, children, fallback }: FeatureGateProps) {
  const { enabled, upgradePrompt } = useFeature(tier, feature);

  if (enabled) return <>{children}</>;

  if (fallback) return <>{fallback}</>;

  return (
    <div className="relative overflow-hidden rounded-xl border border-gray-200">
      <div className="absolute inset-0 bg-white/80 backdrop-blur-sm flex items-center justify-center z-10">
        <div className="text-center p-6 max-w-xs">
          <Lock className="h-8 w-8 text-amber-500 mx-auto mb-3" />
          <p className="text-gray-900 text-sm font-medium mb-2">{upgradePrompt}</p>
          <Link
            href="/pricing"
            onClick={() => analytics.track(EVENTS.UPGRADE_PROMPT_CLICKED, { feature, tier })}
            className="text-amber-600 text-xs hover:underline"
          >
            Upgrade your plan <ArrowRight className="inline h-3 w-3" />
          </Link>
        </div>
      </div>
      <div className="opacity-30 pointer-events-none">{children}</div>
    </div>
  );
}

export default FeatureGate;
