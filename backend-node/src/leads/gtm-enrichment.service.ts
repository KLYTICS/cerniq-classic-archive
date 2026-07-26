import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { LeadQualificationService } from './lead-qualification.service';
import { LeadScoringService } from './lead-scoring.service';
import { InstitutionIntelligenceService } from './institution-intelligence.service';
import { FreeReportService } from './free-report.service';
import { COSSEC_BENCHMARK_Q3_2025 } from './prospect-seed';
import { listPrCooperativas } from '../alm/data/registry/pr-cooperativas.registry';
import {
  loadCooperativaCsvRows,
  toProspectCreateInput,
  type CooperativaCsvRow,
} from './coop-csv-seed';

export interface GtmEnrichmentSummary {
  prospectsSeeded: { created: number; updated: number; total: number };
  cossecLinked: number;
  almRiskScored: number;
  intelligenceSynced: { created: number; updated: number };
  leadsScored: number;
  linkedInMatched: number;
  contactsCreated: number;
  qualificationTop10: Array<{
    prospectId: string;
    name: string;
    grade: string;
    priority: string;
    totalScore: number;
  }>;
}

export interface LinkedInImportRow {
  firstName?: string;
  lastName?: string;
  linkedinUrl?: string;
  email?: string;
  company?: string;
  position?: string;
}

export interface FieldSalesRoute {
  region: string;
  institutionCount: number;
  totalAssetsUsd: number;
  cossecSnapshotCount: number;
  linkedInContactCount: number;
  suggestedWeek: number;
  stops: Array<{
    prospectId: string;
    name: string;
    location: string;
    estimatedAssetsM: number;
    grade: string | null;
    priority: string | null;
    hasCossecSnapshot: boolean;
    linkedInContacts: number;
    contactRole: string | null;
    nextAction: string | null;
  }>;
}

@Injectable()
export class GtmEnrichmentService {
  private readonly logger = new Logger(GtmEnrichmentService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly qualification: LeadQualificationService,
    private readonly scoring: LeadScoringService,
    private readonly intelligence: InstitutionIntelligenceService,
    private readonly freeReport: FreeReportService,
  ) {}

  async seedAllCooperativasFromCsv(csvPath?: string) {
    const rows = loadCooperativaCsvRows(csvPath);
    let created = 0;
    let updated = 0;

    for (const row of rows) {
      const existing = await this.prisma.prospectInstitution.findFirst({
        where: { name: row.name },
      });
      const input = toProspectCreateInput(row);

      if (!existing) {
        await this.prisma.prospectInstitution.create({ data: input });
        created++;
        continue;
      }

      await this.prisma.prospectInstitution.update({
        where: { id: existing.id },
        data: {
          location: input.location || existing.location,
          estimatedAssets: input.estimatedAssets || existing.estimatedAssets,
          contactRole: input.contactRole || existing.contactRole,
          publicDataSource: input.publicDataSource || existing.publicDataSource,
          notes: this.mergeRegionNote(existing.notes, row.region),
        },
      });
      updated++;
    }

    const existingBenchmark = await this.prisma.cooperativaBenchmark.findFirst({
      where: { period: COSSEC_BENCHMARK_Q3_2025.period },
    });
    if (!existingBenchmark) {
      await this.prisma.cooperativaBenchmark.create({
        data: COSSEC_BENCHMARK_Q3_2025,
      });
    }

    this.logger.log(
      `Cooperativa CSV seed complete: ${created} created, ${updated} updated (${rows.length} total)`,
    );

    return {
      created,
      updated,
      total: rows.length,
      benchmarkSeeded: !existingBenchmark,
    };
  }

