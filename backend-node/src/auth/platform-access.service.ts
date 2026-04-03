import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

export const MASTER_ACCOUNT_EMAIL = 'data.ai.kiess@gmail.com';
export const PLATFORM_ACCESS_REQUIRED_CODE = 'PLATFORM_ACCESS_REQUIRED';

export type PlatformAccessReason =
  | 'paid'
  | 'master_ceo'
  | 'owner_recovery_bypass'
  | 'subscription_required'
  | 'subscription_past_due'
  | 'subscription_cancelled';

export type PlatformSubscriptionSnapshot = {
  tier?: string | null;
  status?: string | null;
} | null;

export interface PlatformAccessState {
  platformAccessAllowed: boolean;
  isMasterCeo: boolean;
  isPaid: boolean;
  effectiveTier: string;
  effectiveStatus: string | null;
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
    const isMasterCeo = this.isMasterAccountEmail(normalizedEmail);
    const isPaid =
      effectiveTier !== 'free' &&
      (effectiveStatus === 'active' || effectiveStatus === 'grace_period');
    const ownerRecoveryBypassEnabled = this.isOwnerRecoveryBypassEnabled();
    const isRecoveryOwner =
      ownerRecoveryBypassEnabled && normalizedRole === 'OWNER';

    if (isMasterCeo) {
      return {
        platformAccessAllowed: true,
        isMasterCeo: true,
        isPaid,
        effectiveTier,
        effectiveStatus,
        reason: 'master_ceo',
      };
    }

    if (isPaid) {
      return {
        platformAccessAllowed: true,
        isMasterCeo: false,
        isPaid: true,
        effectiveTier,
        effectiveStatus,
        reason: 'paid',
      };
    }

    if (isRecoveryOwner) {
      return {
        platformAccessAllowed: true,
        isMasterCeo: false,
        isPaid: false,
        effectiveTier,
        effectiveStatus,
        reason: 'owner_recovery_bypass',
      };
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

    return {
      platformAccessAllowed: false,
      isMasterCeo: false,
      isPaid: false,
      effectiveTier,
      effectiveStatus,
      reason,
    };
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
        return 'Platform access granted.';
      case 'subscription_past_due':
        return 'Your subscription is past due. Update billing to restore platform access.';
      case 'subscription_cancelled':
        return 'Your subscription is cancelled. Reactivate a paid plan to restore platform access.';
      case 'subscription_required':
      default:
        return 'A paid CERNIQ plan is required to access the platform.';
    }
  }
}
