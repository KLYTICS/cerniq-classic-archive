import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CpaFirmService } from './cpa-firm.service';

// ─── Interfaces ─────────────────────────────────────────────────

export interface ClientSummary {
  institution: {
    id: string;
    name: string;
    type: string;
    totalAssets: number | any; // Prisma Decimal at runtime
    reportingDate: Date | null;
  };
  latestRiskScore: number | null;
  latestAnalysisDate: Date | null;
  complianceStatus: string | null;
}

export interface CpaDashboardData {
  firmName: string;
  totalClients: number;
  totalAssetsUnderAdvisory: string; // Decimal serialized as string
  riskDistribution: { high: number; medium: number; low: number };
  recentAlerts: any[];
  upcomingExams: any[];
}

export interface BulkAddResult {
  added: number;
  skipped: number;
  errors: { institutionId: string; reason: string }[];
}

// ─── Service ────────────────────────────────────────────────────

@Injectable()
export class CpaClientService {
  private readonly logger = new Logger(CpaClientService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly firmService: CpaFirmService,
  ) {}

  /**
   * Associate an institution with a CPA firm as a managed client.
   */
  async addClient(
    firmId: string,
    institutionId: string,
    brandingOverride?: Record<string, unknown>,
  ): Promise<any> {
    // Verify firm exists
    const firm = await this.prisma.cpaFirm.findUnique({
      where: { id: firmId },
    });
    if (!firm) {
      throw new NotFoundException(`CPA firm ${firmId} not found`);
    }

    // Enforce tier client limit
    const limit = await this.firmService.checkClientLimit(firmId);
    if (!limit.canAdd) {
      throw new ForbiddenException(
        `CPA firm has reached its client limit (${limit.current}/${limit.max}). Upgrade to CPA_PRO for more clients.`,
      );
    }

    // Verify institution exists
    const institution = await this.prisma.institution.findUnique({
      where: { id: institutionId },
    });
    if (!institution) {
      throw new NotFoundException(`Institution ${institutionId} not found`);
    }

    // Check for existing active relationship
    const existing = await this.prisma.cpaClientRelationship.findFirst({
      where: { cpaFirmId: firmId, institutionId, removedAt: null },
    });
    if (existing) {
      throw new ConflictException(
        `Institution ${institutionId} is already a client of this firm`,
      );
    }

    // Re-activate a previously removed relationship if one exists
    const removed = await this.prisma.cpaClientRelationship.findFirst({
      where: { cpaFirmId: firmId, institutionId, removedAt: { not: null } },
    });

    let relationship;
    if (removed) {
      relationship = await this.prisma.cpaClientRelationship.update({
        where: { id: removed.id },
        data: {
          removedAt: null,
          reportBrandingOverride:
            brandingOverride ?? removed.reportBrandingOverride,
        },
      });
    } else {
      relationship = await this.prisma.cpaClientRelationship.create({
        data: {
          cpaFirmId: firmId,
          institutionId,
          reportBrandingOverride: brandingOverride ?? {},
        },
      });
    }

    this.logger.log({
      event: 'cpa.client_added',
      firmId,
      institutionId,
      reactivated: !!removed,
    });

    return relationship;
  }

  /**
   * Soft-remove a client relationship by setting removedAt.
   */
  async removeClient(firmId: string, institutionId: string): Promise<void> {
    const relationship = await this.prisma.cpaClientRelationship.findFirst({
      where: { cpaFirmId: firmId, institutionId, removedAt: null },
    });
    if (!relationship) {
      throw new NotFoundException(
        `No active relationship between firm ${firmId} and institution ${institutionId}`,
      );
    }

    await this.prisma.cpaClientRelationship.update({
      where: { id: relationship.id },
      data: { removedAt: new Date() },
    });

    this.logger.log({
      event: 'cpa.client_removed',
      firmId,
      institutionId,
    });
  }

  /**
   * List all active clients for a firm with their latest risk scores.
   */
  async listClients(firmId: string): Promise<ClientSummary[]> {
    const relationships = await this.prisma.cpaClientRelationship.findMany({
      where: { cpaFirmId: firmId, removedAt: null },
      include: {
        institution: {
          select: {
            id: true,
            name: true,
            type: true,
            totalAssets: true,
            reportingDate: true,
          },
        },
      },
      orderBy: { assignedAt: 'desc' },
    });

    const summaries: ClientSummary[] = [];

    for (const rel of relationships) {
      // Fetch the latest analysis run for this institution
      const latestRun = await this.prisma.analysisRun.findFirst({
        where: { institutionId: rel.institutionId },
        orderBy: { createdAt: 'desc' },
        select: {
          overallRiskScore: true,
          createdAt: true,
          regulatoryCompliance: true,
        },
      });

      summaries.push({
        institution: {
          id: rel.institution.id,
          name: rel.institution.name,
          type: rel.institution.type ?? 'cooperativa',
          totalAssets: rel.institution.totalAssets,
          reportingDate: rel.institution.reportingDate,
        },
        latestRiskScore: latestRun?.overallRiskScore ?? null,
        latestAnalysisDate: latestRun?.createdAt ?? null,
        complianceStatus: latestRun?.regulatoryCompliance
          ? String(latestRun.regulatoryCompliance)
          : null,
      });
    }

    return summaries;
  }

  /**
   * Aggregate risk dashboard across all of a firm's managed clients.
   */
  async getClientDashboard(firmId: string): Promise<CpaDashboardData> {
    const firm = await this.prisma.cpaFirm.findUnique({
      where: { id: firmId },
    });
    if (!firm) {
      throw new NotFoundException(`CPA firm ${firmId} not found`);
    }

    const clients = await this.listClients(firmId);

    let totalAssets = 0;
    const riskDistribution = { high: 0, medium: 0, low: 0 };

    for (const client of clients) {
      const assets = client.institution.totalAssets;
      if (assets) {
        totalAssets +=
          typeof assets === 'number'
            ? assets
            : Number(assets.toString?.() ?? assets);
      }

      const score = client.latestRiskScore;
      if (score !== null) {
        if (score >= 70) riskDistribution.high++;
        else if (score >= 40) riskDistribution.medium++;
        else riskDistribution.low++;
      }
    }

    return {
      firmName: firm.name,
      totalClients: clients.length,
      totalAssetsUnderAdvisory: String(totalAssets),
      riskDistribution,
      recentAlerts: [], // TODO: wire up agent alert integration
      upcomingExams: [], // TODO: wire up exam-prep agent data
    };
  }

  /**
   * Bulk-add multiple institutions to a firm. Continues past individual
   * failures so partial successes are captured.
   */
  async bulkAddClients(
    firmId: string,
    institutionIds: string[],
  ): Promise<BulkAddResult> {
    const result: BulkAddResult = { added: 0, skipped: 0, errors: [] };

    for (const institutionId of institutionIds) {
      try {
        await this.addClient(firmId, institutionId);
        result.added++;
      } catch (err: any) {
        if (err instanceof ConflictException || err?.status === 409) {
          result.skipped++;
        } else {
          result.errors.push({
            institutionId,
            reason: err?.message || 'Unknown error',
          });
        }
      }
    }

    this.logger.log({
      event: 'cpa.bulk_add_clients',
      firmId,
      requested: institutionIds.length,
      added: result.added,
      skipped: result.skipped,
      errors: result.errors.length,
    });

    return result;
  }
}
