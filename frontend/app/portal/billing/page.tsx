'use client';

import { useState } from 'react';
import { usePortal } from '../layout';
import { CreditCard, ExternalLink, CheckCircle, Shield } from 'lucide-react';
import { analytics, EVENTS } from '@/lib/analytics';

const NODE_API_URL = (process.env.NEXT_PUBLIC_NODE_API_URL || '').trim().replace(/\/+$/, '');

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
      const res = await fetch(`${NODE_API_URL}/api/billing/portal`, {
        method: 'POST',
        credentials: 'include',
      });
      if (res.ok) {
        const { portalUrl } = await res.json();
        window.location.href = portalUrl;
      }
    } catch { /* silent */ }
    setLoadingPortal(false);
  };

  return (
    <div className="max-w-2xl mx-auto p-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Billing</h1>
      <p className="text-sm text-gray-500 mb-8">Manage your subscription and payment method.</p>

      {/* Current Plan */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Current Plan</h2>
          <span className={`text-xs font-medium px-2 py-1 rounded-full ${
            subscription?.status === 'active' ? 'bg-green-100 text-green-700' :
            subscription?.status === 'past_due' ? 'bg-amber-100 text-amber-700' :
            'bg-gray-100 text-gray-600'
          }`}>
            {subscription?.status || 'active'}
          </span>
        </div>

        <div className="flex items-center gap-4 mb-4">
          <div className="w-12 h-12 bg-[#1B3A6B]/10 rounded-xl flex items-center justify-center">
            <CreditCard className="h-6 w-6 text-[#1B3A6B]" />
          </div>
          <div>
            <p className="text-lg font-bold text-gray-900">{details.name}</p>
            <p className="text-sm text-gray-500">{details.price}</p>
          </div>
        </div>

        <ul className="space-y-2 mb-4">
          {details.features.map((f, i) => (
            <li key={i} className="flex items-center gap-2 text-sm text-gray-600">
              <CheckCircle className="h-4 w-4 text-green-500 shrink-0" />
              {f}
            </li>
          ))}
        </ul>

        {subscription?.currentPeriodEnd && (
          <p className="text-xs text-gray-400">
            Current period ends: {new Date(subscription.currentPeriodEnd).toLocaleDateString()}
          </p>
        )}
      </div>

      {/* Manage Subscription (Stripe Portal) */}
      {tier !== 'free' && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">Manage Subscription</h2>
          <p className="text-sm text-gray-500 mb-4">
            Update your payment method, view invoices, or change your plan through our secure billing portal.
          </p>
          <button
            onClick={openBillingPortal}
            disabled={loadingPortal}
            className="inline-flex items-center gap-2 bg-[#1B3A6B] text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-[#15305a] transition disabled:opacity-50"
          >
            <ExternalLink className="h-4 w-4" />
            {loadingPortal ? 'Opening...' : 'Open Billing Portal'}
          </button>
        </div>
      )}

      {/* Security Note */}
      <div className="flex items-start gap-3 text-xs text-gray-400">
        <Shield className="h-4 w-4 shrink-0 mt-0.5" />
        <p>Payments are processed securely by Stripe. We never store your card details.</p>
      </div>
    </div>
  );
}
