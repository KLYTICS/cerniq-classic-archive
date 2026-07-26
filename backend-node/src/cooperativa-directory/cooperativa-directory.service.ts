import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import {
  loadCooperativaCsvRows,
  toProspectCreateInput,
} from '../leads/coop-csv-seed';
import {
  COOPERATIVA_LEADERSHIP_ROLES,
  COOPERATIVA_ORG_UNITS,
  COOPERATIVA_STRUCTURE_VERSION,
  extractMunicipality,
  resolvePrimaryRoleKey,
  slugifyCooperativaName,
} from './cooperativa-org-template';
import {
  COOPERATIVA_DIRECTORY_SCHEMA_VERSION,
  type AgentBundleInstitution,
  type AgentBundleLeadershipSeat,
  type AgentBundleOrgUnit,
  type CooperativaAgentBundle,
} from './cooperativa-directory.types';
import {
  buildOutreach,
  buildSeatContactNote,
  type CompactOutreachSummary,
  type CooperativaOutreach,
  type CooperativaSeatContactNote,
} from './cooperativa-outreach';

type ProfileWithStructure = Prisma.CooperativaOrgProfileGetPayload<{
  include: {
    prospect: true;
    units: true;
    leadershipSeats: true;
  };
}>;

@Injectable()
export class CooperativaDirectoryService {
  private readonly logger = new Logger(CooperativaDirectoryService.name);

  constructor(private readonly prisma: PrismaService) {}

