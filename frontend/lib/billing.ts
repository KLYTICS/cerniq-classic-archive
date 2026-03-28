import type { PortalSubscription } from './subscription';
import { getPublicApiUrl } from './api-base';

export type CheckoutTier = 'one_time' | 'monthly' | 'annual' | 'partner';

interface CreateCheckoutSessionParams {
  tier: CheckoutTier;
  customerEmail?: string;
  customerName?: string;
  institutionName?: string;
  leadId?: string;
  successUrl?: string;
  cancelUrl?: string;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' ? (value as Record<string, unknown>) : null;
}

export async function createCheckoutSession({
  tier,
  customerEmail,
  customerName,
  institutionName,
  leadId,
  successUrl = '/portal?welcome=1',
  cancelUrl = '/pricing',
}: CreateCheckoutSessionParams) {
  const response = await fetch(getPublicApiUrl('/api/billing/checkout'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      tier,
      customerEmail,
      customerName,
      institutionName,
      leadId,
      successUrl,
      cancelUrl,
    }),
  });

  const data = await response.json().catch(() => ({}));
  const payload = asRecord(data);
  const nestedData = asRecord(payload?.data);
  const checkoutUrl =
    typeof payload?.checkoutUrl === 'string'
      ? payload.checkoutUrl
      : typeof payload?.url === 'string'
        ? payload.url
        : typeof nestedData?.checkoutUrl === 'string'
          ? nestedData.checkoutUrl
          : typeof nestedData?.url === 'string'
            ? nestedData.url
        : '';

  if (!response.ok || !checkoutUrl) {
    throw new Error(
      typeof payload?.message === 'string'
        ? payload.message
        : typeof nestedData?.message === 'string'
          ? nestedData.message
        : 'Unable to start checkout.',
    );
  }

  return checkoutUrl;
}

export async function getCurrentSubscription(): Promise<PortalSubscription> {
  const response = await fetch(getPublicApiUrl('/api/billing/subscription'), {
    credentials: 'include',
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(
      typeof data.message === 'string'
        ? data.message
        : 'Unable to load subscription.',
    );
  }

  return data as PortalSubscription;
}
