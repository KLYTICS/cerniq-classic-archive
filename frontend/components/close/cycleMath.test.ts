import { describe, it, expect } from 'vitest';
import { computePulse } from './cycleMath';
import type { CloseCycleDetail } from '@/lib/close-api';

/**
 * Pure-function tests for the daily-pulse math. The whole point of
 * extracting these is that we can pin time without faking timers.
 */

function makeCycle(overrides: Partial<CloseCycleDetail> = {}): CloseCycleDetail {
  return {
    id: 'c1',
    organizationId: 'org-1',
    periodYear: 2026,
    periodMonth: 4,
    status: 'OPEN',
    openedAt: '2026-04-01T08:00:00Z',
    targetCloseAt: '2026-04-08T08:00:00Z',
    closedAt: null,
    materialityAbs: 5000,
    materialityPct: 0.05,
    tasks: [],
    reconciliations: [],
    journalEntries: [],
    fluxNarratives: [],
    ...overrides,
  };
}

describe('computePulse', () => {
  it('reports day 1 on the day a cycle opens', () => {
    const pulse = computePulse(makeCycle(), new Date('2026-04-01T20:00:00Z'));
    expect(pulse.dayNumber).toBe(1);
  });

  it('counts day numbers correctly through the cycle', () => {
    const pulse = computePulse(makeCycle(), new Date('2026-04-05T20:00:00Z'));
    expect(pulse.dayNumber).toBe(5);
  });

  it('reports days remaining when on track', () => {
    const pulse = computePulse(makeCycle(), new Date('2026-04-05T20:00:00Z'));
    expect(pulse.daysRemaining).toBe(3);
  });

  it('reports negative days remaining when overdue', () => {
    const pulse = computePulse(makeCycle(), new Date('2026-04-10T20:00:00Z'));
    expect(pulse.daysRemaining).toBe(-2);
  });

  it('handles a cycle with no target date', () => {
    const pulse = computePulse(makeCycle({ targetCloseAt: null }), new Date('2026-04-05T20:00:00Z'));
    expect(pulse.targetDays).toBeNull();
    expect(pulse.daysRemaining).toBeNull();
  });

  it('counts done and open tasks correctly', () => {
    const pulse = computePulse(
      makeCycle({
        tasks: [
          { id: '1', kind: 'a', titleEn: 'A', titleEs: 'A', ownerId: null, dueAt: null, status: 'DONE', blockedByIds: [], evidenceUrls: [], completedAt: null },
          { id: '2', kind: 'b', titleEn: 'B', titleEs: 'B', ownerId: null, dueAt: null, status: 'WAIVED', blockedByIds: [], evidenceUrls: [], completedAt: null },
          { id: '3', kind: 'c', titleEn: 'C', titleEs: 'C', ownerId: null, dueAt: null, status: 'PENDING', blockedByIds: [], evidenceUrls: [], completedAt: null },
          { id: '4', kind: 'd', titleEn: 'D', titleEs: 'D', ownerId: null, dueAt: null, status: 'BLOCKED', blockedByIds: [], evidenceUrls: [], completedAt: null },
        ],
      }),
    );
    expect(pulse.tasksDone).toBe(2);
    expect(pulse.tasksOpen).toBe(2);
    expect(pulse.tasksBlocked).toBe(1);
    expect(pulse.percentDone).toBeCloseTo(0.5, 2);
  });

  it('reports recon exceptions only for non-tied/non-reviewed states', () => {
    const pulse = computePulse(
      makeCycle({
        reconciliations: [
          { id: '1', account: 'a', reconType: 'BANK', glBalance: 0, externalBalance: 0, difference: 0, unmatchedItems: [], status: 'TIE' },
          { id: '2', account: 'b', reconType: 'BANK', glBalance: 0, externalBalance: 0, difference: 100, unmatchedItems: [], status: 'EXCEPTION' },
          { id: '3', account: 'c', reconType: 'BANK', glBalance: 0, externalBalance: 0, difference: 0, unmatchedItems: [], status: 'REVIEWED' },
        ],
      }),
    );
    expect(pulse.reconExceptions).toBe(1);
  });

  it('counts material flux only', () => {
    const pulse = computePulse(
      makeCycle({
        fluxNarratives: [
          { id: '1', account: 'a', priorBalance: 0, currentBalance: 0, varianceAbs: 0, variancePct: 0, isMaterial: true, narrativeEn: '', narrativeEs: '', confidence: 1 },
          { id: '2', account: 'b', priorBalance: 0, currentBalance: 0, varianceAbs: 0, variancePct: 0, isMaterial: false, narrativeEn: '', narrativeEs: '', confidence: 1 },
          { id: '3', account: 'c', priorBalance: 0, currentBalance: 0, varianceAbs: 0, variancePct: 0, isMaterial: true, narrativeEn: '', narrativeEs: '', confidence: 1 },
        ],
      }),
    );
    expect(pulse.materialFlux).toBe(2);
  });

  it('signOffReady is true when all tasks done and no recon exceptions', () => {
    const pulse = computePulse(
      makeCycle({
        tasks: [
          { id: '1', kind: 'a', titleEn: '', titleEs: '', ownerId: null, dueAt: null, status: 'DONE', blockedByIds: [], evidenceUrls: [], completedAt: null },
        ],
        reconciliations: [
          { id: '1', account: 'a', reconType: 'BANK', glBalance: 0, externalBalance: 0, difference: 0, unmatchedItems: [], status: 'TIE' },
        ],
      }),
    );
    expect(pulse.signOffReady).toBe(true);
    expect(pulse.signOffReason).toBeNull();
  });

  it('signOffReady is false with explanatory reason when tasks open', () => {
    const pulse = computePulse(
      makeCycle({
        tasks: [
          { id: '1', kind: 'a', titleEn: '', titleEs: '', ownerId: null, dueAt: null, status: 'IN_PROGRESS', blockedByIds: [], evidenceUrls: [], completedAt: null },
        ],
      }),
    );
    expect(pulse.signOffReady).toBe(false);
    expect(pulse.signOffReason).toMatch(/task/i);
  });

  it('signOffReady is false when recon exceptions exist even if tasks done', () => {
    const pulse = computePulse(
      makeCycle({
        tasks: [],
        reconciliations: [
          { id: '1', account: 'a', reconType: 'BANK', glBalance: 0, externalBalance: 0, difference: 100, unmatchedItems: [], status: 'EXCEPTION' },
        ],
      }),
    );
    expect(pulse.signOffReady).toBe(false);
    expect(pulse.signOffReason).toMatch(/reconciliation/i);
  });

  it('signOffReady is false when cycle is already SIGNED_OFF', () => {
    const pulse = computePulse(makeCycle({ status: 'SIGNED_OFF' }));
    expect(pulse.signOffReady).toBe(false);
    expect(pulse.signOffReason).toMatch(/already/i);
  });
});
