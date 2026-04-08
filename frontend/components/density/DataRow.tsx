import type { Locale } from '@/lib/i18n';
import type { LabelUnit } from '@/lib/alm/labels';
import { label, labelUnit } from '@/lib/alm/labels';
import { NumberCell } from './NumberCell';
import { TrendArrow } from './TrendArrow';
import { SparklineCell } from './SparklineCell';

/**
 * DataRow — single 28px-tall label-value-delta-sparkline row.
 *
 * The atom of dense reporting. Use stacked DataRows when you want a vertical
 * label/value list (e.g. yield curve parameter dump). Use DataTable when you
 * want a header row and consistent columns.
 *
 * Server-component-compatible.
 */

export interface DataRowProps {
  /** Backend identifier — auto-resolved via labels dictionary */
  recordKey: string;
  /** Override display label */
  labelOverride?: string;
  value: number | string | null | undefined;
  unit?: LabelUnit;
  delta?: number | null;
  invertedDelta?: boolean;
  trend?: readonly number[];
  locale: Locale;
  /** Optional badge/status text to right of value */
  badge?: string;
  badgeTone?: 'neutral' | 'success' | 'warning' | 'danger';
  className?: string;
}

const BADGE_TONES = {
  neutral: 'bg-slate-100 text-slate-700',
  success: 'bg-emerald-50 text-emerald-700',
  warning: 'bg-amber-50 text-amber-700',
  danger:  'bg-rose-50 text-rose-700',
} as const;

export function DataRow({
  recordKey,
  labelOverride,
  value,
  unit,
  delta,
  invertedDelta,
  trend,
  locale,
  badge,
  badgeTone = 'neutral',
  className,
}: DataRowProps) {
  const displayLabel = labelOverride ?? label(recordKey, locale);
  const resolvedUnit = unit ?? labelUnit(recordKey);

  return (
    <div
      className={`flex h-7 items-center gap-2 border-b border-slate-50 px-2 last:border-0 hover:bg-slate-50/60 ${className ?? ''}`}
    >
      <span className="flex-1 truncate text-[11px] text-slate-600" title={displayLabel}>
        {displayLabel}
      </span>
      {trend && trend.length >= 2 ? (
        <SparklineCell values={trend} width={48} height={12} color="auto" />
      ) : null}
      {delta != null ? (
        <TrendArrow delta={delta} unit={resolvedUnit} inverted={invertedDelta} />
      ) : null}
      <span className="text-right">
        {typeof value === 'number' ? (
          <NumberCell value={value} unit={resolvedUnit} size="text-xs" />
        ) : (
          <span className="text-xs tabular-nums text-slate-950">{value ?? '—'}</span>
        )}
      </span>
      {badge ? (
        <span className={`rounded px-1.5 py-px text-[9px] font-bold uppercase tracking-wider ${BADGE_TONES[badgeTone]}`}>
          {badge}
        </span>
      ) : null}
    </div>
  );
}