  async enrichAllProspects(options?: {
    syncIntelligence?: boolean;
    scoreLeads?: boolean;
    limit?: number;
  }): Promise<GtmEnrichmentSummary> {
    const limit = options?.limit ?? 250;
    const prospects = await this.prisma.prospectInstitution.findMany({
      orderBy: [{ estimatedAssets: 'desc' }, { createdAt: 'asc' }],
      take: limit,
    });

    let cossecLinked = 0;
    let almRiskScored = 0;

    for (const prospect of prospects) {
      const match = this.freeReport.fuzzyMatch(prospect.name);
      if (!match) continue;

      const healthScore = this.freeReport.computeHealthScore({
        capitalRatioPct: match.capitalRatioPct,
        liquidityRatioPct: match.liquidityRatioPct,
        niiMarginPct: match.niiMarginPct,
        assetGrowthYoyPct: match.assetGrowthYoyPct,
        loanToDepositPct: match.loanToDepositPct,
      });

      const needsUpdate =
        prospect.publicDataIdentifier !== match.slug ||
        prospect.almRiskScore === null ||
        Number(prospect.estimatedAssets) !== match.totalAssets;

      if (!needsUpdate) continue;

      await this.prisma.prospectInstitution.update({
        where: { id: prospect.id },
        data: {
          publicDataIdentifier: match.slug,
          publicDataSource: 'cossec',
          estimatedAssets: match.totalAssets,
          almRiskScore: healthScore,
          outreachPersonalized: true,
        },
      });

      cossecLinked++;
      almRiskScored++;
    }

    let intelligenceSynced = { created: 0, updated: 0 };
    if (options?.syncIntelligence !== false) {
      intelligenceSynced =
        await this.intelligence.syncProspectsToAccounts(limit);
    }

    let leadsScored = 0;
    if (options?.scoreLeads !== false) {
      const scoreResult = await this.scoring.scoreAllLeads();
      leadsScored = scoreResult.scored;
    }

    const qualifications = await Promise.all(
      prospects.map(async (prospect: { id: string; name: string }) => {
        const qualification = await this.qualification.qualifyProspect(
          prospect.id,
        );
        return {
          prospectId: prospect.id,
          name: prospect.name,
          grade: qualification.grade,
          priority: qualification.priority,
          totalScore: qualification.totalScore,
        };
      }),
    );

    const qualificationTop10 = qualifications
      .sort((a, b) => b.totalScore - a.totalScore)
      .slice(0, 10);

    return {
      prospectsSeeded: {
        created: 0,
        updated: 0,
        total: prospects.length,
      },
      cossecLinked,
      almRiskScored,
      intelligenceSynced,
      leadsScored,
      linkedInMatched: 0,
      contactsCreated: 0,
      qualificationTop10,
    };
  }

  async runFullPipeline(csvPath?: string): Promise<GtmEnrichmentSummary> {
    const seeded = await this.seedAllCooperativasFromCsv(csvPath);
    const enriched = await this.enrichAllProspects({
      syncIntelligence: true,
      scoreLeads: true,
    });

    return {
      ...enriched,
      prospectsSeeded: {
        created: seeded.created,
        updated: seeded.updated,
        total: seeded.total,
      },
    };
  }

  parseLinkedInCsv(csvContent: string): LinkedInImportRow[] {
    const lines = csvContent.split(/\r?\n/).filter((line) => line.trim());
    if (lines.length < 2) return [];

    const header = this.parseCsvLine(lines[0]).map((h) =>
      h.toLowerCase().trim(),
    );
    const col = (...names: string[]) => {
      for (const name of names) {
        const idx = header.findIndex((h) => h.includes(name));
        if (idx >= 0) return idx;
      }
      return -1;
    };

    const firstNameIdx = col('first name');
    const lastNameIdx = col('last name');
    const urlIdx = col('url');
    const emailIdx = col('email');
    const companyIdx = col('company', 'organization');
    const positionIdx = col('position', 'title');

    const rows: LinkedInImportRow[] = [];
    for (const line of lines.slice(1)) {
      const cols = this.parseCsvLine(line);
      const company = cols[companyIdx]?.trim();
      if (!company) continue;

      rows.push({
        firstName: cols[firstNameIdx]?.trim(),
        lastName: cols[lastNameIdx]?.trim(),
        linkedinUrl: cols[urlIdx]?.trim(),
        email: cols[emailIdx]?.trim() || undefined,
        company,
        position: cols[positionIdx]?.trim(),
      });
    }

    return rows;
  }

