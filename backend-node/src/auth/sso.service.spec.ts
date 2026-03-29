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
