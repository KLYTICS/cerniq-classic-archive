'use client';

/**
 * useCycleLive — polling hook for the Close Cockpit workspace.
 *
 * Customer journey moment: Maria keeps the cockpit open in a pinned tab.
 * Jose posts a JE over in JE panel on his laptop; within 30 seconds
 * Maria's pulse banner updates without her touching anything. If she
 * switches tabs (to check email), polling pauses — we're not burning her
 * battery or hitting the API for a tab she can't see. When she comes
 * back, we refetch immediately so the first glance is always fresh.
 *
 * Why polling instead of SSE/WebSocket: polling costs one HTTP round-trip
 * every 30 seconds on a single endpoint that's already cacheable. SSE
 * requires sticky connections through Railway's HTTP proxy, and the
 * operational surface area isn't worth it for a 30-second freshness
 * window. If we ever need sub-second updates, we'll swap this hook's
 * internals without touching any callers.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { closeApi, type CloseCycleDetail, type CloseActivity } from '@/lib/close-api';

export interface UseCycleLiveOptions {
  /** Milliseconds between polls when the tab is visible. Default 30s. */
  intervalMs?: number;
  /** When true, polling is disabled entirely (for tests). */
  paused?: boolean;
}

export interface UseCycleLiveResult {
  cycle: CloseCycleDetail | null;
  activity: CloseActivity[];
  loading: boolean;
  error: string | null;
  lastFetchedAt: Date | null;
  /** Manually re-fetch. Use this after local mutations. */
  refetch: () => Promise<void>;
  /** Replace the cycle in local state — used for optimistic updates. */
  setCycle: (updater: (prev: CloseCycleDetail | null) => CloseCycleDetail | null) => void;
}

export function useCycleLive(cycleId: string, opts: UseCycleLiveOptions = {}): UseCycleLiveResult {
  const intervalMs = opts.intervalMs ?? 30_000;
  const paused = opts.paused ?? false;

  const [cycle, setCycle] = useState<CloseCycleDetail | null>(null);
  const [activity, setActivity] = useState<CloseActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastFetchedAt, setLastFetchedAt] = useState<Date | null>(null);

  // Keep the latest fetcher in a ref so the timer loop always uses the
  // current cycleId without forcing a timer restart on every re-render.
  const fetchRef = useRef<() => Promise<void>>(async () => undefined);

  const fetchOnce = useCallback(async () => {
    if (!cycleId) return;
    try {
      setError(null);
      // Fetch cycle and activity in parallel — single network RTT.
      const [fresh, feed] = await Promise.all([
        closeApi.getCycle(cycleId),
        closeApi.listActivity(cycleId).catch(() => [] as CloseActivity[]),
      ]);
      setCycle(fresh);
      setActivity(feed);
      setLastFetchedAt(new Date());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to fetch cycle');
    } finally {
      setLoading(false);
    }
  }, [cycleId]);

  // Keep ref current.
  useEffect(() => {
    fetchRef.current = fetchOnce;
  }, [fetchOnce]);

  // Initial load whenever cycleId changes.
  useEffect(() => {
    setLoading(true);
    fetchOnce();
  }, [cycleId, fetchOnce]);

  // Polling loop with visibility gating.
  useEffect(() => {
    if (paused || !cycleId) return;

    let timer: ReturnType<typeof setInterval> | null = null;

    function start() {
      if (timer) return;
      timer = setInterval(() => {
        // Double-check visibility in case focus/blur events were missed.
        if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
          fetchRef.current();
        }
      }, intervalMs);
    }

    function stop() {
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
    }

    function onVisibility() {
      if (typeof document === 'undefined') return;
      if (document.visibilityState === 'visible') {
        // Immediately refresh when the user comes back to the tab — no
        // waiting for the next interval tick.
        fetchRef.current();
        start();
      } else {
        stop();
      }
    }

    if (typeof document === 'undefined' || document.visibilityState === 'visible') {
      start();
    }
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', onVisibility);
    }

    return () => {
      stop();
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', onVisibility);
      }
    };
  }, [cycleId, intervalMs, paused]);

  const setCycleFn = useCallback(
    (updater: (prev: CloseCycleDetail | null) => CloseCycleDetail | null) => {
      setCycle((prev) => updater(prev));
    },
    [],
  );

  return {
    cycle,
    activity,
    loading,
    error,
    lastFetchedAt,
    refetch: fetchOnce,
    setCycle: setCycleFn,
  };
}
