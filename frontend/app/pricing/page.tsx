'use client';

import Link from 'next/link';
import { CheckCircle, ArrowLeft, Building2, Shield, Zap } from 'lucide-react';
import { useTranslation } from '@/lib/i18n';

export default function PricingPage() {
  const { t, ta } = useTranslation();
  const pilotFeatures = ta('pricing.pilotFeatures');
  const enterpriseFeatures = ta('pricing.enterpriseFeatures');

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
          <span className="text-sm font-semibold">CERNIQ</span>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-16">
        {/* Heading */}
        <div className="text-center mb-12">
          <h1 className="text-3xl font-bold mb-3">{t('pricing.title')}</h1>
          <p className="text-slate-400 text-sm max-w-md mx-auto">
            {t('pricing.subtitle')}
          </p>
        </div>

        {/* Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl mx-auto">
          {/* Pilot */}
          <div className="bg-slate-900/60 border-2 border-amber-500/30 rounded-2xl p-8 relative">
            <div className="absolute -top-3 left-6">
              <span className="bg-amber-500 text-slate-900 text-[10px] font-bold uppercase tracking-wider px-3 py-1 rounded-full">
                {t('pricing.recommended')}
              </span>
            </div>
            <div className="flex items-center gap-2 mb-4">
              <Zap className="h-5 w-5 text-amber-400" />
              <h2 className="text-xl font-bold">{t('pricing.pilot')}</h2>
            </div>
            <div className="flex items-baseline gap-1 mb-1">
              <span className="text-4xl font-bold">$500</span>
              <span className="text-slate-400 text-sm">{t('pricing.perMonth')}</span>
            </div>
            <p className="text-xs text-slate-500 mb-6">{t('pricing.paidPilot')}</p>

            <ul className="space-y-3 mb-8">
              {pilotFeatures.map((f) => (
                <li key={f} className="flex items-start gap-2.5 text-sm text-slate-300">
                  <CheckCircle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
                  {f}
                </li>
              ))}
            </ul>

            <a
              href="mailto:erwin@klytics.io?subject=CERNIQ%20Pilot%20—%20Getting%20Started&body=Hi%20Erwin%2C%0A%0AI'd%20like%20to%20start%20a%20CERNIQ%20pilot.%0A%0AInstitution%3A%20%0AAsset%20Size%3A%20%0A%0AThanks"
              className="block w-full text-center bg-amber-500 hover:bg-amber-400 text-slate-900 font-semibold py-3 rounded-lg transition text-sm"
            >
              {t('pricing.startPilot')}
            </a>
          </div>

          {/* Enterprise */}
          <div className="bg-slate-900/60 border border-white/[0.08] rounded-2xl p-8">
            <div className="flex items-center gap-2 mb-4">
              <Building2 className="h-5 w-5 text-blue-400" />
              <h2 className="text-xl font-bold">{t('pricing.enterprise')}</h2>
            </div>
            <div className="flex items-baseline gap-1 mb-1">
              <span className="text-4xl font-bold">{t('pricing.custom')}</span>
            </div>
            <p className="text-xs text-slate-500 mb-6">{t('pricing.enterpriseDesc')}</p>

            <ul className="space-y-3 mb-8">
              {enterpriseFeatures.map((f) => (
                <li key={f} className="flex items-start gap-2.5 text-sm text-slate-300">
                  <CheckCircle className="h-4 w-4 text-blue-400 shrink-0 mt-0.5" />
                  {f}
                </li>
              ))}
            </ul>

            <a
              href="mailto:erwin@klytics.io?subject=CERNIQ%20Enterprise%20Inquiry&body=Hi%20Erwin%2C%0A%0AWe're%20interested%20in%20the%20Enterprise%20plan.%0A%0AInstitution%3A%20%0AAsset%20Size%3A%20%0ANumber%20of%20entities%3A%20%0A%0AThanks"
              className="block w-full text-center bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-slate-300 font-semibold py-3 rounded-lg transition text-sm"
            >
              {t('pricing.contactErwin')}
            </a>
          </div>
        </div>

        {/* Trust elements */}
        <div className="text-center mt-12">
          <div className="flex items-center justify-center gap-4 text-[11px] text-slate-600">
            <span className="flex items-center gap-1"><Shield className="h-3 w-3" /> {t('pricing.baselCompliant')}</span>
            <span>·</span>
            <span>{t('pricing.builtInPR')}</span>
            <span>·</span>
            <span>{t('pricing.ocifAware')}</span>
            <span>·</span>
            <span className="text-amber-500/60 font-medium">KLYTICS</span>
          </div>
        </div>
      </div>
    </div>
  );
}
