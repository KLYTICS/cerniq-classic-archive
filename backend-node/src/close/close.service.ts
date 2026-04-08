import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  CloseActivityKind,
  CloseCycleStatus,
  CloseTaskStatus,
  JournalEntryStatus,
  Prisma,
  type CloseTask,
  type CloseReconciliation,
} from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { TieOutService, type TieOutLine } from './tie-out.service';
import {
  FluxNarratorService,
  type FluxInputRow,
} from './flux-narrator.service';
import { ActivityService } from './activity.service';
import { evaluateMateriality } from './policy/materiality.policy';
import type { PostJournalEntryDto } from './dto/post-journal-entry.dto';
import type { UpdateTaskDto } from './dto/update-task.dto';

/**
 * Orchestrator for the Close Cockpit. Owns the lifecycle of a CloseCycle,
 * delegates math to TieOutService and FluxNarratorService, and writes the
 * results back to Postgres in audit-friendly transactions.
 */
@Injectable()
export class CloseService {
  private readonly logger = new Logger(CloseService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tieOut: TieOutService,
    private readonly flux: FluxNarratorService,
    private readonly activity: ActivityService,
  ) {}

  // ── Cycle lifecycle ────────────────────────────────────────────────

  async createCycle(
    orgId: string,
    periodYear: number,
    periodMonth: number,
    targetCloseAt?: Date,
  ) {
    // Materiality is computed once and frozen onto the row. We pull TTM
    // revenue and total assets from the org's existing data — for now we
    // pass zeros and let the policy default kick in; production wiring
    // would source these from the GL/ALM module.
    const policy = evaluateMateriality({ ttmRevenue: 0, totalAssets: 0 });

    try {
      const cycle = await this.prisma.$transaction(
        async (tx: Prisma.TransactionClient) => {
          const created = await tx.closeCycle.create({
            data: {
              organizationId: orgId,
              periodYear,
              periodMonth,
              status: CloseCycleStatus.OPEN,
              targetCloseAt,
              materialityAbs: new Prisma.Decimal(policy.thresholdAbs),
              materialityPct: policy.thresholdPct,
              tasks: { create: this.defaultTaskTemplate() },
            },
            include: { tasks: true },
          });
          await this.activity.record(tx, {
            cycleId: created.id,
            kind: CloseActivityKind.CYCLE_OPENED,
            summaryEn: `Cycle ${periodYear}-${String(periodMonth).padStart(2, '0')} opened`,
            summaryEs: `Ciclo ${periodYear}-${String(periodMonth).padStart(2, '0')} abierto`,
            payload: { periodYear, periodMonth },
          });
          return created;
        },
      );
      this.logger.log(
        `opened cycle ${cycle.id} for org=${orgId} ${periodYear}-${periodMonth}`,
      );
      return cycle;
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        throw new ConflictException(
          `Close cycle for ${periodYear}-${periodMonth} already exists`,
        );
      }
      throw err;
    }
  }

  async getCycle(cycleId: string) {
    const cycle = await this.prisma.closeCycle.findUnique({
      where: { id: cycleId },
      include: {
        tasks: { orderBy: { dueAt: 'asc' } },
        reconciliations: true,
        journalEntries: { orderBy: { reference: 'asc' } },
        fluxNarratives: { orderBy: { isMaterial: 'desc' } },
      },
    });
    if (!cycle) throw new NotFoundException(`Close cycle ${cycleId} not found`);
    return cycle;
  }

  async listCycles(orgId: string) {
    return this.prisma.closeCycle.findMany({
      where: { organizationId: orgId },
      orderBy: [{ periodYear: 'desc' }, { periodMonth: 'desc' }],
      include: {
        _count: {
          select: { tasks: true, reconciliations: true, journalEntries: true },
        },
      },
    });
  }

  async signOffCycle(cycleId: string, userId: string) {
    const cycle = await this.getCycle(cycleId);
    const openTasks = (cycle.tasks as CloseTask[]).filter(
      (t: CloseTask) => t.status !== 'DONE' && t.status !== 'WAIVED',
    );
    if (openTasks.length > 0) {
      throw new BadRequestException(
        `Cannot sign off — ${openTasks.length} task(s) still open. Resolve or waive them first.`,
      );
    }
    const openRecs = (cycle.reconciliations as CloseReconciliation[]).filter(
      (r: CloseReconciliation) =>
        r.status !== 'TIE' && r.status !== 'SIGNED_OFF',
    );
    if (openRecs.length > 0) {
      throw new BadRequestException(
        `Cannot sign off — ${openRecs.length} reconciliation(s) not in tie. Resolve exceptions first.`,
      );
    }
    return this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const updated = await tx.closeCycle.update({
        where: { id: cycleId },
        data: {
          status: CloseCycleStatus.SIGNED_OFF,
          closedAt: new Date(),
          closedById: userId,
        },
      });
      await this.activity.record(tx, {
        cycleId,
        actorId: userId,
        kind: CloseActivityKind.CYCLE_SIGNED_OFF,
        summaryEn: `Cycle signed off by ${userId}`,
        summaryEs: `Ciclo aprobado por ${userId}`,
      });
      return updated;
    });
  }

  /**
   * Reopen a signed-off cycle. Requires a human-readable reason so the
   * reopen is traceable from the audit binder. This should be rare and
   * deliberate — the whole point of sign-off is immutability. When used
   * correctly, it's for "we found a bug in a JE that was posted before
   * sign-off", not for "we forgot to click something".
   */
  async reopenCycle(cycleId: string, reason: string, userId: string) {
    const trimmed = reason.trim();
    if (trimmed.length < 10) {
      throw new BadRequestException(
        'Reopen reason must be at least 10 characters so the audit binder has a real explanation.',
      );
    }
    const cycle = await this.prisma.closeCycle.findUnique({
      where: { id: cycleId },
    });
    if (!cycle) throw new NotFoundException(`Close cycle ${cycleId} not found`);
    if (cycle.status !== CloseCycleStatus.SIGNED_OFF) {
      throw new BadRequestException(
        `Cannot reopen a cycle that is not signed off. Current status: ${cycle.status}`,
      );
    }
    return this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const updated = await tx.closeCycle.update({
        where: { id: cycleId },
        data: {
          status: CloseCycleStatus.REOPENED,
          // Leave closedAt/closedById in place as historical markers — the
          // activity row is the canonical "reopened" timestamp.
        },
      });
      await this.activity.record(tx, {
        cycleId,
        actorId: userId,
        kind: CloseActivityKind.CYCLE_REOPENED,
        summaryEn: `Cycle reopened: ${trimmed}`,
        summaryEs: `Ciclo reabierto: ${trimmed}`,
        payload: { reason: trimmed, prevStatus: CloseCycleStatus.SIGNED_OFF },
      });
      return updated;
    });
  }

  // ── Tasks ──────────────────────────────────────────────────────────

  /**
   * Updates a single CloseTask. When the new status is DONE or WAIVED, we
   * also cascade-unblock any downstream tasks that were BLOCKED only because
   * of THIS task — they reopen as PENDING. This is the controller's killer
   * feature: she completes the bank rec, the AP tie reverts from BLOCKED to
   * PENDING automatically, and Jose gets a fresh task in his queue without
   * a Slack message.
   */
  async updateTask(
    cycleId: string,
    taskId: string,
    dto: UpdateTaskDto,
    userId: string,
  ) {
    const cycle = await this.assertCycleOpen(cycleId);

    return this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const existing = await tx.closeTask.findFirst({
        where: { id: taskId, cycleId: cycle.id },
      });
      if (!existing) {
        throw new NotFoundException(
          `Task ${taskId} not found in cycle ${cycleId}`,
        );
      }

      const data: Prisma.CloseTaskUpdateInput = {};
      if (dto.status !== undefined) data.status = dto.status;
      if (dto.ownerId !== undefined) data.ownerId = dto.ownerId;
      if (dto.dueAt !== undefined) data.dueAt = new Date(dto.dueAt);
      if (dto.evidenceUrls !== undefined) data.evidenceUrls = dto.evidenceUrls;

      // Mark completion metadata when transitioning into a terminal state.
      const isTerminating =
        dto.status === CloseTaskStatus.DONE ||
        dto.status === CloseTaskStatus.WAIVED;
      if (isTerminating) {
        data.completedAt = new Date();
        data.completedById = userId;
      }

      const updated = await tx.closeTask.update({
        where: { id: taskId },
        data,
      });

      // Record the primary activity (completed, waived, or generic updated).
      const activityKind =
        dto.status === CloseTaskStatus.DONE
          ? CloseActivityKind.TASK_COMPLETED
          : dto.status === CloseTaskStatus.WAIVED
            ? CloseActivityKind.TASK_WAIVED
            : CloseActivityKind.TASK_UPDATED;
      const verbEn =
        dto.status === CloseTaskStatus.DONE
          ? 'completed'
          : dto.status === CloseTaskStatus.WAIVED
            ? 'waived'
            : 'updated';
      const verbEs =
        dto.status === CloseTaskStatus.DONE
          ? 'completó'
          : dto.status === CloseTaskStatus.WAIVED
            ? 'renunció'
            : 'actualizó';
      await this.activity.record(tx, {
        cycleId: cycle.id,
        actorId: userId,
        kind: activityKind,
        summaryEn: `Task "${existing.titleEn}" ${verbEn}`,
        summaryEs: `Tarea "${existing.titleEs}" ${verbEs}`,
        payload: { taskId, kind: existing.kind },
      });

      // Cascade: if this task just terminated, look for tasks that were
      // BLOCKED with this task in their blockedByIds. If ALL of their blockers
      // are now done/waived, reopen them to PENDING.
      const cascadedTaskIds: string[] = [];
      if (isTerminating) {
        const downstream = await tx.closeTask.findMany({
          where: {
            cycleId: cycle.id,
            status: CloseTaskStatus.BLOCKED,
            blockedByIds: { has: taskId },
          },
        });

        const allTasks = await tx.closeTask.findMany({
          where: { cycleId: cycle.id },
          select: { id: true, status: true },
        });
        const statusById = new Map(allTasks.map((t) => [t.id, t.status]));

        for (const blocked of downstream) {
          const stillBlocked = blocked.blockedByIds.some((id: string) => {
            const s = statusById.get(id);
            return s !== CloseTaskStatus.DONE && s !== CloseTaskStatus.WAIVED;
          });
          if (!stillBlocked) {
            await tx.closeTask.update({
              where: { id: blocked.id },
              data: { status: CloseTaskStatus.PENDING },
            });
            cascadedTaskIds.push(blocked.id);
            await this.activity.record(tx, {
              cycleId: cycle.id,
              actorId: userId,
              kind: CloseActivityKind.TASK_CASCADED_UNBLOCK,
              summaryEn: `Auto-unblocked "${blocked.titleEn}" after "${existing.titleEn}"`,
              summaryEs: `Desbloqueo automático de "${blocked.titleEs}" tras "${existing.titleEs}"`,
              payload: { taskId: blocked.id, unblockedBy: taskId },
            });
          }
        }
      }

      return { task: updated, cascadedTaskIds };
    });
  }

  // ── Tie-out engine ─────────────────────────────────────────────────

  async runTieOut(
    cycleId: string,
    account: string,
    reconType: any,
    glBalance: number,
    externalBalance: number,
    lines: TieOutLine[],
    userId: string = 'system',
  ) {
    await this.assertCycleOpen(cycleId);
    const result = this.tieOut.run(glBalance, externalBalance, lines);

    return this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const rec = await tx.closeReconciliation.create({
        data: {
          cycleId,
          account,
          reconType,
          glBalance: new Prisma.Decimal(result.glBalance),
          externalBalance: new Prisma.Decimal(result.externalBalance),
          difference: new Prisma.Decimal(result.difference),
          unmatchedItems: result.unmatched as unknown as Prisma.InputJsonValue,
          status: result.status,
        },
      });
      await this.activity.record(tx, {
        cycleId,
        actorId: userId,
        kind: CloseActivityKind.TIE_OUT_RUN,
        summaryEn: `Tie-out ${account}: ${result.status} (Δ ${result.difference.toFixed(2)})`,
        summaryEs: `Conciliación ${account}: ${result.status} (Δ ${result.difference.toFixed(2)})`,
        payload: {
          reconId: rec.id,
          account,
          status: result.status,
          difference: result.difference,
        },
      });
      return rec;
    });
  }

  // ── Journal entries ────────────────────────────────────────────────

  async postJournalEntry(
    cycleId: string,
    dto: PostJournalEntryDto,
    userId: string,
  ) {
    await this.assertCycleOpen(cycleId);
    const totalDebit = +dto.lines.reduce((s, l) => s + l.debit, 0).toFixed(2);
    const totalCredit = +dto.lines.reduce((s, l) => s + l.credit, 0).toFixed(2);
    if (Math.abs(totalDebit - totalCredit) > 0.01) {
      throw new BadRequestException(
        `Journal entry not balanced: debit ${totalDebit} vs credit ${totalCredit}`,
      );
    }
    return this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const je = await tx.closeJournalEntry.create({
        data: {
          cycleId,
          reference: dto.reference,
          memoEn: dto.memoEn,
          memoEs: dto.memoEs,
          lines: dto.lines as unknown as Prisma.InputJsonValue,
          totalDebit: new Prisma.Decimal(totalDebit),
          totalCredit: new Prisma.Decimal(totalCredit),
          status: JournalEntryStatus.POSTED,
          postedAt: new Date(),
          postedById: userId,
          evidenceUrls: dto.evidenceUrls ?? [],
        },
      });
      await this.activity.record(tx, {
        cycleId,
        actorId: userId,
        kind: CloseActivityKind.JE_POSTED,
        summaryEn: `JE ${dto.reference} posted (${fmtUsd(totalDebit)})`,
        summaryEs: `Asiento ${dto.reference} registrado (${fmtUsd(totalDebit)})`,
        payload: { jeId: je.id, reference: dto.reference, totalDebit },
      });
      return je;
    });
  }

  /**
   * Reverse a previously-posted journal entry. Real ledgers never edit
   * posted entries — they post a reversal that nets to zero. We mirror
   * that pattern: fetch the original, swap debits and credits on every
   * line, post a new JE with `reversesJeId` linking back, and flip the
   * original's status to REVERSED.
   *
   * Requires a ≥10 char reason so the audit binder has context. Same
   * pattern as cycle reopen — destructive-action friction by design.
   */
  async reverseJournalEntry(
    cycleId: string,
    jeId: string,
    reason: string,
    userId: string,
  ) {
    const trimmed = reason.trim();
    if (trimmed.length < 10) {
      throw new BadRequestException(
        'Reverse reason must be at least 10 characters so the audit binder has a real explanation.',
      );
    }
    await this.assertCycleOpen(cycleId);

    return this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const original = (await tx.closeJournalEntry.findFirst({
        where: { id: jeId, cycleId },
      })) as {
        id: string;
        reference: string;
        memoEn: string;
        memoEs: string;
        lines: unknown;
        totalDebit: Prisma.Decimal;
        totalCredit: Prisma.Decimal;
        status: string;
        reversesJeId: string | null;
      } | null;

      if (!original) {
        throw new NotFoundException(
          `Journal entry ${jeId} not found in cycle ${cycleId}`,
        );
      }
      if (original.status !== 'POSTED') {
        throw new BadRequestException(
          `Cannot reverse a JE that is not POSTED. Current status: ${original.status}`,
        );
      }
      if (original.reversesJeId) {
        throw new BadRequestException(
          'Cannot reverse a JE that is itself a reversal — post a new entry if you need to undo a reversal.',
        );
      }

      // Swap debit ↔ credit on every line.
      const originalLines = Array.isArray(original.lines)
        ? (original.lines as Array<{
            account?: string;
            debit?: number;
            credit?: number;
            dimension?: string;
          }>)
        : [];
      const reversedLines = originalLines.map((line) => ({
        account: line.account ?? '',
        debit: line.credit ?? 0,
        credit: line.debit ?? 0,
        dimension: line.dimension,
      }));

      const reversalReference = `${original.reference}-R`;

      const reversalJe = await tx.closeJournalEntry.create({
        data: {
          cycleId,
          reference: reversalReference,
          memoEn: `Reversal of ${original.reference}: ${trimmed}`,
          memoEs: `Reverso de ${original.reference}: ${trimmed}`,
          lines: reversedLines as unknown as Prisma.InputJsonValue,
          // Totals match — the reversal is the same magnitude on the
          // opposite side, so the cached aggregate stays equal.
          totalDebit: new Prisma.Decimal(original.totalCredit),
          totalCredit: new Prisma.Decimal(original.totalDebit),
          status: JournalEntryStatus.POSTED,
          postedAt: new Date(),
          postedById: userId,
          evidenceUrls: [],
          reversesJeId: original.id,
        },
      });

      // Flip the original to REVERSED so the JE list can render the pair
      // distinctly without an N+1 lookup on `reversedBy`.
      await tx.closeJournalEntry.update({
        where: { id: original.id },
        data: { status: JournalEntryStatus.REVERSED },
      });

      await this.activity.record(tx, {
        cycleId,
        actorId: userId,
        kind: CloseActivityKind.JE_REVERSED,
        summaryEn: `Reversed JE ${original.reference} → ${reversalReference}: ${trimmed}`,
        summaryEs: `Asiento ${original.reference} reversado → ${reversalReference}: ${trimmed}`,
        payload: {
          originalJeId: original.id,
          reversalJeId: reversalJe.id,
          originalReference: original.reference,
          reversalReference,
          reason: trimmed,
        },
      });

      return { reversalJe, originalReference: original.reference };
    });
  }

  // ── Flux narrative ─────────────────────────────────────────────────

  async runFlux(
    cycleId: string,
    rows: FluxInputRow[],
    userId: string = 'system',
  ) {
    const cycle = await this.assertCycleOpen(cycleId);
    const policy = {
      thresholdAbs: Number(cycle.materialityAbs),
      thresholdPct: cycle.materialityPct,
      rationaleEn: '',
      rationaleEs: '',
    };
    const narrated = this.flux.narrate(rows, policy);
    const materialCount = narrated.filter((n) => n.isMaterial).length;

    // Replace previous narratives for this cycle so re-runs don't pile up.
    return this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      await tx.closeFluxNarrative.deleteMany({ where: { cycleId } });
      await tx.closeFluxNarrative.createMany({
        data: narrated.map((n) => ({
          cycleId,
          account: n.account,
          priorBalance: new Prisma.Decimal(n.priorBalance),
          currentBalance: new Prisma.Decimal(n.currentBalance),
          varianceAbs: new Prisma.Decimal(n.varianceAbs),
          variancePct: n.variancePct,
          isMaterial: n.isMaterial,
          narrativeEn: n.narrativeEn,
          narrativeEs: n.narrativeEs,
          confidence: n.confidence,
        })),
      });
      await this.activity.record(tx, {
        cycleId,
        actorId: userId,
        kind: CloseActivityKind.FLUX_REFRESHED,
        summaryEn: `Flux refreshed — ${narrated.length} accounts, ${materialCount} material`,
        summaryEs: `Flujo recalculado — ${narrated.length} cuentas, ${materialCount} materiales`,
        payload: { total: narrated.length, material: materialCount },
      });
      return tx.closeFluxNarrative.findMany({
        where: { cycleId },
        orderBy: [{ isMaterial: 'desc' }, { account: 'asc' }],
      });
    });
  }

  // ── Reconciliations (review action) ────────────────────────────────

  /**
   * Mark a reconciliation as REVIEWED with optional notes. Used from the
   * recon exception drawer when the controller has investigated the
   * variance and decided it's acceptable (common for immaterial timing
   * differences) without posting a correcting JE.
   *
   * Any EXCEPTION / OPEN recon can be transitioned; signed-off or
   * already-reviewed recs are idempotent no-ops that return the row.
   */
  async reviewReconciliation(
    cycleId: string,
    reconId: string,
    notes: string | undefined,
    userId: string,
  ) {
    await this.assertCycleOpen(cycleId);

    return this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const existing = await tx.closeReconciliation.findFirst({
        where: { id: reconId, cycleId },
      });
      if (!existing) {
        throw new NotFoundException(
          `Reconciliation ${reconId} not found in cycle ${cycleId}`,
        );
      }

      const updated = await tx.closeReconciliation.update({
        where: { id: reconId },
        data: {
          status: 'REVIEWED',
          reviewedById: userId,
          // unmatchedItems stays intact — we don't wipe history on review.
        },
      });

      await this.activity.record(tx, {
        cycleId,
        actorId: userId,
        kind: CloseActivityKind.RECON_REVIEWED,
        summaryEn: `Reconciliation ${existing.account} marked reviewed${notes ? ': ' + notes : ''}`,
        summaryEs: `Conciliación ${existing.account} marcada como revisada${notes ? ': ' + notes : ''}`,
        payload: { reconId, account: existing.account, notes: notes ?? null },
      });

      return updated;
    });
  }

  // ── Activity feed ──────────────────────────────────────────────────

  async listActivity(cycleId: string, limit = 50) {
    // PrismaService extends a require()'d PrismaClient, so the activity
    // delegate isn't visible through the class type — cast to the narrow
    // shape ActivityService expects.
    return this.activity.list(
      this.prisma as unknown as {
        closeActivity: { findMany: (args: unknown) => Promise<unknown> };
      },
      cycleId,
      limit,
    );
  }

  // ── Helpers ────────────────────────────────────────────────────────

  private async assertCycleOpen(cycleId: string) {
    const cycle = await this.prisma.closeCycle.findUnique({
      where: { id: cycleId },
    });
    if (!cycle) throw new NotFoundException(`Close cycle ${cycleId} not found`);
    if (cycle.status === CloseCycleStatus.SIGNED_OFF) {
      throw new BadRequestException(
        `Close cycle ${cycleId} is signed off and locked`,
      );
    }
    return cycle;
  }

  /**
   * Default monthly task template — every cooperativa close needs roughly
   * the same skeleton. Owners and dates are filled in later by the user.
   */
  private defaultTaskTemplate() {
    return [
      {
        kind: 'cutoff_revenue',
        titleEn: 'Cut off revenue',
        titleEs: 'Cierre de ingresos',
      },
      {
        kind: 'cutoff_expense',
        titleEn: 'Cut off expenses',
        titleEs: 'Cierre de gastos',
      },
      {
        kind: 'bank_rec_operating',
        titleEn: 'Reconcile operating bank',
        titleEs: 'Conciliar banco operativo',
      },
      {
        kind: 'ap_subledger_tie',
        titleEn: 'Tie AP subledger to GL',
        titleEs: 'Conciliar mayor auxiliar AP con GL',
      },
      {
        kind: 'ar_subledger_tie',
        titleEn: 'Tie AR subledger to GL',
        titleEs: 'Conciliar mayor auxiliar AR con GL',
      },
      {
        kind: 'accruals',
        titleEn: 'Book accruals',
        titleEs: 'Registrar acumulados',
      },
      {
        kind: 'prepaids',
        titleEn: 'Amortize prepaids',
        titleEs: 'Amortizar pagos anticipados',
      },
      {
        kind: 'depreciation',
        titleEn: 'Run depreciation',
        titleEs: 'Calcular depreciación',
      },
      {
        kind: 'flux_review',
        titleEn: 'Review flux narrative',
        titleEs: 'Revisar narrativa de flujo',
      },
      {
        kind: 'controller_review',
        titleEn: 'Controller review',
        titleEs: 'Revisión del controlador',
      },
      {
        kind: 'cfo_signoff',
        titleEn: 'CFO sign-off',
        titleEs: 'Aprobación del CFO',
      },
    ];
  }
}

function fmtUsd(n: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(n);
}
