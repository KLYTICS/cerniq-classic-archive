import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

export const MASTER_ACCOUNT_EMAIL = 'data.ai.kiess@gmail.com';
export const PLATFORM_ACCESS_REQUIRED_CODE = 'PLATFORM_ACCESS_REQUIRED';

export type PlatformAccessReason =
  | 'paid'
  | 'demo_active'
  | 'master_ceo'
  | 'owner_recovery_bypass'
  | 'subscription_required'
  | 'subscription_past_due'
  | 'subscription_cancelled'
  | 'demo_expired';

export type PlatformSubscriptionSnapshot = {
  tier?: string | null;
  status?: string | null;
  currentPeriodEnd?: Date | string | null;
} | null;

export interface PlatformAccessState {
  platformAccessAllowed: boolean;
  isMasterCeo: boolean;
  isPaid: boolean;
  isDemo: boolean;
  effectiveTier: string;
  effectiveStatus: string | null;
  effectivePeriodEnd: string | null;
  daysRemaining: number | null;
  reason: PlatformAccessReason;
}

@Injectable()
export class PlatformAccessService {
  constructor(private readonly prisma: PrismaService) {}

  isMasterAccountEmail(email?: string | null) {
    const normalizedEmail = this.normalizeEmail(email);
    return normalizedEmail === MASTER_ACCOUNT_EMAIL;
  }

  async getAccessForUser(
    userId: string,
    email?: string | null,
    subscription?: PlatformSubscriptionSnapshot,
    role?: string | null,
  ): Promise<PlatformAccessState> {
    let resolvedEmail = this.normalizeEmail(email);
    let resolvedSubscription = subscription ?? null;
    let resolvedRole = this.normalizeRole(role);

    if (!resolvedEmail || !resolvedSubscription || !resolvedRole) {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: {
          email: true,
          role: true,
          subscription: {
            select: {
              tier: true,
              status: true,
              currentPeriodEnd: true,
            },
          },
        },
      });

      resolvedEmail = resolvedEmail || this.normalizeEmail(user?.email);
      resolvedSubscription = resolvedSubscription || user?.subscription || null;
      resolvedRole = resolvedRole || this.normalizeRole(user?.role);
    }

    return this.evaluateAccess(
      resolvedEmail,
      resolvedSubscription,
      resolvedRole,
    );
  }

  evaluateAccess(
    email?: string | null,
    subscription?: PlatformSubscriptionSnapshot,
    role?: string | null,
  ): PlatformAccessState {
    const normalizedEmail = this.normalizeEmail(email);
    const normalizedRole = this.normalizeRole(role);
    const effectiveTier = subscription?.tier || 'free';
    const effectiveStatus = subscription?.status || null;
    const periodEndDate = this.toDate(subscription?.currentPeriodEnd);
    const effectivePeriodEnd = periodEndDate
      ? periodEndDate.toISOString()
      : null;
    const daysRemaining = periodEndDate
      ? Math.max(
          0,
          Math.ceil((periodEndDate.getTime() - Date.now()) / 86400000),
        )
      : null;

    const isMasterCeo = this.isMasterAccountEmail(normalizedEmail);
    const isPaid =
      effectiveTier !== 'free' &&
      effectiveTier !== 'demo' &&
      (effectiveStatus === 'active' || effectiveStatus === 'grace_period');
    const isDemoActive =
      effectiveTier === 'demo' &&
      (effectiveStatus === 'active' || effectiveStatus === 'grace_period') &&
      (!periodEndDate || periodEndDate.getTime() > Date.now());

    const ownerRecoveryBypassEnabled = this.isOwnerRecoveryBypassEnabled();
    const isRecoveryOwner =
      ownerRecoveryBypassEnabled && normalizedRole === 'OWNER';

    const buildState = (
      allowed: boolean,
      reason: PlatformAccessReason,
      overrides: Partial<PlatformAccessState> = {},
    ): PlatformAccessState => ({
      platformAccessAllowed: allowed,
      isMasterCeo: false,
      isPaid: false,
      isDemo: false,
      effectiveTier,
      effectiveStatus,
      effectivePeriodEnd,
      daysRemaining,
      reason,
      ...overrides,
    });

    if (isMasterCeo) {
      return buildState(true, 'master_ceo', { isMasterCeo: true, isPaid });
    }

    if (isPaid) {
      return buildState(true, 'paid', { isPaid: true });
    }

    if (isDemoActive) {
      return buildState(true, 'demo_active', { isDemo: true });
    }

    if (isRecoveryOwner) {
      return buildState(true, 'owner_recovery_bypass');
    }

    // Demo tier present but expired or in a non-active status — surface a clear reason
    if (effectiveTier === 'demo') {
      return buildState(false, 'demo_expired');
    }

    let reason: PlatformAccessReason = 'subscription_required';
    if (effectiveStatus === 'past_due') {
      reason = 'subscription_past_due';
    } else if (
      effectiveTier !== 'free' &&
      effectiveStatus &&
      effectiveStatus !== 'active' &&
      effectiveStatus !== 'grace_period'
    ) {
      reason = 'subscription_cancelled';
    }

    return buildState(false, reason);
  }

  private toDate(value: Date | string | null | undefined): Date | null {
    if (!value) return null;
    if (value instanceof Date) return value;
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  buildForbiddenPayload(access: PlatformAccessState) {
    return {
      code: PLATFORM_ACCESS_REQUIRED_CODE,
      message: this.messageFor(access.reason),
      access,
    };
  }

  private normalizeEmail(email?: string | null) {
    return (email || '').trim().toLowerCase() || null;
  }

  private normalizeRole(role?: string | null) {
    return (role || '').trim().toUpperCase() || null;
  }

  private isOwnerRecoveryBypassEnabled() {
    const normalized = (process.env.PLATFORM_RECOVERY_OWNER_BYPASS || '')
      .trim()
      .toLowerCase();
    if (!normalized) {
      return process.env.NODE_ENV === 'production';
    }
    return (
      normalized === '1' ||
      normalized === 'true' ||
      normalized === 'yes' ||
      normalized === 'on'
    );
  }

  private messageFor(reason: PlatformAccessReason) {
    switch (reason) {
      case 'master_ceo':
      case 'paid':
      case 'owner_recovery_bypass':
      case 'demo_active':
        return 'Platform access granted.';
      case 'subscription_past_due':
        return 'Your subscription is past due. Update billing to restore platform access.';
      case 'subscription_cancelled':
        return 'Your subscription is cancelled. Reactivate a paid plan to restore platform access.';
      case 'demo_expired':
        return 'Your CERNIQ demo has expired. Upgrade to a paid plan to keep access.';
      case 'subscription_required':
      default:
        return 'A paid CERNIQ plan is required to access the platform.';
    }
  }
}
