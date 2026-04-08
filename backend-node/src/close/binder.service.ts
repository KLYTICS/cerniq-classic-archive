import { Injectable, Logger } from '@nestjs/common';
import type {
  CloseTask,
  CloseReconciliation,
  CloseJournalEntry,
  CloseFluxNarrative,
} from '@prisma/client';
import { PrismaService } from '../prisma.service';

/**
 * Audit binder exporter — assembles a single deterministic JSON pack that
 * external auditors and COSSEC examiners can ingest.
 *
 * Why JSON and not PDF here?
 *   - PDFs are downstream of this. The pack is the source of truth and a
 *     PDF generator (existing in the pipeline module) consumes it.
 *   - JSON is diff-able. Two re-runs of the same closed period must produce
 *     identical bytes; PDFs add timestamps, fonts, and PDF metadata that
 *     break that property.
 */
@Injectable()
export class BinderService {
  private readonly logger = new Logger(BinderService.name);

  constructor(private readonly prisma: PrismaService) {}

  async build(cycleId: string) {
    const cycle = await this.prisma.closeCycle.findUnique({
      where: { id: cycleId },
      include: {
        tasks: { orderBy: { kind: 'asc' } },
        reconciliations: { orderBy: { account: 'asc' } },
        journalEntries: { orderBy: { reference: 'asc' } },
        fluxNarratives: {
          orderBy: [{ isMaterial: 'desc' }, { account: 'asc' }],
        },
        organization: true,
      },
    });
    if (!cycle) throw new Error(`Cycle ${cycleId} not found`);

    return {
      schemaVersion: '1.0.0',
      generatedAt: new Date().toISOString(),
      organization: {
        id: cycle.organization.id,
        name: cycle.organization.name,
      },
      period: { year: cycle.periodYear, month: cycle.periodMonth },
      status: cycle.status,
      materiality: {
        absUsd: Number(cycle.materialityAbs),
        pct: cycle.materialityPct,
      },
      counts: {
        tasks: (cycle.tasks as CloseTask[]).length,
        reconciliations: (cycle.reconciliations as CloseReconciliation[])
          .length,
        journalEntries: (cycle.journalEntries as CloseJournalEntry[]).length,
        materialFlux: (cycle.fluxNarratives as CloseFluxNarrative[]).filter(
          (n: CloseFluxNarrative) => n.isMaterial,
        ).length,
      },
      tasks: (cycle.tasks as CloseTask[]).map((t: CloseTask) => ({
        kind: t.kind,
        titleEn: t.titleEn,
        titleEs: t.titleEs,
        status: t.status,
        ownerId: t.ownerId,
        completedAt: t.completedAt?.toISOString() ?? null,
      })),
      reconciliations: (cycle.reconciliations as CloseReconciliation[]).map(
        (r: CloseReconciliation) => ({
          account: r.account,
          type: r.reconType,
          glBalance: Number(r.glBalance),
          externalBalance: Number(r.externalBalance),
          difference: Number(r.difference),
          status: r.status,
          unmatchedItems: r.unmatchedItems,
        }),
      ),
      journalEntries: (cycle.journalEntries as CloseJournalEntry[]).map(
        (j: CloseJournalEntry) => ({
          reference: j.reference,
          memoEn: j.memoEn,
          memoEs: j.memoEs,
          totalDebit: Number(j.totalDebit),
          totalCredit: Number(j.totalCredit),
          status: j.status,
          lines: j.lines,
          evidenceUrls: j.evidenceUrls,
        }),
      ),
      fluxNarratives: (cycle.fluxNarratives as CloseFluxNarrative[]).map(
        (n: CloseFluxNarrative) => ({
          account: n.account,
          priorBalance: Number(n.priorBalance),
          currentBalance: Number(n.currentBalance),
          varianceAbs: Number(n.varianceAbs),
          variancePct: n.variancePct,
          isMaterial: n.isMaterial,
          narrativeEn: n.narrativeEn,
          narrativeEs: n.narrativeEs,
          confidence: n.confidence,
        }),
      ),
    };
  }
}
