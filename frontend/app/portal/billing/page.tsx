'use client';

import { useState } from 'react';
import { usePortal } from '../layout';
import { CreditCard, ExternalLink, CheckCircle, Shield } from 'lucide-react';
import { analytics, EVENTS } from '@/lib/analytics';
import { getPublicApiUrl } from '@/lib/api-base';
import { unwrapApiData } from '@/lib/api-response';

const TIER_DETAILS: Record<string, { name: string; price: string; features: string[] }> = {
  free: {
    name: 'Free',
    price: '$0',
    features: ['Demo access', 'Public data preview'],
  },
  one_time: {
    name: 'Single Report',
    price: '$499',
    features: ['One ALM report (ES + EN)', 'Board-ready PDF', 'Share link'],
  },
  monthly: {
    name: 'Monthly Monitoring',
    price: '$299/mo',
    features: ['Unlimited reports', 'Quarterly trend charts', 'Email alerts', 'Share links'],
  },
  annual: {
    name: 'Annual Package',
    price: '$2,400/yr',
    features: ['Everything in Monthly', 'Board presentation template', '2 months free'],
  },
  partner: {
    name: 'Partner / Multi-Client',
    price: '$499/mo',
    features: ['Everything in Annual', 'Multi-client management', 'API access', 'White-label branding'],
  },
};

export default function PortalBilling() {
  const { subscription } = usePortal();
  const [loadingPortal, setLoadingPortal] = useState(false);

  const tier = subscription?.tier || 'free';
  const details = TIER_DETAILS[tier] || TIER_DETAILS.free;

  const openBillingPortal = async () => {
    setLoadingPortal(true);
    try {
      analytics.track(EVENTS.PORTAL_BILLING_OPENED, { tier });
      const res = await fetch(getPublicApiUrl('/api/billing/portal'), {
        method: 'POST',
        credentials: 'include',
      });
      if (res.ok) {
        const { portalUrl } = unwrapApiData<{ portalUrl?: string }>(
          await res.json().catch(() => ({})),
        );
        if (!portalUrl) {
          throw new Error('Billing portal URL missing');
        }
        window.location.href = portalUrl;
      }
    } catch { /* silent */ }
    setLoadingPortal(false);
  };

  return (
    <div className="space-y-6">
      <section className="cerniq-shell p-6 sm:p-8">
        <div className="cerniq-data-wave" />
        <div className="relative z-10">
          <span className="cerniq-kicker mb-5">Billing</span>
          <h1 className="font-display text-3xl text-slate-950 sm:text-5xl">Manage your CERNIQ subscription.</h1>
          <p className="mt-4 text-sm leading-7 text-slate-600 sm:text-base">Review the current plan, payment state, and secure billing actions without leaving the portal.</p>
        </div>
      </section>

      {/* Current Plan */}
      <div className="cerniq-panel p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">Current Plan</h2>
          <span className={`text-xs font-medium px-2 py-1 rounded-full ${
            subscription?.status === 'active' ? 'bg-emerald-100 text-emerald-700' :
            subscription?.status === 'past_due' ? 'bg-amber-100 text-amber-700' :
            'bg-slate-100 text-slate-600'
          }`}>
            {subscription?.status || 'active'}
          </span>
        </div>

        <div className="flex items-center gap-4 mb-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-cyan-50">
            <CreditCard className="h-6 w-6 text-cyan-700" />
          </div>
          <div>
            <p className="text-lg font-bold text-slate-900">{details.name}</p>
            <p className="text-sm text-slate-500">{details.price}</p>
          </div>
        </div>

        <ul className="space-y-2 mb-4">
          {details.features.map((f, i) => (
            <li key={i} className="flex items-center gap-2 text-sm text-slate-600">
              <CheckCircle className="h-4 w-4 shrink-0 text-emerald-500" />
              {f}
            </li>
          ))}
        </ul>

        {subscription?.currentPeriodEnd && (
          <p className="text-xs text-slate-400">
            Current period ends: {new Date(subscription.currentPeriodEnd).toLocaleDateString()}
          </p>
        )}
      </div>

      {/* Manage Subscription (Stripe Portal) */}
      {tier !== 'free' && (
        <div className="cerniq-panel p-6">
          <h2 className="mb-4 text-xs font-semibold uppercase tracking-wider text-slate-500">Manage Subscription</h2>
          <p className="mb-4 text-sm text-slate-500">
            Update your payment method, view invoices, or change your plan through our secure billing portal.
          </p>
          <button
            onClick={openBillingPortal}
            disabled={loadingPortal}
            className="cerniq-button-primary px-4 py-2.5 text-sm disabled:opacity-50"
          >
            <ExternalLink className="h-4 w-4" />
            {loadingPortal ? 'Opening...' : 'Open Billing Portal'}
          </button>
        </div>
      )}

      {/* Security Note */}
      <div className="flex items-start gap-3 text-xs text-slate-500">
        <Shield className="h-4 w-4 shrink-0 mt-0.5" />
        <p>Payments are processed securely by Stripe. We never store your card details.</p>
      </div>
    </div>
  );
}
