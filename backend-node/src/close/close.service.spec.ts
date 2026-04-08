import { CloseService } from './close.service';
import { TieOutService } from './tie-out.service';
import { FluxNarratorService } from './flux-narrator.service';
import { ActivityService } from './activity.service';
import { CloseTaskStatus, CloseCycleStatus } from '@prisma/client';

/**
 * CloseService — focused on the updateTask cascade logic, the trickiest
 * path in the orchestrator. The other methods are thin wrappers around
 * Prisma calls and would only test the mocks.
 *
 * The cascade rule: when a task transitions to DONE/WAIVED, find every
 * downstream task that was BLOCKED only because of THIS task and reopen
 * them to PENDING. This is the "knows how I work" feature for controllers.
 */

describe('CloseService.updateTask cascade', () => {
  let svc: CloseService;
  let mockPrisma: any;
  let txCalls: any[];
  let activityCalls: any[];

  beforeEach(() => {
    txCalls = [];
    activityCalls = [];
    // Build a fake transaction client. Tests inject the task graph via
    // findFirst/findMany returns. We capture every update so we can assert
    // exactly which downstream tasks got cascaded.
    const buildTx = (graph: Map<string, any>) => ({
      closeTask: {
        findFirst: jest.fn(({ where }: any) => {
          const row = graph.get(where.id);
          if (!row) return Promise.resolve(null);
          // Return enough fields for the cascade log messages. Seed populates
          // titleEn/titleEs with the id when not explicit.
          return Promise.resolve({
            titleEn: `Title-${row.id}`,
            titleEs: `Título-${row.id}`,
            kind: `kind-${row.id}`,
            ...row,
          });
        }),
        update: jest.fn(({ where, data }: any) => {
          const existing = graph.get(where.id);
          const updated = { ...existing, ...data };
          graph.set(where.id, updated);
          txCalls.push({ id: where.id, data });
          return Promise.resolve(updated);
        }),
        findMany: jest.fn(({ where, select }: any) => {
          let rows = Array.from(graph.values()).map((r) => ({
            titleEn: `Title-${r.id}`,
            titleEs: `Título-${r.id}`,
            ...r,
          }));
          if (where?.status) {
            rows = rows.filter((r) => r.status === where.status);
          }
          if (where?.blockedByIds?.has) {
            rows = rows.filter((r) =>
              r.blockedByIds.includes(where.blockedByIds.has),
            );
          }
          if (select) {
            return Promise.resolve(
              rows.map((r) =>
                Object.fromEntries(Object.keys(select).map((k) => [k, r[k]])),
              ),
            );
          }
          return Promise.resolve(rows);
        }),
      },
      closeActivity: {
        create: jest.fn(({ data }: any) => {
          activityCalls.push(data);
          return Promise.resolve({
            id: `act-${activityCalls.length}`,
            ...data,
          });
        }),
      },
    });

    mockPrisma = {
      closeCycle: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ id: 'cycle-1', status: CloseCycleStatus.OPEN }),
      },
      $transaction: jest.fn(async (fn: any) => {
        // The graph is stored on the mockPrisma so each test seeds it.
        return fn(buildTx(mockPrisma._graph));
      }),
      _graph: new Map<string, any>(),
    };

    svc = new CloseService(
      mockPrisma,
      new TieOutService(),
      new FluxNarratorService(),
      new ActivityService(),
    );
  });

  function seed(
    tasks: Array<{
      id: string;
      status: CloseTaskStatus;
      blockedByIds?: string[];
    }>,
  ) {
    mockPrisma._graph = new Map(
      tasks.map((t) => [
        t.id,
        {
          id: t.id,
          cycleId: 'cycle-1',
          status: t.status,
          blockedByIds: t.blockedByIds ?? [],
          completedAt: null,
        },
      ]),
    );
  }

  it('marks a task DONE and cascades unblocking when no other blockers remain', async () => {
    seed([
      { id: 't1', status: CloseTaskStatus.IN_PROGRESS },
      { id: 't2', status: CloseTaskStatus.BLOCKED, blockedByIds: ['t1'] },
    ]);

    const result = await svc.updateTask(
      'cycle-1',
      't1',
      { status: CloseTaskStatus.DONE },
      'user-1',
    );

    expect(result.task.id).toBe('t1');
    expect(result.task.status).toBe(CloseTaskStatus.DONE);
    expect(result.cascadedTaskIds).toEqual(['t2']);
    // The cascaded task should also have been written to PENDING.
    const t2Update = txCalls.find((c) => c.id === 't2');
    expect(t2Update?.data.status).toBe(CloseTaskStatus.PENDING);
    // Two activity rows must have been written in the same transaction:
    // one TASK_COMPLETED for t1, one TASK_CASCADED_UNBLOCK for t2.
    expect(activityCalls).toHaveLength(2);
    expect(activityCalls[0].kind).toBe('TASK_COMPLETED');
    expect(activityCalls[1].kind).toBe('TASK_CASCADED_UNBLOCK');
    expect(activityCalls[1].payload.unblockedBy).toBe('t1');
  });

  it('does NOT cascade when other blockers are still open', async () => {
    seed([
      { id: 't1', status: CloseTaskStatus.IN_PROGRESS },
      { id: 't2', status: CloseTaskStatus.PENDING },
      { id: 't3', status: CloseTaskStatus.BLOCKED, blockedByIds: ['t1', 't2'] },
    ]);

    const result = await svc.updateTask(
      'cycle-1',
      't1',
      { status: CloseTaskStatus.DONE },
      'user-1',
    );

    expect(result.task.status).toBe(CloseTaskStatus.DONE);
    expect(result.cascadedTaskIds).toEqual([]);
    // t3 should NOT have been touched.
    expect(txCalls.find((c) => c.id === 't3')).toBeUndefined();
  });

  it('cascades when WAIVING a blocker (waive is a terminal status)', async () => {
    seed([
      { id: 't1', status: CloseTaskStatus.PENDING },
      { id: 't2', status: CloseTaskStatus.BLOCKED, blockedByIds: ['t1'] },
    ]);

    const result = await svc.updateTask(
      'cycle-1',
      't1',
      { status: CloseTaskStatus.WAIVED },
      'user-1',
    );

    expect(result.cascadedTaskIds).toEqual(['t2']);
  });

  it('does NOT cascade for non-terminal status changes', async () => {
    seed([
      { id: 't1', status: CloseTaskStatus.PENDING },
      { id: 't2', status: CloseTaskStatus.BLOCKED, blockedByIds: ['t1'] },
    ]);

    const result = await svc.updateTask(
      'cycle-1',
      't1',
      { status: CloseTaskStatus.IN_PROGRESS },
      'user-1',
    );

    expect(result.cascadedTaskIds).toEqual([]);
  });

  it('records completedAt and completedById on terminal transition', async () => {
    seed([{ id: 't1', status: CloseTaskStatus.PENDING }]);

    await svc.updateTask(
      'cycle-1',
      't1',
      { status: CloseTaskStatus.DONE },
      'user-erwin',
    );

    const t1 = txCalls.find((c) => c.id === 't1');
    expect(t1?.data.completedAt).toBeInstanceOf(Date);
    expect(t1?.data.completedById).toBe('user-erwin');
  });

  it('handles partial updates without status (owner only)', async () => {
    seed([{ id: 't1', status: CloseTaskStatus.PENDING }]);

    const result = await svc.updateTask(
      'cycle-1',
      't1',
      { ownerId: 'maria' },
      'user-1',
    );

    const t1 = txCalls.find((c) => c.id === 't1');
    expect(t1?.data.ownerId).toBe('maria');
    expect(t1?.data.completedAt).toBeUndefined();
    expect(result.cascadedTaskIds).toEqual([]);
  });
});