  async importLinkedInConnections(csvContent: string) {
    const rows = this.parseLinkedInCsv(csvContent);
    await this.intelligence.syncProspectsToAccounts(500);

    const prospects = await this.prisma.prospectInstitution.findMany({
      take: 500,
      orderBy: { estimatedAssets: 'desc' },
    });

    let matched = 0;
    let contactsCreated = 0;

    for (const row of rows) {
      const prospect = this.matchProspectByCompany(
        row.company || '',
        prospects,
      );
      if (!prospect) continue;

      matched++;

      const refreshed = await this.prisma.prospectInstitution.findUnique({
        where: { id: prospect.id },
      });
      const accountId = refreshed?.intelligenceAccountId ?? null;
      if (!accountId) continue;

      const fullName = [row.firstName, row.lastName]
        .filter(Boolean)
        .join(' ')
        .trim();
      if (!fullName) continue;

      const normalizedName = this.normalizeName(fullName);
      const existingContact = await this.prisma.intelligenceContact.findFirst({
        where: {
          accountId,
          OR: [
            { normalizedName },
            ...(row.email ? [{ email: row.email }] : []),
            ...(row.linkedinUrl ? [{ linkedinUrl: row.linkedinUrl }] : []),
          ],
        },
      });

      if (!existingContact) {
        await this.prisma.intelligenceContact.create({
          data: {
            accountId,
            fullName,
            normalizedName,
            title: row.position,
            email: row.email,
            linkedinUrl: row.linkedinUrl,
            contactScore: this.scoreLinkedInContact(row),
            reachabilityScore: row.linkedinUrl ? 85 : row.email ? 70 : 40,
            metadata: { source: 'linkedin_import' },
            lastVerifiedAt: new Date(),
          },
        });
        contactsCreated++;
      }

      const prospectUpdates: Record<string, string> = {};
      if (!prospect.contactName && fullName) {
        prospectUpdates.contactName = fullName;
      }
      if (!prospect.contactEmail && row.email) {
        prospectUpdates.contactEmail = row.email;
      }
      if (Object.keys(prospectUpdates).length > 0) {
        await this.prisma.prospectInstitution.update({
          where: { id: prospect.id },
          data: prospectUpdates,
        });
      }
    }

    this.logger.log(
      `LinkedIn import: ${matched} matched, ${contactsCreated} contacts created from ${rows.length} rows`,
    );

    return { parsed: rows.length, matched, contactsCreated };
  }

  async buildFieldSalesPlaybook(): Promise<{
    generatedAt: string;
    totalInstitutions: number;
    totalAssetsUsd: number;
    tier1Count: number;
    cossecSnapshotCount: number;
    linkedInContactCount: number;
    routes: FieldSalesRoute[];
    weeklyPlan: Array<{ week: number; region: string; stopCount: number }>;
  }> {
    const prospects = await this.prisma.prospectInstitution.findMany({
      orderBy: [{ estimatedAssets: 'desc' }],
      take: 500,
      include: {
        intelligenceAccount: {
          include: {
            contacts: true,
          },
        },
      },
    });

    const byRegion = new Map<string, typeof prospects>();
    for (const prospect of prospects) {
      const region = this.extractRegion(prospect) || 'Other';
      const bucket = byRegion.get(region) || [];
      bucket.push(prospect);
      byRegion.set(region, bucket);
    }

    const routes: FieldSalesRoute[] = [];
    let week = 1;

    for (const [region, regionProspects] of [...byRegion.entries()].sort(
      (a, b) =>
        this.sumAssets(b[1]) - this.sumAssets(a[1]) ||
        b[1].length - a[1].length,
    )) {
      const stops = [];
      for (const prospect of regionProspects) {
        const qualification = await this.qualification.qualifyProspect(
          prospect.id,
        );
        const linkedInContacts =
          prospect.intelligenceAccount?.contacts.filter(
            (c: { linkedinUrl: string | null }) => c.linkedinUrl,
          ).length ?? 0;

        stops.push({
          prospectId: prospect.id,
          name: prospect.name,
          location: prospect.location || '',
          estimatedAssetsM: Math.round(
            Number(prospect.estimatedAssets || 0) / 1_000_000,
          ),
          grade: qualification.grade,
          priority: qualification.priority,
          hasCossecSnapshot: Boolean(prospect.publicDataIdentifier),
          linkedInContacts,
          contactRole: prospect.contactRole,
          nextAction: qualification.nextAction,
        });
      }

      routes.push({
        region,
        institutionCount: regionProspects.length,
        totalAssetsUsd: this.sumAssets(regionProspects),
        cossecSnapshotCount: regionProspects.filter(
          (p: { publicDataIdentifier: string | null }) =>
            p.publicDataIdentifier,
        ).length,
        linkedInContactCount: regionProspects.reduce(
          (
            sum: number,
            p: {
              intelligenceAccount?: {
                contacts: Array<{ linkedinUrl: string | null }>;
              } | null;
            },
          ) =>
            sum +
            (p.intelligenceAccount?.contacts.filter(
              (c: { linkedinUrl: string | null }) => c.linkedinUrl,
            ).length ?? 0),
          0,
        ),
        suggestedWeek: week++,
        stops: stops.sort((a, b) => b.estimatedAssetsM - a.estimatedAssetsM),
      });
    }

    const totalAssetsUsd = this.sumAssets(prospects);
    const tier1Count = prospects.filter(
      (p: { estimatedAssets: unknown }) =>
        Number(p.estimatedAssets || 0) >= 200_000_000,
    ).length;

    return {
      generatedAt: new Date().toISOString(),
      totalInstitutions: prospects.length,
      totalAssetsUsd,
      tier1Count,
      cossecSnapshotCount: prospects.filter(
        (p: { publicDataIdentifier: string | null }) => p.publicDataIdentifier,
      ).length,
      linkedInContactCount: prospects.reduce(
        (
          sum: number,
          p: {
            intelligenceAccount?: {
              contacts: Array<{ linkedinUrl: string | null }>;
            } | null;
          },
        ) =>
          sum +
          (p.intelligenceAccount?.contacts.filter(
            (c: { linkedinUrl: string | null }) => c.linkedinUrl,
          ).length ?? 0),
        0,
      ),
      routes,
      weeklyPlan: routes.map((route) => ({
        week: route.suggestedWeek,
        region: route.region,
        stopCount: route.stops.length,
      })),
    };
  }