  async seedFullDirectory(csvPath?: string) {
    const rows = loadCooperativaCsvRows(csvPath);
    let prospectsCreated = 0;
    let profilesCreated = 0;
    let profilesUpdated = 0;
    let seatsEnsured = 0;

    for (const row of rows) {
      let prospect = await this.prisma.prospectInstitution.findFirst({
        where: { name: row.name },
      });

      if (!prospect) {
        prospect = await this.prisma.prospectInstitution.create({
          data: toProspectCreateInput(row),
        });
        prospectsCreated++;
      }

      const slug = slugifyCooperativaName(row.name);
      const municipality = extractMunicipality(row.location);
      const primaryRoleKey = resolvePrimaryRoleKey(row.contactRole);
      const outreach = buildOutreach({
        name: row.name,
        location: row.location,
        estimatedAssets: row.estimatedAssets,
        contactRole: row.contactRole,
        region: row.region,
      });

      const existingProfile =
        await this.prisma.cooperativaOrgProfile.findUnique({
          where: { prospectInstitutionId: prospect.id },
        });

      const profile = existingProfile
        ? await this.prisma.cooperativaOrgProfile.update({
            where: { id: existingProfile.id },
            data: {
              slug,
              region: row.region || existingProfile.region,
              municipality: municipality ?? existingProfile.municipality,
              structureVersion: COOPERATIVA_STRUCTURE_VERSION,
              lastSeededAt: new Date(),
              metadata: {
                seedContactRole: row.contactRole,
                estimatedAssets: row.estimatedAssets,
                outreach,
              },
            },
          })
        : await this.prisma.cooperativaOrgProfile.create({
            data: {
              prospectInstitutionId: prospect.id,
              slug,
              region: row.region,
              municipality,
              structureVersion: COOPERATIVA_STRUCTURE_VERSION,
              metadata: {
                seedContactRole: row.contactRole,
                estimatedAssets: row.estimatedAssets,
                outreach,
              },
            },
          });

      if (existingProfile) profilesUpdated++;
      else profilesCreated++;

      if (outreach.cossecSlug) {
        await this.prisma.prospectInstitution.update({
          where: { id: prospect.id },
          data: {
            publicDataIdentifier: outreach.cossecSlug,
            publicDataSource: 'cossec',
            notes: this.mergeOutreachNote(prospect.notes, outreach),
          },
        });
      } else {
        await this.prisma.prospectInstitution.update({
          where: { id: prospect.id },
          data: { notes: this.mergeOutreachNote(prospect.notes, outreach) },
        });
      }

      const unitIdByKey = new Map<string, string>();
      for (const unit of COOPERATIVA_ORG_UNITS) {
        const record = await this.prisma.cooperativaOrgUnit.upsert({
          where: {
            orgProfileId_unitKey: {
              orgProfileId: profile.id,
              unitKey: unit.unitKey,
            },
          },
          create: {
            orgProfileId: profile.id,
            unitKey: unit.unitKey,
            nameEs: unit.nameEs,
            nameEn: unit.nameEn,
            sortOrder: unit.sortOrder,
          },
          update: {
            nameEs: unit.nameEs,
            nameEn: unit.nameEn,
            sortOrder: unit.sortOrder,
          },
        });
        unitIdByKey.set(unit.unitKey, record.id);
      }

      for (const role of COOPERATIVA_LEADERSHIP_ROLES) {
        const isPrimaryBuyer = role.roleKey === primaryRoleKey;
        const contactNote = buildSeatContactNote({
          roleKey: role.roleKey,
          isPrimaryBuyer,
          outreach,
        });
        await this.prisma.cooperativaLeadershipSeat.upsert({
          where: {
            orgProfileId_roleKey: {
              orgProfileId: profile.id,
              roleKey: role.roleKey,
            },
          },
          create: {
            orgProfileId: profile.id,
            orgUnitId: unitIdByKey.get(role.unitKey) ?? null,
            roleKey: role.roleKey,
            titleEs: role.titleEs,
            titleEn: role.titleEn,
            decisionTier: role.decisionTier,
            almBuyerPriority: role.almBuyerPriority,
            reportsToRoleKey: role.reportsToRoleKey ?? null,
            isPrimaryBuyer,
            isPlaceholder: true,
            provenance: 'org_template+outreach',
            metadata: contactNote ? { contactNote } : undefined,
          },
          update: {
            orgUnitId: unitIdByKey.get(role.unitKey) ?? null,
            titleEs: role.titleEs,
            titleEn: role.titleEn,
            decisionTier: role.decisionTier,
            almBuyerPriority: role.almBuyerPriority,
            reportsToRoleKey: role.reportsToRoleKey ?? null,
            isPrimaryBuyer,
            provenance: 'org_template+outreach',
            metadata: contactNote ? { contactNote } : undefined,
          },
        });
        seatsEnsured++;
      }
    }

    this.logger.log({
      event: 'cooperativa.directory.seeded',
      institutions: rows.length,
      prospectsCreated,
      profilesCreated,
      profilesUpdated,
      seatsEnsured,
    });

    return {
      institutions: rows.length,
      prospectsCreated,
      profilesCreated,
      profilesUpdated,
      leadershipSeatsPerInstitution: COOPERATIVA_LEADERSHIP_ROLES.length,
      totalLeadershipSeats: rows.length * COOPERATIVA_LEADERSHIP_ROLES.length,
      structureVersion: COOPERATIVA_STRUCTURE_VERSION,
    };
  }

  async listProfiles(limit = 200) {
    return this.prisma.cooperativaOrgProfile.findMany({
      take: limit,
      orderBy: [{ region: 'asc' }, { slug: 'asc' }],
      include: {
        prospect: {
          select: {
            id: true,
            name: true,
            location: true,
            estimatedAssets: true,
            publicDataIdentifier: true,
            contactRole: true,
          },
        },
        _count: { select: { leadershipSeats: true, units: true } },
      },
    });
  }

  async getInstitutionStructure(slugOrId: string) {
    const profile = await this.findProfile(slugOrId);
    return this.buildInstitutionBundle(profile.id);
  }

