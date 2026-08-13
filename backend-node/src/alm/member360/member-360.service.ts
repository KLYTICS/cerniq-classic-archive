import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import {
  MemberAccountCategory,
  MemberEventSeverity,
  MemberLifecycleStage,
  Prisma,
  type MemberAccount,
} from '@prisma/client';
import { PrismaService } from '../../prisma.service';
import { dataGap, mergeGaps, type DataGap } from '../reports/data-gap';
import { MemberFixtureService } from './member-fixture.service';
import {
  MemberLifecycleService,
  type AccountSignal,
  type NextBestAction,
} from './member-lifecycle.service';

// GetPayload aliases for findMany/findFirst({ include }) results — the
// same pattern cooperativa-directory.service.ts uses for its
// ProfileWithStructure type, so relation-derived arrays type-check without
// resorting to `any` (KLYTICS Rule 11 forbids unrationalized `any`).
type MemberWithAccounts = Prisma.MemberGetPayload<{
  include: { accounts: true };
}>;

type MemberWithProfileRelations = Prisma.MemberGetPayload<{
  include: { accounts: true; lifecycleEvents: true };
}>;

export interface MemberDirectoryRow {
  id: string;
  memberNumber: string;
  fullName: string;
  memberSince: Date;
  lifecycleStage: MemberLifecycleStage;
  riskScore: number | null;
  totalDeposits: number;
  totalLoans: number;
}

export interface MemberDirectoryResult {
  institutionId: string;
  total: number;
  page: number;
  pageSize: number;
  members: MemberDirectoryRow[];
  gaps: DataGap[];
}

export interface MemberFinancialOverview {
  totalDeposits: number;
  totalShares: number;
  activeLoanBalance: number;
  loanToDepositRatio: number | null;
}

export interface MemberRegulatoryHealth {
  worstCossecClassification: string | null;
  ceclStage: number | null;
  riskScore: number | null;
  lifecycleStage: MemberLifecycleStage;
  lifecycleReasons: string[];
}

export interface MemberProfile {
  member: {
    id: string;
    memberNumber: string;
    fullName: string;
    memberSince: Date;
  };
  financialOverview: MemberFinancialOverview;
  regulatoryHealth: MemberRegulatoryHealth;
  accounts: Array<{
    id: string;
    productType: string;
    category: MemberAccountCategory;
    balance: number;
    interestRate: number | null;
    delinquencyDays: number | null;
    maturityDate: Date | null;
    cossecClassification: string | null;
  }>;
  lifecycleTimeline: Array<{
    id: string;
    eventType: string;
    severity: MemberEventSeverity;
    metadata: Record<string, unknown>;
    createdAt: Date;
  }>;
  nextBestActions: NextBestAction[];
  gaps: DataGap[];
}

const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 100;

function toAccountSignal(account: MemberAccount): AccountSignal {
  return {
    id: account.id,
    productType: account.productType,
    category: account.category,
    // Decimal → number via the sanctioned Number(...) coercion
    // (verify:decimal-coercion) — never raw arithmetic on a Decimal.
    balance: Number(account.balance),
    delinquencyDays: account.delinquencyDays,
    maturityDate: account.maturityDate,
    openedDate: account.openedDate,
  };
}

@Injectable()
export class Member360Service {
  private readonly logger = new Logger(Member360Service.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly fixtures: MemberFixtureService,
    private readonly lifecycle: MemberLifecycleService,
  ) {}