  getTier1ProspectNames(): string[] {
    return listPrCooperativas()
      .filter((c) => c.icpTier === 'tier1')
      .map((c) => c.displayName);
  }

  private mergeRegionNote(existing: string | null, region: string) {
    if (!region) return existing ?? undefined;
    const tag = `region:${region}`;
    if (!existing) return tag;
    if (existing.includes(tag)) return existing;
    return `${existing}\n${tag}`;
  }

  private extractRegion(prospect: {
    location: string | null;
    notes: string | null;
  }) {
    const fromNotes = prospect.notes?.match(/region:([A-Za-z]+)/)?.[1];
    if (fromNotes) return fromNotes;

    const location = prospect.location || '';
    if (/San Juan|Bayamón|Guaynabo|Carolina|Trujillo Alto/i.test(location)) {
      return 'Metro';
    }
    if (/Ponce|Guayama|Arroyo|Coamo|Yauco/i.test(location)) return 'South';
    if (/Humacao|Ceiba|Fajardo|Caguas|Gurabo|Juncos/i.test(location))
      return 'East';
    if (/Mayagüez|Aguada|Aguadilla|Cabo Rojo|San Germán/i.test(location))
      return 'West';
    if (/Arecibo|Barceloneta|Manatí|Dorado|Camuy/i.test(location))
      return 'North';
    if (/Ciales|Barranquitas|Aibonito|Cayey|Comerio/i.test(location))
      return 'Central';
    return 'Other';
  }

  private sumAssets(prospects: Array<{ estimatedAssets: unknown }>): number {
    return prospects.reduce(
      (sum, prospect) => sum + Number(prospect.estimatedAssets || 0),
      0,
    );
  }

  private matchProspectByCompany(
    company: string,
    prospects: Array<{
      id: string;
      name: string;
      contactName?: string | null;
      contactEmail?: string | null;
    }>,
  ) {
    const normalizedCompany = this.normalizeName(company);
    if (!normalizedCompany) return null;

    for (const prospect of prospects) {
      const normalizedProspect = this.normalizeName(prospect.name);
      if (
        normalizedProspect.includes(normalizedCompany) ||
        normalizedCompany.includes(normalizedProspect)
      ) {
        return prospect;
      }
    }

    const companyWords = normalizedCompany
      .split(/\s+/)
      .filter((w) => w.length >= 4);
    for (const prospect of prospects) {
      const normalizedProspect = this.normalizeName(prospect.name);
      if (companyWords.some((word) => normalizedProspect.includes(word))) {
        return prospect;
      }
    }

    return null;
  }

  private scoreLinkedInContact(row: LinkedInImportRow) {
    let score = 50;
    const position = (row.position || '').toLowerCase();
    if (
      position.includes('cfo') ||
      position.includes('financ') ||
      position.includes('tesor') ||
      position.includes('controller')
    ) {
      score += 25;
    } else if (
      position.includes('president') ||
      position.includes('gerente general') ||
      position.includes('ceo')
    ) {
      score += 20;
    } else if (position.includes('riesgo') || position.includes('risk')) {
      score += 15;
    }
    if (row.linkedinUrl) score += 10;
    if (row.email) score += 5;
    return Math.min(score, 100);
  }

  private normalizeName(value: string) {
    return value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/cooperativa de ahorro y credito (de )?/g, '')
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private parseCsvLine(line: string): string[] {
    const fields: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        inQuotes = !inQuotes;
        continue;
      }
      if (char === ',' && !inQuotes) {
        fields.push(current.trim());
        current = '';
        continue;
      }
      current += char;
    }
    fields.push(current.trim());
    return fields;
  }
}