  async buildAgentBundle(limit = 500): Promise<CooperativaAgentBundle> {
    const profiles = await this.prisma.cooperativaOrgProfile.findMany({
      take: limit,
      orderBy: [{ region: 'asc' }, { slug: 'asc' }],
      select: { id: true },
    });

    const institutions: AgentBundleInstitution[] = [];
    let leadershipSeatCount = 0;

    for (const profile of profiles) {
      const bundle = await this.buildInstitutionBundle(profile.id);
      institutions.push(bundle);
      leadershipSeatCount += bundle.leadershipFlat.length;
    }

    return {
      schemaVersion: COOPERATIVA_DIRECTORY_SCHEMA_VERSION,
      generatedAt: new Date().toISOString(),
      institutionCount: institutions.length,
      leadershipSeatCount,
      institutions,
    };
  }

  async exportAgentBundleNdjson(limit = 500): Promise<string> {
    const bundle = await this.buildAgentBundle(limit);
    const header = JSON.stringify({
      type: 'manifest',
      schemaVersion: bundle.schemaVersion,
      generatedAt: bundle.generatedAt,
      institutionCount: bundle.institutionCount,
      leadershipSeatCount: bundle.leadershipSeatCount,
    });
    const lines = [
      header,
      ...bundle.institutions.map((inst) => JSON.stringify(inst)),
    ];
    return lines.join('\n');
  }

  async exportFlatCsv(limit = 500): Promise<string> {
    const bundle = await this.buildAgentBundle(limit);
    const header =
      'institution_slug,institution_name,region,municipality,assets_usd,unit_key,role_key,title_es,decision_tier,alm_priority,is_primary_buyer,full_name,email,linkedin_url,is_placeholder';
    const rows = bundle.institutions.flatMap((inst) =>
      inst.leadershipFlat.map((seat) =>
        [
          inst.slug,
          `"${inst.name.replace(/"/g, '""')}"`,
          inst.region ?? '',
          inst.municipality ?? '',
          inst.estimatedAssetsUsd ?? '',
          seat.unitKey ?? '',
          seat.roleKey,
          `"${seat.titleEs.replace(/"/g, '""')}"`,
          seat.decisionTier,
          seat.almBuyerPriority,
          seat.isPrimaryBuyer,
          seat.fullName ? `"${seat.fullName.replace(/"/g, '""')}"` : '',
          seat.email ?? '',
          seat.linkedinUrl ?? '',
          seat.isPlaceholder,
        ].join(','),
      ),
    );
    return [header, ...rows].join('\n');
  }

  async upsertLeaderContact(input: {
    slug: string;
    roleKey: string;
    fullName?: string;
    email?: string;
    phone?: string;
    linkedinUrl?: string;
    provenance?: string;
  }) {
    const profile = await this.prisma.cooperativaOrgProfile.findUnique({
      where: { slug: input.slug },
    });
    if (!profile) {
      throw new NotFoundException(
        `Cooperativa profile not found: ${input.slug}`,
      );
    }

    return this.prisma.cooperativaLeadershipSeat.update({
      where: {
        orgProfileId_roleKey: {
          orgProfileId: profile.id,
          roleKey: input.roleKey,
        },
      },
      data: {
        fullName: input.fullName,
        email: input.email,
        phone: input.phone,
        linkedinUrl: input.linkedinUrl,
        isPlaceholder: !input.fullName && !input.email && !input.linkedinUrl,
        provenance: input.provenance ?? 'manual',
      },
    });
  }

  private async findProfile(slugOrId: string) {
    const profile =
      (await this.prisma.cooperativaOrgProfile.findUnique({
        where: { slug: slugOrId },
      })) ??
      (await this.prisma.cooperativaOrgProfile.findUnique({
        where: { id: slugOrId },
      })) ??
      (await this.prisma.cooperativaOrgProfile.findFirst({
        where: { prospectInstitutionId: slugOrId },
      }));

    if (!profile) {
      throw new NotFoundException(
        `Cooperativa org profile not found: ${slugOrId}`,
      );
    }
    return profile;
  }