/**
 * CloseService.reopenCycle — the reverse of sign-off. Rare and deliberate;
 * requires a human-readable reason so the audit trail has context.
 */
describe('CloseService.reopenCycle', () => {
  let svc: CloseService;
  let mockPrisma: any;
  let cycleUpdates: any[];
  let activityCalls: any[];

  function makeSvc(cycleStatus: CloseCycleStatus) {
    cycleUpdates = [];
    activityCalls = [];
    mockPrisma = {
      closeCycle: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ id: 'cycle-1', status: cycleStatus }),
      },
      $transaction: jest.fn(async (fn: any) => {
        return fn({
          closeCycle: {
            update: jest.fn(({ where, data }: any) => {
              const updated = { id: where.id, ...data };
              cycleUpdates.push({ where, data });
              return Promise.resolve(updated);
            }),
          },
          closeActivity: {
            create: jest.fn(({ data }: any) => {
              activityCalls.push(data);
              return Promise.resolve({
                id: `act-${activityCalls.length}`,
                ...data,
              });
            }),
          },
        });
      }),
    };
    svc = new CloseService(
      mockPrisma,
      new TieOutService(),
      new FluxNarratorService(),
      new ActivityService(),
    );
  }

  it('rejects short reasons (<10 chars)', async () => {
    makeSvc(CloseCycleStatus.SIGNED_OFF);
    await expect(svc.reopenCycle('cycle-1', 'oops', 'user-1')).rejects.toThrow(
      /at least 10 characters/i,
    );
    expect(cycleUpdates).toHaveLength(0);
    expect(activityCalls).toHaveLength(0);
  });

  it('rejects reopen when cycle is not SIGNED_OFF', async () => {
    makeSvc(CloseCycleStatus.OPEN);
    await expect(
      svc.reopenCycle('cycle-1', 'Bug in bank rec — must correct', 'user-1'),
    ).rejects.toThrow(/not signed off/i);
    expect(cycleUpdates).toHaveLength(0);
  });

  it('transitions SIGNED_OFF → REOPENED and writes activity with the reason', async () => {
    makeSvc(CloseCycleStatus.SIGNED_OFF);
    const reason =
      'AP accrual posted to wrong account — correcting per CFO approval';
    const result = await svc.reopenCycle('cycle-1', reason, 'user-erwin');

    expect(result.status).toBe(CloseCycleStatus.REOPENED);
    expect(cycleUpdates).toHaveLength(1);
    expect(cycleUpdates[0].data.status).toBe(CloseCycleStatus.REOPENED);
    expect(activityCalls).toHaveLength(1);
    expect(activityCalls[0].kind).toBe('CYCLE_REOPENED');
    expect(activityCalls[0].actorId).toBe('user-erwin');
    expect(activityCalls[0].payload.reason).toBe(reason);
  });

  it('trims the reason before storing it', async () => {
    makeSvc(CloseCycleStatus.SIGNED_OFF);
    await svc.reopenCycle(
      'cycle-1',
      '   Plenty of reason text here   ',
      'user-1',
    );
    expect(activityCalls[0].payload.reason).toBe('Plenty of reason text here');
  });

  it('rejects whitespace-only reasons', async () => {
    makeSvc(CloseCycleStatus.SIGNED_OFF);
    await expect(
      svc.reopenCycle('cycle-1', '                    ', 'user-1'),
    ).rejects.toThrow(/at least 10 characters/i);
  });
});

