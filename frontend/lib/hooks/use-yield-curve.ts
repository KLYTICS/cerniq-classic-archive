'use client';

/**
 * useYieldCurve — fetch the US Treasury Constant-Maturity yield curve from
 * the cerniq backend (`/api/market-data/yield-curve`, FRED-backed).
 *
 * Macro data, not institution-scoped — unlike `useAlmEndpoint`, this hook
 * doesn't take an institutionId. The curve is the same for every cerniq
 * user; the backend caches it for 1h (FRED publishes daily).
 *
 * Discriminated-union return shape so the UI must explicitly handle each
 * state (loading / data / data-gap / error) — no silent zero rendering
 * (KLYTICS Rule 1 reaches into the frontend layer here).
 *
 * When the backend returns HTTP 503 with a `__dataGap: true` body, this
 * hook surfaces that as `state: 'data-gap'` with the structured gap so the
 * UI can render an honest "data unavailable" message rather than an
 * implicit empty curve.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

import { getConfiguredApiOrigin } from '@/lib/api-base';

/** Mirrors backend YieldCurveDto. Frontend duplicates the shape rather than
 *  importing from backend to avoid coupling deploy artifacts. */
export interface YieldCurvePoint {
  tenor:
    | '1M'
    | '3M'
    | '6M'
    | '1Y'
    | '2Y'
    | '3Y'
    | '5Y'
    | '7Y'
    | '10Y'
    | '20Y'
    | '30Y';
  rate: number;
  asOf: string;
  seriesId: string;
}

export interface YieldCurve {
  curve: string;
  currency: string;
  points: YieldCurvePoint[];
  asOf: string;
  provider: string;
  serverTimestamp: string;
  inverted: boolean;
  invertedDetail?: string;
}

export interface YieldCurveDataGap {
  __dataGap: true;
  field: string;
  severity: 'CRITICAL' | 'WARNING' | 'INFO';
  reason: string;
  action: string;
  provider: string;
}

export type YieldCurveState =
  | { state: 'idle' }
  | { state: 'loading' }
  | { state: 'data'; curve: YieldCurve }
  | { state: 'data-gap'; gap: YieldCurveDataGap }
  | { state: 'error'; message: string };

export interface UseYieldCurveResult {
  state: YieldCurveState;
  refetch: () => void;
}

export function useYieldCurve(): UseYieldCurveResult {
  const [state, setState] = useState<YieldCurveState>({ state: 'idle' });
  const abortRef = useRef<AbortController | null>(null);

  const fetchCurve = useCallback(async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setState({ state: 'loading' });

    try {
      const base = getConfiguredApiOrigin();
      const url = base
        ? `${base}/api/market-data/yield-curve`
        : '/api/market-data/yield-curve';
      const response = await fetch(url, {
        signal: controller.signal,
        credentials: 'include',
      });

      if (response.status === 503) {
        // Backend returned a structured DataGap — surface it explicitly.
        try {
          const body = (await response.json()) as YieldCurveDataGap;
          if (controller.signal.aborted) return;
          setState({ state: 'data-gap', gap: body });
        } catch {
          if (controller.signal.aborted) return;
          setState({
            state: 'error',
            message: 'Backend returned 503 with malformed body',
          });
        }
        return;
      }

      if (!response.ok) {
        if (controller.signal.aborted) return;
        setState({
          state: 'error',
          message: `HTTP ${response.status} ${response.statusText}`,
        });
        return;
      }

      const curve = (await response.json()) as YieldCurve;
      if (controller.signal.aborted) return;
      setState({ state: 'data', curve });
    } catch (err: unknown) {
      if (controller.signal.aborted) return;
      if (err instanceof Error && err.name === 'AbortError') return;
      const message = err instanceof Error ? err.message : 'Unknown error';
      setState({ state: 'error', message });
    }
  }, []);

  useEffect(() => {
    fetchCurve();
    return () => {
      abortRef.current?.abort();
    };
  }, [fetchCurve]);

  return { state, refetch: fetchCurve };
}