  private async buildInstitutionBundle(
    profileId: string,
  ): Promise<AgentBundleInstitution> {
    const profile: ProfileWithStructure =
      await this.prisma.cooperativaOrgProfile.findUniqueOrThrow({
        where: { id: profileId },
        include: {
          prospect: true,
          units: { orderBy: { sortOrder: 'asc' } },
          leadershipSeats: { orderBy: { almBuyerPriority: 'desc' } },
        },
      });

    const unitNameByKey = new Map<string, string>(
      profile.units.map((unit: ProfileWithStructure['units'][number]) => [
        unit.unitKey,
        unit.nameEs,
      ]),
    );

    const mapSeat = (
      seat: ProfileWithStructure['leadershipSeats'][number],
    ): AgentBundleLeadershipSeat => {
      const unitKey =
        profile.units.find(
          (unit: ProfileWithStructure['units'][number]) =>
            unit.id === seat.orgUnitId,
        )?.unitKey ?? null;
      return {
        seatId: seat.id,
        roleKey: seat.roleKey,
        titleEs: seat.titleEs,
        titleEn: seat.titleEn,
        unitKey,
        unitNameEs: unitKey ? (unitNameByKey.get(unitKey) ?? null) : null,
        decisionTier: seat.decisionTier,
        almBuyerPriority: seat.almBuyerPriority,
        reportsToRoleKey: seat.reportsToRoleKey,
        fullName: seat.fullName,
        email: seat.email,
        phone: seat.phone,
        linkedinUrl: seat.linkedinUrl,
        isPrimaryBuyer: seat.isPrimaryBuyer,
        isPlaceholder: seat.isPlaceholder,
        provenance: seat.provenance,
        contactNote: this.extractSeatContactNote(seat.metadata),
      };
    };

    const leadershipFlat = profile.leadershipSeats.map(mapSeat);
    const seatsByUnit = new Map<string, AgentBundleLeadershipSeat[]>();
    for (const seat of leadershipFlat) {
      const key = seat.unitKey ?? '_unassigned';
      const bucket = seatsByUnit.get(key) ?? [];
      bucket.push(seat);
      seatsByUnit.set(key, bucket);
    }

    const orgUnits: AgentBundleOrgUnit[] = profile.units.map(
      (unit: ProfileWithStructure['units'][number]) => ({
        unitKey: unit.unitKey,
        nameEs: unit.nameEs,
        nameEn: unit.nameEn,
        sortOrder: unit.sortOrder,
        leadership: seatsByUnit.get(unit.unitKey) ?? [],
      }),
    );

    const outreach = this.resolveOutreach(profile, {
      name: profile.prospect.name,
      location: profile.prospect.location,
      estimatedAssets: profile.prospect.estimatedAssets
        ? Number(profile.prospect.estimatedAssets)
        : 0,
      contactRole:
        (typeof profile.metadata === 'object' &&
        profile.metadata &&
        'seedContactRole' in profile.metadata
          ? String(
              (profile.metadata as { seedContactRole?: string })
                .seedContactRole,
            )
          : null) ||
        profile.prospect.contactRole ||
        'CFO',
      region: profile.region || '',
    });

    return {
      profileId: profile.id,
      prospectInstitutionId: profile.prospectInstitutionId,
      slug: profile.slug,
      name: profile.prospect.name,
      location: profile.prospect.location,
      region: profile.region,
      municipality: profile.municipality,
      estimatedAssetsUsd: profile.prospect.estimatedAssets
        ? Number(profile.prospect.estimatedAssets)
        : null,
      regulator: profile.regulator,
      structureVersion: profile.structureVersion,
      cossecSlug: outreach.cossecSlug ?? profile.prospect.publicDataIdentifier,
      outreach,
      orgUnits,
      primaryBuyers: leadershipFlat.filter(
        (seat: AgentBundleLeadershipSeat) => seat.isPrimaryBuyer,
      ),
      leadershipFlat,
    };
  }

