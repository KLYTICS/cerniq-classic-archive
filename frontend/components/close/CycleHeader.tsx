'use client';

/**
 * CycleHeader — the daily-pulse banner.
 *
 * This is the single most important component in the cockpit. When Maria
 * (controller) opens her laptop at 7:45am with coffee, the first thing she
 * sees should answer "where are we" in under 2 seconds and "what's blocking
 * sign-off" in under 30. Everything in this header earns its pixels against
 * those two questions.
 *
 * Layout:
 *   ┌──────────────────────────────────────────────────────────────────┐
 *   │ KICKER · period           [progress ring]    [SIGN OFF cta]      │
 *   │ TITLE                                         status pill        │
 *   │ pulse strip: day · target · blockers · exceptions · material     │
 *   └──────────────────────────────────────────────────────────────────┘
 */

import { CheckCircle2, AlertTriangle, Lock, Loader2, Unlock } from 'lucide-react';
import type { CloseCycleDetail } from '@/lib/close-api';
import { computePulse } from './cycleMath';

type Lang = 'en' | 'es';

interface CycleHeaderProps {
  cycle: CloseCycleDetail;
  lang: Lang;
  onSignOff: () => void;
  onReopen?: () => void;
  signingOff?: boolean;
  /** Injectable clock for tests + storybook. Defaults to real now. */
  now?: Date;
}

const COPY = {
  en: {
    kicker: 'Close Cockpit',
    period: 'Period',
    day: 'Day',
    of: 'of',
    target: 'Target',
    overdue: 'overdue',
    daysLeft: 'days left',
    blockers: 'Blockers',
    exceptions: 'Exceptions',
    material: 'Material flux',
    tasksDone: 'Tasks done',
    signOff: 'Sign off',
    signedOff: 'Signed off',
    signingOff: 'Signing off…',
    reopen: 'Reopen',
    locked: 'Locked',
  },
  es: {
    kicker: 'Cabina de Cierre',
    period: 'Período',
    day: 'Día',
    of: 'de',
    target: 'Objetivo',
    overdue: 'vencido',
    daysLeft: 'días restantes',
    blockers: 'Bloqueos',
    exceptions: 'Excepciones',
    material: 'Flujo material',
    tasksDone: 'Tareas listas',
    signOff: 'Aprobar',
    signedOff: 'Aprobado',
    signingOff: 'Aprobando…',
    reopen: 'Reabrir',
    locked: 'Bloqueado',
  },
} as const;

function fmtPeriod(year: number, month: number): string {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[month - 1]} ${year}`;
}

function ProgressRing({ pct }: { pct: number }) {
  const r = 26;
  const circ = 2 * Math.PI * r;
  const dash = circ * Math.min(1, Math.max(0, pct));
  // Color shifts as the cycle progresses — red → amber → green is a UX
  // pattern controllers recognize from every other finance tool they use.
  const color = pct >= 1 ? '#10B981' : pct >= 0.5 ? '#F59E0B' : '#EF4444';
  return (
    <svg width={64} height={64} viewBox="0 0 64 64" aria-hidden>
      <circle cx={32} cy={32} r={r} fill="none" stroke="#E2E8F0" strokeWidth={6} />
      <circle
        cx={32}
        cy={32}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth={6}
        strokeLinecap="round"
        strokeDasharray={`${dash} ${circ - dash}`}
        transform="rotate(-90 32 32)"
      />
      <text
        x={32}
        y={37}
        textAnchor="middle"
        className="font-mono"
        fontSize={14}
        fontWeight={700}
        fill="#0F172A"
      >
        {Math.round(pct * 100)}%
      </text>
    </svg>
  );
}

export function CycleHeader({
  cycle,
  lang,
  onSignOff,
  onReopen,
  signingOff = false,
  now,
}: CycleHeaderProps) {
  const t = COPY[lang];
  const pulse = computePulse(cycle, now);

  // Status pill mirrors the cycle status. Read by every CFO landing here.
  const statusPill = (() => {
    if (cycle.status === 'SIGNED_OFF') {
      return { label: t.signedOff, className: 'border-emerald-200 bg-emerald-50 text-emerald-700' };
    }
    if (cycle.status === 'IN_REVIEW') {
      return { label: 'IN REVIEW', className: 'border-amber-200 bg-amber-50 text-amber-800' };
    }
    if (cycle.status === 'REOPENED') {
      return { label: 'REOPENED', className: 'border-slate-200 bg-slate-50 text-slate-600' };
    }
    return { label: 'OPEN', className: 'border-blue-200 bg-blue-50 text-blue-700' };
  })();

  // Days-remaining tone — overdue rings the alarm visually.
  let daysRemainingNode: React.ReactNode = null;
  if (pulse.daysRemaining != null) {
    if (pulse.daysRemaining < 0) {
      daysRemainingNode = (
        <span className="text-rose-700">
          {Math.abs(pulse.daysRemaining)} {lang === 'en' ? 'days' : 'días'} {t.overdue}
        </span>
      );
    } else {
      daysRemainingNode = (
        <span className="text-slate-600">
          {pulse.daysRemaining} {t.daysLeft}
        </span>
      );
    }
  }

  return (
    <section className="cerniq-shell relative overflow-hidden p-6 sm:p-8">
      <div className="cerniq-data-wave" />
      <div className="relative z-10 flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
        {/* Left: kicker, title, period */}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="cerniq-kicker">{t.kicker}</span>
            <span
              className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${statusPill.className}`}
            >
              {statusPill.label}
            </span>
          </div>
          <h1 className="mt-3 font-display text-3xl text-slate-950 sm:text-4xl">
            {fmtPeriod(cycle.periodYear, cycle.periodMonth)}
          </h1>

          {/* Daily pulse strip — the 30-second answer */}
          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            <PulseCell
              label={`${t.day} ${pulse.dayNumber}${pulse.targetDays ? ` ${t.of} ${pulse.targetDays}` : ''}`}
              value={daysRemainingNode ?? '—'}
              tone={pulse.daysRemaining != null && pulse.daysRemaining < 0 ? 'bad' : 'neutral'}
            />
            <PulseCell
              label={t.tasksDone}
              value={`${pulse.tasksDone} / ${pulse.tasksDone + pulse.tasksOpen}`}
              tone="neutral"
            />
            <PulseCell
              label={t.blockers}
              value={pulse.tasksBlocked}
              tone={pulse.tasksBlocked > 0 ? 'bad' : 'good'}
            />
            <PulseCell
              label={t.exceptions}
              value={pulse.reconExceptions}
              tone={pulse.reconExceptions > 0 ? 'bad' : 'good'}
            />
            <PulseCell
              label={t.material}
              value={pulse.materialFlux}
              tone={pulse.materialFlux > 0 ? 'warn' : 'good'}
            />
          </div>
        </div>

        {/* Right: progress ring + sign-off CTA */}
        <div className="flex shrink-0 items-center gap-5">
          <ProgressRing pct={pulse.percentDone} />
          <SignOffButton
            ready={pulse.signOffReady}
            reason={pulse.signOffReason}
            status={cycle.status}
            signingOff={signingOff}
            onSignOff={onSignOff}
            onReopen={onReopen}
            t={t}
          />
        </div>
      </div>
    </section>
  );
}

