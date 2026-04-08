/**
 * Pure functions that turn a CloseCycleDetail into the numbers a controller
 * needs to answer "where are we" in under 30 seconds.
 *
 * Extracted from CycleHeader so they're easy to unit-test without rendering.
 * Every function in here is referentially transparent — same inputs, same
 * outputs, no side effects, no Date.now() captured at module load.
 */

import type { CloseCycleDetail } from '@/lib/close-api';

export interface CyclePulse {
  /** 1-indexed day of close (day 1 is the day the cycle was opened). */
  dayNumber: number;
  /** Total days from open to target close, inclusive. Null if no target set. */
  targetDays: number | null;
  /** Days remaining to target. Negative when overdue. Null if no target. */
  daysRemaining: number | null;
  /** Tasks done or waived. */
  tasksDone: number;
  /** Tasks still open (any non-terminal status). */
  tasksOpen: number;
  /** Tasks blocked specifically. Surfaces because blockers are the killer. */
  tasksBlocked: number;
  /** Reconciliations not in tie. */
  reconExceptions: number;
  /** Material flux narratives. */
  materialFlux: number;
  /** % of total tasks done — goes into the progress ring. */
  percentDone: number;
  /** Whether the cycle is gate-clear for sign-off. */
  signOffReady: boolean;
  /** Why sign-off is blocked, if blocked. */
  signOffReason: string | null;
}

/**
 * Compute the daily pulse from a fully-loaded cycle. The `now` parameter is
 * injectable so tests can pin time without freezing the system clock.
 */
export function computePulse(cycle: CloseCycleDetail, now: Date = new Date()): CyclePulse {
  const opened = new Date(cycle.openedAt);
  const dayNumber = Math.max(
    1,
    Math.floor((startOfDay(now) - startOfDay(opened)) / 86_400_000) + 1,
  );

  let targetDays: number | null = null;
  let daysRemaining: number | null = null;
  if (cycle.targetCloseAt) {
    const target = new Date(cycle.targetCloseAt);
    targetDays = Math.max(
      1,
      Math.floor((startOfDay(target) - startOfDay(opened)) / 86_400_000) + 1,
    );
    daysRemaining = Math.floor((startOfDay(target) - startOfDay(now)) / 86_400_000);
  }

  const tasks = cycle.tasks ?? [];
  const tasksDone = tasks.filter((t) => t.status === 'DONE' || t.status === 'WAIVED').length;
  const tasksOpen = tasks.length - tasksDone;
  const tasksBlocked = tasks.filter((t) => t.status === 'BLOCKED').length;

  const recs = cycle.reconciliations ?? [];
  const reconExceptions = recs.filter(
    (r) => r.status !== 'TIE' && r.status !== 'SIGNED_OFF' && r.status !== 'REVIEWED',
  ).length;

  const flux = cycle.fluxNarratives ?? [];
  const materialFlux = flux.filter((f) => f.isMaterial).length;

  const percentDone = tasks.length === 0 ? 0 : tasksDone / tasks.length;

  // Sign-off gate logic mirrors the backend signOffCycle method exactly.
  // We compute it client-side so the button can be disabled before the API
  // round-trip — defense in depth, the backend still enforces it.
  let signOffReason: string | null = null;
  if (cycle.status === 'SIGNED_OFF') {
    signOffReason = 'Cycle already signed off';
  } else if (tasksOpen > 0) {
    signOffReason = `${tasksOpen} task(s) still open`;
  } else if (reconExceptions > 0) {
    signOffReason = `${reconExceptions} reconciliation(s) not in tie`;
  }
  const signOffReady = signOffReason === null;

  return {
    dayNumber,
    targetDays,
    daysRemaining,
    tasksDone,
    tasksOpen,
    tasksBlocked,
    reconExceptions,
    materialFlux,
    percentDone,
    signOffReady,
    signOffReason,
  };
}

function startOfDay(d: Date): number {
  const c = new Date(d);
  c.setHours(0, 0, 0, 0);
  return c.getTime();
}