  /**
   * Generate + persist a demo member book for `institutionId`. Idempotent by
   * design at the seed layer (member_number is unique per institution), but
   * this is a DEMO action — re-seeding an institution that already has real
   * ingested members is refused rather than silently mixed in.
   */
  async seedDemoMembers(
    institutionId: string,
    count = 50,
  ): Promise<{ created: number; skipped: boolean; reason?: string }> {
    const existingNonFixture = await this.prisma.member.count({
      where: { institutionId, source: { not: 'fixture' } },
    });
    if (existingNonFixture > 0) {
      return {
        created: 0,
        skipped: true,
        reason:
          'Institution already has real (non-fixture) member records; refusing to seed demo data on top of them',
      };
    }

    const seeds = this.fixtures.generateMembers(institutionId, count);
    let created = 0;

    for (const seed of seeds) {
      const accountSignals: AccountSignal[] = seed.accounts.map((a, idx) => ({
        id: `pending-${idx}`,
        productType: a.productType,
        category: a.category,
        balance: a.balance,
        delinquencyDays: a.delinquencyDays,
        maturityDate: a.maturityDate,
        openedDate: a.openedDate,
      }));
      const classification = this.lifecycle.classifyStage(
        accountSignals,
        seed.memberSince,
      );
      const risk = this.lifecycle.assessRisk(seed.memberNumber, accountSignals);

      await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        const member = await tx.member.upsert({
          where: {
            institutionId_memberNumber: {
              institutionId,
              memberNumber: seed.memberNumber,
            },
          },
          create: {
            institutionId,
            memberNumber: seed.memberNumber,
            fullName: seed.fullName,
            memberSince: seed.memberSince,
            lifecycleStage: classification.stage,
            riskScore: risk.riskScore,
            ceclStage: risk.ceclStage,
            source: 'fixture',
          },
          update: {
            fullName: seed.fullName,
            lifecycleStage: classification.stage,
            riskScore: risk.riskScore,
            ceclStage: risk.ceclStage,
          },
        });

        // Fixture re-seed replaces this member's accounts wholesale — same
        // "clean tape transactionally replaces" idempotency contract
        // LoanTapeIngestService uses for asOfDate re-uploads.
        await tx.memberAccount.deleteMany({ where: { memberId: member.id } });
        if (seed.accounts.length > 0) {
          await tx.memberAccount.createMany({
            data: seed.accounts.map((a) => ({
              memberId: member.id,
              institutionId,
              productType: a.productType,
              category: a.category,
              balance: a.balance,
              interestRate: a.interestRate,
              delinquencyDays: a.delinquencyDays,
              maturityDate: a.maturityDate,
              openedDate: a.openedDate,
              cossecClassification: a.cossecClassification,
            })),
          });
        }

        await tx.memberLifecycleEvent.create({
          data: {
            memberId: member.id,
            institutionId,
            eventType: 'demo_seed',
            severity: MemberEventSeverity.INFO,
            metadata: {
              stage: classification.stage,
              reasons: classification.reasons,
              accountCount: seed.accounts.length,
            },
          },
        });
      });

