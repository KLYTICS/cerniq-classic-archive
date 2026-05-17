'use client';

/**
 * YieldCurveCard — US Treasury Constant-Maturity yield curve, Bloomberg-
 * density rendering. Pulls live data from `/api/market-data/yield-curve`
 * (FRED-backed via cerniq backend).
 *
 * Surfaces three states honestly per KLYTICS Rule 1:
 *   - loading: skeleton text
 *   - data: dense table + recharts line + inversion banner if applicable
 *   - data-gap: a clear "data unavailable, here's why" message (no zero curve)
 *   - error: terse error with a retry button
 *
 * No silent fallbacks. The component never renders a fake or empty curve.
 */

import { useMemo } from 'react';
import {
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  ReferenceLine,
} from 'recharts';

import {
  useYieldCurve,
  type YieldCurvePoint,
} from '@/lib/hooks/use-yield-curve';

/** Map tenor labels to a sortable numeric value so the X axis renders in
 *  conventional curve-plot order regardless of the source array order. */
const TENOR_ORDER: Record<YieldCurvePoint['tenor'], number> = {
  '1M': 1 / 12,
  '3M': 3 / 12,
  '6M': 6 / 12,
  '1Y': 1,
  '2Y': 2,
  '3Y': 3,
  '5Y': 5,
  '7Y': 7,
  '10Y': 10,
  '20Y': 20,
  '30Y': 30,
};

