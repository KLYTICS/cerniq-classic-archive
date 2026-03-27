import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

// ─── SSO Configuration Service ──────────────────────────────
// Manages per-institution SAML 2.0 / OIDC configurations
// In production: integrates with passport-saml and passport-openidconnect

export interface SSOConfig {
  institutionId: string;
  protocol: 'SAML2' | 'OIDC';
  // SAML
  samlEntityId?: string;
  samlIdpUrl?: string;
  samlIdpCert?: string;
  // OIDC
  oidcIssuer?: string;
  oidcClientId?: string;
  // Settings
  jitProvisioning: boolean;
  defaultRole: string;
  groupRoleMapping: Record<string, string> | null;
}

export interface SSOLoginResult {
  userId: string;
  email: string;
  role: string;
  isNewUser: boolean;
  institutionId: string;
}

@Injectable()
export class SSOService {
  private readonly logger = new Logger(SSOService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getConfig(institutionId: string): Promise<SSOConfig | null> {
    const config = await this.prisma.sSOConfiguration.findUnique({
      where: { institutionId },
    });
    if (!config) return null;
    return {
      institutionId: config.institutionId,
      protocol: config.protocol as 'SAML2' | 'OIDC',
      samlEntityId: config.samlEntityId ?? undefined,
      samlIdpUrl: config.samlIdpUrl ?? undefined,
      samlIdpCert: config.samlIdpCert ?? undefined,
      oidcIssuer: config.oidcIssuer ?? undefined,
      oidcClientId: config.oidcClientId ?? undefined,
      jitProvisioning: config.jitProvisioning,
      defaultRole: config.defaultRole,
      groupRoleMapping: config.groupRoleMapping as Record<
        string,
        string
      > | null,
    };
  }

  async saveConfig(institutionId: string, config: Partial<SSOConfig>) {
    return this.prisma.sSOConfiguration.upsert({
      where: { institutionId },
      update: {
        protocol: config.protocol,
        samlEntityId: config.samlEntityId,
        samlIdpUrl: config.samlIdpUrl,
        samlIdpCert: config.samlIdpCert,
        oidcIssuer: config.oidcIssuer,
        oidcClientId: config.oidcClientId,
        jitProvisioning: config.jitProvisioning ?? true,
        defaultRole: config.defaultRole ?? 'viewer',
        groupRoleMapping: config.groupRoleMapping as any,
      },
      create: {
        institutionId,
        protocol: config.protocol ?? 'OIDC',
        samlEntityId: config.samlEntityId,
        samlIdpUrl: config.samlIdpUrl,
        samlIdpCert: config.samlIdpCert,
        oidcIssuer: config.oidcIssuer,
        oidcClientId: config.oidcClientId,
        jitProvisioning: config.jitProvisioning ?? true,
        defaultRole: config.defaultRole ?? 'viewer',
        groupRoleMapping: config.groupRoleMapping as any,
      },
    });
  }

  async processJITProvisioning(
    institutionId: string,
    ssoProfile: { email: string; name?: string; groups?: string[] },
  ): Promise<SSOLoginResult> {
    const config = await this.getConfig(institutionId);
    if (!config)
      throw new NotFoundException('SSO not configured for this institution');

    // Determine role from group mapping
    let role = config.defaultRole;
    if (config.groupRoleMapping && ssoProfile.groups) {
      for (const group of ssoProfile.groups) {
        if (config.groupRoleMapping[group]) {
          role = config.groupRoleMapping[group];
          break;
        }
      }
    }

    // Find or create user
    let user = await this.prisma.user.findUnique({
      where: { email: ssoProfile.email },
    });
    let isNewUser = false;

    if (!user && config.jitProvisioning) {
      user = await this.prisma.user.create({
        data: {
          email: ssoProfile.email,
          name: ssoProfile.name ?? ssoProfile.email.split('@')[0],
          provider: config.protocol === 'SAML2' ? 'saml' : 'oidc',
          emailVerified: true,
          role: role as any,
        },
      });
      isNewUser = true;
      this.logger.log(
        `JIT provisioned user ${ssoProfile.email} with role ${role}`,
      );
    }

    if (!user)
      throw new NotFoundException(
        'User not found and JIT provisioning is disabled',
      );

    // Update last login
    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    return {
      userId: user.id,
      email: user.email,
      role,
      isNewUser,
      institutionId,
    };
  }

  async deleteConfig(institutionId: string) {
    await this.prisma.sSOConfiguration.delete({ where: { institutionId } });
    return { deleted: true };
  }
}
