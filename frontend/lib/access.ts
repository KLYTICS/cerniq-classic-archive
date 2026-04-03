export type PlatformAccessReason =
  | 'paid'
  | 'master_ceo'
  | 'owner_recovery_bypass'
  | 'subscription_required'
  | 'subscription_past_due'
  | 'subscription_cancelled';

export interface PlatformAccessState {
  platformAccessAllowed: boolean;
  isMasterCeo: boolean;
  isPaid: boolean;
  effectiveTier: string;
  effectiveStatus: string | null;
  reason: PlatformAccessReason;
}

export const ACCESS_REQUIRED_ROUTE = '/access-required';

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object'
    ? (value as Record<string, unknown>)
    : null;
}

export function normalizePlatformAccess(
  payload: unknown,
): PlatformAccessState | null {
  const candidate = asRecord(payload);
  if (!candidate) {
    return null;
  }

  if (typeof candidate.platformAccessAllowed !== 'boolean') {
    return null;
  }

  return {
    platformAccessAllowed: candidate.platformAccessAllowed,
    isMasterCeo: Boolean(candidate.isMasterCeo),
    isPaid: Boolean(candidate.isPaid),
    effectiveTier:
      typeof candidate.effectiveTier === 'string'
        ? candidate.effectiveTier
        : 'free',
    effectiveStatus:
      typeof candidate.effectiveStatus === 'string'
        ? candidate.effectiveStatus
        : null,
    reason:
      typeof candidate.reason === 'string'
        ? (candidate.reason as PlatformAccessReason)
        : 'subscription_required',
  };
}

export function hasPlatformAccess(
  access: PlatformAccessState | null | undefined,
) {
  return Boolean(access?.platformAccessAllowed);
}

export function prefersPortalExperience(
  access: PlatformAccessState | null | undefined,
) {
  return Boolean(access?.isMasterCeo || access?.effectiveTier !== 'free');
}

export function isProtectedAppPath(pathname: string | null) {
  if (!pathname) {
    return false;
  }

  const prefixes = [
    '/access-required',
    '/dashboard',
    '/onboarding',
    '/portal',
    '/portfolios',
    '/risk-analytics',
    '/settings',
    '/alm',
  ];

  return prefixes.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export function resolveAuthenticatedDestination(params: {
  access: PlatformAccessState | null | undefined;
  onboardingComplete: boolean;
  portalPreferred?: boolean;
}) {
  const { access, onboardingComplete, portalPreferred = false } = params;

  if (!hasPlatformAccess(access)) {
    return ACCESS_REQUIRED_ROUTE;
  }

  if (portalPreferred || prefersPortalExperience(access)) {
    return '/portal';
  }

  return onboardingComplete ? '/dashboard' : '/onboarding';
}
