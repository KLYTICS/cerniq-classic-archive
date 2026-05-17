'use client';

/**
 * MacroIndicatorCard — generic Bloomberg-density rendering for a single
 * macro data point (rate, indicator value, FX pair). Pairs with the
 * `useMacroData` factory + its `useInterestRate` / `useEconomicIndicator`
 * / `useFXRate` instantiations.
 *
 * Renders 4 explicit states (loading / data / data-gap / error) with the
 * SAME visual language as `YieldCurveCard` so the `/alm/market-rates` grid
 * reads uniformly. No silent zero fallbacks — KLYTICS Rule 1 in the UI.
 *
 * Callers pass a `useMacroData` result and a value-extraction function;
 * the card handles the state machine + the chrome (title, asOf, provider,
 * seriesId footer, refresh button).
 */

import type { JSX } from 'react';
import type {
  MacroDataState,
  UseMacroDataResult,
} from '@/lib/hooks/use-macro-data';

/** Minimum contract the data object must satisfy to render in this card.
 *  All three FRED-backed payload shapes (InterestRate, EconomicIndicator,
 *  FXRate) match this — `seriesId`/`asOf`/`provider` are always present. */
interface BaseMacroPayload {
  asOf: string;
  provider: string;
  seriesId?: string;
  pair?: string; // FX-specific; ignored when absent
}

interface MacroIndicatorCardProps<T extends BaseMacroPayload> {
  /** Display title — usually the series' canonical name. */
  title: string;
  /** Short subtitle / context line under the title. Optional. */
  subtitle?: string;
  /** The result from any of the useMacroData factory instantiations. */
  result: UseMacroDataResult<T>;
  /** Pull the numeric value out of the success payload. */
  valueAccessor: (data: T) => number;
  /** Suffix for the value (e.g. '%' for rates, '' for indices, '/USD' for FX). */
  valueSuffix?: string;
  /** Number formatter; defaults to 2 decimals. */
  valueFormat?: (v: number) => string;
}

export function MacroIndicatorCard<T extends BaseMacroPayload>({
  title,
  subtitle,
  result,
  valueAccessor,
  valueSuffix = '',
  valueFormat = (v: number) => v.toFixed(2),
}: MacroIndicatorCardProps<T>): JSX.Element {
  const { state, refetch } = result;
  return (
    <section
      aria-label={title}
      className="rounded border border-zinc-800 bg-zinc-950 p-4 font-mono text-sm text-zinc-100"
    >
      <header className="mb-3 flex items-center justify-between border-b border-zinc-800 pb-2">
        <div>
          <h3 className="text-xs uppercase tracking-wider text-zinc-500">
            {title}
          </h3>
          {subtitle && (
            <p className="mt-0.5 text-[10px] text-zinc-600">{subtitle}</p>
          )}
        </div>
        <button
          onClick={refetch}
          className="text-[10px] uppercase tracking-wider text-zinc-500 hover:text-zinc-200"
        >
          refresh
        </button>
      </header>
      <CardBody
        state={state}
        valueAccessor={valueAccessor}
        valueSuffix={valueSuffix}
        valueFormat={valueFormat}
      />
    </section>
  );
}

interface CardBodyProps<T extends BaseMacroPayload> {
  state: MacroDataState<T>;
  valueAccessor: (data: T) => number;
  valueSuffix: string;
  valueFormat: (v: number) => string;
}

function CardBody<T extends BaseMacroPayload>({
  state,
  valueAccessor,
  valueSuffix,
  valueFormat,
}: CardBodyProps<T>): JSX.Element {
  if (state.state === 'idle' || state.state === 'loading') {
    return <div className="h-12 animate-pulse rounded bg-zinc-900" />;
  }
  if (state.state === 'error') {
    return (
      <p className="text-xs text-rose-300" role="alert">
        error: {state.message}
      </p>
    );
  }
  if (state.state === 'data-gap') {
    return (
      <div className="text-xs text-amber-200" role="alert">
        <p className="mb-1 font-semibold">⚠ data unavailable</p>
        <dl className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5">
          <dt className="text-zinc-500">reason</dt>
          <dd>{state.gap.reason}</dd>
          <dt className="text-zinc-500">provider</dt>
          <dd>{state.gap.provider}</dd>
          {state.gap.seriesId && (
            <>
              <dt className="text-zinc-500">series</dt>
              <dd>{state.gap.seriesId}</dd>
            </>
          )}
        </dl>
      </div>
    );
  }
  // state === 'data'
  const value = valueAccessor(state.data);
  const id = state.data.pair ?? state.data.seriesId ?? '—';
  return (
    <div>
      <p className="text-2xl text-amber-300">
        {valueFormat(value)}
        <span className="ml-0.5 text-base text-zinc-400">{valueSuffix}</span>
      </p>
      <p className="mt-1 text-[10px] text-zinc-600">
        asOf {state.data.asOf} · {state.data.provider} · {id}
      </p>
    </div>
  );
}
