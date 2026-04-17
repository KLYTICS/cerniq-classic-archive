import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { StorageService } from '../storage/storage.service';
import type { UpdateBrandingDto } from './cpa.dto';

// ─── Interfaces ─────────────────────────────────────────────────

export interface CpaBranding {
  logoUrl: string | null;
  primaryColor: string;
  secondaryColor: string;
  firmName: string;
  website: string | null;
  reportFooterText: string | null;
  reportHeaderTemplate: string | null;
}

export interface ReportBranding extends CpaBranding {
  clientOverrides?: Partial<CpaBranding>;
}

// ─── Defaults ───────────────────────────────────────────────────

const DEFAULT_PRIMARY_COLOR = '#0066CC';
const DEFAULT_SECONDARY_COLOR = '#003366';

// ─── Service ────────────────────────────────────────────────────

@Injectable()
export class CpaBrandingService {
  private readonly logger = new Logger(CpaBrandingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  /**
   * Get the branding configuration for a CPA firm.
   */
  async getBranding(firmId: string): Promise<CpaBranding> {
    const firm = await this.prisma.cpaFirm.findUnique({
      where: { id: firmId },
    });
    if (!firm) {
      throw new NotFoundException(`CPA firm ${firmId} not found`);
    }

    return {
      logoUrl: firm.logoUrl ?? null,
      primaryColor: firm.brandPrimaryColor ?? DEFAULT_PRIMARY_COLOR,
      secondaryColor: firm.brandSecondaryColor ?? DEFAULT_SECONDARY_COLOR,
      firmName: firm.name,
      website: firm.website ?? null,
      reportFooterText: firm.reportFooterText ?? null,
      reportHeaderTemplate: firm.reportHeaderTemplate ?? null,
    };
  }

  /**
   * Update branding fields on the firm record.
   */
  async updateBranding(
    firmId: string,
    params: UpdateBrandingDto,
  ): Promise<CpaBranding> {
    const firm = await this.prisma.cpaFirm.findUnique({
      where: { id: firmId },
    });
    if (!firm) {
      throw new NotFoundException(`CPA firm ${firmId} not found`);
    }

    await this.prisma.cpaFirm.update({
      where: { id: firmId },
      data: {
        ...(params.logoUrl !== undefined && { logoUrl: params.logoUrl }),
        ...(params.primaryColor !== undefined && {
          brandPrimaryColor: params.primaryColor,
        }),
        ...(params.secondaryColor !== undefined && {
          brandSecondaryColor: params.secondaryColor,
        }),
        ...(params.firmName !== undefined && { name: params.firmName }),
        ...(params.website !== undefined && { website: params.website }),
        ...(params.reportFooterText !== undefined && {
          reportFooterText: params.reportFooterText,
        }),
        ...(params.reportHeaderTemplate !== undefined && {
          reportHeaderTemplate: params.reportHeaderTemplate,
        }),
      },
    });

    this.logger.log({
      event: 'cpa.branding_updated',
      firmId,
      fields: Object.keys(params),
    });

    return this.getBranding(firmId);
  }

  /**
   * Merge firm-level branding with optional per-client overrides
   * stored on the CpaClientRelationship.brandingOverride JSON column.
   */
  async getReportBranding(
    firmId: string,
    institutionId: string,
  ): Promise<ReportBranding> {
    const baseBranding = await this.getBranding(firmId);

    const relationship = await this.prisma.cpaClientRelationship.findFirst({
      where: { firmId, institutionId, removedAt: null },
    });

    if (!relationship || !relationship.brandingOverride) {
      return baseBranding;
    }

    const overrides =
      typeof relationship.brandingOverride === 'object'
        ? (relationship.brandingOverride as Partial<CpaBranding>)
        : {};

    return {
      ...baseBranding,
      clientOverrides: overrides,
    };
  }

  /**
   * Upload a firm logo to S3 and persist the URL on the firm record.
   * Returns the public URL of the uploaded logo.
   */
  async uploadLogo(
    firmId: string,
    file: Buffer,
    mimeType: string,
  ): Promise<string> {
    const firm = await this.prisma.cpaFirm.findUnique({
      where: { id: firmId },
    });
    if (!firm) {
      throw new NotFoundException(`CPA firm ${firmId} not found`);
    }

    const extension = mimeType === 'image/png' ? 'png' : 'jpg';
    const filename = `cpa-logo-${firm.slug}.${extension}`;

    const result = await this.storage.generateUploadUrl(
      firmId,
      filename,
      mimeType,
    );

    // Update the firm record with the new logo URL
    await this.prisma.cpaFirm.update({
      where: { id: firmId },
      data: { logoUrl: result.fileUrl },
    });

    this.logger.log({
      event: 'cpa.logo_uploaded',
      firmId,
      fileUrl: result.fileUrl,
    });

    return result.fileUrl;
  }
}