      created++;
    }

    this.logger.log(
      `Seeded ${created} demo members for institution ${institutionId}`,
    );
    return { created, skipped: false };
  }

  async listMembers(
    institutionId: string,
    filters: {
      stage?: MemberLifecycleStage;
      page?: number;
      pageSize?: number;
    } = {},
  ): Promise<MemberDirectoryResult> {
    const page = Math.max(1, filters.page ?? 1);
    const pageSize = Math.min(
      MAX_PAGE_SIZE,
      Math.max(1, filters.pageSize ?? DEFAULT_PAGE_SIZE),
    );

    const where = {
      institutionId,
      ...(filters.stage ? { lifecycleStage: filters.stage } : {}),
    };

    const [total, members] = await Promise.all([
      this.prisma.member.count({ where }),
      this.prisma.member.findMany({
        where,
        include: { accounts: true },
        orderBy: { memberNumber: 'asc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    const gaps: DataGap[] = [];
    if (total === 0) {
      gaps.push(
        dataGap('member360.directory', 'NO_MEMBER_DATA', {
          severity: 'WARNING',
          action:
            'No members on file for this institution yet — seed demo data or ingest a member tape',
          context: { institutionId },
        }),
      );
    }

    const rows: MemberDirectoryRow[] = members.map((m: MemberWithAccounts) => ({
      id: m.id,
      memberNumber: m.memberNumber,
      fullName: m.fullName,
      memberSince: m.memberSince,
      lifecycleStage: m.lifecycleStage,
      riskScore: m.riskScore,
      totalDeposits: m.accounts
        .filter(
          (a: MemberAccount) =>
            a.category === MemberAccountCategory.DEPOSIT ||
            a.category === MemberAccountCategory.SHARE,
        )
        .reduce((s: number, a: MemberAccount) => s + Number(a.balance), 0),
      totalLoans: m.accounts
        .filter((a: MemberAccount) => a.category === MemberAccountCategory.LOAN)
        .reduce((s: number, a: MemberAccount) => s + Number(a.balance), 0),
    }));

    return { institutionId, total, page, pageSize, members: rows, gaps };
  }

  async getMemberProfile(
    institutionId: string,
    memberId: string,
  ): Promise<MemberProfile> {
    const member: MemberWithProfileRelations | null =
      await this.prisma.member.findFirst({
        where: { id: memberId, institutionId },
        include: {
          accounts: { orderBy: { openedDate: 'desc' } },
          lifecycleEvents: { orderBy: { createdAt: 'desc' }, take: 20 },
        },
      });

    if (!member) {
      throw new NotFoundException(
        `Member ${memberId} not found for institution ${institutionId}`,
      );
    }

    const accountSignals = member.accounts.map(toAccountSignal);
    const classification = this.lifecycle.classifyStage(
      accountSignals,
      member.memberSince,
    );
    const risk = this.lifecycle.assessRisk(member.id, accountSignals);
    const nextBestActions = this.lifecycle.computeNextBestActions(
      accountSignals,
      classification.stage,
    );

    const deposits = member.accounts.filter(
      (a) =>
        a.category === MemberAccountCategory.DEPOSIT ||
        a.category === MemberAccountCategory.SHARE,
    );
    const shares = member.accounts.filter(
      (a) => a.category === MemberAccountCategory.SHARE,
    );
    const loans = member.accounts.filter(
      (a) => a.category === MemberAccountCategory.LOAN,
    );

    const worstCossecRank: Record<string, number> = {
      pass: 0,
      special_mention: 1,
      substandard: 2,
      doubtful: 3,
      loss: 4,
    };
    let worstCossecClassification: string | null = null;
    for (const account of loans) {
      if (!account.cossecClassification) continue;
      if (
        worstCossecClassification === null ||
        (worstCossecRank[account.cossecClassification] ?? 0) >
          (worstCossecRank[worstCossecClassification] ?? 0)
      ) {
        worstCossecClassification = account.cossecClassification;
      }
    }

    const gaps = mergeGaps(risk.gaps);
    if (loans.length > 0 && worstCossecClassification === null) {
      gaps.push(
        dataGap(
          'member360.regulatoryHealth.cossecClassification',
          'MEMBER_ACCOUNTS_MISSING',
          {
            severity: 'WARNING',
            action:
              'Member holds loans but none carry a COSSEC classification yet',
            context: { memberId },
          },
        ),
      );
    }

    return {
      member: {
        id: member.id,
        memberNumber: member.memberNumber,
        fullName: member.fullName,
        memberSince: member.memberSince,
      },
      financialOverview: {
        totalDeposits: deposits
          .filter((a) => a.category === MemberAccountCategory.DEPOSIT)
          .reduce((s, a) => s + Number(a.balance), 0),
        totalShares: shares.reduce((s, a) => s + Number(a.balance), 0),
        activeLoanBalance: loans.reduce((s, a) => s + Number(a.balance), 0),
        loanToDepositRatio: risk.loanToDepositRatio,
      },
      regulatoryHealth: {
        worstCossecClassification,
        ceclStage: risk.ceclStage,
        riskScore: risk.riskScore,
        lifecycleStage: classification.stage,
        lifecycleReasons: classification.reasons,
      },
      accounts: member.accounts.map((a) => ({
        id: a.id,
        productType: a.productType,
        category: a.category,
        balance: Number(a.balance),
        interestRate: a.interestRate !== null ? Number(a.interestRate) : null,
        delinquencyDays: a.delinquencyDays,
        maturityDate: a.maturityDate,
        cossecClassification: a.cossecClassification,
      })),
      lifecycleTimeline: member.lifecycleEvents.map((e) => ({
        id: e.id,
        eventType: e.eventType,
        severity: e.severity,
        metadata: (e.metadata as Record<string, unknown>) ?? {},
        createdAt: e.createdAt,
      })),
      nextBestActions,
      gaps,
    };
  }
}