function PulseCell({
  label,
  value,
  tone,
}: {
  label: string;
  value: React.ReactNode;
  tone: 'good' | 'bad' | 'warn' | 'neutral';
}) {
  const valueClass = {
    good: 'text-emerald-700',
    bad: 'text-rose-700',
    warn: 'text-amber-700',
    neutral: 'text-slate-900',
  }[tone];
  return (
    <div className="rounded-xl border border-slate-200 bg-white/70 px-3 py-2 backdrop-blur-sm">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">{label}</div>
      <div className={`mt-0.5 font-mono text-xl font-semibold tabular-nums ${valueClass}`}>{value}</div>
    </div>
  );
}

function SignOffButton({
  ready,
  reason,
  status,
  signingOff,
  onSignOff,
  onReopen,
  t,
}: {
  ready: boolean;
  reason: string | null;
  status: string;
  signingOff: boolean;
  onSignOff: () => void;
  onReopen?: () => void;
  t: (typeof COPY)[Lang];
}) {
  if (status === 'SIGNED_OFF') {
    return (
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700">
          <Lock className="h-4 w-4" />
          {t.signedOff}
        </div>
        {onReopen ? (
          <button
            type="button"
            onClick={onReopen}
            className="inline-flex items-center gap-1.5 rounded-full border border-amber-300 bg-white px-3 py-2 text-xs font-semibold text-amber-700 shadow-sm hover:bg-amber-50"
          >
            <Unlock className="h-3.5 w-3.5" />
            {t.reopen}
          </button>
        ) : null}
      </div>
    );
  }
  if (signingOff) {
    return (
      <button
        type="button"
        disabled
        className="inline-flex items-center gap-2 rounded-full bg-slate-700 px-5 py-2.5 text-sm font-semibold text-white opacity-80"
      >
        <Loader2 className="h-4 w-4 animate-spin" />
        {t.signingOff}
      </button>
    );
  }
  if (ready) {
    return (
      <button
        type="button"
        onClick={onSignOff}
        className="inline-flex items-center gap-2 rounded-full bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white shadow hover:bg-emerald-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
      >
        <CheckCircle2 className="h-4 w-4" />
        {t.signOff}
      </button>
    );
  }
  return (
    <div className="max-w-[220px]">
      <button
        type="button"
        disabled
        title={reason ?? undefined}
        aria-disabled
        className="inline-flex w-full items-center gap-2 rounded-full border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-400"
      >
        <AlertTriangle className="h-4 w-4 text-amber-500" />
        {t.signOff}
      </button>
      {reason ? (
        <p className="mt-1.5 text-right text-[11px] leading-snug text-slate-500">{reason}</p>
      ) : null}
    </div>
  );
}