export function YieldCurveCard(): JSX.Element {
  const { state, refetch } = useYieldCurve();

  // Memoize chart data so recharts doesn't re-key the dataset on each render.
  const chartData = useMemo(() => {
    if (state.state !== 'data') return [];
    return [...state.curve.points]
      .sort((a, b) => TENOR_ORDER[a.tenor] - TENOR_ORDER[b.tenor])
      .map((p) => ({ tenor: p.tenor, rate: p.rate, x: TENOR_ORDER[p.tenor] }));
  }, [state]);

  if (state.state === 'loading' || state.state === 'idle') {
    return (
      <section
        aria-label="US Treasury yield curve, loading"
        className="rounded border border-zinc-800 bg-zinc-950 p-4 font-mono text-sm text-zinc-400"
      >
        <header className="mb-2 flex items-center justify-between border-b border-zinc-800 pb-2">
          <h2 className="text-xs uppercase tracking-wider text-zinc-500">
            US Treasury Yield Curve
          </h2>
          <span className="text-xs text-zinc-600">loading…</span>
        </header>
        <div className="h-48 animate-pulse rounded bg-zinc-900" />
      </section>
    );
  }

  if (state.state === 'error') {
    return (
      <section
        aria-label="US Treasury yield curve, error"
        className="rounded border border-rose-900/50 bg-zinc-950 p-4 font-mono text-sm text-rose-300"
      >
        <header className="mb-2 flex items-center justify-between border-b border-rose-900/40 pb-2">
          <h2 className="text-xs uppercase tracking-wider text-rose-400">
            US Treasury Yield Curve — error
          </h2>
          <button
            onClick={refetch}
            className="text-xs uppercase tracking-wider text-zinc-400 hover:text-zinc-100"
          >
            retry
          </button>
        </header>
        <p className="text-xs text-rose-300">{state.message}</p>
      </section>
    );
  }

  if (state.state === 'data-gap') {
    return (
      <section
        aria-label="US Treasury yield curve, data unavailable"
        className="rounded border border-amber-900/50 bg-zinc-950 p-4 font-mono text-sm text-amber-200"
      >
        <header className="mb-2 flex items-center justify-between border-b border-amber-900/40 pb-2">
          <h2 className="text-xs uppercase tracking-wider text-amber-400">
            US Treasury Yield Curve — data gap
          </h2>
          <button
            onClick={refetch}
            className="text-xs uppercase tracking-wider text-zinc-400 hover:text-zinc-100"
          >
            retry
          </button>
        </header>
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
          <dt className="text-zinc-500">Field</dt>
          <dd>{state.gap.field}</dd>
          <dt className="text-zinc-500">Reason</dt>
          <dd>{state.gap.reason}</dd>
          <dt className="text-zinc-500">Provider</dt>
          <dd>{state.gap.provider}</dd>
          <dt className="text-zinc-500">Action</dt>
          <dd className="text-amber-200">{state.gap.action}</dd>
        </dl>
      </section>
    );
  }

  // state.state === 'data'
  const { curve } = state;
  return (
    <section
      aria-label="US Treasury yield curve"
      className="rounded border border-zinc-800 bg-zinc-950 p-4 font-mono text-sm text-zinc-100"
    >
      <header className="mb-2 flex items-center justify-between border-b border-zinc-800 pb-2">
        <div>
          <h2 className="text-xs uppercase tracking-wider text-zinc-500">
            {curve.curve.replace(/_/g, ' ')} · {curve.currency}
          </h2>
          <p className="mt-0.5 text-[10px] text-zinc-600">
            asOf {curve.asOf} · provider {curve.provider}
          </p>
        </div>
        <button
          onClick={refetch}
          className="text-xs uppercase tracking-wider text-zinc-400 hover:text-zinc-100"
        >
          refresh
        </button>
      </header>

      {curve.inverted && (
        <div
          className="mb-3 border-l-2 border-amber-400 bg-amber-950/30 px-3 py-2 text-xs text-amber-200"
          role="alert"
          aria-label="yield curve inversion warning"
        >
          <span className="font-semibold">⚠ Curve inverted.</span>{' '}
          {curve.invertedDetail ?? '10Y below 2Y'}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-[1fr_minmax(180px,260px)]">
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={chartData}
              margin={{ top: 5, right: 8, left: -10, bottom: 5 }}
            >
              <XAxis
                dataKey="tenor"
                stroke="#52525b"
                tick={{ fill: '#a1a1aa', fontSize: 10 }}
                tickLine={false}
                axisLine={{ stroke: '#3f3f46' }}
              />
              <YAxis
                stroke="#52525b"
                tick={{ fill: '#a1a1aa', fontSize: 10 }}
                tickLine={false}
                axisLine={{ stroke: '#3f3f46' }}
                tickFormatter={(v: number) => `${v.toFixed(2)}%`}
                domain={['auto', 'auto']}
              />
              <Tooltip
                contentStyle={{
                  background: '#0a0a0a',
                  border: '1px solid #3f3f46',
                  fontSize: 11,
                  fontFamily: 'ui-monospace, SFMono-Regular, monospace',
                }}
                labelStyle={{ color: '#a1a1aa' }}
                itemStyle={{ color: '#fef08a' }}
                formatter={(v: number) => [`${v.toFixed(2)}%`, 'Yield']}
              />
              {curve.inverted && (
                <ReferenceLine y={0} stroke="#52525b" strokeDasharray="2 2" />
              )}
              <Line
                type="monotone"
                dataKey="rate"
                stroke="#fde047"
                strokeWidth={1.5}
                dot={{ fill: '#fef08a', r: 2.5 }}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <table className="w-full text-right text-xs">
          <thead>
            <tr className="border-b border-zinc-800 text-zinc-500">
              <th className="py-1 text-left font-normal">tenor</th>
              <th className="py-1 font-normal">rate</th>
              <th className="py-1 font-normal text-zinc-600">series</th>
            </tr>
          </thead>
          <tbody className="font-mono">
            {chartData.map((p) => (
              <tr
                key={p.tenor}
                className="border-b border-zinc-900 last:border-0"
              >
                <td className="py-1 text-left text-zinc-300">{p.tenor}</td>
                <td className="py-1 text-amber-300">{p.rate.toFixed(2)}%</td>
                <td className="py-1 text-zinc-600">
                  {curve.points.find((cp) => cp.tenor === p.tenor)?.seriesId ??
                    '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
