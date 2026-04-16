import {
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { CpaFirmService } from './cpa-firm.service';
import type { CreateCpaFirmDto } from './cpa.dto';

describe('CpaFirmService', () => {
  let service: CpaFirmService;
  let prisma: any;

  const baseFirmInput: CreateCpaFirmDto = {
    name: 'Torres & Asociados CPA',
    slug: 'torres-cpa',
    contactName: 'Maria Torres',
    contactEmail: 'maria@torrescpa.com',
    contactPhone: '787-555-1234',
    tier: 'CPA_STANDARD',
  };

  const baseFirm = {
    id: 'firm-1',
    ...baseFirmInput,
    logoUrl: null,
    brandPrimaryColor: null,
    brandSecondaryColor: null,
    website: null,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    prisma = {
      cpaFirm: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      cpaClientRelationship: {
        count: jest.fn(),
      },
    };

    service = new CpaFirmService(prisma);
  });

  // ─── createFirm ───────────────────────────────────────────────

  describe('createFirm', () => {
    it('creates a new CPA firm with all provided fields', async () => {
      prisma.cpaFirm.findUnique.mockResolvedValue(null);
      prisma.cpaFirm.create.mockResolvedValue(baseFirm);

      const result = await service.createFirm(baseFirmInput);

      expect(result.id).toBe('firm-1');
      expect(result.slug).toBe('torres-cpa');
      expect(result.tier).toBe('CPA_STANDARD');
      expect(result.isActive).toBe(true);
      expect(prisma.cpaFirm.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            name: 'Torres & Asociados CPA',
            slug: 'torres-cpa',
            contactEmail: 'maria@torrescpa.com',
            tier: 'CPA_STANDARD',
            isActive: true,
          }),
        }),
      );
    });

    it('throws ConflictException when slug already exists', async () => {
      prisma.cpaFirm.findUnique.mockResolvedValue(baseFirm);

      await expect(service.createFirm(baseFirmInput)).rejects.toThrow(
        ConflictException,
      );
    });

    it('creates a CPA_PRO tier firm', async () => {
      prisma.cpaFirm.findUnique.mockResolvedValue(null);
      const proFirm = { ...baseFirm, tier: 'CPA_PRO' };
      prisma.cpaFirm.create.mockResolvedValue(proFirm);

      const result = await service.createFirm({
        ...baseFirmInput,
        tier: 'CPA_PRO',
      });

      expect(result.tier).toBe('CPA_PRO');
    });
  });

  // ─── getFirm ──────────────────────────────────────────────────

  describe('getFirm', () => {
    it('returns firm with client count and relationships', async () => {
      prisma.cpaFirm.findUnique.mockResolvedValue({
        ...baseFirm,
        clients: [
          {
            id: 'rel-1',
            firmId: 'firm-1',
            institutionId: 'inst-1',
            brandingOverride: {},
            addedAt: new Date(),
            removedAt: null,
          },
        ],
        users: [
          {
            id: 'user-1',
            email: 'maria@torrescpa.com',
            name: 'Maria Torres',
            role: 'OWNER',
          },
        ],
      });

      const result = await service.getFirm('firm-1');

      expect(result.clientCount).toBe(1);
      expect(result.clients).toHaveLength(1);
      expect(result.users).toHaveLength(1);
    });

    it('throws NotFoundException for missing firm', async () => {
      prisma.cpaFirm.findUnique.mockResolvedValue(null);

      await expect(service.getFirm('missing')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ─── checkClientLimit ─────────────────────────────────────────

  describe('checkClientLimit', () => {
    it('returns canAdd=true when under CPA_STANDARD limit of 5', async () => {
      prisma.cpaFirm.findUnique.mockResolvedValue({
        ...baseFirm,
        tier: 'CPA_STANDARD',
      });
      prisma.cpaClientRelationship.count.mockResolvedValue(3);

      const result = await service.checkClientLimit('firm-1');

      expect(result).toEqual({ current: 3, max: 5, canAdd: true });
    });

    it('returns canAdd=false when at CPA_STANDARD limit of 5', async () => {
      prisma.cpaFirm.findUnique.mockResolvedValue({
        ...baseFirm,
        tier: 'CPA_STANDARD',
      });
      prisma.cpaClientRelationship.count.mockResolvedValue(5);

      const result = await service.checkClientLimit('firm-1');

      expect(result).toEqual({ current: 5, max: 5, canAdd: false });
    });

    it('returns canAdd=true for CPA_PRO with 10 clients (limit is 15)', async () => {
      prisma.cpaFirm.findUnique.mockResolvedValue({
        ...baseFirm,
        tier: 'CPA_PRO',
      });
      prisma.cpaClientRelationship.count.mockResolvedValue(10);

      const result = await service.checkClientLimit('firm-1');

      expect(result).toEqual({ current: 10, max: 15, canAdd: true });
    });

    it('returns canAdd=false for CPA_PRO at 15 clients', async () => {
      prisma.cpaFirm.findUnique.mockResolvedValue({
        ...baseFirm,
        tier: 'CPA_PRO',
      });
      prisma.cpaClientRelationship.count.mockResolvedValue(15);

      const result = await service.checkClientLimit('firm-1');

      expect(result).toEqual({ current: 15, max: 15, canAdd: false });
    });

    it('throws NotFoundException for missing firm', async () => {
      prisma.cpaFirm.findUnique.mockResolvedValue(null);

      await expect(service.checkClientLimit('missing')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ─── deactivateFirm ───────────────────────────────────────────

  describe('deactivateFirm', () => {
    it('sets isActive to false', async () => {
      prisma.cpaFirm.findUnique.mockResolvedValue(baseFirm);
      prisma.cpaFirm.update.mockResolvedValue({
        ...baseFirm,
        isActive: false,
      });

      await service.deactivateFirm('firm-1');

      expect(prisma.cpaFirm.update).toHaveBeenCalledWith({
        where: { id: 'firm-1' },
        data: { isActive: false },
      });
    });

    it('throws NotFoundException for missing firm', async () => {
      prisma.cpaFirm.findUnique.mockResolvedValue(null);

      await expect(service.deactivateFirm('missing')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ─── getFirmBySlug ────────────────────────────────────────────

  describe('getFirmBySlug', () => {
    it('returns firm when slug matches', async () => {
      prisma.cpaFirm.findUnique.mockResolvedValue(baseFirm);

      const result = await service.getFirmBySlug('torres-cpa');

      expect(result?.slug).toBe('torres-cpa');
      expect(prisma.cpaFirm.findUnique).toHaveBeenCalledWith({
        where: { slug: 'torres-cpa' },
      });
    });

    it('returns null when slug does not exist', async () => {
      prisma.cpaFirm.findUnique.mockResolvedValue(null);

      const result = await service.getFirmBySlug('nonexistent');

      expect(result).toBeNull();
    });
  });

  // ─── updateFirm ───────────────────────────────────────────────

  describe('updateFirm', () => {
    it('updates specified fields only', async () => {
      // assertFirmExists call
      prisma.cpaFirm.findUnique.mockResolvedValue(baseFirm);
      prisma.cpaFirm.update.mockResolvedValue({
        ...baseFirm,
        name: 'Torres & Partners CPA',
      });

      const result = await service.updateFirm('firm-1', {
        name: 'Torres & Partners CPA',
      });

      expect(result.name).toBe('Torres & Partners CPA');
    });

    it('throws ConflictException when updating to a slug already taken', async () => {
      prisma.cpaFirm.findUnique.mockResolvedValue(baseFirm);
      prisma.cpaFirm.findFirst.mockResolvedValue({
        id: 'firm-2',
        slug: 'taken-slug',
      });

      await expect(
        service.updateFirm('firm-1', { slug: 'taken-slug' }),
      ).rejects.toThrow(ConflictException);
    });
  });

  // ─── listFirms ────────────────────────────────────────────────

  describe('listFirms', () => {
    it('returns all firms when no filters', async () => {
      prisma.cpaFirm.findMany.mockResolvedValue([baseFirm]);

      const result = await service.listFirms({});

      expect(result).toHaveLength(1);
      expect(prisma.cpaFirm.findMany).toHaveBeenCalledWith({
        where: {},
        orderBy: { createdAt: 'desc' },
      });
    });

    it('filters by tier', async () => {
      prisma.cpaFirm.findMany.mockResolvedValue([]);

      await service.listFirms({ tier: 'CPA_PRO' });

      expect(prisma.cpaFirm.findMany).toHaveBeenCalledWith({
        where: { tier: 'CPA_PRO' },
        orderBy: { createdAt: 'desc' },
      });
    });

    it('filters by isActive', async () => {
      prisma.cpaFirm.findMany.mockResolvedValue([]);

      await service.listFirms({ isActive: true });

      expect(prisma.cpaFirm.findMany).toHaveBeenCalledWith({
        where: { isActive: true },
        orderBy: { createdAt: 'desc' },
      });
    });
  });
});
