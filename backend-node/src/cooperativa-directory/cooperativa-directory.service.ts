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

      const existingProfile = await this.prisma.cooperativaOrgProfile.findUnique({
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
              },
            },
          });

      if (existingProfile) profilesUpdated++;
      else profilesCreated++;

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
            provenance: 'org_template',
          },
          update: {
            orgUnitId: unitIdByKey.get(role.unitKey) ?? null,
            titleEs: role.titleEs,
            titleEn: role.titleEn,
            decisionTier: role.decisionTier,
            almBuyerPriority: role.almBuyerPriority,
            reportsToRoleKey: role.reportsToRoleKey ?? null,
            isPrimaryBuyer,
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
    const lines = [header, ...bundle.institutions.map((inst) => JSON.stringify(inst))];
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
      throw new NotFoundException(`Cooperativa profile not found: ${input.slug}`);
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
      throw new NotFoundException(`Cooperativa org profile not found: ${slugOrId}`);
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
        unitNameEs: unitKey ? unitNameByKey.get(unitKey) ?? null : null,
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
      cossecSlug: profile.prospect.publicDataIdentifier,
      orgUnits,
      primaryBuyers: leadershipFlat.filter(
        (seat: AgentBundleLeadershipSeat) => seat.isPrimaryBuyer,
      ),
      leadershipFlat,
    };
  }
}