  async buildOutreachSummary(limit = 500): Promise<CompactOutreachSummary> {
    const bundle = await this.buildAgentBundle(limit);
    const routesMap = new Map<
      string,
      { region: string; week: number; count: number; priorityH: number }
    >();

    for (const inst of bundle.institutions) {
      const key = inst.outreach.route.r;
      const existing = routesMap.get(key) ?? {
        region: key,
        week: inst.outreach.route.w,
        count: 0,
        priorityH: 0,
      };
      existing.count += 1;
      if (inst.outreach.pri === 'H') existing.priorityH += 1;
      routesMap.set(key, existing);
    }

    const topTargets = [...bundle.institutions]
      .sort((a, b) => b.outreach.score - a.outreach.score)
      .slice(0, 20)
      .map((inst) => ({
        slug: inst.slug,
        name: inst.name,
        score: inst.outreach.score,
        grade: inst.outreach.grade,
        tier: inst.outreach.tier,
        role: inst.outreach.roleLabel,
        loc: inst.outreach.loc,
        ask: inst.outreach.ask,
        note: inst.outreach.note,
      }));

    const totals = {
      institutions: bundle.institutionCount,
      tier1: 0,
      tier2: 0,
      tier3: 0,
      gradeA: 0,
      gradeB: 0,
      gradeC: 0,
      gradeD: 0,
      priorityH: 0,
      cossecLinked: 0,
      totalAssetsM: 0,
    };

    for (const inst of bundle.institutions) {
      if (inst.outreach.tier === 1) totals.tier1++;
      else if (inst.outreach.tier === 2) totals.tier2++;
      else totals.tier3++;
      if (inst.outreach.grade === 'A') totals.gradeA++;
      else if (inst.outreach.grade === 'B') totals.gradeB++;
      else if (inst.outreach.grade === 'C') totals.gradeC++;
      else totals.gradeD++;
      if (inst.outreach.pri === 'H') totals.priorityH++;
      if (inst.outreach.cossec) totals.cossecLinked++;
      totals.totalAssetsM += inst.outreach.assetsM;
    }

    return {
      schemaVersion: 'cerniq.cooperativa-outreach.v1',
      generatedAt: new Date().toISOString(),
      secure: { piiPolicy: 'no_fabricated_contacts', access: 'admin_only' },
      totals,
      routes: [...routesMap.values()].sort((a, b) => a.week - b.week),
      topTargets,
    };
  }

  private mergeOutreachNote(
    existing: string | null | undefined,
    outreach: CooperativaOutreach,
  ): string {
    const tag = `[outreach v${outreach.v}]`;
    const line = `${tag} ${outreach.grade}/${outreach.score} T${outreach.tier} ${outreach.pri} · ${outreach.note}`;
    if (!existing) return line;
    if (existing.includes(tag)) {
      return existing
        .split('\n')
        .map((row) => (row.startsWith(tag) ? line : row))
        .join('\n');
    }
    return `${existing}\n${line}`.trim();
  }

  private resolveOutreach(
    profile: ProfileWithStructure,
    fallback: {
      name: string;
      location: string | null;
      estimatedAssets: number;
      contactRole: string;
      region: string;
    },
  ): CooperativaOutreach {
    const meta = profile.metadata;
    if (
      meta &&
      typeof meta === 'object' &&
      'outreach' in meta &&
      meta.outreach &&
      typeof meta.outreach === 'object' &&
      'v' in (meta.outreach as object)
    ) {
      return meta.outreach as CooperativaOutreach;
    }
    return buildOutreach(fallback);
  }

  private extractSeatContactNote(
    metadata: unknown,
  ): CooperativaSeatContactNote | null {
    if (!metadata || typeof metadata !== 'object') return null;
    if (!('contactNote' in metadata)) return null;
    const note = (metadata as { contactNote?: CooperativaSeatContactNote })
      .contactNote;
    return note ?? null;
  }
}
