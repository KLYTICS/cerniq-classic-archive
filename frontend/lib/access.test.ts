import { describe, expect, it } from 'vitest';
import {
  ACCESS_REQUIRED_ROUTE,
  hasFreeBuilderAccess,
  requiresPaidAccessPath,
  resolveAuthenticatedDestination,
} from './access';

describe('access helpers', () => {
  it('treats free subscription-required users as builder-access users', () => {
    expect(
      hasFreeBuilderAccess({
        platformAccessAllowed: false,
        isMasterCeo: false,
        isPaid: false,
        isDemo: false,
        effectiveTier: 'free',
        effectiveStatus: null,
        effectivePeriodEnd: null,
        daysRemaining: null,
        reason: 'subscription_required',
      }),
    ).toBe(true);
  });

  it('keeps past-due users out of the free builder lane', () => {
    expect(
      hasFreeBuilderAccess({
        platformAccessAllowed: false,
        isMasterCeo: false,
        isPaid: false,
        isDemo: false,
        effectiveTier: 'monthly',
        effectiveStatus: 'past_due',
        effectivePeriodEnd: null,
        daysRemaining: null,
        reason: 'subscription_past_due',
      }),
    ).toBe(false);
  });

  it('marks portal and dashboard routes as paid-only', () => {
    expect(requiresPaidAccessPath('/portal')).toBe(true);
    expect(requiresPaidAccessPath('/dashboard')).toBe(true);
    expect(requiresPaidAccessPath('/onboarding')).toBe(false);
    expect(requiresPaidAccessPath('/alm')).toBe(false);
  });

  it('routes free builder users into onboarding or alm instead of access required', () => {
    const freeAccess = {
      platformAccessAllowed: false,
      isMasterCeo: false,
      isPaid: false,
      isDemo: false,
      effectiveTier: 'free',
      effectiveStatus: null,
      effectivePeriodEnd: null,
      daysRemaining: null,
      reason: 'subscription_required' as const,
    };

    expect(
      resolveAuthenticatedDestination({
        access: freeAccess,
        onboardingComplete: false,
      }),
    ).toBe('/onboarding');
    expect(
      resolveAuthenticatedDestination({
        access: freeAccess,
        onboardingComplete: true,
      }),
    ).toBe('/alm');
    expect(
      resolveAuthenticatedDestination({
        access: {
          ...freeAccess,
          effectiveTier: 'monthly',
          reason: 'subscription_past_due',
        },
        onboardingComplete: true,
      }),
    ).toBe(ACCESS_REQUIRED_ROUTE);
  });
});
