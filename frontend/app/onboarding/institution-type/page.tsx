'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api';
import { analytics, EVENTS } from '@/lib/analytics';
import { Landmark, Users, Briefcase, RefreshCw, ArrowRight } from 'lucide-react';

type InstitutionType = 'bank' | 'credit_union' | 'family_office';

interface TypeOption {
  type: InstitutionType;
  icon: React.ElementType;
  title: string;
  description: string;
  size: string;
  color: string;
  borderColor: string;
}

const options: TypeOption[] = [
  {
    type: 'bank',
    icon: Landmark,
    title: 'Community Bank',
    description: 'Full ALM suite with duration gap, NII sensitivity, LCR/NSFR, and regulatory stress testing.',
    size: '$500M–$5B assets',
    color: 'from-amber-500/20 to-orange-500/10',
    borderColor: 'border-amber-500/30 hover:border-amber-400',
  },
  {
    type: 'credit_union',
    icon: Users,
    title: 'Credit Union',
    description: 'Member-focused ALM with deposit repricing, loan concentration analysis, and NCUA compliance.',
    size: '$50M–$500M assets',
    color: 'from-emerald-500/20 to-teal-500/10',
    borderColor: 'border-emerald-500/30 hover:border-emerald-400',
  },
  {
    type: 'family_office',
    icon: Briefcase,
    title: 'Family Office',
    description: 'Portfolio-level risk with equity exposure, real estate duration, and liquidity monitoring.',
    size: '$10M–$500M AUM',
    color: 'from-purple-500/20 to-indigo-500/10',
    borderColor: 'border-purple-500/30 hover:border-purple-400',
  },
];

export default function InstitutionTypePage() {
  const router = useRouter();
  const [selected, setSelected] = useState<InstitutionType | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSelect = async (type: InstitutionType) => {
    setSelected(type);
    analytics.track(EVENTS.INSTITUTION_TYPE_SELECTED, { type });
  };

  const handleContinue = async () => {
    if (!selected) return;
    setLoading(true);
    setError(null);
    try {
      // Use a default workspace ID — in production, get from user context
      const user = await apiClient.getCurrentUser();
      const workspaceId = user?.workspaceId || 'default';
      const result = await apiClient.seedDemoInstitution(workspaceId, selected);
      analytics.track(EVENTS.DEMO_DATA_SEEDED, {
        type: selected,
        institutionId: result.institutionId,
      });
      router.push('/alm');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to set up demo';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleSkip = () => {
    analytics.track(EVENTS.ONBOARDING_SKIPPED, { step: 'institution-type' });
    router.push('/alm');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-amber-950/20 flex items-center justify-center p-6">
      <div className="max-w-3xl w-full">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">What type of institution?</h1>
          <p className="text-slate-400 max-w-md mx-auto">
            We&apos;ll set up a demo with realistic data so you can see ALM Intelligence in action immediately.
          </p>
        </div>

        {/* Type Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          {options.map((opt) => (
            <button
              key={opt.type}
              onClick={() => handleSelect(opt.type)}
              className={`text-left rounded-xl border-2 p-6 transition bg-gradient-to-br ${opt.color} ${opt.borderColor} ${
                selected === opt.type ? 'ring-2 ring-amber-400 border-amber-400' : ''
              }`}
            >
              <opt.icon className="h-8 w-8 text-white mb-3" />
              <h3 className="text-lg font-bold text-white mb-1">{opt.title}</h3>
              <p className="text-sm text-slate-300 mb-3">{opt.description}</p>
              <span className="inline-block text-xs bg-white/10 text-slate-300 px-2 py-1 rounded-full">
                {opt.size}
              </span>
            </button>
          ))}
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3 text-red-300 text-sm mb-4">
            {error}
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-between">
          <button
            onClick={handleSkip}
            className="text-slate-400 hover:text-white text-sm transition"
          >
            Skip — I&apos;ll add data manually
          </button>
          <button
            onClick={handleContinue}
            disabled={!selected || loading}
            className="flex items-center gap-2 px-6 py-3 bg-amber-500 hover:bg-amber-400 text-slate-900 font-semibold rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin" />
                Setting up...
              </>
            ) : (
              <>
                Load Demo Data
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
