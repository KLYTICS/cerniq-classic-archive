'use client';

import Link from 'next/link';
import { CheckCircle, ArrowLeft, Building2, Shield, Zap } from 'lucide-react';

const PILOT_FEATURES = [
  'Full ALM Intelligence suite',
  'Duration gap + NII sensitivity + Monte Carlo',
  'Basel III LCR/NSFR compliance monitoring',
  'Unlimited PDF board reports',
  'Setup + onboarding call',
  'Email support',
  'Cancel anytime after 60 days',
];

const ENTERPRISE_FEATURES = [
  'Everything in Pilot',
  'Multi-entity portfolio view',
  'Dedicated implementation manager',
  'OCIF examination support',
  'Custom scenario modeling',
  'Priority support + SLA',
  'Custom integrations',
];

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* Header */}
      <div className="border-b border-white/[0.06] bg-slate-900/70">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center gap-3">
          <Link href="/alm" className="text-slate-500 hover:text-white transition">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div className="w-8 h-8 bg-gradient-to-br from-amber-400 to-orange-500 rounded-lg flex items-center justify-center">
            <span className="text-slate-900 font-bold text-sm">C</span>
          </div>
          <span className="text-sm font-semibold">CapexCycleOS</span>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-16">
        {/* Heading */}
        <div className="text-center mb-12">
          <h1 className="text-3xl font-bold mb-3">Simple, transparent pricing</h1>
          <p className="text-slate-400 text-sm max-w-md mx-auto">
            Start with a 60-day paid pilot. No long-term contracts. See real results before you commit.
          </p>
        </div>

        {/* Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl mx-auto">
          {/* Pilot */}
          <div className="bg-slate-900/60 border-2 border-amber-500/30 rounded-2xl p-8 relative">
            <div className="absolute -top-3 left-6">
              <span className="bg-amber-500 text-slate-900 text-[10px] font-bold uppercase tracking-wider px-3 py-1 rounded-full">
                Recommended
              </span>
            </div>
            <div className="flex items-center gap-2 mb-4">
              <Zap className="h-5 w-5 text-amber-400" />
              <h2 className="text-xl font-bold">Pilot</h2>
            </div>
            <div className="flex items-baseline gap-1 mb-1">
              <span className="text-4xl font-bold">$500</span>
              <span className="text-slate-400 text-sm">/month</span>
            </div>
            <p className="text-xs text-slate-500 mb-6">60-Day Paid Pilot</p>

            <ul className="space-y-3 mb-8">
              {PILOT_FEATURES.map((f) => (
                <li key={f} className="flex items-start gap-2.5 text-sm text-slate-300">
                  <CheckCircle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
                  {f}
                </li>
              ))}
            </ul>

            <a
              href="mailto:erwin@klytics.io?subject=CapexCycleOS%20Pilot%20—%20Getting%20Started&body=Hi%20Erwin%2C%0A%0AI'd%20like%20to%20start%20a%20CapexCycleOS%20pilot.%0A%0AInstitution%3A%20%0AAsset%20Size%3A%20%0A%0AThanks"
              className="block w-full text-center bg-amber-500 hover:bg-amber-400 text-slate-900 font-semibold py-3 rounded-lg transition text-sm"
            >
              Start Pilot — $500/month
            </a>
          </div>

          {/* Enterprise */}
          <div className="bg-slate-900/60 border border-white/[0.08] rounded-2xl p-8">
            <div className="flex items-center gap-2 mb-4">
              <Building2 className="h-5 w-5 text-blue-400" />
              <h2 className="text-xl font-bold">Enterprise</h2>
            </div>
            <div className="flex items-baseline gap-1 mb-1">
              <span className="text-4xl font-bold">Custom</span>
            </div>
            <p className="text-xs text-slate-500 mb-6">For institutions with $2B+ assets or multiple entities</p>

            <ul className="space-y-3 mb-8">
              {ENTERPRISE_FEATURES.map((f) => (
                <li key={f} className="flex items-start gap-2.5 text-sm text-slate-300">
                  <CheckCircle className="h-4 w-4 text-blue-400 shrink-0 mt-0.5" />
                  {f}
                </li>
              ))}
            </ul>

            <a
              href="mailto:erwin@klytics.io?subject=CapexCycleOS%20Enterprise%20Inquiry&body=Hi%20Erwin%2C%0A%0AWe're%20interested%20in%20the%20Enterprise%20plan.%0A%0AInstitution%3A%20%0AAsset%20Size%3A%20%0ANumber%20of%20entities%3A%20%0A%0AThanks"
              className="block w-full text-center bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-slate-300 font-semibold py-3 rounded-lg transition text-sm"
            >
              Contact Erwin
            </a>
          </div>
        </div>

        {/* Trust elements */}
        <div className="text-center mt-12">
          <div className="flex items-center justify-center gap-4 text-[11px] text-slate-600">
            <span className="flex items-center gap-1"><Shield className="h-3 w-3" /> Basel III Compliant</span>
            <span>·</span>
            <span>Built in San Juan, PR</span>
            <span>·</span>
            <span>OCIF-Aware</span>
            <span>·</span>
            <span className="text-amber-500/60 font-medium">KLYTICS</span>
          </div>
        </div>
      </div>
    </div>
  );
}
