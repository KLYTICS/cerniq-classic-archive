import { SSOService } from './sso.service';
import { NotFoundException } from '@nestjs/common';

describe('SSOService', () => {
  let service: SSOService;

  const mockPrisma = {
    sSOConfiguration: {
      findUnique: jest.fn(),
      upsert: jest.fn(),
      delete: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new SSOService(mockPrisma as any);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getConfig', () => {
    it('should return null when no config exists', async () => {
      mockPrisma.sSOConfiguration.findUnique.mockResolvedValue(null);
      const result = await service.getConfig('inst-123');
      expect(result).toBeNull();
    });

    it('should return mapped SSOConfig when found', async () => {
      mockPrisma.sSOConfiguration.findUnique.mockResolvedValue({
        institutionId: 'inst-123',
        protocol: 'OIDC',
        samlEntityId: null,
        samlIdpUrl: null,
        samlIdpCert: null,
        oidcIssuer: 'https://accounts.google.com',
        oidcClientId: 'client-abc',
        jitProvisioning: true,
        defaultRole: 'viewer',
        groupRoleMapping: { admins: 'admin' },
      });

      const result = await service.getConfig('inst-123');
      expect(result).not.toBeNull();
      expect(result!.protocol).toBe('OIDC');
      expect(result!.oidcIssuer).toBe('https://accounts.google.com');
      expect(result!.jitProvisioning).toBe(true);
    });
  });

  describe('saveConfig', () => {
    it('should upsert SSO configuration', async () => {
      mockPrisma.sSOConfiguration.upsert.mockResolvedValue({ id: 'sso-1' });

      await service.saveConfig('inst-123', {
        protocol: 'SAML2',
        samlEntityId: 'entity-1',
        samlIdpUrl: 'https://idp.example.com/sso',
      });

      expect(mockPrisma.sSOConfiguration.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { institutionId: 'inst-123' },
        }),
      );
    });
  });

  describe('processJITProvisioning', () => {
    it('should throw NotFoundException when no SSO config exists', async () => {
      mockPrisma.sSOConfiguration.findUnique.mockResolvedValue(null);

      await expect(
        service.processJITProvisioning('inst-123', {
          email: 'user@example.com',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should return existing user when found', async () => {
      mockPrisma.sSOConfiguration.findUnique.mockResolvedValue({
        institutionId: 'inst-123',
        protocol: 'OIDC',
        samlEntityId: null,
        samlIdpUrl: null,
        samlIdpCert: null,
        oidcIssuer: 'https://accounts.google.com',
        oidcClientId: 'client-abc',
        jitProvisioning: true,
        defaultRole: 'viewer',
        groupRoleMapping: null,
      });

      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'user@example.com',
        role: 'viewer',
      });
      mockPrisma.user.update.mockResolvedValue({});

      const result = await service.processJITProvisioning('inst-123', {
        email: 'user@example.com',
      });

      expect(result.isNewUser).toBe(false);
      expect(result.userId).toBe('user-1');
      expect(result.institutionId).toBe('inst-123');
    });
  });

  describe('processJITProvisioning — group role mapping', () => {
    const ssoConfig = {
      institutionId: 'inst-123',
      protocol: 'OIDC',
      samlEntityId: null,
      samlIdpUrl: null,
      samlIdpCert: null,
      oidcIssuer: 'https://accounts.google.com',
      oidcClientId: 'client-abc',
      jitProvisioning: true,
      defaultRole: 'viewer',
      groupRoleMapping: { admins: 'admin', finance: 'analyst' },
    };

    it('maps first matching group to role', async () => {
      mockPrisma.sSOConfiguration.findUnique.mockResolvedValue(ssoConfig);
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-grp',
        email: 'grp@example.com',
      });
      mockPrisma.user.update.mockResolvedValue({});

      const result = await service.processJITProvisioning('inst-123', {
        email: 'grp@example.com',
        groups: ['finance', 'admins'],
      });
      // finance comes first in the iteration so it should match first
      expect(result.role).toBe('analyst');
    });

    it('uses defaultRole when no groups match', async () => {
      mockPrisma.sSOConfiguration.findUnique.mockResolvedValue(ssoConfig);
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-no-grp',
        email: 'nogrp@example.com',
      });
      mockPrisma.user.update.mockResolvedValue({});

      const result = await service.processJITProvisioning('inst-123', {
        email: 'nogrp@example.com',
        groups: ['everyone'],
      });
      expect(result.role).toBe('viewer');
    });

    it('uses defaultRole when groups is undefined', async () => {
      mockPrisma.sSOConfiguration.findUnique.mockResolvedValue(ssoConfig);
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-empty',
        email: 'empty@example.com',
      });
      mockPrisma.user.update.mockResolvedValue({});

      const result = await service.processJITProvisioning('inst-123', {
        email: 'empty@example.com',
      });
      expect(result.role).toBe('viewer');
    });
  });

  describe('processJITProvisioning — JIT disabled', () => {
    it('throws when user not found and JIT provisioning disabled', async () => {
      mockPrisma.sSOConfiguration.findUnique.mockResolvedValue({
        institutionId: 'inst-123',
        protocol: 'OIDC',
        samlEntityId: null,
        samlIdpUrl: null,
        samlIdpCert: null,
        oidcIssuer: 'https://issuer.com',
        oidcClientId: 'c1',
        jitProvisioning: false,
        defaultRole: 'viewer',
        groupRoleMapping: null,
      });
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.processJITProvisioning('inst-123', {
          email: 'nobody@test.com',
        }),
      ).rejects.toThrow('User not found and JIT provisioning is disabled');
    });
  });

  describe('processJITProvisioning — JIT new user SAML', () => {
    it('provisions with saml provider and name from email when no name', async () => {
      mockPrisma.sSOConfiguration.findUnique.mockResolvedValue({
        institutionId: 'inst-123',
        protocol: 'SAML2',
        samlEntityId: 'e1',
        samlIdpUrl: 'https://idp.test.com',
        samlIdpCert: 'CERT',
        oidcIssuer: null,
        oidcClientId: null,
        jitProvisioning: true,
        defaultRole: 'viewer',
        groupRoleMapping: null,
      });
      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.user.create.mockResolvedValue({
        id: 'new-saml',
        email: 'john.doe@example.com',
      });
      mockPrisma.user.update.mockResolvedValue({});

      const result = await service.processJITProvisioning('inst-123', {
        email: 'john.doe@example.com',
      });

      expect(result.isNewUser).toBe(true);
      expect(mockPrisma.user.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          provider: 'saml',
          name: 'john.doe', // from email.split('@')[0]
          emailVerified: true,
        }),
      });
    });

    it('provisions with oidc provider and explicit name', async () => {
      mockPrisma.sSOConfiguration.findUnique.mockResolvedValue({
        institutionId: 'inst-123',
        protocol: 'OIDC',
        samlEntityId: null,
        samlIdpUrl: null,
        samlIdpCert: null,
        oidcIssuer: 'https://issuer.com',
        oidcClientId: 'c1',
        jitProvisioning: true,
        defaultRole: 'editor',
        groupRoleMapping: null,
      });
      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.user.create.mockResolvedValue({
        id: 'new-oidc',
        email: 'maria@coop.pr',
      });
      mockPrisma.user.update.mockResolvedValue({});

      const result = await service.processJITProvisioning('inst-123', {
        email: 'maria@coop.pr',
        name: 'Maria Santos',
      });

      expect(result.isNewUser).toBe(true);
      expect(result.role).toBe('editor');
      expect(mockPrisma.user.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          provider: 'oidc',
          name: 'Maria Santos',
        }),
      });
    });
  });

  describe('saveConfig — defaults', () => {
    it('uses OIDC as default protocol', async () => {
      mockPrisma.sSOConfiguration.upsert.mockResolvedValue({ id: 'cfg-1' });

      await service.saveConfig('inst-123', {});

      const callArg = mockPrisma.sSOConfiguration.upsert.mock.calls[0][0];
      expect(callArg.create.protocol).toBe('OIDC');
      expect(callArg.create.jitProvisioning).toBe(true);
      expect(callArg.create.defaultRole).toBe('viewer');
    });
  });

  describe('getConfig — SAML config', () => {
    it('maps SAML fields correctly', async () => {
      mockPrisma.sSOConfiguration.findUnique.mockResolvedValue({
        institutionId: 'inst-saml',
        protocol: 'SAML2',
        samlEntityId: 'entity-saml',
        samlIdpUrl: 'https://saml-idp.com',
        samlIdpCert: 'CERT_DATA',
        oidcIssuer: null,
        oidcClientId: null,
        jitProvisioning: false,
        defaultRole: 'admin',
        groupRoleMapping: null,
      });

      const config = await service.getConfig('inst-saml');
      expect(config!.protocol).toBe('SAML2');
      expect(config!.samlEntityId).toBe('entity-saml');
      expect(config!.samlIdpUrl).toBe('https://saml-idp.com');
      expect(config!.samlIdpCert).toBe('CERT_DATA');
      expect(config!.oidcIssuer).toBeUndefined();
      expect(config!.oidcClientId).toBeUndefined();
      expect(config!.groupRoleMapping).toBeNull();
    });
  });

  describe('deleteConfig', () => {
    it('should delete SSO configuration', async () => {
      mockPrisma.sSOConfiguration.delete.mockResolvedValue({});

      const result = await service.deleteConfig('inst-123');
      expect(result.deleted).toBe(true);
      expect(mockPrisma.sSOConfiguration.delete).toHaveBeenCalledWith({
        where: { institutionId: 'inst-123' },
      });
    });
  });
});
