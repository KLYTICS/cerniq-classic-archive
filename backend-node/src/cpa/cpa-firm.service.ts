import {
  Injectable,
  Logger,
  ConflictException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import {
  CPA_TIER_LIMITS,
  type CreateCpaFirmDto,
  type UpdateCpaFirmDto,
  type CpaTier,
} from './cpa.dto';

// ─── Interfaces ─────────────────────────────────────────────────

export interface CpaFirm {
  id: string;
  name: string;
  slug: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string | null;
  logoUrl: string | null;
  brandPrimaryColor: string | null;
  brandSecondaryColor: string | null;
  website: string | null;
  tier: CpaTier;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CpaFirmUser {
  id: string;
  email: string;
  name: string | null;
  role: string;
}

export interface CpaClientRelationship {
  id: string;
  firmId: string;
  institutionId: string;
  brandingOverride: any;
  addedAt: Date;
  removedAt: Date | null;
}

export interface CpaFirmWithClients extends CpaFirm {
  clients: CpaClientRelationship[];
  users: CpaFirmUser[];
  clientCount: number;
}

// ─── Service ────────────────────────────────────────────────────

@Injectable()
export class CpaFirmService {
  private readonly logger = new Logger(CpaFirmService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Register a new CPA firm. Slug must be globally unique.
   */
  async createFirm(params: CreateCpaFirmDto): Promise<CpaFirm> {
    const existing = await this.prisma.cpaFirm.findUnique({
      where: { slug: params.slug },
    });
    if (existing) {
      throw new ConflictException(
        `A CPA firm with slug "${params.slug}" already exists`,
      );
    }

    const firm = await this.prisma.cpaFirm.create({
      data: {
        name: params.name,
        slug: params.slug,
        contactName: params.contactName,
        contactEmail: params.contactEmail,
        contactPhone: params.contactPhone ?? null,
        logoUrl: params.logoUrl ?? null,
        brandPrimaryColor: params.brandPrimaryColor ?? null,
        brandSecondaryColor: params.brandSecondaryColor ?? null,
        website: params.website ?? null,
        tier: params.tier,
        isActive: true,
      },
    });

    this.logger.log({
      event: 'cpa.firm_created',
      firmId: firm.id,
      slug: firm.slug,
      tier: firm.tier,
    });

    return firm as CpaFirm;
  }

  /**
   * Get a firm with its active client relationships and users.
   */
  async getFirm(firmId: string): Promise<CpaFirmWithClients> {
    const firm = await this.prisma.cpaFirm.findUnique({
      where: { id: firmId },
      include: {
        clients: {
          where: { removedAt: null },
          orderBy: { assignedAt: 'desc' },
        },
        users: {
          select: { id: true, email: true, name: true, role: true },
        },
      },
    });

    if (!firm) {
      throw new NotFoundException(`CPA firm ${firmId} not found`);
    }

    return {
      ...firm,
      clientCount: firm.clients.length,
    } as CpaFirmWithClients;
  }

  /**
   * Update firm details and/or branding.
   */
  async updateFirm(firmId: string, params: UpdateCpaFirmDto): Promise<CpaFirm> {
    await this.assertFirmExists(firmId);

    // If slug is changing, verify uniqueness
    if (params.slug) {
      const slugTaken = await this.prisma.cpaFirm.findFirst({
        where: { slug: params.slug, id: { not: firmId } },
      });
      if (slugTaken) {
        throw new ConflictException(
          `Slug "${params.slug}" is already in use by another firm`,
        );
      }
    }

    const updated = await this.prisma.cpaFirm.update({
      where: { id: firmId },
      data: {
        ...(params.name !== undefined && { name: params.name }),
        ...(params.slug !== undefined && { slug: params.slug }),
        ...(params.contactName !== undefined && {
          contactName: params.contactName,
        }),
        ...(params.contactEmail !== undefined && {
          contactEmail: params.contactEmail,
        }),
        ...(params.contactPhone !== undefined && {
          contactPhone: params.contactPhone,
        }),
        ...(params.logoUrl !== undefined && { logoUrl: params.logoUrl }),
        ...(params.brandPrimaryColor !== undefined && {
          brandPrimaryColor: params.brandPrimaryColor,
        }),
        ...(params.brandSecondaryColor !== undefined && {
          brandSecondaryColor: params.brandSecondaryColor,
        }),
        ...(params.website !== undefined && { website: params.website }),
        ...(params.tier !== undefined && { tier: params.tier }),
      },
    });

    this.logger.log({
      event: 'cpa.firm_updated',
      firmId,
      fields: Object.keys(params),
    });

    return updated as CpaFirm;
  }

  /**
   * Admin: list all CPA firms with optional tier/active filters.
   */
  async listFirms(params: {
    tier?: string;
    isActive?: boolean;
  }): Promise<CpaFirm[]> {
    const where: any = {};
    if (params.tier) where.tier = params.tier;
    if (params.isActive !== undefined) where.isActive = params.isActive;

    const firms = await this.prisma.cpaFirm.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    return firms as CpaFirm[];
  }

  /**
   * Soft-deactivate a firm. Active client relationships remain but the
   * firm can no longer log in or generate reports.
   */
  async deactivateFirm(firmId: string): Promise<void> {
    await this.assertFirmExists(firmId);

    await this.prisma.cpaFirm.update({
      where: { id: firmId },
      data: { isActive: false },
    });

    this.logger.log({ event: 'cpa.firm_deactivated', firmId });
  }

  /**
   * Resolve a firm by its white-label URL slug.
   */
  async getFirmBySlug(slug: string): Promise<CpaFirm | null> {
    const firm = await this.prisma.cpaFirm.findUnique({
      where: { slug },
    });
    return (firm as CpaFirm) ?? null;
  }

  /**
   * Check whether a firm can add another client given its tier limit.
   */
  async checkClientLimit(
    firmId: string,
  ): Promise<{ current: number; max: number; canAdd: boolean }> {
    const firm = await this.prisma.cpaFirm.findUnique({
      where: { id: firmId },
    });
    if (!firm) {
      throw new NotFoundException(`CPA firm ${firmId} not found`);
    }

    const current = await this.prisma.cpaClientRelationship.count({
      where: { firmId, removedAt: null },
    });

    const max = CPA_TIER_LIMITS[firm.tier as keyof typeof CPA_TIER_LIMITS];
    return { current, max, canAdd: current < max };
  }

  // ─── Helpers ──────────────────────────────────────────────────

  private async assertFirmExists(firmId: string): Promise<void> {
    const firm = await this.prisma.cpaFirm.findUnique({
      where: { id: firmId },
    });
    if (!firm) {
      throw new NotFoundException(`CPA firm ${firmId} not found`);
    }
  }
}
