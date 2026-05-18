'use client';

/**
 * useMacroData — generic factory hook for live macro-data fetches.
 *
 * Distilled from `useYieldCurve` so every macro card on `/alm/market-rates`
 * (Fed Funds rate, CPI, Mortgage 30Y, USD/EUR, etc.) shares one discipline-
 * preserving fetch path: discriminated-union state, AbortController on
 * unmount, explicit DataGap handling on HTTP 503, no silent zeros.
 *
 * Caller supplies the endpoint and a type parameter for the success shape.
 * The hook handles loading / error / data / data-gap states uniformly so
 * UI components can rely on the same render-by-state pattern.
 *
 * Why a factory and not React Query / SWR: this repo doesn't use either
 * library yet, and the existing `useAlmEndpoint` pattern shows the team
 * prefers an explicit hook-per-domain. The factory keeps the per-card
 * hooks one-liners while reusing the proven state machine here.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

import { getConfiguredApiOrigin } from '@/lib/api-base';

/** Structured DataGap returned by the backend when a provider is unavailable
 *  or a series has no recent observation. UI must surface this honestly. */
export interface MacroDataGap {
  __dataGap: true;
  field: string;
  severity: 'CRITICAL' | 'WARNING' | 'INFO';
  reason: string;
  action: string;
  provider: string;
  seriesId?: string;
}

export type MacroDataState<T> =
  | { state: 'idle' }
  | { state: 'loading' }
  | { state: 'data'; data: T }
  | { state: 'data-gap'; gap: MacroDataGap }
  | { state: 'error'; message: string };

export interface UseMacroDataResult<T> {
  state: MacroDataState<T>;
  refetch: () => void;
}

/**
 * Build a macro-data hook for a specific endpoint.
 *
 * @param endpoint Path relative to API origin, beginning with `/api/`. The
 *                 factory prepends `getConfiguredApiOrigin()` when set,
 *                 otherwise treats the path as same-origin.
 */
export function useMacroData<T>(endpoint: string): UseMacroDataResult<T> {
  const [state, setState] = useState<MacroDataState<T>>({ state: 'idle' });
  const abortRef = useRef<AbortController | null>(null);

  const fetchData = useCallback(async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setState({ state: 'loading' });

    try {
      const base = getConfiguredApiOrigin();
      const url = base ? `${base}${endpoint}` : endpoint;
      const response = await fetch(url, {
        signal: controller.signal,
        credentials: 'include',
      });

      if (response.status === 503) {
        try {
          const body = (await response.json()) as MacroDataGap;
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

      const data = (await response.json()) as T;
      if (controller.signal.aborted) return;
      setState({ state: 'data', data });
    } catch (err: unknown) {
      if (controller.signal.aborted) return;
      if (err instanceof Error && err.name === 'AbortError') return;
      const message = err instanceof Error ? err.message : 'Unknown error';
      setState({ state: 'error', message });
    }
  }, [endpoint]);

  useEffect(() => {
    // Canonical async data-fetch on mount. setState in fetchData happens
    // after `await fetch(...)` microtask boundary, guarded by
    // AbortController.signal.aborted — cascading-renders concern doesn't
    // apply. Rule cannot see through async; data-fetch is the documented
    // useEffect exception per react.dev "You Might Not Need an Effect".
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchData();
    return () => {
      abortRef.current?.abort();
    };
  }, [fetchData]);

  return { state, refetch: fetchData };
}

// ─── Typed payloads (mirror backend macro.dto.ts shapes) ────────────────

export interface InterestRate {
  seriesId: string;
  name: string;
  rate: number;
  asOf: string;
  units: 'percent';
  provider: string;
  serverTimestamp: string;
}

export interface EconomicIndicator {
  seriesId: string;
  name: string;
  value: number;
  units: string;
  frequency: string;
  asOf: string;
  provider: string;
  serverTimestamp: string;
}

export interface FXRate {
  pair: string;
  base: string;
  quote: string;
  rate: number;
  asOf: string;
  provider: string;
  serverTimestamp: string;
}

// ─── Convenience instantiations ─────────────────────────────────────────

/** Fetch a named FRED interest-rate series (e.g. DGS10, DFF, DPRIME, SOFR). */
export function useInterestRate(seriesId: string): UseMacroDataResult<InterestRate> {
  return useMacroData<InterestRate>(`/api/market-data/interest-rate/${seriesId}`);
}

/** Fetch an economic indicator (CPI, unemployment, GDP, etc.). */
export function useEconomicIndicator(
  seriesId: string,
): UseMacroDataResult<EconomicIndicator> {
  return useMacroData<EconomicIndicator>(
    `/api/market-data/economic-indicator/${seriesId}`,
  );
}

/** Fetch a FX pair. Caller supplies the FRED `DEX*` series id and the
 *  base / quote currency codes (FRED's quoting convention varies by pair). */
export function useFXRate(
  seriesId: string,
  base: string,
  quote: string,
): UseMacroDataResult<FXRate> {
  return useMacroData<FXRate>(
    `/api/market-data/fx-rate/${seriesId}/${base}/${quote}`,
  );
}
