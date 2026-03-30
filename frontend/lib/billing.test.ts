import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createCheckoutSession, getCurrentSubscription } from './billing';

describe('billing API routing', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('starts checkout through the same-origin billing endpoint', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ checkoutUrl: 'https://checkout.stripe.test/session' }),
    });

    const checkoutUrl = await createCheckoutSession({ tier: 'monthly' });

    expect(checkoutUrl).toBe('https://checkout.stripe.test/session');
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/billing/checkout',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      }),
    );
  });

  it('supports checkout URLs nested under the backend data payload', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          checkoutUrl: 'https://checkout.stripe.test/nested-session',
        },
      }),
    });

    const checkoutUrl = await createCheckoutSession({ tier: 'one_time' });

    expect(checkoutUrl).toBe('https://checkout.stripe.test/nested-session');
  });

  it('accepts checkout URLs from alternate top-level and nested payload fields', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ url: 'https://checkout.stripe.test/top-level-url' }),
    });

    await expect(createCheckoutSession({ tier: 'monthly' })).resolves.toBe(
      'https://checkout.stripe.test/top-level-url',
    );

    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: {
          url: 'https://checkout.stripe.test/nested-url',
        },
      }),
    });

    await expect(createCheckoutSession({ tier: 'annual' })).resolves.toBe(
      'https://checkout.stripe.test/nested-url',
    );
  });

  it('surfaces a backend message when checkout cannot be created', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      json: async () => ({
        message: 'Desk checkout is temporarily unavailable.',
      }),
    });

    await expect(createCheckoutSession({ tier: 'annual' })).rejects.toThrow(
      'Desk checkout is temporarily unavailable.',
    );
  });

  it('surfaces nested backend messages and JSON parse fallbacks for checkout failures', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      json: async () => ({
        data: {
          message: 'Nested checkout failure.',
        },
      }),
    });

    await expect(createCheckoutSession({ tier: 'annual' })).rejects.toThrow('Nested checkout failure.');

    fetchMock.mockResolvedValueOnce({
      ok: false,
      json: async () => {
        throw new Error('bad json');
      },
    });

    await expect(createCheckoutSession({ tier: 'partner' })).rejects.toThrow('Unable to start checkout.');
  });

  it('uses a fallback checkout error when the payload is malformed', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({}),
    });

    await expect(createCheckoutSession({ tier: 'partner' })).rejects.toThrow(
      'Unable to start checkout.',
    );
  });

  it('loads subscriptions through the same-origin billing endpoint', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ tier: 'annual', status: 'active' }),
    });

    await getCurrentSubscription();

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/billing/subscription',
      expect.objectContaining({
        credentials: 'include',
      }),
    );
  });

  it('surfaces subscription fetch failures with a useful message', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      json: async () => ({ message: 'Subscription service unavailable.' }),
    });

    await expect(getCurrentSubscription()).rejects.toThrow('Subscription service unavailable.');
  });

  it('uses the subscription fallback error when the payload has no message', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      json: async () => ({}),
    });

    await expect(getCurrentSubscription()).rejects.toThrow('Unable to load subscription.');
  });

  it('handles malformed subscription JSON payloads with the fallback error', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      json: async () => {
        throw new Error('bad json');
      },
    });

    await expect(getCurrentSubscription()).rejects.toThrow('Unable to load subscription.');
  });
});
