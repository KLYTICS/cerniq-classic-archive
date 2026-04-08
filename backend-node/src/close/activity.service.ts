import { Injectable, Logger } from '@nestjs/common';
import { CloseActivityKind, Prisma } from '@prisma/client';

/**
 * Activity writer for the Close Cockpit.
 *
 * Why it's a separate service: the write happens inside the same Prisma
 * transaction as the mutation it describes, so we need a function that
 * takes a `tx: Prisma.TransactionClient` rather than the root client. If
 * we baked this into CloseService it would be harder to test in isolation.
 *
 * Why the summary is denormalized: the activity strip in the UI renders
 * prose verbatim. Hand-writing the prose at write-time keeps the read
 * path cheap — no joins, no enum-to-sentence mapping in the frontend.
 */
@Injectable()
export class ActivityService {
  private readonly logger = new Logger(ActivityService.name);

  async record(
    tx: Prisma.TransactionClient,
    input: {
      cycleId: string;
      actorId?: string | null;
      kind: CloseActivityKind;
      summaryEn: string;
      summaryEs: string;
      payload?: Record<string, unknown>;
    },
  ) {
    return tx.closeActivity.create({
      data: {
        cycleId: input.cycleId,
        actorId: input.actorId ?? null,
        kind: input.kind,
        summaryEn: input.summaryEn,
        summaryEs: input.summaryEs,
        payload: (input.payload ?? {}) as unknown as Prisma.InputJsonValue,
      },
    });
  }

  /**
   * Lists the most recent activities for a cycle. Feeds the strip at the
   * top of the workspace and the binder's history section.
   *
   * Accepts a loose shape instead of `PrismaClient` because the repo's
   * PrismaService uses `require()` and therefore types as `any` — a strict
   * delegate type would fight with the service-level erasure.
   */
  async list(
    prisma: {
      closeActivity: { findMany: (args: unknown) => Promise<unknown> };
    },
    cycleId: string,
    limit = 50,
  ) {
    return prisma.closeActivity.findMany({
      where: { cycleId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }
}