/**
 * CloseService.reviewReconciliation — controller's "I investigated this
 * variance and it's fine" action. Mark recon REVIEWED + log activity.
 */
describe('CloseService.reviewReconciliation', () => {
  let svc: CloseService;
  let mockPrisma: any;
  let updates: any[];
  let activityCalls: any[];

  beforeEach(() => {
    updates = [];
    activityCalls = [];
    mockPrisma = {
      closeCycle: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ id: 'cycle-1', status: CloseCycleStatus.OPEN }),
      },
      $transaction: jest.fn(async (fn: any) => {
        return fn({
          closeReconciliation: {
            findFirst: jest.fn(({ where }: any) => {
              if (where.id === 'rec-missing') return Promise.resolve(null);
              return Promise.resolve({
                id: where.id,
                cycleId: 'cycle-1',
                account: '1010 Operating Cash',
                status: 'EXCEPTION',
              });
            }),
            update: jest.fn(({ where, data }: any) => {
              updates.push({ where, data });
              return Promise.resolve({ id: where.id, ...data });
            }),
          },
          closeActivity: {
            create: jest.fn(({ data }: any) => {
              activityCalls.push(data);
              return Promise.resolve({
                id: `act-${activityCalls.length}`,
                ...data,
              });
            }),
          },
        });
      }),
    };
    svc = new CloseService(
      mockPrisma,
      new TieOutService(),
      new FluxNarratorService(),
      new ActivityService(),
    );
  });

  it('transitions the recon to REVIEWED + writes a RECON_REVIEWED activity', async () => {
    const result = await svc.reviewReconciliation(
      'cycle-1',
      'rec-1',
      'Timing diff — vendor cleared next day',
      'user-erwin',
    );

    expect(result.status).toBe('REVIEWED');
    expect(updates).toHaveLength(1);
    expect(updates[0].data.status).toBe('REVIEWED');
    expect(updates[0].data.reviewedById).toBe('user-erwin');
    expect(activityCalls).toHaveLength(1);
    expect(activityCalls[0].kind).toBe('RECON_REVIEWED');
    expect(activityCalls[0].payload.notes).toBe(
      'Timing diff — vendor cleared next day',
    );
    expect(activityCalls[0].payload.account).toBe('1010 Operating Cash');
  });

  it('throws when the recon does not belong to the cycle', async () => {
    await expect(
      svc.reviewReconciliation(
        'cycle-1',
        'rec-missing',
        'investigated',
        'user-1',
      ),
    ).rejects.toThrow(/not found/i);
    expect(updates).toHaveLength(0);
  });

  it('handles the no-notes case (notes optional)', async () => {
    await svc.reviewReconciliation('cycle-1', 'rec-1', undefined, 'user-1');
    expect(activityCalls[0].payload.notes).toBeNull();
  });
});
